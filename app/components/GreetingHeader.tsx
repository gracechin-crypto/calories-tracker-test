'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Props {
  name?: string
  avatarUrl?: string | null
}

function greeting(): string {
  // SGT = UTC+8
  const hour = new Date(Date.now() + 8 * 60 * 60 * 1000).getUTCHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
]

export default function GreetingHeader({ name = 'Grace', avatarUrl }: Props) {
  const pathname = usePathname()
  return (
    <div className="flex items-center justify-between pt-4">
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={name}
            className="h-11 w-11 rounded-pill object-cover shadow-card"
          />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-pill bg-lime text-base font-bold text-ink shadow-card">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-xs font-medium text-sub">{greeting()},</p>
          <p className="text-lg font-bold leading-tight text-ink">{name}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Desktop top nav */}
        <nav className="hidden items-center gap-1 rounded-pill bg-white p-1 shadow-card md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-pill px-4 py-1.5 text-sm font-semibold transition-colors ${
                pathname === item.href ? 'bg-ink text-white' : 'text-sub hover:text-ink'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      <button
        type="button"
        aria-label="Notifications"
        className="flex h-10 w-10 items-center justify-center rounded-pill bg-white text-sub shadow-card hover:text-ink"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .53-.21 1.04-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </button>
      </div>
    </div>
  )
}
