'use server'

import { createClient } from '@/lib/supabase/server'

export type EditResult = { ok: true } | { ok: false; error: string }

export async function deleteMeal(id: string): Promise<EditResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated' }

    const { error } = await supabase
      .from('meals')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Something went wrong' }
  }
}

export async function updateMeal(
  id: string,
  calories: number,
  protein_g: number,
  carbs_g: number,
  fat_g: number,
): Promise<EditResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated' }

    const { error } = await supabase
      .from('meals')
      .update({ calories, protein_g, carbs_g, fat_g })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Something went wrong' }
  }
}
