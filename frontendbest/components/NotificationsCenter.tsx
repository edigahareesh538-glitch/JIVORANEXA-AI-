"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, CheckCheck, Sparkles } from "lucide-react";
import {
  listNotifications, markNotificationRead, NotificationItem,
  getExpenseAnalytics,
} from "@/lib/api";
import { getStoredSettings, subscribeToSettings } from "@/lib/settings";

export default function NotificationsCenter({ loggedIn }: { loggedIn: boolean }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(getStoredSettings().notifications);

  useEffect(() => subscribeToSettings((s) => setNotificationsEnabled(s.notifications)), []);

  async function load() {
    if (!loggedIn) return;
    setBusy(true); setError(null);
    try {
      const list = await listNotifications();
      setItems(list);
      setUnread(list.filter((n) => !n.is_read).length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load notifications.");
    } finally { setBusy(false); }
  }
  useEffect(() => { load(); }, [loggedIn]);

  async function autoGenerate() {
    if (!loggedIn) return;
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const { authHeaders } = await import("@/lib/auth");
      await fetch(`${API}/api/notifications/auto-generate`, {
        method: "POST", headers: { ...authHeaders() },
      });
      await load();
    } catch { /* ignore */ }
  }

  if (!loggedIn) {
    return (
      <div className="glass-panel rounded-2xl p-6">
        <p className="text-sm text-mist2">Sign in to receive smart reminders.</p>
      </div>
    );
  }

  if (!notificationsEnabled) {
    return (
      <div className="glass-panel rounded-2xl p-6 text-center">
        <BellOff className="mx-auto text-mist2 mb-2" size={20} />
        <p className="text-sm text-mist2">Notifications are turned off in Settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 rise-in">
      <div className="glass-panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
          <Bell size={13} className="text-amber" /> Smart Notifications · {unread} unread
        </p>
        <p className="text-sm text-mist2 mt-1">
          Weather alerts, booking reminders, budget alerts, departure hints and AI nudges.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={autoGenerate}
            className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber to-amberDim text-ink font-semibold flex items-center gap-1.5">
            <Sparkles size={12} /> Generate reminders
          </button>
          <button onClick={async () => {
            const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            const { authHeaders } = await import("@/lib/auth");
            await fetch(`${API}/api/notifications/mark-all-read`, {
              method: "POST", headers: { ...authHeaders() },
            });
            await load();
          }} className="text-xs px-3 py-1.5 rounded-lg border border-line text-mist hover:border-amber/40 hover:text-amber flex items-center gap-1.5">
            <CheckCheck size={12} /> Mark all read
          </button>
        </div>
        {error && <p className="text-xs text-alert mt-2">{error}</p>}
      </div>

      <div className="space-y-2">
        {items.length === 0 && <p className="text-xs text-mist2">No notifications yet.</p>}
        {items.map((n) => (
          <div key={n.id}
               className={`glass-panel rounded-xl p-3 border ${n.is_read ? "border-line2" : "border-amber/40"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  {n.is_read ? <BellOff size={12} className="text-mist2" /> : <Bell size={12} className="text-amber" />}
                  {n.title}
                </p>
                <p className="text-xs text-mist2 mt-1">{n.message}</p>
                <p className="text-[10px] text-mist2 mt-1">{n.type} · {new Date(n.created_at).toLocaleString()}</p>
              </div>
              {!n.is_read && (
                <button onClick={async () => {
                  await markNotificationRead(n.id);
                  await load();
                }} className="text-[10px] px-2 py-1 rounded border border-line text-mist">
                  Mark read
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
