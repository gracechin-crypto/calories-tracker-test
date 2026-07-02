import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Service-role client for the public share route. Bypasses RLS, so every
// caller MUST validate access explicitly (token valid, not revoked, not
// expired) before querying user data. Never import from client code —
// the 'server-only' marker makes that a build error.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
