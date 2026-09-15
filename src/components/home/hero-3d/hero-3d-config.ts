// Phase B — 3D hero prototype configuration.
// IMPORTANT: this file must stay free of any `three` / `@react-three/fiber` imports
// so that Hero3D.tsx (which statically imports this module) never pulls the 3D
// runtime into the main hero bundle. Only Hero3DScene.tsx may import three/fiber.

export type Hero3DTier = 'A' | 'B' | 'C'

/** Restrained premium security-technology palette — no purple/neon/crypto colors. */
export const HERO3D_COLORS = {
  navy: '#0A1530',
  navyDeep: '#03060F',
  blue: '#1E3CC8',
  blueAccent: '#6080FA',
  orange: '#F97316',
  orangeDeep: '#EA580C',
  graphite: '#2A2E38',
  gunmetal: '#3B4252',
} as const

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface NetworkInformationLike {
  saveData?: boolean
}

export function isSaveDataEnabled(): boolean {
  if (typeof navigator === 'undefined') return false
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection
  return !!connection?.saveData
}

/** Heuristic: low core count or low device memory implies a device that should
 * skip the 3D scene entirely rather than risk jank. */
export function isLowPowerDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const cores = (navigator as Navigator & { hardwareConcurrency?: number }).hardwareConcurrency
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (typeof cores === 'number' && cores > 0 && cores <= 2) return true
  if (typeof memory === 'number' && memory > 0 && memory <= 2) return true
  return false
}

export function hasWebGLSupport(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    return !!gl
  } catch {
    return false
  }
}

function isFineTouchlessPointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(pointer: fine)').matches
}

/**
 * Resolve which experience tier this device should get.
 * Tier C means "never even attempt to load the 3D scene module" — the static
 * fallback stays as the entire experience with zero extra bytes downloaded.
 */
export function resolveHero3DTier(): Hero3DTier {
  if (
    prefersReducedMotion() ||
    isSaveDataEnabled() ||
    isLowPowerDevice() ||
    !hasWebGLSupport()
  ) {
    return 'C'
  }
  if (typeof window !== 'undefined' && window.innerWidth >= 1024 && isFineTouchlessPointer()) {
    return 'A'
  }
  return 'B'
}

export interface Hero3DTierSettings {
  dpr: [number, number]
  nodeCount: number
  enablePointerTilt: boolean
}

export const HERO3D_TIER_SETTINGS: Record<Exclude<Hero3DTier, 'C'>, Hero3DTierSettings> = {
  A: { dpr: [1, 2], nodeCount: 8, enablePointerTilt: true },
  B: { dpr: [1, 1.25], nodeCount: 4, enablePointerTilt: false },
}
