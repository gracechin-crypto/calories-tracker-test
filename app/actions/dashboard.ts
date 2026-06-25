'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type DayStats = {
  date: string        // YYYY-MM-DD
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export type Goal = {
  calorie_target: number
  protein_target: number
  carb_target: number
  fat_target: number
}

export type DashboardData = {
  goal: Goal | null
  today: DayStats
  history: DayStats[]  // 7 days, oldest first, zeros for empty days
}

function toLocalDate(ts: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(ts))
}

function todayLocalDate(): string {
  return toLocalDate(new Date().toISOString())
}

function offsetDate(base: Date, days: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return toLocalDate(d.toISOString())
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const [{ data: goalRow }, { data: meals }] = await Promise.all([
    supabase.from('daily_goals').select('*').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('meals')
      .select('calories, protein_g, carbs_g, fat_g, logged_at')
      .eq('user_id', user.id)
      .gte('logged_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
  ])

  const goal: Goal | null = goalRow
    ? {
        calorie_target: goalRow.calorie_target,
        protein_target: Number(goalRow.protein_target),
        carb_target: Number(goalRow.carb_target),
        fat_target: Number(goalRow.fat_target),
      }
    : null

  // Aggregate meals by local calendar date
  const byDate: Record<string, DayStats> = {}
  for (const meal of meals ?? []) {
    const date = toLocalDate(meal.logged_at)
    if (!byDate[date]) byDate[date] = { date, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    byDate[date].calories  += meal.calories
    byDate[date].protein_g += Number(meal.protein_g)
    byDate[date].carbs_g   += Number(meal.carbs_g)
    byDate[date].fat_g     += Number(meal.fat_g)
  }

  // Build 7-day history (today is index 6)
  const now = new Date()
  const history: DayStats[] = Array.from({ length: 7 }, (_, i) => {
    const date = offsetDate(now, i - 6)
    return byDate[date] ?? { date, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  })

  const todayDate = todayLocalDate()
  const today = byDate[todayDate] ?? { date: todayDate, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }

  return { goal, today, history }
}

export async function saveGoal(
  calorie_target: number,
  protein_target: number,
  carb_target: number,
  fat_target: number,
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase.from('daily_goals').upsert(
    { user_id: user.id, calorie_target, protein_target, carb_target, fat_target },
    { onConflict: 'user_id' },
  )
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard')
}
