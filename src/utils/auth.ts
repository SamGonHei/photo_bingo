import type { UserProfile, TeamId } from '../types';

export const VALID_USERS: Record<
  string,
  { teamId: TeamId; teamName: string; isLeader: boolean; canStartGame: boolean }
> = {
  // A팀 (jackie팀)
  jackie: { teamId: 'teamA', teamName: 'jackie팀', isLeader: true, canStartGame: false },
  hannah: { teamId: 'teamA', teamName: 'jackie팀', isLeader: false, canStartGame: false },
  nicole: { teamId: 'teamA', teamName: 'jackie팀', isLeader: false, canStartGame: false },
  sam: { teamId: 'teamA', teamName: 'jackie팀', isLeader: false, canStartGame: true },
  tori: { teamId: 'teamA', teamName: 'jackie팀', isLeader: false, canStartGame: false },

  // B팀 (carol팀)
  carol: { teamId: 'teamB', teamName: 'carol팀', isLeader: true, canStartGame: false },
  raphaela: { teamId: 'teamB', teamName: 'carol팀', isLeader: false, canStartGame: false },
  popo: { teamId: 'teamB', teamName: 'carol팀', isLeader: false, canStartGame: false },
  lumi: { teamId: 'teamB', teamName: 'carol팀', isLeader: false, canStartGame: false },
  jane: { teamId: 'teamB', teamName: 'carol팀', isLeader: false, canStartGame: false },
};

const SESSION_KEY = 'photo_bingo_user_session_v1';
export const SESSION_DURATION_MS = 3 * 60 * 60 * 1000; // 3시간

export function loginUser(inputId: string): { success: boolean; user?: UserProfile; message?: string } {
  const cleanId = inputId.trim().toLowerCase();
  if (!cleanId) {
    return { success: false, message: '아이디를 입력해 주세요.' };
  }

  const userData = VALID_USERS[cleanId];
  if (!userData) {
    return {
      success: false,
      message: '등록되지 않은 아이디입니다. 사내 명단에 등록된 영문 아이디를 입력해주세요.',
    };
  }

  const user: UserProfile = {
    id: cleanId,
    name: cleanId.toUpperCase(),
    teamId: userData.teamId,
    teamName: userData.teamName,
    isLeader: userData.isLeader,
    canStartGame: userData.canStartGame,
    loginTime: Date.now(),
  };

  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch (e) {
    console.error('Session save error', e);
  }

  return { success: true, user };
}

export function getCurrentUser(): { user: UserProfile | null; isExpired: boolean } {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return { user: null, isExpired: false };

    const user: UserProfile = JSON.parse(raw);
    const elapsed = Date.now() - (user.loginTime || 0);

    if (elapsed > SESSION_DURATION_MS) {
      // 3시간 만료
      localStorage.removeItem(SESSION_KEY);
      return { user: null, isExpired: true };
    }

    return { user, isExpired: false };
  } catch {
    return { user: null, isExpired: false };
  }
}

export function logoutUser(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    console.error('Logout error', e);
  }
}
