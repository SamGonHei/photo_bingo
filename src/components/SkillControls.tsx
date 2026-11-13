import React from 'react';
import type { TeamState, UserProfile } from '../types';
import { Sparkles, Lock } from 'lucide-react';

interface Props {
  currentUser: UserProfile;
  currentTeam: TeamState;
  isStarted: boolean;
  onUseInkAttack: () => void;
  onUseShuffleBoard: () => void;
}

export const SkillControls: React.FC<Props> = ({
  currentUser,
  currentTeam,
  isStarted,
  onUseInkAttack,
  onUseShuffleBoard,
}) => {
  const inkRemaining = currentTeam.skills.inkAttack;
  const shuffleRemaining = currentTeam.skills.shuffleBoard;
  const canUseSkills = currentUser.isLeader;

  return (
    <div className="w-full bg-linear-to-r from-amber-50/90 via-orange-50/90 to-rose-50/90 border-2 border-orange-200/80 rounded-2xl p-2 my-1 shrink-0 shadow-2xs">
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-[11px] font-black text-slate-700 flex items-center gap-1 font-jua">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>{currentTeam.name}의 방해 스킬</span>
        </span>
        <span className="text-[10px] text-slate-400 font-bold">
          {canUseSkills ? '상대팀의 판을 흔들어보세요!' : '👑 팀장 전용 스킬'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {/* 먹물 투척 */}
        <button
          onClick={onUseInkAttack}
          disabled={!isStarted || inkRemaining <= 0 || !canUseSkills}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-left transition-all ${
            !isStarted || inkRemaining <= 0 || !canUseSkills
              ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
              : 'bg-white border-purple-200 hover:border-purple-300 text-purple-950 active:scale-95 shadow-2xs'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-base shrink-0">🦑</span>
            <div className="truncate">
              <div className="text-[11px] font-black leading-tight flex items-center gap-1 font-jua">
                <span>먹물 투척</span>
                {!canUseSkills && <Lock className="w-2.5 h-2.5 text-slate-400" />}
              </div>
              <div className="text-[9px] text-purple-700/80 leading-none truncate font-sans">
                상대 2칸 3분 차단
              </div>
            </div>
          </div>
          <span
            className={`text-[10px] font-black px-1.5 py-0.2 rounded-md shrink-0 ${
              inkRemaining > 0 && canUseSkills
                ? 'bg-purple-100 text-purple-700'
                : 'bg-slate-200 text-slate-500'
            }`}
          >
            {inkRemaining}/2
          </span>
        </button>

        {/* 판 흔들기 */}
        <button
          onClick={onUseShuffleBoard}
          disabled={!isStarted || shuffleRemaining <= 0 || !canUseSkills}
          className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-left transition-all ${
            !isStarted || shuffleRemaining <= 0 || !canUseSkills
              ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
              : 'bg-white border-blue-200 hover:border-blue-300 text-blue-950 active:scale-95 shadow-2xs'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-base shrink-0">🌪️</span>
            <div className="truncate">
              <div className="text-[11px] font-black leading-tight flex items-center gap-1 font-jua">
                <span>판 흔들기</span>
                {!canUseSkills && <Lock className="w-2.5 h-2.5 text-slate-400" />}
              </div>
              <div className="text-[9px] text-blue-700/80 leading-none truncate font-sans">
                상대 전체 셔플
              </div>
            </div>
          </div>
          <span
            className={`text-[10px] font-black px-1.5 py-0.2 rounded-md shrink-0 ${
              shuffleRemaining > 0 && canUseSkills
                ? 'bg-blue-100 text-blue-700'
                : 'bg-slate-200 text-slate-500'
            }`}
          >
            {shuffleRemaining}/1
          </span>
        </button>
      </div>
    </div>
  );
};
