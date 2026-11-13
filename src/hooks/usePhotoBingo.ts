import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, TeamId, UserProfile, ChatMessage } from '../types';
import { INITIAL_MISSIONS } from '../data/missions';
import {
  createShuffledCells,
  calculateCompletedLines,
  shuffleArray,
  isCellInked,
} from '../utils/bingo';
import confetti from 'canvas-confetti';

const STORAGE_KEY = 'photo_bingo_game_state_v3';
const INK_DURATION_MS = 180 * 1000;

function getInitialGameState(): GameState {
  return {
    phase: 'WAITING',
    isStarted: false,
    durationSeconds: 7200,
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

export function usePhotoBingo(currentUser: UserProfile | null) {
  // 로컬스토리지에서 복원
  const [gameState, setGameState] = useState<GameState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
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
  const bcRef = useRef<BroadcastChannel | null>(null);

  // 로컬스토리지 자동 저장
  const saveLocalState = useCallback((state: GameState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, []);

  // BroadcastChannel & Storage 이벤트 (동일 기기 / 다른 탭 실시간 동기화)
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('photo_bingo_channel');
      bcRef.current = bc;
      bc.onmessage = (event) => {
        if (event.data?.type === 'SYNC_STATE' && event.data.payload) {
          setGameState(event.data.payload);
        }
      };
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setGameState(JSON.parse(e.newValue));
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      bcRef.current?.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // 웹소켓 연결 (Vite 프록시 /ws 또는 3001)
  useEffect(() => {
    let ws: WebSocket | null = null;
    let isCleanedUp = false;

    const connect = () => {
      if (isCleanedUp) return;
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // 1차: 현재 호스트 /ws 프록시
        const url1 = `${protocol}//${window.location.host}/ws`;
        // 2차: 직결 3001
        const url2 = `${protocol}//${window.location.hostname}:3001`;

        const targetUrl = window.location.port === '3000' ? url1 : url2;
        ws = new WebSocket(targetUrl);
        socketRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'SYNC_STATE' && data.payload) {
              setGameState(data.payload);
              saveLocalState(data.payload);
            } else if (data.type === 'COUNTDOWN_START') {
              setCountdownText('준비~');
              setTimeout(() => {
                setCountdownText('시작! 🚀');
                setTimeout(() => {
                  setCountdownText(null);
                  setIsShufflingEffect(true);
                  setTimeout(() => setIsShufflingEffect(false), 700);
                }, 500);
              }, 700);
            } else if (data.type === 'NEW_CHAT' && data.payload) {
              setGameState((prev) => {
                const next = { ...prev, messages: [...prev.messages, data.payload] };
                saveLocalState(next);
                return next;
              });
            }
          } catch {
            // ignore
          }
        };

        ws.onclose = () => {
          if (!isCleanedUp) setTimeout(connect, 3000);
        };
      } catch {
        // ws 실패 시에도 로컬 상태로 100% 정상 작동
      }
    };

    connect();

    return () => {
      isCleanedUp = true;
      if (ws) ws.close();
    };
  }, [saveLocalState]);

  // 전역 브로드캐스트 (Local + BroadcastChannel + WebSocket 동시 발송)
  const syncStateEverywhere = useCallback((newState: GameState) => {
    setGameState(newState);
    saveLocalState(newState);

    // 1. BroadcastChannel
    try {
      bcRef.current?.postMessage({ type: 'SYNC_STATE', payload: newState });
    } catch {
      // ignore
    }

    // 2. WebSocket
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'UPDATE_STATE', payload: newState }));
    }
  }, [saveLocalState]);

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

  // 게임 시작 (오직 sam만) - 로컬 즉시 반응!
  const startGame = useCallback(() => {
    if (!currentUser?.canStartGame) {
      alert('⚠️ 게임 시작은 주최자(SAM)만 누를 수 있습니다!');
      return;
    }

    // 로컬 즉시 카운트다운 시작
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
          messages: [], // 채팅 리셋
        };

        syncStateEverywhere(startedState);
        setTimeout(() => setIsShufflingEffect(false), 600);

        // 웹소켓에 시작 알림
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'START_GAME', payload: {} }));
        }
      }, 500);
    }, 700);
  }, [currentUser, gameState, syncStateEverywhere]);

  // 게임 리셋
  const resetGame = useCallback(() => {
    const fresh = getInitialGameState();
    syncStateEverywhere(fresh);
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'RESET_GAME', payload: {} }));
    }
  }, [syncStateEverywhere]);

  // 미션 사진 등록
  const completeMission = useCallback((positionIndex: number, photoUrl: string) => {
    if (!currentUser) return;
    const teamKey = currentUser.teamId;
    const currentTeam = gameState[teamKey];
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

    const newCompletedLines = calculateCompletedLines(updatedCells);
    let nextPhase = gameState.phase;
    let candidate = gameState.candidateTeam;

    if (newCompletedLines >= 3 && gameState.phase === 'PLAYING') {
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
        completedLines: newCompletedLines,
      },
    };

    syncStateEverywhere(nextState);
  }, [currentUser, gameState, syncStateEverywhere]);

  // 심사 투표
  const voteMission = useCallback((positionIndex: number, isApprove: boolean) => {
    if (!currentUser || !gameState.candidateTeam) return;

    const targetTeamKey = gameState.candidateTeam;
    if (currentUser.teamId === targetTeamKey) {
      alert('⚠️ 본인 팀의 사진에는 투표할 수 없습니다. 상대팀이 심사합니다!');
      return;
    }

    const targetTeam = gameState[targetTeamKey];
    const targetCell = targetTeam.cells[positionIndex];
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
      isCompleted = false; // 탈락!
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

    const newCompletedLines = calculateCompletedLines(updatedCells);
    let nextPhase = gameState.phase;
    let winner = gameState.winnerTeam;

    if (newCompletedLines < 3 && rejected.length >= 3) {
      nextPhase = 'PLAYING';
      alert(`❌ [노인정 과반수!] #${positionIndex + 1}번 미션이 탈락하여 3줄 빙고가 취소되었습니다!`);
    } else {
      const completedCells = updatedCells.filter((c) => c.isCompleted);
      const allApproved = completedCells.every((c) => (c.approvedUsers?.length ?? 0) >= 3);
      if (allApproved && newCompletedLines >= 3) {
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
        completedLines: newCompletedLines,
      },
    };

    syncStateEverywhere(nextState);
  }, [currentUser, gameState, syncStateEverywhere]);

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

    const targetIndices = shuffleArray(availableIndices).slice(0, 2);
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

    syncStateEverywhere(nextState);
    alert(`🦑 [먹물 투척!] 상대 ${targetTeam.name}의 칸 2개를 3분간 가렸습니다!`);
  }, [currentUser, gameState, syncStateEverywhere]);

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

    const nextState: GameState = {
      ...gameState,
      [attackerKey]: {
        ...attackerTeam,
        skills: { ...attackerTeam.skills, shuffleBoard: attackerTeam.skills.shuffleBoard - 1 },
      },
      [targetKey]: {
        ...targetTeam,
        cells: shuffled,
        completedLines: calculateCompletedLines(shuffled),
      },
    };

    syncStateEverywhere(nextState);
    alert(`🌪️ [판 흔들기!] 상대 ${targetTeam.name}의 빙고판 전체를 뒤흔들었습니다!`);
  }, [currentUser, gameState, syncStateEverywhere]);

  // 채팅 전송 (로컬 즉시 반영 + 브로드캐스트)
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

    const nextState: GameState = {
      ...gameState,
      messages: [...(gameState.messages || []), newMsg],
    };

    syncStateEverywhere(nextState);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'SEND_CHAT', payload: newMsg }));
    }
  }, [currentUser, gameState, syncStateEverywhere]);

  const userTeamId = currentUser?.teamId ?? 'teamA';
  const currentTeam = gameState[userTeamId];
  const opponentTeam = gameState[userTeamId === 'teamA' ? 'teamB' : 'teamA'];

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
