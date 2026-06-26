'use client'

import { useEffect, useRef } from 'react'

interface Props {
  onScan: (barcode: string) => void
  onCancel: () => void
  onError?: (msg: string) => void
}

export default function BarcodeScanner({ onScan, onCancel, onError }: Props) {
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null)
  const mountedRef = useRef(true)
  const startedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true

    async function startScanner() {
      if (!document.getElementById('barcode-reader')) return

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
            try {
              startedRef.current = false
              scanner.stop().catch(() => {})
              onScan(decodedText)
            } catch {
              // onScan errors handled upstream
            }
          },
          () => {
            // per-frame "no QR code found" — normal, ignore
          },
        )
        startedRef.current = true
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const friendly =
          msg.includes('NotAllowed') || msg.includes('Permission')
            ? 'Camera permission denied. Please allow camera access and try again.'
            : msg.includes('NotFound') || msg.includes('Requested device not found')
            ? 'No camera found on this device.'
            : msg.includes('NotReadable') || msg.includes('Could not start video source')
            ? 'Camera is in use by another app. Please close it and try again.'
            : 'Could not start camera. Try again or use manual entry.'
        if (mountedRef.current) {
          if (onError) onError(friendly)
          else onCancel()
        }
      }
    }

    startScanner()

    return () => {
      mountedRef.current = false
      if (scannerRef.current && startedRef.current) {
        startedRef.current = false
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
