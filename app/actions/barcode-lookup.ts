'use server'

import { createClient } from '@/lib/supabase/server'

export type BarcodeProduct = {
  barcode: string
  name: string
  calories_per_serving: number
  protein_per_serving: number
  carbs_per_serving: number
  fat_per_serving: number
  serving_description: string
}

export type BarcodeLookupResult =
  | { ok: true; product: BarcodeProduct }
  | { ok: false; error: string }

export async function lookupBarcode(barcode: string): Promise<BarcodeLookupResult> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
      { next: { revalidate: 3600 } },
    )
    if (!res.ok) return { ok: false, error: 'Could not reach Open Food Facts. Check your connection.' }

    const json = await res.json() as {
      status: number
      product?: {
        product_name?: string
        serving_size?: string
        serving_quantity?: number
        nutriments?: Record<string, number>
      }
    }

    if (json.status !== 1 || !json.product) {
      return { ok: false, error: 'Barcode not found. Try typing the item instead.' }
    }

    const p = json.product
    const n = p.nutriments ?? {}

    const name = p.product_name?.trim() || `Product ${barcode}`

    // Prefer per-serving values; fall back to per-100g
    const cal  = n['energy-kcal_serving']  ?? n['energy-kcal_100g']  ?? 0
    const prot = n['proteins_serving']      ?? n['proteins_100g']      ?? 0
    const carb = n['carbohydrates_serving'] ?? n['carbohydrates_100g'] ?? 0
    const fat  = n['fat_serving']           ?? n['fat_100g']           ?? 0

    const serving_description = p.serving_size?.trim() || '1 serving'

    return {
      ok: true,
      product: {
        barcode,
        name,
        calories_per_serving: Math.round(cal),
        protein_per_serving:  Math.round(prot * 10) / 10,
        carbs_per_serving:    Math.round(carb * 10) / 10,
        fat_per_serving:      Math.round(fat  * 10) / 10,
        serving_description,
      },
    }
  } catch (err) {
    console.error('[lookupBarcode]', err)
    return { ok: false, error: 'Failed to look up barcode. Please try again.' }
  }
}

export async function logBarcodeProduct(
  product: BarcodeProduct,
  quantity: number,
): Promise<{ ok: true; meal_id: string } | { ok: false; error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated' }

    const qty = Math.max(0.1, quantity)

    const { data: meal, error } = await supabase
      .from('meals')
      .insert({
        user_id: user.id,
        name: product.name,
        description: `[Barcode ${product.barcode}] ${product.name}`,
        calories:   Math.round(product.calories_per_serving * qty),
        protein_g:  Math.round(product.protein_per_serving  * qty * 10) / 10,
        carbs_g:    Math.round(product.carbs_per_serving    * qty * 10) / 10,
        fat_g:      Math.round(product.fat_per_serving      * qty * 10) / 10,
        source: 'barcode_scan',
      })
      .select('id')
      .single()

    if (error) return { ok: false, error: error.message }
    return { ok: true, meal_id: meal.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Something went wrong' }
  }
}
