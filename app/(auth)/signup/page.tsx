'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const inputCls = 'rounded-field bg-bg px-4 py-2.5 text-sm font-medium outline-none placeholder:text-sub focus:ring-2 focus:ring-lime'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="w-full max-w-sm rounded-card bg-white p-8 text-center shadow-card">
        <p className="mb-2 text-3xl">📬</p>
        <h1 className="mb-2 text-2xl font-extrabold tracking-tight text-ink">Check your email</h1>
        <p className="text-sm font-medium text-sub">
          We sent a confirmation link to <span className="font-bold text-ink">{email}</span>.
          Click it to activate your account, then{' '}
          <Link href="/login" className="font-bold text-green underline underline-offset-2 hover:text-ink">
            log in
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm rounded-card bg-white p-8 shadow-card">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Create your account</h1>
      <p className="mb-6 mt-1 text-sm font-medium text-sub">Start tracking in under a minute</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-semibold text-ink">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-semibold text-ink">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />
        </div>
        {error && <p className="text-sm font-medium text-coral">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-field bg-lime px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-lime-deep disabled:opacity-50"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm font-medium text-sub">
        Already have an account?{' '}
        <Link href="/login" className="font-bold text-green underline underline-offset-2 hover:text-ink">
          Log in
        </Link>
      </p>
    </div>
  )
}
