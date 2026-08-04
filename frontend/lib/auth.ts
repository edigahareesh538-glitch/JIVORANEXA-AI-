"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://jivoranexa-ai.onrender.com";
const TOKEN_KEY = "trip_agent_token";

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

async function handle(res: Response): Promise<AuthState> {
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
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, display_name: displayName }),
  });
  return handle(res);
}

export async function loginWithEmail(email: string, password: string): Promise<AuthState> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handle(res);
}

export async function loginAsGuest(): Promise<AuthState> {
  const res = await fetch(`${API_URL}/api/auth/guest`, { method: "POST" });
  return handle(res);
}

/** Requires Firebase to be configured on both frontend (lib/firebase.ts)
 * and backend (FIREBASE_SERVICE_ACCOUNT_JSON). Throws a clear 501 error
 * from the backend otherwise -- see README "Auth" section. */
export async function loginWithGoogleIdToken(idToken: string): Promise<AuthState> {
  const res = await fetch(`${API_URL}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
  return handle(res);
}
