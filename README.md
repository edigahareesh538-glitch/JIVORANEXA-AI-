# Trip Agent — Autonomous Trip Planning Multi-Agent System

An AI travel-planning agent: goal extraction → task decomposition → tool
orchestration → memory-backed retries → transparent decision log, now with
accounts, a real database, live maps/ETA, AI planning tools, emergency
safety features, and hardened security.

```text
trip-agent/
├── backend/   FastAPI API (10 named agents, auth, DB, tools)
└── frontend/  Next.js UI (tabs: Plan / Dashboard / Expenses / Currency / SOS)
```

---

## 1. What's real vs. simulated (read this first)

Every feature below either **works with zero API keys** (free/public
services or local logic) or is **clearly marked simulated/optional** so
nothing in a demo silently lies about what it's doing.

| Feature | Status | Needs a key? |
|---|---|---|
| Email/password auth (bcrypt + JWT) | **Real** | No |
| Guest Mode | **Real** | No |
| Google Sign-In | **Real** (via Firebase) | Yes — optional |
| Trip Profile intake (age, travelers, transport/food/hotel prefs, emergency contact) | **Real** — `PATCH /api/auth/profile` | No |
| Database (users, trips, expenses, favorites, notifications) | **Real** (SQLite by default, or Postgres/Supabase) | No |
| Live maps: current location, destination, route, distance, ETA | **Real** (OpenStreetMap + OSRM) | No |
| **Live GPS tracking** (moving marker + live ETA badge, updates every 20s) | **Real** (`watchPosition` + `/api/route/eta`) | No |
| Nearby search (hospitals, ATMs, hotels, etc.) | **Real** (OpenStreetMap Overpass) | No |
| Emergency SOS (hospitals/police/pharmacy/blood bank/EV charging/toilets) | **Real** | No |
| **AI Safety Score** (crowd, women's safety, emergency number) | **Real logic** | No |
| Currency converter | **Real** (live rates) | No |
| AI Weather Planner (actions, not just a label) | **Real logic** | No |
| AI Budget Planner (splits total into categories) | **Real logic** | No |
| **AI Budget Optimizer** (over-budget → concrete swaps + new total) | **Real logic** | No |
| AI Crowd Prediction (weekend/festival aware) | **Real logic** | No |
| **Destination Preview** (Google-Travel-style: rating, famous places, best season, cost) | **Real** (photos via keyless Unsplash source) | No |
| **Travel mode selection** (flight/train/bus/own vehicle/rental — skips ticket booking for self-drive, adds fuel/parking estimate) | **Real** | No |
| **Conversational replanning** ("I don't want flights, prefer trains" → replans on the same session) | **Real** (rule-based feedback detection, not full NLU) | No |
| **Demo Payment Gateway** (fake QR/UPI animation, clearly labeled) | **Real UI**, simulated charge | No |
| **Multi-agent "thinking" visualization** (streamed, per-agent activity strip) | **Real** — reads the real action log | No |
| **Command palette (⌘K)** | **Real** | No |
| Packing checklist | **Real logic** | No |
| Multi-agent architecture (10 named agents) | **Real** — see `GET /api/agents` | No |
| Voice input / output | **Real** (browser Web Speech API) | No |
| Weather data | Live if `OPENWEATHER_API_KEY` set, else realistic mock | Optional |
| Image/place recognition | Live if `GEMINI_API_KEY` set, else demo fallback | Optional |
| Flight search | Sample/heuristic pricing — no flight API wired | — |
| **Booking (flights/hotels)** | **Simulated on purpose** (demo mode) — see below | — |
| Push notifications (phone/browser, app closed) | Not wired — in-app notifications ARE real; see "Notifications" below | Optional (FCM) |
| OCR (ticket/bill scanning), offline mode, collaborative planning | **Not built** — see "Roadmap" at the bottom | — |

### Why booking is simulated
A real payment + inventory integration (Booking.com/MakeMyTrip/Agoda) needs
partner/affiliate approval that takes days-to-weeks to get, which doesn't
fit a 5-day build. `app/tools/booking.py` + `BookingAgent` generate a
realistic confirmation flow (with a deliberately flaky ~20% "failure" rate
so the Retry/Error-handling logic has something real to do) and label
themselves `"mode": "simulated_demo"` in the API response — be upfront
about this to judges rather than pretending it's live.

---

## 2. Quick start (zero API keys required)

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

On first run you'll see in the logs:
```
[db] Ready -- using SQLite (local file, no setup needed): ./trip_agent.db
[auth.firebase] FIREBASE_SERVICE_ACCOUNT_JSON not set -- Google/email login disabled, Guest Mode still works.
```
That's expected — email/password + guest login work immediately; Google
login turns on once you add Firebase credentials (step 4).

Check it's alive: `curl http://localhost:8000/health` → `{"status":"ok"}`
Check the multi-agent registry: `curl http://localhost:8000/api/agents`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # if present; otherwise create it (see below)
npm run dev
```

Visit `http://localhost:3000`. `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

That's it — sign in with a fresh email/password, or hit **Continue as
Guest**, and every tab (Plan Trip / Dashboard / Expenses / Currency /
Emergency SOS) works.

---

## 3. Environment variables

Full documented list lives in `backend/.env.example` — copy it to `.env`.
Highlights:

| Variable | Required? | What it unlocks |
|---|---|---|
| `JWT_SECRET_KEY` | Recommended | Signs your own auth tokens. Has an insecure dev default — **change it** with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `DATABASE_URL` | No | Leave blank for local SQLite. Set to a Postgres/Supabase URI for a shared/production DB |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | No | Enables Google Sign-In (see step 4) |
| `GEMINI_API_KEY` + `USE_MOCK_LLM=false` | No | Real photo/place recognition instead of demo fallback |
| `OPENWEATHER_API_KEY` | No | Live weather instead of a realistic mock |
| `GOOGLE_MAPS_API_KEY` | No | Not required — maps/routing/ETA/nearby-search already work for free via OpenStreetMap + Overpass + OSRM |
| `CORS_ORIGINS` | Yes | Comma-separated list of frontend origins allowed to call the API |

Frontend (`frontend/.env.local`):

| Variable | Required? |
|---|---|
| `NEXT_PUBLIC_API_URL` | Yes — where the backend is running |
| `NEXT_PUBLIC_FIREBASE_API_KEY` / `_AUTH_DOMAIN` / `_PROJECT_ID` / `_APP_ID` | No — only for Google Sign-In |

---

## 4. Setting up Database, Auth, and other API keys

### Database (Supabase, recommended for a hosted demo)
1. Create a project at supabase.com (free tier).
2. Project Settings → Database → Connection string → **URI** (Session mode).
3. Put it in `DATABASE_URL` in `backend/.env`, e.g.
   `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`
4. Restart the backend — tables are created automatically on startup
   (`init_db()` in `app/main.py`).

If you skip this entirely, the app keeps working against a local
`trip_agent.db` SQLite file — fine for local dev/demo, not for multiple
judges hitting a shared deployed instance at once.

### Google Sign-In (Firebase)
1. Create a project at console.firebase.google.com.
2. Authentication → Sign-in method → enable **Google**.
3. Project settings → General → "Your apps" → add a Web app → copy the
   config values into `frontend/.env.local` as the `NEXT_PUBLIC_FIREBASE_*`
   vars.
4. Project settings → Service accounts → **Generate new private key** →
   downloads a JSON file. Minify it to one line (`jq -c . key.json`) and
   paste it as `FIREBASE_SERVICE_ACCOUNT_JSON` in `backend/.env`.
5. Restart both servers. The "Sign in with Google" button appears
   automatically once `NEXT_PUBLIC_FIREBASE_*` is set; the backend accepts
   it once `FIREBASE_SERVICE_ACCOUNT_JSON` is set.

Until then, email/password + Guest Mode cover full auth demo needs.

### Gemini (real image/place recognition)
1. Get a key at aistudio.google.com/apikey (free tier available).
2. `GEMINI_API_KEY=...` and `USE_MOCK_LLM=false` in `backend/.env`.

### OpenWeatherMap (real weather)
1. Free key at openweathermap.org/api.
2. `OPENWEATHER_API_KEY=...` in `backend/.env`.

### Maps / routing / places
No key needed — already wired to OpenStreetMap (Nominatim geocoding),
Overpass (nearby-place search), and OSRM (routing + live ETA), all public
and free. `GOOGLE_MAPS_API_KEY` is accepted but not required by anything
currently in the codebase.

---

## 5. The multi-agent system

`GET /api/agents` lists all 10 named agents (`app/agents/registry.py`):

| Agent | Responsibility |
|---|---|
| PlannerAgent | Decomposes the goal, drives the workflow |
| ReasoningAgent | Weather/budget-driven replanning |
| SearchAgent | Flight search + place lookup |
| WeatherAgent | Live/mock weather + actionable advice |
| BudgetAgent | Splits total budget across categories |
| BookingAgent | Simulated hotel booking (demo mode) |
| RecommendationAgent | Attractions + crowd prediction |
| NotificationAgent | Builds live trip alerts |
| MemoryAgent | Session/trip memory, resume support |
| SafetyAgent | Emergency SOS lookups |

Each agent is a thin, purpose-named wrapper around the existing
`app/tools/*` and `app/workflow/*` modules — nothing was duplicated, this
just makes the architecture explicit and inspectable instead of one
hidden function.

---

## 6. API reference (new endpoints)

```text
POST   /api/auth/register          email + password signup
POST   /api/auth/login             email + password login
POST   /api/auth/guest             instant guest session
POST   /api/auth/google            Google login (needs Firebase config)
GET    /api/auth/me                current user
PATCH  /api/auth/profile           (auth) update trip profile (age, travelers,
                                    preferred transport, food/hotel prefs,
                                    emergency contact)

GET    /api/agents                 list the 10 named agents

POST   /api/plan                   plan/replan a trip. Body accepts an optional
                                    transport_mode ("flight"|"train"|"bus"|
                                    "own_vehicle"|"rental_car"). Sending a
                                    follow-up message on the same session_id
                                    like "I don't want flights, prefer trains"
                                    is detected as feedback and merges onto
                                    the existing plan instead of restarting.

GET    /api/preview                Destination Preview: ?destination&lat&lng
                                    -- rating, famous places, best season,
                                    live weather/crowd, distance, est. cost
GET    /api/safety/score           ?destination -- AI Safety Score
POST   /api/budget/optimize        {current_total, budget, transport_mode,
                                    hotel_price_per_night, nights} -- AI
                                    Budget Optimizer suggestions + new total
POST   /api/payment/demo-charge    (auth) {amount, label, trip_id} --
                                    Demo Payment Gateway, no real charge

GET    /api/currency/convert       ?amount&from&to
GET    /api/emergency/sos          ?destination&lat&lng
POST   /api/budget/plan            {total_budget, duration_days, destination}
GET    /api/crowd/predict          ?destination&travel_date
GET    /api/packing/checklist      ?destination&weather_condition&duration_days
GET    /api/route/eta              ?destination&lat&lng&mode   (live distance+ETA)

GET    /api/expenses               (auth) list
POST   /api/expenses               (auth) add
DELETE /api/expenses/{id}          (auth)
GET    /api/expenses/summary       (auth)

GET    /api/favorites              (auth)
POST   /api/favorites              (auth)
DELETE /api/favorites/{id}         (auth)

GET    /api/notifications          (auth) in-app notifications
POST   /api/notifications          (auth)
POST   /api/notifications/{id}/read (auth)

POST   /api/trips                  (auth) save a plan result to history
GET    /api/trips                  (auth) list trip history
GET    /api/trips/{id}             (auth)
PATCH  /api/trips/{id}/status      (auth)

GET    /api/dashboard              (auth) profile + analytics + recent trips
```

`(auth)` routes need `Authorization: Bearer <token>` from any of the three
login endpoints above (register/login/guest all return the same token
shape).

---

## 7. Security

- **Passwords**: bcrypt-hashed (`passlib`), never stored in plaintext.
- **JWT**: 7-day tokens signed with `JWT_SECRET_KEY`; **change the default
  before deploying anywhere public**.
- **HTTPS**: not terminated by this app — put it behind a reverse proxy /
  hosting platform (Render, Railway, Vercel, etc.) that provides TLS. The
  app already sends `Strict-Transport-Security` so it's ready once HTTPS
  is in front of it.
- **Rate limiting**: `slowapi`, default 120 requests/minute per IP
  (`app/middleware/security.py`) — tune per-route with `@limiter.limit(...)`.
- **Security headers**: `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy` on every response.
- **Request size limits**: 256 KB for JSON calls, 10 MB for image uploads —
  blunts naive DoS/oversized-upload abuse.
- **CORS**: locked to `CORS_ORIGINS` (comma-separated), not `*`.
- **Input validation**: every request body is a Pydantic model — invalid
  shapes are rejected before touching business logic.
- **SQL injection**: SQLAlchemy ORM with parameterized queries throughout;
  no raw string-built SQL anywhere in the new code.
- **XSS**: React escapes all rendered content by default; nothing uses
  `dangerouslySetInnerHTML`.
- **Env vars**: all secrets live in `.env` files (git-ignored) — see
  `backend/.env.example` / `frontend/.env.local` above.

---

## 8. Notifications

In-app notifications (`/api/notifications`) are fully real and DB-backed —
create one, list them, mark them read. For **push** notifications that
reach a phone/browser while the app is closed, wire Firebase Cloud
Messaging (FCM) on top of the same trigger points:
1. Frontend requests notification permission + registers an FCM token.
2. Store that token on the `User` row (add a column) or a small side
   table.
3. When `POST /api/notifications` fires server-side, also call the FCM
   Admin SDK (`firebase_admin.messaging`, already installed alongside
   `firebase-admin` for auth) with that token.

Not wired in this build to keep scope realistic for the 5-day window —
the in-app version demos the same UX without needing a phone.

---

## 9. Roadmap / not yet built

Given the timeline, these were intentionally left as documented next steps
rather than shipped half-working:

| Feature | Suggested approach |
|---|---|
| OCR (tickets/bills) | `tesseract.js` client-side (CDN script injection, no npm install or key needed) — snap a photo, regex out an amount, prefill the Expense Tracker form |
| Fully hands-free voice assistant (auto-submit + auto-speak reply) | The building blocks are already live (`VoiceInputButton`/`VoiceOutputButton` in `components/VoiceInput.tsx`) — wire a "conversational mode" toggle that calls `onSubmit` directly from the transcript and auto-triggers `VoiceOutputButton`'s speak() on the result |
| Offline itinerary / offline map | Cache last plan result + map tiles in IndexedDB via a service worker |
| Collaborative trip planning | Add a `trip_collaborators` table + share links; broadcast updates over WebSockets |
| Multi-language support | `next-intl` on the frontend; the backend's rule-based tools (budget/crowd/packing) are already language-agnostic to extend |
| Real booking integration | Amadeus (flights) + a hotel affiliate API (Travelpayouts/RapidAPI) once partner approval is in place — replace `app/tools/booking.py` |
| Real payment (Razorpay/Stripe/PayU) | `app/routes/payment.py`'s `demo-charge` already matches the request/response shape a real create-order + confirm flow needs — swap the body for a real gateway SDK call |
| Push notifications | See section 8 |
| Production-scale infrastructure (Redis cache, load balancer, autoscaling, S3, Sentry/Grafana/Prometheus, admin dashboard, analytics, DB backups, SMS/WhatsApp) | See section 12 below |

---

## 10. Verification done in this build

- **Backend**: every Python file (66 files) passes `python -m py_compile`
  (full syntax check), including the new conversational-replanning,
  travel-mode, destination-preview, safety-score, budget-optimizer, and
  demo-payment code. A real bug was caught and fixed in this pass: the
  feedback-merge logic initially read `state["intent"]` when the session
  store actually keeps it at `state["results"]["intent"]` — fixed before
  packaging. Could not `pip install` or run `uvicorn` in the build sandbox
  (no network access there) — **install and smoke-test locally before
  your demo**, especially `/api/plan` → send a follow-up feedback message
  → confirm it replans instead of erroring.
- **Frontend**: `npx tsc --noEmit` passes with **zero type errors** across
  all components (including the new `AgentThinking`, `CommandPalette`,
  `DestinationPreview`, `PaymentGateway`, `TripInsights`,
  `TripProfileModal`), and `npm run build` completes a full production
  build successfully (`✓ Compiled successfully`, all routes generated).
- **Note on Destination Preview photos**: they load from
  `source.unsplash.com` at runtime in the user's browser — this needs
  internet access on the demo machine (any judge's laptop will have this)
  but does **not** need any API key or backend call.

## 11. Previously verified (earlier build)

- frontend production build passed with `npm run build`
- backend dependencies installed cleanly from `requirements.txt`
- backend endpoints were smoke-tested for: trip planning, current-location
  route creation, nearby hospital search from live coordinates

## Known pre-existing limitations (carried over)

- Uploaded photo recognition is only truly reliable with Gemini enabled.
- Bus and train markers are nearby stations/hubs, not live moving vehicles.
- Flight data is still sample/heuristic pricing, not a live flight API.
- Hotel prices are estimated, even when hotel names come from live nearby
  data.

---

## 12. "Wow" features added in this update

A quick tour of what's new, and how to see each one working:

- **Conversational replanning.** Plan a trip, then in the same session send
  a follow-up like *"I don't want flights, I prefer trains"* or *"actually
  my budget is 10000"*. `services/llm.py`'s `looks_like_feedback()` detects
  this pattern and merges the change onto your **existing** intent instead
  of starting over — watch the Action Log show `Feedback Received: ...`.
- **Travel mode selection.** Flight/Train/Bus/Own Vehicle/Rental Car pills
  above the goal input. Choosing "Own Vehicle" skips ticket search entirely
  and shows a fuel + parking estimate instead (`tools/transport.py`).
- **Trip Profile intake.** The "Trip Profile" button (top right, once
  signed in) collects name/age/travelers/transport/food/hotel
  preferences + an emergency contact — saved to your account via
  `PATCH /api/auth/profile`.
- **Destination Preview.** A Google-Travel-style card at the top of the
  Plan tab — search a place before committing to a full plan: rating,
  famous places, best season, live weather/crowd, distance from you,
  estimated 3-day cost. Photos load from Unsplash's keyless `source.unsplash.com`
  endpoint (no API key, resolves at request time in the browser).
- **Multi-agent "thinking" visualization.** Replaces the old plain action
  log — a live strip of all 10 agents lights up as each one's step appears,
  with the real backend log streamed underneath (`components/AgentThinking.tsx`
  + `lib/agentMap.ts`).
- **AI Safety Score & AI Budget Optimizer.** Shown automatically under every
  plan result — a heuristic safety/crowd/women's-safety snapshot, and (if
  the plan is over budget) concrete swaps with a recalculated total.
- **Demo Payment Gateway.** A "Pay Now" button with a simulated QR/UPI
  animation and a `Demo Payment Successful` confirmation — labeled
  everywhere as a prototype, logs a real in-app notification, never touches
  a real payment network.
- **Live GPS tracking.** The location permission now uses
  `watchPosition` (continuous) instead of a one-shot read — the map's blue
  "You" marker moves live, and a floating badge shows live distance/ETA to
  your destination, refreshed every 20s via `/api/route/eta`.
- **Command palette (⌘K / Ctrl+K).** Jump to any tab or trigger example
  prompts without touching the mouse — bottom-right button or the shortcut.
- **UI polish pass.** Glassmorphism cards, glow/hover states, shimmer
  loading skeletons, a gradient hero background, and staggered reveal
  animations throughout (`app/globals.css`).
- **Day-by-day itinerary.** The itinerary now splits attractions across
  "Day 1 / Day 2 / ..." cards instead of one flat list.
- **Email trip summary.** A mail icon next to the trip summary opens a
  prefilled `mailto:` draft with the full trip details — zero config,
  works with whatever email client is set up on the device.

---

## 13. Production architecture & scaling (beyond the hackathon)

**What you have right now** is a solid prototype architecture:

```text
Users → Frontend (Vercel/Next.js) → FastAPI Backend → Gemini AI / OSM+OSRM → SQLite or Postgres
```

This is genuinely fine for a hackathon demo and even a small number of
real users. It will **not** hold up under heavy concurrent load (a few
thousand+ simultaneous users) because of things like: no caching (every
request re-runs the full agent pipeline), a single backend process, no
background job queue (PDF generation blocks the request), and SQLite's
single-writer limitation if you don't switch to Postgres.

**What a production version looks like:**

```text
                    Internet
                        │
               Cloudflare CDN / WAF
                        │
                  Load Balancer
              ┌─────────┴─────────┐
        Backend Server 1     Backend Server 2  (auto-scaled)
              └─────────┬─────────┘
                        │
                  Redis Cache
                        │
              PostgreSQL (managed, e.g. Supabase/RDS)
                        │
        AI Services (Gemini) + Booking/Payment APIs
                        │
           Monitoring & Logging (Sentry/Grafana/Prometheus)
```

Concrete steps, roughly in the order they'd start to matter:

1. **Move off SQLite.** Point `DATABASE_URL` at managed Postgres (Supabase
   or RDS) — the code already supports this, see section 4. Store users,
   trips, hotels, bookings, payments, search history — all already modeled
   in `app/db/models.py`.
2. **Real auth hardening.** You already have bcrypt + JWT + optional
   Google — for production add refresh tokens (current JWTs are long-lived
   7-day tokens, fine for a demo, not ideal at scale) and rotate
   `JWT_SECRET_KEY` via a secrets manager instead of `.env`.
3. **Redis cache.** If 100,000 people search "Delhi trip", don't recompute
   the full agent pipeline 100,000 times — cache `get_destination_preview()`,
   `predict_crowd()`, and `get_weather()` results by destination+date in
   Redis with a short TTL. Cuts AI/API costs and server load dramatically.
4. **Background job queue.** PDF generation (`response/pdf_generator.py`)
   and email sending currently happen inline and block the request. Move
   them to Celery or RQ with Redis as the broker — the user sees
   "Booking in progress…" while a worker finishes it.
5. **Load balancer + multiple backend instances.** Any platform (Render,
   Railway, Fly.io, AWS ECS/Fargate) — if one instance crashes, others keep
   serving. FastAPI is stateless here already (state lives in the DB), so
   this requires no code changes.
6. **Auto-scaling.** AWS/GCP/Azure can scale backend instance count with
   traffic automatically once you're behind a load balancer + health check
   (`GET /health` already exists for this).
7. **Object storage for images.** Move uploaded/generated images (place
   recognition uploads, any user-uploaded photos) to S3 or Cloudinary
   instead of local disk — faster, and survives instance restarts.
8. **Monitoring.** Sentry for exception tracking, Prometheus + Grafana for
   server/request metrics. Wire Sentry's FastAPI integration around
   `app/main.py` first — it's a few lines and immediately useful.
9. **Structured logging.** Log user actions, errors, AI responses, and
   booking failures somewhere queryable (even just structured JSON to
   stdout, captured by your host) — makes debugging production issues far
   faster than reading raw `print()` output.
10. **Automated DB backups.** Hourly/daily snapshots — most managed
    Postgres providers (Supabase, RDS) offer this as a checkbox, not code.
11. **Multi-channel notifications.** Beyond in-app + email, add SMS
    (Twilio) and WhatsApp (WhatsApp Business API) alongside the existing
    FCM path described in section 8.
12. **AI memory across trips.** The `User` model already has
    `preferred_transport`/`food_preference`/`hotel_type` fields — use them
    to bias `extract_intent()`'s defaults so a returning user's second trip
    is personalized without them re-specifying preferences.
13. **Admin dashboard + analytics.** A separate internal route (protected
    by an `is_admin` flag on `User`) showing active users, total bookings,
    AI request volume, error rates, and the most-searched destinations —
    all queryable from the existing `Trip`/`Expense`/`Notification` tables
    with no new infrastructure.

None of this is required to demo well — it's here so you have concrete,
honest answers if a judge asks "how would this scale?"
