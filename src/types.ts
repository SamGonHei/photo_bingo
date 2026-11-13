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
  photoUrl?: string; // 업로드된 이미지
  completedAt?: number;
  completedBy?: string; // 등록한 유저 id
  inkedUntil?: number; // 먹물 만료 ms
  reviewStatus?: 'PENDING' | 'APPROVED' | 'REJECTED'; // 심사 상태
  approvedUsers?: string[]; // 인정한 상대팀 유저 id 목록
  rejectedUsers?: string[]; // 노인정한 상대팀 유저 id 목록
}

export type TeamId = 'teamA' | 'teamB';
export type GamePhase = 'WAITING' | 'PLAYING' | 'REVIEWING' | 'FINISHED';

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

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  teamId: TeamId;
  teamName: string;
  isLeader: boolean;
  text: string;
  timestamp: number;
}

export interface GameState {
  phase: GamePhase;
  isStarted: boolean;
  startTime?: number | null; // ms
  durationSeconds: number; // 7200초 (2시간)
  winnerTeam?: TeamId | null;
  candidateTeam?: TeamId | null; // 3줄 달성하여 심사받는 팀
  reviewStartTime?: number | null; // 심사 시작 ms (10분 카운트다운용)
  teamA: TeamState;
  teamB: TeamState;
  messages: ChatMessage[];
}
