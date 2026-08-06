"use client";

const TOKEN_KEY = "trip_agent_token";
const DEFAULT_API_URLS = [
  process.env.NEXT_PUBLIC_API_URL?.trim(),
  "https://jivoranexa-ai.onrender.com",
  "http://127.0.0.1:8000",
  "http://localhost:8000",
].filter((value): value is string => Boolean(value));
const API_URLS = Array.from(new Set(DEFAULT_API_URLS));

export type AuthUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  photo_url: string | null;
  auth_provider: string;
  is_guest: boolean;
  is_admin?: boolean;
  home_currency: string;
  age?: number | null;
  phone?: string | null;
  num_travelers?: number | null;
  preferred_transport?: string | null;
  food_preference?: string | null;
  hotel_type?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
};

export type AuthState = { token: string; user: AuthUser };

export function saveAuth(state: AuthState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, JSON.stringify(state));
}

export function updateStoredUser(user: AuthUser) {
  const current = getStoredAuth();
  if (!current) return null;
  const next = { ...current, user };
  saveAuth(next);
  return next;
}

export function getStoredAuth(): AuthState | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

export function authHeaders(): Record<string, string> {
  const auth = getStoredAuth();
  return auth ? { Authorization: `Bearer ${auth.token}` } : {};
}

async function requestWithFallback(path: string, init: RequestInit = {}): Promise<Response> {
  let lastError: unknown;

  for (const baseUrl of API_URLS) {
    try {
      const res = await fetch(`${baseUrl}${path}`, init);
      if (res.ok || res.status !== 404) {
        return res;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw new Error(lastError.message);
  }
  throw new Error("Unable to reach the app API.");
}

async function handle(path: string, init: RequestInit = {}): Promise<AuthState> {
  const res = await requestWithFallback(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Auth request failed: ${res.status}`);
  }
  const data = await res.json();
  const state: AuthState = { token: data.access_token, user: data.user };
  saveAuth(state);
  return state;
}

export async function registerWithEmail(email: string, password: string, displayName?: string): Promise<AuthState> {
  return handle("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, display_name: displayName }),
  });
}

export async function loginWithEmail(email: string, password: string): Promise<AuthState> {
  return handle("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function loginAsGuest(): Promise<AuthState> {
  return handle("/api/auth/guest", { method: "POST" });
}

/** Requires Firebase to be configured on both frontend (lib/firebase.ts)
 * and backend (FIREBASE_SERVICE_ACCOUNT_JSON). Throws a clear 501 error
 * from the backend otherwise -- see README "Auth" section. */
export async function loginWithGoogleIdToken(idToken: string): Promise<AuthState> {
  return handle("/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
}
export async function fetchCurrentUser(token: string): Promise<AuthUser> {
  const res = await requestWithFallback("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to load profile: ${res.status}`);
  }
  return (await res.json()) as AuthUser;
}
