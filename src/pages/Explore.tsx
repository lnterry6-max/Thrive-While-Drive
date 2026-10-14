import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Navigation, Clock3, MapPin, SlidersHorizontal, ShieldCheck,
  ArrowRight, Leaf, RefreshCw,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import {
  DEFAULT_PREFERENCES, DRIVE_STYLES, type DrivePreferences,
} from "../lib/profile";
import {
  formatMiles, plannerRequest, type Place, type PlannedRoute, type RouteMode,
} from "../lib/routePlanner";
import PlacePicker from "../components/PlacePicker";
import MapPreview from "../components/MapPreview";

function Planner() {
  const { session } = useAuth();
  const [params] = useSearchParams();
  const presetStyle = params.get("style");
  const presetMinutes = Number(params.get("minutes"));
  const [mode, setMode] = useState<RouteMode>("loop");
  const [start, setStart] = useState<Place | null>(null);
  const [area, setArea] = useState<Place | null>(null);
  const [end, setEnd] = useState<Place | null>(null);
  const [finishAtStart, setFinishAtStart] = useState(true);
  const [minutes, setMinutes] = useState(
    [15, 30, 45, 60, 90].includes(presetMinutes) ? presetMinutes : 30,
  );
  const [preferences, setPreferences] = useState<DrivePreferences>({
    ...DEFAULT_PREFERENCES,
    preferred_style: DRIVE_STYLES.includes(presetStyle ?? "")
      ? presetStyle!
      : DEFAULT_PREFERENCES.preferred_style,
  });
  const [dirty, setDirty] = useState(false);
  const [preferenceMessage, setPreferenceMessage] = useState("");
  const [providerReady, setProviderReady] = useState(false);
  const [providerChecked, setProviderChecked] = useState(false);
  const [route, setRoute] = useState<PlannedRoute | null>(null);
  const [routeError, setRouteError] = useState("");
  const [planning, setPlanning] = useState(false);
  const [seed, setSeed] = useState(0);

  useEffect(() => {
    let active = true;
    void plannerRequest<{ routing: boolean }>("status")
      .then(({ routing }) => {
        if (active) {
          setProviderReady(routing);
          setProviderChecked(true);
        }
      }, () => {
        if (active) setProviderChecked(true);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!supabase || !session) return;
    let active = true;
    void supabase
      .from("drive_preferences")
      .select("preferred_style,avoid_highways,avoid_traffic,avoid_complex_intersections")
      .eq("user_id", session.user.id)
      .single()
      .then(
        ({ data, error }) => {
          if (!active || dirty) return;
          if (error) {
            setPreferenceMessage("Saved defaults could not load. You can still plan below.");
            return;
          }
          if (data)
            setPreferences({
              ...data,
              preferred_style: DRIVE_STYLES.includes(presetStyle ?? "")
                ? presetStyle!
                : data.preferred_style,
            } as DrivePreferences);
        },
        () => {
          if (active) setPreferenceMessage("Saved defaults could not load. You can still plan below.");
        },
      );
    return () => { active = false; };
  }, [session?.user.id, dirty, presetStyle]);

  function invalidate() {
    setRoute(null);
    setRouteError("");
    setSeed(0);
  }

  async function generate(nextSeed = seed) {
    if (!session || !start || !providerReady || planning ||
        (mode === "one-way" && !end) ||
        (mode === "loop" && !finishAtStart && !end)) return;
    setPlanning(true);
    setRouteError("");
    setRoute(null);
    try {
      const response = await plannerRequest<{ route: PlannedRoute }>(
        "route", session.access_token, {
          mode,
          start,
          area,
          end: mode === "loop" && finishAtStart ? null : end,
          minutes,
          avoidHighways: preferences.avoid_highways,
          seed: nextSeed,
        },
      );
      setRoute(response.route);
      setSeed(nextSeed);
    } catch (error) {
      setRouteError(error instanceof Error ? error.message : "Route planning failed.");
    } finally {
      setPlanning(false);
    }
  }

  const canPlan = !!session && providerReady && !!start && !planning &&
    (mode !== "one-way" || !!end) && (mode !== "loop" || finishAtStart || !!end);

  return (
    <section className="stack">
      <div className="page-intro">
        <div>
          <span className="eyebrow">YOUR NEXT LITTLE ADVENTURE</span>
          <h1>Find a road worth remembering.</h1>
          <p>Explore a real map, choose your own stops, and preview routes before you leave.</p>
        </div>
        <span className="badge"><Leaf size={14} /> Plan at your own pace</span>
      </div>
      <div className="planner-layout">
        <div className="panel stack planner-controls">
          <div className="section-heading">
            <h2>Shape your drive</h2>
            <SlidersHorizontal size={20} />
          </div>
          <fieldset>
            <legend><Navigation size={17} /> Choose a route type</legend>
            <div className="drive-modes" role="group" aria-label="Route type">
              <button
                type="button" aria-pressed={mode === "loop"}
                className={mode === "loop" ? "selected" : ""}
                onClick={() => { setMode("loop"); invalidate(); }}
              >
                <RefreshCw size={16} /> Discovery loop
              </button>
              <button
                type="button" aria-pressed={mode === "one-way"}
                className={mode === "one-way" ? "selected" : ""}
                onClick={() => { setMode("one-way"); invalidate(); }}
              >
                <ArrowRight size={16} /> Point to point
              </button>
            </div>
            <small>
              {mode === "loop"
                ? "A loop explores roads around a chosen area and returns you to your start by default."
                : "Plan a drive between two places, optionally passing through another town."}
            </small>
          </fieldset>
          <fieldset>
            <legend><MapPin size={17} /> Set the places</legend>
            <PlacePicker
              label="Starting location" placeholder="Search for a town or address"
              value={start} token={session?.access_token} enabled={providerReady}
              allowCurrentLocation
              onChange={(value) => { setStart(value); invalidate(); }}
            />
            <PlacePicker
              label={mode === "loop" ? "Area to explore (optional)" : "Town to pass through (optional)"}
              placeholder="e.g. Worcester, Massachusetts"
              value={area} token={session?.access_token} enabled={providerReady}
              onChange={(value) => { setArea(value); invalidate(); }}
            />
            {mode === "loop" && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={finishAtStart}
                  onChange={(event) => {
                    setFinishAtStart(event.target.checked);
                    invalidate();
                  }}
                />
                Finish where I started
              </label>
            )}
            {(mode === "one-way" || !finishAtStart) && (
              <PlacePicker
                label="Ending location"
                placeholder="Search for your destination"
                value={end} token={session?.access_token}
                enabled={providerReady}
                onChange={(value) => { setEnd(value); invalidate(); }}
              />
            )}
            <small>
              Search to select actual mapped places. Current location is optional and
              requested only when you press its button. We do not record a drive or
              save these coordinates to your profile.
            </small>
          </fieldset>
          <fieldset>
            <legend><Clock3 size={17} /> Set your pace</legend>
            <label>
              Target time exploring
              <select
                value={minutes}
                onChange={(event) => { setMinutes(Number(event.target.value)); invalidate(); }}
              >
                {[15, 30, 45, 60, 90].map((value) => (
                  <option key={value} value={value}>{value} minutes</option>
                ))}
              </select>
            </label>
            <label>
              Preferred drive style
              <select
                value={preferences.preferred_style}
                onChange={(event) => {
                  setDirty(true);
                  setPreferences({ ...preferences, preferred_style: event.target.value });
                  invalidate();
                }}
              >
                {DRIVE_STYLES.map((style) => <option key={style}>{style}</option>)}
              </select>
            </label>
            <small>
              Loop distance uses this time as a rough target. Actual road-network
              driving time may differ. Style does not yet change route scoring.
            </small>
          </fieldset>
          <fieldset>
            <legend><ShieldCheck size={17} /> Road preferences</legend>
            {([
              ["avoid_highways", "Exclude major highways"],
              ["avoid_traffic", "Prefer lighter traffic (not yet supported)"],
              ["avoid_complex_intersections", "Prefer simpler intersections (not yet supported)"],
            ] as const).map(([key, label]) => (
              <label className="check" key={key}>
                <input
                  type="checkbox"
                  checked={preferences[key]}
                  onChange={(event) => {
                    setDirty(true);
                    setPreferences({ ...preferences, [key]: event.target.checked });
                    invalidate();
                  }}
                />
                {label}
              </label>
            ))}
            <small>
              The routing provider receives the major-highway restriction when selected.
              Traffic and intersection preferences are saved but not applied to routes yet.
              Always verify a route before driving.
            </small>
          </fieldset>
          {preferenceMessage && <p className="notice" role="status">{preferenceMessage}</p>}
        </div>
        <div className="stack planner-preview">
          <MapPreview route={route} focus={area ?? start} />
          <div className="panel stack">
            <span className="eyebrow">PREPARE WHILE PARKED</span>
            <h2>Your drive preview</h2>
            <div className="route-endpoints">
              <span><i />{start?.label ?? "Choose a starting place"}</span>
              <ArrowRight size={18} />
              <span><i />{mode === "loop" && finishAtStart ? "Return to start" : end?.label ?? "Choose an ending place"}</span>
            </div>
            {area && (
              <div className="summary">
                <strong>{mode === "loop" ? "Explore around" : "Pass through"} {area.label}</strong>
                <span>Target: {minutes} minutes exploring</span>
              </div>
            )}
            {route ? (
              <div className="drive-result" aria-live="polite">
                <div className="drive-stats">
                  <div><strong>{formatMiles(route.distanceMeters)}</strong><span>estimated miles</span></div>
                  <div><strong>{route.totalMinutes}</strong><span>minutes total</span></div>
                  <div><strong>{route.exploringMinutes}</strong><span>minutes exploring</span></div>
                </div>
                {route.mode === "loop" && (
                  <p>Travel to/from the exploration area: about {route.travelMinutes} minutes.</p>
                )}
                {route.notices.map((notice) => <p key={notice} className="route-caveat">{notice}</p>)}
              </div>
            ) : (
              <p>
                Select mapped places and generate a route to view its actual road
                geometry, approximate distance and estimated driving time.
              </p>
            )}
            {!session && (
              <p className="notice">You can browse the map now. <Link to="/profile">Sign in</Link> to search places and plan routes.</p>
            )}
            {session && providerChecked && !providerReady && (
              <p className="notice">The live map is available. Location search and route generation will open once the route provider is configured.</p>
            )}
            {routeError && <p role="alert" className="notice error">{routeError}</p>}
            <button
              type="button"
              className="primary"
              disabled={!canPlan}
              onClick={() => void generate(route && mode === "loop" ? seed + 1 : seed)}
            >
              <Navigation size={18} />
              {planning ? "Planning route…" : route && mode === "loop" ? "Try another loop" : "Generate route"}
            </button>
            <small className="safety-note">
              <ShieldCheck size={15} /> For planning only, not live navigation.
              Never interact with the planner while driving. Obey signs and road conditions.
            </small>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Explore() {
  const { session } = useAuth();
  return <Planner key={session?.user.id ?? "guest"} />;
}
