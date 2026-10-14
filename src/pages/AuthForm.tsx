import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Leaf, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabase";
import { friendlyError } from "../lib/profile";
import { useAuth } from "../auth/AuthProvider";
import ScenicPhoto from "../components/ScenicPhoto";

type Mode = "signIn" | "signUp" | "reset";
export default function AuthForm() {
  const { error: configurationError } = useAuth();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const location = useLocation();
  const [message, setMessage] = useState(
    location.state?.accountDeleted
      ? "Your account and stored photos have been deleted."
      : "",
  );
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  function changeMode(next: Mode) {
    setMode(next);
    setMessage("");
    setPassword("");
  }
  async function submit(resend = false) {
    if (!supabase || busy) return;
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const credentials = { email: email.trim(), password };
      const redirect = new URL("/profile", window.location.origin).href;
      const result = resend
        ? await supabase.auth.resend({
            type: "signup",
            email: credentials.email,
            options: { emailRedirectTo: redirect },
          })
        : mode === "reset"
          ? await supabase.auth.resetPasswordForEmail(credentials.email, {
              redirectTo: new URL("/reset-password", window.location.origin)
                .href,
            })
          : mode === "signUp"
            ? await supabase.auth.signUp({
                ...credentials,
                options: { emailRedirectTo: redirect },
              })
            : await supabase.auth.signInWithPassword(credentials);
      if (result.error) throw result.error;
      if (!alive.current) return;
      setPassword("");
      setMessage(
        resend
          ? "If this account needs verification, a new confirmation link is on its way."
          : mode === "reset"
            ? "If an account exists for this email, you’ll receive a password reset link."
            : mode === "signUp"
              ? "Check your email to confirm registration, then return to sign in."
              : "Signed in.",
      );
    } catch (error) {
      if (alive.current) {
        setFailed(true);
        setMessage(friendlyError(error));
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section className="auth-layout">
      <div className="auth-art">
        <ScenicPhoto
          eager
          alt="A quiet forest road in Rocky Mountain National Park"
        />
        <div>
          <Leaf size={30} />
          <h2>
            Your next chapter
            <br />
            starts with a road.
          </h2>
          <p>A place for the curious. A pace that feels like you.</p>
        </div>
      </div>
      <div className="auth-content">
        <span className="eyebrow">YOUR ADVENTURE, YOUR PACE</span>
        <h1>
          {mode === "reset"
            ? "Find your way back."
            : mode === "signUp"
              ? "A fresh beginning."
              : "Welcome to Thrive."}
        </h1>
        <p>
          {mode === "reset"
            ? "We’ll email you a secure link to reset your password."
            : "Make a little space for discovery."}
        </p>
        {mode !== "reset" && (
          <div className="segmented" role="group" aria-label="Account access">
            <button
              type="button"
              aria-pressed={mode === "signIn"}
              onClick={() => changeMode("signIn")}
              disabled={busy}
            >
              Sign in
            </button>
            <button
              type="button"
              aria-pressed={mode === "signUp"}
              onClick={() => changeMode("signUp")}
              disabled={busy}
            >
              Create account
            </button>
          </div>
        )}
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label>
            Email
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </label>
          {mode !== "reset" && (
            <label>
              Password
              <input
                required
                minLength={mode === "signUp" ? 8 : undefined}
                type="password"
                autoComplete={
                  mode === "signUp" ? "new-password" : "current-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
              {mode === "signUp" && (
                <small>
                  Use at least 8 characters. A unique passphrase is a good
                  start.
                </small>
              )}
            </label>
          )}
          {mode === "signIn" && (
            <button
              type="button"
              className="text-button align-end"
              onClick={() => changeMode("reset")}
            >
              Forgot password?
            </button>
          )}
          <button className="primary" disabled={busy || !supabase}>
            {busy
              ? "Please wait…"
              : mode === "reset"
                ? "Send reset link"
                : mode === "signUp"
                  ? "Create my account"
                  : "Sign in to Thrive"}
            <ArrowRight size={18} />
          </button>
          {mode === "reset" && (
            <button
              type="button"
              className="text-button"
              onClick={() => changeMode("signIn")}
            >
              Back to sign in
            </button>
          )}
          {mode === "signUp" && message && !failed && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit(true)}
            >
              Resend verification email
            </button>
          )}
        </form>
        {(message || configurationError) && (
          <p
            className={failed || configurationError ? "notice error" : "notice"}
            role={failed ? "alert" : "status"}
          >
            {message || configurationError}
          </p>
        )}
        <p className="fine-print">
          <ShieldCheck size={16} /> Your profile starts private. You choose what
          to share.
        </p>
        <Link className="subtle-link" to="/explore">
          Just looking? Explore the planner
        </Link>
      </div>
    </section>
  );
}
