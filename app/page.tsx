'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import Link from 'next/link'
import { logout } from '@/app/actions/auth'
import { logMeal, getTodayMeals, type LogMealResult, type TodayMeal } from '@/app/actions/log-meal'
import { logMealFromPhoto } from '@/app/actions/log-meal-photo'
import { logMealMulti, type MultiLogResult } from '@/app/actions/log-meal-multi'

function sourceBadge(source: string) {
  if (source === 'local_db')          return { label: 'Database',    cls: 'bg-green-100 text-green-700' }
  if (source === 'ai_photo_estimate') return { label: 'Photo',       cls: 'bg-purple-100 text-purple-700' }
  if (source === 'multi_item')        return { label: 'Multi-item',  cls: 'bg-indigo-100 text-indigo-700' }
  return                                     { label: 'AI estimate', cls: 'bg-blue-100 text-blue-700' }
}

type Mode = 'type' | 'snap' | 'multi'

export default function Home() {
  const [mode, setMode] = useState<Mode>('type')

  // Text mode
  const [input, setInput] = useState('')

  // Photo mode
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [photoDetails, setPhotoDetails] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Multi mode
  const [multiItems, setMultiItems] = useState<string[]>(['', ''])
  const [multiResult, setMultiResult] = useState<(MultiLogResult & { ok: true }) | null>(null)

  // Shared
  const [result, setResult] = useState<LogMealResult | null>(null)
  const [resultPhotoUrl, setResultPhotoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [meals, setMeals] = useState<TodayMeal[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    getTodayMeals().then(setMeals)
  }, [])

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    }
  }, [photoPreviewUrl])

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setResult(null)
    setResultPhotoUrl(null)
    setMultiResult(null)
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    setPhotoFile(null)
    setPhotoPreviewUrl(null)
    setPhotoDetails('')
    setMultiItems(['', ''])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    setPhotoFile(file)
    setPhotoPreviewUrl(file ? URL.createObjectURL(file) : null)
    setError(null)
    setResult(null)
    setResultPhotoUrl(null)
  }

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    setError(null)
    setResult(null)
    setResultPhotoUrl(null)

    startTransition(async () => {
      try {
        const r = await logMeal(input.trim())
        setResult(r)
        setResultPhotoUrl(null)
        setInput('')
        setMeals(await getTodayMeals())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  const handlePhotoSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!photoFile) return
    setError(null)
    setResult(null)

    const capturedUrl = photoPreviewUrl

    startTransition(async () => {
      const fd = new FormData()
      fd.append('image', photoFile)
      fd.append('details', photoDetails)
      const r = await logMealFromPhoto(fd)
      if (!r.ok) {
        setError(r.error)
        return
      }
      setResult(r.data)
      setResultPhotoUrl(capturedUrl)
      setPhotoFile(null)
      setPhotoPreviewUrl(null)
      setPhotoDetails('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      setMeals(await getTodayMeals())
    })
  }

  const hasMultiInput = multiItems.some((v) => v.trim())

  const handleMultiSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasMultiInput) return
    setError(null)
    setMultiResult(null)

    startTransition(async () => {
      const fd = new FormData()
      multiItems.filter((v) => v.trim()).forEach((v) => fd.append('item', v.trim()))
      const r = await logMealMulti(fd)
      if (!r.ok) {
        setError(r.error)
        return
      }
      setMultiResult(r)
      setMultiItems(['', ''])
      setMeals(await getTodayMeals())
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

        {/* Log card */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {/* Mode tabs */}
          <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
            {(['type', 'snap', 'multi'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                  mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {m === 'type' ? 'Type it' : m === 'snap' ? 'Snap it' : 'Multiple'}
              </button>
            ))}
          </div>

          {/* ── Type it ── */}
          {mode === 'type' && (
            <>
              <h2 className="mb-3 text-sm font-medium text-gray-700">What did you eat?</h2>
              <form onSubmit={handleTextSubmit} className="flex gap-2">
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
            </>
          )}

          {/* ── Snap it ── */}
          {mode === 'snap' && (
            <>
              <h2 className="mb-3 text-sm font-medium text-gray-700">Take or upload a photo of your meal</h2>
              <form onSubmit={handlePhotoSubmit} className="space-y-3">
                {photoPreviewUrl ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreviewUrl} alt="Meal preview" className="h-48 w-full rounded-lg object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(photoPreviewUrl)
                        setPhotoFile(null)
                        setPhotoPreviewUrl(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white hover:bg-black/70"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <label className="flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm">Tap to take or choose a photo</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleFileChange}
                      disabled={isPending}
                    />
                  </label>
                )}
                {photoPreviewUrl && (
                  <>
                    <textarea
                      value={photoDetails}
                      onChange={(e) => setPhotoDetails(e.target.value)}
                      placeholder='Add details (optional) — e.g. "large portion", "no rice", "shared with someone"'
                      rows={2}
                      disabled={isPending}
                      className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={isPending}
                      className="w-full rounded-lg bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                    >
                      {isPending ? 'Identifying…' : 'Log this meal'}
                    </button>
                  </>
                )}
              </form>
            </>
          )}

          {/* ── Multiple items ── */}
          {mode === 'multi' && (
            <>
              <h2 className="mb-3 text-sm font-medium text-gray-700">List each component of your meal</h2>
              <form onSubmit={handleMultiSubmit} className="space-y-2">
                {multiItems.map((val, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => {
                        const next = [...multiItems]
                        next[idx] = e.target.value
                        setMultiItems(next)
                      }}
                      placeholder={idx === 0 ? 'e.g. 200g sliced beef' : idx === 1 ? 'e.g. 1 bowl beehoon' : 'e.g. handful of vegetables'}
                      disabled={isPending}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 disabled:opacity-50"
                    />
                    {multiItems.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setMultiItems(multiItems.filter((_, i) => i !== idx))}
                        disabled={isPending}
                        className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 hover:text-gray-600 disabled:opacity-50"
                        aria-label="Remove item"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setMultiItems([...multiItems, ''])}
                  disabled={isPending || multiItems.length >= 10}
                  className="mt-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40"
                >
                  + Add another item
                </button>
                <button
                  type="submit"
                  disabled={isPending || !hasMultiInput}
                  className="w-full rounded-lg bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                >
                  {isPending ? 'Estimating…' : 'Log meal'}
                </button>
              </form>
            </>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        {/* Single-item confirmation card */}
        {result && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-5 shadow-sm">
            {resultPhotoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resultPhotoUrl} alt="Logged meal" className="mb-3 h-36 w-full rounded-lg object-cover" />
            )}
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">{result.name}</p>
                <p className="text-xs text-gray-500">{result.serving_description}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sourceBadge(result.source).cls}`}>
                {sourceBadge(result.source).label}
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
              onClick={() => { setResult(null); setResultPhotoUrl(null) }}
              className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
            >
              Log another
            </button>
          </div>
        )}

        {/* Multi-item confirmation card */}
        {multiResult && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
            <p className="mb-3 text-sm font-medium text-gray-700">Meal logged — {multiResult.items.length} items</p>
            <ul className="space-y-3">
              {multiResult.items.map((item, idx) => (
                <li key={idx} className="rounded-lg bg-white px-3 py-2.5 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.input}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-gray-900">{item.calories} kcal</p>
                      <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${sourceBadge(item.source).cls}`}>
                        {sourceBadge(item.source).label}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    P {item.protein_g}g · C {item.carbs_g}g · F {item.fat_g}g
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-indigo-200 pt-3">
              <p className="text-3xl font-bold text-gray-900">
                {multiResult.total_calories} <span className="text-base font-normal text-gray-500">kcal total</span>
              </p>
              <div className="mt-1 flex gap-4 text-sm text-gray-600">
                <span>Protein <strong>{multiResult.total_protein_g}g</strong></span>
                <span>Carbs <strong>{multiResult.total_carbs_g}g</strong></span>
                <span>Fat <strong>{multiResult.total_fat_g}g</strong></span>
              </div>
            </div>
            <button
              onClick={() => setMultiResult(null)}
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
              {meals.map((meal) => {
                const badge = sourceBadge(meal.source)
                const shortLabel =
                  meal.source === 'local_db' ? 'DB'
                  : meal.source === 'ai_photo_estimate' ? 'Photo'
                  : meal.source === 'multi_item' ? 'Multi'
                  : 'AI'
                return (
                  <li key={meal.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${badge.cls}`}>
                        {shortLabel}
                      </span>
                      <span className="truncate text-gray-800">{meal.name ?? meal.description}</span>
                    </div>
                    <span className="ml-3 shrink-0 font-medium text-gray-900">{meal.calories} kcal</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </main>
  )
}
