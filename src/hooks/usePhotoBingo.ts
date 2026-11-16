import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, TeamId, UserProfile, ChatMessage } from '../types';
import { INITIAL_MISSIONS } from '../data/missions';
import { createShuffledCells, calculateCompletedLines, shuffleArray, isCellInked } from '../utils/bingo';
import { db, ref, onValue, set, isFirebaseConfigured } from '../utils/firebase';
import confetti from 'canvas-confetti';

const STORAGE_KEY = 'photo_bingo_cloud_relay_v2';
const DB_STATE_PATH = 'photo_bingo/state';
const INK_DURATION_MS = 180 * 1000;
const REVIEW_TIMEOUT_MS = 10 * 60 * 1000; // 10분

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

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // 게임 시작 연출 1회만 실행되도록 보장하는 ref
  const hasPlayedStartAnimRef = useRef(false);

  // 로컬 및 저장소 상태 갱신
  const updateLocalState = useCallback((newState: GameState) => {
    const valid = sanitizeGameState(newState);
    setGameState(valid);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    } catch {
      // ignore
    }
  }, []);

  // Firebase 실시간 상태 브로드캐스트
  const broadcastState = useCallback((newState: GameState) => {
    updateLocalState(newState);

    if (isFirebaseConfigured && db) {
      try {
        const stateRef = ref(db, DB_STATE_PATH);
        set(stateRef, newState).catch((err) => {
          console.error('Firebase state sync failed:', err);
        });
      } catch (err) {
        console.error('Firebase set error:', err);
      }
    }
  }, [updateLocalState]);

  // Firebase Realtime Database 실시간 구독 (0.1초 동기화)
  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      console.warn('⚠️ Firebase is not configured. Running in local fallback mode.');
      return;
    }

    const stateRef = ref(db, DB_STATE_PATH);
    const unsubscribe = onValue(
      stateRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.val();
          const valid = sanitizeGameState(val);

          // 게임 시작 연출 감지 (이전 상태가 WAITING이었고 새로 들어온 상태가 PLAYING일 때 딱 1회만 실행)
          if (valid.phase === 'PLAYING') {
            if (!hasPlayedStartAnimRef.current && gameStateRef.current.phase === 'WAITING') {
              hasPlayedStartAnimRef.current = true;
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
          } else if (valid.phase === 'WAITING') {
            hasPlayedStartAnimRef.current = false;
            setCountdownText(null);
            setIsShufflingEffect(false);
          }

          updateLocalState(valid);
        } else {
          // 데이터베이스에 상태가 없는 경우 초기 상태 업로드
          const initial = getInitialGameState();
          set(stateRef, initial).catch((err) => console.error('Initial state upload error:', err));
        }
      },
      (error) => {
        console.error('Firebase Realtime DB read error:', error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [updateLocalState]);

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
        const winner = gameState.candidateTeam;
        if (winner) {
          const autoWinState: GameState = {
            ...gameStateRef.current,
            phase: 'FINISHED',
            winnerTeam: winner,
          };
          broadcastState(autoWinState);
          alert(`⏰ [10분 시간 초과!] 상대팀이 제한시간(10분) 내에 심사를 완료하지 않아, ${gameStateRef.current[winner].name}의 최종 승리로 확정되었습니다! 🏆`);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.phase, gameState.reviewStartTime, gameState.winnerTeam, gameState.candidateTeam, broadcastState]);

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

    // 이미 시작되었거나 진행 중인 경우 중복 클릭 방지
    if (gameStateRef.current.phase !== 'WAITING') {
      return;
    }

    const newTeamACells = createShuffledCells(INITIAL_MISSIONS);
    const newTeamBCells = createShuffledCells(INITIAL_MISSIONS);

    const startedState: GameState = {
      ...gameStateRef.current,
      phase: 'PLAYING',
      isStarted: true,
      startTime: Date.now(),
      winnerTeam: null,
      candidateTeam: null,
      reviewStartTime: null,
      teamA: {
        ...gameStateRef.current.teamA,
        cells: newTeamACells,
        completedLines: 0,
        skills: { inkAttack: 2, shuffleBoard: 1 },
      },
      teamB: {
        ...gameStateRef.current.teamB,
        cells: newTeamBCells,
        completedLines: 0,
        skills: { inkAttack: 2, shuffleBoard: 1 },
      },
      messages: [],
    };

    // 즉시 전체 참가자에게 상태 브로드캐스트 (모든 클라이언트가 동시에 연출 및 게임 시작)
    broadcastState(startedState);
  }, [currentUser, broadcastState]);

  // 게임 리셋
  const resetGame = useCallback(() => {
    const fresh = getInitialGameState();
    broadcastState(fresh);
  }, [broadcastState]);

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

    broadcastState(nextState);
  }, [currentUser, gameState, broadcastState]);

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

    broadcastState(nextState);
  }, [currentUser, gameState, broadcastState]);

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

    broadcastState(nextState);
    alert(`🦑 [먹물 투척!] 상대 ${targetTeam.name}의 칸 2개를 3분간 가렸습니다!`);
  }, [currentUser, gameState, broadcastState]);

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

    broadcastState(nextState);
    alert(`🌪️ [판 흔들기!] 상대 ${targetTeam.name}의 빙고판 전체를 뒤흔들었습니다!`);
  }, [currentUser, gameState, broadcastState]);

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

    const nextState: GameState = {
      ...gameStateRef.current,
      messages: [...(gameStateRef.current.messages || []), newMsg],
    };

    broadcastState(nextState);
  }, [currentUser, broadcastState]);

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
    isFirebaseConfigured,
  };
}
