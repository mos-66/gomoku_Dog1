// lib/rules.ts
import type { BoardArray, Player, RenjuJudge } from "./types";

const DIRS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const;

function inRange(b: BoardArray, x: number, y: number) {
  return y >= 0 && y < b.length && x >= 0 && x < b[0].length;
}
function get(b: BoardArray, x: number, y: number): 0 | 1 | 2 | 3 {
  return inRange(b, x, y) ? (b[y][x] as 0 | 1 | 2) : 3; // 3 當作牆
}
function stoneOf(p: Player): 1 | 2 {
  return p === "B" ? 1 : 2;
}
function oppOf(p: Player): 1 | 2 {
  return p === "B" ? 2 : 1;
}

function contiguousLen(
  b: BoardArray,
  x: number,
  y: number,
  p: Player,
  dx: number,
  dy: number
) {
  const S = stoneOf(p);
  let cnt = 1;
  for (let i = 1; get(b, x + i * dx, y + i * dy) === S; i++) cnt++;
  for (let i = 1; get(b, x - i * dx, y - i * dy) === S; i++) cnt++;
  return cnt;
}

// 以 (x,y) 為中心取長度 9 視窗：'.'=空, 'x'=己, 'o'=敵, '|'=邊界
function line9(b: BoardArray, x: number, y: number, p: Player, dx: number, dy: number) {
  const me = stoneOf(p), op = oppOf(p);
  let s = "";
  for (let k = -4; k <= 4; k++) {
    const v = get(b, x + k * dx, y + k * dy);
    if (v === 0) s += ".";
    else if (v === me) s += "x";
    else if (v === op) s += "o";
    else s += "|";
  }
  return s;
}
function injectCenterAsX(s: string) {
  return s.slice(0, 4) + "x" + s.slice(5);
}

function calcFiveOverline(b: BoardArray, x: number, y: number, p: Player) {
  let exactFive = false, overline = false;
  for (const [dx, dy] of DIRS) {
    const len = contiguousLen(b, x, y, p, dx, dy);
    if (len === 5) exactFive = true;
    if (len >= 6) overline = true;
  }
  return { exactFive, overline };
}

function countFoursAndOpenThrees(b: BoardArray, x: number, y: number, p: Player) {
  let fours = 0, openThrees = 0;
  for (const [dx, dy] of DIRS) {
    const s = injectCenterAsX(line9(b, x, y, p, dx, dy));
    for (let i = 0; i <= 4; i++) {
      const seg = s.slice(i, i + 5);
      if (seg.includes("o") || seg.includes("|")) continue;
      const xs = [...seg].filter(c => c === "x").length;
      const ds = [...seg].filter(c => c === ".").length;

      // 四：xxxx. / .xxxx / xxx.x / xx.xx
      if (xs === 4 && ds === 1) { fours++; continue; }

      // 活三：3x + 2. 且兩個不同 '.' 各自填入都會變四
      if (xs === 3 && ds === 2) {
        const empties: number[] = [];
        for (let k = 0; k < 5; k++) if (seg[k] === ".") empties.push(k);
        let able = 0;
        for (const e of empties) {
          const cand = seg.slice(0, e) + "x" + seg.slice(e + 1);
          const xs2 = [...cand].filter(c => c === "x").length;
          const ds2 = [...cand].filter(c => c === ".").length;
          if (xs2 === 4 && ds2 === 0) able++;
        }
        if (able >= 2) openThrees++;
      }
    }
  }
  return { fours, openThrees };
}

/** 黑子日規禁手分析（白子不受限） */
export function analyzeRenju(board: BoardArray, x: number, y: number, p: Player): RenjuJudge {
  if (!inRange(board, x, y) || board[y][x] !== 0) {
    return { overline: false, exactFive: false, fours: 0, openThrees: 0, forbidden: true };
  }
  const S = stoneOf(p);
  board[y][x] = S;

  const { exactFive, overline } = calcFiveOverline(board, x, y, p);
  const { fours, openThrees } = countFoursAndOpenThrees(board, x, y, p);

  board[y][x] = 0;

  if (p === "B") {
    if (overline) return { overline, exactFive, fours, openThrees, forbidden: true, reason: "overline" };
    if (exactFive) return { overline, exactFive, fours, openThrees, forbidden: false };
    if (fours >= 2) return { overline, exactFive, fours, openThrees, forbidden: true, reason: "double-four" };
    if (openThrees >= 2) return { overline, exactFive, fours, openThrees, forbidden: true, reason: "double-three" };
  }
  return { overline, exactFive, fours, openThrees, forbidden: false };
}
