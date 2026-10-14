import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it } from "vitest";
import {
  mock,
  profileFixture,
  resetSupabase,
  sessionFixture,
} from "./test/supabaseMock";
import { AuthProvider } from "./auth/AuthProvider";
import Profile from "./Profile";
beforeEach(resetSupabase);
const renderProfile = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <Profile />
      </AuthProvider>
    </MemoryRouter>,
  );
async function signedIn() {
  mock.getSession.mockResolvedValue({
    data: { session: sessionFixture() },
    error: null,
  });
  const view = renderProfile();
  await screen.findByRole("heading", { name: "River" });
  return view;
}
async function credentials() {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Email"), "driver@example.com");
  await user.type(screen.getByLabelText(/^Password/), "test-password");
  return user;
}
it("submits login credentials and displays server errors", async () => {
  mock.signInWithPassword.mockResolvedValue({
    data: {},
    error: { message: "Invalid login credentials" },
  });
  renderProfile();
  const user = await credentials();
  await user.click(screen.getByRole("button", { name: "Sign in to Thrive" }));
  expect(mock.signInWithPassword).toHaveBeenCalledWith({
    email: "driver@example.com",
    password: "test-password",
  });
  expect(await screen.findByText("Invalid login credentials")).toBeVisible();
});
it("supports signup, email confirmation and resend", async () => {
  renderProfile();
  await userEvent.click(
    await screen.findByRole("button", { name: "Create account" }),
  );
  const user = await credentials();
  await user.click(screen.getByRole("button", { name: "Create my account" }));
  expect(
    await screen.findByText(/Check your email to confirm registration/),
  ).toBeVisible();
  expect(mock.signUp).toHaveBeenCalledWith({
    email: "driver@example.com",
    password: "test-password",
    options: { emailRedirectTo: expect.stringContaining("/profile") },
  });
  await user.click(
    screen.getByRole("button", { name: "Resend verification email" }),
  );
  expect(mock.resend).toHaveBeenCalled();
});
it("sends a password recovery link without revealing account existence", async () => {
  renderProfile();
  await userEvent.click(
    await screen.findByRole("button", { name: "Forgot password?" }),
  );
  await userEvent.type(screen.getByLabelText("Email"), "driver@example.com");
  await userEvent.click(
    screen.getByRole("button", { name: "Send reset link" }),
  );
  expect(mock.resetPasswordForEmail).toHaveBeenCalledWith(
    "driver@example.com",
    { redirectTo: expect.stringContaining("/reset-password") },
  );
  expect(await screen.findByText(/If an account exists/)).toBeVisible();
});
it("handles rejected login requests and permits retry", async () => {
  mock.signInWithPassword.mockRejectedValue(new Error("Network unavailable"));
  renderProfile();
  const user = await credentials();
  await user.click(screen.getByRole("button", { name: "Sign in to Thrive" }));
  expect(await screen.findByText("Network unavailable")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Sign in to Thrive" }),
  ).toBeEnabled();
});
it("loads and saves persisted profile fields scoped to the owner", async () => {
  await signedIn();
  expect(screen.getByText("Taking the scenic way.")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Edit profile" }));
  expect(
    screen.getByRole("button", { name: "Scenic Explorer" }),
  ).toHaveAttribute("aria-pressed", "true");
  await userEvent.clear(screen.getByLabelText("Display name"));
  await userEvent.type(screen.getByLabelText("Display name"), "New name");
  await userEvent.click(screen.getByRole("button", { name: "Road Tripper" }));
  await userEvent.click(screen.getByRole("button", { name: "Save profile" }));
  expect(mock.update).toHaveBeenCalledWith(
    expect.objectContaining({
      display_name: "New name",
      tags: ["Scenic Explorer", "Road Tripper"],
    }),
  );
  expect(mock.eq).toHaveBeenLastCalledWith("id", "user-a");
  expect(await screen.findByText("Profile saved.")).toBeVisible();
});
it("shows a useful case-insensitive username conflict", async () => {
  await signedIn();
  mock.write.mockResolvedValue({ data: null, error: { code: "23505" } });
  await userEvent.click(screen.getByRole("button", { name: "Edit profile" }));
  await userEvent.click(screen.getByRole("button", { name: "Save profile" }));
  expect(await screen.findByText(/username is already taken/)).toBeVisible();
  expect(screen.queryByText("Profile saved.")).toBeNull();
});
it("never reports success for a zero-row write", async () => {
  await signedIn();
  mock.write.mockResolvedValue({ data: null, error: null });
  await userEvent.click(screen.getByRole("button", { name: "Edit profile" }));
  await userEvent.click(screen.getByRole("button", { name: "Save profile" }));
  expect(
    await screen.findByText("Profile was not saved. Please try again."),
  ).toBeVisible();
});
it("enforces the five-interest limit and permits deselection", async () => {
  await signedIn();
  await userEvent.click(screen.getByRole("button", { name: "Edit profile" }));
  for (const name of [
    "New Driver",
    "Learning Driver",
    "Experienced Driver",
    "Driving Enthusiast",
    "Road Tripper",
  ])
    await userEvent.click(screen.getByRole("button", { name }));
  expect(screen.getByText("5/5 selected")).toBeVisible();
  expect(screen.getByRole("button", { name: "Road Tripper" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await userEvent.click(screen.getByRole("button", { name: "New Driver" }));
  expect(screen.getByText("4/5 selected")).toBeVisible();
});
it("shows retry when profile loading fails without enabling editing", async () => {
  mock.getSession.mockResolvedValue({ data: { session: sessionFixture() } });
  mock.read.mockRejectedValue(new Error("Profile load failed"));
  renderProfile();
  expect(await screen.findByText("Profile load failed")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Edit profile" })).toBeNull();
  mock.read.mockResolvedValue({ data: profileFixture });
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("heading", { name: "River" })).toBeVisible();
});
it("ignores a pending old-account profile after switching accounts", async () => {
  let resolve!: (value: unknown) => void;
  mock.getSession.mockResolvedValue({ data: { session: sessionFixture() } });
  mock.read.mockReturnValueOnce(
    new Promise((r) => {
      resolve = r;
    }),
  );
  renderProfile();
  await waitFor(() => expect(mock.read).toHaveBeenCalled());
  mock.read.mockResolvedValue({
    data: { ...profileFixture, id: "user-b", display_name: "Meadow" },
  });
  act(() => mock.listener?.("SIGNED_IN", sessionFixture("user-b")));
  expect(await screen.findByRole("heading", { name: "Meadow" })).toBeVisible();
  await act(async () => resolve({ data: profileFixture }));
  expect(screen.queryByRole("heading", { name: "River" })).toBeNull();
});
it("ignores stale initial session results and unsubscribes on unmount", async () => {
  let resolve!: (value: unknown) => void;
  mock.getSession.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const view = renderProfile();
  act(() => mock.listener?.("SIGNED_IN", sessionFixture()));
  await act(async () => resolve({ data: { session: null } }));
  expect(await screen.findByRole("heading", { name: "River" })).toBeVisible();
  view.unmount();
  expect(mock.unsubscribe).toHaveBeenCalledOnce();
});
it("surfaces session initialization errors", async () => {
  mock.getSession.mockRejectedValue(new Error("Session unavailable"));
  renderProfile();
  expect(await screen.findByText("Session unavailable")).toBeVisible();
});
