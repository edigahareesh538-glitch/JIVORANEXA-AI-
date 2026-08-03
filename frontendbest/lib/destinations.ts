// Deterministic "real photo" URLs per destination, backed by Picsum's seeded
// photo API (https://picsum.photos/seed/<seed>/<w>/<h>) -- these are real
// photographs (not solid-color placeholders) and the URL pattern always
// resolves, which matters since we can't hand-verify every image link.
// Swap this for a licensed travel-image API (Unsplash API, Pexels API, or
// your own CDN) when you have API keys -- see README.

export function destinationPhoto(destination: string, w = 640, h = 420): string {
  const seed = encodeURIComponent(destination.split(",")[0].trim().toLowerCase());
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}

const ACCENTS = [
  { name: "blue", text: "text-aBlue", from: "from-aBlue/35", ring: "ring-aBlue/40", glow: "glow-blue" },
  { name: "purple", text: "text-aPurple", from: "from-aPurple/35", ring: "ring-aPurple/40", glow: "glow-purple" },
  { name: "pink", text: "text-aPink", from: "from-aPink/35", ring: "ring-aPink/40", glow: "glow-pink" },
  { name: "cyan", text: "text-aCyan", from: "from-aCyan/35", ring: "ring-aCyan/40", glow: "glow-cyan" },
  { name: "orange", text: "text-aOrange", from: "from-aOrange/35", ring: "ring-aOrange/40", glow: "glow-orange" },
  { name: "gold", text: "text-gold", from: "from-gold/35", ring: "ring-gold/40", glow: "glow-gold" },
];

export function destinationAccent(destination: string) {
  let hash = 0;
  for (let i = 0; i < destination.length; i++) hash = (hash * 31 + destination.charCodeAt(i)) >>> 0;
  return ACCENTS[hash % ACCENTS.length];
}

export const POPULAR_DESTINATIONS = [
  { name: "Goa", tag: "Beach Paradise", rating: 4.6 },
  { name: "Manali", tag: "Himalayan Escape", rating: 4.5 },
  { name: "Kerala", tag: "God's Own Country", rating: 4.7 },
  { name: "Ladakh", tag: "Adventure Awaits", rating: 4.8 },
  { name: "Udaipur", tag: "City of Lakes", rating: 4.6 },
  { name: "Rishikesh", tag: "Spiritual Escape", rating: 4.5 },
  { name: "Darjeeling", tag: "Tea Garden Beauty", rating: 4.4 },
  { name: "Jaipur", tag: "Pink City", rating: 4.5 },
];
