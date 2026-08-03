import type { Metadata, Viewport } from "next";
import "./globals.css";
import AuroraBackground from "@/components/shell/AuroraBackground";

export const metadata: Metadata = {
  title: "Jivoranexa Ai Trip Agent — Autonomous Trip Planner",
  description: "A transparent, memory-aware planning agent — task decomposition, tool orchestration, retries, and a live decision log.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuroraBackground />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}