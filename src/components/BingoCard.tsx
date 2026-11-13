import React, { useState, useEffect } from 'react';
import type { BingoCell } from '../types';
import { getInkRemainingSeconds } from '../utils/bingo';
import { Lock, Camera, Check } from 'lucide-react';

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
      const remaining = getInkRemainingSeconds(cell);
      setInkTimer(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
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
      className={`relative w-full h-full rounded-2xl p-1.5 flex flex-col items-center justify-between overflow-hidden cursor-pointer select-none transition-all duration-200 active:scale-95 shadow-xs border-2 ${
        isInked
          ? 'bg-slate-900 border-purple-800 text-white shadow-md'
          : cell.isCompleted
          ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-300/40'
          : 'bg-white hover:bg-orange-50/60 border-orange-200/80 hover:border-orange-300'
      }`}
    >
      {/* 1. 먹물 투척 오버레이 */}
      {isInked ? (
        <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-1 text-center z-20 animate-ink">
          <div className="text-xl mb-0.5 animate-bounce">🦑</div>
          <div className="text-[10px] font-black text-purple-300 font-jua">먹물 주의!</div>
          <div className="text-[8px] text-slate-400 mb-0.5">미션 가림</div>
          <div className="flex items-center gap-0.5 bg-purple-900/90 border border-purple-500/50 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold text-amber-300">
            <Lock className="w-2 h-2" />
            <span>{formatInkTime(inkTimer)}</span>
          </div>
        </div>
      ) : null}

      {/* 2. 완료된 상태: 업로드한 사진 썸네일 & 귀여운 도장 */}
      {cell.isCompleted && cell.photoUrl ? (
        <>
          <img
            src={cell.photoUrl}
            alt={cell.mission.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />

          {/* 도장 쾅! 귀여운 스탬프 */}
          <div className="absolute top-1 right-1 z-10 animate-stamp">
            <div className="w-6 h-6 rounded-full bg-rose-500/95 backdrop-blur-xs text-white border border-white shadow-md flex items-center justify-center rotate-12">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          </div>

          <div className="relative z-10 w-full mt-auto px-0.5">
            <div className="text-[9.5px] font-bold text-white text-center truncate drop-shadow-sm font-jua">
              {cell.mission.title}
            </div>
            {cell.completedBy && (
              <div className="text-[7.5px] text-amber-300 text-center uppercase tracking-wider font-extrabold">
                by {cell.completedBy}
              </div>
            )}
          </div>
        </>
      ) : (
        /* 3. 미완료 상태: 미션 번호 + 귀여운 이모지 + 미션 타이틀 */
        <>
          <div className="w-full flex items-center justify-between text-[8.5px] text-slate-400 font-bold px-0.5">
            <span className="font-mono">#{index + 1}</span>
            <Camera className="w-2.5 h-2.5 text-orange-300" />
          </div>

          <div className="text-xl my-auto transform transition-transform group-hover:scale-110">
            {cell.mission.emoji}
          </div>

          <div className="w-full text-center px-0.5">
            <div className="text-[9.5px] font-bold text-slate-800 leading-tight line-clamp-2 font-jua">
              {cell.mission.title}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
