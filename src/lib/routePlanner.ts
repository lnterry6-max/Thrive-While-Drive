export type Coordinates = [longitude: number, latitude: number];

export interface Place {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
}

export type RouteMode = "loop" | "one-way";

export interface RouteRequest {
  mode: RouteMode;
  start: Place;
  area: Place | null;
  end: Place | null;
  minutes: number;
  avoidHighways: boolean;
  seed: number;
}

export interface PlannedRoute {
  coordinates: Coordinates[];
  distanceMeters: number;
  totalMinutes: number;
  exploringMinutes: number;
  travelMinutes: number;
  mode: RouteMode;
  notices: string[];
}

/** Never accept an arbitrary string as a road location. A user must choose a result. */
export function isValidPlace(value: unknown): value is Place {
  if (!value || typeof value !== "object") return false;
  const place = value as Partial<Place>;
  return (
    typeof place.id === "string" &&
    place.id.length > 0 &&
    place.id.length <= 120 &&
    typeof place.label === "string" &&
    place.label.trim().length > 0 &&
    place.label.length <= 200 &&
    typeof place.latitude === "number" &&
    Number.isFinite(place.latitude) &&
    Math.abs(place.latitude) <= 90 &&
    typeof place.longitude === "number" &&
    Number.isFinite(place.longitude) &&
    Math.abs(place.longitude) <= 180
  );
}

export function isValidRouteRequest(value: unknown): value is RouteRequest {
  if (!value || typeof value !== "object") return false;
  const req = value as Partial<RouteRequest>;
  return (
    (req.mode === "loop" || req.mode === "one-way") &&
    isValidPlace(req.start) &&
    (req.area === null || isValidPlace(req.area)) &&
    (req.end === null || isValidPlace(req.end)) &&
    [15, 30, 45, 60, 90].includes(req.minutes ?? -1) &&
    typeof req.avoidHighways === "boolean" &&
    typeof req.seed === "number" &&
    Number.isInteger(req.seed) &&
    req.seed >= 0 &&
    req.seed <= 10_000 &&
    (req.mode !== "one-way" || req.end !== null)
  );
}

export function closePlaces(a: Place, b: Place): boolean {
  return Math.abs(a.latitude - b.latitude) < 0.001 &&
    Math.abs(a.longitude - b.longitude) < 0.001;
}

export function formatMiles(meters: number): string {
  return (meters / 1609.344).toFixed(1);
}

export function routeBounds(coordinates: Coordinates[]) {
  if (!coordinates.length) return null;
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of coordinates) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return [[minLon, minLat], [maxLon, maxLat]] as [Coordinates, Coordinates];
}

/** Browser requests are authenticated and contain no embedded routing credentials. */
export async function plannerRequest<T>(
  action: "search" | "route" | "status",
  token?: string,
  payload?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const params = new URLSearchParams({ action });
  if (action === "search" && typeof payload?.query === "string")
    params.set("q", payload.query);
  const response = await fetch(`/api/planner?${params}`, {
    method: action === "route" ? "POST" : "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(action === "route" ? { "Content-Type": "application/json" } : {}),
    },
    ...(action === "route" ? { body: JSON.stringify(payload) } : {}),
    signal,
    cache: "no-store",
  });
  const result: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      result && typeof result === "object" && "error" in result &&
      typeof result.error === "string"
        ? result.error
        : "The route service is temporarily unavailable.";
    throw new Error(message);
  }
  return result as T;
}
