"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Globe, Lock, Moon, Palette, Shield, Sparkles, Sun, UserCircle2 } from "lucide-react";
import { AppSettings, DEFAULT_SETTINGS, getStoredSettings, saveSettings, t } from "@/lib/settings";

type SettingsKey = keyof AppSettings;

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`h-6 w-11 rounded-full relative transition-colors ${checked ? "bg-gold" : "bg-line2"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`}
      />
    </button>
  );
}

function Row({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="flex items-start gap-3 min-w-0">
        <div className="h-9 w-9 rounded-xl bg-panel2 border border-line2 flex items-center justify-center shrink-0 text-gold">
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-mist2 mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const labels = useMemo(() => ({
    notifications: t(settings.language, "notifications"),
    darkMode: t(settings.language, "darkMode"),
    lightMode: t(settings.language, "lightMode"),
  }), [settings.language]);

  useEffect(() => {
    setSettings(getStoredSettings());
  }, []);

  function persist(next: AppSettings) {
    setSettings(next);
    saveSettings(next);
  }

  function set<K extends SettingsKey>(key: K, value: AppSettings[K]) {
    persist({ ...settings, [key]: value });
  }

  return (
    <div className="space-y-6 rise-in max-w-3xl">
      <p className="text-xs text-mist2 -mt-2">
        Changes are applied instantly across the shell and saved on this device for your next visit.
      </p>

      <div className="glass-card rounded-2xl px-5 divide-y divide-line2">
        <Row icon={Bell} title={labels.notifications} description="Trip updates, reminders, and booking confirmations">
          <Toggle checked={settings.notifications} onChange={(v) => set("notifications", v)} />
        </Row>
        <Row icon={Sparkles} title="AI Suggestions" description="Allow proactive itinerary improvements and smart prompts">
          <Toggle checked={settings.aiSuggestions} onChange={(v) => set("aiSuggestions", v)} />
        </Row>
        <Row icon={Palette} title="Compact Mode" description="Reduce card padding and shell spacing immediately">
          <Toggle checked={settings.compactMode} onChange={(v) => set("compactMode", v)} />
        </Row>
      </div>

      <div className="glass-card rounded-2xl px-5 divide-y divide-line2">
        <Row icon={Moon} title="Theme" description="Update the app appearance instantly">
          <div className="flex flex-wrap gap-2 justify-end">
            {[
              { id: "dark", label: labels.darkMode },
              { id: "light", label: labels.lightMode },
              { id: "system", label: "System" },
              { id: "sunset", label: "Sunset" },
              { id: "ocean", label: "Ocean" },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => set("theme", option.id as AppSettings["theme"])}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${settings.theme === option.id ? "border-gold text-gold bg-gold/10" : "border-line2 text-mist2 hover:border-gold/40 hover:text-gold"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Row>
        <Row icon={Globe} title="Language" description="Updates navigation labels and shell text">
          <select
            value={settings.language}
            onChange={(e) => set("language", e.target.value as AppSettings["language"])}
            className="bg-panel2 border border-line2 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-gold"
          >
            <option>English</option>
            <option>हिन्दी</option>
            <option>తెలుగు</option>
          </select>
        </Row>
        <Row icon={Globe} title="Default Currency" description="Used by the converter and expense summaries">
          <select
            value={settings.currency}
            onChange={(e) => set("currency", e.target.value)}
            className="bg-panel2 border border-line2 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-gold"
          >
            <option>INR</option>
            <option>USD</option>
            <option>EUR</option>
            <option>GBP</option>
            <option>AED</option>
            <option>JPY</option>
          </select>
        </Row>
        <Row icon={Globe} title="Units" description="Distances and temperatures across the app">
          <select
            value={settings.units}
            onChange={(e) => set("units", e.target.value as AppSettings["units"])}
            className="bg-panel2 border border-line2 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-gold"
          >
            <option value="metric">Metric (km, °C)</option>
            <option value="imperial">Imperial (mi, °F)</option>
          </select>
        </Row>
        <Row icon={Globe} title="Date Format" description="Applies to trips, expenses and bookings">
          <select
            value={settings.dateFormat}
            onChange={(e) => set("dateFormat", e.target.value as AppSettings["dateFormat"])}
            className="bg-panel2 border border-line2 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-gold"
          >
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </Row>
        <Row icon={Globe} title="Time Format" description="12-hour or 24-hour clock across the app">
          <select
            value={settings.timeFormat}
            onChange={(e) => set("timeFormat", e.target.value as AppSettings["timeFormat"])}
            className="bg-panel2 border border-line2 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-gold"
          >
            <option value="24h">24-hour</option>
            <option value="12h">12-hour (AM/PM)</option>
          </select>
        </Row>
      </div>

      <div className="glass-card rounded-2xl px-5 divide-y divide-line2">
        <Row icon={Shield} title="Privacy Mode" description="Hide low-priority personal details in shared views">
          <Toggle checked={settings.privacyMode} onChange={(v) => set("privacyMode", v)} />
        </Row>
        <Row icon={Lock} title="Share Usage Analytics" description="Improve trip recommendations with anonymous usage patterns">
          <Toggle checked={settings.shareAnalytics} onChange={(v) => set("shareAnalytics", v)} />
        </Row>
        <Row icon={UserCircle2} title="Private Account" description="Keep your activity visible only on this signed-in profile">
          <Toggle checked={settings.accountPrivate} onChange={(v) => set("accountPrivate", v)} />
        </Row>
      </div>

      <div className="glass-card rounded-2xl p-5 text-xs text-mist2 flex items-center gap-2">
        <Sun size={14} className="text-gold" />
        <span>
          Active: <span className="text-[#dbe4ec]">{settings.theme}</span> theme · <span className="text-[#dbe4ec]">{settings.language}</span> · {settings.compactMode ? "compact" : "comfortable"} spacing
        </span>
      </div>
    </div>
  );
}
