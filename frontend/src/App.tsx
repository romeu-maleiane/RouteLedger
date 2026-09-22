import { FormEvent, useState, useEffect } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  Fuel,
  LogOut,
  MapPinned,
  Navigation,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { InteractiveMap } from "./components/InteractiveMap";
import { DailyLogSheet, PlanEvent } from "./components/DailyLogSheet";
import { AuthModal } from "./components/AuthModal";
import { SavedTripsModal } from "./components/SavedTripsModal";
import { exportLogsToPDF } from "./utils/pdfExport";
import logoUrl from "./assets/svg/logo.svg";

interface Place {
  label: string;
  latitude: number;
  longitude: number;
}

interface Plan {
  route: {
    distanceMiles: number;
    durationHours: number;
    geometry?: {
      type: string;
      coordinates: [number, number][];
    };
  };
  stops: {
    current: Place;
    pickup: Place;
    dropoff: Place;
  };
  events: PlanEvent[];
  summary: { arrival: string; totalDays: number; cycleRemaining: number };
  assumptions: string[];
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

const initialForm = {
  currentLocation: "Chicago, IL",
  pickupLocation: "Indianapolis, IN",
  dropoffLocation: "Columbus, OH",
  cycleUsedHours: "16",
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );

import { API_BASE } from "./config";

function App() {
  const [form, setForm] = useState(initialForm);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Authentication State
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem("routeledger_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("routeledger_token");
  });

  // Modal States
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [isTripsOpen, setIsTripsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function handleAuthSuccess(newUser: UserProfile, newToken: string) {
    setUser(newUser);
    setToken(newToken);
    localStorage.setItem("routeledger_user", JSON.stringify(newUser));
    localStorage.setItem("routeledger_token", newToken);
  }

  function handleSignOut() {
    setUser(null);
    setToken(null);
    localStorage.removeItem("routeledger_user");
    localStorage.removeItem("routeledger_token");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaveStatus(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/plans/preview/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, cycleUsedHours: Number(form.cycleUsedHours) }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "We could not build this trip plan.");
      }

      setPlan(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to calculate the route.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveTrip() {
    if (!token) {
      setIsAuthOpen(true);
      return;
    }
    if (!plan) return;

    setIsSaving(true);
    setSaveStatus(null);

    try {
      const response = await fetch(`${API_BASE}/plans/save/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...form, cycleUsedHours: Number(form.cycleUsedHours) }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save trip.");
      }
      setSaveStatus("Trip saved to MongoDB Atlas!");
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save trip.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleSelectSavedTrip(savedTrip: any) {
    if (savedTrip.request) {
      setForm({
        currentLocation: savedTrip.request.currentLocation,
        pickupLocation: savedTrip.request.pickupLocation,
        dropoffLocation: savedTrip.request.dropoffLocation,
        cycleUsedHours: String(savedTrip.request.cycleUsedHours),
      });
    }
    if (savedTrip.plan) {
      setPlan(savedTrip.plan);
    }
    setSaveStatus("Loaded saved trip from MongoDB Atlas");
    setTimeout(() => setSaveStatus(null), 3000);
  }

  

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#planner" aria-label="RouteLedger home">
          <img src={logoUrl} alt="RouteLedger logo" width="250" height="100" />
        </a>
        <nav aria-label="Main navigation">
          <a href="#planner">Plan trip</a>
          <a href="#how-it-works">How it works</a>
          {plan && <a href="#daily-logs-section">Daily Logs</a>}
        </nav>

        <div className="user-controls">
          {user ? (
            <>
              <div className="user-badge" title={user.email}>
                <UserCheck size={15} />
                <span>{user.name || user.email.split("@")[0]}</span>
              </div>
              <button
                className="secondary-btn"
                type="button"
                onClick={() => setIsTripsOpen(true)}
              >
                <Database size={15} />
                <span>My Trips (Atlas)</span>
              </button>
              <button
                className="secondary-btn"
                type="button"
                onClick={handleSignOut}
                title="Sign out"
              >
                <LogOut size={15} />
              </button>
            </>
          ) : (
            <>
              <button
                className="secondary-btn"
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setIsAuthOpen(true);
                }}
              >
                Log in
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setAuthMode("register");
                  setIsAuthOpen(true);
                }}
              >
                Sign up
              </button>
            </>
          )}
        </div>
      </header>

      <section className="hero" id="planner">
        <div className="hero-copy">
          <p className="eyebrow">HOS-aware route planning</p>
          <h1>Plan the road ahead with a log you can follow.</h1>
          <p>
            Build your route, calculate FMCSA-compliant HOS rest breaks and fuel stops, view interactive maps, and generate regulatory 24h Daily Log sheets.
          </p>
          <div className="trust-row"><ShieldCheck size={18} /> Property carrier · 70h / 8-day cycle · FMCSA § 395</div>
        </div>

        <form className="plan-form" onSubmit={handleSubmit} noValidate>
          <div className="form-heading">
            <div><p className="eyebrow">New trip</p><h2>Where are you headed?</h2></div>
            <MapPinned aria-hidden="true" />
          </div>
          {[
            ["Current location", "currentLocation", "Where is the driver now?"],
            ["Pickup location", "pickupLocation", "City, state, or full address"],
            ["Dropoff location", "dropoffLocation", "City, state, or full address"],
          ].map(([label, key, hint]) => (
            <label key={key}>
              <span>{label} <b>*</b></span>
              <input
                required
                value={form[key as keyof typeof form]}
                placeholder={hint}
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
              />
            </label>
          ))}
          <label>
            <span>Current cycle used <b>*</b></span>
            <div className="number-input">
              <input
                type="number"
                min="0"
                max="70"
                step="0.25"
                value={form.cycleUsedHours}
                onChange={(event) => setForm({ ...form, cycleUsedHours: event.target.value })}
              />
              <span>hours / 70</span>
            </div>
            <small>Hours already on-duty in the rolling 8-day cycle.</small>
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={isLoading} type="submit">
            {isLoading ? "Calculating route & HOS plan…" : "Plan trip"}
            {!isLoading && <ArrowRight size={18} />}
          </button>
        </form>
      </section>

      <section className="assumptions" id="how-it-works">
        <Clock3 size={20} />
        <p>
          <strong>Built-in planning assumptions:</strong> 1h pickup & dropoff (on-duty), fuel stop every 1,000 mi (30m on-duty), 30-minute required break before 8 consecutive driving hours, 10-hour required rest at 11h driving / 14h window, and 34-hour cycle restart at 70h.
        </p>
      </section>

      {plan && (
        <PlanResults
          plan={plan}
          form={form}
          onSaveTrip={handleSaveTrip}
          isSaving={isSaving}
          saveStatus={saveStatus}
          driverName={user?.name || "John Doe"}
        />
      )}

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => {
          setIsAuthOpen(false);
          setAuthMode("login");
        }}
        onAuthSuccess={handleAuthSuccess}
        initialMode={authMode}
      />

      <SavedTripsModal
        isOpen={isTripsOpen}
        onClose={() => setIsTripsOpen(false)}
        token={token}
        onSelectTrip={handleSelectSavedTrip}
      />
    </main>
  );
}

function PlanResults({
  plan,
  form,
  onSaveTrip,
  isSaving,
  saveStatus,
  driverName,
}: {
  plan: Plan;
  form: typeof initialForm;
  onSaveTrip: () => void;
  isSaving: boolean;
  saveStatus: string | null;
  driverName: string;
}) {
  const arrival = formatDate(plan.summary.arrival);

  return (
    <section className="results" aria-live="polite">
      <div className="results-heading">
        <div>
          <p className="eyebrow">Trip plan ready</p>
          <h2>A route shaped around your available hours.</h2>
        </div>
        <span className="compliance"><CheckCircle2 size={18} /> Within configured FMCSA rules</span>
      </div>

      <div className="plan-actions-bar">
        <button
          type="button"
          className="secondary-btn btn-save-atlas"
          onClick={onSaveTrip}
          disabled={isSaving}
        >
          <Database size={16} />
          <span>{isSaving ? "Saving..." : "Save Trip"}</span>
        </button>

        <button
          type="button"
          className="secondary-btn btn-pdf"
          onClick={() => exportLogsToPDF("regulatory-daily-logs", `trip-logs-${form.currentLocation.split(",")[0]}-to-${form.dropoffLocation.split(",")[0]}.pdf`)}
        >
          <Download size={16} />
          <span>Export Logs (PDF / Print)</span>
        </button>

        {saveStatus && <span className="toast-msg">{saveStatus}</span>}
      </div>

      <div className="metrics">
        <Metric label="Route distance" value={`${plan.route.distanceMiles.toLocaleString()} mi`} />
        <Metric label="Driving estimate" value={`${plan.route.durationHours.toFixed(1)} hrs`} />
        <Metric label="Estimated arrival" value={arrival} />
        <Metric label="Cycle remaining" value={`${plan.summary.cycleRemaining} hrs`} />
      </div>

      <div className="workspace">
        <section className="route-card">
          <div className="section-title">
            <div>
              <p className="eyebrow">Route overview</p>
              <h3>Interactive Path & Stops Map</h3>
            </div>
            <MapPinned size={20} />
          </div>

          <InteractiveMap
            geometry={plan.route.geometry}
            stops={plan.stops}
          />
          <p className="map-note">
            Full geometry plotted via OpenStreetMap & OSRM routing engine with start, pickup, and dropoff checkpoints.
          </p>
        </section>

        <section className="hos-card">
          <div className="section-title">
            <div>
              <p className="eyebrow">HOS status</p>
              <h3>Plan safeguards</h3>
            </div>
            <ShieldCheck size={20} />
          </div>
          <Status label="11-hour driving limit" detail="Mandatory 10h rest scheduled" value={85} />
          <Status label="14-hour duty window" detail="Daily work window strictly enforced" value={78} />
          <Status
            label="70-hour cycle"
            detail={`${plan.summary.cycleRemaining} hrs available after trip`}
            value={Math.max(5, (plan.summary.cycleRemaining / 70) * 100)}
          />
        </section>
      </div>

      <section className="timeline-card">
        <div className="section-title">
          <div>
            <p className="eyebrow">Itinerary</p>
            <h3>Stops, rests, and driving schedule</h3>
          </div>
          <Fuel size={20} />
        </div>
        <ol className="timeline">
          {plan.events.map((event, index) => (
            <li key={`${event.start}-${index}`}>
              <span className={`timeline-dot ${event.type}`} />
              <div>
                <strong>{event.label}</strong>
                <p>
                  {formatDate(event.start)} &rarr; {formatDate(event.end)} · {event.durationHours}h · {event.location}
                </p>
              </div>
              {event.miles > 0 && <span className="miles">{event.miles.toFixed(0)} mi</span>}
            </li>
          ))}
        </ol>
      </section>

      {/* Official FMCSA 24-Hour Daily Logs */}
      <section className="daily-log-card" id="daily-logs-section">
        <div className="section-title">
          <div>
            <p className="eyebrow">Official FMCSA § 395 Logs</p>
            <h3>Driver's Daily Log Sheets ({plan.summary.totalDays} {plan.summary.totalDays === 1 ? "day" : "days"})</h3>
          </div>
          <button
            className="secondary-btn btn-pdf"
            type="button"
            onClick={() => exportLogsToPDF("regulatory-daily-logs", "fmcsa-daily-logs.pdf")}
          >
            <Download size={14} />
            <span>Download PDF</span>
          </button>
        </div>

        <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px" }}>
          Every calendar day is plotted on a complete 24-hour graph grid across the 4 duty lines (Off Duty, Sleeper Berth, Driving, On Duty) with remarks and duty change locations.
        </p>

        <DailyLogSheet
          events={plan.events}
          carrierName="RouteLedger Logistics Inc."
          driverName={driverName}
          origin={form.currentLocation}
          destination={form.dropoffLocation}
        />
      </section>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Status({ label, detail, value }: { label: string; detail: string; value: number }) {
  return (
    <div className="status">
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
      <div className="progress">
        <i style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default App;
