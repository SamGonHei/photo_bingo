import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, TeamId, UserProfile, ChatMessage } from '../types';
import { INITIAL_MISSIONS } from '../data/missions';
import { createShuffledCells } from '../utils/bingo';
import confetti from 'canvas-confetti';

const STORAGE_KEY = 'photo_bingo_cloud_v1';
// 글로벌 클라우드 실시간 REST 엔드포인트 (GitHub Pages에서도 404 없이 100% 작동)
const CLOUD_API_URL = 'https://api.restful-api.dev/objects/ff808181a09d98f701a1d40c2f521eef';

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
  const isUpdatingRef = useRef(false);

  // 클라우드에서 최신 상태 읽어오기 (1초 폴링)
  const fetchCloudState = useCallback(async () => {
    if (isUpdatingRef.current) return;
    try {
      const res = await fetch(CLOUD_API_URL);
      if (res.ok) {
        const json = await res.json();
        const serverState: GameState = json.data;

        if (serverState && typeof serverState.isStarted === 'boolean') {
          // 서버에서 게임 시작 감지 시 카운트다운 연출
          if (!prevIsStarted.current && serverState.isStarted) {
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
          prevIsStarted.current = serverState.isStarted;

          setGameState(serverState);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(serverState));
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // 오프라인 대비 로컬 유지
    }
  }, []);

  // 1초 주기로 자동 동기화
  useEffect(() => {
    fetchCloudState();
    const interval = setInterval(fetchCloudState, 1000);
    return () => clearInterval(interval);
  }, [fetchCloudState]);

  // 클라우드에 상태 쓰기 (PUT)
  const saveToCloud = useCallback(async (newState: GameState) => {
    setGameState(newState);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch {
      // ignore
    }

    isUpdatingRef.current = true;
    try {
      await fetch(CLOUD_API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'photo_bingo',
          data: newState,
        }),
      });
    } catch (e) {
      console.error('Cloud save error', e);
    } finally {
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 500);
    }
  }, []);

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
        await saveToCloud(startedState);
        setTimeout(() => setIsShufflingEffect(false), 500);
      }, 500);
    }, 600);
  }, [currentUser, gameState, saveToCloud]);

  // 게임 리셋
  const resetGame = useCallback(async () => {
    const fresh = getInitialGameState();
    prevIsStarted.current = false;
    await saveToCloud(fresh);
  }, [saveToCloud]);

  // 사진 등록
  const completeMission = useCallback(async (positionIndex: number, photoUrl: string) => {
    if (!currentUser) return;
    const teamKey = currentUser.teamId;
    const currentTeam = gameState[teamKey];
    const targetCell = currentTeam.cells[positionIndex];

    if (targetCell.inkedUntil && targetCell.inkedUntil > Date.now()) {
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

    // 라인 수 계산
    const BINGO_LINES = [
      [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15],
      [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15],
      [0, 5, 10, 15], [3, 6, 9, 12],
    ];
    let lines = 0;
    for (const line of BINGO_LINES) {
      if (line.every((i) => updatedCells[i]?.isCompleted)) lines++;
    }

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

    await saveToCloud(nextState);
  }, [currentUser, gameState, saveToCloud]);

  // 심사 투표
  const voteMission = useCallback(async (positionIndex: number, isApprove: boolean) => {
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

    const BINGO_LINES = [
      [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15],
      [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15],
      [0, 5, 10, 15], [3, 6, 9, 12],
    ];
    let lines = 0;
    for (const line of BINGO_LINES) {
      if (line.every((i) => updatedCells[i]?.isCompleted)) lines++;
    }

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

    await saveToCloud(nextState);
  }, [currentUser, gameState, saveToCloud]);

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
      .map((cell, idx) => (!cell.inkedUntil || cell.inkedUntil <= Date.now() ? idx : -1))
      .filter((idx) => idx !== -1);

    if (availableIndices.length === 0) {
      alert('상대팀에 먹물을 뿌릴 수 있는 칸이 없습니다.');
      return;
    }

    // 셔플 후 2개 선택
    const shuffled = [...availableIndices].sort(() => Math.random() - 0.5);
    const targetIndices = shuffled.slice(0, 2);
    const inkedUntil = Date.now() + 180 * 1000;

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

    await saveToCloud(nextState);
    alert(`🦑 [먹물 투척!] 상대 ${targetTeam.name}의 칸 2개를 3분간 가렸습니다!`);
  }, [currentUser, gameState, saveToCloud]);

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

    const shuffled = [...targetTeam.cells]
      .sort(() => Math.random() - 0.5)
      .map((cell, index) => ({
        ...cell,
        positionIndex: index,
      }));

    setBoardShakeTeam(targetKey);
    setTimeout(() => setBoardShakeTeam(null), 700);

    const BINGO_LINES = [
      [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15],
      [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15],
      [0, 5, 10, 15], [3, 6, 9, 12],
    ];
    let lines = 0;
    for (const line of BINGO_LINES) {
      if (line.every((i) => shuffled[i]?.isCompleted)) lines++;
    }

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

    await saveToCloud(nextState);
    alert(`🌪️ [판 흔들기!] 상대 ${targetTeam.name}의 빙고판 전체를 뒤흔들었습니다!`);
  }, [currentUser, gameState, saveToCloud]);

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

    await saveToCloud(nextState);
  }, [currentUser, gameState, saveToCloud]);

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
