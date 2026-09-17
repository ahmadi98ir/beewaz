'use client'

import { Component, type ReactNode } from 'react'

interface BeeErrorBoundaryProps {
  children: ReactNode
  onError: () => void
}

interface BeeErrorBoundaryState {
  hasError: boolean
}

/**
 * Catches any render/initialization error thrown by the Bee 3D scene subtree
 * (e.g. WebGL context creation failure). Renders nothing on error — the
 * always-mounted static `BeeFallback` (a sibling, not a child of this
 * boundary) is snapped back to full opacity by the parent's `onError`
 * handler. No retry is attempted.
 */
export class BeeErrorBoundary extends Component<BeeErrorBoundaryProps, BeeErrorBoundaryState> {
  state: BeeErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): BeeErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    this.props.onError()
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[Bee] scene initialization failed, falling back to static bee visual', error)
    }
  }

  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}
