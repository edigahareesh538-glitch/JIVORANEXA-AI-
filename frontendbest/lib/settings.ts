export type AppTheme = "dark" | "light" | "sunset" | "ocean" | "system";
export type AppLanguage = "English" | "हिन्दी" | "తెలుగు";
export type AppUnits = "metric" | "imperial";
export type AppDateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
export type AppTimeFormat = "12h" | "24h";

export type AppSettings = {
  notifications: boolean;
  aiSuggestions: boolean;
  compactMode: boolean;
  shareAnalytics: boolean;
  privacyMode: boolean;
  accountPrivate: boolean;
  language: AppLanguage;
  currency: string;
  theme: AppTheme;
  // BUGFIX (Bug 5): these existed nowhere before -- Settings had no way
  // to actually change units/date format/time format, so there was
  // nothing for the rest of the app to read even if it wanted to.
  units: AppUnits;
  dateFormat: AppDateFormat;
  timeFormat: AppTimeFormat;
};

export const SETTINGS_KEY = "trip_agent_settings";
export const SETTINGS_EVENT = "trip-agent:settings-changed";

export const DEFAULT_SETTINGS: AppSettings = {
  notifications: true,
  aiSuggestions: true,
  compactMode: false,
  shareAnalytics: true,
  privacyMode: false,
  accountPrivate: false,
  language: "English",
  currency: "INR",
  theme: "dark",
  units: "metric",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "24h",
};

export function getStoredSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applySettings(settings);
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: settings }));
}

/** Resolves "system" against the OS/browser preference; every other
 * theme value passes through unchanged. */
export function resolveTheme(theme: AppTheme): Exclude<AppTheme, "system"> {
  if (theme !== "system") return theme;
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** Formats an amount using the user's chosen currency setting instead of
 * a hardcoded ₹/INR string. Falls back gracefully for unknown codes. */
export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-IN")}`;
  }
}

export function formatDate(date: Date, format: AppDateFormat): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  if (format === "MM/DD/YYYY") return `${m}/${d}/${y}`;
  if (format === "YYYY-MM-DD") return `${y}-${m}-${d}`;
  return `${d}/${m}/${y}`;
}

export function formatTime(date: Date, format: AppTimeFormat): string {
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: format === "12h" });
}

export function applySettings(settings: AppSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(settings.theme);
  root.dataset.compact = settings.compactMode ? "true" : "false";
  root.lang = settings.language === "English" ? "en" : settings.language === "हिन्दी" ? "hi" : "te";
}

export function subscribeToSettings(callback: (settings: AppSettings) => void) {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => callback((event as CustomEvent<AppSettings>).detail);
  window.addEventListener(SETTINGS_EVENT, handler as EventListener);
  return () => window.removeEventListener(SETTINGS_EVENT, handler as EventListener);
}

const DICTIONARY = {
  English: {
    dashboard: "Dashboard",
    plan: "Plan Trip",
    trips: "My Trips",
    expenses: "Expenses",
    currency: "Currency Converter",
    sos: "Emergency SOS",
    messages: "Messages",
    favorites: "Favorites",
    profile: "Profile",
    settings: "Settings",
    help: "Help Center",
    invite: "Invite Friends",
    premium: "Premium Membership",
    searchPlaceholder: "Search destinations, trips, places…",
    notifications: "Notifications",
    darkMode: "Dark Mode",
    lightMode: "Light Mode",
  },
  "हिन्दी": {
    dashboard: "डैशबोर्ड",
    plan: "यात्रा योजना",
    trips: "मेरी यात्राएँ",
    expenses: "खर्चे",
    currency: "मुद्रा परिवर्तक",
    sos: "आपातकालीन SOS",
    messages: "संदेश",
    favorites: "पसंदीदा",
    profile: "प्रोफ़ाइल",
    settings: "सेटिंग्स",
    help: "सहायता केंद्र",
    invite: "दोस्तों को आमंत्रित करें",
    premium: "प्रीमियम सदस्यता",
    searchPlaceholder: "गंतव्य, यात्राएँ, स्थान खोजें…",
    notifications: "सूचनाएँ",
    darkMode: "डार्क मोड",
    lightMode: "लाइट मोड",
  },
  "తెలుగు": {
    dashboard: "డ్యాష్‌బోర్డ్",
    plan: "ట్రిప్ ప్లాన్",
    trips: "నా ట్రిప్స్",
    expenses: "ఖర్చులు",
    currency: "కరెన్సీ కన్వర్టర్",
    sos: "ఎమర్జెన్సీ SOS",
    messages: "సందేశాలు",
    favorites: "ఇష్టమైనవి",
    profile: "ప్రొఫైల్",
    settings: "సెట్టింగ్స్",
    help: "సహాయ కేంద్రం",
    invite: "స్నేహితులను ఆహ్వానించండి",
    premium: "ప్రీమియం సభ్యత్వం",
    searchPlaceholder: "గమ్యస్థానాలు, ట్రిప్స్, ప్రదేశాలు వెతకండి…",
    notifications: "నోటిఫికేషన్లు",
    darkMode: "డార్క్ మోడ్",
    lightMode: "లైట్ మోడ్",
  },
} satisfies Record<AppLanguage, Record<string, string>>;

export function t(language: AppLanguage, key: keyof typeof DICTIONARY.English): string {
  return DICTIONARY[language]?.[key] || DICTIONARY.English[key] || key;
}
