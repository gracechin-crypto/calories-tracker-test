'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getProfile, saveProfile } from '@/app/actions/profile'
import GreetingHeader from '@/app/components/GreetingHeader'
import BottomNav from '@/app/components/BottomNav'
import Toast from '@/app/components/Toast'
import ShareLinksCard from '@/app/components/ShareLinksCard'

// Center-crop to square and resize to 256px, output JPEG blob
async function resizeToSquare(file: File, size = 256): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Could not read that image'))
      el.src = url
    })
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const sx = (img.naturalWidth - side) / 2
    const sy = (img.naturalHeight - side) / 2
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process image'))), 'image/jpeg', 0.88),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function SettingsPage() {
  const [firstName, setFirstName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getProfile().then((p) => {
      setFirstName(p.first_name ?? 'Grace')
      setAvatarUrl(p.avatar_url)
      setLoaded(true)
    })
  }, [])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    try {
      const blob = await resizeToSquare(file)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPendingBlob(blob)
      setPreviewUrl(URL.createObjectURL(blob))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that image')
    }
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      let newAvatarUrl = avatarUrl

      if (pendingBlob) {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setError('Not signed in'); return }

        const path = `${user.id}/avatar.jpg`
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, pendingBlob, { upsert: true, contentType: 'image/jpeg' })
        if (upErr) { setError(upErr.message); return }

        const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
        // Cache-bust so the header picks up the new photo immediately
        newAvatarUrl = `${pub.publicUrl}?v=${Date.now()}`
      }

      const r = await saveProfile(firstName, newAvatarUrl)
      if (!r.ok) { setError(r.error); return }

      setAvatarUrl(newAvatarUrl)
      setPendingBlob(null)
      if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null) }
      if (fileRef.current) fileRef.current.value = ''
      setToast('Saved')
    })
  }

  const shownAvatar = previewUrl ?? avatarUrl

  return (
    <main className="min-h-screen bg-bg p-4">
      <div className="mx-auto max-w-lg space-y-4">
        <GreetingHeader name={firstName || 'Grace'} avatarUrl={avatarUrl} />

        <div className="rounded-card bg-white p-5 shadow-card">
          <h2 className="mb-4 text-sm font-semibold text-ink">Profile</h2>

          {!loaded ? (
            <div className="h-24 animate-pulse rounded-field bg-bg" />
          ) : (
            <div className="space-y-5">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                {shownAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shownAvatar} alt="Your avatar" className="h-20 w-20 rounded-pill object-cover shadow-card" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-pill bg-lime text-2xl font-bold text-ink shadow-card">
                    {(firstName || 'G').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={isPending}
                    className="rounded-field bg-bg px-4 py-2 text-sm font-semibold text-ink hover:bg-lime-soft disabled:opacity-50"
                  >
                    Choose photo
                  </button>
                  <p className="mt-1.5 text-xs font-medium text-sub">Square crop, resized to 256px</p>
                  <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={handleFile} />
                </div>
              </div>

              {/* First name */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="first-name" className="text-sm font-semibold text-ink">First name</label>
                <input
                  id="first-name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={isPending}
                  className="rounded-field bg-bg px-4 py-2.5 text-sm font-medium outline-none placeholder:text-sub focus:ring-2 focus:ring-lime disabled:opacity-50"
                />
              </div>

              {error && <p className="text-sm font-medium text-coral">{error}</p>}

              <button
                type="button"
                onClick={handleSave}
                disabled={isPending || (!pendingBlob && !firstName.trim())}
                className="rounded-field bg-lime px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-lime-deep disabled:opacity-50"
              >
                {isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}
        </div>

        <ShareLinksCard />

        <BottomNav />
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </main>
  )
}
