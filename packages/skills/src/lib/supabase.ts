import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger";

const log = logger.child("supabase");

let _client: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client.
 * Throws a clear error if env vars are missing.
 */
export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in your .env"
    );
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
  });

  log.info("Supabase client initialised", { url });
  return _client;
}

/**
 * Returns true if Supabase is configured in the environment.
 * Used to decide whether to attempt cache reads/writes.
 */
export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.SUPABASE_URL &&
    (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY)
  );
}
