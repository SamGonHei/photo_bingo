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
    <div className="w-full h-full min-h-0 flex flex-col justify-center items-center bg-gradient-to-b from-[#FFF9ED] via-[#FFF3E0] to-[#FFE8D6] text-slate-800 p-4 overflow-y-auto select-none">
      <div className="w-full max-w-xs flex flex-col items-center my-auto">
        {/* 상단 브랜딩 */}
        <div className="text-center mb-3">
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/80 border border-orange-200/80 text-[10px] font-black text-orange-600 mb-1.5 shadow-2xs">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>SWITCHING DAY EVENT</span>
          </div>

          <div className="text-3xl mb-1 animate-bounce">📸✨</div>

          <h1 className="text-xl font-black tracking-tight text-slate-800 font-jua">
            스위칭 데이 기념 포토빙고
          </h1>

          <p className="text-[11px] font-black text-rose-500 mt-0.5 font-jua">
            🎁 승리할 경우 엄청난 경품이..??!?
          </p>
        </div>

        {/* 중앙 로그인 카드 */}
        <div className="w-full bg-white/95 border-2 border-orange-200 rounded-2xl p-4 shadow-lg shadow-orange-900/5">
          {expiredNotice && (
            <div className="mb-3 flex items-center gap-1.5 p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-500" />
              <span>접속 시간이 3시간을 초과하여 다시 로그인해주세요!</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
            <div>
              <label className="block text-[10px] font-black text-slate-600 mb-1 font-jua">
                내 영문 아이디 입력
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
                className="w-full px-3 py-2.5 rounded-xl bg-orange-50/50 border border-orange-200 text-slate-800 placeholder-slate-400 text-xs font-bold focus:outline-none focus:border-orange-500 focus:bg-white transition-all shadow-inner"
              />
            </div>

            {errorMsg && (
              <p className="text-[11px] text-rose-500 font-bold px-0.5 font-jua">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              className="w-full mt-1 py-3 px-3 rounded-xl bg-gradient-to-r from-orange-400 via-rose-400 to-amber-400 hover:opacity-95 active:scale-98 text-white font-black text-sm tracking-wide shadow-md shadow-orange-500/25 flex items-center justify-center gap-1.5 transition-all font-jua"
            >
              <span>빙고판 입장하기! 🚀</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* 하단 세션 안내 */}
        <div className="text-center mt-3 text-[10px] text-slate-400 font-semibold">
          로그인 후 3시간 동안 접속이 유지됩니다 🔒
        </div>
      </div>
    </div>
  );
};
