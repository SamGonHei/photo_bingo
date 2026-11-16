import { useState, useEffect, useRef, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { usePhotoBingo, getInitialGameState } from './hooks/usePhotoBingo';
import { Header } from './components/Header';
import { SkillControls } from './components/SkillControls';
import { BingoCard } from './components/BingoCard';
import { PhotoUploadModal } from './components/PhotoUploadModal';
import { PhotoDetailModal } from './components/PhotoDetailModal';
import { GameOverModal } from './components/GameOverModal';
import { ReviewModal } from './components/ReviewModal';
import { LoginScreen } from './components/LoginScreen';
import { ChatDrawer } from './components/ChatDrawer';
import { getCurrentUser, loginUser, logoutUser } from './utils/auth';
import type { BingoCell, UserProfile } from './types';
import { Play, RotateCcw, HelpCircle, Sparkles, Clock, MessageCircle, RefreshCw } from 'lucide-react';

// 크래시 방어용 ErrorBoundary
interface ErrorBoundaryProps {
  children: ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  handleReset = () => {
    localStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-screen bg-[#FFF9ED] flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="text-4xl mb-3 animate-bounce">🐥</div>
          <h2 className="text-lg font-black text-slate-800 font-jua">
            화면을 불러오는 중 문제가 발생했습니다
          </h2>
          <p className="text-xs text-slate-500 mt-1 mb-4 font-semibold">
            아래 복구 버튼을 누르면 정상적으로 다시 실행됩니다!
          </p>
          <button
            onClick={this.handleReset}
            className="px-5 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black text-sm font-jua shadow-md flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>화면 정상 복구하기</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainApp() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [expiredNotice, setExpiredNotice] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [isReviewDismissed, setIsReviewDismissed] = useState(false);

  // 세션 로드 및 만료 체크
  useEffect(() => {
    const { user, isExpired } = getCurrentUser();
    if (isExpired) setExpiredNotice(true);
    if (user) setCurrentUser(user);

    const interval = setInterval(() => {
      const check = getCurrentUser();
      if (check.isExpired) {
        setExpiredNotice(true);
        setCurrentUser(null);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleLogin = (id: string) => {
    const res = loginUser(id);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      setExpiredNotice(false);
    }
  };

  const handleLogout = () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      logoutUser();
      setCurrentUser(null);
    }
  };

  const {
    gameState,
    currentTeam,
    opponentTeam,
    remainingTime,
    countdownText,
    shakeCountdownText,
    isShufflingEffect,
    boardShakeTeam,
    startGame,
    resetGame,
    completeMission,
    voteMission,
    voteAllMissions,
    useInkAttack,
    useShuffleOpponentBoard,
    sendChatMessage,
    isFirebaseConfigured,
  } = usePhotoBingo(currentUser);

  // 글자 크기 조절 상태 (0: 기본, 1: 크게, 2: 최대)
  const [fontScale, setFontScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('photo_bingo_font_scale');
      if (saved) return Number(saved);
    } catch {
      // ignore
    }
    return 0;
  });

  const handleFontScaleChange = (delta: number) => {
    setFontScale((prev) => {
      const next = Math.max(0, Math.min(2, prev + delta));
      try {
        localStorage.setItem('photo_bingo_font_scale', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // 심사 단계 종료 시 dismiss 리셋
  useEffect(() => {
    if (gameState.phase !== 'REVIEWING') {
      setIsReviewDismissed(false);
    }
  }, [gameState.phase]);

  // 안 읽은 메시지 카운트
  const prevMsgLength = useRef(gameState.messages?.length ?? 0);
  useEffect(() => {
    const currentLength = gameState.messages?.length ?? 0;
    if (currentLength > prevMsgLength.current) {
      const diff = currentLength - prevMsgLength.current;
      if (!isChatOpen) {
        setUnreadChatCount((prev) => prev + diff);
      }
    }
    prevMsgLength.current = currentLength;
  }, [gameState.messages, isChatOpen]);

  const handleOpenChat = () => {
    setIsChatOpen(true);
    setUnreadChatCount(0);
  };

  const [selectedCell, setSelectedCell] = useState<{ cell: BingoCell; index: number } | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);

  const handleCellClick = (cell: BingoCell, index: number) => {
    if (!gameState.isStarted) {
      alert('아직 게임이 시작되지 않았습니다! 시작 신호를 기다려주세요 🐥');
      return;
    }
    if (gameState.phase === 'REVIEWING') {
      alert('현재 심사 단계가 진행 중입니다!');
      return;
    }
    if (gameState.phase === 'FINISHED') {
      alert('게임이 종료되었습니다!');
      return;
    }

    setSelectedCell({ cell, index });
    if (cell.isCompleted && cell.photoUrl) {
      setIsDetailModalOpen(true);
    } else {
      setIsUploadModalOpen(true);
    }
  };

  const handlePhotoSubmit = (index: number, photoUrl: string) => {
    completeMission(index, photoUrl);
  };

  const handleRetake = (index: number) => {
    const cell = currentTeam.cells[index];
    setSelectedCell({ cell, index });
    setIsUploadModalOpen(true);
  };

  // 로그인 화면
  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} expiredNotice={expiredNotice} />;
  }

  const isCurrentBoardShaking = boardShakeTeam === currentUser.teamId;
  const candidateTeamState = gameState.candidateTeam ? (gameState[gameState.candidateTeam] || getInitialGameState()[gameState.candidateTeam]) : null;

  return (
    <div className="w-full h-full bg-[#FFFDF7] flex flex-col items-center justify-between overflow-hidden select-none">
      <div className="w-full max-w-md h-full flex flex-col bg-[#FFFDF7] border-x border-orange-100 relative overflow-hidden">
        {/* 상단 헤더 */}
        <Header
          currentUser={currentUser}
          currentTeam={currentTeam}
          opponentTeam={opponentTeam}
          remainingTime={remainingTime}
          isStarted={gameState.isStarted}
          onLogout={handleLogout}
        />

        {/* Firebase 미설정 시 안내 배너 */}
        {!isFirebaseConfigured && (
          <div className="w-full bg-amber-50 border-b border-amber-200 px-3 py-1.5 flex items-center justify-between text-amber-900 text-[11px] font-semibold shrink-0">
            <span className="flex items-center gap-1">
              <span>⚠️</span>
              <span>[로컬 모드] Vercel 환경변수에 Firebase 설정을 추가하면 참가자 실시간 연동이 활성화됩니다.</span>
            </span>
          </div>
        )}

        {/* 심사 중 나가기 시 상단 플로팅 배너 */}
        {gameState.phase === 'REVIEWING' && isReviewDismissed && (
          <div
            onClick={() => setIsReviewDismissed(false)}
            className="w-full bg-linear-to-r from-amber-500 via-orange-500 to-rose-500 text-white px-3 py-1.5 flex items-center justify-between cursor-pointer shadow-md animate-pulse shrink-0 font-jua select-none"
          >
            <div className="flex items-center gap-1.5 text-xs font-black">
              <span>⚖️</span>
              <span>[심사 진행 중] 10분 타이머 작동 중!</span>
            </div>
            <span className="text-[10px] bg-white text-rose-600 px-2 py-0.5 rounded-full font-black shadow-xs">
              심사창 다시 열기 &gt;
            </span>
          </div>
        )}

        {/* 상대 2줄 달성 시 빙고 임박 긴급 경고 배너 */}
        {opponentTeam.completedLines >= 2 && gameState.phase === 'PLAYING' && (
          <div className="w-full bg-linear-to-r from-red-600 via-rose-600 to-red-500 text-white px-3 py-1 flex items-center justify-between shadow-md animate-pulse shrink-0 font-jua select-none border-b border-red-700">
            <div className="flex items-center gap-1.5 text-xs font-black">
              <span className="text-sm animate-bounce">💢</span>
              <span>[긴급] 상대 {opponentTeam.name} 2줄 달성! 빙고 임박!!!</span>
            </div>
            <span className="text-[9.5px] bg-white text-rose-600 px-2 py-0.2 rounded-full font-black shadow-xs">
              스킬로 저지하세요! 🦑
            </span>
          </div>
        )}

        {/* 메인 영역 */}
        <main className="flex-1 min-h-0 flex flex-col px-2 py-0.5 overflow-hidden justify-between">
          {/* 스킬 바 */}
          <SkillControls
            currentUser={currentUser}
            currentTeam={currentTeam}
            isStarted={gameState.isStarted}
            onUseInkAttack={useInkAttack}
            onUseShuffleBoard={useShuffleOpponentBoard}
          />

          {/* 4x4 빙고 그리드 컨테이너 */}
          <div className="flex-1 min-h-0 w-full relative my-0.5">
            {/* 시작 전 대기실 */}
            {!gameState.isStarted && !isShufflingEffect && !countdownText && (
              <div className="absolute inset-0 z-10 bg-white/95 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-3 text-center border-2 border-orange-200 shadow-md">
                <div className="w-10 h-10 rounded-2xl bg-orange-100 border border-orange-200 flex items-center justify-center mb-1 animate-bounce">
                  <Clock className="w-5 h-5 text-orange-500" />
                </div>
                <h3 className="text-sm font-black text-slate-800 font-jua">
                  포토빙고 대기실 🏖️
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5 max-w-[220px] font-semibold leading-tight">
                  게임이 시작되면 16개 미션이 무작위로 섞이며 2시간 타이머가 돌아갑니다!
                </p>

                {currentUser.canStartGame ? (
                  <button
                    onClick={startGame}
                    className="mt-3 px-5 py-2.5 rounded-xl bg-linear-to-r from-orange-400 via-rose-400 to-amber-400 hover:opacity-95 active:scale-95 text-white font-black text-sm tracking-wide shadow-md shadow-orange-500/25 flex items-center gap-1.5 font-jua transition-all"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>🚀 게임 시작하기!</span>
                  </button>
                ) : (
                  <div className="mt-3 px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-[10px] text-orange-800 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                    <span>주최자의 게임 시작 신호를 기다리고 있습니다... ⏳</span>
                  </div>
                )}
              </div>
            )}

            {/* 준비~ 시작! 카운트다운 */}
            {countdownText && (
              <div className="absolute inset-0 z-40 bg-white/95 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center animate-in fade-in zoom-in-75 duration-200 border-2 border-orange-300">
                <span className="text-3xl font-black text-orange-500 font-jua tracking-wider animate-pulse drop-shadow-sm">
                  {countdownText}
                </span>
              </div>
            )}

            {/* 판 흔들기 발동 시 3초 카운트다운 */}
            {shakeCountdownText && (
              <div className="absolute inset-0 z-45 bg-purple-950/90 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-4 text-center animate-in fade-in zoom-in-90 duration-150 border-4 border-purple-400 shadow-2xl">
                <div className="text-4xl mb-2 animate-bounce">🌪️</div>
                <span className="text-2xl sm:text-3xl font-black text-amber-300 font-jua tracking-wider animate-pulse drop-shadow-md">
                  {shakeCountdownText}
                </span>
                <p className="text-xs font-bold text-purple-200 mt-2 font-jua">
                  상대팀이 판을 뒤흔들고 있습니다!! 🎲
                </p>
              </div>
            )}

            {/* 셔플 연출 */}
            {isShufflingEffect && (
              <div className="absolute inset-0 z-30 bg-white/90 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center gap-1.5 border-2 border-orange-200">
                <Sparkles className="w-6 h-6 text-amber-500 animate-spin" />
                <span className="font-jua text-sm font-black text-slate-800 animate-pulse">
                  미션 슈루루루루 셔플 중... 🎲
                </span>
              </div>
            )}

            {/* 4x4 빙고 그리드 */}
            <div
              className={`w-full h-full grid grid-cols-4 grid-rows-4 gap-1 p-1 bg-orange-50/70 border border-orange-200/80 rounded-2xl transition-transform ${
                isCurrentBoardShaking ? 'animate-shake' : ''
              }`}
            >
              {(currentTeam?.cells || []).map((cell, index) => (
                <BingoCard
                  key={`${cell.mission.id}-${index}`}
                  cell={cell}
                  index={index}
                  fontScale={fontScale}
                  onCellClick={handleCellClick}
                />
              ))}
            </div>
          </div>

          {/* 하단 바 */}
          <div className="flex items-center justify-between gap-1.5 pt-0.5 pb-1 shrink-0">
            <button
              onClick={() => setShowRuleModal(true)}
              className="py-1.5 px-2 bg-white border border-orange-200 hover:bg-orange-50 text-slate-700 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 shadow-2xs font-jua shrink-0"
            >
              <HelpCircle className="w-3 h-3 text-orange-500" />
              <span>포토빙고 룰</span>
            </button>

            {/* 글자 크기 조절 (+ / -) */}
            <div className="flex items-center bg-white border border-orange-200 rounded-xl px-1.5 py-1 shadow-2xs font-jua gap-0.5 shrink-0">
              <button
                onClick={() => handleFontScaleChange(-1)}
                disabled={fontScale === 0}
                className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:text-orange-600 hover:bg-orange-50 disabled:opacity-25 disabled:pointer-events-none text-xs font-black transition-colors"
                title="글자 크기 축소"
              >
                -
              </button>
              <span className="text-[10px] font-black text-slate-700 px-1 select-none whitespace-nowrap">
                {fontScale === 0 ? '글자 보통' : fontScale === 1 ? '글자 크게' : '글자 최대'}
              </span>
              <button
                onClick={() => handleFontScaleChange(1)}
                disabled={fontScale === 2}
                className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:text-orange-600 hover:bg-orange-50 disabled:opacity-25 disabled:pointer-events-none text-xs font-black transition-colors"
                title="글자 크기 확대"
              >
                +
              </button>
            </div>

            {/* 실시간 채팅 버튼 & 안 읽은 카운트 */}
            <button
              onClick={handleOpenChat}
              className="relative py-1.5 px-3 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-xl text-[10px] font-black flex items-center gap-1 shadow-xs font-jua transition-all"
            >
              <MessageCircle className="w-3 h-3 fill-current" />
              <span>채팅톡</span>
              {unreadChatCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] font-black px-1 rounded-full border border-white animate-bounce font-mono">
                  {unreadChatCount}
                </span>
              )}
            </button>

            {currentUser.canStartGame && (
              <button
                onClick={() => {
                  if (confirm('⚠️ [주최자 권한] 게임 및 채팅을 초기화하시겠습니까?')) {
                    resetGame();
                  }
                }}
                className="py-1.5 px-2 bg-white border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl text-[10px] font-semibold flex items-center gap-0.5 shadow-2xs"
                title="게임 및 채팅 초기화"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>리셋</span>
              </button>
            )}
          </div>
        </main>
      </div>

      {/* 실시간 전체 채팅창 */}
      <ChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={gameState.messages || []}
        onSendMessage={sendChatMessage}
        currentUser={currentUser}
      />

      {/* 상대팀 사진 심사 모달 */}
      <ReviewModal
        isOpen={gameState.phase === 'REVIEWING' && !isReviewDismissed}
        candidateTeam={candidateTeamState}
        currentUser={currentUser}
        reviewStartTime={gameState.reviewStartTime}
        onVote={voteMission}
        onVoteAll={voteAllMissions}
        onClose={() => setIsReviewDismissed(true)}
      />

      {/* 최종 승리 축하 모달 */}
      <GameOverModal
        winnerTeam={gameState.winnerTeam ?? null}
        teamA={gameState.teamA}
        teamB={gameState.teamB}
        isOpen={gameState.phase === 'FINISHED' && Boolean(gameState.winnerTeam)}
        onRestart={resetGame}
      />

      {/* 사진 업로드 모달 */}
      <PhotoUploadModal
        cell={selectedCell?.cell ?? null}
        cellIndex={selectedCell?.index ?? null}
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onPhotoSubmit={handlePhotoSubmit}
      />

      {/* 완료된 사진 상세 모달 */}
      <PhotoDetailModal
        cell={selectedCell?.cell ?? null}
        cellIndex={selectedCell?.index ?? null}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onRetake={handleRetake}
      />

      {/* 룰 모달 */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-4 shadow-2xl border-2 border-orange-200">
            <h3 className="text-xs font-black text-slate-800 font-jua mb-2 flex items-center gap-1">
              <span>📖</span>
              <span>스위칭 데이 포토빙고 룰</span>
            </h3>
            <ul className="text-[10px] text-slate-600 space-y-1.5 leading-relaxed font-semibold">
              <li>⏱️ <strong>제한 시간</strong>: 시작 후 2시간 동안 진행됩니다.</li>
              <li>🏆 <strong>승리 조건</strong>: 4x4 칸 중 <strong>3줄</strong>을 먼저 완성하는 팀!</li>
              <li>⚖️ <strong>상대팀 심사</strong>: 3줄 달성 시 상대팀이 등록된 사진을 심사하여 <strong>과반수(3표 이상) 인정</strong>을 받아야 최종 우승! (노인정 과반수 시 탈락 및 재도전)</li>
              <li>💬 <strong>통합 채팅</strong>: 하단 채팅톡에서 전원 실시간 대화가 가능하며 안 읽은 메시지가 숫자로 표시됩니다.</li>
            </ul>
            <button
              onClick={() => setShowRuleModal(false)}
              className="mt-3 w-full py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[11px] font-bold font-jua"
            >
              확인 완료!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

export default App;
