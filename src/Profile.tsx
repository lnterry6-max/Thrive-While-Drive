import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Pencil, Settings2, Check, X, Camera } from "lucide-react";
import { useAuth } from "./auth/AuthProvider";
import { supabase } from "./lib/supabase";
import {
  INTERESTS,
  PROFILE_FIELDS,
  friendlyError,
  validateProfile,
  type ProfileRecord,
} from "./lib/profile";
import { uploadProfileImage, type ImageKind } from "./lib/media";
import { useProfile } from "./lib/useProfile";
import AuthForm from "./pages/AuthForm";
import ProfileView from "./components/ProfileView";

function ProfileEditor({
  profile,
  onSave,
  onCancel,
}: {
  profile: ProfileRecord;
  onSave: (value: ProfileRecord) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState({ ...profile });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function save() {
    if (!supabase || busy) return;
    const next = {
      ...draft,
      username: draft.username?.trim() || null,
      display_name: draft.display_name?.trim() || null,
      bio: draft.bio.trim(),
    };
    const validation = validateProfile(next);
    if (validation) return setMessage(validation);
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          username: next.username,
          display_name: next.display_name,
          bio: next.bio,
          tags: next.tags,
          visibility: next.visibility,
        })
        .eq("id", profile.id)
        .select(PROFILE_FIELDS)
        .single();
      if (error) throw error;
      if (!data) throw new Error("Profile was not saved. Please try again.");
      if (active.current) onSave(data as ProfileRecord);
    } catch (error) {
      if (active.current) setMessage(friendlyError(error));
    } finally {
      if (active.current) setBusy(false);
    }
  }
  return (
    <form
      className="panel stack profile-editor"
      aria-label="Edit profile"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="section-heading">
        <h2>Make it feel like you.</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Cancel editing"
          disabled={busy}
          onClick={onCancel}
        >
          <X size={20} />
        </button>
      </div>
      <div className="field-grid">
        <label>
          Display name
          <input
            value={draft.display_name ?? ""}
            maxLength={60}
            autoComplete="nickname"
            onChange={(e) =>
              setDraft({ ...draft, display_name: e.target.value })
            }
          />
        </label>
        <label>
          Username
          <input
            value={draft.username ?? ""}
            minLength={3}
            maxLength={24}
            pattern="[a-zA-Z0-9_]{3,24}"
            autoCapitalize="none"
            spellCheck={false}
            onChange={(e) => setDraft({ ...draft, username: e.target.value })}
          />
          <small>
            3–24 letters, numbers or underscores. Capitalization doesn’t create
            a different username.
          </small>
        </label>
      </div>
      <label>
        Biography
        <textarea
          rows={3}
          maxLength={280}
          value={draft.bio}
          onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
        />
        <small>
          {draft.bio.length}/280 · Please don’t include your home address or
          private location.
        </small>
      </label>
      <fieldset>
        <legend>
          Driving interests{" "}
          <span className="muted">{draft.tags.length}/5 selected</span>
        </legend>
        <div className="tag-grid">
          {INTERESTS.map((tag) => (
            <button
              type="button"
              className={draft.tags.includes(tag) ? "tag selected" : "tag"}
              aria-pressed={draft.tags.includes(tag)}
              key={tag}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  tags: current.tags.includes(tag)
                    ? current.tags.filter((value) => value !== tag)
                    : current.tags.length < 5
                      ? [...current.tags, tag]
                      : current.tags,
                }))
              }
            >
              {draft.tags.includes(tag) && <Check size={14} />} {tag}
            </button>
          ))}
        </div>
      </fieldset>
      <label>
        Profile visibility
        <select
          value={draft.visibility}
          onChange={(e) =>
            setDraft({
              ...draft,
              visibility: e.target.value as ProfileRecord["visibility"],
            })
          }
        >
          <option value="private">Private — only you</option>
          <option value="public">Public — anyone with your profile link</option>
        </select>
        <small>
          A public profile shares your name, username, bio, interests and
          images. Your email and drive preferences stay private.
        </small>
      </label>
      {message && (
        <p className="notice error" role="alert">
          {message}
        </p>
      )}
      <div className="actions">
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : "Save profile"}
        </button>
        <button type="button" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
export function OwnProfile({ userId }: { userId: string }) {
  const { profile, setProfile, loading, error, retry } = useProfile(userId);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function upload(kind: ImageKind, file?: File) {
    if (!profile || !file || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await uploadProfileImage(profile, kind, file);
      if (alive.current) {
        setProfile(result.profile);
        setMessage(result.warning || "Photo updated.");
      }
    } catch (error) {
      if (alive.current) setMessage(friendlyError(error));
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="panel" role="status">
        Loading your profile…
      </div>
    );
  if (error || !profile)
    return (
      <div className="panel stack">
        <h1>Your profile couldn’t load.</h1>
        <p role="alert">{error || "Please try again."}</p>
        <button onClick={retry}>Try again</button>
        <Link to="/settings">Account settings</Link>
      </div>
    );
  return (
    <>
      <ProfileView
        profile={profile}
        actions={
          <>
            <button onClick={() => setEditing(!editing)} disabled={busy}>
              <Pencil size={16} /> Edit profile
            </button>
            <Link
              className="button icon-button"
              to="/settings"
              aria-label="Account settings"
            >
              <Settings2 size={19} />
            </Link>
          </>
        }
      >
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
        {editing && (
          <>
            <div className="panel stack">
              <h2>A view that feels like you</h2>
              <p>
                JPEG, PNG or WebP · up to 5 MB. Location metadata is removed
                before upload.
              </p>
              <div className="field-grid">
                {(["avatar", "banner"] as const).map((kind) => (
                  <label className="upload-field" key={kind}>
                    <span>
                      <Camera size={18} />{" "}
                      {kind === "avatar" ? "Profile picture" : "Cover photo"}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        void upload(kind, file);
                      }}
                    />
                  </label>
                ))}
              </div>
              {busy && <p role="status">Preparing and uploading your photo…</p>}
            </div>
            <ProfileEditor
              profile={profile}
              onCancel={() => setEditing(false)}
              onSave={(next) => {
                setProfile(next);
                setEditing(false);
                setMessage("Profile saved.");
              }}
            />
          </>
        )}
      </ProfileView>
      {profile.visibility === "public" && profile.username && (
        <p className="share-profile">
          Your public profile:{" "}
          <Link to={`/people/${profile.username.toLowerCase()}`}>
            View @{profile.username}
          </Link>
        </p>
      )}
    </>
  );
}
export function PublicProfile() {
  const { username = "" } = useParams();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setProfile(null);
    setMessage("");
    if (!supabase || !/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      setLoading(false);
      return;
    }
    void supabase
      .from("profiles")
      .select(PROFILE_FIELDS)
      .ilike("username", username.replaceAll("_", "\\_"))
      .eq("visibility", "public")
      .maybeSingle()
      .then(
        ({ data, error }) => {
          if (active) {
            setProfile(data as ProfileRecord | null);
            setLoading(false);
            if (error)
              setMessage(
                "This profile could not be loaded. Please try again later.",
              );
          }
        },
        () => {
          if (active) {
            setLoading(false);
            setMessage(
              "This profile could not be loaded. Check your connection.",
            );
          }
        },
      );
    return () => {
      active = false;
    };
  }, [username]);
  return loading ? (
    <p role="status">Loading profile…</p>
  ) : profile ? (
    <ProfileView profile={profile} />
  ) : (
    <section className="panel stack">
      <h1>A little off the beaten path.</h1>
      <p>{message || "This profile is private or isn’t available."}</p>
      <Link className="primary button" to="/">
        Back to Thrive
      </Link>
    </section>
  );
}
export default function Profile() {
  const { session, loading, error } = useAuth();
  return loading ? (
    <p role="status">Loading session…</p>
  ) : session ? (
    <OwnProfile key={session.user.id} userId={session.user.id} />
  ) : (
    <>
      {error && !supabase && (
        <p className="notice" role="status">
          Account services are not configured in this preview.
        </p>
      )}
      <AuthForm />
    </>
  );
}
