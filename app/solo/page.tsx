"use client";

import { useMemo, useState } from "react";
import Board from "@/components/Board";
import type { Player, Move, BoardArray, RuleMode } from "@/lib/types";
import {
  getForbiddenForUI,
  validateMoveEx,
  checkWin,
  applyMove,
} from "@/lib/judge";

/** 簡單吐司，不再用 alert */
function useToast() {
  const [msg, set] = useState<string | null>(null);
  return {
    toast: (m: string, ms = 1500) => {
      set(m);
      setTimeout(() => set(null), ms);
    },
    node: msg ? <div className="toast">{msg}</div> : null,
  };
}

const SIZE = 15;

export default function SoloPage() {
  const [ruleMode, setRuleMode] = useState<RuleMode>("freestyle");
  const [board, setBoard] = useState<BoardArray>(() =>
    Array.from({ length: SIZE }, () => Array(SIZE).fill(0))
  );
  const [turn, setTurn] = useState<Player>("B");
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [winner, setWinner] = useState<Player | null>(null);
  const { toast, node } = useToast();

  // ✅ 永遠（只要是日規/塔拉）畫出黑棋禁點，不論現在輪到誰
  const forbiddenKeys = useMemo(() => {
    if (winner) return undefined;
    if (!(ruleMode === "renju" || ruleMode === "taraguchi10")) return undefined;
    return getForbiddenForUI(board, ruleMode);
  }, [board, ruleMode, winner]);

  function onPlay(x: number, y: number) {
    if (winner) return;
    // ✅ 本地預檢（即時回饋）
    const chk = validateMoveEx(board, x, y, turn, ruleMode);
    if (!chk.ok) {
      toast(chk.reason || "非法落子");
      return;
    }

    const mv: Move = { x, y, player: turn };
    const next = applyMove(board, mv);
    setBoard(next);
    setLastMove(mv);
    if (checkWin(next, mv, ruleMode)) setWinner(turn);
    else setTurn(turn === "B" ? "W" : "B");
  }

  return (
    <main className="container" style={{ display: "grid", gap: 16 }}>
      <section className="toolbar">
        <label>規則：</label>
        <select
          value={ruleMode}
          onChange={(e) => setRuleMode(e.target.value as RuleMode)}
          className="select"
        >
          <option value="freestyle">普規（連五即勝）</option>
          <option value="renju">日規（黑棋禁手）</option>
          <option value="taraguchi10">塔拉（含禁手）</option>
        </select>
        <div className="status">
          {winner
            ? winner === "B"
              ? "黑勝"
              : "白勝"
            : turn === "B"
            ? "黑方落子"
            : "白方落子"}
        </div>
      </section>

      <div
        className="card"
        style={{ padding: 16, placeItems: "center", display: "grid" }}
      >
        <Board
          size={SIZE}
          board={board}
          lastMove={lastMove}
          winner={winner}
          onPlay={onPlay}
          forbiddenKeys={forbiddenKeys}
        />
      </div>

      {node}
    </main>
  );
}
