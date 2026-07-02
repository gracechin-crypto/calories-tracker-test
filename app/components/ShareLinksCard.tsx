'use client'

import { useEffect, useState, useTransition } from 'react'
import { listShareLinks, createShareLink, revokeShareLink, type ShareLink } from '@/app/actions/share-links'

export default function ShareLinksCard() {
  const [links, setLinks] = useState<ShareLink[]>([])
  const [expiry, setExpiry] = useState<string>('never')
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    listShareLinks().then((r) => {
      if (r.ok) setLinks(r.links)
      setLoaded(true)
    })
  }, [])

  function shareUrl(token: string): string {
    return `${window.location.origin}/share/${token}`
  }

  function handleCreate() {
    setError(null)
    startTransition(async () => {
      const days = expiry === 'never' ? null : Number(expiry)
      const r = await createShareLink(days)
      if (!r.ok) { setError(r.error); return }
      setLinks((prev) => [r.link, ...prev])
    })
  }

  function handleRevoke(id: string) {
    setError(null)
    startTransition(async () => {
      const r = await revokeShareLink(id)
      if (!r.ok) { setError(r.error); return }
      setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, revoked: true } : l)))
    })
  }

  async function handleCopy(link: ShareLink) {
    await navigator.clipboard.writeText(shareUrl(link.token))
    setCopiedId(link.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  function linkState(l: ShareLink): { label: string; cls: string } {
    if (l.revoked) return { label: 'Revoked', cls: 'bg-bg text-sub' }
    if (l.expires_at && new Date(l.expires_at).getTime() < Date.now())
      return { label: 'Expired', cls: 'bg-chip-peach text-ink' }
    return { label: 'Active', cls: 'bg-chip-lime text-green' }
  }

  return (
    <div className="rounded-card bg-white p-5 shadow-card">
      <h2 className="mb-1 text-sm font-semibold text-ink">Share with your trainer</h2>
      <p className="mb-4 text-xs font-medium text-sub">
        Anyone with the link sees a read-only view of your intake — no login needed, no editing possible.
      </p>

      <div className="mb-4 flex items-center gap-2">
        <select
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          disabled={isPending}
          className="rounded-field bg-bg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-lime"
        >
          <option value="never">No expiry</option>
          <option value="7">Expires in 7 days</option>
          <option value="30">Expires in 30 days</option>
          <option value="90">Expires in 90 days</option>
        </select>
        <button
          type="button"
          onClick={handleCreate}
          disabled={isPending}
          className="rounded-field bg-lime px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-lime-deep disabled:opacity-50"
        >
          {isPending ? 'Creating…' : 'Create link'}
        </button>
      </div>

      {error && <p className="mb-3 text-sm font-medium text-coral">{error}</p>}

      {!loaded ? (
        <div className="h-10 animate-pulse rounded-field bg-bg" />
      ) : links.length === 0 ? (
        <p className="text-sm font-medium text-sub">No links yet.</p>
      ) : (
        <ul className="space-y-2">
          {links.map((link) => {
            const state = linkState(link)
            return (
              <li key={link.id} className="flex items-center gap-2 rounded-field bg-bg px-3.5 py-2.5">
                <span className={`shrink-0 rounded-pill px-2.5 py-0.5 text-xs font-bold ${state.cls}`}>
                  {state.label}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-sub">
                  /share/{link.token.slice(0, 8)}…
                  {link.expires_at && !link.revoked && (
                    <> · until {new Date(link.expires_at).toLocaleDateString()}</>
                  )}
                </span>
                {!link.revoked && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleCopy(link)}
                      className="shrink-0 text-xs font-semibold text-green hover:text-ink"
                    >
                      {copiedId === link.id ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRevoke(link.id)}
                      disabled={isPending}
                      className="shrink-0 text-xs font-semibold text-coral hover:text-ink disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
