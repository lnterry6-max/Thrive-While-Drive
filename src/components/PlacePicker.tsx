import { useEffect, useRef, useState } from "react";
import { LocateFixed, Search } from "lucide-react";
import { plannerRequest, type Place } from "../lib/routePlanner";

interface Props {
  label: string;
  placeholder: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  token?: string;
  enabled: boolean;
  allowCurrentLocation?: boolean;
}

export default function PlacePicker({
  label, placeholder, value, onChange, token, enabled, allowCurrentLocation = false,
}: Props) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [places, setPlaces] = useState<Place[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    // Parent can clear a location when switching planning modes.
    if (!value) return;
    setQuery(value.label);
  }, [value]);

  async function search() {
    if (!token || !enabled || busy) return;
    controller.current?.abort();
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setMessage("Enter at least three characters.");
      setPlaces([]);
      return;
    }
    const next = new AbortController();
    controller.current = next;
    setBusy(true);
    setMessage("");
    try {
      const response = await plannerRequest<{ places: Place[] }>(
        "search", token, { query: trimmed }, next.signal,
      );
      if (next.signal.aborted) return;
      setPlaces(response.places);
      if (!response.places.length) setMessage("No places found. Try a nearby town or full city name.");
    } catch (error) {
      if (!next.signal.aborted)
        setMessage(error instanceof Error ? error.message : "Search failed.");
    } finally {
      if (!next.signal.aborted) setBusy(false);
    }
  }

  function select(place: Place) {
    setQuery(place.label);
    setPlaces([]);
    setMessage("");
    onChange(place);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setMessage("Location access is not supported in this browser.");
      return;
    }
    setBusy(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBusy(false);
        select({
          id: `current:${position.coords.latitude.toFixed(6)},${position.coords.longitude.toFixed(6)}`,
          label: "My current location",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setBusy(false);
        setMessage("Location permission was denied or unavailable. You can search for a town instead.");
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
    );
  }

  return (
    <div className="place-picker">
      <form
        onSubmit={(event) => { event.preventDefault(); void search(); }}
        className="place-search-form"
      >
        <label>
          {label}
          <input
            value={query}
            placeholder={placeholder}
            autoComplete="off"
            maxLength={120}
            onChange={(event) => {
              setQuery(event.target.value);
              setPlaces([]);
              setMessage("");
              if (value) onChange(null);
            }}
          />
        </label>
        <button type="submit" disabled={!enabled || !token || busy} aria-label={`Search ${label.toLowerCase()}`}>
          <Search size={17} /> {busy ? "Searching…" : "Search"}
        </button>
      </form>
      {value && <p className="place-selected" role="status">Selected: {value.label}</p>}
      {allowCurrentLocation && (
        <button
          type="button" className="place-location-button"
          onClick={useCurrentLocation}
          disabled={busy || !enabled || !token}
        >
          <LocateFixed size={16} /> Use my location (optional)
        </button>
      )}
      {!!places.length && (
        <ul className="place-results" aria-label={`${label} suggestions`}>
          {places.map((place) => (
            <li key={place.id}>
              <button type="button" onClick={() => select(place)}>
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && <p className="place-message" role="status">{message}</p>}
    </div>
  );
}
