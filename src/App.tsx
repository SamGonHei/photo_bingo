import { useState, useEffect } from 'react';
import { usePhotoBingo } from './hooks/usePhotoBingo';
import { usePhotoBingoChat } from './hooks/usePhotoBingoChat';
import { Header } from './components/Header';
import { SkillControls } from './components/SkillControls';
import { BingoCard } from './components/BingoCard';
import { PhotoUploadModal } from './components/PhotoUploadModal';
import { PhotoDetailModal } from './components/PhotoDetailModal';
import { GameOverModal } from './components/GameOverModal';
import { LoginScreen } from './components/LoginScreen';
import { ChatDrawer } from './components/ChatDrawer';
import { getCurrentUser, loginUser, logoutUser } from './utils/auth';
import type { BingoCell, UserProfile } from './types';
import { Play, RotateCcw, HelpCircle, Sparkles, Clock, MessageCircle } from 'lucide-react';

export function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [expiredNotice, setExpiredNotice] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // 세션 로드 및 3시간 주기 체크
  useEffect(() => {
    const { user, isExpired } = getCurrentUser();
    if (isExpired) {
      setExpiredNotice(true);
    }
    if (user) {
      setCurrentUser(user);
    }

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
    isShufflingEffect,
    boardShakeTeam,
    startGame,
    resetGame,
    completeMission,
    useInkAttack,
    useShuffleOpponentBoard,
  } = usePhotoBingo(currentUser);

  // 채팅 훅
  const { messages, sendMessage, clearChat } = usePhotoBingoChat(gameState.startTime);

  const [selectedCell, setSelectedCell] = useState<{ cell: BingoCell; index: number } | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);

  const handleCellClick = (cell: BingoCell, index: number) => {
    if (!gameState.isStarted) {
      alert('아직 게임이 시작되지 않았습니다! 시작 신호를 기다려주세요 🐥');
      return;
    }
    if (gameState.winnerTeam) {
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

  // 게임 리셋 시 채팅도 리셋
  const handleResetWithChat = () => {
    resetGame();
    clearChat();
  };

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} expiredNotice={expiredNotice} />;
  }

  const isCurrentBoardShaking = boardShakeTeam === currentUser.teamId;

  return (
    <div className="h-dvh h-screen w-full bg-[#FFFDF7] flex flex-col items-center justify-center overflow-hidden select-none">
      {/* 모바일 화면 컨테이너 (스크롤 0 최적화) */}
      <div className="w-full max-w-md h-full flex flex-col bg-[#FFFDF7] shadow-xl border-x border-orange-100 relative overflow-hidden">
        {/* 상단 파스텔 헤더 */}
        <Header
          currentUser={currentUser}
          currentTeam={currentTeam}
          opponentTeam={opponentTeam}
          remainingTime={remainingTime}
          isStarted={gameState.isStarted}
          onLogout={handleLogout}
        />

        {/* 메인 영역 */}
        <main className="flex-1 min-h-0 flex flex-col px-3 py-1 overflow-hidden">
          {/* 스페셜 스킬 컨트롤 */}
          <SkillControls
            currentUser={currentUser}
            currentTeam={currentTeam}
            isStarted={gameState.isStarted}
            onUseInkAttack={useInkAttack}
            onUseShuffleBoard={useShuffleOpponentBoard}
          />

          {/* 빙고판 영역: 남은 높이를 꽉 채우는 4x4 그리드 */}
          <div className="flex-1 min-h-0 w-full relative my-1">
            {/* 1. 시작 전 귀여운 대기실 화면 */}
            {!gameState.isStarted && !isShufflingEffect && !countdownText && (
              <div className="absolute inset-0 z-10 bg-white/95 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-5 text-center border-3 border-orange-200 shadow-xl">
                <div className="w-14 h-14 rounded-3xl bg-orange-100 border-2 border-orange-200 flex items-center justify-center mb-2 animate-bounce">
                  <Clock className="w-7 h-7 text-orange-500" />
                </div>
                <h3 className="text-lg font-black text-slate-800 font-jua">
                  포토빙고 대기실 🏖️
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-[250px] leading-relaxed font-semibold">
                  게임이 시작되면 16개 미션이 무작위로 섞이며 2시간 타이머가 돌아갑니다!
                </p>

                {currentUser.canStartGame ? (
                  <button
                    onClick={startGame}
                    className="mt-4 px-6 py-3.5 rounded-2xl bg-linear-to-r from-orange-400 via-rose-400 to-amber-400 hover:opacity-95 active:scale-95 text-white font-black text-base tracking-wide shadow-lg shadow-orange-500/25 flex items-center gap-2 font-jua transition-all"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>🚀 게임 시작하기!</span>
                  </button>
                ) : (
                  <div className="mt-4 px-4 py-2.5 rounded-2xl bg-orange-50 border-2 border-orange-200 text-xs text-orange-800 font-bold flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-ping" />
                    <span>주최자의 게임 시작 신호를 기다리고 있습니다... ⏳</span>
                  </div>
                )}
              </div>
            )}

            {/* 2. '준비~ 시작!' 카운트다운 연출 */}
            {countdownText && (
              <div className="absolute inset-0 z-40 bg-white/95 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center animate-in fade-in zoom-in-75 duration-200 border-4 border-orange-300">
                <span className="text-4xl md:text-5xl font-black text-orange-500 font-jua tracking-wider animate-pulse drop-shadow-md">
                  {countdownText}
                </span>
              </div>
            )}

            {/* 3. 슈루루루루 셔플 모션 연출 */}
            {isShufflingEffect && (
              <div className="absolute inset-0 z-30 bg-white/90 backdrop-blur-xs rounded-3xl flex flex-col items-center justify-center gap-2 border-4 border-orange-200">
                <Sparkles className="w-8 h-8 text-amber-500 animate-spin" />
                <span className="font-jua text-lg font-black text-slate-800 animate-pulse">
                  미션 슈루루루루 셔플 중... 🎲
                </span>
                <span className="text-xs text-slate-500 font-bold">
                  양 팀의 판이 무작위로 섞입니다!
                </span>
              </div>
            )}

            {/* 4x4 그리드 */}
            <div
              className={`w-full h-full grid grid-cols-4 grid-rows-4 gap-1.5 p-2 bg-orange-50/70 border-2 border-orange-200/80 rounded-3xl transition-transform ${
                isCurrentBoardShaking ? 'animate-shake' : ''
              }`}
            >
              {currentTeam.cells.map((cell, index) => (
                <BingoCard
                  key={`${cell.mission.id}-${index}`}
                  cell={cell}
                  index={index}
                  onCellClick={handleCellClick}
                />
              ))}
            </div>
          </div>

          {/* 하단 유틸 바 */}
          <div className="flex items-center justify-between gap-2 pt-1 pb-1 shrink-0">
            <button
              onClick={() => setShowRuleModal(true)}
              className="flex-1 py-1.5 px-3 bg-white border-2 border-orange-200 hover:bg-orange-50 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs font-jua"
            >
              <HelpCircle className="w-3.5 h-3.5 text-orange-500" />
              <span>포토빙고 룰 안내</span>
            </button>

            {/* 채팅 열기 버튼 */}
            <button
              onClick={() => setIsChatOpen(true)}
              className="py-1.5 px-3.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-orange-500/20 font-jua transition-all"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
              <span>채팅톡 ({messages.length})</span>
            </button>

            {currentUser.canStartGame && (
              <button
                onClick={() => {
                  if (confirm('⚠️ [주최자 권한] 게임 및 채팅을 초기화하시겠습니까?')) {
                    handleResetWithChat();
                  }
                }}
                className="py-1.5 px-2.5 bg-white border-2 border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl text-[11px] font-semibold flex items-center gap-1 shadow-2xs"
                title="게임 및 채팅 초기화"
              >
                <RotateCcw className="w-3 h-3" />
                <span>리셋</span>
              </button>
            )}
          </div>
        </main>
      </div>

      {/* 채팅 바텀시트 드로어 */}
      <ChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={messages}
        onSendMessage={(text) =>
          sendMessage(
            currentUser.id,
            currentUser.name,
            currentUser.teamId,
            currentUser.teamName,
            currentUser.isLeader,
            text
          )
        }
        currentUser={currentUser}
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

      {/* 승리 축하 모달 */}
      <GameOverModal
        winnerTeam={gameState.winnerTeam ?? null}
        teamA={gameState.teamA}
        teamB={gameState.teamB}
        isOpen={Boolean(gameState.winnerTeam)}
        onRestart={handleResetWithChat}
      />

      {/* 게임 규칙 팝업 */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border-3 border-orange-200">
            <h3 className="text-sm font-black text-slate-800 font-jua mb-3 flex items-center gap-1.5">
              <span>📖</span>
              <span>스위칭 데이 포토빙고 룰</span>
            </h3>
            <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <li>⏱️ <strong>제한 시간</strong>: 시작 후 2시간 동안 진행됩니다.</li>
              <li>🏆 <strong>승리 조건</strong>: 4x4 칸 중 <strong>3줄</strong>을 먼저 완성하는 팀 즉시 승리!</li>
              <li>🎁 <strong>경품</strong>: 승리 팀에게는 엄청난 경품이 기다리고 있습니다!</li>
              <li>📸 <strong>사진 등록</strong>: 팀원 누구나 해당 칸을 눌러 사진 촬영 또는 갤러리 업로드 가능합니다.</li>
              <li>👑 <strong>팀장 스킬</strong>: 
                <br />- <strong>먹물 투척 (2회)</strong>: 상대팀 칸 2개를 3분간 가리고 등록 차단
                <br />- <strong>판 흔들기 (1회)</strong>: 상대팀 빙고판 전체를 랜덤 셔플
              </li>
              <li>💬 <strong>채팅톡</strong>: 하단 채팅톡 버튼을 눌러 팀원들과 실시간 대화를 나눠보세요! (게임 리셋 시 초기화)</li>
            </ul>
            <button
              onClick={() => setShowRuleModal(false)}
              className="mt-4 w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold font-jua"
            >
              확인 완료!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
