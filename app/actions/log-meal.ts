'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export type LogMealResult = {
  name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  serving_description: string
  source: 'local_db' | 'ai_estimate' | 'ai_photo_estimate'
  meal_id: string
}

export type ItemBreakdown = Omit<LogMealResult, 'meal_id'> & { input: string }

// Build the parenthetical suffix that identifies a variant entry in food_items.
// Compound conditions are checked before single-axis ones.
// A suffix that doesn't match any variant row safely falls through to phrase/keyword/AI.
function buildVariantSuffix(raw: string): string | null {
  const lower = raw.toLowerCase()

  // Chicken rice: preparation × rice type
  const isRoasted  = /roasted|roast/.test(lower)
  const isWhiteRice = /white rice|plain rice|steamed rice/.test(lower)
  const isLessOil  = /less oil|low oil|little oil|no oil/.test(lower)

  if (isRoasted && isWhiteRice) return 'roasted chicken, white rice'
  if (isRoasted)   return 'roasted chicken, oily rice'
  if (isWhiteRice) return 'white rice'
  if (isLessOil)   return 'less oil'

  // Fish soup: fish preparation × broth type
  const isFriedFish  = /fried fish|crispy fish/.test(lower)
  const isMilkyBroth = /milky broth|milk broth|creamy broth|milk soup|evaporated milk/.test(lower)

  if (isFriedFish && isMilkyBroth) return 'fried fish, milky broth'
  if (isFriedFish)   return 'fried fish, clear broth'
  if (isMilkyBroth)  return 'milky broth'

  // Laksa type
  if (/\basam\b/.test(lower)) return 'asam'

  // Noodle serving style — "dry" and "soup" are safe to try broadly:
  // if no matching variant exists the ilike miss falls through automatically.
  if (/\bdry\b/.test(lower)) return 'dry'
  if (/\bsoup\b/.test(lower) && /\b(mee|wonton|bak chor|mee pok)\b/.test(lower)) return 'soup'

  return null
}

// Strip quantity prefixes and filler words to extract the core dish name
function extractDishKeywords(raw: string): string {
  return raw
    .toLowerCase()
    // Remove leading quantity + unit + optional "of": "1 plate of", "2 bowls of", "100g of"
    .replace(/^\d+(\.\d+)?\s*(plates?|bowls?|cups?|pieces?|servings?|portions?|slices?|sticks?|rolls?|pcs?|g|kg|ml|l)\s+(of\s+)?/i, '')
    // Remove standalone filler words
    .replace(/\b(a|an|the|of|with|and|some|just|maybe|half|big|small|large|medium|hot|cold|iced|extra)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Resolves a single food description to nutrition data via DB match → AI fallback.
// Accepts a Supabase client so callers can share one client across multiple items.
export async function resolveItem(
  description: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Omit<LogMealResult, 'meal_id'>> {
  const cleaned = extractDishKeywords(description)
  const suffix = buildVariantSuffix(description)
  console.log(`[resolveItem] raw="${description}" cleaned="${cleaned}" modifier=${suffix ?? 'none'}`)

  let matchedItem: Record<string, unknown> | null = null

  // Step 0: variant match
  if (suffix && cleaned) {
    const variantName = `${cleaned} (${suffix})`
    const { data: variantMatches } = await supabase
      .from('food_items')
      .select('*')
      .ilike('name', `%${variantName}%`)
      .limit(1)

    if (variantMatches && variantMatches.length > 0) {
      matchedItem = variantMatches[0]
      console.log(`[resolveItem] variant: "${variantName}" → "${variantMatches[0].name}"`)
    } else {
      console.log(`[resolveItem] variant: "${variantName}" → no match`)
    }
  }

  // Step 1: phrase match
  if (!matchedItem && cleaned) {
    const { data: phraseMatches } = await supabase
      .from('food_items')
      .select('*')
      .ilike('name', `%${cleaned}%`)
      .limit(1)

    if (phraseMatches && phraseMatches.length > 0) {
      matchedItem = phraseMatches[0]
      console.log(`[resolveItem] phrase: found "${phraseMatches[0].name}"`)
    } else {
      console.log(`[resolveItem] phrase: no match for "${cleaned}"`)
    }
  }

  // Step 2: keyword-by-keyword
  if (!matchedItem && cleaned) {
    const keywords = cleaned.split(' ').filter((w) => w.length >= 3)
    for (const keyword of keywords) {
      const { data: kwMatches } = await supabase
        .from('food_items')
        .select('*')
        .ilike('name', `%${keyword}%`)
        .limit(5)

      const names = kwMatches?.map((r) => (r as Record<string, unknown>).name) ?? []
      console.log(`[resolveItem] keyword "${keyword}" → [${names.join(', ')}]`)

      if (kwMatches && kwMatches.length > 0) {
        matchedItem = kwMatches[0]
        console.log(`[resolveItem] keyword match: picked "${kwMatches[0].name}"`)
        break
      }
    }
  }

  if (matchedItem) {
    console.log(`[resolveItem] best match: "${(matchedItem as Record<string, unknown>).name}" (local_db)`)
    return {
      name: matchedItem.name as string,
      calories: matchedItem.calories as number,
      protein_g: matchedItem.protein_g as number,
      carbs_g: matchedItem.carbs_g as number,
      fat_g: matchedItem.fat_g as number,
      serving_description: matchedItem.serving_description as string,
      source: 'local_db',
    }
  }

  console.log(`[resolveItem] no DB match → AI fallback`)
  const client = new Anthropic()
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: 'You are a nutrition assistant. Return only valid JSON with no markdown.',
    messages: [
      {
        role: 'user',
        content: `Estimate the calories and macros for one typical serving of: "${description}".\n\nReturn JSON exactly like this:\n{"name":"<dish name>","calories":<number>,"protein_g":<number>,"carbs_g":<number>,"fat_g":<number>,"serving_description":"<e.g. 1 plate or 100g>"}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const parsed = JSON.parse(text)
  return {
    name: parsed.name ?? description,
    calories: Math.round(parsed.calories),
    protein_g: Math.round(parsed.protein_g * 10) / 10,
    carbs_g: Math.round(parsed.carbs_g * 10) / 10,
    fat_g: Math.round(parsed.fat_g * 10) / 10,
    serving_description: parsed.serving_description ?? '1 serving',
    source: 'ai_estimate',
  }
}

export async function logMeal(description: string): Promise<LogMealResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const result = await resolveItem(description, supabase)

  const { data: meal, error } = await supabase
    .from('meals')
    .insert({
      user_id: user.id,
      name: result.name,
      description,
      calories: result.calories,
      protein_g: result.protein_g,
      carbs_g: result.carbs_g,
      fat_g: result.fat_g,
      source: result.source,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  return { ...result, meal_id: meal.id }
}

export type TodayMeal = {
  id: string
  name: string | null
  description: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  source: string
  logged_at: string
}

export async function getTodayMeals(): Promise<TodayMeal[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('meals')
    .select('id, name, description, calories, protein_g, carbs_g, fat_g, source, logged_at')
    .eq('user_id', user.id)
    .gte('logged_at', todayStart.toISOString())
    .order('logged_at', { ascending: false })

  return data ?? []
}
