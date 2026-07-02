'use client'

import { useState } from 'react'
import { getOrGenerateCoachingNotes } from '@/app/actions/coaching'

interface Props {
  initialContent: string | null
  daysWithData: number
}

export default function CoachCard({ initialContent, daysWithData }: Props) {
  const [content, setContent] = useState(initialContent)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate(forceRefresh: boolean) {
    setLoading(true)
    setError(null)
    const result = await getOrGenerateCoachingNotes(forceRefresh)
    setLoading(false)
    if (result.ok) {
      setContent(result.content)
    } else if (result.error !== 'not_enough_data') {
      setError(result.error)
    }
  }

  return (
    <div className="rounded-card bg-white p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Coach&apos;s notes</h2>
        {daysWithData >= 2 && (
          <button
            onClick={() => handleGenerate(!!content)}
            disabled={loading}
            className="text-xs font-semibold text-green hover:text-ink disabled:opacity-40"
          >
            {loading ? (
              <span className="flex items-center gap-1">
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Generating…
              </span>
            ) : content ? 'Refresh' : 'Generate'}
          </button>
        )}
      </div>

      {daysWithData < 2 ? (
        <p className="text-sm font-medium text-sub">
          Log a few more meals to get personalised coaching notes. Come back once you&apos;ve tracked at least 2 days.
        </p>
      ) : content ? (
        <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-ink">{content}</p>
      ) : error ? (
        <p className="text-sm font-medium text-coral">{error}</p>
      ) : (
        <p className="text-sm font-medium text-sub">
          Tap &ldquo;Generate&rdquo; above to get personalised observations about your eating patterns.
        </p>
      )}
    </div>
  )
}
