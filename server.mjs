import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

const PORT = 3001;

// 16개 미션 기본 데이터
const INITIAL_MISSIONS = [
  { id: 1, title: '8글자인 간판 찍기', description: '띄어쓰기 제외 또는 포함 8글자 간판을 찾아 찰칵!', emoji: '🪧' },
  { id: 2, title: '동물 모양 물건 찍기', description: '동물 모양이 들어간 소품이나 물건 찾아 찰칵!', emoji: '🧸' },
  { id: 3, title: '막내 이니셜 첫글자 물건', description: '우리 팀 막내의 영문 이니셜 첫글자로 시작하는 물건!', emoji: '🔤' },
  { id: 4, title: '팀원 상의 색상 마네킹', description: '팀원 중 한 명의 상의 색상과 똑같은 마네킹 찾기!', emoji: '👗' },
  { id: 5, title: '꽃 사진 찍기', description: '길가나 매장, 화분의 예쁜 꽃 사진 찰칵!', emoji: '🌸' },
  { id: 6, title: '끝자리 900원 물건 찍기', description: '가격표 끝자리가 900원으로 끝나는 상품 찾기!', emoji: '🏷️' },
  { id: 7, title: '영문 전용 간판 찍기', description: '영어로만 적힌 세련된 간판 찾아 찰칵!', emoji: '🔠' },
  { id: 8, title: '소화기 찾아 찍기', description: '안전 제일! 빨간 소화기 찾아서 찰칵!', emoji: '🧯' },
  { id: 9, title: '트로트 가수 찍기', description: '포스터, 앨범, 화면 속 트로트 가수 찰칵!', emoji: '🎤' },
  { id: 10, title: '100만원 이상 물건 찍기', description: '가격표에 100만원 이상이 선명하게 보여야 함!', emoji: '💎' },
  { id: 11, title: '팀원 단체사진 찍기', description: '팀원 다 같이 옹기종기 모여 활짝 단체샷!', emoji: '📸' },
  { id: 12, title: '아날로그 시계 찍기', description: '초침과 분침이 돌아가는 벽시계나 손목시계!', emoji: '⏰' },
  { id: 13, title: '팀원 신발 브랜드 매장', description: '팀원이 신은 신발 브랜드와 동일한 매장 간판!', emoji: '👟' },
  { id: 14, title: '한/영/한자 외 문자 찍기', description: '한국어, 영어, 한자가 아닌 색다른 외국어 글자!', emoji: '🌐' },
  { id: 15, title: '별 모양 찾아서 찍기', description: '간판, 소품, 옷 속 별(★) 모양 찾아 찰칵!', emoji: '⭐' },
  { id: 16, title: '공룡 찾아서 찍기', description: '인형, 그림, 장난감, 표지판 속 공룡 찰칵!', emoji: '🦖' },
];

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createCells() {
  return shuffleArray(INITIAL_MISSIONS).map((m, idx) => ({
    positionIndex: idx,
    mission: m,
    isCompleted: false,
    approvedUsers: [],
    rejectedUsers: [],
    reviewStatus: 'PENDING',
  }));
}

function getInitialState() {
  return {
    phase: 'WAITING',
    isStarted: false,
    durationSeconds: 7200,
    winnerTeam: null,
    candidateTeam: null,
    teamA: {
      id: 'teamA',
      name: 'jackie팀',
      leaderId: 'jackie',
      badge: '👑',
      members: ['jackie', 'hannah', 'nicole', 'sam', 'tori'],
      themeColor: '#4F46E5',
      cells: createCells(),
      completedLines: 0,
      skills: { inkAttack: 2, shuffleBoard: 1 },
    },
    teamB: {
      id: 'teamB',
      name: 'carol팀',
      leaderId: 'carol',
      badge: '🎀',
      members: ['carol', 'raphaela', 'popo', 'lumi', 'jane'],
      themeColor: '#EC4899',
      cells: createCells(),
      completedLines: 0,
      skills: { inkAttack: 2, shuffleBoard: 1 },
    },
    messages: [],
  };
}

let gameState = getInitialState();

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', playersOnline: wss.clients.size }));
});

const wss = new WebSocketServer({ server });

function broadcast(type, payload) {
  const msg = JSON.stringify({ type, payload });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

wss.on('connection', (ws) => {
  // 새 접속자에게 현재 게임 상태 전송
  ws.send(JSON.stringify({ type: 'SYNC_STATE', payload: gameState }));

  ws.on('message', (data) => {
    try {
      const { type, payload } = JSON.parse(data.toString());

      if (type === 'START_GAME') {
        gameState.phase = 'PLAYING';
        gameState.isStarted = true;
        gameState.startTime = Date.now();
        gameState.winnerTeam = null;
        gameState.candidateTeam = null;
        gameState.teamA.cells = createCells();
        gameState.teamB.cells = createCells();
        gameState.teamA.completedLines = 0;
        gameState.teamB.completedLines = 0;
        gameState.teamA.skills = { inkAttack: 2, shuffleBoard: 1 };
        gameState.teamB.skills = { inkAttack: 2, shuffleBoard: 1 };
        gameState.messages = []; // 게임 시작 시 채팅 초기화
        broadcast('SYNC_STATE', gameState);
        broadcast('COUNTDOWN_START', {});
      } else if (type === 'UPDATE_STATE') {
        gameState = { ...gameState, ...payload };
        broadcast('SYNC_STATE', gameState);
      } else if (type === 'SEND_CHAT') {
        gameState.messages.push(payload);
        broadcast('NEW_CHAT', payload);
      } else if (type === 'RESET_GAME') {
        gameState = getInitialState();
        broadcast('SYNC_STATE', gameState);
      }
    } catch (e) {
      console.error('Error handling message:', e);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Realtime Photo Bingo Server running on port ${PORT}`);
});
