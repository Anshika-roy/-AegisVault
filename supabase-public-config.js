import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const runtimeSupabaseConfig = globalThis.__SUPABASE_CONFIG__ || {};

const SUPABASE_URL = runtimeSupabaseConfig.url || globalThis.__SUPABASE_URL__ || "";
const SUPABASE_ANON_KEY = runtimeSupabaseConfig.anonKey || globalThis.__SUPABASE_ANON_KEY__ || "";
const SUPABASE_BUCKET = runtimeSupabaseConfig.bucket || globalThis.__SUPABASE_BUCKET__ || "evidence";

export const isSupabaseConfigured =
  !SUPABASE_URL.includes("YOUR_SUPABASE") &&
  !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE") &&
  SUPABASE_URL.trim() !== "" &&
  SUPABASE_ANON_KEY.trim() !== "";

export const supabaseBucket = SUPABASE_BUCKET;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
