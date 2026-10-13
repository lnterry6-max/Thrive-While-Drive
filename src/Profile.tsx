import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigurationError } from "./lib/supabase";

const tags = ["New Driver", "Learning Driver", "Experienced Driver", "Driving Enthusiast", "Scenic Explorer", "City Explorer", "Weekend Cruiser", "Road Tripper"];
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Unable to connect. Please try again.";

export default function Profile() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(Boolean(supabase));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(supabaseConfigurationError);
  const [selected, setSelected] = useState<string[]>([]);
  const [loadedUser, setLoadedUser] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const identity = useRef<string | null>(null);
  const generation = useRef(0);
  const userId = session?.user.id;

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let authEventReceived = false;
    function receiveSession(next: Session | null) {
      if (!active) return;
      if (identity.current !== (next?.user.id ?? null)) {
        generation.current++;
        identity.current = next?.user.id ?? null;
        setSelected([]);
        setLoadedUser(null);
        setMessage("");
        setBusy(false);
        setPassword("");
      }
      setSession(next);
      setInitializing(false);
    }
    // Keep this callback synchronous: profile queries run in a separate effect.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      authEventReceived = true;
      receiveSession(next);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || authEventReceived) return;
      receiveSession(data.session);
      if (error) setMessage(error.message);
    }).catch(error => {
      if (!active || authEventReceived) return;
      setInitializing(false);
      setMessage(errorMessage(error));
    });
    return () => {
      active = false;
      generation.current++;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !userId) return;
    let active = true;
    const revision = generation.current;
    async function loadProfile() {
      try {
        const { data, error } = await supabase!.from("profiles").select("tags").eq("id", userId!).single();
        if (!active || generation.current !== revision) return;
        if (error) throw new Error(error.message);
        if (!data || !Array.isArray(data.tags)) throw new Error("Profile unavailable. Please reload or contact support.");
        setSelected(data.tags);
        setLoadedUser(userId!);
      } catch (error) {
        if (active && generation.current === revision) setMessage(errorMessage(error));
      }
    }
    void loadProfile();
    return () => { active = false; };
  }, [userId]);

  async function auth(mode: "signIn" | "signUp") {
    if (!supabase || busy) return;
    setBusy(true);
    setMessage("");
    const revision = generation.current;
    try {
      const credentials = { email: email.trim(), password };
      const { data, error } = mode === "signUp"
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);
      if (generation.current !== revision) return;
      if (error) throw new Error(error.message);
      setPassword("");
      setMessage(mode === "signUp" && !data.session ? "Check your email to confirm registration." : "Signed in.");
    } catch (error) {
      if (generation.current === revision) setMessage(errorMessage(error));
    } finally {
      if (generation.current === revision) setBusy(false);
    }
  }

  async function saveTags() {
    if (!supabase || !userId || loadedUser !== userId || busy) return;
    const revision = generation.current;
    setBusy(true);
    setMessage("");
    try {
      // Returning one row detects missing profiles/RLS-denied writes instead of claiming success.
      const { data, error } = await supabase.from("profiles")
        .update({ tags: selected, updated_at: new Date().toISOString() })
        .eq("id", userId).select("id").single();
      if (generation.current !== revision) return;
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Profile was not saved. Please reload and try again.");
      setMessage("Profile tags saved.");
    } catch (error) {
      if (generation.current === revision) setMessage(errorMessage(error));
    } finally {
      if (generation.current === revision) setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase || busy) return;
    const revision = generation.current;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(error.message);
    } catch (error) {
      if (generation.current === revision) setMessage(errorMessage(error));
    } finally {
      if (generation.current === revision) setBusy(false);
    }
  }

  return <section className="stack"><span className="eyebrow">YOUR PROFILE</span><h1>Make it yours.</h1>
    {initializing ? <p role="status">Loading session…</p> : !session ? <form className="panel stack" onSubmit={event => { event.preventDefault(); void auth("signIn"); }}>
      <h2>Create an account or sign in</h2>
      <label>Email<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}/></label>
      <label>Password<input required minLength={6} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}/></label>
      <div className="actions"><button type="button" className="primary" disabled={busy || !supabase} onClick={e => { if (e.currentTarget.form?.reportValidity()) void auth("signUp"); }}>Create account</button><button type="submit" disabled={busy || !supabase}>Sign in</button></div>
    </form> : <div className="panel stack"><h2>{session.user.email}</h2><p>Select tags that describe you. They'll appear on your profile.</p>
      <div className="tag-grid">{tags.map(tag => <button disabled={busy || loadedUser !== userId} aria-pressed={selected.includes(tag)} className={selected.includes(tag) ? "tag selected" : "tag"} key={tag} onClick={() => setSelected(current => current.includes(tag) ? current.filter(x => x !== tag) : current.length < 5 ? [...current, tag] : current)}>{tag}</button>)}</div>
      <button className="primary" disabled={busy || loadedUser !== userId} onClick={() => void saveTags()}>Save tags</button><button disabled={busy} onClick={() => void signOut()}>Sign out</button>
    </div>}{message && <p role="status">{message}</p>}
  </section>;
}
