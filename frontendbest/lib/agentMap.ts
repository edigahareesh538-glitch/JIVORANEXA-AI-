import { LogEntry } from "@/lib/api";

export type AgentKey =
  | "PlannerAgent" | "ReasoningAgent" | "SearchAgent" | "WeatherAgent" | "BudgetAgent"
  | "BookingAgent" | "RecommendationAgent" | "NotificationAgent" | "MemoryAgent" | "SafetyAgent";

export const AGENT_META: Record<AgentKey, { label: string; color: string; short: string }> = {
  PlannerAgent: { label: "Planner", color: "#E8A93A", short: "PL" },
  ReasoningAgent: { label: "Reasoning", color: "#9B8AFB", short: "RE" },
  SearchAgent: { label: "Search", color: "#5B8DEF", short: "SR" },
  WeatherAgent: { label: "Weather", color: "#4FD1A5", short: "WT" },
  BudgetAgent: { label: "Budget", color: "#F0654E", short: "BU" },
  BookingAgent: { label: "Booking", color: "#E8A93A", short: "BK" },
  RecommendationAgent: { label: "Recommendation", color: "#4FD1A5", short: "RC" },
  NotificationAgent: { label: "Notification", color: "#8FA1B3", short: "NT" },
  MemoryAgent: { label: "Memory", color: "#9B8AFB", short: "ME" },
  SafetyAgent: { label: "Safety", color: "#F0654E", short: "SF" },
};

export const AGENT_ORDER: AgentKey[] = [
  "PlannerAgent", "MemoryAgent", "SearchAgent", "BudgetAgent", "BookingAgent",
  "WeatherAgent", "ReasoningAgent", "RecommendationAgent", "SafetyAgent", "NotificationAgent",
];

/** Best-effort mapping from a plain-text action-log line to the agent that
 * produced it -- matched against the exact phrasing app/workflow/*.py logs. */
export function classifyLogEntry(entry: LogEntry): AgentKey {
  const m = entry.message.toLowerCase();

  if (m.includes("goal received") || m.includes("final itinerary")) return "PlannerAgent";
  if (m.includes("resumed") || m.includes("session")) return "MemoryAgent";
  if (m.includes("destination") || m.includes("flight") || m.includes("route & map")) return "SearchAgent";
  if (m.includes("budget detected")) return "BudgetAgent";
  if (m.includes("book_hotel") || m.includes("hotel") && (m.includes("retry") || m.includes("failing") || m.includes("succeeded"))) return "BookingAgent";
  if (m.includes("weather retrieved")) return "WeatherAgent";
  if (m.includes("budget check") || m.includes("budget exceeded") || m.includes("switched to")) return "ReasoningAgent";
  if (m.includes("rain expected") || m.includes("indoor attractions") || m.includes("outdoor plan kept")) return "ReasoningAgent";
  if (m.includes("attraction") || m.includes("crowd")) return "RecommendationAgent";
  if (m.includes("sos") || m.includes("emergency") || m.includes("hospital")) return "SafetyAgent";
  if (m.includes("alert") || m.includes("notif")) return "NotificationAgent";
  return "PlannerAgent";
}
