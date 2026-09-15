'use client'

import { Component, type ReactNode } from 'react'

interface Hero3DErrorBoundaryProps {
  children: ReactNode
  onError: () => void
}

interface Hero3DErrorBoundaryState {
  hasError: boolean
}

/**
 * Catches any render/initialization error thrown by the 3D scene subtree
 * (e.g. WebGL context creation failure). Renders nothing on error — the
 * always-mounted static fallback (a sibling, not a child of this boundary)
 * remains the only visible content. No retry is attempted.
 */
export class Hero3DErrorBoundary extends Component<
  Hero3DErrorBoundaryProps,
  Hero3DErrorBoundaryState
> {
  state: Hero3DErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): Hero3DErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    this.props.onError()
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[Hero3D] scene initialization failed, falling back to static hero visual', error)
    }
  }

  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}
