'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import type { LogMealResult } from './log-meal'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type AllowedType = typeof ALLOWED_TYPES[number]

export async function logMealFromPhoto(formData: FormData): Promise<LogMealResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const file = formData.get('image')
  if (!(file instanceof File) || file.size === 0) throw new Error('No image provided')
  if (!ALLOWED_TYPES.includes(file.type as AllowedType)) {
    throw new Error('Unsupported image type. Please use JPEG, PNG, GIF, or WebP.')
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')

  const anthropic = new Anthropic()
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: file.type as AllowedType,
            data: base64,
          },
        },
        {
          type: 'text',
          text: 'Identify the food in this photo. Return JSON only, no markdown fences: {"dish_name": string|null, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "confidence": number, "serving_description": string, "notes": string}. confidence is 0-1. Estimate for one typical serving visible in the photo. If you cannot identify food with reasonable confidence, set confidence below 0.5 and dish_name to null.',
        },
      ],
    }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  let parsed: {
    dish_name: string | null
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
    confidence: number
    serving_description: string
    notes: string
  }
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Could not identify the food in this photo. Please try again or type it instead.')
  }

  if (!parsed.dish_name || parsed.confidence < 0.5) {
    throw new Error('Could not identify the food in this photo. Please try again or type it instead.')
  }

  // Try to match identified dish against food_items DB
  const dishName = parsed.dish_name
  const { data: dbMatches } = await supabase
    .from('food_items')
    .select('*')
    .ilike('name', `%${dishName}%`)
    .limit(1)

  let result: Omit<LogMealResult, 'meal_id'>

  if (dbMatches && dbMatches.length > 0) {
    const item = dbMatches[0]
    result = {
      name: item.name as string,
      calories: item.calories as number,
      protein_g: item.protein_g as number,
      carbs_g: item.carbs_g as number,
      fat_g: item.fat_g as number,
      serving_description: item.serving_description as string,
      source: 'local_db',
    }
  } else {
    result = {
      name: dishName,
      calories: Math.round(parsed.calories),
      protein_g: Math.round(parsed.protein_g * 10) / 10,
      carbs_g: Math.round(parsed.carbs_g * 10) / 10,
      fat_g: Math.round(parsed.fat_g * 10) / 10,
      serving_description: parsed.serving_description || '1 serving',
      source: 'ai_photo_estimate',
    }
  }

  const { data: meal, error } = await supabase
    .from('meals')
    .insert({
      user_id: user.id,
      name: result.name,
      description: `[Photo] ${dishName}`,
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
