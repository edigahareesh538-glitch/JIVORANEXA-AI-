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
    <div className="space-y-6 rise-in max-w-3xl">
      <div className="glass-card rounded-2xl p-6 flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-gold to-goldDim flex items-center justify-center text-ink font-display font-bold text-2xl shrink-0">
          {(auth?.user.display_name || auth?.user.email || "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold truncate">{auth ? auth.user.display_name || "Traveler" : "Not signed in"}</h2>
          {auth?.user.email && (
            <p className="text-sm text-mist2 flex items-center gap-1.5 mt-0.5">
              <Mail size={13} /> {auth.user.email}
            </p>
          )}
          {auth?.user.is_guest && <p className="text-xs text-gold mt-1">Guest session</p>}
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-mist2 mb-4">Account</p>
        <AuthPanel auth={auth} onAuthChange={onAuthChange} />
      </div>

      {auth && (
        <div className="glass-card rounded-2xl p-6">
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

          <button onClick={handleSave} disabled={busy} className="mt-5 flex items-center gap-2 bg-gradient-to-r from-gold to-goldDim text-ink font-semibold text-sm rounded-xl px-5 py-2.5 disabled:opacity-50 hover:brightness-110 transition">
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
          padding: 8px 12px;
          font-size: 13px;
          outline: none;
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
