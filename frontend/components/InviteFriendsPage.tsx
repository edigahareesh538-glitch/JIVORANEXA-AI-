"use client";

import { useState } from "react";
import { Check, Copy, Gift, Share2 } from "lucide-react";

export default function InviteFriendsPage() {
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window !== "undefined" ? window.location.origin : "https://trip-agent.app";
  const message = `Plan your next trip in seconds with Trip Agent — an AI travel planner: ${shareUrl}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available -- link is still selectable in the input */
    }
  }

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Trip Agent", text: message, url: shareUrl });
      } catch {
        /* user cancelled */
      }
    } else {
      copyLink();
    }
  }

  return (
    <div className="rise-in max-w-2xl mx-auto space-y-6">
      <div className="glass-panel rounded-3xl p-8 text-center relative overflow-hidden">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-aPink to-aPurple flex items-center justify-center glow-purple mb-4">
          <Gift size={26} className="text-white" />
        </div>
        <h2 className="font-display text-2xl font-semibold text-gradient-hero">Invite friends, plan together</h2>
        <p className="text-sm text-mist2 mt-2 max-w-sm mx-auto">
          Share Trip Agent with friends and family so you can plan trips together with the same AI assistant.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
          <input
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 bg-panel2 border border-line2 rounded-xl px-3.5 py-2.5 text-sm outline-none glow-input"
          />
          <button
            onClick={copyLink}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-panel2 border border-line2 text-sm hover:border-gold/50 hover:text-gold transition"
          >
            {copied ? <Check size={14} className="text-signal" /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <button
          onClick={nativeShare}
          className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-gold to-goldDim text-ink text-sm font-semibold hover:brightness-110 transition"
        >
          <Share2 size={15} /> Share Link
        </button>
      </div>

      <p className="text-xs text-mist2 text-center">
        This shares a link to the app itself — referral tracking and rewards aren't wired up on the backend yet.
      </p>
    </div>
  );
}
