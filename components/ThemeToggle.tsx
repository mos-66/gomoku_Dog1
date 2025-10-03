// components/ThemeToggle.tsx
"use client";

type Theme = "eye" | "dark" | "light";

function applyTheme(theme: Theme) {
  // 1) 立即套用到 DOM
  document.documentElement.setAttribute("data-theme", theme);
  // 2) 存 localStorage（給前端用）
  try {
    localStorage.setItem("gomoku-theme", theme);
  } catch {}
  // 3) 寫 Cookie（給下一次 SSR 用）
  document.cookie = `gomoku-theme=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export default function ThemeToggle() {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={() => applyTheme("eye")}>護眼</button>
      <button onClick={() => applyTheme("dark")}>深色</button>
      <button onClick={() => applyTheme("light")}>亮色</button>
    </div>
  );
}
