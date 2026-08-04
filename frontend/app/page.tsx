"use client";

import { useEffect, useState } from "react";
import TripForm from "@/components/TripForm";
import AgentThinking from "@/components/AgentThinking";
import ItineraryResult from "@/components/ItineraryResult";
import TripMap from "@/components/TripMap";
import LiveETABadge from "@/components/LiveETABadge";
import BookingPanel from "@/components/BookingPanel";
import HelpChat from "@/components/HelpChat";
import AlertBanner from "@/components/AlertBanner";
import PlaceInfoCard from "@/components/PlaceInfoCard";
import TripExtras from "@/components/TripExtras";
import TripInsights from "@/components/TripInsights";
import PaymentGateway from "@/components/PaymentGateway";
import DestinationPreview from "@/components/DestinationPreview";
import CommandPalette, { CommandAction } from "@/components/CommandPalette";
import Dashboard from "@/components/Dashboard";
import ExpenseTracker from "@/components/ExpenseTracker";
import CurrencyConverter from "@/components/CurrencyConverter";
import EmergencySOS from "@/components/EmergencySOS";
import MyTripsPage from "@/components/MyTripsPage";
import ProfilePage from "@/components/ProfilePage";
import SettingsPage from "@/components/SettingsPage";
import Sidebar, { Tab } from "@/components/shell/Sidebar";
import Topbar from "@/components/shell/Topbar";
import AuroraBackground from "@/components/shell/AuroraBackground";
import MessagesPage from "@/components/MessagesPage";
import FavoritesPage from "@/components/FavoritesPage";
import HelpCenterPage from "@/components/HelpCenterPage";
import InviteFriendsPage from "@/components/InviteFriendsPage";
import PremiumPage from "@/components/PremiumPage";
import { AuthState, getStoredAuth } from "@/lib/auth";
import { CurrentLocation, planTrip, planTripFromImage, PlanResult, TransportMode } from "@/lib/api";
import { applySettings, getStoredSettings } from "@/lib/settings";
import { NAVIGATE_EVENT, ShellNavigateDetail } from "@/lib/shellEvents";
import BudgetPlannerPanel from "@/components/BudgetPlannerPanel";
import ExpenseSmart from "@/components/ExpenseSmart";
import WeatherSmart from "@/components/WeatherSmart";
import VoiceAssistant from "@/components/VoiceAssistant";
import VisionAssistant from "@/components/VisionAssistant";
import GroupTrips from "@/components/GroupTrips";
import BookingEngine from "@/components/BookingEngine";
import OfflineModePanel from "@/components/OfflineModePanel";
import NotificationsCenter from "@/components/NotificationsCenter";
import PersonalizationPanel from "@/components/PersonalizationPanel";
import AdminDashboard from "@/components/AdminDashboard";

const TAB_META: Record<Tab, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Here's what's happening with your travel plans today." },
  plan: { title: "Plan Trip", subtitle: "Let our AI agent plan everything for you in seconds." },
  trips: { title: "My Trips", subtitle: "View and manage all your trips in one place." },
  expenses: { title: "Expense Manager", subtitle: "Track, OCR-scan and analyse your travel spend." },
  currency: { title: "Currency Converter", subtitle: "Convert currencies with live exchange rates." },
  sos: { title: "Emergency SOS", subtitle: "Live GPS, contacts and one-tap dialling." },
  messages: { title: "Messages", subtitle: "Chat with your AI trip assistant." },
  favorites: { title: "Favorites", subtitle: "Places you've saved for later." },
  profile: { title: "Profile", subtitle: "Your account and travel preferences." },
  settings: { title: "Settings", subtitle: "Customize your Trip Agent experience." },
  help: { title: "Help Center", subtitle: "Guides, FAQs, and how the agent works." },
  invite: { title: "Invite Friends", subtitle: "Share Trip Agent and plan trips together." },
  premium: { title: "Premium Membership", subtitle: "Unlock more from your AI trip agent." },
  budget:  { title: "AI Budget Planner", subtitle: "Mode-based split, cheapest transport & hotel, prediction bands." },
  weather:{ title: "Smart Weather", subtitle: "Live timeline, AQI, UV, rain prediction and replan." },
  voice:   { title: "Voice AI", subtitle: "Speak, get a plan and listen to the summary." },
  vision:  { title: "Vision AI", subtitle: "Landmark, food, sign translation and destination info." },
  group:   { title: "Group Trips", subtitle: "Plan with friends: invite, vote, split, checklist." },
  booking: { title: "Booking Engine", subtitle: "Flight, hotel, bus and train bookings and history." },
  offline: { title: "Offline Mode", subtitle: "Cached itinerary, maps, contacts and expenses." },
  notifications: { title: "Smart Notifications", subtitle: "Weather alerts, reminders, budget nudges." },
  personalization:{ title: "AI Personalization", subtitle: "Persist your favorite destinations, hotel and food." },
  admin:   { title: "Admin Dashboard", subtitle: "Users, trips, bookings, system health." },
};

export default function Home() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | undefined>();
  const [locationStatus, setLocationStatus] = useState("Getting your live location…");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setAuth(getStoredAuth());
    applySettings(getStoredSettings());
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ShellNavigateDetail>).detail;
      if (!detail) return;
      if (detail.type === "tab") {
        setTab(detail.tab as Tab);
        return;
      }
      if (detail.type === "plan") {
        setTab("plan");
        handleSubmit(`Plan a trip to ${detail.destination}`, detail.transportMode || "flight");
      }
    };
    window.addEventListener(NAVIGATE_EVENT, handler as EventListener);
    return () => window.removeEventListener(NAVIGATE_EVENT, handler as EventListener);
  }, [currentLocation, sessionId]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus("Live location is not supported in this browser.");
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: "Your Current Location",
        });
        setLocationStatus("Live location connected.");
      },
      () => setLocationStatus("Location permission blocked. The map will use destination fallback points."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  function fail() {
    setError(
      "Couldn't reach the agent backend. Make sure the FastAPI server is running on " +
        (process.env.NEXT_PUBLIC_API_URL || "https://jivoranexa-ai.onrender.com")
    );
  }

  async function handleSubmit(text: string, transportMode: TransportMode) {
    setBusy(true);
    setError(null);
    try {
      const r = await planTrip(text, sessionId, currentLocation, transportMode);
      setResult(r);
      setSessionId(r.session_id);
      setTab("plan");
    } catch {
      fail();
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitImage(file: File, message: string, transportMode: TransportMode) {
    setBusy(true);
    setError(null);
    try {
      const r = await planTripFromImage(file, message, sessionId, currentLocation, transportMode);
      setResult(r);
      setSessionId(r.session_id);
    } catch {
      fail();
    } finally {
      setBusy(false);
    }
  }

  const paletteActions: CommandAction[] = [
    ...(Object.keys(TAB_META) as Tab[]).map((t) => ({
      id: `tab-${t}`,
      label: `Go to ${TAB_META[t].title}`,
      group: "Navigate",
      run: () => setTab(t),
    })),
    {
      id: "example-goa",
      label: "Try: Goa trip for 4 days under ₹25,000",
      group: "Quick Plan",
      run: () => {
        setTab("plan");
        handleSubmit("Show me a Goa trip for 4 days under ₹25,000", "flight");
      },
    },
    {
      id: "example-delhi-train",
      label: "Try: Delhi trip under ₹15,000 by train",
      group: "Quick Plan",
      run: () => {
        setTab("plan");
        handleSubmit("I want to go to Delhi under ₹15,000", "train");
      },
    },
  ];

  const meta = TAB_META[tab];
  const displayName = auth?.user.display_name || auth?.user.email?.split("@")[0];

  return (
    <div className="min-h-screen flex app-shell-bg relative overflow-x-hidden">
      <AuroraBackground />
      <Sidebar tab={tab} onChange={setTab} open={sidebarOpen} onClose={() => setSidebarOpen(false)} isAdmin={Boolean(auth?.user.is_admin)} />

      <div className="flex-1 min-w-0 flex flex-col relative z-10">
        <Topbar
          title={tab === "dashboard" && displayName ? `Hi, ${displayName}!` : meta.title}
          subtitle={meta.subtitle}
          auth={auth}
          onAuthChange={setAuth}
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* Improved mobile padding and fluid width handling */}
        <main className="flex-1 px-3 sm:px-6 py-4 sm:py-6 max-w-6xl w-full mx-auto box-border">
          {tab === "dashboard" && <Dashboard loggedIn={Boolean(auth)} name={displayName} onPlan={(destination) => { setTab("plan"); handleSubmit(`Plan a trip to ${destination}`, "flight"); }} />}

          {tab === "plan" && (
            <div className="space-y-6">
              <div className="glass-panel rounded-3xl p-4 sm:p-6">
                <h2 className="font-display text-xl sm:text-2xl font-semibold text-center text-gradient-hero">
                  Where do you want to go?
                </h2>
                <p className="text-center text-xs sm:text-sm text-mist2 mt-1 mb-5">
                  Our AI agent will plan everything for you in seconds.
                </p>
                <DestinationPreview currentLocation={currentLocation} />
                <div className="mt-4">
                  <TripForm onSubmit={handleSubmit} onSubmitImage={handleSubmitImage} busy={busy} />
                </div>
                <p className="text-xs text-mist2 mt-3">{locationStatus}</p>
              </div>

              {error && (
                <p className="text-sm text-alert border border-alert/30 bg-alert/5 rounded-xl px-4 py-3">{error}</p>
              )}

              <div className="glass-panel rounded-3xl p-4 sm:p-6">
                <AgentThinking entries={result?.action_log ?? []} live={busy} />
              </div>

              {result && (
                <div className="space-y-6">
                  {result.place_info && <PlaceInfoCard info={result.place_info} />}

                  <div className="flex items-center gap-3 flex-wrap">
                    <LiveETABadge destination={result.destination} liveLocation={currentLocation} />
                  </div>

                  <div className="glass-panel rounded-3xl p-4 sm:p-6 overflow-hidden">
                    <ItineraryResult result={result} />
                  </div>

                  <TripInsights result={result} />

                  <TripExtras result={result} loggedIn={Boolean(auth)} />

                  {result.route && (
                    <div className="glass-panel rounded-3xl p-2 sm:p-3 overflow-hidden">
                      <TripMap route={result.route} liveLocation={currentLocation} />
                    </div>
                  )}

                  <AlertBanner sessionId={result.session_id} />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="glass-panel rounded-3xl p-4 sm:p-5">
                      <PaymentGateway amount={result.total_cost} label={result.trip_summary} loggedIn={Boolean(auth)} />
                    </div>
                    <div className="glass-panel rounded-3xl p-4 sm:p-5">
                      <BookingPanel sessionId={result.session_id} />
                    </div>
                  </div>

                  <div className="glass-panel rounded-3xl p-4 sm:p-5">
                    <HelpChat sessionId={result.session_id} currentLocation={currentLocation} />
                  </div>
                </div>
              )}

              <footer className="text-xs text-mist2/50 font-mono pb-4">session: {sessionId ?? "—"}</footer>
            </div>
          )}

          {tab === "trips" && <MyTripsPage loggedIn={Boolean(auth)} />}

          {tab === "expenses" && (
            <div className="space-y-4">
              <ExpenseSmart loggedIn={Boolean(auth)} />
              <div className="glass-panel rounded-3xl p-4 sm:p-6">
                <ExpenseTracker loggedIn={Boolean(auth)} />
              </div>
            </div>
          )}

          {tab === "budget" && (
            <div className="glass-panel rounded-3xl p-4 sm:p-6">
              <BudgetPlannerPanel destination={result?.destination} />
            </div>
          )}

          {tab === "weather" && (
            <div className="glass-panel rounded-3xl p-4 sm:p-6">
              <WeatherSmart destination={result?.destination || "Hyderabad"} currentLocation={currentLocation} />
            </div>
          )}

          {tab === "voice" && (
            <div className="space-y-4">
              <VoiceAssistant />
              <div className="glass-panel rounded-3xl p-4 sm:p-5">
                <p className="text-xs text-mist2">Tip: hold the microphone button, speak naturally in any supported language, then press <b>Plan from voice</b>. TTS will read the trip summary back to you.</p>
              </div>
            </div>
          )}

          {tab === "vision" && (
            <div className="glass-panel rounded-3xl p-4 sm:p-6">
              <VisionAssistant />
            </div>
          )}

          {tab === "group" && (
            <div className="glass-panel rounded-3xl p-4 sm:p-6">
              <GroupTrips loggedIn={Boolean(auth)} />
            </div>
          )}

          {tab === "booking" && (
            <div className="glass-panel rounded-3xl p-4 sm:p-6">
              <BookingEngine loggedIn={Boolean(auth)} defaultDestination={result?.destination} />
            </div>
          )}

          {tab === "offline" && (
            <div className="glass-panel rounded-3xl p-4 sm:p-6">
              <OfflineModePanel loggedIn={Boolean(auth)} />
            </div>
          )}

          {tab === "notifications" && (
            <div className="glass-panel rounded-3xl p-4 sm:p-6">
              <NotificationsCenter loggedIn={Boolean(auth)} />
            </div>
          )}

          {tab === "personalization" && (
            <div className="glass-panel rounded-3xl p-4 sm:p-6">
              <PersonalizationPanel loggedIn={Boolean(auth)} />
            </div>
          )}

          {tab === "admin" && (
            <div className="glass-panel rounded-3xl p-4 sm:p-6">
              <AdminDashboard loggedIn={Boolean(auth)} isAdmin={Boolean(auth?.user.is_admin)} />
            </div>
          )}

          {tab === "currency" && (
            <div className="glass-panel rounded-3xl p-4 sm:p-6 max-w-2xl mx-auto">
              <CurrencyConverter />
            </div>
          )}

          {tab === "sos" && (
            <EmergencySOS destination={result?.destination || "Hyderabad"} currentLocation={currentLocation} />
          )}

          {tab === "profile" && <ProfilePage auth={auth} onAuthChange={setAuth} />}

          {tab === "settings" && <SettingsPage />}

          {tab === "messages" && <MessagesPage />}

          {tab === "favorites" && <FavoritesPage loggedIn={Boolean(auth)} onPlan={(dest) => { setTab("plan"); handleSubmit(`Plan a trip to ${dest}`, "flight"); }} />}

          {tab === "help" && <HelpCenterPage />}

          {tab === "invite" && <InviteFriendsPage />}

          {tab === "premium" && <PremiumPage loggedIn={Boolean(auth)} />}
        </main>
      </div>

      <CommandPalette actions={paletteActions} />
    </div>
  );
}