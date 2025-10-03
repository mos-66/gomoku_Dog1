// app/layout.tsx (Server Component)
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "../styles/globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gomoku",
  description: "Gomoku (AI / Realtime PVP)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // 第一次進站或沒有 Cookie 時，預設 'eye'（與你原本一致）
  const theme = cookies().get("gomoku-theme")?.value ?? "eye";

  return (
    <html lang="zh-Hant" data-theme={theme}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
