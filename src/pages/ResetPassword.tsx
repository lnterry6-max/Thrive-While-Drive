import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import { friendlyError } from "../lib/profile";
export default function ResetPassword() {
  const { session, loading, finishRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function submit() {
    if (!supabase || !session || busy) return;
    if (password !== confirm) return setMessage("The passwords do not match.");
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirm("");
      setDone(true);
      finishRecovery();
      const { error: signOutError } = await supabase.auth.signOut();
      setMessage(
        signOutError
          ? "Password updated. Please sign out from account settings to end other sessions."
          : "Password updated. Sign in with your new password.",
      );
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="narrow stack">
      <span className="eyebrow">ACCOUNT SECURITY</span>
      <h1>
        A new password.
        <br />A fresh start.
      </h1>
      {loading ? (
        <p role="status">Checking your reset link…</p>
      ) : session && !done ? (
        <form
          className="panel stack"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label>
            New password
            <input
              required
              minLength={8}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            Confirm new password
            <input
              required
              minLength={8}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      ) : (
        !done && (
          <p>
            This reset link is missing or has expired. Request a new link from
            the sign-in page.
          </p>
        )
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <Link className="subtle-link" to="/profile">
        Return to your account
      </Link>
    </section>
  );
}
