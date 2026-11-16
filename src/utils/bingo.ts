import type { BingoCell, Mission } from '../types';

export const BINGO_LINES = [
  // 가로 4줄
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [8, 9, 10, 11],
  [12, 13, 14, 15],
  // 세로 4줄
  [0, 4, 8, 12],
  [1, 5, 9, 13],
  [2, 6, 10, 14],
  [3, 7, 11, 15],
  // 대각선 2줄
  [0, 5, 10, 15],
  [3, 6, 9, 12],
];

// Fisher-Yates 셔플
export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 16개 미션으로 초기 4x4 셀 생성
export function createShuffledCells(missions: Mission[]): BingoCell[] {
  const shuffled = shuffleArray(missions);
  return shuffled.map((mission, index) => ({
    positionIndex: index,
    mission,
    isCompleted: false,
  }));
}

// 빙고 완성 줄 수 계산 (단순 완료 기준)
export function calculateCompletedLines(cells: BingoCell[]): number {
  if (!cells || cells.length !== 16) return 0;
  let count = 0;
  for (const line of BINGO_LINES) {
    const isLineComplete = line.every((index) => cells[index]?.isCompleted);
    if (isLineComplete) {
      count++;
    }
  }
  return count;
}

// 과반수(3표 이상) 인정받은 셀들로만 완성된 줄 수 계산
export function calculateApprovedLines(cells: BingoCell[]): number {
  if (!cells || cells.length !== 16) return 0;
  let count = 0;
  for (const line of BINGO_LINES) {
    const isLineApproved = line.every(
      (index) => cells[index]?.isCompleted && (cells[index]?.approvedUsers?.length ?? 0) >= 3
    );
    if (isLineApproved) {
      count++;
    }
  }
  return count;
}

// 먹물 상태 확인
export function isCellInked(cell?: BingoCell): boolean {
  if (!cell || !cell.inkedUntil) return false;
  return cell.inkedUntil > Date.now();
}

// 먹물 남은 시간 (초)
export function getInkRemainingSeconds(cell?: BingoCell): number {
  if (!isCellInked(cell)) return 0;
  return Math.max(0, Math.ceil((cell!.inkedUntil! - Date.now()) / 1000));
}

// 모바일 사진 고화질 + 비율 보존 + 용량 최적화 리사이즈 (가로/세로 긴 변 기준 800px, 퀄리티 0.75)
export function resizeImage(file: File, maxDimension = 800, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('이미지를 불러올 수 없습니다.'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('파일을 읽는 중 오류가 발생했습니다.'));
    reader.readAsDataURL(file);
  });
}
