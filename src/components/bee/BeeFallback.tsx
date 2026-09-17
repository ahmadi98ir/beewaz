// Static, always-available fallback rendering of the Bee assistant.
// Rendered unconditionally as the base layer — for Tier C devices, before
// the 3D scene finishes loading, and immediately on any WebGL failure or
// context loss. Purely decorative: `aria-hidden` and carries no text, so it
// is never the sole carrier of meaningful information.
import { BEE_COLORS, type BeeState } from './bee-config'

interface BeeFallbackProps {
  state: BeeState
  /** Controls the cross-fade with the 3D layer. 1 = fully visible (default). */
  opacity?: number
  /** When true, opacity changes apply instantly (no transition) — used for
   * the "snap back on failure" case so there is never a blank/flash frame. */
  instant?: boolean
}

function getStateVisual(state: BeeState) {
  switch (state) {
    case 'thinking':
      return { faceColor: BEE_COLORS.blueAccent, faceOpacity: 0.62, finOpacity: 0.65, chestOpacity: 0.6 }
    case 'speaking':
      return { faceColor: BEE_COLORS.blueAccent, faceOpacity: 1, finOpacity: 0.92, chestOpacity: 0.8 }
    case 'greeting':
      return { faceColor: BEE_COLORS.blueAccent, faceOpacity: 0.92, finOpacity: 0.9, chestOpacity: 0.78 }
    case 'error':
      return { faceColor: BEE_COLORS.orange, faceOpacity: 1, finOpacity: 1, chestOpacity: 0.9 }
    case 'success':
      return { faceColor: BEE_COLORS.orange, faceOpacity: 0.9, finOpacity: 0.95, chestOpacity: 0.88 }
    case 'recommending':
      return { faceColor: BEE_COLORS.blueAccent, faceOpacity: 0.88, finOpacity: 1, chestOpacity: 0.85 }
    case 'listening':
      return { faceColor: BEE_COLORS.blueAccent, faceOpacity: 0.95, finOpacity: 0.8, chestOpacity: 0.75 }
    case 'idle':
    default:
      return { faceColor: BEE_COLORS.blueAccent, faceOpacity: 0.78, finOpacity: 0.85, chestOpacity: 0.7 }
  }
}

export function BeeFallback({ state, opacity = 1, instant = false }: BeeFallbackProps) {
  const visual = getStateVisual(state)

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        transition: instant ? 'none' : 'opacity var(--duration-slow, 320ms) ease',
        pointerEvents: 'none',
      }}
    >
      <svg
        viewBox="0 0 64 64"
        width="100%"
        height="100%"
        role="presentation"
        focusable="false"
      >
        {/* Graphite/gunmetal shell body */}
        <ellipse cx="32" cy="36" rx="20" ry="22" fill={BEE_COLORS.graphite} />
        <ellipse cx="32" cy="34" rx="20" ry="22" fill={BEE_COLORS.gunmetal} opacity={0.35} />
        {/* Head plate */}
        <rect x="16" y="12" width="32" height="20" rx="10" fill={BEE_COLORS.navy} />
        {/* State-driven light-bar "face". Static by design for Tier C/reduced motion. */}
        <rect
          x="21"
          y="19"
          width="22"
          height="6"
          rx="3"
          fill={visual.faceColor}
          opacity={visual.faceOpacity}
        />
        {/* Restrained orange accent fins */}
        <path
          d="M12 30 Q2 24 4 14 Q14 16 16 28 Z"
          fill={BEE_COLORS.orange}
          opacity={visual.finOpacity}
        />
        <path
          d="M52 30 Q62 24 60 14 Q50 16 48 28 Z"
          fill={BEE_COLORS.orange}
          opacity={visual.finOpacity}
        />
        {/* Shield / "B" emblem cue on the chest */}
        <path
          d="M32 40 L40 43 V50 Q40 56 32 60 Q24 56 24 50 V43 Z"
          fill={BEE_COLORS.blue}
          opacity={visual.chestOpacity}
        />
      </svg>
    </div>
  )
}
