'use client'

// Only file in `src/components/bee` allowed to import `three` / `@react-three/fiber`.
// Loaded exclusively via the runtime `import()` in Bee.tsx, after every
// capability/mobile-viewport gate passes — this keeps `three`/fiber entirely
// out of the widget's critical bundle for Tier C devices and all mobile
// viewports.
import { useEffect, useRef } from 'react'
import { Canvas, useThree, type RootState } from '@react-three/fiber'
import * as THREE from 'three'
import {
  BEE_COLORS,
  BEE_TIER_SETTINGS,
  BEE_IDLE_TICK_MS,
  type BeeTier,
  type BeeState,
} from './bee-config'

interface StatePreset {
  /** Light-bar base color (hex). */
  color: string
  /** Steady emissive intensity. */
  base: number
  /** Continuous pulse amplitude riding on top of `base`. */
  pulseAmp: number
  /** Continuous pulse frequency in Hz. */
  pulseHz: number
  /** Base fin emissive intensity. */
  finBase: number
  /** One-shot decaying flash added on transition into this state (transient states only). */
  flashPeak?: number
  /** One-shot decaying fin flash (recommending only). */
  finFlashPeak?: number
  /** Flash decay duration in seconds. */
  flashDecay?: number
  /** Head pitch nod amplitude on transition (greeting only), radians. */
  nodPeak?: number
}

// All states stay within the brand blue/orange system — no green/red, since
// those could be misread as real security/system status rather than a
// decorative presentation cue. Every state is either a steady, restrained
// baseline (idle/listening/thinking/speaking) or a brief one-shot flash that
// decays back to the idle baseline (greeting/recommending/success/error).
const STATE_PRESETS: Record<BeeState, StatePreset> = {
  idle: { color: BEE_COLORS.blueAccent, base: 0.35, pulseAmp: 0.03, pulseHz: 0.15, finBase: 0.25 },
  greeting: { color: BEE_COLORS.blueAccent, base: 0.55, pulseAmp: 0.05, pulseHz: 0.2, finBase: 0.25, flashPeak: 0.5, flashDecay: 0.6, nodPeak: 0.12 },
  listening: { color: BEE_COLORS.blueAccent, base: 0.65, pulseAmp: 0.04, pulseHz: 0.25, finBase: 0.25 },
  thinking: { color: BEE_COLORS.blueAccent, base: 0.4, pulseAmp: 0.25, pulseHz: 0.5, finBase: 0.25 },
  speaking: { color: BEE_COLORS.blueAccent, base: 0.5, pulseAmp: 0.15, pulseHz: 3, finBase: 0.25 },
  recommending: { color: BEE_COLORS.blueAccent, base: 0.4, pulseAmp: 0.04, pulseHz: 0.2, finBase: 0.3, finFlashPeak: 0.7, flashDecay: 0.7 },
  success: { color: BEE_COLORS.orange, base: 0.35, pulseAmp: 0.03, pulseHz: 0.15, finBase: 0.25, flashPeak: 0.85, flashDecay: 0.55 },
  error: { color: BEE_COLORS.orange, base: 0.35, pulseAmp: 0.03, pulseHz: 0.15, finBase: 0.25, flashPeak: 0.6, flashDecay: 0.45 },
}

const TRANSIENT_STATES = new Set<BeeState>(['greeting', 'recommending', 'success', 'error'])

/** Bee body + head + light-bar + accent fins, driven by a low-frequency
 * explicit-invalidate ticker rather than a continuous `useFrame` loop. */
function BeeRig({ state, enablePointerTilt, active }: { state: BeeState; enablePointerTilt: boolean; active: boolean }) {
  const invalidate = useThree((s) => s.invalidate)
  const bodyRef = useRef<THREE.Group>(null)
  const headRef = useRef<THREE.Group>(null)
  const lightMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const finMatRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([null, null])
  const pointerTarget = useRef({ x: 0, y: 0 })
  const flash = useRef<{ start: number } | null>(null)
  const elapsed = useRef(0)
  const activeRef = useRef(active)

  useEffect(() => {
    activeRef.current = active
  }, [active])

  // Bounded pointer-follow head tilt — Tier A / fine-pointer desktop only.
  useEffect(() => {
    if (!enablePointerTilt) return
    const onMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1
      const ny = (e.clientY / window.innerHeight) * 2 - 1
      const maxTilt = 0.21
      pointerTarget.current = { x: ny * maxTilt * 0.35, y: nx * maxTilt }
      invalidate()
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [enablePointerTilt, invalidate])

  // One-shot transient flash on entering a transient state.
  useEffect(() => {
    if (TRANSIENT_STATES.has(state)) {
      flash.current = { start: elapsed.current }
      invalidate()
    }
  }, [state, invalidate])

  // Low-frequency idle ticker: paused entirely on tab-hidden / offscreen, no
  // continuous 60fps GPU loop. Restarted (cheap) whenever `state` changes so
  // the tick closure always reads the current state — no stale-closure risk.
  useEffect(() => {
    const onVisibility = () => {
      activeRef.current = active && !document.hidden
    }
    document.addEventListener('visibilitychange', onVisibility)
    onVisibility()

    const preset = STATE_PRESETS[state]
    const id = window.setInterval(() => {
      if (!activeRef.current) return
      elapsed.current += BEE_IDLE_TICK_MS / 1000
      const t = elapsed.current

      if (bodyRef.current) {
        bodyRef.current.position.y = Math.sin(t * 0.9) * 0.05
      }
      if (headRef.current) {
        const swayY = Math.sin(t * 0.6) * 0.05 + pointerTarget.current.y
        const swayX = pointerTarget.current.x
        headRef.current.rotation.y += (swayY - headRef.current.rotation.y) * 0.12
        headRef.current.rotation.x += (swayX - headRef.current.rotation.x) * 0.12

        if (flash.current && preset.nodPeak) {
          const dt = t - flash.current.start
          const decay = preset.flashDecay ?? 0.5
          const k = Math.max(0, 1 - dt / decay)
          headRef.current.rotation.x += preset.nodPeak * Math.sin(Math.min(1, dt / decay) * Math.PI) * k
        }
      }

      let intensity = preset.base + Math.sin(t * preset.pulseHz * Math.PI * 2) * preset.pulseAmp
      let finIntensity = preset.finBase

      if (flash.current) {
        const dt = t - flash.current.start
        const decay = preset.flashDecay ?? 0.5
        const k = Math.max(0, 1 - dt / decay)
        if (k <= 0) {
          flash.current = null
        } else {
          intensity += (preset.flashPeak ?? 0) * k
          finIntensity += (preset.finFlashPeak ?? 0) * k
        }
      }

      if (lightMatRef.current) {
        lightMatRef.current.emissiveIntensity = intensity
        lightMatRef.current.emissive.set(preset.color)
        lightMatRef.current.color.set(preset.color)
      }
      finMatRefs.current.forEach((m) => {
        if (m) m.emissiveIntensity = Math.max(0, finIntensity)
      })

      invalidate()
    }, BEE_IDLE_TICK_MS)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [state, active, invalidate])

  return (
    <group ref={bodyRef}>
      {/* Graphite/gunmetal shell body */}
      <mesh position={[0, -0.15, 0]} scale={[0.85, 1, 0.75]}>
        <sphereGeometry args={[0.75, 24, 24]} />
        <meshStandardMaterial color={BEE_COLORS.graphite} metalness={0.55} roughness={0.4} />
      </mesh>
      {/* Shield / "B" emblem cue on the chest */}
      <mesh position={[0, -0.1, 0.58]} rotation={[0.1, 0, 0]}>
        <circleGeometry args={[0.22, 3]} />
        <meshStandardMaterial color={BEE_COLORS.blue} metalness={0.4} roughness={0.45} opacity={0.85} transparent />
      </mesh>
      {/* Head / face plate */}
      <group ref={headRef} position={[0, 0.75, 0.05]}>
        <mesh>
          <boxGeometry args={[0.9, 0.42, 0.55]} />
          <meshStandardMaterial color={BEE_COLORS.navy} metalness={0.5} roughness={0.35} />
        </mesh>
        {/* Blue light-bar — the sole "expressive" element */}
        <mesh position={[0, 0, 0.29]}>
          <planeGeometry args={[0.52, 0.12]} />
          <meshStandardMaterial
            ref={lightMatRef}
            color={BEE_COLORS.blueAccent}
            emissive={BEE_COLORS.blueAccent}
            emissiveIntensity={0.35}
            toneMapped={false}
          />
        </mesh>
      </group>
      {/* Restrained orange accent fins */}
      <mesh position={[-0.68, 0.05, -0.05]} rotation={[0, 0.3, 0.4]}>
        <planeGeometry args={[0.45, 0.6]} />
        <meshStandardMaterial
          ref={(m) => {
            finMatRefs.current[0] = m
          }}
          color={BEE_COLORS.orange}
          emissive={BEE_COLORS.orange}
          emissiveIntensity={0.25}
          side={THREE.DoubleSide}
          transparent
          opacity={0.85}
        />
      </mesh>
      <mesh position={[0.68, 0.05, -0.05]} rotation={[0, -0.3, -0.4]}>
        <planeGeometry args={[0.45, 0.6]} />
        <meshStandardMaterial
          ref={(m) => {
            finMatRefs.current[1] = m
          }}
          color={BEE_COLORS.orange}
          emissive={BEE_COLORS.orange}
          emissiveIntensity={0.25}
          side={THREE.DoubleSide}
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  )
}

export interface BeeSceneProps {
  tier: BeeTier
  state: BeeState
  /** False when the widget is hidden/offscreen — pauses the idle ticker. */
  active: boolean
  onReady: () => void
  onContextLost: () => void
}

export default function BeeScene({ tier, state, active, onReady, onContextLost }: BeeSceneProps) {
  const settings = tier === 'C' ? BEE_TIER_SETTINGS.B : BEE_TIER_SETTINGS[tier]

  const handleCreated = (rootState: RootState) => {
    onReady()
    // Deliberately no `webglcontextrestored` handling / recreation attempt —
    // once a context is lost we stay on the static fallback for the rest of
    // this widget's life rather than risk a retry loop.
    rootState.gl.domElement.addEventListener('webglcontextlost', (event: Event) => {
      event.preventDefault()
      onContextLost()
    })
  }

  return (
    <Canvas
      frameloop="demand"
      dpr={settings.dpr}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      camera={{ position: [0, 0.1, 3.2], fov: 32 }}
      onCreated={handleCreated}
      style={{ width: '100%', height: '100%' }}
    >
      <ambientLight intensity={0.45} />
      <pointLight position={[2, 2, 2]} intensity={0.9} color={BEE_COLORS.blueAccent} />
      <pointLight position={[-2, -1, -1]} intensity={0.4} color={BEE_COLORS.orange} />
      <BeeRig state={state} enablePointerTilt={settings.enablePointerTilt} active={active} />
    </Canvas>
  )
}
