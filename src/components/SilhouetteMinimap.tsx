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
  // 상대팀이 2줄 이상 완성 시 빙고 임박 발동
  const isImminent = opponentTeam.completedLines >= 2;

  return (
    <div
      className={`relative flex flex-col items-center bg-white/95 rounded-xl p-1.5 shadow-2xs transition-all duration-300 ${
        isImminent
          ? 'border-2 border-rose-500 ring-2 ring-rose-400/80 shadow-md shadow-rose-500/20'
          : 'border border-slate-200'
      }`}
    >
      {/* 상대 2줄 시 화내는 말풍선 [빙고 임박!!!] 깜빡이는 스티커 */}
      {isImminent && (
        <div className="absolute -top-3.5 -right-2 z-20 pointer-events-none animate-bounce">
          <div className="relative bg-gradient-to-r from-rose-600 via-red-600 to-rose-500 text-white text-[9.5px] font-black px-2 py-0.5 rounded-lg shadow-lg font-jua border-2 border-white animate-pulse tracking-tight flex items-center gap-1 drop-shadow-md">
            <span className="text-xs">💢</span>
            <span className="whitespace-nowrap">빙고 임박!!!</span>
            {/* 뾰족한 말풍선 꼬리 */}
            <span className="absolute -bottom-1 right-3 w-2 h-2 bg-rose-600 rotate-45 border-r border-b border-white" />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between w-full gap-1 mb-1 px-0.5">
        <span className="text-[9px] font-bold text-slate-500 flex items-center gap-0.5">
          <span>{opponentTeam.badge}</span>
          <span className={isImminent ? 'text-rose-600 font-black' : ''}>
            상대 {opponentTeam.completedLines}줄
          </span>
          {inkedCount > 0 && (
            <span className="text-[8px] font-black text-purple-600 bg-purple-100 px-1 rounded-full animate-pulse">
              🦑 먹물 {inkedCount}
            </span>
          )}
        </span>
        <span
          className={`text-[9px] font-bold px-1 py-0.2 rounded-full ${
            isImminent ? 'bg-rose-100 text-rose-700 font-black' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {completedCount}/16
        </span>
      </div>

      {/* 4x4 미니 그리드 */}
      <div
        className={`grid grid-cols-4 gap-0.5 p-0.5 rounded-md transition-colors ${
          isImminent ? 'bg-rose-50' : 'bg-slate-100'
        }`}
      >
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
                  ? isImminent
                    ? 'bg-rose-500 shadow-2xs scale-105 ring-1 ring-rose-600'
                    : 'bg-amber-400 shadow-2xs scale-105 ring-1 ring-amber-500'
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
