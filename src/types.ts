export interface Mission {
  id: number;
  title: string;
  description: string;
  emoji: string;
}

export interface BingoCell {
  positionIndex: number; // 0 ~ 15
  mission: Mission;
  isCompleted: boolean;
  photoUrl?: string; // 업로드된 이미지 Data URL
  completedAt?: number;
  completedBy?: string; // 업로드한 유저 ID
  inkedUntil?: number; // 먹물 투척 만료 타임스탬프 (ms)
}

export type TeamId = 'teamA' | 'teamB';

export interface UserProfile {
  id: string; // 소문자 (예: 'sam')
  name: string; // 대문자 표시용 (예: 'SAM')
  teamId: TeamId;
  teamName: string; // 'jackie팀' | 'carol팀'
  isLeader: boolean; // 팀장 여부
  canStartGame: boolean; // 게임 시작 권한 (sam만 true)
  loginTime: number; // ms
}

export interface TeamState {
  id: TeamId;
  name: string; // 'jackie팀' | 'carol팀'
  leaderId: string;
  badge: string;
  members: string[];
  themeColor: string;
  cells: BingoCell[];
  completedLines: number;
  skills: {
    inkAttack: number; // 최대 2회
    shuffleBoard: number; // 최대 1회
  };
}

export interface GameState {
  isStarted: boolean;
  startTime?: number; // ms
  durationSeconds: number; // 7200초 (2시간)
  winnerTeam?: TeamId | null;
  teamA: TeamState;
  teamB: TeamState;
}
