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
  const [gameState, setGameState] = useState<GameState>(getInitialGameState);
  const [remainingTime, setRemainingTime] = useState<number>(7200);
  const [countdownText, setCountdownText] = useState<string | null>(null);
  const [isShufflingEffect, setIsShufflingEffect] = useState(false);
  const [boardShakeTeam, setBoardShakeTeam] = useState<TeamId | null>(null);

  const socketRef = useRef<WebSocket | null>(null);

  // 웹소켓 연결 (호스트네임 동적 감지: PC/모바일 동일 포트 3001)
  useEffect(() => {
    const host = window.location.hostname || 'localhost';
    const wsUrl = `ws://${host}:3001`;

    let ws: WebSocket;
    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'SYNC_STATE') {
              setGameState(data.payload);
            } else if (data.type === 'COUNTDOWN_START') {
              // 모든 기기에서 동시 카운트다운 연출
              setCountdownText('준비~');
              setTimeout(() => {
                setCountdownText('시작! 🚀');
                setTimeout(() => {
                  setCountdownText(null);
                  setIsShufflingEffect(true);
                  setTimeout(() => setIsShufflingEffect(false), 800);
                }, 600);
              }, 800);
            } else if (data.type === 'NEW_CHAT') {
              setGameState((prev) => ({
                ...prev,
                messages: [...prev.messages, data.payload],
              }));
            }
          } catch (e) {
            console.error('WS Parse error', e);
          }
        };

        ws.onclose = () => {
          setTimeout(connect, 2000); // 자동 재연결
        };
      } catch (err) {
        console.error('WS Connection error', err);
      }
    };

    connect();

    return () => {
      if (ws) ws.close();
    };
  }, []);

  const sendWs = useCallback((type: string, payload: unknown) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, payload }));
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
    sendWs('START_GAME', {});
  }, [currentUser, sendWs]);

  // 게임 리셋
  const resetGame = useCallback(() => {
    sendWs('RESET_GAME', {});
  }, [sendWs]);

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

    // 3줄 빙고 달성 시 즉시 심사(REVIEWING) 단계 돌입!
    if (newCompletedLines >= 3 && gameState.phase === 'PLAYING') {
      nextPhase = 'REVIEWING';
      candidate = teamKey;
      alert(`🎉 [${currentTeam.name} 3줄 달성!] 상대팀의 심사(인정/노인정 투표)가 시작됩니다!`);
    }

    const nextState: Partial<GameState> = {
      phase: nextPhase,
      candidateTeam: candidate,
      [teamKey]: {
        ...currentTeam,
        cells: updatedCells,
        completedLines: newCompletedLines,
      },
    };

    sendWs('UPDATE_STATE', nextState);
  }, [currentUser, gameState, sendWs]);

  // 심사 투표 (인정 / 노인정)
  const voteMission = useCallback((positionIndex: number, isApprove: boolean) => {
    if (!currentUser || !gameState.candidateTeam) return;

    // 투표자는 반드시 상대팀이어야 함
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

    // 기존 표 제거
    approved = approved.filter((id) => id !== voterId);
    rejected = rejected.filter((id) => id !== voterId);

    if (isApprove) {
      approved.push(voterId);
    } else {
      rejected.push(voterId);
    }

    let reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING';
    let isCompleted: boolean = targetCell.isCompleted;

    // 과반수 기준: 상대팀 인원 5명 중 3명 이상
    if (rejected.length >= 3) {
      reviewStatus = 'REJECTED';
      isCompleted = false; // 노인정 과반수로 탈락!
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
      // 3줄이 깨졌으므로 다시 게임 모드로 복귀
      nextPhase = 'PLAYING';
      alert(`❌ [노인정 과반수!] #${positionIndex + 1}번 미션이 탈락하여 3줄 빙고가 취소되었습니다!`);
    } else {
      // 심사 대상 칸들이 모두 과반 인정받았는지 체크
      const completedCells = updatedCells.filter((c) => c.isCompleted);
      const allApproved = completedCells.every((c) => (c.approvedUsers?.length ?? 0) >= 3);
      if (allApproved && newCompletedLines >= 3) {
        nextPhase = 'FINISHED';
        winner = targetTeamKey;
      }
    }

    const nextState: Partial<GameState> = {
      phase: nextPhase,
      winnerTeam: winner,
      [targetTeamKey]: {
        ...targetTeam,
        cells: updatedCells,
        completedLines: newCompletedLines,
      },
    };

    sendWs('UPDATE_STATE', nextState);
  }, [currentUser, gameState, sendWs]);

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

    sendWs('UPDATE_STATE', {
      [attackerKey]: {
        ...attackerTeam,
        skills: { ...attackerTeam.skills, inkAttack: attackerTeam.skills.inkAttack - 1 },
      },
      [targetKey]: {
        ...targetTeam,
        cells: updatedTargetCells,
      },
    });

    alert(`🦑 [먹물 투척!] 상대 ${targetTeam.name}의 칸 2개를 3분간 가렸습니다!`);
  }, [currentUser, gameState, sendWs]);

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
    setTimeout(() => setBoardShakeTeam(null), 800);

    sendWs('UPDATE_STATE', {
      [attackerKey]: {
        ...attackerTeam,
        skills: { ...attackerTeam.skills, shuffleBoard: attackerTeam.skills.shuffleBoard - 1 },
      },
      [targetKey]: {
        ...targetTeam,
        cells: shuffled,
        completedLines: calculateCompletedLines(shuffled),
      },
    });

    alert(`🌪️ [판 흔들기!] 상대 ${targetTeam.name}의 빙고판 전체를 뒤흔들었습니다!`);
  }, [currentUser, gameState, sendWs]);

  // 채팅 전송
  const sendChatMessage = useCallback((text: string) => {
    if (!currentUser || !text.trim()) return;
    const msg = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      teamId: currentUser.teamId,
      teamName: currentUser.teamName,
      isLeader: currentUser.isLeader,
      text: text.trim(),
      timestamp: Date.now(),
    };
    sendWs('SEND_CHAT', msg);
  }, [currentUser, sendWs]);

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
