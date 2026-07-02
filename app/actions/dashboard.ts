'use server'

import { revalidatePath, unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type DayStats = {
  date: string        // YYYY-MM-DD in SGT
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
  history: DayStats[]  // 7 days oldest-first, zeros for empty days
}

// SGT = UTC+8, no DST. Manual arithmetic avoids Intl.DateTimeFormat ICU issues.
function toSGTDate(msOrStr: number | string): string {
  const ms = typeof msOrStr === 'string' ? new Date(msOrStr).getTime() : msOrStr
  const sgt = new Date(ms + 8 * 60 * 60 * 1000)
  const yyyy = sgt.getUTCFullYear()
  const mm   = String(sgt.getUTCMonth() + 1).padStart(2, '0')
  const dd   = String(sgt.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Offset from now by N calendar days (in SGT).
function sgtDateOffset(nowMs: number, days: number): string {
  return toSGTDate(nowMs + days * 24 * 60 * 60 * 1000)
}

export async function getDashboardData(
  // Optional pre-authenticated client + user id let callers (e.g. the dashboard
  // page) share one auth round trip across several parallel queries.
  existingClient?: Awaited<ReturnType<typeof createClient>>,
  existingUserId?: string,
): Promise<DashboardData> {
  // Prevent Next.js 14 data cache from serving a stale empty result.
  noStore()

  const supabase = existingClient ?? await createClient()
  let userId = existingUserId
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    userId = user.id
  }

  const nowMs = Date.now()
  // 8-day rolling window (not 7) so timezone shifts never exclude day-0 meals.
  const queryStart = new Date(nowMs - 8 * 24 * 60 * 60 * 1000).toISOString()
  console.log(`[dashboard] querying meals from ${queryStart}`)

  const [{ data: goalRow }, { data: meals }] = await Promise.all([
    supabase.from('daily_goals').select('*').eq('user_id', userId).maybeSingle(),
    supabase
      .from('meals')
      .select('calories, protein_g, carbs_g, fat_g, logged_at')
      .eq('user_id', userId)
      .gte('logged_at', queryStart),
  ])

  console.log(`[dashboard] ${meals?.length ?? 0} meals fetched`)
  if (meals && meals.length > 0) {
    console.log(`[dashboard] sample logged_at: ${meals[0].logged_at}`)
  }

  const goal: Goal | null = goalRow
    ? {
        calorie_target: goalRow.calorie_target,
        protein_target: Number(goalRow.protein_target),
        carb_target: Number(goalRow.carb_target),
        fat_target: Number(goalRow.fat_target),
      }
    : null

  // Aggregate meals by SGT calendar date.
  const byDate: Record<string, DayStats> = {}
  for (const meal of meals ?? []) {
    const date = toSGTDate(meal.logged_at)
    if (!byDate[date]) byDate[date] = { date, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    byDate[date].calories  += meal.calories
    byDate[date].protein_g += Number(meal.protein_g)
    byDate[date].carbs_g   += Number(meal.carbs_g)
    byDate[date].fat_g     += Number(meal.fat_g)
  }

  const todaySGT = toSGTDate(nowMs)
  console.log(`[dashboard] today SGT: ${todaySGT}, byDate keys: [${Object.keys(byDate).join(', ')}]`)

  // Build 7-day history (today is index 6), using pure UTC+8 day offsets.
  const history: DayStats[] = Array.from({ length: 7 }, (_, i) => {
    const date = sgtDateOffset(nowMs, i - 6)
    return byDate[date] ?? { date, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  })

  const today = byDate[todaySGT] ?? { date: todaySGT, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }

  return { goal, today, history }
}

export type HomeData = {
  goal: Goal | null
  coachLine: string | null // first bullet of today's cached coaching notes, if any
  firstName: string | null
  avatarUrl: string | null
}

// Lightweight fetch for the home hero card: goal + today's cached coaching line.
// Never calls the Claude API — the client falls back to a rule-based line.
export async function getHomeData(): Promise<HomeData> {
  noStore()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { goal: null, coachLine: null, firstName: null, avatarUrl: null }

  const todaySGT = toSGTDate(Date.now())

  const [{ data: goalRow }, { data: noteRow }, { data: profileRow }] = await Promise.all([
    supabase.from('daily_goals').select('*').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('coaching_notes')
      .select('content')
      .eq('user_id', user.id)
      .eq('date', todaySGT)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('first_name, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  const goal: Goal | null = goalRow
    ? {
        calorie_target: goalRow.calorie_target,
        protein_target: Number(goalRow.protein_target),
        carb_target: Number(goalRow.carb_target),
        fat_target: Number(goalRow.fat_target),
      }
    : null

  const firstBullet = noteRow?.content
    ?.split('\n')
    .map((l: string) => l.trim())
    .find((l: string) => l.startsWith('•'))
    ?.replace(/^•\s*/, '') ?? null

  return {
    goal,
    coachLine: firstBullet,
    firstName: profileRow?.first_name ?? null,
    avatarUrl: profileRow?.avatar_url ?? null,
  }
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
