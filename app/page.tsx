'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { logout } from '@/app/actions/auth'
import { logMeal, getTodayMeals, type LogMealResult, type TodayMeal } from '@/app/actions/log-meal'
import { logMealFromPhoto } from '@/app/actions/log-meal-photo'
import { logMealMulti, type MultiLogResult } from '@/app/actions/log-meal-multi'
import { lookupBarcode, logBarcodeProduct, type BarcodeProduct } from '@/app/actions/barcode-lookup'
import { deleteMeal, updateMeal } from '@/app/actions/meal-edit'

const BarcodeScanner = dynamic(() => import('@/app/components/BarcodeScanner'), { ssr: false })

function sourceBadge(source: string) {
  if (source === 'local_db')          return { label: 'Database',    cls: 'bg-green-100 text-green-700' }
  if (source === 'ai_photo_estimate') return { label: 'Photo',       cls: 'bg-purple-100 text-purple-700' }
  if (source === 'multi_item')        return { label: 'Multi-item',  cls: 'bg-indigo-100 text-indigo-700' }
  if (source === 'barcode_scan')      return { label: 'Barcode',     cls: 'bg-orange-100 text-orange-700' }
  return                                     { label: 'AI estimate', cls: 'bg-blue-100 text-blue-700' }
}

type Mode = 'type' | 'snap' | 'multi' | 'scan'

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

  // Scan mode
  const [scannedProduct, setScannedProduct] = useState<BarcodeProduct | null>(null)
  const [barcodeQuantity, setBarcodeQuantity] = useState(1)

  // Shared
  const [result, setResult] = useState<LogMealResult | null>(null)
  const [resultPhotoUrl, setResultPhotoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [meals, setMeals] = useState<TodayMeal[]>([])
  const [isPending, startTransition] = useTransition()

  // Edit/delete state
  const [deletingMealId, setDeletingMealId] = useState<string | null>(null)
  const [editingMealId, setEditingMealId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{ calories: number; protein_g: number; carbs_g: number; fat_g: number } | null>(null)

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
    setScannedProduct(null)
    setBarcodeQuantity(1)
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

  function handleBarcodeScan(code: string) {
    setError(null)
    startTransition(async () => {
      const r = await lookupBarcode(code)
      if (!r.ok) {
        setError(r.error)
        return
      }
      setScannedProduct(r.product)
      setBarcodeQuantity(1)
    })
  }

  const handleLogBarcode = () => {
    if (!scannedProduct) return
    setError(null)
    startTransition(async () => {
      const r = await logBarcodeProduct(scannedProduct, barcodeQuantity)
      if (!r.ok) {
        setError(r.error)
        return
      }
      setResult({
        name: scannedProduct.name,
        calories: Math.round(scannedProduct.calories_per_serving * barcodeQuantity),
        protein_g: Math.round(scannedProduct.protein_per_serving * barcodeQuantity * 10) / 10,
        carbs_g: Math.round(scannedProduct.carbs_per_serving * barcodeQuantity * 10) / 10,
        fat_g: Math.round(scannedProduct.fat_per_serving * barcodeQuantity * 10) / 10,
        serving_description: scannedProduct.serving_description,
        source: 'barcode_scan',
        meal_id: r.meal_id,
      })
      setScannedProduct(null)
      setMeals(await getTodayMeals())
    })
  }

  function handleStartEdit(meal: TodayMeal) {
    setEditingMealId(meal.id)
    setEditDraft({ calories: meal.calories, protein_g: meal.protein_g, carbs_g: meal.carbs_g, fat_g: meal.fat_g })
    setDeletingMealId(null)
  }

  function handleCancelEdit() {
    setEditingMealId(null)
    setEditDraft(null)
  }

  function handleSaveEdit(id: string) {
    if (!editDraft) return
    startTransition(async () => {
      const r = await updateMeal(id, editDraft.calories, editDraft.protein_g, editDraft.carbs_g, editDraft.fat_g)
      if (!r.ok) { setError(r.error); return }
      setEditingMealId(null)
      setEditDraft(null)
      setMeals(await getTodayMeals())
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const r = await deleteMeal(id)
      if (!r.ok) { setError(r.error); return }
      setDeletingMealId(null)
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
            {(['type', 'snap', 'multi', 'scan'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                  mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {m === 'type' ? 'Type it' : m === 'snap' ? 'Snap it' : m === 'multi' ? 'Multiple' : 'Scan'}
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

          {/* ── Scan barcode ── */}
          {mode === 'scan' && (
            <>
              <h2 className="mb-3 text-sm font-medium text-gray-700">Scan a product barcode</h2>
              {scannedProduct ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-gray-50 p-4">
                    <p className="font-medium text-gray-900">{scannedProduct.name}</p>
                    <p className="mt-1 text-xs text-gray-500">{scannedProduct.serving_description} per serving</p>
                    <div className="mt-2 flex gap-3 text-sm text-gray-600">
                      <span>{scannedProduct.calories_per_serving} kcal</span>
                      <span>P {scannedProduct.protein_per_serving}g</span>
                      <span>C {scannedProduct.carbs_per_serving}g</span>
                      <span>F {scannedProduct.fat_per_serving}g</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-700">Servings:</label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={barcodeQuantity}
                      onChange={(e) => setBarcodeQuantity(Math.max(0.1, parseFloat(e.target.value) || 1))}
                      className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
                    />
                    <span className="text-sm text-gray-500">
                      = {Math.round(scannedProduct.calories_per_serving * barcodeQuantity)} kcal
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleLogBarcode}
                      disabled={isPending}
                      className="flex-1 rounded-lg bg-gray-900 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                    >
                      {isPending ? 'Logging…' : 'Log meal'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setScannedProduct(null)}
                      disabled={isPending}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Scan another
                    </button>
                  </div>
                </div>
              ) : (
                <BarcodeScanner onScan={handleBarcodeScan} onCancel={() => switchMode('type')} />
              )}
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
                  : meal.source === 'barcode_scan' ? 'Scan'
                  : 'AI'

                if (deletingMealId === meal.id) {
                  return (
                    <li key={meal.id} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm">
                      <p className="mb-2 text-red-700">Delete this entry?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDelete(meal.id)}
                          disabled={isPending}
                          className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Yes, delete
                        </button>
                        <button
                          onClick={() => setDeletingMealId(null)}
                          disabled={isPending}
                          className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </li>
                  )
                }

                if (editingMealId === meal.id && editDraft) {
                  return (
                    <li key={meal.id} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-sm space-y-2">
                      <p className="text-xs font-medium text-gray-700 truncate">{meal.name ?? meal.description}</p>
                      <div className="grid grid-cols-4 gap-2">
                        {(['calories', 'protein_g', 'carbs_g', 'fat_g'] as const).map((field) => (
                          <div key={field} className="flex flex-col gap-0.5">
                            <label className="text-xs text-gray-500">
                              {field === 'calories' ? 'kcal' : field === 'protein_g' ? 'Protein' : field === 'carbs_g' ? 'Carbs' : 'Fat'}
                            </label>
                            <input
                              type="number"
                              min="0"
                              step={field === 'calories' ? '1' : '0.1'}
                              value={editDraft[field]}
                              onChange={(e) => setEditDraft({ ...editDraft, [field]: parseFloat(e.target.value) || 0 })}
                              className="w-full rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-gray-500"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveEdit(meal.id)}
                          disabled={isPending}
                          className="rounded-md bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={isPending}
                          className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </li>
                  )
                }

                return (
                  <li key={meal.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${badge.cls}`}>
                        {shortLabel}
                      </span>
                      <span className="truncate text-gray-800">{meal.name ?? meal.description}</span>
                    </div>
                    <div className="ml-3 flex shrink-0 items-center gap-2">
                      <span className="font-medium text-gray-900">{meal.calories} kcal</span>
                      <button
                        onClick={() => handleStartEdit(meal)}
                        disabled={isPending}
                        title="Edit"
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-40"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.586l-3 .75.75-3a4 4 0 01.586-1.414z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => { setDeletingMealId(meal.id); setEditingMealId(null) }}
                        disabled={isPending}
                        title="Delete"
                        className="text-gray-400 hover:text-red-500 disabled:opacity-40"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
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
