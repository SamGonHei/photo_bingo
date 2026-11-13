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
      setErrorMsg('아이디를 입력해 주세요! 🐥');
      return;
    }
    if (!VALID_USERS[clean]) {
      setErrorMsg('등록된 멤버 아이디가 아닙니다. 영문 아이디를 확인해주세요!');
      return;
    }
    setErrorMsg('');
    onLogin(clean);
  };

  return (
    <div className="h-dvh h-screen w-full max-w-md mx-auto flex flex-col justify-between bg-gradient-to-b from-[#FFF9ED] via-[#FFF3E0] to-[#FFE8D6] text-slate-800 p-6 overflow-hidden select-none">
      {/* 상단 브랜딩 */}
      <div className="pt-8 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 backdrop-blur-md border border-orange-200/80 text-[11px] font-black text-orange-600 mb-3 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>SWITCHING DAY EVENT</span>
        </div>

        <div className="text-4xl mb-2 animate-bounce">📸✨</div>

        <h1 className="text-2xl font-black tracking-tight text-slate-800 font-jua">
          스위칭 데이 기념 포토빙고
        </h1>

        <p className="text-xs font-black text-rose-500 mt-1 font-jua">
          🎁 승리할 경우 엄청난 경품이..??!?
        </p>
      </div>

      {/* 중앙 귀여운 로그인 카드 */}
      <div className="w-full bg-white/95 backdrop-blur-md border-3 border-orange-200 rounded-3xl p-6 shadow-xl shadow-orange-900/5">
        {expiredNotice && (
          <div className="mb-4 flex items-center gap-2 p-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-500" />
            <span>접속 시간이 3시간을 초과하여 다시 로그인해주세요! ⏰</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-[11px] font-black text-slate-600 mb-1.5 font-jua">
              내 영문 아이디 입력
            </label>
            <input
              type="text"
              value={inputId}
              onChange={(e) => {
                setInputId(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="영문 아이디를 입력하세요 (예: sam)"
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full px-4 py-3.5 rounded-2xl bg-orange-50/50 border-2 border-orange-200 text-slate-800 placeholder-slate-400 text-sm font-bold focus:outline-none focus:border-orange-500 focus:bg-white transition-all shadow-inner"
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-500 font-bold px-1 font-jua">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            className="w-full mt-2 py-4 px-4 rounded-2xl bg-gradient-to-r from-orange-400 via-rose-400 to-amber-400 hover:opacity-95 active:scale-[0.98] text-white font-black text-base tracking-wide shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-all font-jua"
          >
            <span>빙고판 입장하기! 🚀</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* 하단 세션 안내 */}
      <div className="text-center pb-4 text-[11px] text-slate-400 font-semibold">
        로그인 후 3시간 동안 접속이 안전하게 유지됩니다 🔒
      </div>
    </div>
  );
};
