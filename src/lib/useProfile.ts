import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { friendlyError, PROFILE_FIELDS, type ProfileRecord } from "./profile";
export function useProfile(userId: string) {
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((r) => r + 1), []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    if (!supabase) {
      setLoading(false);
      return;
    }
    void supabase
      .from("profiles")
      .select(PROFILE_FIELDS)
      .eq("id", userId)
      .single()
      .then(
        ({ data, error }) => {
          if (!active) return;
          if (error) {
            setError(friendlyError(error));
            setProfile(null);
          } else setProfile(data as ProfileRecord);
          setLoading(false);
        },
        (error) => {
          if (active) {
            setError(friendlyError(error));
            setLoading(false);
          }
        },
      );
    return () => {
      active = false;
    };
  }, [userId, revision]);
  return { profile, setProfile, loading, error, retry };
}
