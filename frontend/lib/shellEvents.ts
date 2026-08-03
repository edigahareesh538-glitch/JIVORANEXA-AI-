export type ShellNavigateDetail =
  | { type: "tab"; tab: string }
  | { type: "plan"; destination: string; transportMode?: "flight" | "train" | "bus" | "own_vehicle" | "rental_car" }
  | { type: "trip"; tripId: string };

export type SearchResultItem = {
  id: string;
  label: string;
  sublabel?: string;
  type: "destination" | "trip" | "favorite" | "hotel" | "attraction" | "recent_search" | "tab";
  destination?: string;
  tab?: string;
};

export const NAVIGATE_EVENT = "trip-agent:navigate";

export function emitNavigate(detail: ShellNavigateDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail }));
}
