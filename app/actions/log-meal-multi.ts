'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveItem, type ItemBreakdown } from './log-meal'

export type MultiLogResult =
  | {
      ok: true
      meal_id: string
      items: ItemBreakdown[]
      total_calories: number
      total_protein_g: number
      total_carbs_g: number
      total_fat_g: number
    }
  | { ok: false; error: string }

export async function logMealMulti(formData: FormData): Promise<MultiLogResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated' }

    const nonEmpty = (formData.getAll('item') as string[]).map((d) => d.trim()).filter(Boolean)
    if (nonEmpty.length === 0) return { ok: false, error: 'Add at least one item' }

    const resolved = await Promise.all(nonEmpty.map((d) => resolveItem(d, supabase)))

    const items: ItemBreakdown[] = resolved.map((r, i) => ({ ...r, input: nonEmpty[i] }))

    const total_calories  = Math.round(items.reduce((s, i) => s + i.calories, 0))
    const total_protein_g = Math.round(items.reduce((s, i) => s + i.protein_g, 0) * 10) / 10
    const total_carbs_g   = Math.round(items.reduce((s, i) => s + i.carbs_g, 0) * 10) / 10
    const total_fat_g     = Math.round(items.reduce((s, i) => s + i.fat_g, 0) * 10) / 10

    const combinedDescription = items.map((i) => i.name).join(', ')
    const name = combinedDescription.length > 60
      ? combinedDescription.slice(0, 57) + '…'
      : combinedDescription

    const { data: meal, error } = await supabase
      .from('meals')
      .insert({
        user_id: user.id,
        name,
        description: combinedDescription,
        calories: total_calories,
        protein_g: total_protein_g,
        carbs_g: total_carbs_g,
        fat_g: total_fat_g,
        source: 'multi_item',
        breakdown: items,
      })
      .select('id')
      .single()

    if (error) return { ok: false, error: error.message }

    return { ok: true, meal_id: meal.id, items, total_calories, total_protein_g, total_carbs_g, total_fat_g }
  } catch (err) {
    console.error('[logMealMulti] error:', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Something went wrong. Please try again.' }
  }
}
