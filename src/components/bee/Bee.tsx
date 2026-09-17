'use client'

import { useEffect, useRef, useState, type ComponentType } from 'react'
import { BeeFallback } from './BeeFallback'
import { BeeErrorBoundary } from './BeeErrorBoundary'
import { useBeeChatState } from './BeeChatState'
import { resolveBeeTier, BEE_STATES, type BeeTier, type BeeState } from './bee-config'
import type { BeeSceneProps } from './BeeScene'

// NOTE: no static import of `three` / `@react-three/fiber` / `./BeeScene`
// anywhere in this file. The scene module is loaded exclusively via the
// runtime `import()` call below, and only after the mobile-viewport gate and
// every capability gate passes. This keeps `three`/fiber entirely out of the
// widget's critical bundle for Tier C devices, all mobile viewports, and
// reduced-motion/Save-Data/low-power users.
//
// Dev-only state preview remains in this module so production dead-code
// elimination can remove it. `null` means "live" and follows ChatWidget;
// selecting an explicit state temporarily overrides the live Phase D signal.
function DevStatePreview({
  state,
  onChange,
}: {
  state: BeeState | null
  onChange: (state: BeeState | null) => void
}) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        insetInlineEnd: 0,
        marginBottom: 6,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '6px 8px',
        borderRadius: 8,
        background: 'rgba(3, 6, 15, 0.85)',
        pointerEvents: 'auto',
        zIndex: 41,
      }}
    >
      <label style={{ fontSize: 10, color: '#9AA5B8', fontFamily: 'monospace' }}>
        bee (dev only)
        <select
          value={state ?? '__live__'}
          onChange={(e) => onChange(e.target.value === '__live__' ? null : e.target.value as BeeState)}
          style={{ display: 'block', marginTop: 2, fontSize: 11, width: '100%' }}
        >
          <option value="__live__">live</option>
          {BEE_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

export function Bee() {
  const { state: liveState } = useBeeChatState()
  const [tier, setTier] = useState<BeeTier | null>(null)
  const [Scene, setScene] = useState<ComponentType<BeeSceneProps> | null>(null)
  const [canvasReady, setCanvasReady] = useState(false)
  const [canvasFailed, setCanvasFailed] = useState(false)
  const [active, setActive] = useState(true)
  const [previewState, setPreviewState] = useState<BeeState | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const resolvedTier = resolveBeeTier()
    setTier(resolvedTier)
    if (resolvedTier === 'C') return

    let cancelled = false
    const idleHandle = (() => {
      const runImport = () => {
        import('./BeeScene')
          .then((mod) => {
            if (!cancelled) setScene(() => mod.default)
          })
          .catch(() => {
            if (!cancelled) setCanvasFailed(true)
          })
      }
      if (typeof window.requestIdleCallback === 'function') {
        return window.requestIdleCallback(runImport, { timeout: 1500 })
      }
      return window.setTimeout(runImport, 300) as unknown as number
    })()

    return () => {
      cancelled = true
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleHandle)
      else window.clearTimeout(idleHandle)
    }
  }, [])

  // Pause the idle-motion ticker when the widget scrolls offscreen — a
  // `fixed`-position widget rarely leaves the viewport, but this is a cheap
  // safety net against any future layout change. Combined in BeeScene with a
  // `document.visibilitychange` check for backgrounded tabs.
  useEffect(() => {
    if (!wrapperRef.current) return
    const observer = new IntersectionObserver(
      (entries) => setActive(!!entries[0]?.isIntersecting),
      { threshold: 0 },
    )
    observer.observe(wrapperRef.current)
    return () => observer.disconnect()
  }, [])

  const show3D = tier !== null && tier !== 'C' && Scene !== null && !canvasFailed
  const state: BeeState = process.env.NODE_ENV !== 'production' && previewState !== null
    ? previewState
    : liveState

  return (
    <div
      ref={wrapperRef}
      // Reuses ChatWidget's own physical `right-4`/`sm:right-6` anchor.
      className="fixed bottom-24 right-4 sm:right-6 z-40 w-[72px] h-[72px] pointer-events-none"
    >
      {process.env.NODE_ENV !== 'production' && (
        <DevStatePreview state={previewState} onChange={setPreviewState} />
      )}
      <BeeFallback
        state={state}
        opacity={show3D && canvasReady ? 0 : 1}
        instant={canvasFailed}
      />
      {show3D && Scene && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            opacity: canvasReady ? 1 : 0,
            transition: 'opacity var(--duration-slow, 320ms) ease',
            pointerEvents: 'none',
          }}
        >
          <BeeErrorBoundary
            onError={() => {
              setCanvasReady(false)
              setCanvasFailed(true)
            }}
          >
            <Scene
              tier={tier as BeeTier}
              state={state}
              active={active}
              onReady={() => setCanvasReady(true)}
              onContextLost={() => {
                setCanvasReady(false)
                setCanvasFailed(true)
              }}
            />
          </BeeErrorBoundary>
        </div>
      )}
    </div>
  )
}
