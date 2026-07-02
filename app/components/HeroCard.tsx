'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  consumed: number
  goal: number          // 0 = no goal set
  proteinNow: number
  proteinTarget: number
  coachLine: string | null
}

// Count-up over ~700ms, skipped when the user prefers reduced motion.
function useCountUp(target: number): number {
  const [value, setValue] = useState(0)
  const raf = useRef<number>()

  useEffect(() => {
    if (typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }
    const start = performance.now()
    const from = 0
    const dur = 700
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(from + (target - from) * eased))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target])

  return value
}

function ruleBasedLine(consumed: number, goal: number, proteinNow: number, proteinTarget: number): string {
  if (goal > 0 && consumed > goal) {
    return `${(consumed - goal).toLocaleString()} kcal over today — tomorrow is a fresh start`
  }
  if (proteinTarget > 0 && proteinNow < proteinTarget) {
    return `Protein's at ${Math.round(proteinNow)}g — ${Math.round(proteinTarget - proteinNow)}g more gets you to ${Math.round(proteinTarget)}g`
  }
  if (goal > 0) {
    return `${(goal - consumed).toLocaleString()} kcal left for today — nicely paced`
  }
  return 'Set a daily goal on the dashboard to unlock coaching'
}

export default function HeroCard({ consumed, goal, proteinNow, proteinTarget, coachLine }: Props) {
  const displayed = useCountUp(consumed)

  const pct = goal > 0 ? Math.min(consumed / goal, 1) : 0
  const R = 52
  const C = 2 * Math.PI * R
  const [offset, setOffset] = useState(C)
  useEffect(() => {
    // set after mount so the ring animates from empty
    const id = requestAnimationFrame(() => setOffset(C * (1 - pct)))
    return () => cancelAnimationFrame(id)
  }, [C, pct])

  const line = coachLine ?? ruleBasedLine(consumed, goal, proteinNow, proteinTarget)

  return (
    <div
      className="rounded-card p-5 shadow-card"
      style={{ background: 'linear-gradient(150deg, #E9F6C9, #C6E96B)' }}
    >
      <div className="flex items-center gap-5">
        {/* Progress ring */}
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(30,38,32,.12)" strokeWidth="10" />
            <circle
              cx="60" cy="60" r={R} fill="none"
              stroke="#3E7C4A" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={offset}
              className="anim-ring"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="tnum text-2xl font-extrabold leading-none text-ink">{displayed.toLocaleString()}</span>
            <span className="text-[11px] font-medium text-ink/60">
              {goal > 0 ? `of ${goal.toLocaleString()} kcal` : 'kcal today'}
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink/70">Today</p>
          <p className="tnum text-xl font-extrabold text-ink">
            {goal > 0 && consumed <= goal
              ? `${(goal - consumed).toLocaleString()} kcal to go`
              : goal > 0
              ? 'Goal reached'
              : `${consumed.toLocaleString()} kcal`}
          </p>
          <p className="mt-2 text-[13px] font-medium leading-snug text-green">{line}</p>
        </div>
      </div>
    </div>
  )
}
