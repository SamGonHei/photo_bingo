import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, TeamId, UserProfile, ChatMessage } from '../types';
import { INITIAL_MISSIONS } from '../data/missions';
import { createShuffledCells, calculateCompletedLines, shuffleArray, isCellInked } from '../utils/bingo';
import confetti from 'canvas-confetti';

const STORAGE_KEY = 'photo_bingo_safe_state_v1';
const INK_DURATION_MS = 180 * 1000;

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

// 로컬 백엔드 API 호출 URL
function getApiEndpoint(path: string): string {
  // 모바일 Wi-Fi 접속 시 3000번 포트의 프록시 활용
  return path;
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
  const bcRef = useRef<BroadcastChannel | null>(null);

  // 로컬스토리지 및 BroadcastChannel 저장
  const persistState = useCallback((state: GameState) => {
    const valid = sanitizeGameState(state);
    setGameState(valid);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
      bcRef.current?.postMessage({ type: 'SYNC_STATE', payload: valid });
    } catch {
      // ignore
    }
  }, []);

  // BroadcastChannel 동기화 (같은 기기 / 브라우저 탭 실시간)
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('photo_bingo_active_channel');
      bcRef.current = bc;
      bc.onmessage = (event) => {
        if (event.data?.type === 'SYNC_STATE' && event.data.payload) {
          setGameState(sanitizeGameState(event.data.payload));
        }
      };
    }
    return () => {
      bcRef.current?.close();
    };
  }, []);

  // 서버 API 동기화 (1.5초 폴링, 404 시에도 에러 없이 조용히 스킵)
  const syncWithServer = useCallback(async () => {
    try {
      const res = await fetch(getApiEndpoint('/api/state'));
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.state) {
          const valid = sanitizeGameState(json.state);
          if (!prevIsStarted.current && valid.isStarted) {
            setCountdownText('준비~');
            setTimeout(() => {
              setCountdownText('시작! 🚀');
              setTimeout(() => {
                setCountdownText(null);
                setIsShufflingEffect(true);
                setTimeout(() => setIsShufflingEffect(false), 500);
              }, 400);
            }, 500);
          }
          prevIsStarted.current = valid.isStarted;
          setGameState(valid);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // 서버 미응답 시에도 화면이 절대 멈추지 않고 로컬 상태 유지
    }
  }, []);

  useEffect(() => {
    syncWithServer();
    const interval = setInterval(syncWithServer, 1500);
    return () => clearInterval(interval);
  }, [syncWithServer]);

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

  // 게임 시작 (오직 sam만) - 로컬 즉시 반영!
  const startGame = useCallback(() => {
    if (!currentUser?.canStartGame) {
      alert('⚠️ 게임 시작은 주최자(SAM)만 누를 수 있습니다!');
      return;
    }

    setCountdownText('준비~');
    setTimeout(() => {
      setCountdownText('시작! 🚀');
      setTimeout(async () => {
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
        persistState(startedState);
        setTimeout(() => setIsShufflingEffect(false), 500);

        // 서버에도 알림
        try {
          await fetch(getApiEndpoint('/api/start'), { method: 'POST' });
        } catch {
          // ignore
        }
      }, 500);
    }, 600);
  }, [currentUser, gameState, persistState]);

  // 게임 리셋
  const resetGame = useCallback(async () => {
    const fresh = getInitialGameState();
    prevIsStarted.current = false;
    persistState(fresh);
    try {
      await fetch(getApiEndpoint('/api/reset'), { method: 'POST' });
    } catch {
      // ignore
    }
  }, [persistState]);

  // 사진 등록
  const completeMission = useCallback(async (positionIndex: number, photoUrl: string) => {
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

    persistState(nextState);

    try {
      await fetch(getApiEndpoint('/api/cell'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: teamKey,
          positionIndex,
          photoUrl,
          userId: currentUser.id,
        }),
      });
    } catch {
      // ignore
    }
  }, [currentUser, gameState, persistState]);

  // 심사 투표
  const voteMission = useCallback(async (positionIndex: number, isApprove: boolean) => {
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

    persistState(nextState);

    try {
      await fetch(getApiEndpoint('/api/vote'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionIndex, isApprove, voterId }),
      });
    } catch {
      // ignore
    }
  }, [currentUser, gameState, persistState]);

  // 먹물 투척
  const useInkAttack = useCallback(async () => {
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

    persistState(nextState);
    alert(`🦑 [먹물 투척!] 상대 ${targetTeam.name}의 칸 2개를 3분간 가렸습니다!`);

    try {
      await fetch(getApiEndpoint('/api/skill/ink'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attackerTeamId: attackerKey }),
      });
    } catch {
      // ignore
    }
  }, [currentUser, gameState, persistState]);

  // 판 흔들기
  const useShuffleOpponentBoard = useCallback(async () => {
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

    persistState(nextState);
    alert(`🌪️ [판 흔들기!] 상대 ${targetTeam.name}의 빙고판 전체를 뒤흔들었습니다!`);

    try {
      await fetch(getApiEndpoint('/api/skill/shuffle'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attackerTeamId: attackerKey }),
      });
    } catch {
      // ignore
    }
  }, [currentUser, gameState, persistState]);

  // 채팅 전송
  const sendChatMessage = useCallback(async (text: string) => {
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

    persistState(nextState);

    try {
      await fetch(getApiEndpoint('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMsg),
      });
    } catch {
      // ignore
    }
  }, [currentUser, gameState, persistState]);

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
