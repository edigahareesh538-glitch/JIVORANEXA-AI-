"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Plane, Bus, Ticket as TicketIcon } from "lucide-react";

/**
 * JivoraNexaIntro
 * -----------------------------------------------------------------------
 * Self-contained cinematic "AI Travel Journey" intro overlay.
 * Renders on top of the existing app (fixed, full-screen) and calls
 * onComplete() when it's done -- it never touches routes, auth, or any
 * existing component tree. Safe to remove by deleting this file and its
 * two call sites in IntroGate.tsx.
 * -----------------------------------------------------------------------
 */

// Logical coordinate space the whole scene is authored in. The stage is
// scaled (via a single CSS transform) to cover any viewport, so every
// path/node below stays perfectly in sync regardless of screen size.
const STAGE_W = 1200;
const STAGE_H = 640;

const COLORS = {
  blue: "#4F8DFF",
  purple: "#A76BFF",
  gold: "#F5B841",
  mist: "#9AA3B5",
};

const PATHS = {
  plane: "M -80 460 C 220 430, 520 220, 820 190 S 1220 150, 1320 120",
  bus1: "M -80 330 C 260 310, 620 310, 1320 300",
  bus2: "M 1320 400 C 900 420, 520 420, -80 430",
  car1: "M 340 -80 C 360 200, 300 420, 330 740",
  car2: "M 900 740 C 880 480, 940 240, 900 -80",
};

const NODES: { x: number; y: number }[] = [
  { x: 150, y: 440 },
  { x: 820, y: 190 },
  { x: 300, y: 90 },
  { x: 1050, y: 420 },
];
const CENTER_NODE = { x: 600, y: 320 };

type Ticket = {
  route: string;
  date: string;
  seat: string;
  pnr: string;
  icon: typeof Plane;
  rotate: number;
  x: number;
  y: number;
};

const TICKETS: Ticket[] = [
  { route: "MUMBAI \u2192 GOA", date: "08 AUG 2026", seat: "24A", pnr: "JX 4821 3A", icon: Plane, rotate: -9, x: -240, y: -6 },
  { route: "DELHI \u2192 JAIPUR", date: "10 AUG 2026", seat: "12C", pnr: "JX 9102 7B", icon: Bus, rotate: 6, x: -120, y: 16 },
  { route: "HYDERABAD \u2192 CHENNAI", date: "14 AUG 2026", seat: "07D", pnr: "JX 5581 0C", icon: TicketIcon, rotate: -3, x: 0, y: -16 },
  { route: "BENGALURU \u2192 KOCHI", date: "18 AUG 2026", seat: "19B", pnr: "JX 3394 7D", icon: Bus, rotate: 8, x: 120, y: 12 },
  { route: "PUNE \u2192 MANALI", date: "22 AUG 2026", seat: "02A", pnr: "JX 7665 2E", icon: Plane, rotate: -6, x: 240, y: -4 },
];

type Phase = "logo" | "airplane" | "buses" | "cars" | "converge" | "tickets" | "brand" | "exit";

// [phase, durationMs] -- mirrors the 6-8s timeline from the spec.
const TIMELINE: [Phase, number][] = [
  ["logo", 1000],
  ["airplane", 1200],
  ["buses", 1200],
  ["cars", 1400],
  ["converge", 600],
  ["tickets", 1000],
  ["brand", 800],
  ["exit", 800],
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    setIsMobile(mq.matches);
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

export default function JivoraNexaIntro({ onComplete }: { onComplete: () => void }) {
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const [phase, setPhase] = useState<Phase>("logo");
  const [skipping, setSkipping] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [scale, setScale] = useState(1);

  // Lock page scroll while the intro is up, and never allow horizontal
  // overflow regardless of viewport width.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Cover-fit the fixed 1200x640 stage to whatever viewport we're in.
  useEffect(() => {
    const resize = () => {
      const s = Math.max(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H) * 1.05;
      setScale(s);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const finish = () => {
    timers.current.forEach(clearTimeout);
    onComplete();
  };

  // Reduced-motion path: brief brand moment, then reveal. No vehicles.
  useEffect(() => {
    if (!prefersReducedMotion) return;
    const t = setTimeout(finish, 1400);
    timers.current.push(t);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion]);

  // Full cinematic timeline.
  useEffect(() => {
    if (prefersReducedMotion || skipping) return;
    let elapsed = 0;
    TIMELINE.forEach(([p, dur]) => {
      elapsed += dur;
      const t = setTimeout(() => setPhase(p), elapsed);
      timers.current.push(t);
    });
    const done = setTimeout(finish, elapsed + 450);
    timers.current.push(done);
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion, skipping]);

  const handleSkip = () => {
    timers.current.forEach(clearTimeout);
    setSkipping(true);
    setPhase("exit");
    const t = setTimeout(finish, 500);
    timers.current.push(t);
  };

  const phaseIndex = TIMELINE.findIndex(([p]) => p === phase);
  const showAirplane = !prefersReducedMotion && phaseIndex >= 1 && phase !== "exit";
  const showBuses = !prefersReducedMotion && phaseIndex >= 2 && phase !== "exit";
  const showCars = !prefersReducedMotion && phaseIndex >= 3 && phase !== "exit";
  const showConverge = !prefersReducedMotion && (phase === "converge" || phase === "tickets" || phase === "brand");
  const showTickets = !prefersReducedMotion && (phase === "tickets" || phase === "brand");
  const showBrand = phase === "brand" || phase === "exit" || prefersReducedMotion;
  const nodes = isMobile ? NODES.slice(0, 2) : NODES;

  const stageStyle = useMemo(
    () => ({
      width: STAGE_W,
      height: STAGE_H,
      transform: `translate(-50%, -50%) scale(${scale})`,
    }),
    [scale]
  );

  return (
    <motion.div
      className="fixed inset-0 z-[999] overflow-hidden bg-ink"
      initial={{ opacity: 1 }}
      animate={{
        opacity: phase === "exit" ? 0 : 1,
        filter: phase === "exit" ? "blur(12px)" : "blur(0px)",
        scale: phase === "exit" ? 1.06 : 1,
      }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Background: near-black gradient + subtle glows */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 15%, rgba(79,141,255,0.10) 0%, rgba(6,7,11,0) 55%)," +
            "radial-gradient(100% 80% at 85% 85%, rgba(167,107,255,0.12) 0%, rgba(6,7,11,0) 55%)," +
            "linear-gradient(180deg, #06070B 0%, #0A0C16 50%, #06070B 100%)",
        }}
      />
      {/* Faint travel-network texture -- static, cheap */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.06]" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="jn-grid" width="46" height="46" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#ffffff" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#jn-grid)" />
      </svg>

      {/* ---- Logo phase ---- */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <AnimatePresence>
          {(phase === "logo" || prefersReducedMotion) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <h1 className="font-display text-[clamp(2rem,7vw,3.75rem)] font-bold tracking-tight text-white">
                JivoraNexa AI
              </h1>
              <p
                className="mt-3 text-[clamp(0.65rem,2.4vw,0.95rem)] font-medium tracking-[0.25em] text-mist"
                style={{ color: COLORS.mist }}
              >
                PLAN SMARTER &bull; TRAVEL SAFER &bull; EXPLORE BETTER
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ---- Vehicle / route stage ---- */}
      {!prefersReducedMotion && (
        <div className="absolute left-1/2 top-1/2" style={stageStyle}>
          <svg
            width={STAGE_W}
            height={STAGE_H}
            viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
            className="absolute inset-0"
          >
            {/* Route lines, drawn in */}
            {(["plane", "bus1", "bus2", "car1", "car2"] as const).map((key) => (
              <motion.path
                key={key}
                d={PATHS[key]}
                fill="none"
                stroke={key === "plane" ? COLORS.gold : key.startsWith("bus") ? COLORS.blue : COLORS.purple}
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.25}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: phaseIndex >= 1 ? 1 : 0 }}
                transition={{ duration: 1.4, ease: "easeInOut" }}
              />
            ))}

            {/* Pulsing destination nodes */}
            {nodes.map((n, i) => (
              <motion.circle
                key={i}
                cx={n.x}
                cy={n.y}
                r={7}
                fill={COLORS.gold}
                initial={{ opacity: 0.3, scale: 0.8 }}
                animate={{ opacity: [0.4, 1, 0.4], scale: [0.85, 1.15, 0.85] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
              />
            ))}

            {/* Central convergence node */}
            <motion.circle
              cx={CENTER_NODE.x}
              cy={CENTER_NODE.y}
              r={10}
              fill={COLORS.purple}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={
                showConverge
                  ? { opacity: 1, scale: [1, 1.6, 1.1], filter: ["drop-shadow(0 0 0px #A76BFF)", "drop-shadow(0 0 26px #A76BFF)", "drop-shadow(0 0 10px #A76BFF)"] }
                  : { opacity: 0 }
              }
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          </svg>

          {/* Airplane */}
          <AnimatePresence>
            {showAirplane && (
              <motion.div
                className="absolute left-0 top-0"
                style={{ offsetPath: `path("${PATHS.plane}")`, offsetRotate: "auto" } as CSSProperties}
                initial={{ offsetDistance: "0%", opacity: 0 }}
                animate={
                  phase === "airplane"
                    ? { offsetDistance: "100%", opacity: 1 }
                    : { offsetDistance: "100%", opacity: phase === "buses" || phase === "cars" ? 0.5 : 0 }
                }
                exit={{ opacity: 0 }}
                transition={{ duration: 1.1, ease: [0.33, 1, 0.68, 1] }}
              >
                <div
                  className="flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
                  style={{ background: "rgba(245,184,65,0.15)", boxShadow: "0 0 22px rgba(245,184,65,0.55)" }}
                >
                  <Plane size={18} color={COLORS.gold} style={{ transform: "rotate(45deg)" }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Buses -- cross in opposite directions */}
          <AnimatePresence>
            {showBuses && (
              <>
                <motion.div
                  className="absolute left-0 top-0"
                  style={{ offsetPath: `path("${PATHS.bus1}")`, offsetRotate: "auto" } as CSSProperties}
                  initial={{ offsetDistance: "0%", opacity: 0 }}
                  animate={{ offsetDistance: "100%", opacity: phase === "buses" ? 1 : 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.1, ease: "easeInOut" }}
                >
                  <div
                    className="flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
                    style={{ background: "rgba(79,141,255,0.15)", boxShadow: "0 0 18px rgba(79,141,255,0.55)" }}
                  >
                    <Bus size={16} color={COLORS.blue} />
                  </div>
                </motion.div>
                <motion.div
                  className="absolute left-0 top-0"
                  style={{ offsetPath: `path("${PATHS.bus2}")`, offsetRotate: "auto" } as CSSProperties}
                  initial={{ offsetDistance: "0%", opacity: 0 }}
                  animate={{ offsetDistance: "100%", opacity: phase === "buses" ? 1 : 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.1, ease: "easeInOut", delay: 0.1 }}
                >
                  <div
                    className="flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
                    style={{ background: "rgba(79,141,255,0.15)", boxShadow: "0 0 18px rgba(79,141,255,0.55)" }}
                  >
                    <Bus size={16} color={COLORS.blue} />
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Cars -- vertical crossing */}
          <AnimatePresence>
            {showCars && (
              <>
                <motion.div
                  className="absolute left-0 top-0"
                  style={{ offsetPath: `path("${PATHS.car1}")`, offsetRotate: "auto" } as CSSProperties}
                  initial={{ offsetDistance: "0%", opacity: 0 }}
                  animate={{ offsetDistance: "100%", opacity: phase === "cars" ? 1 : 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.3, ease: "easeInOut" }}
                >
                  <div
                    className="h-2.5 w-4 -translate-x-1/2 -translate-y-1/2 rounded-sm"
                    style={{ background: COLORS.purple, boxShadow: "0 0 16px rgba(167,107,255,0.7)" }}
                  />
                </motion.div>
                <motion.div
                  className="absolute left-0 top-0"
                  style={{ offsetPath: `path("${PATHS.car2}")`, offsetRotate: "auto" } as CSSProperties}
                  initial={{ offsetDistance: "0%", opacity: 0 }}
                  animate={{ offsetDistance: "100%", opacity: phase === "cars" ? 1 : 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.3, ease: "easeInOut", delay: 0.1 }}
                >
                  <div
                    className="h-2.5 w-4 -translate-x-1/2 -translate-y-1/2 rounded-sm"
                    style={{ background: COLORS.purple, boxShadow: "0 0 16px rgba(167,107,255,0.7)" }}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ---- Tickets ---- */}
      {!prefersReducedMotion && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <AnimatePresence>
            {showTickets &&
              TICKETS.map((t, i) => (
                <motion.div
                  key={t.pnr}
                  className="absolute"
                  initial={{ opacity: 0, y: 160, scale: 0.7, rotate: t.rotate * 1.4 }}
                  animate={{
                    opacity: phase === "brand" ? 0 : 1,
                    y: t.y,
                    x: isMobile ? t.x * 0.55 : t.x,
                    scale: isMobile ? 0.72 : 0.86,
                    rotate: t.rotate,
                  }}
                  exit={{ opacity: 0, scale: 0.6, y: -40 }}
                  transition={{ type: "spring", stiffness: 210, damping: 18, delay: i * 0.09 }}
                  style={{ zIndex: 10 + i }}
                >
                  <div
                    className="w-[190px] rounded-2xl border p-3.5 backdrop-blur-md"
                    style={{
                      background: "rgba(15,17,24,0.72)",
                      borderColor: "rgba(255,255,255,0.09)",
                      boxShadow: "0 12px 34px rgba(0,0,0,0.5), 0 0 24px rgba(167,107,255,0.18)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-bold tracking-[0.15em] text-white/70">
                        JIVORANEXA AI
                      </span>
                      <t.icon size={13} color={COLORS.gold} />
                    </div>
                    <p className="mt-1 text-[7px] tracking-[0.2em] text-white/40">SMART TRAVEL PASS</p>
                    <p className="mt-2 text-[11px] font-semibold text-white">{t.route}</p>
                    <div className="mt-2 flex items-center justify-between text-[7.5px] text-white/50">
                      <span>{t.date}</span>
                      <span>SEAT {t.seat}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
                      <span className="font-mono text-[7px] text-white/40">{t.pnr}</span>
                      <div className="grid grid-cols-4 gap-[1.5px]">
                        {Array.from({ length: 16 }).map((_, qi) => (
                          <span
                            key={qi}
                            className="h-[3px] w-[3px]"
                            style={{ background: (qi * 7) % 3 === 0 ? "rgba(255,255,255,0.7)" : "transparent" }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
          </AnimatePresence>
        </div>
      )}

      {/* ---- Brand reveal ---- */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <AnimatePresence>
          {showBrand && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, filter: "blur(6px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <h1 className="font-display text-[clamp(2rem,7vw,3.75rem)] font-bold tracking-tight text-white">
                JivoraNexa AI
              </h1>
              <p className="mt-3 text-[clamp(0.62rem,2.2vw,0.85rem)] font-medium tracking-[0.25em]" style={{ color: COLORS.mist }}>
                PLAN SMARTER
                <br className="sm:hidden" />
                <span className="hidden sm:inline"> &bull; </span>
                TRAVEL SAFER
                <br className="sm:hidden" />
                <span className="hidden sm:inline"> &bull; </span>
                EXPLORE BETTER
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ---- Skip button ---- */}
      {phase !== "exit" && (
        <motion.button
          type="button"
          onClick={handleSkip}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="absolute bottom-5 right-5 rounded-full border px-4 py-2 text-xs font-medium text-white/80 backdrop-blur-md transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:bottom-8 sm:right-8"
          style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.14)" }}
          aria-label="Skip intro animation"
        >
          Skip &rarr;
        </motion.button>
      )}
    </motion.div>
  );
}