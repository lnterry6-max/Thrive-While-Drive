import {
  closePlaces,
  isValidRouteRequest,
  type Coordinates,
  type Place,
  type PlannedRoute,
  type RouteRequest,
} from "../src/lib/routePlanner";

export const maxDuration = 45;
const GRAPH_HOPPER = "https://graphhopper.com/api/1";

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function authenticate(request: Request): Promise<boolean> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!token || token.length > 4096 || !url || !key) return false;
  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) return false;
    const user: unknown = await response.json();
    return !!user && typeof user === "object" && "id" in user &&
      typeof user.id === "string" && user.id.length > 0;
  } catch {
    return false;
  }
}

async function provider(url: URL, options?: RequestInit): Promise<unknown> {
  try {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (!response.ok) {
      if (response.status === 429)
        throw new Error("The map provider is busy. Please try again shortly.");
      if (response.status === 401 || response.status === 403)
        throw new Error("The route provider key needs attention. Please contact the app administrator.");
      if (response.status >= 400 && response.status < 500)
        throw new Error("No route was found with these locations and preferences. Try different places.");
      throw new Error("The route provider is temporarily unavailable.");
    }
    return response.json();
  } catch (error) {
    if (error instanceof Error && /provider|route was found/.test(error.message)) throw error;
    throw new Error("The map service couldn't be reached. Please try again.");
  }
}

function isFiniteCoord(pair: unknown): pair is Coordinates {
  return Array.isArray(pair) && pair.length >= 2 &&
    typeof pair[0] === "number" && Number.isFinite(pair[0]) &&
    typeof pair[1] === "number" && Number.isFinite(pair[1]) &&
    Math.abs(pair[0]) <= 180 && Math.abs(pair[1]) <= 90;
}

type Leg = { coordinates: Coordinates[]; distanceMeters: number; minutes: number };

async function graphHopperRoute(
  points: Place[],
  apiKey: string,
  options: { roundTrip?: { distance: number; seed: number }; avoidHighways: boolean },
): Promise<Leg> {
  const url = new URL(`${GRAPH_HOPPER}/route`);
  url.searchParams.set("key", apiKey);
  const body: Record<string, unknown> = {
    profile: "car",
    points: points.map((p) => [p.longitude, p.latitude]),
    points_encoded: false,
    instructions: false,
    elevation: false,
    "ch.disable": true,
  };
  if (options.roundTrip) {
    body.algorithm = "round_trip";
    body.round_trip = options.roundTrip;
  }
  if (options.avoidHighways) {
    // Fail closed: do not silently ignore a requested motorway restriction.
    body.custom_model = {
      priority: [
        { if: "road_class == MOTORWAY", multiply_by: "0" },
        { if: "road_class == TRUNK", multiply_by: "0" },
      ],
    };
  }
  const result = await provider(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as { paths?: Array<{ distance?: unknown; time?: unknown; points?: { coordinates?: unknown } }> };
  const path = result.paths?.[0];
  const coords = path?.points?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2 || coords.length > 25000 ||
    !coords.every(isFiniteCoord) ||
    typeof path?.distance !== "number" || !Number.isFinite(path.distance) ||
    typeof path.time !== "number" || !Number.isFinite(path.time) ||
    path.distance < 0 || path.time < 0)
    throw new Error("The route provider returned an invalid route. Please try again.");
  return {
    coordinates: coords.map((p) => [p[0], p[1]]),
    distanceMeters: path.distance,
    minutes: path.time / 60000,
  };
}

function combine(legs: Leg[], request: RouteRequest, exploringMinutes: number): PlannedRoute {
  const coordinates: Coordinates[] = [];
  for (const leg of legs) {
    // Remove duplicate seam points at leg joins.
    coordinates.push(...(coordinates.length ? leg.coordinates.slice(1) : leg.coordinates));
  }
  const totalMinutes = legs.reduce((sum, leg) => sum + leg.minutes, 0);
  return {
    coordinates,
    distanceMeters: Math.round(legs.reduce((sum, leg) => sum + leg.distanceMeters, 0)),
    totalMinutes: Math.round(totalMinutes),
    exploringMinutes: Math.round(exploringMinutes),
    travelMinutes: Math.round(Math.max(0, totalMinutes - exploringMinutes)),
    mode: request.mode,
    notices: [
      "Estimated driving time is based on road-network data, not live traffic. Plan while parked.",
      "Scenic style, traffic avoidance and intersection complexity are not yet verified by the routing provider.",
      ...(request.avoidHighways
        ? ["Motorways and major trunk roads are excluded through a provider model where map coverage supports it. Verify every road yourself."]
        : []),
    ],
  };
}

async function makeRoute(input: RouteRequest, apiKey: string): Promise<PlannedRoute> {
  const { start, area, minutes, seed, avoidHighways } = input;
  if (input.mode === "one-way") {
    const end = input.end!;
    const places = [start, ...(area && !closePlaces(area, start) && !closePlaces(area, end) ? [area] : []), end];
    const route = await graphHopperRoute(places, apiKey, { avoidHighways });
    return combine([route], input, route.minutes);
  }
  const anchor = area ?? start;
  const finish = input.end ?? start;
  const legs: Leg[] = [];
  if (!closePlaces(start, anchor))
    legs.push(await graphHopperRoute([start, anchor], apiKey, { avoidHighways }));
  // GraphHopper takes an approximate distance, not a duration. The target
  // distance uses a rough 45 km/h assumption; always display actual ETA.
  const round = await graphHopperRoute([anchor], apiKey, {
    roundTrip: { distance: Math.round(minutes * 750), seed },
    avoidHighways,
  });
  legs.push(round);
  if (!closePlaces(anchor, finish))
    legs.push(await graphHopperRoute([anchor, finish], apiKey, { avoidHighways }));
  return combine(legs, input, round.minutes);
}

async function searchPlaces(q: string, apiKey: string): Promise<Place[]> {
  const url = new URL(`${GRAPH_HOPPER}/geocode`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "6");
  url.searchParams.set("locale", "en");
  const result = await provider(url) as { hits?: Array<Record<string, unknown>> };
  if (!Array.isArray(result.hits)) return [];
  return result.hits.slice(0, 6).flatMap((hit) => {
    const point = hit.point as { lat?: unknown; lng?: unknown } | undefined;
    const latitude = point?.lat;
    const longitude = point?.lng;
    if (typeof latitude !== "number" || typeof longitude !== "number" ||
        !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
      return [];
    const parts = [hit.name, hit.city, hit.state, hit.country]
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    const label = [...new Set(parts)].join(", ").slice(0, 200);
    if (!label) return [];
    return [{ id: `${latitude.toFixed(6)},${longitude.toFixed(6)}`, label, latitude, longitude }];
  });
}

/**
 * Vercel API proxy. The provider key stays server-side. Signed-in users only;
 * no location history, user profile updates, or route tracking.
 */
async function handlePlanner(request: Request): Promise<Response> {
    // Accept absolute Web Request URLs and relative legacy runtime URLs.
    const url = new URL(request.url, "https://planner.internal");
    const action = url.searchParams.get("action");
    if (request.method === "GET" && action === "status")
      return json({ maps: true, routing: Boolean(process.env.GRAPH_HOPPER_API_KEY) });
    if ((request.method !== "GET" || action !== "search") &&
        (request.method !== "POST" || action !== "route"))
      return json({ error: "Unsupported planner action." }, 405);
    const key = process.env.GRAPH_HOPPER_API_KEY;
    if (!key) return json({ error: "Location search and routing are being connected. Please try again later." }, 503);
    if (!await authenticate(request))
      return json({ error: "Sign in to search for locations and plan routes." }, 401);
    try {
      if (action === "search") {
        const q = url.searchParams.get("q")?.trim() ?? "";
        if (q.length < 3 || q.length > 120)
          return json({ error: "Enter at least three characters to search for a place." }, 400);
        return json({ places: await searchPlaces(q, key) });
      }
      const raw = await request.text();
      if (raw.length > 5000) return json({ error: "Route request is too large." }, 413);
      let input: unknown;
      try { input = JSON.parse(raw); } catch { return json({ error: "Invalid route request." }, 400); }
      if (!isValidRouteRequest(input))
        return json({ error: "Select valid places and a driving duration before planning." }, 400);
      return json({ route: await makeRoute(input, key) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Route generation failed.";
      return json({ error: message }, 502);
    }
}

// HTTP method exports use Vercel's documented Web Handler contract.
export function GET(request: Request): Promise<Response> {
  return handlePlanner(request);
}

export function POST(request: Request): Promise<Response> {
  return handlePlanner(request);
}
