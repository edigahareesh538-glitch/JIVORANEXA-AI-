"use client";

import { useState } from "react";
import { UserCog, X } from "lucide-react";
import { updateProfile, TripProfile } from "@/lib/api";

const TRANSPORT_OPTIONS = ["flight", "train", "bus", "own_vehicle", "rental_car"];
const FOOD_OPTIONS = ["no_preference", "veg", "non_veg", "vegan", "jain"];
const HOTEL_OPTIONS = ["budget", "3_star", "4_star", "luxury"];

export default function TripProfileModal({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TripProfile>({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof TripProfile>(key: K, value: TripProfile[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setBusy(true);
    try {
      await updateProfile(form);
      setSaved(true);
    } catch {
      setSaved(false);
    } finally {
      setBusy(false);
    }
  }

  if (!loggedIn) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-line text-mist hover:text-amber hover:border-amber/50 transition"
      >
        <UserCog size={13} />
        Trip Profile
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md glass-strong rounded-xl p-5 fade-scale-in max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs uppercase tracking-[0.2em] text-mist">
                Before we plan — a few details help personalize everything
              </p>
              <button onClick={() => setOpen(false)}>
                <X size={16} className="text-mist" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Name">
                <input value={form.display_name ?? ""} onChange={(e) => set("display_name", e.target.value)} className="input" />
              </Field>
              <Field label="Age">
                <input type="number" value={form.age ?? ""} onChange={(e) => set("age", Number(e.target.value) || undefined)} className="input" />
              </Field>
              <Field label="Travellers">
                <input type="number" value={form.num_travelers ?? ""} onChange={(e) => set("num_travelers", Number(e.target.value) || undefined)} className="input" />
              </Field>
              <Field label="Phone">
                <input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} className="input" />
              </Field>
              <Field label="Preferred Transport">
                <select value={form.preferred_transport ?? ""} onChange={(e) => set("preferred_transport", e.target.value as TripProfile["preferred_transport"])} className="input">
                  <option value="">—</option>
                  {TRANSPORT_OPTIONS.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                </select>
              </Field>
              <Field label="Food Preference">
                <select value={form.food_preference ?? ""} onChange={(e) => set("food_preference", e.target.value)} className="input">
                  <option value="">—</option>
                  {FOOD_OPTIONS.map((f) => <option key={f} value={f}>{f.replace("_", " ")}</option>)}
                </select>
              </Field>
              <Field label="Hotel Type">
                <select value={form.hotel_type ?? ""} onChange={(e) => set("hotel_type", e.target.value)} className="input">
                  <option value="">—</option>
                  {HOTEL_OPTIONS.map((h) => <option key={h} value={h}>{h.replace("_", " ")}</option>)}
                </select>
              </Field>
              <Field label="Emergency Contact Name">
                <input value={form.emergency_contact_name ?? ""} onChange={(e) => set("emergency_contact_name", e.target.value)} className="input" />
              </Field>
              <Field label="Emergency Contact Phone">
                <input value={form.emergency_contact_phone ?? ""} onChange={(e) => set("emergency_contact_phone", e.target.value)} className="input" />
              </Field>
            </div>

            <button
              onClick={handleSave}
              disabled={busy}
              className="w-full mt-5 bg-amber text-ink font-semibold text-sm rounded-xl py-2.5 disabled:opacity-50"
            >
              {saved ? "Saved ✓" : busy ? "Saving…" : "Save Profile"}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .input {
          width: 100%;
          background: #0b0f14;
          border: 1px solid rgba(143, 161, 179, 0.25);
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 13px;
          outline: none;
        }
        .input:focus {
          border-color: #e8a93a;
        }
      `}</style>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-mist block mb-1">{label}</span>
      {children}
    </label>
  );
}
