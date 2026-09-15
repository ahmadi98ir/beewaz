'use client'

import { useEffect, useRef, useState, type ComponentType } from 'react'
import { Hero3DFallback, type Hero3DStat } from './Hero3DFallback'
import { Hero3DErrorBoundary } from './Hero3DErrorBoundary'
import { resolveHero3DTier, type Hero3DTier } from './hero-3d-config'

// NOTE: no static import of `three` / `@react-three/fiber` / `./Hero3DScene`
// anywhere in this file. The scene module is loaded exclusively via the
// runtime `import()` call below, and only after every capability gate passes.
// This keeps `three`/fiber entirely out of the hero's critical bundle for
// Tier C devices (reduced motion, Save-Data, low-power, no WebGL).

interface Hero3DSceneProps {
  tier: Hero3DTier
  onReady: () => void
  onContextLost: () => void
}

interface Hero3DProps {
  stats: Hero3DStat[]
}

export function Hero3D({ stats }: Hero3DProps) {
  const [tier, setTier] = useState<Hero3DTier | null>(null)
  const [Scene, setScene] = useState<ComponentType<Hero3DSceneProps> | null>(null)
  const [canvasReady, setCanvasReady] = useState(false)
  const [canvasFailed, setCanvasFailed] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const resolvedTier = resolveHero3DTier()
    setTier(resolvedTier)
    if (resolvedTier === 'C') return

    let cancelled = false
    let idleHandle: number | undefined

    const scheduleLoad = () => {
      const runImport = () => {
        import('./Hero3DScene').then((mod) => {
          if (!cancelled) setScene(() => mod.default)
        })
      }
      if (typeof window.requestIdleCallback === 'function') {
        idleHandle = window.requestIdleCallback(runImport, { timeout: 1500 })
      } else {
        idleHandle = window.setTimeout(runImport, 300) as unknown as number
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          scheduleLoad()
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    if (stageRef.current) observer.observe(stageRef.current)

    return () => {
      cancelled = true
      observer.disconnect()
      if (idleHandle !== undefined) {
        if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleHandle)
        else window.clearTimeout(idleHandle)
      }
    }
  }, [])

  const show3D = tier !== null && tier !== 'C' && Scene !== null && !canvasFailed

  return (
    <div
      ref={stageRef}
      style={{
        position: 'relative',
        width: 'min(420px, 100%)',
        aspectRatio: '1 / 1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Hero3DFallback stats={stats} />
      {show3D && Scene && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            opacity: canvasReady ? 1 : 0,
            transition: 'opacity 0.6s ease',
            pointerEvents: tier === 'A' ? 'auto' : 'none',
          }}
        >
          <Hero3DErrorBoundary onError={() => setCanvasFailed(true)}>
            <Scene
              tier={tier}
              onReady={() => setCanvasReady(true)}
              onContextLost={() => {
                setCanvasReady(false)
                setCanvasFailed(true)
              }}
            />
          </Hero3DErrorBoundary>
        </div>
      )}
    </div>
  )
}
