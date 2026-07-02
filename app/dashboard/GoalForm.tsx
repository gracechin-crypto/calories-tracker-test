'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveGoal, type Goal } from '@/app/actions/dashboard'

export default function GoalForm({ initialValues }: { initialValues?: Goal }) {
  const router = useRouter()
  const [editing, setEditing] = useState(!initialValues)
  const [calories, setCalories] = useState(String(initialValues?.calorie_target ?? 2000))
  const [protein,  setProtein]  = useState(String(initialValues?.protein_target  ?? 150))
  const [carbs,    setCarbs]    = useState(String(initialValues?.carb_target      ?? 250))
  const [fat,      setFat]      = useState(String(initialValues?.fat_target       ?? 65))
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await saveGoal(Number(calories), Number(protein), Number(carbs), Number(fat))
        setEditing(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save')
      }
    })
  }

  if (!editing && initialValues) {
    return (
      <div className="flex items-center justify-between">
        <div className="tnum flex gap-6 text-sm font-medium text-sub">
          <span><strong className="text-ink">{initialValues.calorie_target.toLocaleString()}</strong> kcal</span>
          <span>P <strong className="text-ink">{initialValues.protein_target}g</strong></span>
          <span>C <strong className="text-ink">{initialValues.carb_target}g</strong></span>
          <span>F <strong className="text-ink">{initialValues.fat_target}g</strong></span>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="text-xs font-semibold text-green underline underline-offset-2 hover:text-ink"
        >
          Edit
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Calories (kcal)', value: calories, set: setCalories, min: 500 },
          { label: 'Protein (g)',     value: protein,  set: setProtein,  min: 0   },
          { label: 'Carbs (g)',       value: carbs,    set: setCarbs,    min: 0   },
          { label: 'Fat (g)',         value: fat,      set: setFat,      min: 0   },
        ].map(({ label, value, set, min }) => (
          <div key={label} className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-sub">{label}</label>
            <input
              type="number"
              required
              min={min}
              value={value}
              onChange={(e) => set(e.target.value)}
              className="tnum rounded-field bg-bg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-lime"
            />
          </div>
        ))}
      </div>
      {error && <p className="text-sm font-medium text-coral">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-field bg-lime px-5 py-2 text-sm font-bold text-ink transition-colors hover:bg-lime-deep disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
        {initialValues && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-field bg-bg px-5 py-2 text-sm font-semibold text-sub hover:text-ink"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
