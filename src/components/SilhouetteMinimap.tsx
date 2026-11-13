import React from 'react';
import type { TeamState } from '../types';

interface Props {
  opponentTeam: TeamState;
}

export const SilhouetteMinimap: React.FC<Props> = ({ opponentTeam }) => {
  const completedCount = opponentTeam.cells.filter((c) => c.isCompleted).length;

  return (
    <div className="flex flex-col items-center bg-white/90 backdrop-blur-xs border-2 border-slate-200 rounded-2xl p-2.5 shadow-sm">
      <div className="flex items-center justify-between w-full gap-2 mb-1.5 px-0.5">
        <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
          <span>{opponentTeam.badge}</span> 상대 실루엣
        </span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
          {completedCount}/16
        </span>
      </div>

      {/* 4x4 미니 그리드 */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg">
        {opponentTeam.cells.map((cell, idx) => (
          <div
            key={idx}
            className={`w-4 h-4 rounded-xs transition-all duration-300 ${
              cell.isCompleted
                ? 'bg-amber-400 shadow-xs scale-105 ring-1 ring-amber-500'
                : 'bg-slate-300/80'
            }`}
            title={cell.isCompleted ? '상대팀 완료 칸' : '미완료 칸'}
          />
        ))}
      </div>

      <div className="text-[10px] font-semibold text-slate-400 mt-1">
        진행: <span className="text-amber-500 font-bold">{opponentTeam.completedLines}줄</span> 완성
      </div>
    </div>
  );
};
