'use server'

import { createClient } from '@/lib/supabase/server'

export type ShareLink = {
  id: string
  token: string
  created_at: string
  expires_at: string | null
  revoked: boolean
}

export type ShareLinkResult =
  | { ok: true; links: ShareLink[] }
  | { ok: false; error: string }

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

function generateToken(length = 24): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

export async function listShareLinks(): Promise<ShareLinkResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('share_links')
      .select('id, token, created_at, expires_at, revoked')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) return { ok: false, error: error.message }
    return { ok: true, links: data ?? [] }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Something went wrong' }
  }
}

export async function createShareLink(
  expiresInDays: number | null,
): Promise<{ ok: true; link: ShareLink } | { ok: false; error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated' }

    const expires_at = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null

    const { data, error } = await supabase
      .from('share_links')
      .insert({ user_id: user.id, token: generateToken(), expires_at })
      .select('id, token, created_at, expires_at, revoked')
      .single()

    if (error) return { ok: false, error: error.message }
    return { ok: true, link: data }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Something went wrong' }
  }
}

export async function revokeShareLink(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated' }

    const { error } = await supabase
      .from('share_links')
      .update({ revoked: true })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Something went wrong' }
  }
}
