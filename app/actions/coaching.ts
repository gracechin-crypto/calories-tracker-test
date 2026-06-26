'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getDashboardData } from './dashboard'

export type CoachResult = { ok: true; content: string } | { ok: false; error: string }

// SGT = UTC+8, no DST.
function todaySGT(): string {
  const sgt = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const yyyy = sgt.getUTCFullYear()
  const mm   = String(sgt.getUTCMonth() + 1).padStart(2, '0')
  const dd   = String(sgt.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fmt(n: number) { return Math.round(n).toLocaleString() }

function historyLine(date: string, calories: number, protein_g: number, carbs_g: number, fat_g: number): string {
  const dow = DOW[new Date(date + 'T00:00:00').getDay()]
  const [, mm, dd] = date.split('-')
  if (calories === 0) return `${dow} ${dd}/${mm}: no data`
  return `${dow} ${dd}/${mm}: ${fmt(calories)} kcal | P ${fmt(protein_g)}g C ${fmt(carbs_g)}g F ${fmt(fat_g)}g`
}

export async function getOrGenerateCoachingNotes(forceRefresh = false): Promise<CoachResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authenticated' }

    const date = todaySGT()

    if (!forceRefresh) {
      const { data: existing } = await supabase
        .from('coaching_notes')
        .select('content')
        .eq('user_id', user.id)
        .eq('date', date)
        .maybeSingle()

      if (existing?.content) return { ok: true, content: existing.content }
    }

    const { goal, history } = await getDashboardData()

    const daysWithData = history.filter((d) => d.calories > 0).length
    if (daysWithData < 2) {
      return { ok: false, error: 'not_enough_data' }
    }

    const goalLine = goal
      ? `Daily goal: ${fmt(goal.calorie_target)} kcal | Protein ${fmt(goal.protein_target)}g | Carbs ${fmt(goal.carb_target)}g | Fat ${fmt(goal.fat_target)}g`
      : 'No daily goal set.'

    const historyLines = history
      .map((d) => historyLine(d.date, d.calories, d.protein_g, d.carbs_g, d.fat_g))
      .join('\n')

    const prompt = `${goalLine}

Last 7 days:
${historyLines}

Days tracked: ${daysWithData} of 7`

    const client = new Anthropic()
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: 'You are a warm, practical nutrition coach. Write 2-3 short bullet-point observations about a food tracker\'s recent eating patterns. Be specific, encouraging, and grounded — no medical advice. Use • as the bullet prefix. Each bullet is 1-2 sentences. Start with the most positive observation.',
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    if (!content) return { ok: false, error: 'Empty response from AI' }

    await supabase
      .from('coaching_notes')
      .upsert({ user_id: user.id, date, content }, { onConflict: 'user_id,date' })

    return { ok: true, content }
  } catch (err) {
    console.error('[getOrGenerateCoachingNotes]', err)
    return { ok: false, error: err instanceof Error ? err.message : 'Something went wrong' }
  }
}
