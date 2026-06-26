'use client'

import { useEffect, useRef } from 'react'

interface Props {
  onScan: (barcode: string) => void
  onCancel: () => void
}

export default function BarcodeScanner({ onScan, onCancel }: Props) {
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    let started = false

    async function startScanner() {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (!mountedRef.current) return

      const scanner = new Html5Qrcode('barcode-reader')
      scannerRef.current = scanner

      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText: string) => {
            if (!mountedRef.current) return
            scanner.stop().catch(() => {})
            onScan(decodedText)
          },
          () => {},
        )
        started = true
      } catch {
        // camera permission denied or not available
      }
    }

    startScanner()

    return () => {
      mountedRef.current = false
      if (scannerRef.current && started) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-3">
      <div
        id="barcode-reader"
        className="overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-100"
        style={{ minHeight: 240 }}
      />
      <p className="text-center text-xs text-gray-400">Point your camera at a barcode</p>
      <button
        type="button"
        onClick={onCancel}
        className="w-full rounded-lg border border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-50"
      >
        Cancel
      </button>
    </div>
  )
}
