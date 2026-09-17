// Phase C — Bee visual robot prototype configuration.
// IMPORTANT: this file must stay free of any `three` / `@react-three/fiber` imports
// so that Bee.tsx (which statically imports this module) never pulls the 3D
// runtime into the widget's critical bundle. Only BeeScene.tsx may import
// three/fiber.
//
// Palette is intentionally re-exported from the Phase B hero config rather
// than redefined here — Bee and the hero share the same restrained
// security-technology brand palette (no purple/neon/crypto colors, no
// green/red — see BeeState below for why green/red are excluded).
import { HERO3D_COLORS, prefersReducedMotion, isSaveDataEnabled, isLowPowerDevice, hasWebGLSupport } from '../home/hero-3d/hero-3d-config'

export const BEE_COLORS = HERO3D_COLORS

/**
 * Presentation-only visual states. These never carry real system/security
 * semantics (e.g. armed/disarmed) — they are momentary decorative cues that
 * always return to the `idle` baseline. Not wired to any AI/chat behavior in
 * Phase C.
 */
export type BeeState =
  | 'idle'
  | 'greeting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'recommending'
  | 'success'
  | 'error'

export const BEE_STATES: readonly BeeState[] = [
  'idle',
  'greeting',
  'listening',
  'thinking',
  'speaking',
  'recommending',
  'success',
  'error',
]

export type BeeTier = 'A' | 'B' | 'C'

/** Mobile-width threshold: below this, Bee never loads any WebGL in Phase C. */
const BEE_MOBILE_MAX_WIDTH = 768

function isFineTouchlessPointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(pointer: fine)').matches
}

/**
 * Resolve which experience tier this device/viewport should get.
 * Tier C means "never even attempt to load the 3D scene module" — the
 * static fallback stays as the entire experience with zero extra bytes
 * downloaded.
 *
 * Gate order (first match wins):
 * 1. Mobile viewport (<=768px) — hard gate, no capability-based mobile 3D
 *    in Phase C, regardless of GPU/pointer capability.
 * 2. Reduced motion / Save-Data / low-power device / no WebGL support.
 * 3. Fine pointer + desktop-width → Tier A (pointer tilt enabled).
 * 4. Otherwise → Tier B (3D enabled, no pointer tilt).
 */
export function resolveBeeTier(): BeeTier {
  if (typeof window !== 'undefined' && window.innerWidth <= BEE_MOBILE_MAX_WIDTH) {
    return 'C'
  }
  if (
    prefersReducedMotion() ||
    isSaveDataEnabled() ||
    isLowPowerDevice() ||
    !hasWebGLSupport()
  ) {
    return 'C'
  }
  if (typeof window !== 'undefined' && window.innerWidth > BEE_MOBILE_MAX_WIDTH && isFineTouchlessPointer()) {
    return 'A'
  }
  return 'B'
}

export interface BeeTierSettings {
  dpr: [number, number]
  enablePointerTilt: boolean
}

export const BEE_TIER_SETTINGS: Record<Exclude<BeeTier, 'C'>, BeeTierSettings> = {
  A: { dpr: [1, 1.5], enablePointerTilt: true },
  B: { dpr: [1, 1.5], enablePointerTilt: false },
}

/** Idle-motion ticker rate: far below a full 60fps loop — enough for a
 * smooth-looking slow breathe/pulse, driven via explicit `invalidate()`
 * calls on a `frameloop="demand"` canvas rather than a continuous loop. */
export const BEE_IDLE_TICK_MS = 90

/** Duration (ms) a state-transition invalidation ticker runs before the
 * canvas is allowed to go idle again (mirrors `--duration-slow` in
 * globals.css, ported to JS timing since this drives WebGL, not CSS). */
export const BEE_STATE_TRANSITION_MS = 320
