"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";

// Set to true during development to always see the full intro,
// regardless of sessionStorage. Must be false in production.
export const FORCE_INTRO = false;

const SESSION_KEY = "jivoranexa_intro_shown_v1";

// The intro is fairly heavy (framer-motion + SVG motion paths), so it's
// code-split out of the main bundle and only ever loaded on the first
// visit of a session -- it costs nothing on subsequent navigations.
const JivoraNexaIntro = dynamic(() => import("./JivoraNexaIntro"), { ssr: false });

/**
 * IntroGate
 * -----------------------------------------------------------------------
 * Wraps the whole app. Renders `children` unconditionally (so routing,
 * auth, and data-fetching all proceed exactly as before) and layers the
 * cinematic intro on top for the first visit of a browser session only.
 * Deleting this wrapper (and reverting layout.tsx) fully removes the
 * feature with zero impact on the rest of the app.
 * -----------------------------------------------------------------------
 */
export default function IntroGate({ children }: { children: ReactNode }) {
  // "pending" renders identically on server and client to avoid any
  // hydration mismatch; the real decision happens client-side, before
  // paint, in the layout effect below.
  const [status, setStatus] = useState<"pending" | "intro" | "app">("pending");

  useLayoutEffect(() => {
    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      // sessionStorage unavailable (privacy mode, etc.) -- just show once.
    }
    setStatus(alreadyShown && !FORCE_INTRO ? "app" : "intro");
  }, []);

  const handleComplete = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // ignore
    }
    setStatus("app");
  };

  return (
    <>
      {children}
      {status === "intro" && <JivoraNexaIntro onComplete={handleComplete} />}
    </>
  );
}