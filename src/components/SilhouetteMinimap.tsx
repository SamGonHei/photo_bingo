import React from 'react';
import type { TeamState } from '../types';

interface Props {
  opponentTeam: TeamState;
}

export const SilhouetteMinimap: React.FC<Props> = ({ opponentTeam }) => {
  const completedCount = opponentTeam.cells.filter((c) => c.isCompleted).length;

  return (
    <div className="flex flex-col items-center bg-white/90 border border-slate-200 rounded-xl p-1.5 shadow-2xs">
      <div className="flex items-center justify-between w-full gap-1 mb-1 px-0.5">
        <span className="text-[9px] font-bold text-slate-500 flex items-center gap-0.5">
          <span>{opponentTeam.badge}</span> 상대 실루엣
        </span>
        <span className="text-[9px] font-bold px-1 py-0.2 rounded-full bg-slate-100 text-slate-600">
          {completedCount}/16
        </span>
      </div>

      {/* 4x4 미니 그리드 */}
      <div className="grid grid-cols-4 gap-0.5 p-0.5 bg-slate-100 rounded-md">
        {opponentTeam.cells.map((cell, idx) => (
          <div
            key={idx}
            className={`w-3 h-3 rounded-2xs transition-all duration-300 ${
              cell.isCompleted
                ? 'bg-amber-400 shadow-2xs scale-105 ring-1 ring-amber-500'
                : 'bg-slate-300/80'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
