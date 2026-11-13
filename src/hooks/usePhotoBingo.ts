import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, TeamId, UserProfile, ChatMessage } from '../types';
import { INITIAL_MISSIONS } from '../data/missions';
import { createShuffledCells, calculateCompletedLines, shuffleArray, isCellInked } from '../utils/bingo';
import confetti from 'canvas-confetti';

const STORAGE_KEY = 'photo_bingo_cloud_relay_v2';
const INK_DURATION_MS = 180 * 1000;
const REVIEW_TIMEOUT_MS = 10 * 60 * 1000; // 10분

// 전세계 어디서나 (GitHub Pages, 모바일 사파리/크롬 등) 100% 작동하는 초고속 실시간 Pub/Sub 릴레이
const NTFY_TOPIC = 'photo_bingo_switching_day_2026_room';
const NTFY_PUB_URL = `https://ntfy.sh/${NTFY_TOPIC}`;
const NTFY_WS_URL = `wss://ntfy.sh/${NTFY_TOPIC}/ws`;
const NTFY_POLL_URL = `https://ntfy.sh/${NTFY_TOPIC}/json?poll=1`;

export function getInitialGameState(): GameState {
  return {
    phase: 'WAITING',
    isStarted: false,
    durationSeconds: 7200,
    startTime: null,
    winnerTeam: null,
    candidateTeam: null,
    reviewStartTime: null,
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
    reviewStartTime: r.reviewStartTime ?? null,
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

  // 릴레이 HTTP POST 발송 함수
  const sendRelay = useCallback(async (type: string, payload: unknown) => {
    try {
      const body = JSON.stringify({
        type,
        payload,
        senderId: currentUser?.id,
        timestamp: Date.now(),
      });

      await fetch(NTFY_PUB_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    } catch (e) {
      console.warn('Relay send failed, retrying in background', e);
    }
  }, [currentUser]);

  // 수신된 릴레이 페이로드 처리 핸들러
  const handleIncomingPayload = useCallback((data: any) => {
    if (!data || !data.type) return;

    // 1. 상태 동기화
    if (data.type === 'SYNC_FULL_STATE' || data.type === 'STATE_UPDATED') {
      if (data.payload) {
        updateLocalState(sanitizeGameState(data.payload));
      }
      return;
    }

    // 2. 게임 시작 브로드캐스트
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
      updateLocalState(valid);
      return;
    }

    // 3. 실시간 채팅 메시지
    if (data.type === 'NEW_CHAT' && data.payload) {
      setGameState((prev) => {
        const currentMessages = prev.messages || [];
        if (currentMessages.some((m) => m.id === data.payload.id)) return prev;
        const next = { ...prev, messages: [...currentMessages, data.payload] };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
      return;
    }

    // 4. 게임 리셋
    if (data.type === 'GAME_RESET') {
      const fresh = getInitialGameState();
      updateLocalState(fresh);
      return;
    }
  }, [updateLocalState]);

  // ntfy 실시간 WebSocket 연결
  useEffect(() => {
    let ws: WebSocket | null = null;
    let isCleanedUp = false;

    const connectWebSocket = () => {
      if (isCleanedUp) return;
      try {
        ws = new WebSocket(NTFY_WS_URL);
        socketRef.current = ws;

        ws.onopen = () => {
          console.log('✅ Realtime cloud sync connected');
        };

        ws.onmessage = async (event) => {
          try {
            const raw = JSON.parse(event.data);
            if (raw.event !== 'message') return;

            // 본문이 파일로 첨부된 경우 (용량 4KB 초과 시 ntfy 자동 파일 처리)
            if (raw.attachment?.url) {
              const res = await fetch(raw.attachment.url);
              const data = await res.json();
              handleIncomingPayload(data);
            } else if (raw.message) {
              const data = JSON.parse(raw.message);
              handleIncomingPayload(data);
            }
          } catch {
            // ignore parse errors
          }
        };

        ws.onclose = () => {
          if (!isCleanedUp) setTimeout(connectWebSocket, 2000);
        };
        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        if (!isCleanedUp) setTimeout(connectWebSocket, 2000);
      }
    };

    connectWebSocket();

    // 초기 진입 시 및 주기적 4초 최신 상태 폴링 (중간 입장자 & 모바일 절전모드 완벽 동기화)
    const pollLatest = async () => {
      try {
        const res = await fetch(NTFY_POLL_URL);
        if (!res.ok) return;
        const text = await res.text();
        const lines = text.trim().split('\n').filter(Boolean);
        if (lines.length === 0) return;

        // 가장 최신의 유효한 메시지들 역순 검색
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const obj = JSON.parse(lines[i]);
            if (obj.event === 'message') {
              if (obj.attachment?.url) {
                const subRes = await fetch(obj.attachment.url);
                const data = await subRes.json();
                handleIncomingPayload(data);
                break;
              } else if (obj.message) {
                const data = JSON.parse(obj.message);
                handleIncomingPayload(data);
                break;
              }
            }
          } catch {
            // continue
          }
        }
      } catch {
        // ignore
      }
    };

    pollLatest();
    const pollInterval = setInterval(pollLatest, 4000);

    return () => {
      isCleanedUp = true;
      clearInterval(pollInterval);
      if (ws) ws.close();
    };
  }, [handleIncomingPayload]);

  // 2시간 게임 타이머
  useEffect(() => {
    if (!gameState.isStarted || !gameState.startTime || gameState.winnerTeam) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - gameState.startTime!) / 1000);
      const rem = Math.max(0, gameState.durationSeconds - elapsed);
      setRemainingTime(rem);
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.isStarted, gameState.startTime, gameState.durationSeconds, gameState.winnerTeam]);

  // 10분 심사 자동 승리 타이머
  useEffect(() => {
    if (gameState.phase !== 'REVIEWING' || !gameState.reviewStartTime || gameState.winnerTeam) return;

    const interval = setInterval(() => {
      const elapsedMs = Date.now() - gameState.reviewStartTime!;
      if (elapsedMs >= REVIEW_TIMEOUT_MS) {
        // 10분 경과! 상대팀 미심사로 자동 승리 확정
        const winner = gameState.candidateTeam;
        if (winner) {
          const autoWinState: GameState = {
            ...gameStateRef.current,
            phase: 'FINISHED',
            winnerTeam: winner,
          };
          updateLocalState(autoWinState);
          sendRelay('STATE_UPDATED', autoWinState);
          alert(`⏰ [10분 시간 초과!] 상대팀이 제한시간(10분) 내에 심사를 완료하지 않아, ${gameStateRef.current[winner].name}의 최종 승리로 확정되었습니다! 🏆`);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.phase, gameState.reviewStartTime, gameState.winnerTeam, gameState.candidateTeam, sendRelay, updateLocalState]);

  // 승리 축하 폭죽
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
          reviewStartTime: null,
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

        updateLocalState(startedState);
        sendRelay('GAME_STARTED', startedState);
        setTimeout(() => setIsShufflingEffect(false), 500);
      }, 500);
    }, 600);
  }, [currentUser, gameState, sendRelay, updateLocalState]);

  // 게임 리셋
  const resetGame = useCallback(() => {
    const fresh = getInitialGameState();
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
    let reviewStartTime = gameState.reviewStartTime;

    if (lines >= 3 && gameState.phase === 'PLAYING') {
      nextPhase = 'REVIEWING';
      candidate = teamKey;
      reviewStartTime = Date.now();
      alert(`🎉 [${currentTeam.name} 3줄 달성!] 상대팀의 심사(인정/노인정 투표)가 시작됩니다! (제한시간 10분)`);
    }

    const nextState: GameState = {
      ...gameState,
      phase: nextPhase,
      candidateTeam: candidate,
      reviewStartTime,
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
