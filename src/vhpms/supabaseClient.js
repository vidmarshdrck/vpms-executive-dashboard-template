import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL
const publishable = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
// One in-memory session shared by Live workspace and the BSG page (no persistence).
export const supabase = url && publishable ? createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false } }) : null
