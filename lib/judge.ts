// lib/judge.ts
import type { BoardArray, Move, Player, RuleMode } from "./types";
import { analyzeRenju } from "./rules";

/* ---------- 工具 ---------- */
function inRange(b: BoardArray, x: number, y: number) {
  return y >= 0 && y < b.length && x >= 0 && x < b[0].length;
}
function valOf(p: Player): 1 | 2 { return p === "B" ? 1 : 2; }

/* ---------- 舊簡易驗證（相容） ---------- */
export function validateMove(board: BoardArray, x: number, y: number): boolean {
  return inRange(board, x, y) && board[y][x] === 0;
}

/* ---------- 進階驗證（含禁手） ---------- */
export function validateMoveEx(
  board: BoardArray,
  x: number,
  y: number,
  player: Player,
  ruleMode: RuleMode
): { ok: boolean; reason?: string } {
  if (!inRange(board, x, y)) return { ok: false, reason: "超出棋盤" };
  if (board[y][x] !== 0) return { ok: false, reason: "已有棋子" };

  // 日規禁手（黑子）
  if ((ruleMode === "renju" || ruleMode === "taraguchi10") && player === "B") {
    const r = analyzeRenju(board, x, y, "B");
    if (r.forbidden) {
      const reason =
        r.reason === "overline" ? "禁手：長連" :
        r.reason === "double-four" ? "禁手：雙四" :
        r.reason === "double-three" ? "禁手：雙三" : "黑子禁手";
      return { ok: false, reason };
    }
  }
  return { ok: true };
}

/* ---------- 寫入棋步（不改原陣列） ---------- */
export function applyMove(board: BoardArray, mv: Move): BoardArray {
  const next = board.map(r => r.slice()) as BoardArray;
  next[mv.y][mv.x] = valOf(mv.player);
  return next;
}

/* ---------- 勝負判定 ---------- */
export function checkWin(board: BoardArray, mv: Move, ruleMode: RuleMode): boolean {
  const { x, y, player } = mv;
  const v = valOf(player);
  const DIRS: ReadonlyArray<readonly [number, number]> = [[1,0],[0,1],[1,1],[1,-1]];

  // 日規：黑子長連不算勝（保險）
  if ((ruleMode === "renju" || ruleMode === "taraguchi10") && player === "B") {
    // 暫放時已檢過，這裡再做一次保險：若長連就不勝
    for (const [dx,dy] of DIRS) {
      let len = 1;
      for (let i=1; inRange(board,x+i*dx,y+i*dy)&&board[y+i*dy][x+i*dx]===v; i++) len++;
      for (let i=1; inRange(board,x-i*dx,y-i*dy)&&board[y-i*dy][x-i*dx]===v; i++) len++;
      if (len >= 6) return false;
    }
  }

  for (const [dx,dy] of DIRS) {
    let len = 1;
    for (let i=1; inRange(board,x+i*dx,y+i*dy)&&board[y+i*dy][x+i*dx]===v; i++) len++;
    for (let i=1; inRange(board,x-i*dx,y-i*dy)&&board[y-i*dy][x-i*dx]===v; i++) len++;
    if (ruleMode === "freestyle") { if (len >= 5) return true; }
    else if (ruleMode === "renju") {
      if (player === "B") { if (len === 5) return true; }
      else { if (len >= 5) return true; }
    } else { // taraguchi10：此處勝負採「恰五或以上皆勝」→ 若你要嚴格恰五可改成 len===5
      if (len >= 5) return true;
    }
  }
  return false;
}

/* ---------- 提供 UI 用：把所有黑棋禁點算出來 ---------- */
export function getForbiddenForUI(board: BoardArray, ruleMode: RuleMode): Set<string> | undefined {
  if (!(ruleMode === "renju" || ruleMode === "taraguchi10")) return undefined;
  const h = board.length, w = board[0].length;
  const set = new Set<string>();
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    if (board[y][x] !== 0) continue;
    const r = analyzeRenju(board, x, y, "B");
    if (r.forbidden) set.add(`${x},${y}`);
  }
  return set;
}
