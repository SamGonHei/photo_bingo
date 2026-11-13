import React, { useState, useEffect } from 'react';
import type { BingoCell } from '../types';
import { getInkRemainingSeconds } from '../utils/bingo';
import { Lock, Check } from 'lucide-react';

interface Props {
  cell: BingoCell;
  index: number;
  onCellClick: (cell: BingoCell, index: number) => void;
}

export const BingoCard: React.FC<Props> = ({ cell, index, onCellClick }) => {
  const [inkTimer, setInkTimer] = useState<number>(() => getInkRemainingSeconds(cell));

  useEffect(() => {
    if (!cell.inkedUntil) {
      setInkTimer(0);
      return;
    }

    const interval = setInterval(() => {
      const rem = getInkRemainingSeconds(cell);
      setInkTimer(rem);
      if (rem <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [cell.inkedUntil]);

  const isInked = inkTimer > 0;

  const formatInkTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div
      onClick={() => onCellClick(cell, index)}
      className={`relative w-full h-full rounded-xl p-1 flex flex-col items-center justify-between overflow-hidden cursor-pointer select-none transition-all duration-150 active:scale-95 border ${
        isInked
          ? 'bg-slate-900 border-purple-800 text-white shadow-xs'
          : cell.isCompleted
          ? 'bg-amber-50/90 border-amber-400 ring-1 ring-amber-300'
          : 'bg-white hover:bg-orange-50/50 border-orange-200/90'
      }`}
    >
      {/* 1. 먹물 오버레이 */}
      {isInked ? (
        <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-0.5 text-center z-20 animate-ink">
          <div className="text-sm animate-bounce">🦑</div>
          <div className="text-[8px] font-black text-purple-300 font-jua leading-tight">먹물!</div>
          <div className="flex items-center gap-0.5 bg-purple-900 px-1 py-0.2 rounded text-[7.5px] font-mono text-amber-300 mt-0.5">
            <Lock className="w-1.5 h-1.5" />
            <span>{formatInkTime(inkTimer)}</span>
          </div>
        </div>
      ) : null}

      {/* 2. 완료 상태: 사진 + CLEAR 스탬프 */}
      {cell.isCompleted && cell.photoUrl ? (
        <>
          <img
            src={cell.photoUrl}
            alt={cell.mission.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />

          {/* 도장 */}
          <div className="absolute top-0.5 right-0.5 z-10 animate-stamp">
            <div className="w-4 h-4 rounded-full bg-rose-500 text-white border border-white shadow-xs flex items-center justify-center rotate-12">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </div>
          </div>

          <div className="relative z-10 w-full mt-auto px-0.5">
            <div className="text-[8px] font-bold text-white text-center truncate drop-shadow-xs font-jua leading-none">
              {cell.mission.title}
            </div>
            {cell.completedBy && (
              <div className="text-[6.5px] text-amber-300 text-center uppercase tracking-wider font-extrabold mt-0.5 leading-none">
                by {cell.completedBy}
              </div>
            )}
          </div>
        </>
      ) : (
        /* 3. 미완료 상태: 번호 + 이모지 + 미션 타이틀 */
        <>
          <div className="w-full flex items-center justify-start text-[7.5px] text-slate-400 font-bold px-0.5 leading-none">
            <span className="font-mono">#{index + 1}</span>
          </div>

          <div className="text-base sm:text-lg my-auto transform transition-transform group-hover:scale-105 leading-none">
            {cell.mission.emoji}
          </div>

          <div className="w-full text-center px-0.5">
            <div className="text-[8px] sm:text-[9px] font-bold text-slate-800 leading-tight line-clamp-2 font-jua">
              {cell.mission.title}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
