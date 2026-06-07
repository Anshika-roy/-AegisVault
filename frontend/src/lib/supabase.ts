import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    'Warning: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not defined in your environment variables. ' +
    'The app will fall back to placeholders, but connection to Supabase services will fail until configured.'
  )
}

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder-project.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-anon-key',
 {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
