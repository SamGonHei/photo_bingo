import React from 'react';
import type { TeamState, UserProfile } from '../types';
import { SilhouetteMinimap } from './SilhouetteMinimap';
import { Clock, LogOut, Crown } from 'lucide-react';

interface Props {
  currentUser: UserProfile;
  currentTeam: TeamState;
  opponentTeam: TeamState;
  remainingTime: number;
  isStarted: boolean;
  onLogout: () => void;
}

export const Header: React.FC<Props> = ({
  currentUser,
  currentTeam,
  opponentTeam,
  remainingTime,
  isStarted,
  onLogout,
}) => {
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isTeamA = currentTeam.id === 'teamA';

  return (
    <header className="w-full bg-white/95 border-b border-orange-100 px-2.5 py-1 z-20 shrink-0 shadow-2xs">
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <div className="flex items-center gap-1 truncate">
          <span className="text-xs">📸</span>
          <span className="text-[11px] font-black text-slate-800 font-jua truncate">
            안녕하세요 <span className="text-orange-600 underline decoration-orange-300">{currentUser.name}</span>!
          </span>
          {currentUser.isLeader && (
            <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[8.5px] font-bold font-jua">
              <Crown className="w-2 h-2 text-amber-600" /> 팀장
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded-full bg-orange-100 text-orange-700 font-jua">
            3줄 빙고 승리
          </span>
          <button
            onClick={onLogout}
            title="로그아웃"
            className="p-0.5 rounded text-slate-400 hover:text-rose-500 transition-colors"
          >
            <LogOut className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`text-[10px] font-black px-1.5 py-0.2 rounded-md font-jua text-white shrink-0 ${
              isTeamA ? 'bg-rose-500' : 'bg-amber-500'
            }`}
          >
            {currentTeam.badge} {currentTeam.name}
          </span>
          <span className="text-[10px] font-extrabold text-slate-700 shrink-0">
            <span className="text-orange-600 text-xs font-black font-jua">{currentTeam.completedLines}</span> / 3줄
          </span>

          <div className="inline-flex items-center gap-0.5 bg-orange-50 border border-orange-200/80 px-1.5 py-0.2 rounded w-fit">
            <Clock className={`w-2.5 h-2.5 ${isStarted ? 'text-orange-500 animate-pulse' : 'text-slate-400'}`} />
            <span className="font-mono text-[10px] font-black text-orange-600">
              {formatTime(remainingTime)}
            </span>
          </div>
        </div>

        <div className="shrink-0">
          <SilhouetteMinimap opponentTeam={opponentTeam} />
        </div>
      </div>
    </header>
  );
};
