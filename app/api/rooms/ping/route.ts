// app/api/rooms/ping/route.ts
// 用途：在使用者按下「進入 / 建立 房間」時，先把房間登錄到 rooms 清單，讓大廳即刻顯示。
// 注意：真正連線後會由 server.ts 以實際人數覆蓋更新。

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { roomId } = (await req.json().catch(() => ({}))) as {
    roomId?: string;
  };
  if (!roomId)
    return Response.json({ error: "roomId required" }, { status: 400 });

  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:1999";
  const isLocal = host.includes("127.0.0.1") || host.includes("localhost");
  const base = isLocal ? `http://${host}` : `https://${host}`;
  const url = `${base}/parties/rooms/lobby`;

  try {
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify({ roomId, count: 1, updatedAt: Date.now() }),
      headers: { "content-type": "application/json" },
    });
    if (!res.ok) {
      return Response.json(
        { error: `rooms ping failed: ${res.status}` },
        { status: 502 }
      );
    }
    const data = await res.json();
    return Response.json({ ok: true, data });
  } catch (e: any) {
    return Response.json(
      { error: e?.message || "fetch error" },
      { status: 500 }
    );
  }
}
