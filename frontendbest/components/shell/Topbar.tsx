"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, ChevronDown, Clock, LogOut, Menu, Search, Trash2, User as UserIcon } from "lucide-react";
import { DashboardData, getDashboard, listNotifications, markNotificationRead, deleteNotification, NotificationItem } from "@/lib/api";
import { AuthState, logout } from "@/lib/auth";
import { destinationPhoto, POPULAR_DESTINATIONS } from "@/lib/destinations";
import { emitNavigate, SearchResultItem } from "@/lib/shellEvents";
import { AppLanguage, getStoredSettings, subscribeToSettings, t } from "@/lib/settings";

const SEARCH_HISTORY_KEY = "trip_agent_search_history";

const TAB_RESULTS: SearchResultItem[] = [
  { id: "tab-dashboard", label: "Dashboard", type: "tab", tab: "dashboard" },
  { id: "tab-plan", label: "Plan Trip", type: "tab", tab: "plan" },
  { id: "tab-trips", label: "My Trips", type: "tab", tab: "trips" },
  { id: "tab-expenses", label: "Expenses", type: "tab", tab: "expenses" },
  { id: "tab-currency", label: "Currency Converter", type: "tab", tab: "currency" },
  { id: "tab-sos", label: "Emergency SOS", type: "tab", tab: "sos" },
  { id: "tab-favorites", label: "Favorites", type: "tab", tab: "favorites" },
  { id: "tab-messages", label: "Messages", type: "tab", tab: "messages" },
];

function loadHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

function saveHistory(history: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, 6)));
}

export default function Topbar({
  title,
  subtitle,
  auth,
  onAuthChange,
  onMenuClick,
}: {
  title: string;
  subtitle?: string;
  auth: AuthState | null;
  onAuthChange: (a: AuthState | null) => void;
  onMenuClick: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [language, setLanguage] = useState<AppLanguage>(getStoredSettings().language);
  const [now, setNow] = useState<Date | null>(null);
  const name = auth?.user.display_name || auth?.user.email || "Traveler";
  const [notificationsEnabled, setNotificationsEnabled] = useState(getStoredSettings().notifications);

  useEffect(() => {
    setHistory(loadHistory());
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    const unsubscribe = subscribeToSettings((settings) => {
      setLanguage(settings.language);
      setNotificationsEnabled(settings.notifications);
    });
    return () => {
      clearInterval(id);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!auth) {
      setDashboard(null);
      setNotifications([]);
      return;
    }
    getDashboard().then(setDashboard).catch(() => undefined);
    if (notificationsEnabled) {
      listNotifications().then(setNotifications).catch(() => undefined);
    } else {
      setNotifications([]);
    }
  }, [auth, notificationsEnabled]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    const popular: SearchResultItem[] = POPULAR_DESTINATIONS.map((d) => ({
      id: `dest-${d.name}`,
      label: d.name,
      sublabel: d.tag,
      type: "destination",
      destination: d.name,
    }));
    const recentTrips: SearchResultItem[] = (dashboard?.recent_trips || []).map((trip) => ({
      id: `trip-${trip.id}`,
      label: trip.destination,
      sublabel: `Trip · ${trip.status}`,
      type: "trip",
      destination: trip.destination,
    }));
    const favorites: SearchResultItem[] = (dashboard?.favorite_places || []).map((place) => ({
      id: `fav-${place.id}`,
      label: place.name,
      sublabel: place.destination || "Favorite place",
      type: "favorite",
      destination: place.destination || place.name,
    }));
    const recentSearches: SearchResultItem[] = history.map((item) => ({
      id: `recent-${item}`,
      label: item,
      sublabel: "Recent search",
      type: "recent_search",
      destination: item,
    }));

    const combined = [...recentSearches, ...recentTrips, ...favorites, ...popular, ...TAB_RESULTS];
    const filtered = q
      ? combined.filter((item) => `${item.label} ${item.sublabel || ""}`.toLowerCase().includes(q))
      : combined;
    const deduped = filtered.filter((item, index, array) => index === array.findIndex((other) => other.id === item.id || other.label === item.label));
    return deduped.slice(0, 8);
  }, [dashboard, history, query]);

  function commitHistory(term: string) {
    const next = [term, ...history.filter((item) => item !== term)].slice(0, 6);
    setHistory(next);
    saveHistory(next);
  }

  function selectResult(item: SearchResultItem) {
    const term = item.destination || item.label;
    commitHistory(term);
    setQuery("");
    if (item.type === "tab" && item.tab) {
      emitNavigate({ type: "tab", tab: item.tab });
      return;
    }
    emitNavigate({ type: "plan", destination: term, transportMode: "flight" });
  }

  async function openNotification(notification: NotificationItem) {
    if (!notification.is_read) {
      await markNotificationRead(notification.id).catch(() => undefined);
      setNotifications((items) => items.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item)));
    }
    const lower = `${notification.title} ${notification.message}`.toLowerCase();
    if (lower.includes("payment") || lower.includes("trip")) {
      emitNavigate({ type: "tab", tab: "trips" });
    } else if (lower.includes("emergency")) {
      emitNavigate({ type: "tab", tab: "sos" });
    } else {
      emitNavigate({ type: "tab", tab: "dashboard" });
    }
    setNotificationsOpen(false);
  }

  async function removeNotification(notificationId: string) {
    await deleteNotification(notificationId).catch(() => undefined);
    setNotifications((items) => items.filter((item) => item.id !== notificationId));
  }

  const placeholder = t(language, "searchPlaceholder");

  return (
    <header className="sticky top-0 z-30 px-4 sm:px-6 py-4 flex items-center gap-4 border-b border-line2 bg-ink/70 backdrop-blur-xl">
      <button onClick={onMenuClick} className="lg:hidden text-mist p-1.5 -ml-1.5">
        <Menu size={20} />
      </button>

      <div className="flex-1 min-w-0">
        <h1 className="font-display text-lg sm:text-xl font-semibold truncate">{title}</h1>
        {subtitle && <p className="text-xs text-mist2 truncate">{subtitle}</p>}
      </div>

      {now && (
        <div className="hidden xl:flex items-center gap-1.5 text-xs text-mist2 px-3 py-2 rounded-xl glass-card">
          <Clock size={13} className="text-gold" />
          {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
      )}

      <div className="hidden md:block relative w-80">
        <div className="flex items-center gap-2 glass-card glow-input rounded-xl px-3 py-2 text-mist2">
          <Search size={15} />
          <input
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent text-sm outline-none placeholder:text-mist2 flex-1"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-line2 text-mist2">⌘K</kbd>
        </div>
        {(query.trim() || history.length > 0) && (
          <div className="absolute right-0 left-0 mt-2 rounded-2xl glass-panel border border-line2 p-2 shadow-card">
            {searchResults.map((item) => (
              <button key={item.id} type="button" onClick={() => selectResult(item)} className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-white/5 text-left transition">
                {(item.type === "destination" || item.type === "trip" || item.type === "favorite" || item.type === "recent_search") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={destinationPhoto(item.destination || item.label, 90, 70)} alt={item.label} className="h-10 w-12 rounded-lg object-cover shrink-0" />
                ) : (
                  <span className="h-10 w-12 rounded-lg glass-card flex items-center justify-center shrink-0 text-gold">
                    <Search size={14} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm truncate">{item.label}</span>
                  {item.sublabel && <span className="block text-xs text-mist2 truncate">{item.sublabel}</span>}
                </span>
              </button>
            ))}
            {searchResults.length === 0 && <p className="px-3 py-2 text-xs text-mist2">No matches found.</p>}
          </div>
        )}
      </div>

      <div className="relative">
        <button onClick={() => setNotificationsOpen((open) => !open)} className="relative p-2 rounded-xl glass-card text-mist hover:text-gold hover:glow-gold transition">
          <Bell size={17} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-alert text-[10px] flex items-center justify-center text-white font-semibold badge-glow">
              {unreadCount}
            </span>
          )}
        </button>
        {notificationsOpen && (
          <div className="absolute right-0 mt-2 w-[22rem] max-w-[90vw] rounded-2xl glass-panel border border-line2 p-2 shadow-card">
            <div className="px-2 py-1.5 text-xs uppercase tracking-[0.18em] text-mist2">{t(language, "notifications")}</div>
            {!notificationsEnabled ? (
              <p className="px-3 py-6 text-sm text-mist2 text-center">Notifications are turned off in Settings.</p>
            ) : notifications.length === 0 ? (
              <p className="px-3 py-6 text-sm text-mist2 text-center">No notifications yet.</p>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-1">
                {notifications.map((notification) => (
                  <div key={notification.id} className={`rounded-xl border px-3 py-2.5 ${notification.is_read ? "border-line2" : "border-gold/30 bg-gold/5"}`}>
                    <div className="flex items-start gap-2">
                      <button type="button" onClick={() => openNotification(notification)} className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium truncate">{notification.title}</p>
                        <p className="text-xs text-mist2 mt-0.5 line-clamp-2">{notification.message}</p>
                        <p className="text-[10px] text-mist2 mt-1">{new Date(notification.created_at).toLocaleString("en-IN")}</p>
                      </button>
                      <button type="button" onClick={() => removeNotification(notification.id)} className="text-mist2 hover:text-alert transition mt-0.5">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl glass-card hover:glow-gold transition"
        >
          <span className="h-8 w-8 rounded-full bg-gradient-to-br from-gold to-goldDim flex items-center justify-center text-ink font-semibold text-sm">
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="hidden sm:block text-left">
            <span className="block text-sm font-medium leading-tight">{name}</span>
            <span className="block text-[11px] text-mist2 leading-tight">{auth?.user.is_guest ? "Guest" : "Traveler"}</span>
          </span>
          <ChevronDown size={14} className="text-mist2 hidden sm:block" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-48 rounded-xl glass-panel border border-line2 py-1.5 fade-scale-in shadow-card" onMouseLeave={() => setMenuOpen(false)}>
            {auth ? (
              <button
                onClick={() => {
                  logout();
                  onAuthChange(null);
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3.5 py-2 text-sm text-alert hover:bg-white/5 transition"
              >
                <LogOut size={14} /> Sign out
              </button>
            ) : (
              <p className="px-3.5 py-2 text-xs text-mist2 flex items-center gap-2">
                <UserIcon size={13} /> Not signed in
              </p>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
