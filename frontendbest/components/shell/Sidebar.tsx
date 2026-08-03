"use client";

import {
  LayoutDashboard,
  Send,
  Briefcase,
  Receipt,
  Coins,
  Siren,
  User,
  Settings,
  Plane,
  Bot,
  Moon,
  Sun,
  MessageCircle,
  Heart,
  HelpCircle,
  Gift,
  Crown,
  Wallet,
  CloudSun,
  Mic,
  Camera,
  Users,
  ClipboardList,
  Bell,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { getStoredSettings, saveSettings, subscribeToSettings, t } from "@/lib/settings";

export type Tab =
  | "plan"
  | "dashboard"
  | "trips"
  | "expenses"
  | "currency"
  | "sos"
  | "messages"
  | "favorites"
  | "profile"
  | "settings"
  | "help"
  | "invite"
  | "premium"
  | "budget"
  | "weather"
  | "voice"
  | "vision"
  | "group"
  | "booking"
  | "offline"
  | "notifications"
  | "personalization"
  | "admin";

const NAV: { id: Tab; label: string; icon: React.ElementType; glow: string; section: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, glow: "group-hover:text-aBlue",  section: "main" },
  { id: "plan",      label: "Plan Trip", icon: Send,             glow: "group-hover:text-gold",   section: "main" },
  { id: "trips",     label: "My Trips", icon: Briefcase,        glow: "group-hover:text-aPurple",section: "main" },
  { id: "expenses",  label: "Expenses", icon: Receipt,          glow: "group-hover:text-aOrange",section: "main" },
  { id: "currency",  label: "Currency", icon: Coins,            glow: "group-hover:text-aCyan",  section: "main" },
  { id: "sos",       label: "SOS",      icon: Siren,            glow: "group-hover:text-alert",  section: "main" },
  { id: "budget",     label: "Budget Planner", icon: Wallet,      glow: "group-hover:text-gold",   section: "ai" },
  { id: "weather",    label: "Smart Weather", icon: CloudSun,    glow: "group-hover:text-aCyan",  section: "ai" },
  { id: "voice",      label: "Voice AI",      icon: Mic,         glow: "group-hover:text-aPurple",section: "ai" },
  { id: "vision",     label: "Vision AI",     icon: Camera,      glow: "group-hover:text-aPink",  section: "ai" },
  { id: "personalization", label: "AI Memory", icon: Sparkles, glow: "group-hover:text-gold",   section: "ai" },
  { id: "group",      label: "Group Trips",   icon: Users,       glow: "group-hover:text-aBlue",  section: "collab" },
  { id: "booking",    label: "Booking Engine", icon: ClipboardList, glow: "group-hover:text-aOrange", section: "collab" },
  { id: "notifications", label: "Notifications", icon: Bell,    glow: "group-hover:text-aPink",  section: "ops" },
  { id: "offline",    label: "Offline Mode",  icon: CloudSun,    glow: "group-hover:text-aCyan",  section: "ops" },
  { id: "messages",   label: "AI Messages",   icon: MessageCircle, glow: "group-hover:text-aBlue", section: "ops" },
  { id: "favorites",  label: "Favorites",     icon: Heart,       glow: "group-hover:text-aPink",  section: "ops" },
  { id: "admin",      label: "Admin",         icon: ShieldCheck, glow: "group-hover:text-gold",   section: "ops" },
  { id: "profile",    label: "Profile",       icon: User,        glow: "group-hover:text-signal", section: "self" },
  { id: "settings",   label: "Settings",      icon: Settings,    glow: "group-hover:text-mist",   section: "self" },
  { id: "help",       label: "Help Center",   icon: HelpCircle,  glow: "group-hover:text-aCyan",  section: "self" },
  { id: "invite",     label: "Invite",        icon: Gift,        glow: "group-hover:text-aPink",  section: "self" },
  { id: "premium",    label: "Premium",       icon: Crown,       glow: "group-hover:text-gold",   section: "self" },
];

const SECTION_LABEL: Record<string, string> = {
  main: "", ai: "AI", collab: "Collaborate", ops: "Operate", self: "My account",
};

export default function Sidebar({
  tab,
  onChange,
  open,
  onClose,
  isAdmin = false,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  open: boolean;
  onClose: () => void;
  /** BUGFIX: the Admin nav item used to be shown to every user, including
   * guests, with no gating at all. Only render it for actual admins. */
  isAdmin?: boolean;
}) {
  const [settings, setSettings] = useState(getStoredSettings());

  useEffect(() => subscribeToSettings((next) => setSettings(next)), []);

  function toggleTheme() {
    const next = { ...settings, theme: (settings.theme === "light" ? "dark" : "light") as typeof settings.theme };
    setSettings(next);
    saveSettings(next);
  }

  // Group items by section while preserving order. Admin-only items are
  // filtered out here for non-admins (was previously shown to everyone,
  // including guests).
  const grouped = useMemo(() => {
    const out: Record<string, typeof NAV> = {};
    for (const item of NAV) {
      if (item.id === "admin" && !isAdmin) continue;
      (out[item.section] ||= []).push(item);
    }
    return out;
  }, [isAdmin]);

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed z-50 lg:z-0 lg:static top-0 left-0 h-screen w-64 shrink-0 border-r border-line2 glass-panel
          flex flex-col transition-transform duration-300 lg:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="px-5 pt-6 pb-5 flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-gold via-aOrange to-aPink flex items-center justify-center glow-gold">
            <Plane size={18} className="text-ink" />
          </div>
          <div>
            <p className="font-display font-semibold text-[15px] leading-tight text-gradient-hero">JivoraNexa AI</p>
            <p className="text-[11px] text-mist2 leading-tight">Autonomous Travel OS</p>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {Object.entries(grouped).map(([section, items]) => (
            <div key={section} className={section === "self" ? "mt-2" : ""}>
              {SECTION_LABEL[section] && (
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-mist2/70">
                  {SECTION_LABEL[section]}
                </p>
              )}
              {items.map(({ id, label, icon: Icon, glow }) => (
                <button
                  key={id}
                  onClick={() => {
                    onChange(id);
                    onClose();
                  }}
                  className={`sidebar-link w-full relative group ${tab === id ? "active" : ""}`}
                >
                  {tab === id && (
                    <motion.span
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-gold via-aOrange to-aPink"
                      style={{ opacity: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <Icon size={16} className={`relative z-10 transition-colors ${tab === id ? "" : glow}`} />
                  <span className="relative z-10">{label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="p-3">
          <div className="rounded-2xl p-4 glass-panel glow-purple text-center relative overflow-hidden">
            <div className="mx-auto h-11 w-11 rounded-full bg-gradient-to-br from-aPurple to-aBlue flex items-center justify-center mb-2 badge-glow">
              <Bot size={20} className="text-white" />
            </div>
            <p className="text-sm font-semibold">AI Assistant</p>
            <p className="text-[11px] text-mist2 mt-0.5 mb-3">Ask me anything about your trip…</p>
            <button
              onClick={() => onChange("messages")}
              className="w-full text-xs font-semibold rounded-xl py-2 bg-gradient-to-r from-aPurple to-aBlue text-white hover:brightness-110 transition"
            >
              Chat Now
            </button>
          </div>

          <button onClick={toggleTheme} className="flex items-center justify-between mt-3 px-3 py-2 rounded-xl glass-panel w-full">
            <span className="flex items-center gap-1.5 text-xs text-mist2">
              {settings.theme === "light" ? <Sun size={13} /> : <Moon size={13} />} {settings.theme === "light" ? "Light mode" : "Dark mode"}
            </span>
            <span className={`h-5 w-9 rounded-full relative transition-colors ${settings.theme === "light" ? "bg-line2" : "bg-gold"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-transform ${settings.theme === "light" ? "translate-x-0.5" : "translate-x-4"}`} />
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
