'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { logout } from '@/app/actions/auth'
import { logMeal, getTodayMeals, type LogMealResult, type TodayMeal } from '@/app/actions/log-meal'

export default function Home() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<LogMealResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [meals, setMeals] = useState<TodayMeal[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    getTodayMeals().then(setMeals)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    setError(null)
    setResult(null)

    startTransition(async () => {
      try {
        const r = await logMeal(input.trim())
        setResult(r)
        setInput('')
        setMeals(await getTodayMeals())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0)

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-lg space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pt-4">
          <h1 className="text-2xl font-bold tracking-tight">Calories Tracker</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
            >
              Dashboard →
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
              >
                Log out
              </button>
            </form>
          </div>
        </div>

        {/* Chat input */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-medium text-gray-700">What did you eat?</h2>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. 1 plate of chicken rice"
              disabled={isPending}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isPending || !input.trim()}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {isPending ? 'Logging…' : 'Log'}
            </button>
          </form>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>

        {/* Confirmation card */}
        {result && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-5 shadow-sm">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{result.name}</p>
                <p className="text-xs text-gray-500">{result.serving_description}</p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  result.source === 'local_db'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {result.source === 'local_db' ? 'Database' : 'AI estimate'}
              </span>
            </div>
            <p className="mb-2 text-3xl font-bold text-gray-900">
              {result.calories} <span className="text-base font-normal text-gray-500">kcal</span>
            </p>
            <div className="flex gap-4 text-sm text-gray-600">
              <span>Protein <strong>{result.protein_g}g</strong></span>
              <span>Carbs <strong>{result.carbs_g}g</strong></span>
              <span>Fat <strong>{result.fat_g}g</strong></span>
            </div>
            <button
              onClick={() => setResult(null)}
              className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
            >
              Log another
            </button>
          </div>
        )}

        {/* Today's meals */}
        {meals.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-700">Today</h2>
              <span className="text-sm font-semibold text-gray-900">{totalCalories} kcal</span>
            </div>
            <ul className="space-y-2">
              {meals.map((meal) => (
                <li key={meal.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${
                        meal.source === 'local_db'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {meal.source === 'local_db' ? 'DB' : 'AI'}
                    </span>
                    <span className="truncate text-gray-800">{meal.name ?? meal.description}</span>
                  </div>
                  <span className="ml-3 shrink-0 font-medium text-gray-900">{meal.calories} kcal</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  )
}
