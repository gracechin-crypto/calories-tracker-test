'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  onFallback: () => void
}

interface State {
  crashed: boolean
}

export default class BarcodeScannerErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false }

  static getDerivedStateFromError(): State {
    return { crashed: true }
  }

  componentDidCatch(err: Error) {
    console.error('[BarcodeScanner] uncaught exception:', err)
  }

  render() {
    if (this.state.crashed) {
      return (
        <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>Camera access issue. Please try again or use manual entry.</p>
          <div className="flex gap-2">
            <button
              onClick={() => this.setState({ crashed: false })}
              className="rounded-md border border-red-300 px-3 py-1 text-xs hover:bg-red-100"
            >
              Try again
            </button>
            <button
              onClick={() => { this.setState({ crashed: false }); this.props.onFallback() }}
              className="rounded-md border border-red-300 px-3 py-1 text-xs hover:bg-red-100"
            >
              Use manual entry
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
