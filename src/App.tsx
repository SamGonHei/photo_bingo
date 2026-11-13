import { useState, useEffect } from 'react';
import { usePhotoBingo } from './hooks/usePhotoBingo';
import { Header } from './components/Header';
import { SkillControls } from './components/SkillControls';
import { BingoCard } from './components/BingoCard';
import { PhotoUploadModal } from './components/PhotoUploadModal';
import { PhotoDetailModal } from './components/PhotoDetailModal';
import { GameOverModal } from './components/GameOverModal';
import { LoginScreen } from './components/LoginScreen';
import { getCurrentUser, loginUser, logoutUser } from './utils/auth';
import type { BingoCell, UserProfile } from './types';
import { Play, RotateCcw, HelpCircle, Sparkles, Clock } from 'lucide-react';

export function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [expiredNotice, setExpiredNotice] = useState(false);

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
    }, 30000); // 30초마다 만료 체크

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

  const [selectedCell, setSelectedCell] = useState<{ cell: BingoCell; index: number } | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);

  // 셀 클릭 핸들러
  const handleCellClick = (cell: BingoCell, index: number) => {
    if (!gameState.isStarted) {
      alert('아직 게임이 시작되지 않았습니다! 주최자(SAM)의 시작 신호를 기다려주세요.');
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

  // 로그인되지 않은 경우 로그인 화면 표시
  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} expiredNotice={expiredNotice} />;
  }

  const isCurrentBoardShaking = boardShakeTeam === currentUser.teamId;

  return (
    <div className="h-dvh h-screen w-full bg-[#0F172A] flex flex-col items-center justify-center overflow-hidden select-none">
      {/* 모바일 화면 컨테이너 (스크롤 0 최적화: flex-col, overflow-hidden) */}
      <div className="w-full max-w-md h-full flex flex-col bg-[#F8FAFC] shadow-2xl relative overflow-hidden">
        {/* 상단 헤더 */}
        <Header
          currentUser={currentUser}
          currentTeam={currentTeam}
          opponentTeam={opponentTeam}
          remainingTime={remainingTime}
          isStarted={gameState.isStarted}
          onLogout={handleLogout}
        />

        {/* 메인 영역: flex-1 min-h-0 으로 스크롤 없이 가변 핏팅 */}
        <main className="flex-1 min-h-0 flex flex-col px-3 py-1.5 overflow-hidden">
          {/* 스페셜 스킬 컨트롤 */}
          <SkillControls
            currentUser={currentUser}
            currentTeam={currentTeam}
            opponentTeam={opponentTeam}
            isStarted={gameState.isStarted}
            onUseInkAttack={useInkAttack}
            onUseShuffleBoard={useShuffleOpponentBoard}
          />

          {/* 빙고판 영역: 남은 높이를 꽉 채우는 4x4 그리드 */}
          <div className="flex-1 min-h-0 w-full relative my-1">
            {/* 1. 시작 전 블라인드 대기실 화면 */}
            {!gameState.isStarted && !isShufflingEffect && !countdownText && (
              <div className="absolute inset-0 z-10 bg-slate-900/90 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-4 text-center border border-slate-700 shadow-xl">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center mb-2.5">
                  <Clock className="w-6 h-6 text-indigo-400 animate-pulse" />
                </div>
                <h3 className="text-base font-black text-white font-jua">
                  포토빙고 대기실
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-[240px] leading-relaxed">
                  게임이 시작되면 16개 미션이 랜덤으로 배치되고 2시간 타이머가 시작됩니다!
                </p>

                {currentUser.canStartGame ? (
                  <button
                    onClick={startGame}
                    className="mt-4 px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 via-rose-500 to-amber-500 hover:opacity-95 active:scale-95 text-white font-black text-sm tracking-wide shadow-lg shadow-indigo-500/30 flex items-center gap-2 font-jua animate-bounce"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>게임 시작하기! (SAM 전용 🚀)</span>
                  </button>
                ) : (
                  <div className="mt-4 px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-xs text-indigo-200 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>주최자(SAM)의 게임 시작을 기다리고 있습니다...</span>
                  </div>
                )}
              </div>
            )}

            {/* 2. '준비~ 시작!' 카운트다운 연출 */}
            {countdownText && (
              <div className="absolute inset-0 z-40 bg-slate-950/95 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center animate-in fade-in zoom-in-75 duration-200">
                <span className="text-4xl md:text-5xl font-black text-amber-400 font-jua tracking-wider animate-pulse drop-shadow-xl">
                  {countdownText}
                </span>
              </div>
            )}

            {/* 3. 슈루루루루 셔플 모션 연출 */}
            {isShufflingEffect && (
              <div className="absolute inset-0 z-30 bg-slate-900/80 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center gap-2">
                <Sparkles className="w-8 h-8 text-amber-400 animate-spin" />
                <span className="font-jua text-base font-black text-white animate-pulse">
                  미션 슈루루루루 셔플 중... 🎲
                </span>
                <span className="text-[11px] text-slate-300">
                  양 팀의 판이 무작위로 섞입니다!
                </span>
              </div>
            )}

            {/* 4x4 그리드: flex-1 높이에 맞춰 4행 4열 꽉 채움 */}
            <div
              className={`w-full h-full grid grid-cols-4 grid-rows-4 gap-1.5 p-1.5 bg-slate-100 border border-slate-200 rounded-2xl transition-transform ${
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

          {/* 하단 유틸 바 (규칙 및 테스트 리셋) */}
          <div className="flex items-center justify-between gap-2 pt-1 pb-1 shrink-0">
            <button
              onClick={() => setShowRuleModal(true)}
              className="flex-1 py-1.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
              <span>포토빙고 룰 안내</span>
            </button>

            {currentUser.canStartGame && (
              <button
                onClick={() => {
                  if (confirm('⚠️ [주최자 권한] 게임을 리셋하시겠습니까? 현재 진행 상태가 초기화됩니다.')) {
                    resetGame();
                  }
                }}
                className="py-1.5 px-2.5 bg-white border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl text-[11px] font-semibold flex items-center gap-1 shadow-2xs"
                title="게임 초기화 (SAM 전용)"
              >
                <RotateCcw className="w-3 h-3" />
                <span>리셋</span>
              </button>
            )}
          </div>
        </main>
      </div>

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
        onRestart={resetGame}
      />

      {/* 게임 규칙 팝업 */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-slate-200">
            <h3 className="text-sm font-black text-slate-800 font-jua mb-3 flex items-center gap-1.5">
              <span>📖</span>
              <span>스위칭 데이 포토빙고 룰</span>
            </h3>
            <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <li>⏱️ <strong>제한 시간</strong>: 시작 후 2시간 동안 진행됩니다.</li>
              <li>🏆 <strong>승리 조건</strong>: 4x4 칸 중 <strong>3줄</strong>을 먼저 완성하는 팀 즉시 승리!</li>
              <li>📸 <strong>사진 등록</strong>: 팀원 누구나 해당 칸을 눌러 사진 촬영 또는 갤러리 업로드 가능합니다.</li>
              <li>👑 <strong>팀장 스킬</strong>: 
                <br />- <strong>먹물 투척 (2회)</strong>: 상대팀 칸 2개를 3분간 가리고 등록 차단
                <br />- <strong>판 흔들기 (1회)</strong>: 상대팀 빙고판 전체를 랜덤 셔플
              </li>
              <li>👀 <strong>상대팀 실루엣</strong>: 우측 상단 미니맵에서 상대팀의 완료 칸 실루엣만 노출됩니다.</li>
            </ul>
            <button
              onClick={() => setShowRuleModal(false)}
              className="mt-4 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
