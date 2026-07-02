'use server'

import { createClient } from '@/lib/supabase/server'

export type Profile = {
  first_name: string | null
  avatar_url: string | null
}

export async function getProfile(): Promise<Profile> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { first_name: null, avatar_url: null }

  const { data } = await supabase
    .from('profiles')
    .select('first_name, avatar_url')
    .eq('user_id', user.id)
    .maybeSingle()

  return { first_name: data?.first_name ?? null, avatar_url: data?.avatar_url ?? null }
}

export async function saveProfile(
  first_name: string,
  avatar_url: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated' }

    const { error } = await supabase
      .from('profiles')
      .upsert(
        { user_id: user.id, first_name: first_name.trim() || null, avatar_url, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Something went wrong' }
  }
}
