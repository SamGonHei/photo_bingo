import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../hooks/usePhotoBingoChat';
import type { UserProfile } from '../types';
import { X, Send, MessageCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  currentUser: UserProfile;
}

export const ChatDrawer: React.FC<Props> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  currentUser,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md mx-auto h-[75dvh] bg-[#FFFDF9] rounded-t-3xl shadow-2xl flex flex-col overflow-hidden border-t-4 border-orange-200 animate-in slide-in-from-bottom duration-200">
        {/* 드로어 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-orange-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
              <MessageCircle className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 font-jua">
                포토빙고 왁자지껄 톡톡 💬
              </h3>
              <p className="text-[10px] text-slate-400 font-semibold">
                게임이 리셋되면 채팅도 초기화됩니다
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 메시지 리스트 */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <span className="text-3xl mb-2">🐥</span>
              <p className="text-xs font-bold text-slate-500 font-jua">
                아직 나눈 대화가 없어요!
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                미션 힌트나 응원을 자유롭게 남겨보세요!
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.senderId === currentUser.id;
              const isTeamA = msg.teamId === 'teamA';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  {/* 발신자 정보 (이름 & 팀 뱃지) */}
                  {!isMine && (
                    <div className="flex items-center gap-1 mb-1 px-1 text-[11px] font-bold text-slate-600 font-jua">
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded-full font-sans text-white ${
                          isTeamA ? 'bg-indigo-500' : 'bg-rose-400'
                        }`}
                      >
                        {isTeamA ? '👑 jackie팀' : '🎀 carol팀'}
                      </span>
                      <span>{msg.senderName}</span>
                    </div>
                  )}

                  {/* 말풍선 */}
                  <div className="flex items-end gap-1.5 max-w-[80%]">
                    {isMine && (
                      <span className="text-[9px] text-slate-400 font-mono shrink-0 mb-0.5">
                        {formatTime(msg.timestamp)}
                      </span>
                    )}

                    <div
                      className={`px-3.5 py-2 rounded-2xl text-xs font-semibold leading-relaxed break-all shadow-2xs ${
                        isMine
                          ? 'bg-orange-500 text-white rounded-br-xs'
                          : 'bg-white border border-orange-100 text-slate-800 rounded-bl-xs'
                      }`}
                    >
                      {msg.text}
                    </div>

                    {!isMine && (
                      <span className="text-[9px] text-slate-400 font-mono shrink-0 mb-0.5">
                        {formatTime(msg.timestamp)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 입력창 */}
        <form
          onSubmit={handleSend}
          className="p-2.5 bg-white border-t border-orange-100 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="메시지를 입력하세요... 💬"
            className="flex-1 px-3.5 py-2.5 rounded-2xl bg-orange-50/60 border border-orange-200/80 text-slate-800 text-xs font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white shadow-md shadow-orange-500/20 active:scale-95 transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
