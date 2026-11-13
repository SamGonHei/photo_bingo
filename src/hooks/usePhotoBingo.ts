import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, TeamId, UserProfile, ChatMessage } from '../types';
import { INITIAL_MISSIONS } from '../data/missions';
import { createShuffledCells, calculateCompletedLines, shuffleArray, isCellInked } from '../utils/bingo';
import confetti from 'canvas-confetti';

const STORAGE_KEY = 'photo_bingo_cloud_relay_v1';
const INK_DURATION_MS = 180 * 1000;

// 전세계 어디서나 GitHub Pages에서도 100% 작동하는 초고속 실시간 WebSocket 릴레이 (404 원천 차단)
const RELAY_WS_URL = 'wss://demo.piesocket.com/v3/photo_bingo_switching_room_2026?api_key=VC3oYAgAn3OHbvBesNYeuZsMuqzTXqjkMDFTqnDa&notify_self=1';

export function getInitialGameState(): GameState {
  return {
    phase: 'WAITING',
    isStarted: false,
    durationSeconds: 7200,
    startTime: null,
    winnerTeam: null,
    candidateTeam: null,
    teamA: {
      id: 'teamA',
      name: 'jackie팀',
      leaderId: 'jackie',
      badge: '👑',
      members: ['jackie', 'hannah', 'nicole', 'sam', 'tori'],
      themeColor: '#4F46E5',
      cells: createShuffledCells(INITIAL_MISSIONS),
      completedLines: 0,
      skills: { inkAttack: 2, shuffleBoard: 1 },
    },
    teamB: {
      id: 'teamB',
      name: 'carol팀',
      leaderId: 'carol',
      badge: '🎀',
      members: ['carol', 'raphaela', 'popo', 'lumi', 'jane'],
      themeColor: '#EC4899',
      cells: createShuffledCells(INITIAL_MISSIONS),
      completedLines: 0,
      skills: { inkAttack: 2, shuffleBoard: 1 },
    },
    messages: [],
  };
}

export function sanitizeGameState(raw: unknown): GameState {
  const base = getInitialGameState();
  if (!raw || typeof raw !== 'object') return base;

  const r = raw as Partial<GameState>;

  const teamA = r.teamA && Array.isArray(r.teamA.cells) && r.teamA.cells.length === 16
    ? { ...base.teamA, ...r.teamA }
    : base.teamA;

  const teamB = r.teamB && Array.isArray(r.teamB.cells) && r.teamB.cells.length === 16
    ? { ...base.teamB, ...r.teamB }
    : base.teamB;

  return {
    phase: r.phase || 'WAITING',
    isStarted: Boolean(r.isStarted),
    durationSeconds: r.durationSeconds || 7200,
    startTime: r.startTime ?? null,
    winnerTeam: r.winnerTeam ?? null,
    candidateTeam: r.candidateTeam ?? null,
    teamA,
    teamB,
    messages: Array.isArray(r.messages) ? r.messages : [],
  };
}

export function usePhotoBingo(currentUser: UserProfile | null) {
  const [gameState, setGameState] = useState<GameState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return sanitizeGameState(JSON.parse(saved));
    } catch {
      // ignore
    }
    return getInitialGameState();
  });

  const [remainingTime, setRemainingTime] = useState<number>(7200);
  const [countdownText, setCountdownText] = useState<string | null>(null);
  const [isShufflingEffect, setIsShufflingEffect] = useState(false);
  const [boardShakeTeam, setBoardShakeTeam] = useState<TeamId | null>(null);

  const prevIsStarted = useRef(gameState.isStarted);
  const socketRef = useRef<WebSocket | null>(null);
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // 상태 로컬 저장 및 state 반영
  const updateLocalState = useCallback((newState: GameState) => {
    const valid = sanitizeGameState(newState);
    setGameState(valid);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    } catch {
      // ignore
    }
  }, []);

  // 릴레이 WebSocket 메시지 발송 함수
  const sendRelay = useCallback((type: string, payload: unknown) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      try {
        socketRef.current.send(JSON.stringify({ type, payload, senderId: currentUser?.id }));
      } catch (e) {
        console.error('Relay send error', e);
      }
    }
  }, [currentUser]);

  // 실시간 WebSocket 릴레이 연결 (GitHub Pages 및 모든 기기 100% 직결)
  useEffect(() => {
    let ws: WebSocket | null = null;
    let isCleanedUp = false;

    const connectRelay = () => {
      if (isCleanedUp) return;
      try {
        ws = new WebSocket(RELAY_WS_URL);
        socketRef.current = ws;

        ws.onopen = () => {
          // 새로 접속했을 때 방에 현재 상태 요청 (중간 입장자 동기화)
          ws?.send(JSON.stringify({ type: 'REQUEST_LATEST_STATE', senderId: currentUser?.id }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (!data || !data.type) return;

            // 1. 중간 입장자가 상태를 요청했을 때, 기존에 켜져 있던 사람이 상태 답장
            if (data.type === 'REQUEST_LATEST_STATE') {
              if (gameStateRef.current.isStarted && ws?.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'SYNC_FULL_STATE', payload: gameStateRef.current }));
              }
              return;
            }

            // 2. 전체 상태 수신 (중간 입장 완료)
            if (data.type === 'SYNC_FULL_STATE' && data.payload) {
              const valid = sanitizeGameState(data.payload);
              prevIsStarted.current = valid.isStarted;
              updateLocalState(valid);
              return;
            }

            // 3. 게임 시작 브로드캐스트
            if (data.type === 'GAME_STARTED' && data.payload) {
              const valid = sanitizeGameState(data.payload);
              setCountdownText('준비~');
              setTimeout(() => {
                setCountdownText('시작! 🚀');
                setTimeout(() => {
                  setCountdownText(null);
                  setIsShufflingEffect(true);
                  setTimeout(() => setIsShufflingEffect(false), 500);
                }, 400);
              }, 500);
              prevIsStarted.current = true;
              updateLocalState(valid);
              return;
            }

            // 4. 일반 상태 업데이트 (사진 등록, 스킬, 심사 투표)
            if (data.type === 'STATE_UPDATED' && data.payload) {
              updateLocalState(sanitizeGameState(data.payload));
              return;
            }

            // 5. 채팅 메시지 수신
            if (data.type === 'NEW_CHAT' && data.payload) {
              setGameState((prev) => {
                const next = { ...prev, messages: [...(prev.messages || []), data.payload] };
                try {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                } catch {
                  // ignore
                }
                return next;
              });
              return;
            }

            // 6. 게임 리셋
            if (data.type === 'GAME_RESET') {
              const fresh = getInitialGameState();
              prevIsStarted.current = false;
              updateLocalState(fresh);
              return;
            }
          } catch {
            // ignore
          }
        };

        ws.onclose = () => {
          if (!isCleanedUp) setTimeout(connectRelay, 2000);
        };
      } catch {
        if (!isCleanedUp) setTimeout(connectRelay, 2000);
      }
    };

    connectRelay();

    return () => {
      isCleanedUp = true;
      if (ws) ws.close();
    };
  }, [currentUser, updateLocalState]);

  // 2시간 타이머
  useEffect(() => {
    if (!gameState.isStarted || !gameState.startTime || gameState.winnerTeam) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - gameState.startTime!) / 1000);
      const rem = Math.max(0, gameState.durationSeconds - elapsed);
      setRemainingTime(rem);
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.isStarted, gameState.startTime, gameState.durationSeconds, gameState.winnerTeam]);

  // 승리 폭죽
  const hasTriggeredConfetti = useRef(false);
  useEffect(() => {
    if (gameState.winnerTeam && !hasTriggeredConfetti.current) {
      hasTriggeredConfetti.current = true;
      try {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      } catch {
        // ignore
      }
    } else if (!gameState.winnerTeam) {
      hasTriggeredConfetti.current = false;
    }
  }, [gameState.winnerTeam]);

  // 게임 시작 (오직 sam만)
  const startGame = useCallback(() => {
    if (!currentUser?.canStartGame) {
      alert('⚠️ 게임 시작은 주최자(SAM)만 누를 수 있습니다!');
      return;
    }

    setCountdownText('준비~');
    setTimeout(() => {
      setCountdownText('시작! 🚀');
      setTimeout(() => {
        setCountdownText(null);
        setIsShufflingEffect(true);

        const newTeamACells = createShuffledCells(INITIAL_MISSIONS);
        const newTeamBCells = createShuffledCells(INITIAL_MISSIONS);

        const startedState: GameState = {
          ...gameState,
          phase: 'PLAYING',
          isStarted: true,
          startTime: Date.now(),
          winnerTeam: null,
          candidateTeam: null,
          teamA: {
            ...gameState.teamA,
            cells: newTeamACells,
            completedLines: 0,
            skills: { inkAttack: 2, shuffleBoard: 1 },
          },
          teamB: {
            ...gameState.teamB,
            cells: newTeamBCells,
            completedLines: 0,
            skills: { inkAttack: 2, shuffleBoard: 1 },
          },
          messages: [],
        };

        prevIsStarted.current = true;
        updateLocalState(startedState);
        // 전세계 모든 참가자 폰에 동시 시작 브로드캐스트
        sendRelay('GAME_STARTED', startedState);
        setTimeout(() => setIsShufflingEffect(false), 500);
      }, 500);
    }, 600);
  }, [currentUser, gameState, sendRelay, updateLocalState]);

  // 게임 리셋
  const resetGame = useCallback(() => {
    const fresh = getInitialGameState();
    prevIsStarted.current = false;
    updateLocalState(fresh);
    sendRelay('GAME_RESET', {});
  }, [sendRelay, updateLocalState]);

  // 사진 등록
  const completeMission = useCallback((positionIndex: number, photoUrl: string) => {
    if (!currentUser) return;
    const teamKey = currentUser.teamId;
    const currentTeam = gameState[teamKey] || getInitialGameState()[teamKey];
    const targetCell = currentTeam.cells[positionIndex];

    if (isCellInked(targetCell)) {
      alert('🦑 먹물에 덮여 있어 아직 등록할 수 없습니다!');
      return;
    }

    const updatedCells = currentTeam.cells.map((cell, idx) => {
      if (idx === positionIndex) {
        return {
          ...cell,
          isCompleted: true,
          photoUrl,
          completedAt: Date.now(),
          completedBy: currentUser.id,
          reviewStatus: 'PENDING' as const,
          approvedUsers: [],
          rejectedUsers: [],
        };
      }
      return cell;
    });

    const lines = calculateCompletedLines(updatedCells);
    let nextPhase = gameState.phase;
    let candidate = gameState.candidateTeam;

    if (lines >= 3 && gameState.phase === 'PLAYING') {
      nextPhase = 'REVIEWING';
      candidate = teamKey;
      alert(`🎉 [${currentTeam.name} 3줄 달성!] 상대팀의 심사(인정/노인정 투표)가 시작됩니다!`);
    }

    const nextState: GameState = {
      ...gameState,
      phase: nextPhase,
      candidateTeam: candidate,
      [teamKey]: {
        ...currentTeam,
        cells: updatedCells,
        completedLines: lines,
      },
    };

    updateLocalState(nextState);
    sendRelay('STATE_UPDATED', nextState);
  }, [currentUser, gameState, sendRelay, updateLocalState]);

  // 심사 투표
  const voteMission = useCallback((positionIndex: number, isApprove: boolean) => {
    if (!currentUser || !gameState.candidateTeam) return;

    const targetTeamKey = gameState.candidateTeam;
    if (currentUser.teamId === targetTeamKey) {
      alert('⚠️ 본인 팀의 사진에는 투표할 수 없습니다. 상대팀이 심사합니다!');
      return;
    }

    const targetTeam = gameState[targetTeamKey];
    const targetCell = targetTeam?.cells?.[positionIndex];
    if (!targetCell || !targetCell.isCompleted) return;

    const voterId = currentUser.id;
    let approved = targetCell.approvedUsers ? [...targetCell.approvedUsers] : [];
    let rejected = targetCell.rejectedUsers ? [...targetCell.rejectedUsers] : [];

    approved = approved.filter((id) => id !== voterId);
    rejected = rejected.filter((id) => id !== voterId);

    if (isApprove) approved.push(voterId);
    else rejected.push(voterId);

    let reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING';
    let isCompleted: boolean = targetCell.isCompleted;

    if (rejected.length >= 3) {
      reviewStatus = 'REJECTED';
      isCompleted = false;
    } else if (approved.length >= 3) {
      reviewStatus = 'APPROVED';
    }

    const updatedCells = targetTeam.cells.map((c, idx) => {
      if (idx === positionIndex) {
        return {
          ...c,
          approvedUsers: approved,
          rejectedUsers: rejected,
          reviewStatus,
          isCompleted,
        };
      }
      return c;
    });

    const lines = calculateCompletedLines(updatedCells);
    let nextPhase = gameState.phase;
    let winner = gameState.winnerTeam;

    if (lines < 3 && rejected.length >= 3) {
      nextPhase = 'PLAYING';
      alert(`❌ [노인정 과반수!] #${positionIndex + 1}번 미션이 탈락하여 3줄 빙고가 취소되었습니다!`);
    } else {
      const completedCells = updatedCells.filter((c) => c.isCompleted);
      const allApproved = completedCells.every((c) => (c.approvedUsers?.length ?? 0) >= 3);
      if (allApproved && lines >= 3) {
        nextPhase = 'FINISHED';
        winner = targetTeamKey;
      }
    }

    const nextState: GameState = {
      ...gameState,
      phase: nextPhase,
      winnerTeam: winner,
      [targetTeamKey]: {
        ...targetTeam,
        cells: updatedCells,
        completedLines: lines,
      },
    };

    updateLocalState(nextState);
    sendRelay('STATE_UPDATED', nextState);
  }, [currentUser, gameState, sendRelay, updateLocalState]);

  // 먹물 투척
  const useInkAttack = useCallback(() => {
    if (!currentUser?.isLeader) {
      alert('⚠️ 먹물 투척은 각 팀의 팀장만 사용할 수 있습니다!');
      return;
    }

    const attackerKey = currentUser.teamId;
    const targetKey: TeamId = attackerKey === 'teamA' ? 'teamB' : 'teamA';
    const attackerTeam = gameState[attackerKey];
    const targetTeam = gameState[targetKey];

    if (attackerTeam.skills.inkAttack <= 0) {
      alert('먹물 투척을 모두 사용했습니다! (최대 2회)');
      return;
    }

    const availableIndices = targetTeam.cells
      .map((cell, idx) => (!isCellInked(cell) ? idx : -1))
      .filter((idx) => idx !== -1);

    if (availableIndices.length === 0) {
      alert('상대팀에 먹물을 뿌릴 수 있는 칸이 없습니다.');
      return;
    }

    const shuffled = shuffleArray(availableIndices);
    const targetIndices = shuffled.slice(0, 2);
    const inkedUntil = Date.now() + INK_DURATION_MS;

    const updatedTargetCells = targetTeam.cells.map((cell, idx) => {
      if (targetIndices.includes(idx)) {
        return { ...cell, inkedUntil };
      }
      return cell;
    });

    const nextState: GameState = {
      ...gameState,
      [attackerKey]: {
        ...attackerTeam,
        skills: { ...attackerTeam.skills, inkAttack: attackerTeam.skills.inkAttack - 1 },
      },
      [targetKey]: {
        ...targetTeam,
        cells: updatedTargetCells,
      },
    };

    updateLocalState(nextState);
    sendRelay('STATE_UPDATED', nextState);
    alert(`🦑 [먹물 투척!] 상대 ${targetTeam.name}의 칸 2개를 3분간 가렸습니다!`);
  }, [currentUser, gameState, sendRelay, updateLocalState]);

  // 판 흔들기
  const useShuffleOpponentBoard = useCallback(() => {
    if (!currentUser?.isLeader) {
      alert('⚠️ 판 흔들기는 각 팀의 팀장만 사용할 수 있습니다!');
      return;
    }

    const attackerKey = currentUser.teamId;
    const targetKey: TeamId = attackerKey === 'teamA' ? 'teamB' : 'teamA';
    const attackerTeam = gameState[attackerKey];
    const targetTeam = gameState[targetKey];

    if (attackerTeam.skills.shuffleBoard <= 0) {
      alert('판 흔들기를 이미 사용했습니다!');
      return;
    }

    const shuffled = shuffleArray(targetTeam.cells).map((cell, index) => ({
      ...cell,
      positionIndex: index,
    }));

    setBoardShakeTeam(targetKey);
    setTimeout(() => setBoardShakeTeam(null), 700);

    const lines = calculateCompletedLines(shuffled);

    const nextState: GameState = {
      ...gameState,
      [attackerKey]: {
        ...attackerTeam,
        skills: { ...attackerTeam.skills, shuffleBoard: attackerTeam.skills.shuffleBoard - 1 },
      },
      [targetKey]: {
        ...targetTeam,
        cells: shuffled,
        completedLines: lines,
      },
    };

    updateLocalState(nextState);
    sendRelay('STATE_UPDATED', nextState);
    alert(`🌪️ [판 흔들기!] 상대 ${targetTeam.name}의 빙고판 전체를 뒤흔들었습니다!`);
  }, [currentUser, gameState, sendRelay, updateLocalState]);

  // 채팅 전송
  const sendChatMessage = useCallback((text: string) => {
    if (!currentUser || !text.trim()) return;
    const newMsg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      teamId: currentUser.teamId,
      teamName: currentUser.teamName,
      isLeader: currentUser.isLeader,
      text: text.trim(),
      timestamp: Date.now(),
    };

    setGameState((prev) => {
      const next = { ...prev, messages: [...(prev.messages || []), newMsg] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    sendRelay('NEW_CHAT', newMsg);
  }, [currentUser, sendRelay]);

  const userTeamId = currentUser?.teamId ?? 'teamA';
  const base = getInitialGameState();
  const currentTeam = gameState[userTeamId] || base[userTeamId];
  const opponentTeam = gameState[userTeamId === 'teamA' ? 'teamB' : 'teamA'] || base[userTeamId === 'teamA' ? 'teamB' : 'teamA'];

  return {
    gameState,
    currentTeam,
    opponentTeam,
    remainingTime,
    countdownText,
    isShufflingEffect,
    boardShakeTeam,
    startGame,
    resetGame,
    completeMission,
    voteMission,
    useInkAttack,
    useShuffleOpponentBoard,
    sendChatMessage,
  };
}
