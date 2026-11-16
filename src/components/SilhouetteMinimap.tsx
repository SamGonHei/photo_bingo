import React, { useState, useEffect } from 'react';
import type { TeamState } from '../types';
import { isCellInked } from '../utils/bingo';

interface Props {
  opponentTeam: TeamState;
}

export const SilhouetteMinimap: React.FC<Props> = ({ opponentTeam }) => {
  // 지속시간 만료 시 실시간으로 검은색 먹물이 해제되도록 1초마다 tick
  const [, setTick] = useState(Date.now());

  useEffect(() => {
    const hasInkedCell = opponentTeam.cells.some((c) => isCellInked(c));
    if (!hasInkedCell) return;

    const interval = setInterval(() => {
      setTick(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [opponentTeam.cells]);

  const completedCount = opponentTeam.cells.filter((c) => c.isCompleted).length;
  const inkedCount = opponentTeam.cells.filter((c) => isCellInked(c)).length;

  return (
    <div className="flex flex-col items-center bg-white/90 border border-slate-200 rounded-xl p-1.5 shadow-2xs">
      <div className="flex items-center justify-between w-full gap-1 mb-1 px-0.5">
        <span className="text-[9px] font-bold text-slate-500 flex items-center gap-0.5">
          <span>{opponentTeam.badge}</span> 상대 실루엣
          {inkedCount > 0 && (
            <span className="text-[8px] font-black text-purple-600 bg-purple-100 px-1 rounded-full animate-pulse">
              🦑 먹물 {inkedCount}
            </span>
          )}
        </span>
        <span className="text-[9px] font-bold px-1 py-0.2 rounded-full bg-slate-100 text-slate-600">
          {completedCount}/16
        </span>
      </div>

      {/* 4x4 미니 그리드 */}
      <div className="grid grid-cols-4 gap-0.5 p-0.5 bg-slate-100 rounded-md">
        {opponentTeam.cells.map((cell, idx) => {
          const inked = isCellInked(cell);

          return (
            <div
              key={idx}
              title={inked ? '먹물 적용 중 (검은색)' : cell.isCompleted ? '완료' : '미완료'}
              className={`w-3 h-3 rounded-2xs transition-all duration-300 relative ${
                inked
                  ? 'bg-black ring-1 ring-purple-600 shadow-sm scale-110 z-10 animate-pulse'
                  : cell.isCompleted
                  ? 'bg-amber-400 shadow-2xs scale-105 ring-1 ring-amber-500'
                  : 'bg-slate-300/80'
              }`}
            >
              {inked && (
                <span className="absolute inset-0 flex items-center justify-center text-[7px] leading-none pointer-events-none">
                  🦑
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
