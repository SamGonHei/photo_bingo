import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, TeamId, UserProfile } from '../types';
import { INITIAL_MISSIONS } from '../data/missions';
import {
  createShuffledCells,
  calculateCompletedLines,
  shuffleArray,
  isCellInked,
} from '../utils/bingo';
import confetti from 'canvas-confetti';

const STORAGE_KEY = 'photo_bingo_game_state_v2';
const GAME_DURATION_SECONDS = 7200; // 2시간
const INK_DURATION_MS = 180 * 1000; // 3분

function getInitialGameState(): GameState {
  const teamACells = createShuffledCells(INITIAL_MISSIONS);
  const teamBCells = createShuffledCells(INITIAL_MISSIONS);

  return {
    isStarted: false,
    durationSeconds: GAME_DURATION_SECONDS,
    winnerTeam: null,
    teamA: {
      id: 'teamA',
      name: 'jackie팀',
      leaderId: 'jackie',
      badge: '👑',
      members: ['jackie', 'hannah', 'nicole', 'sam', 'tori'],
      themeColor: '#4F46E5', // 인디고/바이올렛 톤
      cells: teamACells,
      completedLines: 0,
      skills: {
        inkAttack: 2,
        shuffleBoard: 1,
      },
    },
    teamB: {
      id: 'teamB',
      name: 'carol팀',
      leaderId: 'carol',
      badge: '🎀',
      members: ['carol', 'raphaela', 'popo', 'lumi', 'jane'],
      themeColor: '#EC4899', // 핑크/로즈 톤
      cells: teamBCells,
      completedLines: 0,
      skills: {
        inkAttack: 2,
        shuffleBoard: 1,
      },
    },
  };
}

export function usePhotoBingo(currentUser: UserProfile | null) {
  const [gameState, setGameState] = useState<GameState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return getInitialGameState();
  });

  const [remainingTime, setRemainingTime] = useState<number>(GAME_DURATION_SECONDS);
  const [countdownText, setCountdownText] = useState<string | null>(null);
  const [isShufflingEffect, setIsShufflingEffect] = useState(false);
  const [boardShakeTeam, setBoardShakeTeam] = useState<TeamId | null>(null);

  // 로컬스토리지 동기화
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
    } catch (e) {
      console.error('Failed to save gameState', e);
    }
  }, [gameState]);

  // 2시간 타이머
  useEffect(() => {
    if (!gameState.isStarted || !gameState.startTime || gameState.winnerTeam) {
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - gameState.startTime!) / 1000);
      const remaining = Math.max(0, gameState.durationSeconds - elapsed);
      setRemainingTime(remaining);

      if (remaining <= 0 && !gameState.winnerTeam) {
        const teamALines = calculateCompletedLines(gameState.teamA.cells);
        const teamBLines = calculateCompletedLines(gameState.teamB.cells);
        let winner: TeamId | null = null;
        if (teamALines > teamBLines) winner = 'teamA';
        else if (teamBLines > teamALines) winner = 'teamB';

        setGameState((prev) => ({
          ...prev,
          winnerTeam: winner,
        }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.isStarted, gameState.startTime, gameState.durationSeconds, gameState.winnerTeam, gameState.teamA.cells, gameState.teamB.cells]);

  // 승리 폭죽 연출
  const hasTriggeredConfetti = useRef(false);
  useEffect(() => {
    if (gameState.winnerTeam && !hasTriggeredConfetti.current) {
      hasTriggeredConfetti.current = true;
      try {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
        setTimeout(() => {
          confetti({ particleCount: 100, angle: 60, spread: 60, origin: { x: 0 } });
          confetti({ particleCount: 100, angle: 120, spread: 60, origin: { x: 1 } });
        }, 300);
      } catch {
        // ignore
      }
    } else if (!gameState.winnerTeam) {
      hasTriggeredConfetti.current = false;
    }
  }, [gameState.winnerTeam]);

  // 게임 시작: '준비~ 시작!' 카운트다운 후 슈루루루 셔플 모션 & 2시간 개시
  const startGame = useCallback(() => {
    if (!currentUser) return;
    if (!currentUser.canStartGame) {
      alert('⚠️ 게임 시작은 주최자(SAM)만 누를 수 있습니다!');
      return;
    }

    // 1단계: "준비~"
    setCountdownText('준비~');
    setTimeout(() => {
      // 2단계: "시작! 🚀"
      setCountdownText('시작! 🚀');

      setTimeout(() => {
        setCountdownText(null);
        setIsShufflingEffect(true);

        // 3단계: 빙고판 슈루루루루 돌아가는 모션 (10회 고속 셔플)
        let shuffleCount = 0;
        const shuffleInterval = setInterval(() => {
          setGameState((prev) => ({
            ...prev,
            teamA: { ...prev.teamA, cells: createShuffledCells(INITIAL_MISSIONS) },
            teamB: { ...prev.teamB, cells: createShuffledCells(INITIAL_MISSIONS) },
          }));
          shuffleCount++;
          if (shuffleCount >= 10) {
            clearInterval(shuffleInterval);
            setIsShufflingEffect(false);

            // 4단계: 챡! 최종 랜덤 배치 확정 및 2시간 타이머 시작
            const finalTeamACells = createShuffledCells(INITIAL_MISSIONS);
            const finalTeamBCells = createShuffledCells(INITIAL_MISSIONS);

            setGameState((prev) => ({
              ...prev,
              isStarted: true,
              startTime: Date.now(),
              winnerTeam: null,
              teamA: {
                ...prev.teamA,
                cells: finalTeamACells,
                completedLines: 0,
                skills: { inkAttack: 2, shuffleBoard: 1 },
              },
              teamB: {
                ...prev.teamB,
                cells: finalTeamBCells,
                completedLines: 0,
                skills: { inkAttack: 2, shuffleBoard: 1 },
              },
            }));
          }
        }, 100);
      }, 700);
    }, 900);
  }, [currentUser]);

  // 게임 초기화
  const resetGame = useCallback(() => {
    const initialState = getInitialGameState();
    setGameState(initialState);
    setRemainingTime(GAME_DURATION_SECONDS);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // 미션 사진 등록 (팀원 전원 가능)
  const completeMission = useCallback((positionIndex: number, photoUrl: string) => {
    if (!currentUser) return;
    const teamKey = currentUser.teamId;

    setGameState((prev) => {
      if (!prev.isStarted || prev.winnerTeam) return prev;

      const currentTeam = prev[teamKey];
      const targetCell = currentTeam.cells[positionIndex];

      if (isCellInked(targetCell)) {
        alert('🦑 먹물에 뒤덮여 있어 현재 등록할 수 없습니다! (남은 시간을 확인해주세요)');
        return prev;
      }

      const updatedCells = currentTeam.cells.map((cell, idx) => {
        if (idx === positionIndex) {
          return {
            ...cell,
            isCompleted: true,
            photoUrl,
            completedAt: Date.now(),
            completedBy: currentUser.id,
          };
        }
        return cell;
      });

      const newCompletedLines = calculateCompletedLines(updatedCells);
      let winner: TeamId | null = prev.winnerTeam ?? null;

      if (newCompletedLines >= 3 && !winner) {
        winner = teamKey;
      }

      return {
        ...prev,
        winnerTeam: winner,
        [teamKey]: {
          ...currentTeam,
          cells: updatedCells,
          completedLines: newCompletedLines,
        },
      };
    });
  }, [currentUser]);

  // 스킬 1: 먹물 투척 (오직 팀장 jackie, carol만 가능)
  const useInkAttack = useCallback(() => {
    if (!currentUser) return;
    if (!currentUser.isLeader) {
      alert('⚠️ 먹물 투척은 각 팀의 팀장만 사용할 수 있습니다!');
      return;
    }

    const attackerKey = currentUser.teamId;
    const targetKey: TeamId = attackerKey === 'teamA' ? 'teamB' : 'teamA';

    setGameState((prev) => {
      if (!prev.isStarted || prev.winnerTeam) return prev;

      const attackerTeam = prev[attackerKey];
      const targetTeam = prev[targetKey];

      if (attackerTeam.skills.inkAttack <= 0) {
        alert('먹물 투척을 모두 사용했습니다! (최대 2회)');
        return prev;
      }

      const availableIndices = targetTeam.cells
        .map((cell, idx) => (!isCellInked(cell) ? idx : -1))
        .filter((idx) => idx !== -1);

      if (availableIndices.length === 0) {
        alert('상대팀에 먹물을 뿌릴 수 있는 칸이 없습니다.');
        return prev;
      }

      const shuffledIndices = shuffleArray(availableIndices);
      const targetIndices = shuffledIndices.slice(0, 2);
      const inkedUntil = Date.now() + INK_DURATION_MS;

      const updatedTargetCells = targetTeam.cells.map((cell, idx) => {
        if (targetIndices.includes(idx)) {
          return { ...cell, inkedUntil };
        }
        return cell;
      });

      alert(`🦑 [먹물 투척 성공!] 상대 ${targetTeam.name}의 칸 2개를 3분 동안 먹물로 가렸습니다!`);

      return {
        ...prev,
        [attackerKey]: {
          ...attackerTeam,
          skills: {
            ...attackerTeam.skills,
            inkAttack: attackerTeam.skills.inkAttack - 1,
          },
        },
        [targetKey]: {
          ...targetTeam,
          cells: updatedTargetCells,
        },
      };
    });
  }, [currentUser]);

  // 스킬 2: 판 흔들기 (오직 팀장 jackie, carol만 가능)
  const useShuffleOpponentBoard = useCallback(() => {
    if (!currentUser) return;
    if (!currentUser.isLeader) {
      alert('⚠️ 판 흔들기는 각 팀의 팀장만 사용할 수 있습니다!');
      return;
    }

    const attackerKey = currentUser.teamId;
    const targetKey: TeamId = attackerKey === 'teamA' ? 'teamB' : 'teamA';

    setGameState((prev) => {
      if (!prev.isStarted || prev.winnerTeam) return prev;

      const attackerTeam = prev[attackerKey];
      const targetTeam = prev[targetKey];

      if (attackerTeam.skills.shuffleBoard <= 0) {
        alert('판 흔들기를 이미 사용했습니다! (최대 1회)');
        return prev;
      }

      const shuffled = shuffleArray(targetTeam.cells).map((cell, index) => ({
        ...cell,
        positionIndex: index,
      }));

      const newCompletedLines = calculateCompletedLines(shuffled);

      setBoardShakeTeam(targetKey);
      setTimeout(() => setBoardShakeTeam(null), 800);

      alert(`🌪️ [판 흔들기 발동!] 상대 ${targetTeam.name}의 빙고판 전체를 무작위로 흔들어 섞었습니다!`);

      return {
        ...prev,
        [attackerKey]: {
          ...attackerTeam,
          skills: {
            ...attackerTeam.skills,
            shuffleBoard: attackerTeam.skills.shuffleBoard - 1,
          },
        },
        [targetKey]: {
          ...targetTeam,
          cells: shuffled,
          completedLines: newCompletedLines,
        },
      };
    });
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
    useInkAttack,
    useShuffleOpponentBoard,
  };
}
