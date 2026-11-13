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
    <header className="w-full bg-white/90 backdrop-blur-md border-b border-slate-100 px-3.5 py-2.5 z-20 shrink-0">
      {/* 1행: 인사말 & 로그아웃 & 타이틀 */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-base">📸</span>
          <span className="text-xs font-black text-slate-800 font-jua truncate">
            안녕하세요 <span className="text-indigo-600 underline decoration-indigo-300 decoration-2">{currentUser.name}</span>!
          </span>
          {currentUser.isLeader && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
              <Crown className="w-2.5 h-2.5" /> 팀장
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100/80">
            3줄 빙고 승리
          </span>
          <button
            onClick={onLogout}
            title="로그아웃"
            className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2행: 현재 팀 정보 & 타이머 & 상대팀 실루엣 미니맵 */}
      <div className="flex items-center justify-between gap-2">
        {/* 내 팀 및 타이머 정보 */}
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-xs font-black px-2 py-0.5 rounded-xl font-jua text-white shadow-xs ${
                isTeamA ? 'bg-indigo-600' : 'bg-rose-500'
              }`}
            >
              {currentTeam.badge} {currentTeam.name}
            </span>
            <span className="text-[11px] font-extrabold text-slate-700">
              <span className="text-indigo-600 text-sm font-black">{currentTeam.completedLines}</span> / 3줄 완성
            </span>
          </div>

          {/* 2시간 타이머 */}
          <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-lg w-fit">
            <Clock className={`w-3 h-3 ${isStarted ? 'text-amber-500 animate-pulse' : 'text-slate-400'}`} />
            <span className="text-[10px] font-semibold text-slate-500">남은 시간</span>
            <span className="font-mono text-xs font-black text-slate-800">
              {formatTime(remainingTime)}
            </span>
          </div>
        </div>

        {/* 우측 상단 상대방 실루엣 미니맵 */}
        <div className="shrink-0">
          <SilhouetteMinimap opponentTeam={opponentTeam} />
        </div>
      </div>
    </header>
  );
};
