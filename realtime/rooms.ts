// realtime/rooms.ts
import type * as Party from "partykit/server";

type RoomInfo = { id: string; count: number; updatedAt: number };

const STALE_MS = 30_000; // 30 秒內沒更新就視為過期

export default class Rooms implements Party.Server {
  constructor(readonly room: Party.Room) {}

  async onStart() {
    const data = (await this.room.storage.get<Record<string, RoomInfo>>("rooms")) || {};
    await this.room.storage.put("rooms", data);
  }

  async onRequest(req: Party.Request) {
    const rooms = (await this.room.storage.get<Record<string, RoomInfo>>("rooms")) || {};
    const now = Date.now();

    // 清掉過期資料
    for (const key of Object.keys(rooms)) {
      const r = rooms[key];
      if (!r || now - r.updatedAt > STALE_MS || r.count <= 0) {
        delete rooms[key];
      }
    }

    if (req.method === "POST") {
      const { roomId, count, updatedAt } = (await req.json()) as {
        roomId: string; count: number; updatedAt?: number;
      };
      if (!roomId) return new Response("roomId required", { status: 400 });

      if (count <= 0) {
        delete rooms[roomId];
      } else {
        rooms[roomId] = {
          id: roomId,
          count,
          updatedAt: updatedAt ?? now,
        };
      }

      await this.room.storage.put("rooms", rooms);
      return Response.json({ ok: true });
    }

    // GET：回傳活躍房間（已去除過期/無人）
    return Response.json(Object.values(rooms));
  }
}
