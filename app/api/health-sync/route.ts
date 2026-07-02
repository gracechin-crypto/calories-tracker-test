import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Workout = { type: string; duration_min: number; kcal: number }

type Payload = {
  date: string
  steps: number
  active_kcal: number
  workouts?: Workout[]
}

export async function POST(request: NextRequest) {
  const token = process.env.HEALTH_SYNC_TOKEN
  const userId = process.env.HEALTH_SYNC_USER_ID
  if (!token || !userId) {
    return NextResponse.json({ error: 'Health sync is not configured' }, { status: 503 })
  }

  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Payload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date ?? '')) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
  }
  const steps = Number(body.steps)
  const activeKcal = Number(body.active_kcal)
  if (!Number.isFinite(steps) || steps < 0 || !Number.isFinite(activeKcal) || activeKcal < 0) {
    return NextResponse.json({ error: 'steps and active_kcal must be non-negative numbers' }, { status: 400 })
  }
  const workouts = Array.isArray(body.workouts)
    ? body.workouts
        .filter((w) => w && typeof w.type === 'string')
        .map((w) => ({
          type: String(w.type).slice(0, 60),
          duration_min: Math.max(0, Math.round(Number(w.duration_min) || 0)),
          kcal: Math.max(0, Math.round(Number(w.kcal) || 0)),
        }))
    : []

  const admin = createAdminClient()
  const { error } = await admin.from('health_days').upsert(
    {
      user_id: userId,
      date: body.date,
      steps: Math.round(steps),
      active_kcal: Math.round(activeKcal),
      workouts,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,date' },
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, date: body.date, steps: Math.round(steps), active_kcal: Math.round(activeKcal), workouts_count: workouts.length })
}
