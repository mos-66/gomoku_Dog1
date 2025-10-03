"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Board from "@/components/Board";
import type { Player, Move, BoardArray, RuleMode } from "@/lib/types";
import { getForbiddenForUI, validateMoveEx } from "@/lib/judge";
import PartySocket from "partysocket";

type Role = Player | "S";
const BOARD_SIZE = 15;

const RAW_HOST =
  process.env.NEXT_PUBLIC_PARTYKIT_HOST ||
  (typeof location !== "undefined" ? location.host : "");
const host = RAW_HOST.startsWith("http")
  ? RAW_HOST.replace(/^https?:\/\//, "")
  : RAW_HOST;

/** 簡單吐司 */
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

type ServerState = {
  id: string;
  board: BoardArray;
  size: number;
  turn: Player;
  winner: Player | null;
  lastMove: Move | null;
  ruleMode: RuleMode;
  players: Array<{ name: string; role: Role }>;
  updatedAt: number;
};

export default function RoomPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const roomId = params?.id!;
  const name = search?.get("name") || "玩家";

  const [ruleMode, setRuleMode] = useState<RuleMode>("freestyle");
  const [board, setBoard] = useState<BoardArray>(() =>
    Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0))
  );
  const [turn, setTurn] = useState<Player>("B");
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [winner, setWinner] = useState<Player | null>(null);

  const [yourRole, setYourRole] = useState<Role>("S");
  const [players, setPlayers] = useState<Array<{ name: string; role: Role }>>(
    []
  );

  const [connState, setConnState] = useState<"connecting" | "open" | "closed">(
    "connecting"
  );
  const { toast, node } = useToast();

  const [swapOffer, setSwapOffer] = useState<{
    from: string;
    fromName: string;
  } | null>(null);
  const socketRef = useRef<PartySocket | null>(null);

  useEffect(() => {
    const isLocal = host.includes("127.0.0.1") || host.includes("localhost");
    const s = new PartySocket({
      host,
      room: roomId,
      // @ts-expect-error protocol is supported by partysocket
      protocol: isLocal ? "ws" : "wss",
      query: { name },
    });
    socketRef.current = s;

    const onOpen = () => {
      setConnState("open");
      s.send(JSON.stringify({ type: "sync:ask" }));
    };
    const onMessage = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data);
        switch (msg.type) {
          case "state": {
            const st = msg.payload as ServerState;
            setBoard(st.board);
            setTurn(st.turn);
            setWinner(st.winner);
            setLastMove(st.lastMove);
            setRuleMode(st.ruleMode);
            setPlayers(st.players);
            if (msg.you?.role) setYourRole(msg.you.role as Role);
            break;
          }
          case "you:role":
            setYourRole((msg.payload?.role as Role) ?? "S");
            break;
          case "players":
            setPlayers((msg.payload?.players as any) || []);
            break;
          case "move": {
            const { x, y, player, turn, winner, lastMove } = msg.payload;
            setBoard((prev) => {
              const c = prev.map((r) => r.slice());
              c[y][x] = player === "B" ? 1 : 2;
              return c;
            });
            setTurn(turn);
            setWinner(winner);
            setLastMove(lastMove);
            break;
          }
          case "rule":
            setRuleMode(msg.payload.ruleMode as RuleMode);
            break;
          case "swap:offer":
            setSwapOffer({
              from: msg.payload.from,
              fromName: msg.payload.fromName,
            });
            break;
          case "swap:result":
            setSwapOffer(null);
            break;
          case "error":
            toast(msg.message || "發生錯誤");
            break;
        }
      } catch {}
    };
    const onError = () => {
      setConnState("closed");
      toast("WebSocket 連線失敗，請確認 1999 是否公開與 .env 設定");
    };
    const onClose = () => setConnState("closed");

    s.addEventListener("open", onOpen);
    s.addEventListener("message", onMessage);
    s.addEventListener("error", onError as any);
    s.addEventListener("close", onClose);
    return () => {
      s.removeEventListener("open", onOpen);
      s.removeEventListener("message", onMessage);
      s.removeEventListener("error", onError as any);
      s.removeEventListener("close", onClose);
      s.close();
    };
  }, [roomId, name]);

  const statusText = useMemo(() => {
    if (connState !== "open")
      return connState === "connecting" ? "連線中…" : "已離線";
    if (winner) return winner === "B" ? "黑方勝利 🎉" : "白方勝利 🎉";
    return turn === "B" ? "黑方落子" : "白方落子";
  }, [connState, turn, winner]);

  // ✅ 永遠（只要是日規/塔拉）畫出黑棋禁點，不論現在輪到誰
  const forbiddenKeys = useMemo(() => {
    if (winner) return undefined;
    if (!(ruleMode === "renju" || ruleMode === "taraguchi10")) return undefined;
    return getForbiddenForUI(board, ruleMode);
  }, [board, ruleMode, winner]);

  // ───────── actions ─────────
  function handleCellClick(x: number, y: number) {
    if (!socketRef.current || connState !== "open") return;
    if (winner) return;
    if (yourRole === "S") return toast("你目前是觀戰者");
    if (yourRole !== turn) return toast("還沒輪到你");

    // ✅ 本地預檢：先攔截禁手（更直覺）
    const chk = validateMoveEx(board, x, y, yourRole as Player, ruleMode);
    if (!chk.ok) {
      toast(chk.reason!);
      return;
    }

    socketRef.current.send(JSON.stringify({ type: "move", x, y }));
  }

  function backHome() {
    router.push("/");
  }
  function sit(role: Player) {
    socketRef.current?.send(JSON.stringify({ type: "seat:join", role }));
  }
  function leaveSeat() {
    socketRef.current?.send(JSON.stringify({ type: "seat:leave" }));
  }
  function askSwap() {
    socketRef.current?.send(JSON.stringify({ type: "swap:ask" }));
  }
  function acceptSwap() {
    socketRef.current?.send(
      JSON.stringify({ type: "swap:accept", from: swapOffer?.from })
    );
    setSwapOffer(null);
  }
  function declineSwap() {
    socketRef.current?.send(JSON.stringify({ type: "swap:decline" }));
    setSwapOffer(null);
  }
  function rematch() {
    socketRef.current?.send(JSON.stringify({ type: "rematch" }));
  }

  const blackName = players.find((p) => p.role === "B")?.name || "（空）";
  const whiteName = players.find((p) => p.role === "W")?.name || "（空）";
  const bothSeated = blackName !== "（空）" && whiteName !== "（空）";
  const canAskSwap = (yourRole === "B" || yourRole === "W") && bothSeated;
  const canLeave = yourRole === "B" || yourRole === "W";

  return (
    <main className="container" style={{ display: "grid", gap: 16 }}>
      {/* 頂部列 */}
      <header
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ margin: 0 }}>對戰模式</h1>
        <span>房間：{roomId}</span>
        <span>
          你是：{yourRole === "B" ? "黑子" : yourRole === "W" ? "白子" : "觀戰"}
        </span>
        <span
          title={`WebSocket host: ${host}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginLeft: 8,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 9999,
              background:
                connState === "open"
                  ? "#22c55e"
                  : connState === "connecting"
                  ? "#f59e0b"
                  : "#ef4444",
              border: "1px solid rgba(255,255,255,0.25)",
            }}
          />
          <small style={{ opacity: 0.8 }}>
            {connState === "open"
              ? "已連線"
              : connState === "connecting"
              ? "連線中"
              : "離線"}
          </small>
        </span>
        <div style={{ marginLeft: "auto" }}>
          <button onClick={backHome} className="btn">
            回主畫面
          </button>
        </div>
      </header>

      {/* 座位區（略，保持原樣） */}
      <section
        className="card"
        style={{ padding: 16, display: "grid", gap: 12 }}
      >
        <h3 style={{ margin: 0 }}>座位</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          <div
            className="card"
            style={{ padding: 12, border: "1px solid var(--border)" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <span
                className="stone black"
                aria-hidden
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 9999,
                  display: "inline-block",
                }}
              />
              <strong>黑子（先手）</strong>
            </div>
            <div style={{ opacity: 0.9, marginBottom: 8 }}>{blackName}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="btn"
                onClick={() => sit("B")}
                disabled={yourRole === "B"}
              >
                坐黑子
              </button>
              <button className="btn" onClick={leaveSeat} disabled={!canLeave}>
                離開座位
              </button>
            </div>
          </div>

          <div
            className="card"
            style={{ padding: 12, border: "1px solid var(--border)" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <span
                className="stone white"
                aria-hidden
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 9999,
                  display: "inline-block",
                  background: "#e9edf5",
                }}
              />
              <strong>白子</strong>
            </div>
            <div style={{ opacity: 0.9, marginBottom: 8 }}>{whiteName}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="btn"
                onClick={() => sit("W")}
                disabled={yourRole === "W"}
              >
                坐白子
              </button>
              <button className="btn" onClick={leaveSeat} disabled={!canLeave}>
                離開座位
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={askSwap} disabled={!canAskSwap}>
            詢問是否換座位
          </button>
          {winner && (
            <button className="btn" onClick={rematch}>
              再拚一次
            </button>
          )}
        </div>

        {swapOffer && (
          <div
            className="card"
            style={{ padding: 10, border: "1px solid var(--border)" }}
          >
            <span style={{ marginRight: 12 }}>
              {swapOffer.fromName} 希望與你交換座位，是否同意？
            </span>
            <button
              className="btn"
              onClick={acceptSwap}
              style={{ marginRight: 8 }}
            >
              同意
            </button>
            <button className="btn" onClick={declineSwap}>
              拒絕
            </button>
          </div>
        )}
      </section>

      {/* 工具列（可切換規則；會同步到伺服器） */}
      <section className="toolbar">
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label>規則：</label>
          <select
            value={ruleMode}
            onChange={(e) => {
              const next = e.target.value as RuleMode;
              setRuleMode(next);
              socketRef.current?.send(
                JSON.stringify({ type: "rule:set", rule: next })
              );
            }}
            className="select"
          >
            <option value="freestyle">普規（連五即勝）</option>
            <option value="renju">日規（黑棋禁手）</option>
            <option value="taraguchi10">塔拉（含禁手）</option>
          </select>
        </div>
        <div className="status">{statusText}</div>
      </section>

      {/* 棋盤 */}
      <div
        className="card"
        style={{ padding: 16, display: "grid", placeItems: "center" }}
      >
        <Board
          size={BOARD_SIZE}
          board={board}
          lastMove={lastMove}
          winner={winner}
          onPlay={handleCellClick}
          forbiddenKeys={forbiddenKeys}
        />
      </div>

      <p className="hint">
        已連線主機：<code>{host}</code>
      </p>
      {node}
    </main>
  );
}
