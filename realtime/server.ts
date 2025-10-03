import type * as Party from "partykit/server";
import { validateMoveEx, checkWin, applyMove } from "../lib/judge";
import type { BoardArray, Move, Player, RuleMode } from "../lib/types";

type Role = Player | "S";

type RoomState = {
  board: BoardArray;
  size: number;
  turn: Player;
  winner: Player | null;
  lastMove: Move | null;
  ruleMode: RuleMode;
  players: Record<string, { name: string; role: Role }>;
};

const BOARD_SIZE = 15;

function createEmptyBoard(size: number): BoardArray {
  return Array.from({ length: size }, () => Array(size).fill(0));
}
function defaultState(): RoomState {
  return {
    board: createEmptyBoard(BOARD_SIZE),
    size: BOARD_SIZE,
    turn: "B",
    winner: null,
    lastMove: null,
    ruleMode: "freestyle",
    players: {},
  };
}

export default class Server implements Party.Server {
  constructor(readonly room: Party.Room) {}

  private async getState(): Promise<RoomState> {
    return (await this.room.storage.get<RoomState>("state")) ?? defaultState();
  }
  private async setState(state: RoomState) {
    await this.room.storage.put("state", state);
  }

  private publicState(s: RoomState) {
    return {
      board: s.board,
      size: s.size,
      turn: s.turn,
      winner: s.winner,
      lastMove: s.lastMove,
      ruleMode: s.ruleMode,
      players: Object.values(s.players).map((p) => ({
        name: p.name,
        role: p.role,
      })),
      updatedAt: Date.now(),
      id: this.room.id,
    };
  }
  private findConnByRole(state: RoomState, role: Player): string | null {
    for (const [id, p] of Object.entries(state.players))
      if (p.role === role) return id;
    return null;
  }
  private async updateRoomsParty() {
    const lobby = this.room.context.parties.rooms.get("lobby");
    const count = this.room.getConnections().length;
    await lobby.fetch({
      method: "POST",
      body: JSON.stringify({
        roomId: this.room.id,
        count,
        updatedAt: Date.now(),
      }),
    });
  }
  private err(conn: Party.Connection, message: string) {
    conn.send(JSON.stringify({ type: "error", message }));
  }
  private sendYouRole(id: string, role: Role) {
    this.room
      .getConnection(id)
      ?.send(JSON.stringify({ type: "you:role", payload: { role } }));
  }
  private async broadcastPlayers() {
    const state = await this.getState();
    const players = Object.values(state.players).map((p) => ({
      name: p.name,
      role: p.role,
    }));
    this.room.broadcast(
      JSON.stringify({ type: "players", payload: { players } })
    );
  }
  private async broadcastYouRoles() {
    const state = await this.getState();
    for (const [id, p] of Object.entries(state.players))
      this.sendYouRole(id, p.role);
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const url = new URL(ctx.request.url);
    const name = url.searchParams.get("name") || "玩家";

    const state = await this.getState();
    state.players[conn.id] = { name, role: "S" };
    await this.setState(state);
    await this.updateRoomsParty();

    conn.send(
      JSON.stringify({
        type: "state",
        payload: this.publicState(state),
        you: { id: conn.id, name, role: "S" as Role },
      })
    );
    this.sendYouRole(conn.id, "S");
    await this.broadcastPlayers();
  }

  async onClose(conn: Party.Connection) {
    const state = await this.getState();
    delete state.players[conn.id];
    if (Object.keys(state.players).length === 0)
      await this.room.storage.delete("state");
    else await this.setState(state);
    await this.updateRoomsParty();
    await this.broadcastPlayers();
  }

  async onMessage(raw: string | ArrayBuffer, sender: Party.Connection) {
    if (typeof raw !== "string") return;
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return this.err(sender, "bad json");
    }

    const state = await this.getState();
    const you = state.players[sender.id];

    switch (msg.type) {
      case "sync:ask": {
        sender.send(
          JSON.stringify({
            type: "state",
            payload: this.publicState(state),
            you: {
              id: sender.id,
              ...(you ?? { name: "玩家", role: "S" as Role }),
            },
          })
        );
        this.sendYouRole(sender.id, you?.role ?? "S");
        break;
      }

      case "move": {
        if (!you) return;
        const { x, y } = msg as { x: number; y: number };
        if (you.role === "S") return this.err(sender, "觀戰者不可落子");
        if (state.winner) return this.err(sender, "對局已結束");
        if (state.turn !== you.role) return this.err(sender, "尚未輪到你");

        // ✅ 強制驗證：日規/塔拉會擋黑棋禁手
        const chk = validateMoveEx(
          state.board,
          x,
          y,
          you.role as Player,
          state.ruleMode
        );
        if (!chk.ok) return this.err(sender, chk.reason || "非法落子");

        const mv: Move = { x, y, player: you.role as Player };
        state.board = applyMove(state.board, mv);
        state.lastMove = mv;

        const win = checkWin(state.board, mv, state.ruleMode);
        if (win) state.winner = mv.player;
        else state.turn = state.turn === "B" ? "W" : "B";

        await this.setState(state);
        this.room.broadcast(
          JSON.stringify({
            type: "move",
            payload: {
              x,
              y,
              player: mv.player,
              turn: state.turn,
              winner: state.winner,
              lastMove: state.lastMove,
            },
          })
        );
        break;
      }

      case "rule:set": {
        if (state.lastMove) return this.err(sender, "已開局，無法更改規則");
        state.ruleMode = msg.rule as RuleMode;
        await this.setState(state);
        this.room.broadcast(
          JSON.stringify({
            type: "rule",
            payload: { ruleMode: state.ruleMode },
          })
        );
        break;
      }

      case "seat:join": {
        if (!you) return;
        const want = (msg.role as Role) ?? "S";
        if (want === "S") return;
        const occupied = this.findConnByRole(state, want);
        if (occupied && occupied !== sender.id)
          return this.err(sender, "該座位已有人");
        you.role = want;
        await this.setState(state);
        await this.broadcastPlayers();
        this.sendYouRole(sender.id, you.role);
        await this.updateRoomsParty();
        break;
      }
      case "seat:leave": {
        if (!you) return;
        if (you.role === "S") return this.err(sender, "你不在任何座位");
        you.role = "S";
        await this.setState(state);
        await this.broadcastPlayers();
        this.sendYouRole(sender.id, "S");
        await this.updateRoomsParty();
        break;
      }

      case "swap:ask": {
        if (!you || (you.role !== "B" && you.role !== "W"))
          return this.err(sender, "你尚未入座");
        const otherRole: Player = you.role === "B" ? "W" : "B";
        const otherId = this.findConnByRole(state, otherRole);
        if (!otherId) return this.err(sender, "另一個座位目前無人");
        this.room
          .getConnection(otherId)
          ?.send(
            JSON.stringify({
              type: "swap:offer",
              payload: { from: sender.id, fromName: you.name },
            })
          );
        break;
      }
      case "swap:accept": {
        if (!you) return;
        const fromId = msg.from as string;
        const peer = state.players[fromId];
        if (!peer) return this.err(sender, "對方已離線");
        if (you.role === "S" || peer.role === "S")
          return this.err(sender, "至少一方非入座狀態");
        const a = you.role as Player,
          b = peer.role as Player;
        peer.role = a;
        you.role = b;
        await this.setState(state);
        await this.broadcastPlayers();
        this.sendYouRole(sender.id, you.role);
        this.sendYouRole(fromId, peer.role);
        this.room.broadcast(
          JSON.stringify({ type: "swap:result", payload: { ok: true } })
        );
        break;
      }
      case "swap:decline": {
        this.room.broadcast(
          JSON.stringify({ type: "swap:result", payload: { ok: false } })
        );
        break;
      }

      case "rematch": {
        const fresh = defaultState();
        fresh.ruleMode = state.ruleMode;
        fresh.players = state.players;
        await this.setState(fresh);
        await this.updateRoomsParty();
        this.room.broadcast(
          JSON.stringify({ type: "state", payload: this.publicState(fresh) })
        );
        await this.broadcastYouRoles();
        break;
      }

      default:
        this.err(sender, "unknown type");
    }
  }

  async onRequest(req: Party.Request) {
    if (req.method === "GET") {
      const state = await this.getState();
      return Response.json(this.publicState(state));
    }
    return new Response("OK");
  }
}
