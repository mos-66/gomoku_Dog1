"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Theme = "eye" | "light";
type ActiveRoom = { id: string; count: number; updatedAt: number };

export default function Home() {
  const [theme, setTheme] = useState<Theme>("eye");
  const [nickname, setNickname] = useState("");
  const [roomId, setRoomId] = useState("");
  const [rooms, setRooms] = useState<ActiveRoom[]>([]);

  // 初始化主題
  useEffect(() => {
    const saved = (localStorage.getItem("gomoku-theme") as Theme) || "eye";
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
  }, []);

  function switchTheme(next: Theme) {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("gomoku-theme", next);
  }

  // 背景送出「立即登錄」請求（不阻塞導航）
  function pingRoom(id: string) {
    const payload = JSON.stringify({ roomId: id });
    try {
      const blob = new Blob([payload], { type: "application/json" });
      // @ts-expect-error
      navigator.sendBeacon?.("/api/rooms/ping", blob);
    } catch {
      fetch("/api/rooms/ping", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  }

  // 抓清單（同源代理 /api/rooms → PartyKit）
  async function fetchRooms() {
    try {
      const res = await fetch("/api/rooms", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setRooms(data.slice().sort((a, b) => b.updatedAt - a.updatedAt));
        }
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchRooms();
    const t = setInterval(fetchRooms, 2000);
    return () => clearInterval(t);
  }, []);

  const canEnter = nickname.trim() && roomId.trim();
  const targetHref = canEnter
    ? `/room/${encodeURIComponent(roomId.trim())}?name=${encodeURIComponent(
        nickname.trim()
      )}`
    : undefined;

  return (
    <main className="container" style={{ display: "grid", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 28, color: "var(--accent)" }}>五子棋</h1>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <label>主題：</label>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              className="btn"
              onClick={() => switchTheme("eye")}
              aria-pressed={theme === "eye"}
              style={{
                background: theme === "eye" ? "var(--accent)" : undefined,
                color: theme === "eye" ? "#0e1116" : undefined,
              }}
            >
              護眼模式
            </button>
            <button
              className="btn"
              onClick={() => switchTheme("light")}
              aria-pressed={theme === "light"}
              style={{
                background: theme === "light" ? "var(--accent)" : undefined,
                color: theme === "light" ? "#0e1116" : undefined,
              }}
            >
              普通模式
            </button>
          </div>
        </div>
      </header>

      {/* 模式選擇 */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        {/* AI 模式卡片 */}
        <div className="card" style={{ padding: 16, display: "grid", gap: 12 }}>
          <h2 style={{ margin: 0 }}>AI 模式</h2>
          <p className="hint" style={{ margin: 0 }}>
            單機對戰；之後可加 AI 防守/候選點與解說。
          </p>
          <Link href="/solo" className="btn" style={{ width: "fit-content" }}>
            進入 AI 模式
          </Link>
        </div>

        {/* 對戰模式卡片 */}
        <div className="card" style={{ padding: 16, display: "grid", gap: 12 }}>
          <h2 style={{ margin: 0 }}>對戰模式（即時）</h2>
          <div style={{ display: "grid", gap: 8 }}>
            <label>
              暱稱
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="你的暱稱"
                style={{
                  width: "100%",
                  marginTop: 4,
                  background: "color-mix(in oklab, var(--bg), white 6%)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 10px",
                }}
              />
            </label>

            <label>
              房間 ID
              <input
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="例如：GOOD"
                style={{
                  width: "100%",
                  marginTop: 4,
                  background: "color-mix(in oklab, var(--bg), white 6%)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 10px",
                }}
              />
            </label>

            {/* 用 Link 保證導頁成功；onClick 背景送 ping */}
            {targetHref ? (
              <Link
                href={targetHref}
                className="btn"
                style={{ width: "fit-content" }}
                onClick={() => pingRoom(roomId.trim())}
              >
                進入 / 建立 房間
              </Link>
            ) : (
              <button
                className="btn"
                style={{ width: "fit-content", opacity: 0.6, cursor: "not-allowed" }}
                title="請先輸入暱稱與房間 ID"
                disabled
              >
                進入 / 建立 房間
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 活躍房間清單 */}
      <section className="card" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>目前進行中的房間</h3>
        {rooms.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>目前沒有房間。</p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gap: 8,
            }}
          >
            {rooms.map((r) => (
              <li
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 10px",
                  background: "color-mix(in oklab, var(--bg), white 4%)",
                }}
              >
                <code style={{ opacity: 0.9 }}>{r.id}</code>
                <span style={{ opacity: 0.8 }}>👥 {r.count}</span>
                <span className="hint" style={{ marginLeft: "auto" }}>
                  更新：{new Date(r.updatedAt).toLocaleTimeString()}
                </span>
                <Link
                  className="btn"
                  href={`/room/${encodeURIComponent(r.id)}?name=${encodeURIComponent(
                    nickname || "訪客"
                  )}`}
                >
                  加入
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
