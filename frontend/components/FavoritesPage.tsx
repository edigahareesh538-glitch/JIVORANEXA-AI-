"use client";

import { useEffect, useState } from "react";
import { Heart, MapPin, Send, Trash2 } from "lucide-react";
import { listFavorites, FavoritePlace, removeFavorite } from "@/lib/api";
import { destinationPhoto, destinationAccent } from "@/lib/destinations";

export default function FavoritesPage({ loggedIn, onPlan }: { loggedIn: boolean; onPlan: (destination: string) => void }) {
  const [items, setItems] = useState<FavoritePlace[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setItems(await listFavorites());
    } catch {
      setError("Sign in to see your favorites.");
    }
  }

  useEffect(() => {
    if (!loggedIn) return;
    refresh();
  }, [loggedIn]);

  async function remove(id: string) {
    await removeFavorite(id);
    refresh();
  }

  if (!loggedIn) {
    return (
      <div className="glass-panel rounded-3xl p-10 text-center rise-in">
        <Heart size={22} className="mx-auto text-mist2 mb-3" />
        <p className="text-sm text-mist">Sign in from the Profile tab to save and see your favorite places.</p>
      </div>
    );
  }

  if (error) return <p className="text-sm text-alert">{error}</p>;
  if (!items.length) {
    return (
      <div className="glass-panel rounded-3xl p-10 text-center rise-in">
        <Heart size={22} className="mx-auto text-mist2 mb-3" />
        <p className="text-sm text-mist">No favorites yet — save destinations from your trip results to see them here.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger rise-in">
      {items.map((f) => {
        const dest = f.destination || f.name;
        const accent = destinationAccent(dest);
        return (
          <div key={f.id} className="glass-panel rounded-3xl overflow-hidden glow-hover group">
            <div className="relative h-32">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={destinationPhoto(dest, 480, 260)} alt={f.name} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/10 to-transparent" />
              <Heart size={16} className={`absolute top-3 right-3 ${accent.text} fill-current`} />
            </div>
            <div className="p-4">
              <h3 className="font-display font-semibold text-[15px] flex items-center gap-1.5">
                <MapPin size={14} className={accent.text} /> {f.name}
              </h3>
              {f.destination && <p className="text-xs text-mist2 mt-0.5">{f.destination}</p>}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => onPlan(dest)} className="flex items-center justify-center gap-1.5 text-xs font-semibold rounded-xl py-2 bg-gradient-to-r from-gold to-goldDim text-ink hover:brightness-110 transition">
                  <Send size={12} /> Plan Trip
                </button>
                <button onClick={() => remove(f.id)} className="flex items-center justify-center gap-1.5 text-xs font-semibold rounded-xl py-2 border border-alert/30 text-alert hover:bg-alert/10 transition">
                  <Trash2 size={12} /> Remove
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
