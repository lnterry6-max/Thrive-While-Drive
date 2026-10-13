import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import axe from "axe-core";
import { mock, resetSupabase, sessionFixture } from "./test/supabaseMock";
import App from "./App";
const map = vi.hoisted(() => ({
  remove: vi.fn(),
  on: vi.fn(),
  construct: vi.fn(),
}));
vi.mock("maplibre-gl", () => ({
  Map: class {
    constructor() {
      map.construct();
    }
    remove = map.remove;
    on = map.on;
    addControl() {}
  },
  NavigationControl: class {},
}));
beforeEach(() => {
  resetSupabase();
  vi.stubEnv("VITE_MAP_STYLE_URL", "");
});
afterEach(() => vi.unstubAllEnvs());
const page = (path = "/") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
it("renders the scenic homepage with local responsive photography", () => {
  page();
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Take the road",
  );
  const image = screen.getByRole("img", { name: /Rocky Mountain/ });
  expect(image).toHaveAttribute("src", "/images/scenic-road-1600.webp");
  expect(image).toHaveAttribute("srcset", expect.stringContaining("800w"));
  expect(screen.getByRole("link", { name: "Plan Your Drive" })).toHaveAttribute(
    "href",
    "/explore",
  );
});
it("keeps all planner controls working and routing disabled", async () => {
  page("/explore");
  await userEvent.type(
    screen.getByLabelText("Explore a city or area"),
    "Boston",
  );
  await userEvent.selectOptions(screen.getByLabelText("Time exploring"), "45");
  await userEvent.selectOptions(
    screen.getByLabelText("Drive style"),
    "Relaxing",
  );
  expect(screen.getByText("Boston")).toBeVisible();
  expect(screen.getByText("45 minutes exploring · Relaxing")).toBeVisible();
  expect(screen.getByRole("button", { name: /Generate route/ })).toBeDisabled();
});
it("uses homepage planning presets", () => {
  page("/explore?style=Relaxing&minutes=45");
  expect(screen.getByLabelText("Time exploring")).toHaveValue("45");
  expect(screen.getByLabelText("Drive style")).toHaveValue("Relaxing");
});
it.each([
  ["/community", "Some things are better shared."],
  ["/statistics", "Make memories.The miles can wait."],
  ["/credits", "Behind the scenery."],
  ["/missing", "This road isn’t on our map."],
])("renders the %s page", (path, title) => {
  page(path);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
});
it("recovers from map initialization failure", async () => {
  vi.stubEnv("VITE_MAP_STYLE_URL", "https://example.com/style.json");
  map.construct.mockImplementationOnce(() => {
    throw new Error("No WebGL");
  });
  page("/explore");
  expect(await screen.findByText("Map unavailable")).toBeVisible();
});
it("handles map errors and cleans up the instance", async () => {
  vi.stubEnv("VITE_MAP_STYLE_URL", "https://example.com/style.json");
  const view = page("/explore");
  await waitFor(() => expect(map.on).toHaveBeenCalled());
  act(() => map.on.mock.calls.find((call) => call[0] === "error")?.[1]());
  expect(screen.getByText("Map unavailable")).toBeVisible();
  view.unmount();
  expect(map.remove).toHaveBeenCalledOnce();
});
it("routes password recovery events to the reset screen", async () => {
  page();
  act(() => mock.listener?.("PASSWORD_RECOVERY", sessionFixture()));
  expect(await screen.findByLabelText("New password")).toBeVisible();
});
it("has no automated accessibility violations on the home page", async () => {
  page();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => null,
  );
  const result = await axe.run(document.body, {
    rules: { "color-contrast": { enabled: false } },
  });
  expect(result.violations.map((v) => v.id)).toEqual([]);
});

it.each(["/explore", "/community", "/profile", "/settings"])(
  "has accessible controls and landmarks on %s",
  async (path) => {
    mock.getSession.mockResolvedValue({
      data: { session: sessionFixture() },
      error: null,
    });
    page(path);
    if (path === "/profile")
      await screen.findByRole("heading", { name: "River" });
    if (path === "/settings")
      await screen.findByRole("heading", { name: "Account settings." });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => null,
    );
    const result = await axe.run(document.body, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(
      result.violations.map((value) => ({
        id: value.id,
        nodes: value.nodes.map((node) => node.target),
      })),
    ).toEqual([]);
  },
);
it("does not show a private or missing public profile", async () => {
  mock.read.mockResolvedValue({ data: null, error: null });
  page("/people/private_user");
  expect(
    await screen.findByText("This profile is private or isn’t available."),
  ).toBeVisible();
  expect(mock.ilike).toHaveBeenCalledWith("username", "private\\_user");
  expect(mock.eq).toHaveBeenCalledWith("visibility", "public");
});
