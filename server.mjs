import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// 16개 미션
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

const BINGO_LINES = [
  [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15],
  [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15],
  [0, 5, 10, 15], [3, 6, 9, 12],
];

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createCells() {
  return shuffle(INITIAL_MISSIONS).map((m, idx) => ({
    positionIndex: idx,
    mission: m,
    isCompleted: false,
    reviewStatus: 'PENDING',
    approvedUsers: [],
    rejectedUsers: [],
  }));
}

function calculateLines(cells) {
  let count = 0;
  for (const line of BINGO_LINES) {
    if (line.every((i) => cells[i]?.isCompleted)) count++;
  }
  return count;
}

function getInitialState() {
  return {
    phase: 'WAITING',
    isStarted: false,
    durationSeconds: 7200,
    startTime: null,
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

// 1. 상태 조회
app.get('/api/state', (req, res) => {
  res.json({ success: true, state: gameState });
});

// 2. 게임 시작
app.post('/api/start', (req, res) => {
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
  gameState.messages = [];
  res.json({ success: true, state: gameState });
});

// 3. 사진 등록
app.post('/api/cell', (req, res) => {
  const { teamId, positionIndex, photoUrl, userId } = req.body;
  if (!gameState.isStarted || gameState.phase === 'FINISHED') {
    return res.status(400).json({ success: false, message: '진행 중이 아닙니다.' });
  }

  const team = gameState[teamId];
  if (!team) return res.status(400).json({ success: false });

  team.cells = team.cells.map((cell, idx) => {
    if (idx === positionIndex) {
      return {
        ...cell,
        isCompleted: true,
        photoUrl,
        completedAt: Date.now(),
        completedBy: userId,
        reviewStatus: 'PENDING',
        approvedUsers: [],
        rejectedUsers: [],
      };
    }
    return cell;
  });

  const lines = calculateLines(team.cells);
  team.completedLines = lines;

  // 3줄 달성 시 심사 단계 돌입
  if (lines >= 3 && gameState.phase === 'PLAYING') {
    gameState.phase = 'REVIEWING';
    gameState.candidateTeam = teamId;
  }

  res.json({ success: true, state: gameState });
});

// 4. 스킬: 먹물 투척
app.post('/api/skill/ink', (req, res) => {
  const { attackerTeamId } = req.body;
  const targetTeamId = attackerTeamId === 'teamA' ? 'teamB' : 'teamA';
  const attacker = gameState[attackerTeamId];
  const target = gameState[targetTeamId];

  if (attacker.skills.inkAttack <= 0) {
    return res.status(400).json({ success: false, message: '먹물 투척 소진' });
  }

  const uninked = target.cells
    .map((c, idx) => (!c.inkedUntil || c.inkedUntil <= Date.now() ? idx : -1))
    .filter((i) => i !== -1);

  const chosen = shuffle(uninked).slice(0, 2);
  const inkedUntil = Date.now() + 180 * 1000;

  target.cells = target.cells.map((c, idx) => {
    if (chosen.includes(idx)) {
      return { ...c, inkedUntil };
    }
    return c;
  });

  attacker.skills.inkAttack -= 1;
  res.json({ success: true, state: gameState });
});

// 5. 스킬: 판 흔들기
app.post('/api/skill/shuffle', (req, res) => {
  const { attackerTeamId } = req.body;
  const targetTeamId = attackerTeamId === 'teamA' ? 'teamB' : 'teamA';
  const attacker = gameState[attackerTeamId];
  const target = gameState[targetTeamId];

  if (attacker.skills.shuffleBoard <= 0) {
    return res.status(400).json({ success: false, message: '판 흔들기 소진' });
  }

  target.cells = shuffle(target.cells).map((c, idx) => ({ ...c, positionIndex: idx }));
  target.completedLines = calculateLines(target.cells);
  attacker.skills.shuffleBoard -= 1;

  res.json({ success: true, state: gameState });
});

// 6. 채팅 전송
app.post('/api/chat', (req, res) => {
  const msg = req.body;
  if (!msg || !msg.text) return res.status(400).json({ success: false });
  gameState.messages.push(msg);
  res.json({ success: true, state: gameState });
});

// 7. 심사 투표
app.post('/api/vote', (req, res) => {
  const { positionIndex, isApprove, voterId } = req.body;
  const candidateTeamId = gameState.candidateTeam;
  if (!candidateTeamId) return res.status(400).json({ success: false });

  const team = gameState[candidateTeamId];
  const cell = team.cells[positionIndex];
  if (!cell || !cell.isCompleted) return res.status(400).json({ success: false });

  let approved = (cell.approvedUsers || []).filter((id) => id !== voterId);
  let rejected = (cell.rejectedUsers || []).filter((id) => id !== voterId);

  if (isApprove) approved.push(voterId);
  else rejected.push(voterId);

  let reviewStatus = 'PENDING';
  let isCompleted = cell.isCompleted;

  if (rejected.length >= 3) {
    reviewStatus = 'REJECTED';
    isCompleted = false; // 과반 노인정 시 탈락!
  } else if (approved.length >= 3) {
    reviewStatus = 'APPROVED';
  }

  cell.approvedUsers = approved;
  cell.rejectedUsers = rejected;
  cell.reviewStatus = reviewStatus;
  cell.isCompleted = isCompleted;

  const lines = calculateLines(team.cells);
  team.completedLines = lines;

  if (lines < 3 && rejected.length >= 3) {
    gameState.phase = 'PLAYING'; // 3줄 깨짐 -> 게임 복귀
  } else {
    const completedCells = team.cells.filter((c) => c.isCompleted);
    const allApproved = completedCells.every((c) => (c.approvedUsers?.length ?? 0) >= 3);
    if (allApproved && lines >= 3) {
      gameState.phase = 'FINISHED';
      gameState.winnerTeam = candidateTeamId;
    }
  }

  res.json({ success: true, state: gameState });
});

// 8. 리셋
app.post('/api/reset', (req, res) => {
  gameState = getInitialState();
  res.json({ success: true, state: gameState });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 REST Photo Bingo API Server running on port ${PORT}`);
});
