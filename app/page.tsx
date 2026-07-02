'use client'

import { useState, useTransition, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { logout } from '@/app/actions/auth'
import { logMeal, getTodayMeals, type LogMealResult, type TodayMeal } from '@/app/actions/log-meal'
import { logMealFromPhoto } from '@/app/actions/log-meal-photo'
import { logMealMulti, type MultiLogResult } from '@/app/actions/log-meal-multi'
import { lookupBarcode, logBarcodeProduct, type BarcodeProduct } from '@/app/actions/barcode-lookup'
import { deleteMeal, updateMeal } from '@/app/actions/meal-edit'
import { getHomeData, type Goal } from '@/app/actions/dashboard'
import BarcodeScannerErrorBoundary from '@/app/components/BarcodeScannerErrorBoundary'
import GreetingHeader from '@/app/components/GreetingHeader'
import HeroCard from '@/app/components/HeroCard'
import MacroCards from '@/app/components/MacroCards'
import BottomNav from '@/app/components/BottomNav'
import Toast from '@/app/components/Toast'

const BarcodeScanner = dynamic(() => import('@/app/components/BarcodeScanner'), { ssr: false })

function sourceBadge(source: string) {
  if (source === 'local_db')          return { label: 'Database',    cls: 'bg-chip-lime text-green' }
  if (source === 'ai_photo_estimate') return { label: 'Photo',       cls: 'bg-chip-lavender text-ink' }
  if (source === 'multi_item')        return { label: 'Multi-item',  cls: 'bg-chip-sky text-ink' }
  if (source === 'barcode_scan')      return { label: 'Barcode',     cls: 'bg-chip-peach text-ink' }
  return                                     { label: 'AI estimate', cls: 'bg-bg text-sub' }
}

const EMOJI_RULES: [RegExp, string][] = [
  [/soup|broth|steamboat|hotpot/i, '🍲'],
  [/noodle|mee|laksa|beehoon|pasta|ramen/i, '🍜'],
  [/rice|nasi|biryani/i, '🍚'],
  [/chicken|duck|turkey/i, '🍗'],
  [/beef|steak|pork|lamb|mutton/i, '🥩'],
  [/fish|salmon|tuna|seafood|prawn|shrimp|crab/i, '🐟'],
  [/salad|vegetable|veggie|greens/i, '🥗'],
  [/egg/i, '🍳'],
  [/bread|toast|sandwich|burger/i, '🥪'],
  [/fruit|apple|banana|orange|mango/i, '🍎'],
  [/coffee|tea|latte|milo/i, '☕'],
  [/cake|cookie|dessert|ice cream|chocolate/i, '🍰'],
]

function mealEmoji(name: string): string {
  for (const [re, emoji] of EMOJI_RULES) {
    if (re.test(name)) return emoji
  }
  return '🍽️'
}

const CHIP_CLASSES = ['bg-chip-peach', 'bg-chip-sky', 'bg-chip-lavender', 'bg-chip-lime']

function chipClass(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return CHIP_CLASSES[Math.abs(h) % CHIP_CLASSES.length]
}

function sgtParts(iso: string): { hour: number; hhmm: string } {
  const sgt = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000)
  const hour = sgt.getUTCHours()
  const mins = String(sgt.getUTCMinutes()).padStart(2, '0')
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return { hour, hhmm: `${h12}:${mins} ${hour < 12 ? 'am' : 'pm'}` }
}

function mealTypeLabel(iso: string): string {
  const { hour } = sgtParts(iso)
  if (hour < 11) return 'Breakfast'
  if (hour < 15) return 'Lunch'
  if (hour < 17) return 'Snack'
  if (hour < 22) return 'Dinner'
  return 'Supper'
}

const MODE_META = {
  type:  { label: 'Type', icon: '⌨️' },
  snap:  { label: 'Snap', icon: '📷' },
  multi: { label: 'Multi', icon: '🍱' },
  scan:  { label: 'Scan', icon: '📊' },
} as const

type Mode = keyof typeof MODE_META

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
  const [cameraError, setCameraError] = useState<string | null>(null)

  // Shared
  const [result, setResult] = useState<LogMealResult | null>(null)
  const [resultPhotoUrl, setResultPhotoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [meals, setMeals] = useState<TodayMeal[]>([])
  const [goal, setGoal] = useState<Goal | null>(null)
  const [coachLine, setCoachLine] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Edit/delete state
  const [deletingMealId, setDeletingMealId] = useState<string | null>(null)
  const [editingMealId, setEditingMealId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{ calories: number; protein_g: number; carbs_g: number; fat_g: number } | null>(null)

  useEffect(() => {
    getTodayMeals().then(setMeals)
    getHomeData().then((d) => { setGoal(d.goal); setCoachLine(d.coachLine) })
  }, [])

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    }
  }, [photoPreviewUrl])

  const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0)
  const totalProtein  = meals.reduce((sum, m) => sum + Number(m.protein_g), 0)
  const totalCarbs    = meals.reduce((sum, m) => sum + Number(m.carbs_g), 0)
  const totalFat      = meals.reduce((sum, m) => sum + Number(m.fat_g), 0)

  const showLogToast = useCallback((newMeals: TodayMeal[]) => {
    const total = newMeals.reduce((s, m) => s + m.calories, 0)
    const target = goal?.calorie_target ?? 0
    setToast(
      target > 0 && total <= target
        ? `Logged! ${(target - total).toLocaleString()} kcal to go`
        : 'Logged!',
    )
  }, [goal])

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setResult(null)
    setResultPhotoUrl(null)
    setMultiResult(null)
    setScannedProduct(null)
    setBarcodeQuantity(1)
    setCameraError(null)
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
        const fresh = await getTodayMeals()
        setMeals(fresh)
        showLogToast(fresh)
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
      const fresh = await getTodayMeals()
      setMeals(fresh)
      showLogToast(fresh)
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
      const fresh = await getTodayMeals()
      setMeals(fresh)
      showLogToast(fresh)
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
      const fresh = await getTodayMeals()
      setMeals(fresh)
      showLogToast(fresh)
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
      setToast('Saved')
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const r = await deleteMeal(id)
      if (!r.ok) { setError(r.error); return }
      setDeletingMealId(null)
      setMeals(await getTodayMeals())
      setToast('Entry deleted')
    })
  }

  const inputCls = 'flex-1 rounded-field bg-bg px-4 py-2.5 text-sm font-medium outline-none placeholder:text-sub focus:ring-2 focus:ring-lime disabled:opacity-50'
  const primaryBtnCls = 'rounded-field bg-lime px-5 py-2.5 text-sm font-bold text-ink hover:bg-lime-deep disabled:opacity-50 transition-colors'
  const ghostBtnCls = 'rounded-field bg-bg px-4 py-2.5 text-sm font-semibold text-sub hover:text-ink disabled:opacity-50 transition-colors'

  return (
    <main className="min-h-screen bg-bg p-4">
      <div className="mx-auto max-w-lg space-y-4">

        <GreetingHeader />

        {/* Hero */}
        <HeroCard
          consumed={totalCalories}
          goal={goal?.calorie_target ?? 0}
          proteinNow={totalProtein}
          proteinTarget={goal?.protein_target ?? 0}
          coachLine={coachLine}
        />

        {/* Macro cards */}
        <MacroCards
          protein={totalProtein} carbs={totalCarbs} fat={totalFat}
          proteinTarget={goal?.protein_target ?? 0}
          carbTarget={goal?.carb_target ?? 0}
          fatTarget={goal?.fat_target ?? 0}
        />

        {/* Log card */}
        <div className="rounded-card bg-white p-5 shadow-card">
          {/* Mode chips */}
          <div className="mb-4 flex gap-2">
            {(Object.keys(MODE_META) as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-pill py-2 text-[13px] font-semibold transition-colors ${
                  mode === m ? 'bg-ink text-white' : 'bg-bg text-sub hover:text-ink'
                }`}
              >
                <span className="text-sm leading-none">{MODE_META[m].icon}</span>
                {MODE_META[m].label}
              </button>
            ))}
          </div>

          {/* ── Type ── */}
          {mode === 'type' && (
            <>
              <h2 className="mb-3 text-sm font-semibold text-ink">What did you eat?</h2>
              <form onSubmit={handleTextSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="e.g. 1 plate of chicken rice"
                  disabled={isPending}
                  className={inputCls}
                />
                <button type="submit" disabled={isPending || !input.trim()} className={primaryBtnCls}>
                  {isPending ? 'Logging…' : 'Log'}
                </button>
              </form>
            </>
          )}

          {/* ── Snap ── */}
          {mode === 'snap' && (
            <>
              <h2 className="mb-3 text-sm font-semibold text-ink">Take or upload a photo of your meal</h2>
              <form onSubmit={handlePhotoSubmit} className="space-y-3">
                {photoPreviewUrl ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreviewUrl} alt="Meal preview" className="h-48 w-full rounded-field object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(photoPreviewUrl)
                        setPhotoFile(null)
                        setPhotoPreviewUrl(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      className="absolute right-2 top-2 rounded-pill bg-ink/60 px-3 py-1 text-xs font-semibold text-white hover:bg-ink/80"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <label className="flex h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-field bg-bg text-sub hover:text-ink">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm font-medium">Tap to take or choose a photo</span>
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
                      placeholder='Add details (optional) — e.g. "large portion", "no rice"'
                      rows={2}
                      disabled={isPending}
                      className="w-full resize-none rounded-field bg-bg px-4 py-2.5 text-sm font-medium outline-none placeholder:text-sub focus:ring-2 focus:ring-lime disabled:opacity-50"
                    />
                    <button type="submit" disabled={isPending} className={`w-full ${primaryBtnCls}`}>
                      {isPending ? 'Identifying…' : 'Log this meal'}
                    </button>
                  </>
                )}
              </form>
            </>
          )}

          {/* ── Multi ── */}
          {mode === 'multi' && (
            <>
              <h2 className="mb-3 text-sm font-semibold text-ink">List each part of your meal</h2>
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
                      className={inputCls}
                    />
                    {multiItems.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setMultiItems(multiItems.filter((_, i) => i !== idx))}
                        disabled={isPending}
                        className="shrink-0 rounded-field bg-bg px-3.5 py-2.5 text-sm text-sub hover:text-ink disabled:opacity-50"
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
                  className="mt-1 text-sm font-semibold text-green hover:text-ink disabled:opacity-40"
                >
                  + Add another item
                </button>
                <button type="submit" disabled={isPending || !hasMultiInput} className={`w-full ${primaryBtnCls}`}>
                  {isPending ? 'Estimating…' : 'Log meal'}
                </button>
              </form>
            </>
          )}

          {/* ── Scan ── */}
          {mode === 'scan' && (
            <>
              <h2 className="mb-3 text-sm font-semibold text-ink">Scan a product barcode</h2>
              {scannedProduct ? (
                <div className="space-y-4">
                  <div className="rounded-field bg-bg p-4">
                    <p className="font-semibold text-ink">{scannedProduct.name}</p>
                    <p className="mt-1 text-xs text-sub">{scannedProduct.serving_description} per serving</p>
                    <div className="tnum mt-2 flex gap-3 text-sm font-medium text-sub">
                      <span className="text-ink">{scannedProduct.calories_per_serving} kcal</span>
                      <span>P {scannedProduct.protein_per_serving}g</span>
                      <span>C {scannedProduct.carbs_per_serving}g</span>
                      <span>F {scannedProduct.fat_per_serving}g</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-ink">Servings:</label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={barcodeQuantity}
                      onChange={(e) => setBarcodeQuantity(Math.max(0.1, parseFloat(e.target.value) || 1))}
                      className="tnum w-24 rounded-field bg-bg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-lime"
                    />
                    <span className="tnum text-sm font-medium text-sub">
                      = {Math.round(scannedProduct.calories_per_serving * barcodeQuantity)} kcal
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleLogBarcode} disabled={isPending} className={`flex-1 ${primaryBtnCls}`}>
                      {isPending ? 'Logging…' : 'Log meal'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setScannedProduct(null); setCameraError(null) }}
                      disabled={isPending}
                      className={ghostBtnCls}
                    >
                      Scan another
                    </button>
                  </div>
                </div>
              ) : cameraError ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-coral">{cameraError}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setCameraError(null)} className={ghostBtnCls}>
                      Try again
                    </button>
                    <button type="button" onClick={() => switchMode('type')} className={ghostBtnCls}>
                      Type it instead
                    </button>
                  </div>
                </div>
              ) : (
                <BarcodeScannerErrorBoundary onFallback={() => switchMode('type')}>
                  <BarcodeScanner
                    onScan={handleBarcodeScan}
                    onCancel={() => switchMode('type')}
                    onError={setCameraError}
                  />
                </BarcodeScannerErrorBoundary>
              )}
            </>
          )}

          {error && <p className="mt-3 text-sm font-medium text-coral">{error}</p>}
        </div>

        {/* Single-item confirmation card */}
        {result && (
          <div className="anim-pop-in rounded-card bg-white p-5 shadow-card ring-2 ring-lime">
            {resultPhotoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resultPhotoUrl} alt="Logged meal" className="mb-3 h-36 w-full rounded-field object-cover" />
            )}
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="font-bold text-ink">{result.name}</p>
                <p className="text-xs text-sub">{result.serving_description}</p>
              </div>
              <span className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${sourceBadge(result.source).cls}`}>
                {sourceBadge(result.source).label}
              </span>
            </div>
            <p className="tnum mb-2 text-3xl font-extrabold text-ink">
              {result.calories} <span className="text-base font-medium text-sub">kcal</span>
            </p>
            <div className="tnum flex gap-4 text-sm font-medium text-sub">
              <span>Protein <strong className="text-ink">{result.protein_g}g</strong></span>
              <span>Carbs <strong className="text-ink">{result.carbs_g}g</strong></span>
              <span>Fat <strong className="text-ink">{result.fat_g}g</strong></span>
            </div>
            <button
              onClick={() => { setResult(null); setResultPhotoUrl(null) }}
              className="mt-3 text-xs font-semibold text-green underline underline-offset-2 hover:text-ink"
            >
              Log another
            </button>
          </div>
        )}

        {/* Multi-item confirmation card */}
        {multiResult && (
          <div className="anim-pop-in rounded-card bg-white p-5 shadow-card ring-2 ring-lime">
            <p className="mb-3 text-sm font-semibold text-ink">Meal logged — {multiResult.items.length} items</p>
            <ul className="space-y-2">
              {multiResult.items.map((item, idx) => (
                <li key={idx} className="rounded-field bg-bg px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{item.name}</p>
                      <p className="text-xs text-sub">{item.input}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tnum text-sm font-bold text-ink">{item.calories} kcal</p>
                      <span className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${sourceBadge(item.source).cls}`}>
                        {sourceBadge(item.source).label}
                      </span>
                    </div>
                  </div>
                  <p className="tnum mt-1 text-xs text-sub">
                    P {item.protein_g}g · C {item.carbs_g}g · F {item.fat_g}g
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-bg pt-3">
              <p className="tnum text-3xl font-extrabold text-ink">
                {multiResult.total_calories} <span className="text-base font-medium text-sub">kcal total</span>
              </p>
              <div className="tnum mt-1 flex gap-4 text-sm font-medium text-sub">
                <span>Protein <strong className="text-ink">{multiResult.total_protein_g}g</strong></span>
                <span>Carbs <strong className="text-ink">{multiResult.total_carbs_g}g</strong></span>
                <span>Fat <strong className="text-ink">{multiResult.total_fat_g}g</strong></span>
              </div>
            </div>
            <button
              onClick={() => setMultiResult(null)}
              className="mt-3 text-xs font-semibold text-green underline underline-offset-2 hover:text-ink"
            >
              Log another
            </button>
          </div>
        )}

        {/* Today's meals */}
        {meals.length > 0 && (
          <div className="rounded-card bg-white p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Today</h2>
              <span className="tnum text-sm font-bold text-ink">{totalCalories.toLocaleString()} kcal</span>
            </div>
            <ul className="space-y-2">
              {meals.map((meal) => {
                const displayName = meal.name ?? meal.description

                if (deletingMealId === meal.id) {
                  return (
                    <li key={meal.id} className="rounded-field bg-chip-peach/40 px-4 py-3 text-sm">
                      <p className="mb-2 font-semibold text-ink">Delete this entry?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDelete(meal.id)}
                          disabled={isPending}
                          className="rounded-pill bg-ink px-4 py-1.5 text-xs font-bold text-white hover:bg-ink/80 disabled:opacity-50"
                        >
                          Yes, delete
                        </button>
                        <button
                          onClick={() => setDeletingMealId(null)}
                          disabled={isPending}
                          className="rounded-pill bg-white px-4 py-1.5 text-xs font-semibold text-sub hover:text-ink disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </li>
                  )
                }

                if (editingMealId === meal.id && editDraft) {
                  return (
                    <li key={meal.id} className="space-y-2 rounded-field bg-chip-sky/40 px-4 py-3 text-sm">
                      <p className="truncate text-xs font-semibold text-ink">{displayName}</p>
                      <div className="grid grid-cols-4 gap-2">
                        {(['calories', 'protein_g', 'carbs_g', 'fat_g'] as const).map((field) => (
                          <div key={field} className="flex flex-col gap-0.5">
                            <label className="text-xs text-sub">
                              {field === 'calories' ? 'kcal' : field === 'protein_g' ? 'Protein' : field === 'carbs_g' ? 'Carbs' : 'Fat'}
                            </label>
                            <input
                              type="number"
                              min="0"
                              step={field === 'calories' ? '1' : '0.1'}
                              value={editDraft[field]}
                              onChange={(e) => setEditDraft({ ...editDraft, [field]: parseFloat(e.target.value) || 0 })}
                              className="tnum w-full rounded-lg bg-white px-2 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-lime"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveEdit(meal.id)}
                          disabled={isPending}
                          className="rounded-pill bg-ink px-4 py-1.5 text-xs font-bold text-white hover:bg-ink/80 disabled:opacity-50"
                        >
                          Save changes
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={isPending}
                          className="rounded-pill bg-white px-4 py-1.5 text-xs font-semibold text-sub hover:text-ink disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </li>
                  )
                }

                return (
                  <li key={meal.id} className="anim-pop-in flex items-center gap-3 rounded-field bg-bg px-3 py-2.5">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-field text-lg ${chipClass(meal.id)}`}>
                      {mealEmoji(displayName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{displayName}</p>
                      <p className="text-xs text-sub">
                        {mealTypeLabel(meal.logged_at)} · {sgtParts(meal.logged_at).hhmm}
                      </p>
                    </div>
                    <span className="tnum shrink-0 text-sm font-bold text-ink">{meal.calories} kcal</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => handleStartEdit(meal)}
                        disabled={isPending}
                        title="Edit"
                        className="text-sub hover:text-ink disabled:opacity-40"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.586l-3 .75.75-3a4 4 0 01.586-1.414z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => { setDeletingMealId(meal.id); setEditingMealId(null) }}
                        disabled={isPending}
                        title="Delete"
                        className="text-sub hover:text-coral disabled:opacity-40"
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

        {/* Log out (kept accessible, quiet) */}
        <form action={logout} className="pb-2 text-center">
          <button type="submit" className="text-xs font-medium text-sub underline underline-offset-2 hover:text-ink">
            Log out
          </button>
        </form>

        <BottomNav />
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </main>
  )
}
