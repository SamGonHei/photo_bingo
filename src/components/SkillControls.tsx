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
    <div className="w-full bg-linear-to-r from-amber-50/90 via-orange-50/90 to-rose-50/90 border border-orange-200/80 rounded-xl px-2 py-0.5 my-0.5 shrink-0 shadow-2xs flex items-center justify-between gap-1.5">
      <div className="flex items-center gap-1 shrink-0">
        <Sparkles className="w-2.5 h-2.5 text-amber-500" />
        <span className="text-[10px] font-black text-slate-700 font-jua">
          {canUseSkills ? '팀장 스킬' : '방해 스킬'}
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-1 justify-end">
        {/* 먹물 투척 */}
        <button
          onClick={onUseInkAttack}
          disabled={!isStarted || inkRemaining <= 0 || !canUseSkills}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-left transition-all ${
            !isStarted || inkRemaining <= 0 || !canUseSkills
              ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
              : 'bg-white border-purple-200 text-purple-950 active:scale-95 shadow-2xs'
          }`}
        >
          <span className="text-xs">🦑</span>
          <span className="text-[9.5px] font-black font-jua leading-none flex items-center gap-0.5">
            <span>먹물</span>
            {!canUseSkills && <Lock className="w-2 h-2 text-slate-400" />}
          </span>
          <span className="text-[8.5px] font-bold px-1 py-0.2 rounded bg-purple-100 text-purple-700 font-mono">
            {inkRemaining}
          </span>
        </button>

        {/* 판 흔들기 */}
        <button
          onClick={onUseShuffleBoard}
          disabled={!isStarted || shuffleRemaining <= 0 || !canUseSkills}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-left transition-all ${
            !isStarted || shuffleRemaining <= 0 || !canUseSkills
              ? 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
              : 'bg-white border-blue-200 text-blue-950 active:scale-95 shadow-2xs'
          }`}
        >
          <span className="text-xs">🌪️</span>
          <span className="text-[9.5px] font-black font-jua leading-none flex items-center gap-0.5">
            <span>셔플</span>
            {!canUseSkills && <Lock className="w-2 h-2 text-slate-400" />}
          </span>
          <span className="text-[8.5px] font-bold px-1 py-0.2 rounded bg-blue-100 text-blue-700 font-mono">
            {shuffleRemaining}
          </span>
        </button>
      </div>
    </div>
  );
};
