import React from 'react';
import type { BingoCell } from '../types';
import { X, CheckCircle2 } from 'lucide-react';

interface Props {
  cell: BingoCell | null;
  cellIndex: number | null;
  isOpen: boolean;
  onClose: () => void;
  onRetake: (index: number) => void;
}

export const PhotoDetailModal: React.FC<Props> = ({
  cell,
  cellIndex,
  isOpen,
  onClose,
  onRetake,
}) => {
  if (!isOpen || !cell || cellIndex === null || !cell.photoUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-4 bg-orange-50/80 border-b border-orange-100">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold text-slate-700 font-jua">
              미션 클리어 #{cellIndex + 1}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="w-full max-h-96 min-h-[260px] bg-slate-950 relative flex items-center justify-center overflow-hidden">
          <img
            src={cell.photoUrl}
            alt={cell.mission.title}
            className="w-full h-full max-h-96 object-contain"
          />
        </div>

        <div className="p-4 text-center">
          <div className="text-sm font-black text-slate-800 font-jua flex items-center justify-center gap-1">
            <span>{cell.mission.emoji}</span>
            <span>{cell.mission.title}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {cell.mission.description}
          </p>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => {
                onClose();
                onRetake(cellIndex);
              }}
              className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
            >
              🔄 다른 사진으로 변경
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 px-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
