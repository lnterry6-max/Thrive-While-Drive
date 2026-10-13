import { mock, resetSupabase, sessionFixture } from "../test/supabaseMock";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it } from "vitest";
import { AuthProvider } from "../auth/AuthProvider";
import Settings from "./Settings";
import ResetPassword from "./ResetPassword";
beforeEach(() => {
  resetSupabase();
  mock.getSession.mockResolvedValue({
    data: { session: sessionFixture() },
    error: null,
  });
});
const page = (node = <Settings />) =>
  render(
    <MemoryRouter>
      <AuthProvider>{node}</AuthProvider>
    </MemoryRouter>,
  );
it("loads private settings and saves drive preferences for the current account", async () => {
  page();
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Save drive preferences" }),
    ).toBeEnabled(),
  );
  await userEvent.selectOptions(
    screen.getByLabelText("Preferred drive style"),
    "Relaxing",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Save drive preferences" }),
  );
  expect(mock.update).toHaveBeenCalledWith(
    expect.objectContaining({ preferred_style: "Relaxing" }),
  );
  expect(mock.eq).toHaveBeenCalledWith("user_id", "user-a");
  expect(await screen.findByText("Drive preferences saved.")).toBeVisible();
});
it("persists profile visibility and displays failure instead of false success", async () => {
  page();
  await waitFor(() =>
    expect(screen.getByLabelText("Who can see your profile?")).toBeEnabled(),
  );
  mock.write.mockResolvedValue({
    data: null,
    error: { message: "Permission denied" },
  });
  await userEvent.selectOptions(
    screen.getByLabelText("Who can see your profile?"),
    "public",
  );
  expect(await screen.findByText("Permission denied")).toBeVisible();
  expect(screen.getByLabelText("Who can see your profile?")).toHaveValue(
    "private",
  );
});
it("requires confirmation and fresh authentication before account deletion", async () => {
  page();
  const button = await screen.findByRole("button", {
    name: "Permanently delete my account",
  });
  expect(button).toBeDisabled();
  await userEvent.type(
    screen.getByLabelText("Type DELETE to confirm"),
    "DELETE",
  );
  await userEvent.type(
    screen.getByLabelText("Confirm your password"),
    "password123",
  );
  await userEvent.click(button);
  await waitFor(() =>
    expect(mock.rpc).toHaveBeenCalledWith("delete_my_account"),
  );
  expect(mock.signInWithPassword).toHaveBeenCalledWith({
    email: "user-a@example.com",
    password: "password123",
  });
  expect(mock.signOut).toHaveBeenCalledWith({ scope: "local" });
});
it("does not delete any data when reauthentication fails", async () => {
  mock.signInWithPassword.mockResolvedValue({
    data: {},
    error: { message: "Wrong password" },
  });
  page();
  await userEvent.type(
    await screen.findByLabelText("Type DELETE to confirm"),
    "DELETE",
  );
  await userEvent.type(
    screen.getByLabelText("Confirm your password"),
    "wrong-password",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Permanently delete my account" }),
  );
  expect(await screen.findByText("Wrong password")).toBeVisible();
  expect(mock.list).not.toHaveBeenCalled();
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("does not delete the account if stored photos cannot be removed", async () => {
  mock.list.mockResolvedValue({ error: { message: "Storage offline" } });
  page();
  await userEvent.type(
    await screen.findByLabelText("Type DELETE to confirm"),
    "DELETE",
  );
  await userEvent.type(
    screen.getByLabelText("Confirm your password"),
    "password123",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Permanently delete my account" }),
  );
  expect(await screen.findByText("Storage offline")).toBeVisible();
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("surfaces sign-out failures", async () => {
  mock.signOut.mockResolvedValue({ error: { message: "Sign-out failed" } });
  page();
  await userEvent.click(
    await screen.findByRole("button", { name: "Sign out everywhere" }),
  );
  expect(await screen.findByText("Sign-out failed")).toBeVisible();
});
it("changes email only after verifying the current password", async () => {
  page();
  const input = await screen.findByLabelText("New email");
  await userEvent.clear(input);
  await userEvent.type(input, "new@example.com");
  const form = input.closest("form")!;
  await userEvent.type(
    within(form).getByLabelText("Current password"),
    "password123",
  );
  await userEvent.click(
    within(form).getByRole("button", { name: "Update email" }),
  );
  expect(mock.updateUser).toHaveBeenCalledWith(
    { email: "new@example.com" },
    { emailRedirectTo: expect.stringContaining("/settings") },
  );
  expect(await screen.findByText(/Check your inboxes/)).toBeVisible();
});
it("requires matching password-reset entries", async () => {
  page(<ResetPassword />);
  await userEvent.type(
    await screen.findByLabelText("New password"),
    "new-passphrase",
  );
  await userEvent.type(
    screen.getByLabelText("Confirm new password"),
    "different-passphrase",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Update password" }),
  );
  expect(screen.getByText("The passwords do not match.")).toBeVisible();
  expect(mock.updateUser).not.toHaveBeenCalled();
});
it("updates a recovered password and ends sessions", async () => {
  page(<ResetPassword />);
  await userEvent.type(
    await screen.findByLabelText("New password"),
    "new-passphrase",
  );
  await userEvent.type(
    screen.getByLabelText("Confirm new password"),
    "new-passphrase",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Update password" }),
  );
  expect(mock.updateUser).toHaveBeenCalledWith({ password: "new-passphrase" });
  expect(mock.signOut).toHaveBeenCalled();
  expect(
    await screen.findByText(
      "Password updated. Sign in with your new password.",
    ),
  ).toBeVisible();
});
