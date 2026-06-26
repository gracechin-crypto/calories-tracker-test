import Link from 'next/link'
import { getDashboardData } from '@/app/actions/dashboard'
import { createClient } from '@/lib/supabase/server'
import GoalForm from './GoalForm'
import CoachCard from '@/app/components/CoachCard'
import WeeklyInsights, { type WeeklyData } from '@/app/components/WeeklyInsights'

function fmt(n: number) { return Math.round(n).toLocaleString() }

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default async function DashboardPage() {
  const { goal, today, history } = await getDashboardData()

  // Load today's cached coaching notes (if any) for initial render
  const todaySGT = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: coachRow } = user
    ? await supabase
        .from('coaching_notes')
        .select('content')
        .eq('user_id', user.id)
        .eq('date', todaySGT)
        .maybeSingle()
    : { data: null }

  const daysWithData = history.filter((d) => d.calories > 0).length

  // Fetch individual meal names for dish-frequency stat (separate from aggregated history)
  const weekQueryStart = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
  const { data: mealNameRows } = user
    ? await supabase
        .from('meals')
        .select('name')
        .eq('user_id', user.id)
        .gte('logged_at', weekQueryStart)
        .not('name', 'is', null)
    : { data: null }

  const nameCounts: Record<string, number> = {}
  for (const row of mealNameRows ?? []) {
    if (row.name) nameCounts[row.name] = (nameCounts[row.name] ?? 0) + 1
  }
  const topFoodEntry = Object.entries(nameCounts).sort((a, b) => b[1] - a[1])[0] ?? null

  // Compute weekly averages from days that have data
  const trackedDays = history.filter((d) => d.calories > 0)
  const avgCalories = trackedDays.length > 0
    ? Math.round(trackedDays.reduce((s, d) => s + d.calories, 0) / trackedDays.length)
    : null
  const avgProtein = trackedDays.length > 0
    ? Math.round(trackedDays.reduce((s, d) => s + d.protein_g, 0) / trackedDays.length * 10) / 10
    : null
  const avgCarbs = trackedDays.length > 0
    ? Math.round(trackedDays.reduce((s, d) => s + d.carbs_g, 0) / trackedDays.length * 10) / 10
    : null
  const avgFat = trackedDays.length > 0
    ? Math.round(trackedDays.reduce((s, d) => s + d.fat_g, 0) / trackedDays.length * 10) / 10
    : null

  const goalCal = goal?.calorie_target ?? 0
  const calVsGoalPct = goalCal > 0 && avgCalories != null
    ? Math.round(((avgCalories - goalCal) / goalCal) * 100)
    : null
  const daysWithinGoal = goalCal > 0
    ? trackedDays.filter((d) => d.calories <= goalCal).length
    : null

  const weeklyData: WeeklyData = {
    daysTracked: daysWithData,
    avgCalories,
    calVsGoalPct,
    avgProtein,
    avgCarbs,
    avgFat,
    daysWithinGoal,
    trackedDaysCount: trackedDays.length,
    topFood: topFoodEntry ? { name: topFoodEntry[0], count: topFoodEntry[1] } : null,
    goal,
  }
  const todayPct = goalCal > 0 ? Math.min((today.calories / goalCal) * 100, 100) : 0
  const todayOver = goalCal > 0 && today.calories > goalCal

  // Scale bars: tallest bar fills 100% of container height
  const maxScale = Math.max(goalCal, ...history.map((d) => d.calories), 1)

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-lg space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between pt-4">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
          >
            ← Log meals
          </Link>
        </div>

        {/* Goal section */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-medium text-gray-700">
            {goal ? 'Daily goal' : 'Set your daily calorie goal'}
          </h2>
          <GoalForm initialValues={goal ?? undefined} />
        </div>

        {/* Today's summary */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-medium text-gray-700">Today</h2>
          <div className="mb-3 flex items-baseline gap-1">
            <span className="text-3xl font-bold text-gray-900">{fmt(today.calories)}</span>
            {goalCal > 0 && (
              <span className="text-base text-gray-500">/ {fmt(goalCal)} kcal</span>
            )}
            {goalCal === 0 && <span className="text-base text-gray-500">kcal</span>}
          </div>

          {goalCal > 0 && (
            <div className="mb-4 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all ${todayOver ? 'bg-amber-400' : 'bg-emerald-400'}`}
                style={{ width: `${todayPct}%` }}
              />
            </div>
          )}

          <div className="flex gap-6 text-sm text-gray-600">
            <span>Protein <strong className="text-gray-900">{fmt(today.protein_g)}g</strong></span>
            <span>Carbs <strong className="text-gray-900">{fmt(today.carbs_g)}g</strong></span>
            <span>Fat <strong className="text-gray-900">{fmt(today.fat_g)}g</strong></span>
          </div>
        </div>

        {/* 7-day history */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-medium text-gray-700">Last 7 days</h2>

          {/* Bar chart */}
          <div className="flex h-24 items-end gap-1">
            {history.map((day) => {
              const barPct = day.calories > 0 ? Math.min((day.calories / maxScale) * 100, 100) : 0
              const over = goalCal > 0 && day.calories > goalCal
              const isToday = day.date === today.date
              return (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-1 h-full">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className={`w-full rounded-t transition-all ${
                        day.calories === 0
                          ? 'bg-gray-100'
                          : over
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                      } ${isToday ? 'ring-2 ring-gray-400 ring-offset-1' : ''}`}
                      style={{ height: barPct > 0 ? `${barPct}%` : '3px' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Day labels */}
          <div className="mt-1 flex gap-1">
            {history.map((day) => {
              const dow = new Date(day.date + 'T00:00:00').getDay()
              const isToday = day.date === today.date
              return (
                <div key={day.date} className="flex-1 text-center">
                  <span className={`text-xs ${isToday ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>
                    {isToday ? 'Today' : DAY_LABELS[dow]}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Calorie labels */}
          <div className="mt-2 flex gap-1">
            {history.map((day) => (
              <div key={day.date} className="flex-1 text-center">
                <span className="text-xs text-gray-500">
                  {day.calories > 0 ? fmt(day.calories) : '–'}
                </span>
              </div>
            ))}
          </div>

          {goalCal > 0 && (
            <p className="mt-3 text-xs text-gray-400">
              Goal: {fmt(goalCal)} kcal/day · <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 align-middle" /> under · <span className="inline-block h-2 w-2 rounded-full bg-amber-400 align-middle" /> over
            </p>
          )}
        </div>

        {/* Coach's notes */}
        <CoachCard initialContent={coachRow?.content ?? null} daysWithData={daysWithData} />

        {/* Weekly insights */}
        <WeeklyInsights data={weeklyData} />

      </div>
    </main>
  )
}
