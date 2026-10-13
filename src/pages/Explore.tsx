import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Navigation,
  Clock3,
  MapPin,
  SlidersHorizontal,
  ShieldCheck,
  ArrowRight,
  Leaf,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import {
  DEFAULT_PREFERENCES,
  DRIVE_STYLES,
  type DrivePreferences,
} from "../lib/profile";
import MapPreview from "../components/MapPreview";
function Planner() {
  const { session } = useAuth();
  const [params] = useSearchParams();
  const presetStyle = params.get("style");
  const presetMinutes = Number(params.get("minutes"));
  const [start, setStart] = useState("Current location");
  const [end, setEnd] = useState("Same as start");
  const [area, setArea] = useState("");
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
  useEffect(() => {
    if (!supabase || !session) return;
    let active = true;
    void supabase
      .from("drive_preferences")
      .select(
        "preferred_style,avoid_highways,avoid_traffic,avoid_complex_intersections",
      )
      .eq("user_id", session.user.id)
      .single()
      .then(
        ({ data, error }) => {
          if (!active || dirty) return;
          if (error) {
            setPreferenceMessage(
              "Saved defaults could not load. You can still plan below.",
            );
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
          if (active)
            setPreferenceMessage(
              "Saved defaults could not load. You can still plan below.",
            );
        },
      );
    return () => {
      active = false;
    };
  }, [session?.user.id, dirty, presetStyle]);
  return (
    <section className="stack">
      <div className="page-intro">
        <div>
          <span className="eyebrow">A GOOD DRIVE STARTS WITH YOU</span>
          <h1>Where will curiosity take you?</h1>
          <p>Pick a place. Find your pace. Make a little room for discovery.</p>
        </div>
        <span className="badge">
          <Leaf size={14} /> Plan at your own pace
        </span>
      </div>
      <div className="planner-layout">
        <div className="panel stack planner-controls">
          <div className="section-heading">
            <h2>Your drive, your way</h2>
            <SlidersHorizontal size={20} />
          </div>
          <fieldset>
            <legend>
              <MapPin size={17} /> Start somewhere
            </legend>
            <label>
              Starting location
              <input value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label>
              Ending location
              <input value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
            <label>
              Explore a city or area
              <input
                placeholder="e.g. Boston, MA"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              />
            </label>
            <small>
              Planning notes only. No location is requested or tracked.
            </small>
          </fieldset>
          <fieldset>
            <legend>
              <Clock3 size={17} /> Set your pace
            </legend>
            <label>
              Time exploring
              <select
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              >
                {[15, 30, 45, 60, 90].map((value) => (
                  <option key={value} value={value}>
                    {value} minutes
                  </option>
                ))}
              </select>
            </label>
            <label>
              Drive style
              <select
                value={preferences.preferred_style}
                onChange={(e) => {
                  setDirty(true);
                  setPreferences({
                    ...preferences,
                    preferred_style: e.target.value,
                  });
                }}
              >
                {DRIVE_STYLES.map((style) => (
                  <option key={style}>{style}</option>
                ))}
              </select>
            </label>
          </fieldset>
          <fieldset>
            <legend>
              <ShieldCheck size={17} /> Feel comfortable on the road
            </legend>
            {(
              [
                ["avoid_highways", "Avoid highways"],
                ["avoid_traffic", "Avoid heavy traffic"],
                ["avoid_complex_intersections", "Avoid complex intersections"],
              ] as const
            ).map(([key, label]) => (
              <label className="check" key={key}>
                <input
                  type="checkbox"
                  checked={preferences[key]}
                  onChange={(e) => {
                    setDirty(true);
                    setPreferences({ ...preferences, [key]: e.target.checked });
                  }}
                />
                {label}
              </label>
            ))}
            <small>
              These preferences will guide routing when it becomes available.
            </small>
          </fieldset>
          {preferenceMessage && <p role="status">{preferenceMessage}</p>}
        </div>
        <div className="stack planner-preview">
          <MapPreview />
          <div className="panel stack">
            <span className="eyebrow">A LITTLE LOOK AHEAD</span>
            <h2>Your planned drive</h2>
            <div className="route-endpoints">
              <span>
                <i />
                {start || "Choose a start"}
              </span>
              <ArrowRight size={18} />
              <span>
                <i />
                {end || "Choose an end"}
              </span>
            </div>
            <div className="summary">
              <strong>{area || "Select an exploration area"}</strong>
              <span>
                {minutes} minutes exploring · {preferences.preferred_style}
              </span>
            </div>
            <p>
              Travel times, distance and turn-by-turn directions will appear
              after live routing is connected.
            </p>
            <button
              className="primary"
              disabled
              title="Routing integration is not configured yet"
            >
              <Navigation size={18} /> Generate route — coming soon
            </button>
            <small className="safety-note">
              <ShieldCheck size={15} /> This is a plan, not a navigable route.
              Always plan while parked.
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
