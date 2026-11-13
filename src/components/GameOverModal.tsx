import React from 'react';
import type { TeamState } from '../types';
import { RotateCcw } from 'lucide-react';

interface Props {
  winnerTeam: 'teamA' | 'teamB' | null;
  teamA: TeamState;
  teamB: TeamState;
  isOpen: boolean;
  onRestart: () => void;
}

export const GameOverModal: React.FC<Props> = ({
  winnerTeam,
  teamA,
  teamB,
  isOpen,
  onRestart,
}) => {
  if (!isOpen || !winnerTeam) return null;

  const winner = winnerTeam === 'teamA' ? teamA : teamB;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 text-center shadow-2xl border-4 border-amber-300 animate-in zoom-in-90 duration-300">
        <div className="relative inline-block mb-3">
          <div className="text-6xl animate-bounce">🏆</div>
        </div>

        <span className="inline-block text-xs font-black px-3 py-1 bg-amber-100 text-amber-800 rounded-full mb-1">
          BINGO 3줄 선착순 달성!
        </span>

        <h2 className="text-2xl font-black text-slate-800 font-jua mt-1">
          게임 종료!
        </h2>

        <div className="my-5 p-4 rounded-2xl bg-amber-50 border-2 border-amber-200">
          <div className="text-4xl mb-1">{winner.badge}</div>
          <div className="text-xl font-black text-slate-900 font-jua">
            {winner.name} 최종 승리! 🎉
          </div>
          <p className="text-xs text-slate-600 mt-1 font-semibold">
            먼저 3줄 빙고를 완성하여 게임에서 승리했습니다!
          </p>
        </div>

        <button
          onClick={onRestart}
          className="w-full py-3.5 px-4 bg-linear-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl font-black text-base shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 font-jua active:scale-98 transition-all"
        >
          <RotateCcw className="w-5 h-5" />
          <span>새 게임 시작하기</span>
        </button>
      </div>
    </div>
  );
};
