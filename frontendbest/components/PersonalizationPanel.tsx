"use client";

import { useEffect, useState } from "react";
import { Sparkles, Save, Heart, Utensils, Bus, MapPin, CheckCircle2 } from "lucide-react";
import { getPersonalization, updatePersonalization } from "@/lib/api";

interface UserPreferences {
  hotel_preference?: string;
  food_preference?: string;
  transport_preference?: string;
  budget_band?: string;
  favourite_destinations?: string[];
  num_travelers?: number;
  [key: string]: unknown;
}

export default function PersonalizationPanel({ loggedIn }: { loggedIn: boolean }) {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [destination, setDestination] = useState("");
  const [hotel, setHotel] = useState("");
  const [food, setFood] = useState("");
  const [transport, setTransport] = useState("");
  const [budgetBand, setBudgetBand] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!loggedIn) return;
    async function load() {
      try {
        const data = (await getPersonalization()) as UserPreferences;
        setPrefs(data);
        
        // Populate form fields with fetched memory
        setHotel(data.hotel_preference ?? "");
        setFood(data.food_preference ?? "");
        setTransport(data.transport_preference ?? "");
        setBudgetBand(data.budget_band ?? "");
        if (Array.isArray(data.favourite_destinations)) {
          setDestination(data.favourite_destinations.join(", "));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load personalization.");
      }
    }
    load();
  }, [loggedIn]);

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await updatePersonalization({
        hotel_preference: hotel || undefined,
        food_preference: food || undefined,
        transport_preference: transport || undefined,
        budget_band: budgetBand || undefined,
        favourite_destinations: destination
          ? destination.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
      });

      const updated = (await getPersonalization()) as UserPreferences;
      setPrefs(updated);
      setSuccess("Preferences saved successfully!");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!loggedIn) {
    return (
      <div className="glass-panel rounded-2xl p-6">
        <p className="text-sm text-mist2">Sign in so future plans can auto-bias to your preferences.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 rise-in">
      {/* Top Banner */}
      <div className="glass-panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
          <Sparkles size={13} className="text-amber" /> AI Personalization
        </p>
        <p className="text-sm text-mist2 mt-1">
          Tell JivoraNexa what you love — the next trip pre-fills budget, hotel tier, food choice and transport.
        </p>
      </div>

      {/* Form Section */}
      <div className="glass-panel rounded-2xl p-5 space-y-3">
        <label className="block text-xs text-mist2">
          Favourite destinations (comma separated)
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Goa, Jaipur, Visakhapatnam"
            className="mt-1 w-full bg-panel border border-line rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber"
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block text-xs text-mist2">
            Hotel preference
            <select
              value={hotel}
              onChange={(e) => setHotel(e.target.value)}
              className="mt-1 w-full bg-panel border border-line rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber"
            >
              <option value="">— keep current —</option>
              <option value="budget">Budget</option>
              <option value="3_star">3-star</option>
              <option value="4_star">4-star</option>
              <option value="luxury">Luxury</option>
            </select>
          </label>

          <label className="block text-xs text-mist2">
            Food preference
            <select
              value={food}
              onChange={(e) => setFood(e.target.value)}
              className="mt-1 w-full bg-panel border border-line rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber"
            >
              <option value="">— keep current —</option>
              <option value="veg">Vegetarian</option>
              <option value="non_veg">Non-veg</option>
              <option value="vegan">Vegan</option>
              <option value="jain">Jain</option>
              <option value="no_preference">No preference</option>
            </select>
          </label>

          <label className="block text-xs text-mist2">
            Transport preference
            <select
              value={transport}
              onChange={(e) => setTransport(e.target.value)}
              className="mt-1 w-full bg-panel border border-line rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber"
            >
              <option value="">— keep current —</option>
              <option value="flight">Flight</option>
              <option value="train">Train</option>
              <option value="bus">Bus</option>
              <option value="own_vehicle">Own Vehicle</option>
              <option value="rental_car">Rental Car</option>
            </select>
          </label>

          <label className="block text-xs text-mist2">
            Budget band
            <select
              value={budgetBand}
              onChange={(e) => setBudgetBand(e.target.value)}
              className="mt-1 w-full bg-panel border border-line rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber"
            >
              <option value="">— keep current —</option>
              <option value="low">Low (≤ ₹10,000)</option>
              <option value="mid">Mid (₹10–30k)</option>
              <option value="high">High (≥ ₹30,000)</option>
            </select>
          </label>
        </div>

        <div className="pt-2 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={busy}
            className="text-xs px-4 py-2 rounded-lg bg-gradient-to-r from-amber to-amberDim text-ink font-semibold disabled:opacity-60 flex items-center gap-1.5 transition"
          >
            <Save size={12} /> {busy ? "Saving…" : "Save preferences"}
          </button>
          {success && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={12} /> {success}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-alert">{error}</p>}
      </div>

      {/* Styled Current Preferences Display */}
      {prefs && (
        <div className="glass-panel rounded-2xl p-5 space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
            <Heart size={13} className="text-amber" /> Current Preferences
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-panel border border-line rounded-xl">
              <span className="text-[10px] text-mist2 uppercase block flex items-center gap-1">
                <Utensils size={10} /> Food
              </span>
              <span className="text-xs font-semibold text-white capitalize mt-1 block">
                {prefs.food_preference || "Not set"}
              </span>
            </div>

            <div className="p-3 bg-panel border border-line rounded-xl">
              <span className="text-[10px] text-mist2 uppercase block flex items-center gap-1">
                <Bus size={10} /> Transport
              </span>
              <span className="text-xs font-semibold text-white capitalize mt-1 block">
                {prefs.transport_preference || "Not set"}
              </span>
            </div>

            <div className="p-3 bg-panel border border-line rounded-xl">
              <span className="text-[10px] text-mist2 uppercase block">Hotel Tier</span>
              <span className="text-xs font-semibold text-white capitalize mt-1 block">
                {prefs.hotel_preference || "Not set"}
              </span>
            </div>

            <div className="p-3 bg-panel border border-line rounded-xl">
              <span className="text-[10px] text-mist2 uppercase block">Budget Band</span>
              <span className="text-xs font-semibold text-white capitalize mt-1 block">
                {prefs.budget_band || "Not set"}
              </span>
            </div>
          </div>

          <div className="p-4 bg-panel border border-line rounded-xl space-y-2">
            <span className="text-xs text-mist2 flex items-center gap-1">
              <MapPin size={12} className="text-amber" /> Favourite Destinations
            </span>
            <div className="flex flex-wrap gap-2">
              {Array.isArray(prefs.favourite_destinations) && prefs.favourite_destinations.length > 0 ? (
                prefs.favourite_destinations.map((dest, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-amber/10 border border-amber/30 text-amber rounded-full text-xs font-medium"
                  >
                    📍 {dest}
                  </span>
                ))
              ) : (
                <span className="text-xs text-mist2 italic">No favorite places saved</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}