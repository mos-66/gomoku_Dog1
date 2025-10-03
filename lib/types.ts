// lib/types.ts

/** 基本型別 */
export type Player = "B" | "W";
export type Role = Player | "S"; // S = Spectator

/** 規則模式：普規 / 日規（黑棋禁手）/ 塔拉（含日規禁手） */
export type RuleMode = "freestyle" | "renju" | "taraguchi10";

/** 棋盤：0=空, 1=黑, 2=白 */
export type BoardArray = number[][];

/** 一步棋 */
export type Move = { x: number; y: number; player: Player };

/**（可選）Taraguchi-10 的開局狀態：目前只為相容保留，之後若要做開局流程可擴充 */
export type OpeningState = {
  mode: "none" | "taraguchi10";
  step: number;
  swapsUsedAtStep: Record<number, true>;
};

/** 日規分析結果（提供 UI 與裁判使用） */
export type RenjuJudge = {
  overline: boolean;           // 長連 (≥6)
  exactFive: boolean;          // 恰五
  fours: number;               // 四 的個數（含連四/沖四，只要一手可成五）
  openThrees: number;          // 活三 的個數（兩個不同點各自可成四）
  forbidden: boolean;          // 是否禁手（黑棋）
  reason?: "overline" | "double-four" | "double-three";
};

/** 房間快照（伺服器對外公用形狀） */
export type PublicRoomState = {
  id: string;
  board: BoardArray;
  size: number;
  turn: Player;
  winner: Player | null;
  lastMove: Move | null;
  ruleMode: RuleMode;
  opening?: OpeningState;
  players: Array<{ name: string; role: Role }>;
  updatedAt: number;
};
