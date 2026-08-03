import { PlanResult } from "@/lib/api";

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="glass card-hover rounded-xl p-4 fade-scale-in">
      <p className="text-xs uppercase tracking-[0.2em] text-mist mb-2">{label}</p>
      {children}
    </div>
  );
}

const MODE_LABEL: Record<string, string> = {
  flight: "Flight", train: "Train", bus: "Bus", own_vehicle: "Own Vehicle", rental_car: "Rental Car",
};

function daysFromSummary(summary: string): number {
  const m = summary.match(/(\d+)-day/);
  return m ? parseInt(m[1], 10) : 1;
}

export default function ItineraryResult({ result }: { result: PlanResult }) {
  const days = daysFromSummary(result.trip_summary);
  const attractionsPerDay = Math.max(1, Math.ceil(result.attractions.length / days));
  const dayPlans = Array.from({ length: days }, (_, i) =>
    result.attractions.slice(i * attractionsPerDay, (i + 1) * attractionsPerDay)
  ).filter((d) => d.length > 0);

  return (
    <div className="space-y-4">
      {result.assistant_message && (
        <div className="glass rounded-2xl px-4 py-3 text-sm text-[#dbe4ec] border border-amber/20 fade-scale-in">
          <span className="text-amber font-semibold mr-1.5">AI Assistant:</span>
          {result.assistant_message}
        </div>
      )}
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-semibold">{result.trip_summary}</h2>
        <span
          className={`text-xs font-mono px-2 py-1 rounded ${
            result.within_budget ? "bg-signal/10 text-signal" : "bg-alert/10 text-alert"
          }`}
        >
          ₹{result.total_cost.toLocaleString("en-IN")} / ₹{result.budget.toLocaleString("en-IN")}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card label={MODE_LABEL[result.transport_mode] || "Travel"}>
          {result.flight ? (
            result.transport_mode === "flight" ? (
              <p className="text-sm">
                {result.flight.airline} — ₹{result.flight.price} · {result.flight.duration_hr}h
              </p>
            ) : result.transport_mode === "own_vehicle" || result.transport_mode === "rental_car" ? (
              <div className="text-sm space-y-0.5">
                <p>Total estimate: ₹{result.flight.price}</p>
                {result.flight.breakdown && (
                  <p className="text-xs text-mist">
                    Fuel ₹{result.flight.breakdown.fuel_estimate} · Parking ₹{result.flight.breakdown.parking_estimate}
                    {result.flight.breakdown.rental_estimate > 0 && ` · Rental ₹${result.flight.breakdown.rental_estimate}`}
                  </p>
                )}
                <p className="text-[11px] text-mist/50">{result.flight.note}</p>
              </div>
            ) : (
              <div className="text-sm">
                <p>{result.flight.label} — ₹{result.flight.price}</p>
                <p className="text-[11px] text-mist/50 mt-0.5">{result.flight.note}</p>
              </div>
            )
          ) : (
            <p className="text-sm text-mist">No travel option found</p>
          )}
        </Card>

        <Card label="Hotel">
          <p className="text-sm">
            {result.hotel.name} — ₹{result.hotel.price_per_night}/night
          </p>
          {result.hotel.booking && (
            <p className="text-xs text-mist mt-1">
              {result.hotel.booking.status === "confirmed"
                ? `Confirmed · ${result.hotel.booking.confirmation_id}`
                : "Booking pending"}
            </p>
          )}
        </Card>

        <Card label="Weather">
          <p className="text-sm capitalize">
            {result.weather.condition}, {result.weather.temp_c}°C
          </p>
        </Card>

        <Card label="Attractions">
          <ul className="text-sm space-y-1">
            {result.attractions.map((a) => (
              <li key={a}>· {a}</li>
            ))}
          </ul>
        </Card>
      </div>

      {dayPlans.length > 1 && (
        <div className="glass rounded-xl p-4 fade-scale-in">
          <p className="text-xs uppercase tracking-[0.2em] text-mist mb-3">Day-by-Day Itinerary</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger">
            {dayPlans.map((places, i) => (
              <div key={i} className="border border-line/60 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber mb-1.5">Day {i + 1}</p>
                <ul className="text-sm space-y-1">
                  {places.map((p) => (
                    <li key={p}>✓ {p}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
