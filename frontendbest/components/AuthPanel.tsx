"use client";

import { useState } from "react";
import { AuthState, getStoredAuth, loginAsGuest, loginWithEmail, loginWithGoogleIdToken, logout, registerWithEmail } from "@/lib/auth";
import { firebaseConfigured, signInWithGooglePopup } from "@/lib/firebase";

export default function AuthPanel({ auth, onAuthChange }: { auth: AuthState | null; onAuthChange: (a: AuthState | null) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<AuthState>) {
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      onAuthChange(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (auth) {
    return (
      <div className="flex items-center justify-between border border-line rounded-xl px-4 py-2.5 text-sm">
        <span className="text-mist">
          Signed in as <span className="text-[#dbe4ec] font-medium">{auth.user.display_name || auth.user.email}</span>
          {auth.user.is_guest && <span className="ml-2 text-xs text-amber">(guest)</span>}
        </span>
        <button
          className="text-xs text-alert hover:underline"
          onClick={() => {
            logout();
            onAuthChange(null);
          }}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="border border-line rounded-xl p-4 space-y-3">
      <div className="flex gap-4 text-xs uppercase tracking-wider text-mist">
        <button className={mode === "login" ? "text-amber" : ""} onClick={() => setMode("login")}>Log in</button>
        <button className={mode === "register" ? "text-amber" : ""} onClick={() => setMode("register")}>Sign up</button>
      </div>

      <input
        className="w-full bg-panel border border-line rounded px-3 py-2 text-sm outline-none focus:border-amber"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="w-full bg-panel border border-line rounded px-3 py-2 text-sm outline-none focus:border-amber"
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && <p className="text-xs text-alert">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          disabled={busy || !email || !password}
          className="bg-amber text-ink text-sm font-medium rounded px-3 py-1.5 disabled:opacity-40"
          onClick={() => run(() => (mode === "login" ? loginWithEmail(email, password) : registerWithEmail(email, password)))}
        >
          {mode === "login" ? "Log in" : "Create account"}
        </button>
        <button
          disabled={busy}
          className="border border-line text-sm rounded px-3 py-1.5 disabled:opacity-40"
          onClick={() => run(loginAsGuest)}
        >
          Continue as Guest
        </button>
        {firebaseConfigured && (
          <button
            disabled={busy}
            className="border border-line text-sm rounded px-3 py-1.5 disabled:opacity-40"
            onClick={() => run(async () => loginWithGoogleIdToken(await signInWithGooglePopup()))}
          >
            Sign in with Google
          </button>
        )}
      </div>
    </div>
  );
}

export { getStoredAuth };
