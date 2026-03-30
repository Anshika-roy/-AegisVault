import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Set these from index.html before app load, or replace with your real values.
const SUPABASE_URL = window.__SUPABASE_URL__ || "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__ || "YOUR_SUPABASE_ANON_KEY";
const SUPABASE_BUCKET = window.__SUPABASE_BUCKET__ || "evidence";

export const isSupabaseConfigured =
  !SUPABASE_URL.includes("YOUR_SUPABASE") &&
  !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE") &&
  SUPABASE_URL.trim() !== "" &&
  SUPABASE_ANON_KEY.trim() !== "";

export const supabaseBucket = SUPABASE_BUCKET;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
