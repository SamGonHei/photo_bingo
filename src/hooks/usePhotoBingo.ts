import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, TeamId, UserProfile, ChatMessage } from '../types';
import { INITIAL_MISSIONS } from '../data/missions';
import { createShuffledCells } from '../utils/bingo';
import confetti from 'canvas-confetti';

const STORAGE_KEY = 'photo_bingo_game_state_v4';

function getInitialGameState(): GameState {
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

// API 기본 URL 결정
function getApiUrl(path: string): string {
  // 모바일/PC 동일 origin 프록시 우선, 실패 시 3001 직결
  return `${path}`;
}

export function usePhotoBingo(currentUser: UserProfile | null) {
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

  const prevIsStarted = useRef(gameState.isStarted);

  // 1초 실시간 폴링: 서버의 상태를 끊김 없이 동기화
  const fetchServerState = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl('/api/state'));
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.state) {
          // 서버에서 게임 시작을 감지했을 때 카운트다운 연출
          if (!prevIsStarted.current && data.state.isStarted) {
            setCountdownText('준비~');
            setTimeout(() => {
              setCountdownText('시작! 🚀');
              setTimeout(() => {
                setCountdownText(null);
                setIsShufflingEffect(true);
                setTimeout(() => setIsShufflingEffect(false), 600);
              }, 500);
            }, 600);
          }
          prevIsStarted.current = data.state.isStarted;

          setGameState(data.state);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.state));
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // 오프라인이거나 서버 재부팅 시 기존 로컬 상태 유지
    }
  }, []);

  // 1초 주기로 자동 동기화 & 최초 마운트 시 즉각 호출
  useEffect(() => {
    fetchServerState();
    const interval = setInterval(fetchServerState, 1000);
    return () => clearInterval(interval);
  }, [fetchServerState]);

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
  const startGame = useCallback(async () => {
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

        try {
          const res = await fetch(getApiUrl('/api/start'), { method: 'POST' });
          if (res.ok) {
            const data = await res.json();
            if (data.state) {
              setGameState(data.state);
              prevIsStarted.current = true;
            }
          }
        } catch (e) {
          console.error(e);
        }
        setTimeout(() => setIsShufflingEffect(false), 500);
      }, 500);
    }, 600);
  }, [currentUser]);

  // 게임 리셋
  const resetGame = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl('/api/reset'), { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          setGameState(data.state);
          prevIsStarted.current = false;
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // 사진 등록
  const completeMission = useCallback(async (positionIndex: number, photoUrl: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch(getApiUrl('/api/cell'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: currentUser.teamId,
          positionIndex,
          photoUrl,
          userId: currentUser.id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) setGameState(data.state);
      }
    } catch (e) {
      console.error(e);
    }
  }, [currentUser]);

  // 심사 투표
  const voteMission = useCallback(async (positionIndex: number, isApprove: boolean) => {
    if (!currentUser) return;
    try {
      const res = await fetch(getApiUrl('/api/vote'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionIndex,
          isApprove,
          voterId: currentUser.id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) setGameState(data.state);
      }
    } catch (e) {
      console.error(e);
    }
  }, [currentUser]);

  // 먹물 투척
  const useInkAttack = useCallback(async () => {
    if (!currentUser?.isLeader) {
      alert('⚠️ 먹물 투척은 각 팀의 팀장만 사용할 수 있습니다!');
      return;
    }
    try {
      const res = await fetch(getApiUrl('/api/skill/ink'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attackerTeamId: currentUser.teamId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) setGameState(data.state);
        alert('🦑 [먹물 투척!] 상대팀 칸 2개를 3분간 가렸습니다!');
      }
    } catch (e) {
      console.error(e);
    }
  }, [currentUser]);

  // 판 흔들기
  const useShuffleOpponentBoard = useCallback(async () => {
    if (!currentUser?.isLeader) {
      alert('⚠️ 판 흔들기는 각 팀의 팀장만 사용할 수 있습니다!');
      return;
    }
    const targetKey: TeamId = currentUser.teamId === 'teamA' ? 'teamB' : 'teamA';
    setBoardShakeTeam(targetKey);
    setTimeout(() => setBoardShakeTeam(null), 700);

    try {
      const res = await fetch(getApiUrl('/api/skill/shuffle'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attackerTeamId: currentUser.teamId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) setGameState(data.state);
        alert('🌪️ [판 흔들기!] 상대팀의 빙고판 전체를 뒤흔들었습니다!');
      }
    } catch (e) {
      console.error(e);
    }
  }, [currentUser]);

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

    // 로컬 우선 즉시 반영
    setGameState((prev) => ({
      ...prev,
      messages: [...(prev.messages || []), newMsg],
    }));

    try {
      await fetch(getApiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMsg),
      });
    } catch (e) {
      console.error(e);
    }
  }, [currentUser]);

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
