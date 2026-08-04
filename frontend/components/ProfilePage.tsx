"use client";

import { useEffect, useState } from "react";
import { Mail, Phone, Save, User } from "lucide-react";
import { AuthState, saveAuth } from "@/lib/auth";
import { TripProfile, updateProfile } from "@/lib/api";
import AuthPanel from "@/components/AuthPanel";

const TRANSPORT_OPTIONS = ["flight", "train", "bus", "own_vehicle", "rental_car"];
const FOOD_OPTIONS = ["no_preference", "veg", "non_veg", "vegan", "jain"];
const HOTEL_OPTIONS = ["budget", "3_star", "4_star", "luxury"];

export default function ProfilePage({
  auth,
  onAuthChange,
}: {
  auth: AuthState | null;
  onAuthChange: (a: AuthState | null) => void;
}) {
  const [form, setForm] = useState<TripProfile>({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth) {
      setForm({});
      return;
    }
    setForm({
      display_name: auth.user.display_name || undefined,
      age: auth.user.age ?? undefined,
      phone: auth.user.phone || undefined,
      num_travelers: auth.user.num_travelers ?? undefined,
      preferred_transport: auth.user.preferred_transport as TripProfile["preferred_transport"],
      food_preference: auth.user.food_preference || undefined,
      hotel_type: auth.user.hotel_type || undefined,
      emergency_contact_name: auth.user.emergency_contact_name || undefined,
      emergency_contact_phone: auth.user.emergency_contact_phone || undefined,
    });
  }, [auth]);

  function set<K extends keyof TripProfile>(key: K, value: TripProfile[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    if (!auth) return;
    setBusy(true);
    try {
      const user = await updateProfile(form);
      const next = { ...auth, user };
      saveAuth(next);
      onAuthChange(next);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 rise-in max-w-3xl mx-auto px-2 sm:px-0">
      <div className="glass-card rounded-2xl p-4 sm:p-6 flex items-center gap-4">
        <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-gradient-to-br from-gold to-goldDim flex items-center justify-center text-ink font-display font-bold text-xl sm:text-2xl shrink-0">
          {(auth?.user.display_name || auth?.user.email || "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-base sm:text-lg font-semibold truncate">{auth ? auth.user.display_name || "Traveler" : "Not signed in"}</h2>
          {auth?.user.email && (
            <p className="text-xs sm:text-sm text-mist2 flex items-center gap-1.5 mt-0.5 truncate">
              <Mail size={13} className="shrink-0" /> <span className="truncate">{auth.user.email}</span>
            </p>
          )}
          {auth?.user.is_guest && <p className="text-xs text-gold mt-1">Guest session</p>}
        </div>
      </div>

      <div className="glass-card rounded-2xl p-4 sm:p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-mist2 mb-4">Account</p>
        
        {/* Auth Panel */}
        <AuthPanel auth={auth} onAuthChange={onAuthChange} />

        {/* Continue with Google Button */}
        {!auth && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => {
                window.location.href = `${process.env.NEXT_PUBLIC_API_URL || "https://jivoranexa-ai.onrender.com"}/api/auth/google`;
              }}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white transition font-medium text-sm"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continue with Google
            </button>
          </div>
        )}
      </div>

      {auth && (
        <div className="glass-card rounded-2xl p-4 sm:p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-mist2 mb-4 flex items-center gap-1.5">
            <User size={13} /> Travel Preferences
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Name">
              <input value={form.display_name ?? ""} onChange={(e) => set("display_name", e.target.value)} className="profile-input" />
            </Field>
            <Field label="Age">
              <input type="number" value={form.age ?? ""} onChange={(e) => set("age", Number(e.target.value) || undefined)} className="profile-input" />
            </Field>
            <Field label="Travellers">
              <input type="number" value={form.num_travelers ?? ""} onChange={(e) => set("num_travelers", Number(e.target.value) || undefined)} className="profile-input" />
            </Field>
            <Field label="Phone">
              <div className="relative">
                <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist2" />
                <input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} className="profile-input pl-8" />
              </div>
            </Field>
            <Field label="Preferred Transport">
              <select value={form.preferred_transport ?? ""} onChange={(e) => set("preferred_transport", e.target.value as TripProfile["preferred_transport"])} className="profile-input">
                <option value="">—</option>
                {TRANSPORT_OPTIONS.map((t) => <option key={t} value={t}>{t.replaceAll("_", " ")}</option>)}
              </select>
            </Field>
            <Field label="Food Preference">
              <select value={form.food_preference ?? ""} onChange={(e) => set("food_preference", e.target.value)} className="profile-input">
                <option value="">—</option>
                {FOOD_OPTIONS.map((f) => <option key={f} value={f}>{f.replaceAll("_", " ")}</option>)}
              </select>
            </Field>
            <Field label="Hotel Type">
              <select value={form.hotel_type ?? ""} onChange={(e) => set("hotel_type", e.target.value)} className="profile-input">
                <option value="">—</option>
                {HOTEL_OPTIONS.map((h) => <option key={h} value={h}>{h.replaceAll("_", " ")}</option>)}
              </select>
            </Field>
            <Field label="Emergency Contact Name">
              <input value={form.emergency_contact_name ?? ""} onChange={(e) => set("emergency_contact_name", e.target.value)} className="profile-input" />
            </Field>
            <Field label="Emergency Contact Phone">
              <input value={form.emergency_contact_phone ?? ""} onChange={(e) => set("emergency_contact_phone", e.target.value)} className="profile-input" />
            </Field>
          </div>

          <button onClick={handleSave} disabled={busy} className="mt-5 flex items-center justify-center gap-2 w-full sm:w-auto bg-gradient-to-r from-gold to-goldDim text-ink font-semibold text-sm rounded-xl px-5 py-2.5 disabled:opacity-50 hover:brightness-110 transition">
            <Save size={15} />
            {saved ? "Saved ✓" : busy ? "Saving…" : "Save Preferences"}
          </button>
        </div>
      )}

      <style jsx>{`
        .profile-input {
          width: 100%;
          background: #0b0f14;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 10px 12px;
          font-size: 14px;
          outline: none;
          color: white;
        }
        .profile-input:focus {
          border-color: #f5b841;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-mist2 block mb-1">{label}</span>
      {children}
    </label>
  );
}