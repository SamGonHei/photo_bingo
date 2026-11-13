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
      className={`relative w-full h-full rounded-2xl p-1.5 flex flex-col items-center justify-between overflow-hidden cursor-pointer select-none transition-all duration-200 active:scale-95 shadow-xs border ${
        isInked
          ? 'bg-slate-950 border-purple-800 text-white shadow-md'
          : cell.isCompleted
          ? 'bg-white border-emerald-400 ring-1 ring-emerald-400/30'
          : 'bg-white hover:bg-slate-50 border-slate-200/90'
      }`}
    >
      {/* 1. 먹물 투척 오버레이 */}
      {isInked ? (
        <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-1 text-center z-20 animate-ink">
          <div className="text-xl mb-0.5 animate-bounce">🦑</div>
          <div className="text-[10px] font-black text-purple-300 font-jua">먹물 주의!</div>
          <div className="text-[8px] text-slate-400 mb-1">미션 가림</div>
          <div className="flex items-center gap-0.5 bg-purple-900/90 border border-purple-500/50 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold text-amber-300">
            <Lock className="w-2 h-2" />
            <span>{formatInkTime(inkTimer)}</span>
          </div>
        </div>
      ) : null}

      {/* 2. 완료된 상태: 업로드한 사진 썸네일 & 모던 스탬프 */}
      {cell.isCompleted && cell.photoUrl ? (
        <>
          <img
            src={cell.photoUrl}
            alt={cell.mission.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* 세련된 원형 모던 스탬프 뱃지 */}
          <div className="absolute top-1 right-1 z-10 animate-stamp">
            <div className="w-6 h-6 rounded-full bg-emerald-500/90 backdrop-blur-xs text-white border border-white/80 shadow-md flex items-center justify-center rotate-6">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          </div>

          {/* 하단 미션명 & 업로더 이니셜 */}
          <div className="relative z-10 w-full mt-auto px-0.5">
            <div className="text-[9px] font-bold text-white text-center truncate drop-shadow-sm font-jua">
              {cell.mission.title}
            </div>
            {cell.completedBy && (
              <div className="text-[7px] text-emerald-300 text-center uppercase tracking-wider font-semibold">
                by {cell.completedBy}
              </div>
            )}
          </div>
        </>
      ) : (
        /* 3. 미완료 상태: 미션 번호 + 이모지 + 미션 타이틀 */
        <>
          <div className="w-full flex items-center justify-between text-[8px] text-slate-400 font-bold px-0.5">
            <span className="font-mono">#{index + 1}</span>
            <Camera className="w-2.5 h-2.5 text-slate-400" />
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
