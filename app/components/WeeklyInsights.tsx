import type { Goal } from '@/app/actions/dashboard'

export type WeeklyData = {
  daysTracked: number
  avgCalories: number | null
  calVsGoalPct: number | null   // negative = under, positive = over
  avgProtein: number | null
  avgCarbs: number | null
  avgFat: number | null
  daysWithinGoal: number | null // null when no goal set
  trackedDaysCount: number       // denominator for adherence
  topFood: { name: string; count: number } | null
  goal: Goal | null
}

function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: 'green' | 'amber'
}) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-3">
      <p className="mb-0.5 text-xs text-gray-400">{label}</p>
      <p className={`text-base font-semibold ${
        accent === 'green' ? 'text-emerald-600'
        : accent === 'amber' ? 'text-amber-600'
        : 'text-gray-900'
      }`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

export default function WeeklyInsights({ data }: { data: WeeklyData }) {
  const { daysTracked, avgCalories, calVsGoalPct, avgProtein, avgCarbs, avgFat,
          daysWithinGoal, trackedDaysCount, topFood, goal } = data

  const lowData = daysTracked < 2

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-sm font-medium text-gray-700">Weekly insights</h2>

      {lowData ? (
        <p className="mt-2 text-sm text-gray-400">
          {daysTracked === 0
            ? 'Log meals across a few days to see your weekly patterns here.'
            : 'Log meals on at least 2 days to unlock weekly trends. Here\'s what\'s available so far:'}
        </p>
      ) : null}

      {/* Show partial data even if low, as long as at least 1 day exists */}
      {daysTracked > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2">

          {/* Calories */}
          {avgCalories != null && (
            <StatTile
              label="Avg daily calories"
              value={`${avgCalories.toLocaleString()} kcal`}
              sub={
                calVsGoalPct != null
                  ? Math.abs(calVsGoalPct) < 2
                    ? 'right on goal'
                    : calVsGoalPct < 0
                    ? `${Math.abs(calVsGoalPct)}% under goal`
                    : `${calVsGoalPct}% over goal`
                  : undefined
              }
              accent={
                calVsGoalPct == null ? undefined
                : calVsGoalPct <= 0 ? 'green'
                : 'amber'
              }
            />
          )}

          {/* Logging consistency */}
          <StatTile
            label="Days logged"
            value={`${daysTracked} of 7`}
            sub={daysTracked === 7 ? 'Perfect week!' : daysTracked >= 5 ? 'Great consistency' : undefined}
            accent={daysTracked >= 5 ? 'green' : undefined}
          />

          {/* Macros — only show if we have data */}
          {avgProtein != null && (
            <StatTile label="Avg protein / day" value={`${avgProtein}g`} />
          )}
          {avgCarbs != null && (
            <StatTile label="Avg carbs / day" value={`${avgCarbs}g`} />
          )}
          {avgFat != null && (
            <StatTile label="Avg fat / day" value={`${avgFat}g`} />
          )}

          {/* Goal adherence — only when goal is set and enough data */}
          {goal && daysWithinGoal != null && trackedDaysCount >= 2 && (
            <StatTile
              label="On-goal days"
              value={`${daysWithinGoal} of ${trackedDaysCount}`}
              sub="tracked days within calorie goal"
              accent={daysWithinGoal >= trackedDaysCount * 0.7 ? 'green' : undefined}
            />
          )}

          {/* Top food */}
          {topFood && (
            <StatTile
              label="Most logged food"
              value={topFood.name.length > 22 ? topFood.name.slice(0, 21) + '…' : topFood.name}
              sub={`${topFood.count} time${topFood.count === 1 ? '' : 's'} this week`}
            />
          )}
        </div>
      )}

      {!lowData && (
        <p className="mt-3 text-xs text-gray-400">Based on the last 7 days (SGT)</p>
      )}
    </div>
  )
}
