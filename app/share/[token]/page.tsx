import { unstable_noStore as noStore } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

function fmt(n: number) { return Math.round(n).toLocaleString() }

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// SGT = UTC+8, no DST
function toSGTDate(msOrStr: number | string): string {
  const ms = typeof msOrStr === 'string' ? new Date(msOrStr).getTime() : msOrStr
  const sgt = new Date(ms + 8 * 60 * 60 * 1000)
  return `${sgt.getUTCFullYear()}-${String(sgt.getUTCMonth() + 1).padStart(2, '0')}-${String(sgt.getUTCDate()).padStart(2, '0')}`
}

function InactivePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-8 text-center shadow-card">
        <p className="mb-2 text-3xl">🔗</p>
        <h1 className="mb-2 text-xl font-extrabold text-ink">This link isn&apos;t active</h1>
        <p className="text-sm font-medium text-sub">
          It may have been revoked or expired. Ask for a fresh link.
        </p>
      </div>
    </main>
  )
}

export default async function SharePage({ params }: { params: { token: string } }) {
  noStore()

  // Basic shape check before touching the DB
  if (!/^[A-Za-z0-9]{20,64}$/.test(params.token)) return <InactivePage />

  const admin = createAdminClient()

  const { data: link } = await admin
    .from('share_links')
    .select('user_id, revoked, expires_at')
    .eq('token', params.token)
    .maybeSingle()

  const valid =
    link &&
    !link.revoked &&
    (!link.expires_at || new Date(link.expires_at).getTime() > Date.now())

  if (!valid) return <InactivePage />

  const userId = link.user_id
  const nowMs = Date.now()
  const queryStart = new Date(nowMs - 8 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: goalRow }, { data: meals }, { data: profileRow }] = await Promise.all([
    admin.from('daily_goals').select('calorie_target, protein_target, carb_target, fat_target').eq('user_id', userId).maybeSingle(),
    admin
      .from('meals')
      .select('name, description, calories, protein_g, carbs_g, fat_g, logged_at')
      .eq('user_id', userId)
      .gte('logged_at', queryStart)
      .order('logged_at', { ascending: false }),
    admin.from('profiles').select('first_name').eq('user_id', userId).maybeSingle(),
  ])

  const firstName = profileRow?.first_name ?? 'Grace'
  const goalCal = goalRow?.calorie_target ?? 0

  // Aggregate by SGT day
  const byDate: Record<string, { calories: number; protein_g: number; carbs_g: number; fat_g: number }> = {}
  for (const meal of meals ?? []) {
    const d = toSGTDate(meal.logged_at)
    byDate[d] ??= { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    byDate[d].calories  += meal.calories
    byDate[d].protein_g += Number(meal.protein_g)
    byDate[d].carbs_g   += Number(meal.carbs_g)
    byDate[d].fat_g     += Number(meal.fat_g)
  }

  const todaySGT = toSGTDate(nowMs)
  const today = byDate[todaySGT] ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }

  const history = Array.from({ length: 7 }, (_, i) => {
    const date = toSGTDate(nowMs + (i - 6) * 24 * 60 * 60 * 1000)
    return { date, ...(byDate[date] ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }) }
  })

  const trackedDays = history.filter((d) => d.calories > 0)
  const avgCalories = trackedDays.length > 0
    ? Math.round(trackedDays.reduce((s, d) => s + d.calories, 0) / trackedDays.length)
    : 0
  const avgProtein = trackedDays.length > 0
    ? Math.round(trackedDays.reduce((s, d) => s + d.protein_g, 0) / trackedDays.length)
    : 0

  const maxScale = Math.max(goalCal, ...history.map((d) => d.calories), 1)
  const todayMeals = (meals ?? []).filter((m) => toSGTDate(m.logged_at) === todaySGT)

  return (
    <main className="min-h-screen bg-bg p-4">
      <div className="mx-auto max-w-lg space-y-4 pb-8">

        {/* Header */}
        <div className="flex items-center justify-between pt-4">
          <div>
            <p className="text-xs font-medium text-sub">Shared dashboard</p>
            <h1 className="text-lg font-extrabold text-ink">{firstName}&apos;s intake</h1>
          </div>
          <span className="rounded-pill bg-chip-sky px-3 py-1 text-xs font-bold text-ink">Read-only</span>
        </div>

        {/* Today */}
        <div className="rounded-card bg-white p-5 shadow-card">
          <h2 className="mb-3 text-sm font-semibold text-ink">Today</h2>
          <div className="mb-3 flex items-baseline gap-1">
            <span className="tnum text-3xl font-extrabold text-ink">{fmt(today.calories)}</span>
            {goalCal > 0
              ? <span className="tnum text-base font-medium text-sub">/ {fmt(goalCal)} kcal</span>
              : <span className="text-base font-medium text-sub">kcal</span>}
          </div>
          <div className="tnum flex gap-6 text-sm font-medium text-sub">
            <span>Protein <strong className="text-ink">{fmt(today.protein_g)}g</strong></span>
            <span>Carbs <strong className="text-ink">{fmt(today.carbs_g)}g</strong></span>
            <span>Fat <strong className="text-ink">{fmt(today.fat_g)}g</strong></span>
          </div>
        </div>

        {/* Week stats */}
        <div className="rounded-card bg-white p-5 shadow-card">
          <h2 className="mb-3 text-sm font-semibold text-ink">This week</h2>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-field bg-bg px-3.5 py-3">
              <p className="text-xs font-medium text-sub">Avg kcal/day</p>
              <p className="tnum text-base font-bold text-ink">{avgCalories > 0 ? fmt(avgCalories) : '–'}</p>
            </div>
            <div className="rounded-field bg-bg px-3.5 py-3">
              <p className="text-xs font-medium text-sub">Avg protein</p>
              <p className="tnum text-base font-bold text-ink">{avgProtein > 0 ? `${avgProtein}g` : '–'}</p>
            </div>
            <div className="rounded-field bg-bg px-3.5 py-3">
              <p className="text-xs font-medium text-sub">Days logged</p>
              <p className="tnum text-base font-bold text-ink">{trackedDays.length} of 7</p>
            </div>
          </div>

          {/* Bar chart */}
          <div className="mt-4 flex h-24 items-end gap-1.5">
            {history.map((day) => {
              const barPct = day.calories > 0 ? Math.min((day.calories / maxScale) * 100, 100) : 0
              const over = goalCal > 0 && day.calories > goalCal
              return (
                <div key={day.date} className="flex h-full flex-1 items-end">
                  <div
                    className={`w-full rounded-t ${day.calories === 0 ? 'bg-bg' : over ? 'bg-amber2' : 'bg-lime-deep'}`}
                    style={{ height: barPct > 0 ? `${barPct}%` : '3px' }}
                  />
                </div>
              )
            })}
          </div>
          <div className="mt-1 flex gap-1.5">
            {history.map((day) => (
              <div key={day.date} className="flex-1 text-center">
                <span className={`text-xs font-medium ${day.date === todaySGT ? 'font-bold text-ink' : 'text-sub'}`}>
                  {day.date === todaySGT ? 'Today' : DAY_LABELS[new Date(day.date + 'T00:00:00').getDay()]}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-1.5">
            {history.map((day) => (
              <div key={day.date} className="flex-1 text-center">
                <span className="tnum text-xs font-medium text-sub">{day.calories > 0 ? fmt(day.calories) : '–'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Today's meals */}
        {todayMeals.length > 0 && (
          <div className="rounded-card bg-white p-5 shadow-card">
            <h2 className="mb-3 text-sm font-semibold text-ink">Today&apos;s meals</h2>
            <ul className="space-y-2">
              {todayMeals.map((meal, i) => (
                <li key={i} className="flex items-center justify-between rounded-field bg-bg px-3.5 py-2.5">
                  <span className="truncate pr-3 text-sm font-semibold text-ink">{meal.name ?? meal.description}</span>
                  <span className="tnum shrink-0 text-sm font-bold text-ink">{meal.calories} kcal</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-center text-xs font-medium text-sub">
          Shared from Calories Tracker · updates live
        </p>
      </div>
    </main>
  )
}
