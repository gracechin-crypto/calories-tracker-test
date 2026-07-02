type Workout = { type: string; duration_min: number; kcal: number }

export type HealthDay = {
  steps: number
  active_kcal: number
  workouts: Workout[]
}

export default function ActivityCard({ health }: { health: HealthDay | null }) {
  if (!health) return null

  const latest = health.workouts[health.workouts.length - 1]

  return (
    <div className="rounded-card bg-white p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Activity</h2>
        <span className="rounded-pill bg-chip-sky px-2.5 py-0.5 text-xs font-bold text-ink">Apple Watch</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-field bg-chip-sky/40 px-3.5 py-3">
          <p className="text-lg leading-none">👟</p>
          <p className="mt-1.5 text-xs font-medium text-sub">Steps</p>
          <p className="tnum text-base font-bold text-ink">{health.steps.toLocaleString()}</p>
        </div>
        <div className="rounded-field bg-chip-sky/40 px-3.5 py-3">
          <p className="text-lg leading-none">🔥</p>
          <p className="mt-1.5 text-xs font-medium text-sub">Active kcal</p>
          <p className="tnum text-base font-bold text-ink">{health.active_kcal.toLocaleString()}</p>
        </div>
        <div className="rounded-field bg-chip-sky/40 px-3.5 py-3">
          <p className="text-lg leading-none">💪</p>
          <p className="mt-1.5 text-xs font-medium text-sub">Latest workout</p>
          {latest ? (
            <p className="text-sm font-bold leading-tight text-ink">
              {latest.type}
              <span className="tnum block text-xs font-medium text-sub">{latest.duration_min} min · {latest.kcal} kcal</span>
            </p>
          ) : (
            <p className="text-sm font-bold text-sub">–</p>
          )}
        </div>
      </div>
    </div>
  )
}
