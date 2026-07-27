import { createClient } from "@supabase/supabase-js";

// ============================================================================
//  Supabase client — credentials come ONLY from environment variables.
//    NEXT_PUBLIC_SUPABASE_URL
//    NEXT_PUBLIC_SUPABASE_ANON_KEY
//  Set these in .env.local for local dev, and in Vercel → Project Settings →
//  Environment Variables for production. If they are absent, the app falls
//  back to Demo mode (localStorage data).
// ============================================================================

const ENV_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ENV_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export function isConfigured() {
  return Boolean(ENV_URL && ENV_KEY);
}

export function storeMode() {
  return isConfigured() ? "supabase" : "demo";
}

let _client = null;
export function getSupabase() {
  if (!isConfigured()) return null;
  if (!_client) _client = createClient(ENV_URL, ENV_KEY);
  return _client;
}
