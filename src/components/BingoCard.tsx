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
      className={`relative w-full h-full rounded-2xl p-1.5 flex flex-col items-center justify-between overflow-hidden cursor-pointer select-none transition-all duration-150 active:scale-95 border-2 shadow-2xs ${
        isInked
          ? 'bg-slate-900 border-purple-800 text-white shadow-xs'
          : cell.isCompleted
          ? 'bg-amber-50/95 border-amber-400 ring-2 ring-amber-300/40'
          : 'bg-white hover:bg-orange-50/50 border-orange-200/90 hover:border-orange-300'
      }`}
    >
      {/* 1. 먹물 오버레이 */}
      {isInked ? (
        <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-1 text-center z-20 animate-ink">
          <div className="text-xl mb-0.5 animate-bounce">🦑</div>
          <div className="text-[10px] font-black text-purple-300 font-jua">먹물 주의!</div>
          <div className="flex items-center gap-1 bg-purple-900 px-1.5 py-0.5 rounded text-[8.5px] font-mono text-amber-300 mt-0.5">
            <Lock className="w-2 h-2" />
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* 도장 */}
          <div className="absolute top-1 right-1 z-10 animate-stamp">
            <div className="w-5 h-5 rounded-full bg-rose-500 text-white border border-white shadow-xs flex items-center justify-center rotate-12">
              <Check className="w-3 h-3 stroke-[3]" />
            </div>
          </div>

          <div className="relative z-10 w-full mt-auto px-0.5">
            <div className="text-[10px] font-black text-white text-center truncate drop-shadow-md font-jua leading-tight">
              {cell.mission.title}
            </div>
            {cell.completedBy && (
              <div className="text-[7.5px] text-amber-300 text-center uppercase tracking-wider font-extrabold mt-0.5 leading-none">
                by {cell.completedBy}
              </div>
            )}
          </div>
        </>
      ) : (
        /* 3. 미완료 상태: 번호 + 이모지 + 또렷하고 예쁜 미션 텍스트 */
        <>
          <div className="w-full flex items-center justify-start text-[8.5px] text-slate-400 font-black px-0.5 leading-none font-mono">
            #{index + 1}
          </div>

          <div className="text-xl sm:text-2xl my-auto transform transition-transform group-hover:scale-110 leading-none">
            {cell.mission.emoji}
          </div>

          <div className="w-full text-center px-0.5">
            <div className="text-xs sm:text-[13px] font-black text-slate-800 leading-snug line-clamp-2 font-jua tracking-tight drop-shadow-2xs">
              {cell.mission.title}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
