import { useState, useEffect } from 'react';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  teamId: 'teamA' | 'teamB';
  teamName: string;
  isLeader: boolean;
  text: string;
  timestamp: number;
}

const CHAT_STORAGE_KEY = 'photo_bingo_chat_messages_v1';

export function usePhotoBingoChat(gameStartTime?: number) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  // 게임 시작 시각이 바뀌면 채팅 리셋 (게임마다 채팅 리셋 요구사항)
  useEffect(() => {
    if (gameStartTime) {
      try {
        const saved = localStorage.getItem(CHAT_STORAGE_KEY);
        if (saved) {
          const parsed: ChatMessage[] = JSON.parse(saved);
          // 게임 시작 이전 메시지는 필터링 또는 리셋
          const filtered = parsed.filter((m) => m.timestamp >= gameStartTime);
          setMessages(filtered);
          localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(filtered));
        }
      } catch {
        // ignore
      }
    }
  }, [gameStartTime]);

  // 로컬스토리지 저장 및 동기화 (다른 탭/브라우저 storage 이벤트 감지)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === CHAT_STORAGE_KEY && e.newValue) {
        try {
          setMessages(JSON.parse(e.newValue));
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const sendMessage = (
    senderId: string,
    senderName: string,
    teamId: 'teamA' | 'teamB',
    teamName: string,
    isLeader: boolean,
    text: string
  ) => {
    const cleanText = text.trim();
    if (!cleanText) return;

    const newMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      senderId,
      senderName,
      teamId,
      teamName,
      isLeader,
      text: cleanText,
      timestamp: Date.now(),
    };

    setMessages((prev) => {
      const next = [...prev, newMessage];
      try {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(CHAT_STORAGE_KEY);
  };

  return { messages, sendMessage, clearChat };
}
