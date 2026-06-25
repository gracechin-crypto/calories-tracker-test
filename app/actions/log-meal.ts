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
  source: 'local_db' | 'ai_estimate'
  meal_id: string
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

export async function logMeal(description: string): Promise<LogMealResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const cleaned = extractDishKeywords(description)
  console.log(`[logMeal] raw="${description}" cleaned="${cleaned}"`)

  // Step 1: try phrase match on the cleaned string
  let matchedItem: Record<string, unknown> | null = null

  if (cleaned) {
    const { data: phraseMatches } = await supabase
      .from('food_items')
      .select('*')
      .ilike('name', `%${cleaned}%`)
      .limit(1)

    if (phraseMatches && phraseMatches.length > 0) {
      matchedItem = phraseMatches[0]
      console.log(`[logMeal] phrase match: found "${phraseMatches[0].name}"`)
    } else {
      console.log(`[logMeal] phrase match: no match for "${cleaned}"`)
    }
  }

  // Step 2: if no phrase match, try each keyword individually (≥3 chars)
  if (!matchedItem && cleaned) {
    const keywords = cleaned.split(' ').filter((w) => w.length >= 3)
    for (const keyword of keywords) {
      const { data: kwMatches } = await supabase
        .from('food_items')
        .select('*')
        .ilike('name', `%${keyword}%`)
        .limit(5)

      const names = kwMatches?.map((r) => (r as Record<string, unknown>).name) ?? []
      console.log(`[logMeal] keyword "${keyword}" → [${names.join(', ')}]`)

      if (kwMatches && kwMatches.length > 0) {
        matchedItem = kwMatches[0]
        console.log(`[logMeal] keyword match: picked "${kwMatches[0].name}"`)
        break
      }
    }
  }

  if (matchedItem) {
    console.log(`[logMeal] best match: "${(matchedItem as Record<string, unknown>).name}" (source=local_db)`)
  } else {
    console.log(`[logMeal] no DB match → AI fallback`)
  }

  let result: Omit<LogMealResult, 'meal_id'>

  if (matchedItem) {
    result = {
      name: matchedItem.name as string,
      calories: matchedItem.calories as number,
      protein_g: matchedItem.protein_g as number,
      carbs_g: matchedItem.carbs_g as number,
      fat_g: matchedItem.fat_g as number,
      serving_description: matchedItem.serving_description as string,
      source: 'local_db',
    }
  } else {
    // Fall back to Claude API
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
    result = {
      name: parsed.name ?? description,
      calories: Math.round(parsed.calories),
      protein_g: Math.round(parsed.protein_g * 10) / 10,
      carbs_g: Math.round(parsed.carbs_g * 10) / 10,
      fat_g: Math.round(parsed.fat_g * 10) / 10,
      serving_description: parsed.serving_description ?? '1 serving',
      source: 'ai_estimate',
    }
  }

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
