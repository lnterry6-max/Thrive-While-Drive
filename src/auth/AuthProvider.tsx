import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigurationError } from "../lib/supabase";
import { friendlyError } from "../lib/profile";

interface AuthState {
  session: Session | null;
  loading: boolean;
  error: string;
  recovery: boolean;
  finishRecovery: () => void;
}
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState(supabaseConfigurationError);
  const [recovery, setRecovery] = useState(false);
  const latestEvent = useRef(0);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const revision = latestEvent.current;
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      latestEvent.current++;
      setSession(next);
      setLoading(false);
      setError("");
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") setRecovery(false);
    });
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || latestEvent.current !== revision) return;
        setSession(data.session);
        setLoading(false);
        if (error) setError(error.message);
      })
      .catch((error) => {
        if (active && latestEvent.current === revision) {
          setError(friendlyError(error));
          setLoading(false);
        }
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        error,
        recovery,
        finishRecovery: () => setRecovery(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
