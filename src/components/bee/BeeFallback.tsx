// Static, always-available fallback rendering of the Bee assistant.
// Rendered unconditionally as the base layer — for Tier C devices, before
// the 3D scene finishes loading, and immediately on any WebGL failure or
// context loss. Purely decorative: `aria-hidden` and carries no text, so it
// is never the sole carrier of meaningful information.
import { BEE_COLORS } from './bee-config'

interface BeeFallbackProps {
  /** Controls the cross-fade with the 3D layer. 1 = fully visible (default). */
  opacity?: number
  /** When true, opacity changes apply instantly (no transition) — used for
   * the "snap back on failure" case so there is never a blank/flash frame. */
  instant?: boolean
}

export function BeeFallback({ opacity = 1, instant = false }: BeeFallbackProps) {
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
        {/* Blue light-bar "face" */}
        <rect x="21" y="19" width="22" height="6" rx="3" fill={BEE_COLORS.blueAccent} />
        {/* Restrained orange accent fins */}
        <path d="M12 30 Q2 24 4 14 Q14 16 16 28 Z" fill={BEE_COLORS.orange} opacity={0.85} />
        <path d="M52 30 Q62 24 60 14 Q50 16 48 28 Z" fill={BEE_COLORS.orange} opacity={0.85} />
        {/* Shield / "B" emblem cue on the chest */}
        <path
          d="M32 40 L40 43 V50 Q40 56 32 60 Q24 56 24 50 V43 Z"
          fill={BEE_COLORS.blue}
          opacity={0.7}
        />
      </svg>
    </div>
  )
}
