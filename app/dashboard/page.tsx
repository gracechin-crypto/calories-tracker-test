import { getDashboardData } from '@/app/actions/dashboard'
import { createClient } from '@/lib/supabase/server'
import GoalForm from './GoalForm'
import CoachCard from '@/app/components/CoachCard'
import WeeklyInsights, { type WeeklyData } from '@/app/components/WeeklyInsights'
import GreetingHeader from '@/app/components/GreetingHeader'
import BottomNav from '@/app/components/BottomNav'

function fmt(n: number) { return Math.round(n).toLocaleString() }

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default async function DashboardPage() {
  // One auth round trip, then every query runs in a single parallel batch.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const todaySGT = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const weekQueryStart = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()

  const [{ goal, today, history }, { data: coachRow }, { data: mealNameRows }] = await Promise.all([
    getDashboardData(supabase, user.id),
    supabase
      .from('coaching_notes')
      .select('content')
      .eq('user_id', user.id)
      .eq('date', todaySGT)
      .maybeSingle(),
    supabase
      .from('meals')
      .select('name')
      .eq('user_id', user.id)
      .gte('logged_at', weekQueryStart)
      .not('name', 'is', null),
  ])

  const daysWithData = history.filter((d) => d.calories > 0).length

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
    <main className="min-h-screen bg-bg p-4">
      <div className="mx-auto max-w-lg space-y-4">

        <GreetingHeader />

        {/* Goal section */}
        <div className="rounded-card bg-white p-5 shadow-card">
          <h2 className="mb-3 text-sm font-semibold text-ink">
            {goal ? 'Daily goal' : 'Set your daily calorie goal'}
          </h2>
          <GoalForm initialValues={goal ?? undefined} />
        </div>

        {/* Today's summary */}
        <div className="rounded-card bg-white p-5 shadow-card">
          <h2 className="mb-3 text-sm font-semibold text-ink">Today</h2>
          <div className="mb-3 flex items-baseline gap-1">
            <span className="tnum text-3xl font-extrabold text-ink">{fmt(today.calories)}</span>
            {goalCal > 0 && (
              <span className="tnum text-base font-medium text-sub">/ {fmt(goalCal)} kcal</span>
            )}
            {goalCal === 0 && <span className="text-base font-medium text-sub">kcal</span>}
          </div>

          {goalCal > 0 && (
            <div className="mb-4 h-2.5 w-full overflow-hidden rounded-pill bg-bg">
              <div
                className={`anim-bar-fill h-full rounded-pill ${todayOver ? 'bg-amber2' : 'bg-lime-deep'}`}
                style={{ width: `${todayPct}%` }}
              />
            </div>
          )}

          <div className="tnum flex gap-6 text-sm font-medium text-sub">
            <span>Protein <strong className="text-ink">{fmt(today.protein_g)}g</strong></span>
            <span>Carbs <strong className="text-ink">{fmt(today.carbs_g)}g</strong></span>
            <span>Fat <strong className="text-ink">{fmt(today.fat_g)}g</strong></span>
          </div>
        </div>

        {/* 7-day history */}
        <div className="rounded-card bg-white p-5 shadow-card">
          <h2 className="mb-4 text-sm font-semibold text-ink">Last 7 days</h2>

          {/* Bar chart */}
          <div className="flex h-24 items-end gap-1.5">
            {history.map((day) => {
              const barPct = day.calories > 0 ? Math.min((day.calories / maxScale) * 100, 100) : 0
              const over = goalCal > 0 && day.calories > goalCal
              const isToday = day.date === today.date
              return (
                <div key={day.date} className="flex h-full flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className={`anim-bar-rise w-full rounded-t ${
                        day.calories === 0
                          ? 'bg-bg'
                          : over
                          ? 'bg-amber2'
                          : 'bg-lime-deep'
                      } ${isToday ? 'ring-2 ring-ink/30 ring-offset-1' : ''}`}
                      style={{ height: barPct > 0 ? `${barPct}%` : '3px' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Day labels */}
          <div className="mt-1 flex gap-1.5">
            {history.map((day) => {
              const dow = new Date(day.date + 'T00:00:00').getDay()
              const isToday = day.date === today.date
              return (
                <div key={day.date} className="flex-1 text-center">
                  <span className={`text-xs font-medium ${isToday ? 'font-bold text-ink' : 'text-sub'}`}>
                    {isToday ? 'Today' : DAY_LABELS[dow]}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Calorie labels */}
          <div className="mt-2 flex gap-1.5">
            {history.map((day) => (
              <div key={day.date} className="flex-1 text-center">
                <span className="tnum text-xs font-medium text-sub">
                  {day.calories > 0 ? fmt(day.calories) : '–'}
                </span>
              </div>
            ))}
          </div>

          {goalCal > 0 && (
            <p className="mt-3 text-xs font-medium text-sub">
              Goal: {fmt(goalCal)} kcal/day · <span className="inline-block h-2 w-2 rounded-pill bg-lime-deep align-middle" /> under · <span className="inline-block h-2 w-2 rounded-pill bg-amber2 align-middle" /> over
            </p>
          )}
        </div>

        {/* Coach's notes */}
        <CoachCard initialContent={coachRow?.content ?? null} daysWithData={daysWithData} />

        {/* Weekly insights */}
        <WeeklyInsights data={weeklyData} />

        <BottomNav />
      </div>
    </main>
  )
}
