// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import planner from "../api/planner";


const origin = "https://preview.vercel.app";
const token = "test-access-token";
const place = {
  id: "a", label: "Town A", latitude: 42.1, longitude: -71.1,
};
const destination = {
  id: "b", label: "Town B", latitude: 42.2, longitude: -71.2,
};
const fakeRoute = {
  paths: [{
    distance: 12340, time: 1800000,
    points: { type: "LineString", coordinates: [[-71.1,42.1],[-71.2,42.2]] },
  }],
};
const asRequest = (action: string, input?: unknown) =>
  new Request(`${origin}/api/planner?action=${action}`, {
    method: input === undefined ? "GET" : "POST",
    ...(input === undefined ? {} : {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  });
function fakeAuth() { return Response.json({ id: "test-user" }); }

beforeEach(() => {
  vi.stubEnv("GRAPH_HOPPER_API_KEY", "test-secret-not-for-browser");
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("protected location and routing API", () => {
  it("exports a callable Vercel request handler", () => {
    expect(typeof planner).toBe("function");
  });

  it("reports provider readiness without disclosing a credential", async () => {
    const response = await planner(asRequest("status"));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ maps: true, routing: true });
    expect(text).not.toContain("test-secret-not-for-browser");
  });

  it("does not call the provider when the server key is missing", async () => {
    vi.stubEnv("GRAPH_HOPPER_API_KEY", "");
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const result = await planner.fetch(asRequest("search"));
    expect(result.status).toBe(503);
    expect(spy).not.toHaveBeenCalled();
  });

  it("requires a valid Supabase session before making paid requests", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const response = await planner.fetch(new Request(`${origin}/api/planner?action=search&q=Boston`));
    expect(response.status).toBe(401);
    expect(spy).not.toHaveBeenCalled();
  });

  it("searches for real places and returns only validated coordinates", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(fakeAuth())
      .mockResolvedValueOnce(Response.json({
        hits: [
          { name: "Boston", state: "Massachusetts", country: "United States",
            point: { lat: 42.36, lng: -71.06 } },
          { name: "Broken", point: { lat: "??", lng: -71 } },
        ],
      }));
    vi.stubGlobal("fetch", mockFetch);
    const request = new Request(`${origin}/api/planner?action=search&q=Boston`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const response = await planner.fetch(request);
    const data = await response.json() as { places: Array<{label: string;latitude: number}> };
    expect(response.status).toBe(200);
    expect(data.places).toHaveLength(1);
    expect(data.places[0]).toMatchObject({ latitude: 42.36, label: "Boston, Massachusetts, United States" });
    expect(String(mockFetch.mock.calls[1][0])).toContain("q=Boston");
  });

  it("rejects invalid route data before contacting a routing provider", async () => {
    const mockFetch = vi.fn().mockResolvedValue(fakeAuth());
    vi.stubGlobal("fetch", mockFetch);
    const response = await planner.fetch(asRequest("route", {
      mode: "loop", start: { ...place, latitude: 1000 }, area: null, end: null,
      minutes: 30, avoidHighways: true, seed: 0,
    }));
    expect(response.status).toBe(400);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("creates a one-way route without leaking provider credentials in its response", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(fakeAuth())
      .mockResolvedValueOnce(Response.json(fakeRoute));
    vi.stubGlobal("fetch", mockFetch);
    const response = await planner.fetch(asRequest("route", {
      mode: "one-way", start: place, area: null, end: destination,
      minutes: 30, avoidHighways: true, seed: 0,
    }));
    expect(response.status).toBe(200);
    const body = await response.json() as { route: { coordinates: number[][]; distanceMeters: number; notices: string[] } };
    expect(body.route.distanceMeters).toBe(12340);
    expect(body.route.coordinates).toHaveLength(2);
    expect(body.route.notices.some((s) => s.includes("traffic"))).toBe(true);
    const providerUrl = String(mockFetch.mock.calls[1][0]);
    expect(providerUrl).toContain("graphhopper.com");
    const options = mockFetch.mock.calls[1][1] as RequestInit;
    expect(options.method).toBe("POST");
    expect(JSON.stringify(options.body)).toContain("MOTORWAY");
    expect(JSON.stringify(body)).not.toContain("test-secret-not-for-browser");
  });

  it("builds outbound, area-loop and return legs while separating transit time", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(fakeAuth())
      .mockResolvedValueOnce(Response.json(fakeRoute))
      .mockResolvedValueOnce(Response.json(fakeRoute))
      .mockResolvedValueOnce(Response.json(fakeRoute));
    vi.stubGlobal("fetch", mockFetch);
    const response = await planner.fetch(asRequest("route", {
      mode: "loop", start: place, area: destination, end: null,
      minutes: 45, avoidHighways: false, seed: 2,
    }));
    expect(response.status).toBe(200);
    const body = await response.json() as { route: { totalMinutes: number; exploringMinutes: number; travelMinutes: number } };
    expect(body.route.totalMinutes).toBe(90);
    expect(body.route.exploringMinutes).toBe(30);
    expect(body.route.travelMinutes).toBe(60);
    const round = JSON.parse(mockFetch.mock.calls[2][1].body as string) as {
      algorithm: string; round_trip: { distance: number;seed: number };
    };
    expect(round.algorithm).toBe("round_trip");
    expect(round.round_trip).toEqual({ distance: 33750, seed: 2 });
  });

  it("never returns an unvalidated route when the provider fails", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(fakeAuth())
      .mockResolvedValueOnce(Response.json({ message: "No route" }, { status: 400 }));
    vi.stubGlobal("fetch", mockFetch);
    const response = await planner.fetch(asRequest("route", {
      mode: "one-way", start: place, area: null, end: destination,
      minutes: 30, avoidHighways: true, seed: 0,
    }));
    expect(response.status).toBe(502);
    expect((await response.json() as { error: string }).error).toMatch(/No route was found/);
  });
});
