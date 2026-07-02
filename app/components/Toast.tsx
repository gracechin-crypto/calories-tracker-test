'use client'

import { useEffect } from 'react'

interface Props {
  message: string
  onDone: () => void
}

export default function Toast({ message, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="anim-toast fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-pill bg-ink px-5 py-2.5 text-sm font-semibold text-white shadow-nav md:bottom-8">
      {message}
    </div>
  )
}
