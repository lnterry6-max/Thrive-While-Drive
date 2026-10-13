import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

// Misconfiguration must not prevent the planner and other public pages from loading.
function configureClient() {
  if (!url || !publishableKey) return {
    client: null,
    error: "Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local to sign in.",
  };
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol) || !publishableKey.startsWith('sb_publishable_')) {
      throw new Error('Invalid public configuration');
    }
    return { client: createClient(url, publishableKey), error: "" };
  } catch {
    return { client: null, error: "Invalid Supabase configuration. Use the project URL and an sb_publishable_ key in .env.local." };
  }
}

/** Browser-safe client. All user data access is governed by Supabase RLS. */
const configuration = configureClient();
export const supabase = configuration.client;
export const supabaseConfigurationError = configuration.error;
