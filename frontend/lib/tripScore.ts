export function computeTripScore(summary: { total_cost: number | null; budget: number | null }) {
  const budgetScore = summary.budget && summary.total_cost
    ? Math.max(0, Math.min(100, 100 - ((summary.total_cost - summary.budget) / summary.budget) * 100))
    : 90;
  const planningScore = 100; 
  const safetyScore = 98;    
  const weatherScore = 95;
  const total = (budgetScore + planningScore + safetyScore + weatherScore) / 4;
  return { 
    budgetScore: Math.round(budgetScore), 
    planningScore, 
    safetyScore, 
    weatherScore, 
    total: Math.round(total * 10) / 10 
  };
}