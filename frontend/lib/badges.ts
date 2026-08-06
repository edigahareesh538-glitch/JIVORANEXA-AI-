import { TripSummary } from "./api";

export type Badge = {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
};

export function computeBadges(trips: TripSummary[]): Badge[] {
  const completedTrips = trips.filter(t => t.status === "completed");
  const totalPlaces = trips.reduce((acc, t) => acc + (t.places_visited?.length || 0), 0);
  
  const underBudget = completedTrips.some(t => t.total_cost && t.budget && t.total_cost <= t.budget);

  return [
    {
      id: "first_trip",
      title: "First Journey",
      description: "Plan or complete your very first trip.",
      icon: "🧭",
      unlocked: trips.length > 0,
    },
    {
      id: "budget_master",
      title: "Budget Master",
      description: "Complete a trip staying under your target budget.",
      icon: "🎯",
      unlocked: underBudget,
    },
    {
      id: "explorer",
      title: "Active Explorer",
      description: "Visit more than 5 total attractions across your trips.",
      icon: "🌟",
      unlocked: totalPlaces >= 5,
    },
    {
      id: "globetrotter",
      title: "Globetrotter",
      description: "Mark at least 3 trips as completed.",
      icon: "🏆",
      unlocked: completedTrips.length >= 3,
    },
  ];
}
