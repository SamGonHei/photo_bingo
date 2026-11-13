import React, { useState } from 'react';
import { VALID_USERS } from '../utils/auth';
import { Sparkles, ArrowRight, ShieldAlert } from 'lucide-react';

interface Props {
  onLogin: (id: string) => void;
  expiredNotice?: boolean;
}

export const LoginScreen: React.FC<Props> = ({ onLogin, expiredNotice }) => {
  const [inputId, setInputId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputId.trim().toLowerCase();
    if (!clean) {
      setErrorMsg('아이디를 입력해 주세요.');
      return;
    }
    if (!VALID_USERS[clean]) {
      setErrorMsg('등록된 멤버 아이디가 아닙니다. 아래 명단을 확인해주세요.');
      return;
    }
    setErrorMsg('');
    onLogin(clean);
  };

  return (
    <div className="h-dvh w-full max-w-md mx-auto flex flex-col justify-between bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-white p-6 overflow-hidden select-none">
      {/* 상단 브랜딩 */}
      <div className="pt-8 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-semibold text-indigo-300 mb-3 tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>SWITCHING DAY EVENT</span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white font-jua">
          스위칭 데이 기념 포토빙고
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          사내 이벤트 전용 미션 포토빙고 게임
        </p>
      </div>

      {/* 중앙 로그인 카드 */}
      <div className="w-full bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-6 shadow-2xl">
        {expiredNotice && (
          <div className="mb-4 flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-200 text-xs">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
            <span>접속 시간이 3시간을 초과하여 다시 로그인해주세요.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
              ENTER YOUR ID
            </label>
            <input
              type="text"
              value={inputId}
              onChange={(e) => {
                setInputId(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="영문 아이디 (예: sam, jackie)"
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full px-4 py-3.5 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-slate-500 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white/15 transition-all"
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-400 font-medium px-1">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            className="w-full mt-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-rose-500 hover:from-indigo-600 hover:to-rose-600 active:scale-[0.98] text-white font-black text-sm tracking-wide shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all font-jua"
          >
            <span>입장하기</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* 퀵 로그인 칩 */}
        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="text-[10px] font-bold text-slate-400 mb-2 flex items-center justify-between">
            <span>참여 멤버 탭하여 선택</span>
            <span className="text-[9px] text-indigo-300">총 10명</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(VALID_USERS).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setInputId(id);
                  setErrorMsg('');
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  VALID_USERS[id].teamId === 'teamA'
                    ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 hover:bg-indigo-500/30'
                    : 'bg-rose-500/20 text-rose-200 border border-rose-500/30 hover:bg-rose-500/30'
                }`}
              >
                {id}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 하단 룰 안내 */}
      <div className="text-center pb-4 text-[11px] text-slate-500">
        로그인 후 3시간 동안 세션이 유지됩니다.
      </div>
    </div>
  );
};
