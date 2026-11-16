import React, { useState, useEffect } from 'react';
import type { TeamState, UserProfile } from '../types';
import { ThumbsUp, ThumbsDown, CheckCircle, XCircle, AlertTriangle, Clock, X, Maximize2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  candidateTeam: TeamState | null;
  currentUser: UserProfile;
  reviewStartTime?: number | null;
  onVote: (positionIndex: number, isApprove: boolean) => void;
  onClose: () => void;
}

const REVIEW_DURATION_SEC = 600; // 10분

export const ReviewModal: React.FC<Props> = ({
  isOpen,
  candidateTeam,
  currentUser,
  reviewStartTime,
  onVote,
  onClose,
}) => {
  const [remSeconds, setRemSeconds] = useState(REVIEW_DURATION_SEC);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    if (!reviewStartTime || !isOpen) return;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - reviewStartTime) / 1000);
      const left = Math.max(0, REVIEW_DURATION_SEC - elapsed);
      setRemSeconds(left);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [reviewStartTime, isOpen]);

  if (!isOpen || !candidateTeam) return null;

  const isOpponent = currentUser.teamId !== candidateTeam.id;
  const completedCells = candidateTeam.cells.filter((c) => c.isCompleted || c.reviewStatus === 'REJECTED');

  const formatMinSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md max-h-[92dvh] bg-[#FFFDF9] rounded-3xl flex flex-col overflow-hidden shadow-2xl border-4 border-amber-300 relative">
        {/* 우측 상단 나가기(닫기) 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 px-2.5 py-1 bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 rounded-full text-[10px] font-black border border-orange-200 shadow-xs flex items-center gap-1 font-jua transition-all"
          title="심사창 닫고 빙고판 보기"
        >
          <span>빙고판 보기</span>
          <X className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>

        {/* 상단 헤더 */}
        <div className="p-3.5 bg-gradient-to-r from-amber-100 via-orange-100 to-rose-100 border-b border-orange-200 text-center shrink-0 pr-24">
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9.5px] font-black font-jua mb-1">
            ⚖️ 상대팀 사진 심사 타임!
          </div>
          <h2 className="text-base font-black text-slate-800 font-jua leading-tight">
            {candidateTeam.name}의 3줄 빙고 검증
          </h2>
          <p className="text-[10px] text-slate-600 font-semibold mt-0.5 leading-tight">
            {isOpponent
              ? '조건에 맞는 사진인지 확인 후 [인정 / 노인정]을 투표해주세요!'
              : '상대팀이 우리 팀의 사진을 심사하고 있습니다... ⏳'}
          </p>
        </div>

        {/* 10분 카운트다운 타이머 바 */}
        <div className="bg-amber-500/10 border-b border-amber-300/40 px-3 py-1.5 flex items-center justify-between shrink-0 font-jua">
          <div className="flex items-center gap-1.5 text-xs text-amber-900 font-black">
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            <span>심사 제한시간:</span>
            <span className="font-mono text-sm text-rose-600 font-black tracking-wider bg-white px-1.5 py-0.2 rounded border border-rose-200">
              {formatMinSec(remSeconds)}
            </span>
          </div>
          <span className="text-[9.5px] text-slate-500 font-bold">
            (10분 경과 시 자동 승리 인정 🏆)
          </span>
        </div>

        {/* 심사 대상 사진 카드 목록 */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {completedCells.map((cell) => {
            const approvedCount = cell.approvedUsers?.length ?? 0;
            const rejectedCount = cell.rejectedUsers?.length ?? 0;
            const myVote = cell.approvedUsers?.includes(currentUser.id)
              ? 'APPROVED'
              : cell.rejectedUsers?.includes(currentUser.id)
              ? 'REJECTED'
              : null;

            const isRejected = cell.reviewStatus === 'REJECTED' || rejectedCount >= 3;
            const isApproved = cell.reviewStatus === 'APPROVED' || approvedCount >= 3;

            return (
              <div
                key={cell.positionIndex}
                className={`p-3 rounded-2xl border-2 transition-all ${
                  isRejected
                    ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-200'
                    : isApproved
                    ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-200'
                    : 'bg-white border-orange-200 shadow-2xs'
                }`}
              >
                {/* 미션 정보 */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 font-jua text-xs font-black text-slate-800">
                    <span className="text-base">{cell.mission.emoji}</span>
                    <span>#{cell.positionIndex + 1} {cell.mission.title}</span>
                  </div>

                  {/* 심사 상태 뱃지 */}
                  {isRejected ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full font-jua">
                      <XCircle className="w-3 h-3" /> 노인정 탈락
                    </span>
                  ) : isApproved ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full font-jua">
                      <CheckCircle className="w-3 h-3" /> 인정 완료 ({approvedCount}표)
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-jua">
                      심사 진행 중 ({approvedCount}/3)
                    </span>
                  )}
                </div>

                <p className="text-[10.5px] text-slate-600 mb-2 font-medium leading-relaxed">
                  {cell.mission.description}
                </p>

                {/* 등록된 사진 - 세로/가로 사진 모두 넉넉하게 크게 표시 */}
                {cell.photoUrl ? (
                  <div
                    onClick={() => setPreviewPhoto({ url: cell.photoUrl!, title: cell.mission.title })}
                    className="w-full h-56 sm:h-64 rounded-xl bg-slate-950 overflow-hidden mb-2 relative shadow-inner cursor-pointer group flex items-center justify-center"
                    title="클릭하여 원본 크게 보기"
                  >
                    <img
                      src={cell.photoUrl}
                      alt={cell.mission.title}
                      className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-102"
                    />

                    {/* 확대 아이콘 힌트 */}
                    <div className="absolute top-2 left-2 bg-black/60 hover:bg-black/80 text-white text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 font-bold backdrop-blur-xs transition-opacity">
                      <Maximize2 className="w-2.5 h-2.5" />
                      <span>터치하여 크게 보기</span>
                    </div>

                    {cell.completedBy && (
                      <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[9.5px] px-2 py-0.5 rounded-md font-mono font-bold shadow-xs">
                        by {cell.completedBy.toUpperCase()}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="w-full py-6 text-center text-xs text-slate-400 bg-slate-100 rounded-xl mb-2 font-jua">
                    등록된 사진 없음
                  </div>
                )}

                {/* 투표 현황 및 버튼 */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-black font-jua">
                    <span className="text-emerald-600 flex items-center gap-0.5">
                      <ThumbsUp className="w-3.5 h-3.5" /> 인정 {approvedCount}표
                    </span>
                    <span className="text-rose-500 flex items-center gap-0.5">
                      <ThumbsDown className="w-3.5 h-3.5" /> 노인정 {rejectedCount}표
                    </span>
                  </div>

                  {/* 상대팀 유저에게만 투표 버튼 활성화 */}
                  {isOpponent && !isRejected && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onVote(cell.positionIndex, true)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black font-jua flex items-center gap-1 transition-all ${
                          myVote === 'APPROVED'
                            ? 'bg-emerald-500 text-white shadow-xs scale-105'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 active:scale-95'
                        }`}
                      >
                        <ThumbsUp className="w-3 h-3" />
                        <span>인정</span>
                      </button>

                      <button
                        onClick={() => onVote(cell.positionIndex, false)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black font-jua flex items-center gap-1 transition-all ${
                          myVote === 'REJECTED'
                            ? 'bg-rose-500 text-white shadow-xs scale-105'
                            : 'bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100 active:scale-95'
                        }`}
                      >
                        <ThumbsDown className="w-3 h-3" />
                        <span>노인정</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 하단 안내 배너 */}
        <div className="p-2.5 bg-white border-t border-orange-100 text-center shrink-0">
          <div className="flex items-center justify-center gap-1 text-[10.5px] font-bold text-slate-500">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>상대팀 5명 중 3명 이상(과반수) 인정 시 빙고가 확정되며 최종 승리합니다! 🏆</span>
          </div>
        </div>
      </div>

      {/* 사진 전체화면 확대 라이트박스 모달 */}
      {previewPhoto && (
        <div
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-60 bg-black/95 flex flex-col items-center justify-center p-2 animate-in fade-in duration-150 cursor-zoom-out"
        >
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            <span className="text-white text-xs font-bold bg-white/20 px-3 py-1 rounded-full font-jua">
              {previewPhoto.title}
            </span>
            <button
              onClick={() => setPreviewPhoto(null)}
              className="p-2 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <img
            src={previewPhoto.url}
            alt={previewPhoto.title}
            className="max-w-full max-h-[88vh] object-contain rounded-lg shadow-2xl"
          />
          <div className="text-white/60 text-xs mt-2 font-semibold">
            화면 아무 곳이나 터치하면 닫힙니다
          </div>
        </div>
      )}
    </div>
  );
};
