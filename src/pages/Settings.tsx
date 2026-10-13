import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LockKeyhole,
  Mail,
  LogOut,
  ShieldCheck,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import { deleteAccountImages } from "../lib/media";
import {
  DEFAULT_PREFERENCES,
  DRIVE_STYLES,
  friendlyError,
  MEDIA_BUCKET,
  type DrivePreferences,
} from "../lib/profile";
import { useProfile } from "../lib/useProfile";
import AuthForm from "./AuthForm";

function AccountSettings({ session }: { session: Session }) {
  const {
    profile,
    setProfile,
    error: profileError,
    retry,
  } = useProfile(session.user.id);
  const [email, setEmail] = useState(session.user.email ?? "");
  const [passwords, setPasswords] = useState({
    email: "",
    password: "",
    deletion: "",
  });
  const navigate = useNavigate();
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [preferences, setPreferences] =
    useState<DrivePreferences>(DEFAULT_PREFERENCES);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [preferencesError, setPreferencesError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setPreferencesLoaded(false);
    setPreferencesError("");
    if (!supabase) return;
    void supabase
      .from("drive_preferences")
      .select(
        "preferred_style,avoid_highways,avoid_traffic,avoid_complex_intersections",
      )
      .eq("user_id", session.user.id)
      .single()
      .then(
        ({ data, error }) => {
          if (!active) return;
          if (error) setPreferencesError(friendlyError(error));
          else {
            setPreferences(data as DrivePreferences);
            setPreferencesLoaded(true);
          }
        },
        (error) => {
          if (active) setPreferencesError(friendlyError(error));
        },
      );
    return () => {
      active = false;
    };
  }, [session.user.id, reload]);
  async function run(name: string, action: () => Promise<string>) {
    if (busy || !supabase) return;
    setBusy(name);
    setMessage("");
    setFailed(false);
    try {
      setMessage(await action());
    } catch (error) {
      setFailed(true);
      setMessage(friendlyError(error));
    } finally {
      setBusy("");
      setPasswords({ email: "", password: "", deletion: "" });
    }
  }
  async function reauthenticate(password: string) {
    if (!supabase || !session.user.email)
      throw new Error("Please sign in again.");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password,
    });
    if (error) throw error;
    if (!active.current || data.user?.id !== session.user.id)
      throw new Error("Your session changed. Reload before continuing.");
  }
  async function removePhoto(field: "avatar_path" | "banner_path") {
    if (!supabase || !profile) throw new Error("Load your profile first.");
    const path = profile[field];
    const { data, error } = await supabase
      .from("profiles")
      .update(
        field === "avatar_path" ? { avatar_path: null } : { banner_path: null },
      )
      .eq("id", session.user.id)
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("Photo could not be removed.");
    setProfile({ ...profile, [field]: null });
    if (path) {
      const { error } = await supabase.storage
        .from(MEDIA_BUCKET)
        .remove([path]);
      if (error)
        throw new Error(
          "Photo removed from your profile, but file cleanup failed. Try “Clear stored photos” below.",
        );
    }
    return "Photo removed.";
  }
  return (
    <section className="stack settings-page">
      <Link className="back-link" to="/profile">
        <ArrowLeft size={17} /> Back to profile
      </Link>
      <div>
        <span className="eyebrow">MAKE YOURSELF AT HOME</span>
        <h1>Account settings.</h1>
        <p>Your details. Your privacy. Your pace.</p>
      </div>
      {message && (
        <p
          className={failed ? "notice error" : "notice"}
          role={failed ? "alert" : "status"}
        >
          {message}
        </p>
      )}
      <div className="settings-grid">
        <div className="stack">
          <section className="panel stack">
            <div className="section-heading">
              <h2>
                <Mail size={20} /> Email & verification
              </h2>
              <span className="badge">
                {session.user.email_confirmed_at ? "Verified" : "Not verified"}
              </span>
            </div>
            <p className="account-email">{session.user.email}</p>
            {!session.user.email_confirmed_at && (
              <button
                disabled={!!busy}
                onClick={() =>
                  void run("verify", async () => {
                    const { error } = await supabase!.auth.resend({
                      type: "signup",
                      email: session.user.email!,
                      options: {
                        emailRedirectTo: new URL(
                          "/profile",
                          window.location.origin,
                        ).href,
                      },
                    });
                    if (error) throw error;
                    return "Verification email sent. Check your inbox.";
                  })
                }
              >
                Resend verification email
              </button>
            )}
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                void run("email", async () => {
                  await reauthenticate(passwords.email);
                  const { error } = await supabase!.auth.updateUser(
                    { email: email.trim() },
                    {
                      emailRedirectTo: new URL(
                        "/settings",
                        window.location.origin,
                      ).href,
                    },
                  );
                  if (error) throw error;
                  return "Check your inboxes to confirm the email change. Your current email stays in use until confirmation.";
                });
              }}
            >
              <label>
                New email
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Current password
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  value={passwords.email}
                  onChange={(e) =>
                    setPasswords({ ...passwords, email: e.target.value })
                  }
                />
              </label>
              <button disabled={!!busy || email.trim() === session.user.email}>
                Update email
              </button>
            </form>
          </section>
          <section className="panel stack">
            <h2>
              <LockKeyhole size={20} /> Password & sessions
            </h2>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                void run("password", async () => {
                  await reauthenticate(passwords.password);
                  const { error } = await supabase!.auth.updateUser({
                    password: newPassword,
                  });
                  if (error) throw error;
                  setNewPassword("");
                  const result = await supabase!.auth.signOut({
                    scope: "others",
                  });
                  if (result.error)
                    return "Password changed, but other sessions could not be ended. Try signing out everywhere.";
                  return "Password updated. Other sessions have been signed out.";
                });
              }}
            >
              <label>
                Current password
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  value={passwords.password}
                  onChange={(e) =>
                    setPasswords({ ...passwords, password: e.target.value })
                  }
                />
              </label>
              <label>
                New password
                <input
                  required
                  minLength={8}
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <small>At least 8 characters.</small>
              </label>
              <button disabled={!!busy}>Change password</button>
            </form>
            <button
              disabled={!!busy}
              onClick={() =>
                void run("signout", async () => {
                  const { error } = await supabase!.auth.signOut();
                  if (error) throw error;
                  return "Signed out.";
                })
              }
            >
              <LogOut size={17} /> Sign out everywhere
            </button>
          </section>
          <section className="panel stack">
            <h2>Start every drive your way</h2>
            <p>
              Saved defaults are used when you open the planner. They don’t
              generate a route.
            </p>
            {preferencesError && (
              <>
                <p role="alert">{preferencesError}</p>
                <button onClick={() => setReload((r) => r + 1)}>
                  Retry preferences
                </button>
              </>
            )}
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                void run("preferences", async () => {
                  const { data, error } = await supabase!
                    .from("drive_preferences")
                    .update(preferences)
                    .eq("user_id", session.user.id)
                    .select("user_id")
                    .single();
                  if (error || !data)
                    throw error ?? new Error("Preferences were not saved.");
                  return "Drive preferences saved.";
                });
              }}
            >
              <label>
                Preferred drive style
                <select
                  disabled={!preferencesLoaded || !!busy}
                  value={preferences.preferred_style}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      preferred_style: e.target.value,
                    })
                  }
                >
                  {DRIVE_STYLES.map((style) => (
                    <option key={style}>{style}</option>
                  ))}
                </select>
              </label>
              {(
                [
                  ["avoid_highways", "Avoid highways"],
                  ["avoid_traffic", "Avoid heavy traffic"],
                  [
                    "avoid_complex_intersections",
                    "Avoid complex intersections",
                  ],
                ] as const
              ).map(([key, label]) => (
                <label className="check" key={key}>
                  <input
                    disabled={!preferencesLoaded || !!busy}
                    type="checkbox"
                    checked={preferences[key]}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        [key]: e.target.checked,
                      })
                    }
                  />
                  {label}
                </label>
              ))}
              <button disabled={!preferencesLoaded || !!busy}>
                Save drive preferences
              </button>
            </form>
          </section>
        </div>
        <div className="stack">
          <section className="panel stack">
            <h2>
              <ShieldCheck size={20} /> Privacy, by choice
            </h2>
            <p>
              Your email and saved drive preferences are only visible to you.
              Thrive does not record your location in this release.
            </p>
            {profileError && (
              <>
                <p role="alert">{profileError}</p>
                <button onClick={retry}>Retry profile</button>
              </>
            )}
            <label>
              Who can see your profile?
              <select
                disabled={!profile || !!busy}
                value={profile?.visibility ?? "private"}
                onChange={(e) => {
                  const visibility = e.target.value as "private" | "public";
                  void run("privacy", async () => {
                    const { data, error } = await supabase!
                      .from("profiles")
                      .update({ visibility })
                      .eq("id", session.user.id)
                      .select("id")
                      .single();
                    if (error || !data)
                      throw (
                        error ?? new Error("Privacy setting was not saved.")
                      );
                    setProfile((current) =>
                      current ? { ...current, visibility } : current,
                    );
                    return "Privacy setting saved.";
                  });
                }}
              >
                <option value="private">Only me</option>
                <option value="public">Anyone with my profile link</option>
              </select>
            </label>
            <small>
              Public profiles share your display name, username, bio, interests
              and images. Copies already downloaded by others cannot be
              recalled.
            </small>
          </section>
          <section className="panel stack">
            <h2>Your photos</h2>
            <p>
              You’re in control of your avatar and cover. Upload replacements
              from Edit profile.
            </p>
            <button
              disabled={!!busy || !profile?.avatar_path}
              onClick={() =>
                void run("avatar", () => removePhoto("avatar_path"))
              }
            >
              Remove profile picture
            </button>
            <button
              disabled={!!busy || !profile?.banner_path}
              onClick={() =>
                void run("banner", () => removePhoto("banner_path"))
              }
            >
              Remove cover photo
            </button>
            <button
              disabled={!!busy || !profile}
              onClick={() =>
                void run("photos", async () => {
                  const { data, error } = await supabase!
                    .from("profiles")
                    .update({ avatar_path: null, banner_path: null })
                    .eq("id", session.user.id)
                    .select("id")
                    .single();
                  if (error || !data)
                    throw error ?? new Error("Photos could not be cleared.");
                  setProfile((current) =>
                    current
                      ? { ...current, avatar_path: null, banner_path: null }
                      : current,
                  );
                  await deleteAccountImages(session.user.id);
                  return "All stored profile photos removed.";
                })
              }
            >
              Clear stored photos
            </button>
          </section>
          <section className="panel stack danger-zone">
            <h2>
              <Trash2 size={20} /> Delete account
            </h2>
            <p>
              Permanently delete your account, profile, preferences and uploaded
              photos. This cannot be undone.
            </p>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                if (confirmation !== "DELETE") return;
                void run("delete", async () => {
                  await reauthenticate(passwords.deletion);
                  await deleteAccountImages(session.user.id);
                  const { error } = await supabase!.rpc("delete_my_account");
                  if (error)
                    throw new Error(
                      `${friendlyError(error)} Your account was not deleted; some photos may already have been removed.`,
                    );
                  await supabase!.auth.signOut({ scope: "local" });
                  navigate("/profile", {
                    replace: true,
                    state: { accountDeleted: true },
                  });
                  return "Your account has been deleted.";
                });
              }}
            >
              <label>
                Confirm your password
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  value={passwords.deletion}
                  onChange={(e) =>
                    setPasswords({ ...passwords, deletion: e.target.value })
                  }
                />
              </label>
              <label>
                Type DELETE to confirm
                <input
                  required
                  value={confirmation}
                  autoComplete="off"
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </label>
              <button
                className="danger"
                disabled={!!busy || confirmation !== "DELETE"}
              >
                {busy === "delete"
                  ? "Deleting…"
                  : "Permanently delete my account"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </section>
  );
}
export default function Settings() {
  const { session, loading } = useAuth();
  return loading ? (
    <p role="status">Loading account…</p>
  ) : session ? (
    <AccountSettings key={session.user.id} session={session} />
  ) : (
    <AuthForm />
  );
}
