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

export async function logMeal(description: string): Promise<LogMealResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Try fuzzy match against food_items
  const { data: matches } = await supabase
    .from('food_items')
    .select('*')
    .ilike('name', `%${description}%`)
    .limit(1)

  let result: Omit<LogMealResult, 'meal_id'>

  if (matches && matches.length > 0) {
    const item = matches[0]
    result = {
      name: item.name,
      calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
      serving_description: item.serving_description,
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
