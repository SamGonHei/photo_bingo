import React from 'react';
import type { TeamState, UserProfile } from '../types';
import { ThumbsUp, ThumbsDown, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  candidateTeam: TeamState | null;
  currentUser: UserProfile;
  onVote: (positionIndex: number, isApprove: boolean) => void;
  onClose?: () => void;
}

export const ReviewModal: React.FC<Props> = ({
  isOpen,
  candidateTeam,
  currentUser,
  onVote,
}) => {
  if (!isOpen || !candidateTeam) return null;

  const isOpponent = currentUser.teamId !== candidateTeam.id;
  const completedCells = candidateTeam.cells.filter((c) => c.isCompleted || c.reviewStatus === 'REJECTED');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md max-h-[85dvh] bg-[#FFFDF9] rounded-3xl flex flex-col overflow-hidden shadow-2xl border-4 border-amber-300">
        {/* 상단 헤더 */}
        <div className="p-4 bg-linear-to-r from-amber-100 via-orange-100 to-rose-100 border-b border-orange-200 text-center shrink-0">
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black font-jua mb-1">
            ⚖️ 상대팀 사진 심사 타임!
          </div>
          <h2 className="text-lg font-black text-slate-800 font-jua">
            {candidateTeam.name}의 3줄 빙고 검증
          </h2>
          <p className="text-[11px] text-slate-600 font-semibold mt-0.5">
            {isOpponent
              ? '조건에 맞는 사진인지 보고 [인정 / 노인정]을 투표해주세요! (과반수 3표 시 결정)'
              : '상대팀이 우리 팀의 사진을 심사하고 있습니다... ⏳'}
          </p>
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
                      <CheckCircle className="w-3 h-3" /> 인정 완료
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-jua">
                      심사 진행 중
                    </span>
                  )}
                </div>

                <p className="text-[10px] text-slate-500 mb-2 font-medium">
                  {cell.mission.description}
                </p>

                {/* 등록된 사진 */}
                {cell.photoUrl ? (
                  <div className="w-full aspect-video rounded-xl bg-slate-900 overflow-hidden mb-2 relative shadow-inner">
                    <img
                      src={cell.photoUrl}
                      alt={cell.mission.title}
                      className="w-full h-full object-contain"
                    />
                    {cell.completedBy && (
                      <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.2 rounded font-mono">
                        by {cell.completedBy.toUpperCase()}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="w-full py-4 text-center text-xs text-slate-400 bg-slate-100 rounded-xl mb-2">
                    등록된 사진 없음
                  </div>
                )}

                {/* 투표 현황 및 버튼 */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-black font-jua">
                    <span className="text-emerald-600 flex items-center gap-0.5">
                      <ThumbsUp className="w-3.5 h-3.5" /> {approvedCount}표
                    </span>
                    <span className="text-rose-500 flex items-center gap-0.5">
                      <ThumbsDown className="w-3.5 h-3.5" /> {rejectedCount}표
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
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100'
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
                            : 'bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100'
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
        <div className="p-3 bg-white border-t border-orange-100 text-center shrink-0">
          <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-500">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>상대팀 5명 중 3명 이상이 '노인정' 시 해당 미션은 탈락합니다.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
