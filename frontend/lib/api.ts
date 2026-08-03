export type LogEntry = {
  timestamp: string;
  message: string;
  status: "ok" | "retry" | "error" | "info";
  data?: Record<string, unknown>;
};

export type RoutePoint = {
  label: string;
  lat: number;
  lng: number;
  type: "destination" | "hotel" | "airport" | "bus" | "train" | "user";
};

export type Route = {
  center: { lat: number; lng: number };
  path: [number, number][];
  directions: {
    drive: string;
    walk: string;
    transit: string;
  };
  points: RoutePoint[];
};

export type CurrentLocation = {
  lat: number;
  lng: number;
  label?: string;
};

export type PlaceInfo = {
  place: string;
  city: string;
  country: string;
  description: string;
  mock_mode: boolean;
};

export type TransportMode = "flight" | "train" | "bus" | "own_vehicle" | "rental_car";

export type PlanResult = {
  session_id: string;
  trip_summary: string;
  destination: string;
  budget: number;
  total_cost: number;
  within_budget: boolean;
  transport_mode: TransportMode;
  flight: {
    airline?: string; label?: string; price: number; duration_hr?: number;
    mode?: string; provider?: string; note?: string;
    breakdown?: { fuel_estimate: number; parking_estimate: number; rental_estimate: number };
  } | null;
  hotel: { name: string; price_per_night: number; booking?: { status: string; confirmation_id?: string } };
  weather: { condition: string; temp_c: number };
  attractions: string[];
  action_log: LogEntry[];
  route: Route | null;
  place_info: PlaceInfo | null;
  /** Conversational reply from the AI assistant -- present on every planned
   * trip (explains destination/budget reasoning) and on follow-up questions
   * like "what's the best time to visit" (full itinerary is echoed back
   * unchanged alongside it). */
  assistant_message?: string;
  /** Preference tags detected from free text, e.g. ["beach", "honeymoon"]. */
  preferences?: string[];
};

export type BookingDoc = { label: string; url: string };
export type BookingResult = {
  session_id: string;
  documents: BookingDoc[];
  download_all_url: string;
};

export type NearbyPlace = {
  name: string;
  category: string;
  distance_km: number;
  lat: number;
  lng: number;
  origin_label?: string;
  maps_link: string;
  transit_link: string;
};

export type Alert = {
  severity: "info" | "warning";
  title: string;
  message: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function fileUrl(path: string): string {
  return `${API_URL}${path}`;
}

export async function planTrip(
  message: string,
  sessionId?: string,
  currentLocation?: CurrentLocation,
  transportMode?: TransportMode
): Promise<PlanResult> {
  const res = await fetch(`${API_URL}/api/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      session_id: sessionId,
      current_location: currentLocation,
      transport_mode: transportMode,
    }),
  });
  if (!res.ok) throw new Error(`Agent request failed: ${res.status}`);
  return res.json();
}

export async function bookTrip(sessionId: string): Promise<BookingResult> {
  const res = await fetch(`${API_URL}/api/book`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!res.ok) throw new Error(`Booking request failed: ${res.status}`);
  return res.json();
}

export async function searchNearby(
  sessionId: string,
  query: string,
  currentLocation?: CurrentLocation
): Promise<{ results: NearbyPlace[] }> {
  const params = new URLSearchParams({
    session_id: sessionId,
    query,
  });
  if (currentLocation) {
    params.set("lat", String(currentLocation.lat));
    params.set("lng", String(currentLocation.lng));
    if (currentLocation.label) params.set("label", currentLocation.label);
  }
  const res = await fetch(
    `${API_URL}/api/help/nearby?${params.toString()}`
  );
  if (!res.ok) throw new Error(`Nearby search failed: ${res.status}`);
  return res.json();
}

export async function fetchAlerts(sessionId: string): Promise<{ alerts: Alert[] }> {
  const res = await fetch(`${API_URL}/api/alerts?session_id=${encodeURIComponent(sessionId)}`);
  if (!res.ok) throw new Error(`Alerts request failed: ${res.status}`);
  return res.json();
}

export async function planTripFromImage(
  image: File,
  message: string,
  sessionId?: string,
  currentLocation?: CurrentLocation,
  transportMode?: TransportMode
): Promise<PlanResult> {
  const form = new FormData();
  form.append("image", image);
  form.append("message", message);
  if (sessionId) form.append("session_id", sessionId);
  if (currentLocation) form.append("current_location_json", JSON.stringify(currentLocation));
  if (transportMode) form.append("transport_mode", transportMode);

  const res = await fetch(`${API_URL}/api/plan-from-image`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`Image-based planning failed: ${res.status}`);
  return res.json();
}

// ------------------------------------------------------------------
// New feature endpoints (Priority-1 additions). Auth-protected ones
// import authHeaders() from lib/auth.ts.
// ------------------------------------------------------------------
import { authHeaders } from "@/lib/auth";

async function authedFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export type CurrencyResult = { amount: number; from: string; to: string; rate: number; converted: number; source: string };
export async function convertCurrency(amount: number, from: string, to: string): Promise<CurrencyResult> {
  const params = new URLSearchParams({ amount: String(amount), from, to });
  const res = await fetch(`${API_URL}/api/currency/convert?${params.toString()}`);
  if (!res.ok) throw new Error(`Currency conversion failed: ${res.status}`);
  return res.json();
}

export type CrowdResult = { destination: string; date: string; level: string; reasons: string[]; advice: string };
export async function predictCrowd(destination: string, travelDate?: string): Promise<CrowdResult> {
  const params = new URLSearchParams({ destination, ...(travelDate ? { travel_date: travelDate } : {}) });
  const res = await fetch(`${API_URL}/api/crowd/predict?${params.toString()}`);
  if (!res.ok) throw new Error(`Crowd prediction failed: ${res.status}`);
  return res.json();
}

export type BudgetPlan = {
  total_budget: number;
  allocations: Record<string, number>;
  per_day_food_budget: number;
  remaining_balance: number;
  notes: string[];
};
export async function planBudget(totalBudget: number, durationDays: number, destination?: string): Promise<BudgetPlan> {
  const res = await fetch(`${API_URL}/api/budget/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ total_budget: totalBudget, duration_days: durationDays, destination }),
  });
  if (!res.ok) throw new Error(`Budget planning failed: ${res.status}`);
  return res.json();
}

export type SosPlace = { name: string; distance_km: number; lat: number; lng: number; maps_link: string; call_number?: string | null };
export type SosResult = {
  center: { label: string; lat: number; lng: number } | null;
  categories: Record<string, { label: string; places: SosPlace[] }>;
  emergency_numbers: Record<string, string>;
};
export async function getEmergencySos(destination: string, currentLocation?: CurrentLocation): Promise<SosResult> {
  const params = new URLSearchParams({ destination });
  if (currentLocation) {
    params.set("lat", String(currentLocation.lat));
    params.set("lng", String(currentLocation.lng));
    if (currentLocation.label) params.set("label", currentLocation.label);
  }
  const res = await fetch(`${API_URL}/api/emergency/sos?${params.toString()}`);
  if (!res.ok) throw new Error(`Emergency lookup failed: ${res.status}`);
  return res.json();
}

export type Expense = { id: string; category: string; label: string | null; amount: number; currency: string; spent_at: string };
export async function listExpenses(): Promise<Expense[]> {
  return authedFetch("/api/expenses");
}
export async function addExpense(category: string, amount: number, label?: string, currency = "INR"): Promise<Expense> {
  return authedFetch("/api/expenses", { method: "POST", body: JSON.stringify({ category, amount, label, currency }) });
}
export async function deleteExpense(id: string): Promise<{ deleted: string }> {
  return authedFetch(`/api/expenses/${id}`, { method: "DELETE" });
}
export async function expenseSummary(): Promise<{ total: number; by_category: Record<string, number> }> {
  return authedFetch("/api/expenses/summary");
}

export type DashboardData = {
  profile: { id: string; display_name: string | null; email: string | null; is_guest: boolean; member_since: string };
  analytics: {
    total_trips: number; completed_trips: number; saved_trips: number;
    visited_cities: string[]; total_expenses: number; favorite_places_count: number;
  };
  recent_trips: { id: string; destination: string; status: string; total_cost: number | null; created_at: string }[];
  favorite_places: { id: string; name: string; destination: string | null }[];
};
export async function getDashboard(): Promise<DashboardData> {
  return authedFetch("/api/dashboard");
}

export async function saveTrip(sessionId: string, destination: string, budget: number | null, totalCost: number | null, itinerary: unknown) {
  return authedFetch("/api/trips", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, destination, budget, total_cost: totalCost, itinerary_json: itinerary }),
  });
}

export async function getPackingChecklist(destination: string, weatherCondition: string, durationDays: number): Promise<{ items: string[] }> {
  const params = new URLSearchParams({ destination, weather_condition: weatherCondition, duration_days: String(durationDays) });
  const res = await fetch(`${API_URL}/api/packing/checklist?${params.toString()}`);
  if (!res.ok) throw new Error(`Packing checklist failed: ${res.status}`);
  return res.json();
}

export type AgentInfo = { name: string; description: string };
export async function listAgents(): Promise<{ agents: AgentInfo[] }> {
  const res = await fetch(`${API_URL}/api/agents`);
  if (!res.ok) throw new Error(`Agent list failed: ${res.status}`);
  return res.json();
}

// ------------------------------------------------------------------
// "Wow" feature endpoints: destination preview, safety score, budget
// optimizer, demo payment, trip-profile intake.
// ------------------------------------------------------------------

export type DestinationPreview = {
  destination: string;
  rating: number;
  rating_note: string;
  famous_places: string[];
  best_season: string;
  weather_now: { condition: string; temp_c: number };
  crowd_now: { level: string; advice: string };
  distance_from_you: { distance_km: number; eta_minutes: number | null; mode: string } | null;
  estimated_cost_3_days: Record<string, number>;
  estimated_total_3_days: number;
};
export async function getDestinationPreview(destination: string, location?: CurrentLocation): Promise<DestinationPreview> {
  const params = new URLSearchParams({ destination });
  if (location) {
    params.set("lat", String(location.lat));
    params.set("lng", String(location.lng));
  }
  const res = await fetch(`${API_URL}/api/preview?${params.toString()}`);
  if (!res.ok) throw new Error(`Destination preview failed: ${res.status}`);
  return res.json();
}

export type SafetyScore = {
  destination: string;
  safety_score: number;
  safety_score_out_of: number;
  crowd_level: string;
  womens_safety: string;
  emergency_number: string;
  note: string;
};
export async function getSafetyScore(destination: string): Promise<SafetyScore> {
  const res = await fetch(`${API_URL}/api/safety/score?${new URLSearchParams({ destination })}`);
  if (!res.ok) throw new Error(`Safety score failed: ${res.status}`);
  return res.json();
}

export type BudgetOptimization = {
  over_budget: boolean;
  current_total: number;
  budget: number;
  overage?: number;
  suggestions: string[];
  estimated_savings?: number;
  new_total: number;
  fits_budget_after?: boolean;
  message?: string;
};
export async function optimizeBudget(
  currentTotal: number,
  budget: number,
  transportMode: TransportMode,
  hotelPricePerNight?: number,
  nights = 2
): Promise<BudgetOptimization> {
  const res = await fetch(`${API_URL}/api/budget/optimize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      current_total: currentTotal,
      budget,
      transport_mode: transportMode,
      hotel_price_per_night: hotelPricePerNight,
      nights,
    }),
  });
  if (!res.ok) throw new Error(`Budget optimize failed: ${res.status}`);
  return res.json();
}

export type DemoPaymentResult = { status: string; mode: string; transaction_id: string; amount: number; message: string };
export async function demoCharge(amount: number, label: string, tripId?: string): Promise<DemoPaymentResult> {
  return authedFetch("/api/payment/demo-charge", {
    method: "POST",
    body: JSON.stringify({ amount, label, trip_id: tripId }),
  });
}

export type TripProfile = {
  display_name?: string;
  age?: number;
  phone?: string;
  num_travelers?: number;
  preferred_transport?: TransportMode;
  food_preference?: string;
  hotel_type?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
};
export async function updateProfile(profile: TripProfile) {
  return authedFetch("/api/auth/profile", { method: "PATCH", body: JSON.stringify(profile) });
}

export async function getCurrentUser() {
  return authedFetch("/api/auth/me");
}

export type CostEstimate = { amount_inr: number; basis: string };
export type RouteAlternative = {
  summary: string;
  distance_km: number;
  eta_minutes: number;
  eta_minutes_no_traffic: number;
  toll_estimate: CostEstimate;
  fuel_estimate: CostEstimate;
};
export type RouteEta = {
  origin: { lat: number; lng: number };
  destination: { label: string; lat: number; lng: number };
  distance_km: number;
  eta_minutes: number | null;
  eta_minutes_no_traffic?: number;
  traffic_delay_minutes?: number;
  toll_estimate?: CostEstimate;
  fuel_estimate?: CostEstimate;
  alternatives?: RouteAlternative[];
  mode: string;
  source: string;
  google_maps_configured?: boolean;
};
export async function getRouteEta(destination: string, location: CurrentLocation, mode = "driving"): Promise<RouteEta> {
  const params = new URLSearchParams({ destination, lat: String(location.lat), lng: String(location.lng), mode });
  const res = await fetch(`${API_URL}/api/route/eta?${params.toString()}`);
  if (!res.ok) throw new Error(`Live ETA failed: ${res.status}`);
  return res.json();
}

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export async function listNotifications(): Promise<NotificationItem[]> {
  return authedFetch("/api/notifications");
}

export async function markNotificationRead(notificationId: string) {
  return authedFetch(`/api/notifications/${notificationId}/read`, { method: "POST" });
}

export async function deleteNotification(notificationId: string) {
  return authedFetch(`/api/notifications/${notificationId}`, { method: "DELETE" });
}

export type FavoritePlace = {
  id: string;
  name: string;
  category: string | null;
  lat: number | null;
  lng: number | null;
  destination: string | null;
  created_at: string;
};

export async function listFavorites(): Promise<FavoritePlace[]> {
  return authedFetch("/api/favorites");
}

export async function addFavorite(place: Omit<FavoritePlace, "id" | "created_at">) {
  return authedFetch("/api/favorites", { method: "POST", body: JSON.stringify(place) });
}

export async function removeFavorite(favoriteId: string) {
  return authedFetch(`/api/favorites/${favoriteId}`, { method: "DELETE" });
}

export type TripRecord = {
  id: string;
  session_id: string;
  destination: string;
  budget: number | null;
  total_cost: number | null;
  status: string;
  created_at: string;
  itinerary_json?: unknown;
};

export async function listTrips(): Promise<TripRecord[]> {
  return authedFetch("/api/trips");
}

export async function getTrip(tripId: string): Promise<TripRecord> {
  return authedFetch(`/api/trips/${tripId}`);
}

export async function updateTripStatus(tripId: string, status: string) {
  const res = await fetch(`${API_URL}/api/trips/${tripId}/status?${new URLSearchParams({ status })}`, {
    method: "PATCH",
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(`Trip status update failed: ${res.status}`);
  return res.json();
}

export async function deleteTrip(tripId: string) {
  return authedFetch(`/api/trips/${tripId}`, { method: "DELETE" });
}

export async function duplicateTrip(tripId: string): Promise<TripRecord> {
  return authedFetch(`/api/trips/${tripId}/duplicate`, { method: "POST" });
}

// ------------------------------------------------------------------
// Phase 5 — AI Budget Planner: cheapest transport/hotel, savings tips,
// travel-cost prediction, modes (budget/standard/luxury).
// ------------------------------------------------------------------
export type BudgetMode = "budget" | "standard" | "luxury";
export type FullBudgetPlan = BudgetPlan & {
  mode: BudgetMode;
  cheapest_transport: { recommended: { mode: string; label: string; price: number };
                          alternatives: Array<Record<string, unknown>> };
  cheapest_hotel: { recommended: { name: string; price_per_night: number };
                    alternatives: Array<Record<string, unknown>> };
  daily_spending_plan: Array<{ day: number; estimated_spend: number; label: string }>;
  savings_recommendations: string[];
  travel_cost_prediction: { low_estimate: number; expected_estimate: number;
                            high_estimate: number; basis: string };
  budget_comparison: { your_budget: number; estimated_mode_total: number;
                       difference: number; mode: string; fits: boolean; summary: string };
  visual_chart: Array<{ label: string; value: number }>;
};
export async function planBudgetFull(opts: {
  totalBudget: number; durationDays: number; destination?: string; mode?: BudgetMode;
}): Promise<FullBudgetPlan> {
  const res = await fetch(`${API_URL}/api/budget/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      total_budget: opts.totalBudget,
      duration_days: opts.durationDays,
      destination: opts.destination,
      mode: opts.mode ?? "standard",
    }),
  });
  if (!res.ok) throw new Error(`Budget planning failed: ${res.status}`);
  return res.json();
}
export async function compareBudgetToActuals(opts: {
  budget: number; durationDays: number; destination?: string;
}) {
  const params = new URLSearchParams({
    budget: String(opts.budget),
    duration_days: String(opts.durationDays),
  });
  if (opts.destination) params.set("destination", opts.destination);
  const headers: Record<string, string> = authHeaders() as Record<string, string>;
  const res = await fetch(`${API_URL}/api/budget/compare?${params.toString()}`, { headers });
  if (!res.ok) throw new Error(`Budget compare failed: ${res.status}`);
  return res.json();
}

// ------------------------------------------------------------------
// Phase 6 — Smart Expense Manager: OCR, analytics, reports, exports.
// ------------------------------------------------------------------
export type ExpenseReport = {
  total: number; count: number;
  by_category: Record<string, number>;
  by_month: Record<string, number>;
  by_year: Record<string, number>;
  items: Array<Record<string, unknown>>;
};
export async function getExpenseAnalytics(): Promise<ExpenseReport> {
  return authedFetch("/api/expenses/analytics");
}
export async function getExpenseMonthlyReport() {
  return authedFetch("/api/expenses/report/monthly");
}
export async function getExpenseYearlyReport() {
  return authedFetch("/api/expenses/report/yearly");
}
export async function getExpenseCategoryReport(category: string) {
  return authedFetch(`/api/expenses/report/category/${encodeURIComponent(category)}`);
}
export async function getBudgetVsActualReport(totalBudget: number, durationDays = 3) {
  return authedFetch(`/api/expenses/report/budget-vs-actual?total_budget=${totalBudget}&duration_days=${durationDays}`);
}
export function exportExpenseCsvUrl() { return `${API_URL}/api/expenses/export/csv`; }
export function exportExpenseXlsxUrl() { return `${API_URL}/api/expenses/export/xlsx`; }
export function exportExpensePdfUrl() { return `${API_URL}/api/expenses/export/pdf`; }
export async function ocrExpenseText(text: string) {
  return authedFetch("/api/expenses/ocr", { method: "POST", body: JSON.stringify({ text }) });
}
export async function aiCategorizeExpenseText(text: string) {
  return authedFetch("/api/expenses/categorize?" + new URLSearchParams({ text }).toString(), { method: "POST" });
}

// ------------------------------------------------------------------
// Phase 7 — Emergency SOS: GPS, contacts, sign/SMS, crash detection.
// ------------------------------------------------------------------
export async function getLiveGps(lat: number, lng: number) {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  const res = await fetch(`${API_URL}/api/emergency/gps?${params.toString()}`);
  if (!res.ok) throw new Error(`Live GPS failed: ${res.status}`);
  return res.json();
}
export async function getEmergencyContacts() {
  const headers: Record<string, string> = authHeaders() as Record<string, string>;
  const res = await fetch(`${API_URL}/api/emergency/contacts`, { headers });
  if (!res.ok) throw new Error(`Emergency contacts failed: ${res.status}`);
  return res.json();
}
export async function buildEmergencySms(payload: {
  contact_name?: string; contact_phone?: string; lat?: number; lng?: number;
  label?: string; destination?: string; notes?: string;
}) {
  const headers: Record<string, string> = { "Content-Type": "application/json",
                                              ...(authHeaders() as Record<string, string>) };
  const res = await fetch(`${API_URL}/api/emergency/sms-payload`, {
    method: "POST", headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Emergency SMS preview failed: ${res.status}`);
  return res.json();
}
export async function reportCrash(payload: {
  lat?: number; lng?: number; label?: string; impact_g?: number; details?: string;
}) {
  return authedFetch("/api/emergency/crash", { method: "POST", body: JSON.stringify(payload) });
}

// ------------------------------------------------------------------
// Phase 8 — Smart Weather: live, timeline, AQI, UV, indoor activities.
// ------------------------------------------------------------------
export type WeatherSnapshot = {
  condition: string; temp_c: number; source: string;
  uv_index: { index: number; label: string; advice: string };
  timeline: Array<{ datetime: string; condition: string; temp_c: number; rain_pct: number }>;
  rain_next_24h_mm: number; rain_probability_pct: number;
  aqi: { aqi_index: number; label: string; source: string };
  alerts: Array<{ severity: "info" | "warning"; title: string; message: string }>;
  indoor_activities: string[];
  ai_replan: { headline: string; actions: string[]; swap_attractions: boolean };
};
export async function getWeather(destination: string, opts?: {
  lat?: number; lng?: number; hours?: number;
}): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({ destination });
  if (opts?.lat != null) params.set("lat", String(opts.lat));
  if (opts?.lng != null) params.set("lng", String(opts.lng));
  if (opts?.hours != null) params.set("hours", String(opts.hours));
  const res = await fetch(`${API_URL}/api/weather?${params.toString()}`);
  if (!res.ok) throw new Error(`Weather failed: ${res.status}`);
  return res.json();
}
export async function getWeatherForecast(destination: string, days = 3) {
  const res = await fetch(`${API_URL}/api/weather/forecast?${new URLSearchParams({ destination, days: String(days) })}`);
  if (!res.ok) throw new Error(`Weather forecast failed: ${res.status}`);
  return res.json();
}

// ------------------------------------------------------------------
// Phase 9 — Voice AI: transcribe, voice plan, languages.
// ------------------------------------------------------------------
export type VoiceLanguage = { code: string; label: string; tts_code: string; stt_code: string };
export async function getVoiceLanguages(): Promise<{ languages: VoiceLanguage[]; default: string }> {
  const res = await fetch(`${API_URL}/api/voice/languages`);
  if (!res.ok) throw new Error(`Voice languages failed: ${res.status}`);
  return res.json();
}
export async function voicePlan(transcript: string, language = "en", sessionId?: string) {
  const res = await fetch(`${API_URL}/api/voice/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, language, session_id: sessionId }),
  });
  if (!res.ok) throw new Error(`Voice plan failed: ${res.status}`);
  return res.json();
}
export async function voiceTranscribe(transcript: string, language = "en", confidence?: number) {
  const res = await fetch(`${API_URL}/api/voice/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, language, confidence }),
  });
  if (!res.ok) throw new Error(`Voice transcribe failed: ${res.status}`);
  return res.json();
}

// ------------------------------------------------------------------
// Phase 10 — Vision AI: recognize, sign translation, destination info.
// ------------------------------------------------------------------
export async function recognizeVision(image: File): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.append("image", image);
  const res = await fetch(`${API_URL}/api/vision/recognize`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Vision recognize failed: ${res.status}`);
  return res.json();
}
export async function translateSign(text: string, targetLanguage = "hi") {
  const res = await fetch(`${API_URL}/api/vision/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, target_language: targetLanguage }),
  });
  if (!res.ok) throw new Error(`Sign translation failed: ${res.status}`);
  return res.json();
}
export async function getDestinationInfo(destination: string, query?: string) {
  const params = new URLSearchParams({ destination });
  if (query) params.set("query", query);
  const res = await fetch(`${API_URL}/api/vision/destination-info?${params.toString()}`);
  if (!res.ok) throw new Error(`Destination info failed: ${res.status}`);
  return res.json();
}

// ------------------------------------------------------------------
// Phase 11 — Group Trips: invite, itinerary, voting, expense split,
// shared checklist, trip collaboration.
// ------------------------------------------------------------------
export type GroupMember = { name: string; role: "owner" | "member" | "invited"; user_id: string };
export type GroupTrip = {
  id: string; name: string; owner_id: string; share_code: string;
  trip_destination: string | null; trip_start: string | null; trip_end: string | null;
  members: GroupMember[]; itinerary: Record<string, unknown>; votes: Array<Record<string, unknown>>;
  expense_splits: Array<Record<string, unknown>>; checklist: Array<Record<string, unknown>>;
  created_at: string | null;
};
export async function createGroup(input: { name: string; trip_destination?: string;
                                            trip_start?: string; trip_end?: string }) {
  return authedFetch("/api/group/create", { method: "POST", body: JSON.stringify(input) });
}
export async function listGroups() { return authedFetch("/api/group"); }
export async function joinGroup(groupId: string, displayName?: string, joinCode?: string) {
  return authedFetch(`/api/group/${encodeURIComponent(groupId)}/join`, {
    method: "POST",
    body: JSON.stringify({ display_name: displayName, join_code: joinCode }),
  });
}
export async function getGroup(groupId: string) { return authedFetch(`/api/group/${encodeURIComponent(groupId)}`); }
export async function inviteToGroup(groupId: string, names: string[]) {
  return authedFetch(`/api/group/${encodeURIComponent(groupId)}/invite`, {
    method: "POST", body: JSON.stringify(names),
  });
}
export async function setGroupItinerary(groupId: string, itinerary: Record<string, unknown>) {
  return authedFetch(`/api/group/${encodeURIComponent(groupId)}/itinerary`, {
    method: "POST", body: JSON.stringify(itinerary),
  });
}
export async function voteOnGroup(groupId: string, payload: { voter_name?: string; option: string; note?: string }) {
  return authedFetch(`/api/group/${encodeURIComponent(groupId)}/vote`, {
    method: "POST", body: JSON.stringify(payload),
  });
}
export async function addGroupExpense(groupId: string, payload: { member_name: string; amount: number; label?: string }) {
  return authedFetch(`/api/group/${encodeURIComponent(groupId)}/expenses`, {
    method: "POST", body: JSON.stringify(payload),
  });
}
export async function addGroupChecklist(groupId: string, label: string) {
  return authedFetch(`/api/group/${encodeURIComponent(groupId)}/checklist`, {
    method: "POST", body: JSON.stringify({ label }),
  });
}
export async function toggleGroupChecklist(groupId: string, itemId: string, done: boolean) {
  return authedFetch(`/api/group/${encodeURIComponent(groupId)}/checklist/${encodeURIComponent(itemId)}?done=${done}`,
    { method: "PATCH" });
}

// ------------------------------------------------------------------
// Phase 12 — Booking Engine: flight/hotel/bus/train records.
// ------------------------------------------------------------------
export type BookingMode = "flight" | "hotel" | "bus" | "train";
export type BookingStatus = "initiated" | "confirmed" | "cancelled" | "completed" | "failed";
export type Booking = {
  id: string; mode: BookingMode; origin: string | null; destination: string;
  start_date: string; end_date: string | null; travelers: number; fare: number;
  provider: string | null; notes: string | null; status: BookingStatus;
  confirmation_code: string | null; created_at: string; updated_at: string;
};
export async function createBooking(b: {
  mode: BookingMode; origin?: string; destination: string;
  start_date: string; end_date?: string; travelers?: number; fare: number;
  provider?: string; notes?: string;
}) {
  return authedFetch("/api/booking", { method: "POST", body: JSON.stringify(b) });
}
export async function listBookings(): Promise<Booking[]> { return authedFetch("/api/booking"); }
export async function getBooking(id: string) { return authedFetch(`/api/booking/${encodeURIComponent(id)}`); }
export async function updateBookingStatus(id: string, status: BookingStatus) {
  return authedFetch(`/api/booking/${encodeURIComponent(id)}/status?status=${status}`, { method: "PATCH" });
}
export async function cancelBooking(id: string) {
  return authedFetch(`/api/booking/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ------------------------------------------------------------------
// Phase 13 — Offline Mode: itinerary / maps / contacts / dest cache.
// ------------------------------------------------------------------
export async function getOfflineItinerary() { return authedFetch("/api/offline/itinerary"); }
export async function getOfflineMaps()     { return authedFetch("/api/offline/maps-cache"); }
export async function getOfflineContacts() { return authedFetch("/api/offline/contacts"); }
export async function getOfflineDestinations() { return authedFetch("/api/offline/destinations"); }
export async function getOfflineExpenses()  { return authedFetch("/api/offline/expenses"); }

// ------------------------------------------------------------------
// Phase 15 — AI Personalization memory.
// ------------------------------------------------------------------
export async function getPersonalization() { return authedFetch("/api/personalization"); }
export async function updatePersonalization(payload: Record<string, unknown>) {
  return authedFetch("/api/personalization", { method: "PATCH", body: JSON.stringify(payload) });
}

// ------------------------------------------------------------------
// Phase 17 — Admin Dashboard
// ------------------------------------------------------------------
export async function getAdminAnalytics() { return authedFetch("/api/admin/analytics"); }
export async function getAdminSystemHealth() { return authedFetch("/api/admin/system-health"); }
export async function getAdminErrorLogs() { return authedFetch("/api/admin/error-logs"); }
export async function getAdminReport(kind: "users" | "trips" | "bookings" | "expenses") {
  return authedFetch(`/api/admin/reports/${kind}`);
}
