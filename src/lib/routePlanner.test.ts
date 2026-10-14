import { describe, expect, it, vi, afterEach } from "vitest";
import {
  isValidPlace, isValidRouteRequest, closePlaces, routeBounds,
  formatMiles, plannerRequest, type Place,
} from "./routePlanner";

const sample: Place = {
  id: "boston",
  label: "Boston, Massachusetts",
  latitude: 42.36,
  longitude: -71.06,
};

describe("route planner validation", () => {
  it("rejects unselected and invalid coordinates", () => {
    expect(isValidPlace(sample)).toBe(true);
    expect(isValidPlace({ ...sample, latitude: 91 })).toBe(false);
    expect(isValidPlace({ ...sample, longitude: NaN })).toBe(false);
    expect(isValidPlace({ ...sample, label: "" })).toBe(false);
    expect(isValidPlace(null)).toBe(false);
  });

  it("requires a destination for one-way trips", () => {
    const base = {
      mode: "one-way",
      start: sample,
      area: null,
      end: null,
      minutes: 30,
      seed: 1,
      avoidHighways: true,
    };
    expect(isValidRouteRequest(base)).toBe(false);
    expect(isValidRouteRequest({ ...base, end: sample })).toBe(true);
    expect(isValidRouteRequest({ ...base, mode: "loop" })).toBe(true);
  });

  it("rejects unreasonable durations and unbounded seeds", () => {
    const base = {
      mode: "loop", start: sample, area: null, end: null,
      minutes: 30, seed: 0, avoidHighways: false,
    };
    expect(isValidRouteRequest({ ...base, minutes: 1440 })).toBe(false);
    expect(isValidRouteRequest({ ...base, seed: 10001 })).toBe(false);
    expect(isValidRouteRequest({ ...base, seed: -1 })).toBe(false);
    expect(isValidRouteRequest({ ...base, avoidHighways: "false" })).toBe(false);
  });

  it("calculates map bounds and readable distances", () => {
    expect(routeBounds([[-71, 42], [-70, 43]])).toEqual([[-71, 42], [-70, 43]]);
    expect(routeBounds([])).toBeNull();
    expect(formatMiles(1609.344)).toBe("1.0");
    expect(closePlaces(sample, { ...sample, latitude: 42.3605 })).toBe(true);
  });
});

afterEach(() => vi.unstubAllGlobals());
it("does not expose provider keys in browser API requests", async () => {
  const request = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ routing: false }), {
      status: 200, headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", request);
  const status = await plannerRequest<{ routing: boolean }>("status");
  expect(status.routing).toBe(false);
  expect(request).toHaveBeenCalledWith(
    "/api/planner?action=status",
    expect.objectContaining({ method: "GET", cache: "no-store" }),
  );
});

it("shows backend failures clearly without inventing route details", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
    Response.json({ error: "Location search and routing are being connected." }, { status: 503 }),
  ));
  await expect(plannerRequest("search", "jwt", { query: "Boston" }))
    .rejects.toThrow(/being connected/);
});
