// components/Board.tsx
import { BoardArray, Move, Player } from "@/lib/types";
import { useMemo, useState } from "react";

type Props = {
  size: number;
  board: BoardArray;           // 0=空, 1=黑, 2=白
  lastMove: Move | null;
  winner: Player | null;
  onPlay: (x: number, y: number) => void;
  /** UI 用：傳入黑棋禁點 Set（key = "x,y"），會在交叉點畫小叉叉 */
  forbiddenKeys?: Set<string>;
};

/** 座標與留白（讓棋盤永遠置中） */
const LABEL_FONT_PX = 18;
const GUTTER_LEFT_PX = 40;
const GUTTER_BOTTOM_PX = 36;
const GUTTER_RIGHT_PX = GUTTER_LEFT_PX;
const GUTTER_TOP_PX = GUTTER_BOTTOM_PX;
const LABEL_OFFSET_X_PX = 25;
const LABEL_OFFSET_Y_PX = 34;

export default function Board({
  size, board, lastMove, winner, onPlay, forbiddenKeys
}: Props) {
  const cellPx = 44;
  const padAround = 14;
  const stoneR = 15;

  const innerLen = cellPx * (size - 1);
  const startX = padAround + GUTTER_LEFT_PX;
  const startY = padAround + GUTTER_TOP_PX;

  const boardW = padAround + GUTTER_LEFT_PX + innerLen + GUTTER_RIGHT_PX + padAround;
  const boardH = padAround + GUTTER_TOP_PX + innerLen + GUTTER_BOTTOM_PX + padAround;

  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  const letters = useMemo(
    () => Array.from({ length: size }, (_, i) => String.fromCharCode(65 + i)),
    [size]
  );
  const numbers = useMemo(() => Array.from({ length: size }, (_, i) => i + 1), [size]);

  function posToPx(x: number, y: number) { return { cx: startX + x * cellPx, cy: startY + y * cellPx }; }

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const ox = e.clientX - rect.left - startX;
    const oy = e.clientY - rect.top - startY;
    const gx = Math.round(ox / cellPx);
    const gy = Math.round(oy / cellPx);
    if (gx < 0 || gy < 0 || gx >= size || gy >= size) { setHover(null); return; }
    if (!winner && board[gy][gx] === 0) setHover({ x: gx, y: gy }); else setHover(null);
  }
  function handleLeave() { setHover(null); }
  function handleClick() {
    if (!hover || winner) return;
    onPlay(hover.x, hover.y);
  }

  return (
    <div
      className="board-root"
      style={{ width: boardW, height: boardH }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={handleClick}
      role="application"
      aria-label="Gomoku Board"
    >
      {/* 棋盤線與座標 */}
      <svg width={boardW} height={boardH} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {/* 外框 */}
        <rect x={startX-1} y={startY-1} width={innerLen+2} height={innerLen+2} fill="none" stroke="var(--grid-bold)" strokeWidth="2" rx="6" />

        {/* 垂直線 */}
        {Array.from({ length: size }, (_, i) => {
          const x = startX + i * cellPx;
          return <line key={`v${i}`} x1={x} y1={startY} x2={x} y2={startY+innerLen} stroke="var(--grid)" strokeWidth="1" />;
        })}
        {/* 水平線 */}
        {Array.from({ length: size }, (_, i) => {
          const y = startY + i * cellPx;
          return <line key={`h${i}`} x1={startX} y1={y} x2={startX+innerLen} y2={y} stroke="var(--grid)" strokeWidth="1" />;
        })}

        {/* 星位（15x15） */}
        {size===15 && [[3,3],[11,3],[3,11],[11,11],[7,7]].map(([gx,gy],idx)=>{
          const {cx,cy}=posToPx(gx,gy);
          return <circle key={idx} cx={cx} cy={cy} r={3.2} fill="var(--star)" />;
        })}

        {/* 下方 A~O */}
        {letters.map((ch,i)=> {
          const {cx}=posToPx(i,0);
          return <text key={`b${i}`} x={cx} y={startY+innerLen+LABEL_OFFSET_Y_PX} textAnchor="middle" fontSize={LABEL_FONT_PX} fill="#4d4d4d">{ch}</text>;
        })}
        {/* 左側 1~15 */}
        {numbers.map((n,i)=> {
          const gy=size-1-i; const {cy}=posToPx(0,gy);
          return <text key={`l${i}`} x={startX-LABEL_OFFSET_X_PX} y={cy+Math.round(LABEL_FONT_PX/3)} textAnchor="end" fontSize={LABEL_FONT_PX} fill="#4d4d4d">{n}</text>;
        })}

        {/* 十字瞄準（淡） */}
        {hover && <>
          <line x1={startX} y1={startY+hover.y*cellPx} x2={startX+innerLen} y2={startY+hover.y*cellPx} stroke="var(--crosshair)" strokeOpacity="0.16" strokeWidth="1" />
          <line x1={startX+hover.x*cellPx} y1={startY} x2={startX+hover.x*cellPx} y2={startY+innerLen} stroke="var(--crosshair)" strokeOpacity="0.16" strokeWidth="1" />
          <circle cx={startX+hover.x*cellPx} cy={startY+hover.y*cellPx} r={4} fill="var(--crosshair)" fillOpacity="0.5" />
        </>}

        {/* 🧡 禁手小叉叉（只畫在空點） */}
        {forbiddenKeys && Array.from(forbiddenKeys).map(key => {
          const [xStr,yStr] = key.split(","); const x=+xStr, y=+yStr;
          if (board[y]?.[x] !== 0) return null;
          const {cx,cy}=posToPx(x,y);
          const r = 7; // 叉叉大小
          return (
            <g key={`fx-${key}`} opacity={0.9}>
              <line x1={cx-r} y1={cy-r} x2={cx+r} y2={cy+r} stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" />
              <line x1={cx+r} y1={cy-r} x2={cx-r} y2={cy+r} stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" />
            </g>
          );
        })}
      </svg>

      {/* 棋子層（可點擊） */}
      {board.flatMap((row, y) =>
        row.map((cell, x) => {
          if (cell === 0) return null;
          const { cx, cy } = posToPx(x, y);
          const isLast = !!(lastMove && lastMove.x === x && lastMove.y === y);
          return (
            <div
              key={`${x}-${y}`}
              className={`stone ${cell===1?"black":"white"} ${isLast?"last":""}`}
              style={{ left: cx - stoneR, top: cy - stoneR, position: "absolute" as const }}
              title={`${cell===1?"黑":"白"} (${x}, ${y})`}
            />
          );
        })
      )}

      {winner && (
        <div className="win-overlay">
          <div>{winner === "B" ? "黑方勝利 🎉" : "白方勝利 🎉"}</div>
        </div>
      )}
    </div>
  );
}
