// app/api/rooms/route.ts
export const dynamic = "force-dynamic";

export async function GET() {
  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:1999";
  const isLocal = host.includes("127.0.0.1") || host.includes("localhost");
  const base = isLocal ? `http://${host}` : `https://${host}`;
  const url = `${base}/parties/rooms/lobby`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return Response.json(
        { error: `rooms fetch failed: ${res.status}` },
        { status: 502 }
      );
    }
    const data = await res.json();
    return Response.json(Array.isArray(data) ? data : []);
  } catch (e: any) {
    return Response.json(
      { error: e?.message || "fetch error" },
      { status: 500 }
    );
  }
}
