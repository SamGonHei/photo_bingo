import React, { useRef, useState } from 'react';
import type { BingoCell } from '../types';
import { resizeImage } from '../utils/bingo';
import { X, Camera, Image as ImageIcon, Loader2 } from 'lucide-react';

interface Props {
  cell: BingoCell | null;
  cellIndex: number | null;
  isOpen: boolean;
  onClose: () => void;
  onPhotoSubmit: (index: number, photoUrl: string) => void;
}

export const PhotoUploadModal: React.FC<Props> = ({
  cell,
  cellIndex,
  isOpen,
  onClose,
  onPhotoSubmit,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !cell || cellIndex === null) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      const resizedBase64 = await resizeImage(file, 800, 0.75);
      onPhotoSubmit(cellIndex, resizedBase64);
      onClose();
    } catch (err) {
      alert('사진을 처리하는 중 문제가 발생했습니다. 다시 시도해 주세요.');
      console.error(err);
    } finally {
      setIsLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border-4 border-orange-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2.5 py-0.5 rounded-full">
            빙고 #{cellIndex + 1} 미션 도전
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center my-5">
          <div className="text-5xl mb-2">{cell.mission.emoji}</div>
          <h3 className="text-lg font-black text-slate-800 font-jua">
            {cell.mission.title}
          </h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            {cell.mission.description}
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            <span className="text-xs font-bold text-slate-600">사진 등록 중... 📸</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 mt-2">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={cameraInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="w-full py-3.5 px-4 bg-orange-500 hover:bg-orange-600 active:scale-98 text-white rounded-2xl font-black text-sm shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-all font-jua"
            >
              <Camera className="w-5 h-5" />
              <span>📷 지금 즉시 사진 찍기</span>
            </button>

            <input
              type="file"
              accept="image/*"
              ref={galleryInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => galleryInputRef.current?.click()}
              className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
            >
              <ImageIcon className="w-4 h-4 text-slate-500" />
              <span>🖼️ 앨범/갤러리에서 선택</span>
            </button>
          </div>
        )}

        <div className="text-center mt-4">
          <span className="text-[11px] text-slate-400">
            조건에 맞는 사진을 등록하면 칸이 완료됩니다!
          </span>
        </div>
      </div>
    </div>
  );
};
