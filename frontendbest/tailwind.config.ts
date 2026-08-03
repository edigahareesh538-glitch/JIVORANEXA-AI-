import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#06070B",
        void: "#000000",
        panel: "#0F1118",
        panel2: "#151824",
        glass: "rgba(255,255,255,0.04)",
        line: "#242838",
        line2: "rgba(255,255,255,0.09)",
        gold: "#F5B841",
        goldDim: "#B98B2E",
        amber: "#F5B841",
        signal: "#4FD1A5",
        alert: "#F0654E",
        mist: "#9AA3B5",
        mist2: "#5C6472",
        // Multi-accent glow palette
        aBlue: "#4F8DFF",
        aPurple: "#A76BFF",
        aPink: "#FF6FB0",
        aCyan: "#39E5D6",
        aOrange: "#FF9B54",
      },
      fontFamily: {
        display: ["Space Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl2: "18px",
        "2xl": "20px",
        "3xl": "24px",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(245,184,65,0.15), 0 8px 30px rgba(245,184,65,0.08)",
        glowBlue: "0 0 0 1px rgba(79,141,255,0.25), 0 8px 30px rgba(79,141,255,0.15)",
        glowPurple: "0 0 0 1px rgba(167,107,255,0.25), 0 8px 30px rgba(167,107,255,0.15)",
        glowPink: "0 0 0 1px rgba(255,111,176,0.25), 0 8px 30px rgba(255,111,176,0.15)",
        glowCyan: "0 0 0 1px rgba(57,229,214,0.25), 0 8px 30px rgba(57,229,214,0.15)",
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 32px rgba(0,0,0,0.45)",
      },
      backdropBlur: {
        xs: "3px",
      },
    },
  },

  plugins: [],
};
export default config;
