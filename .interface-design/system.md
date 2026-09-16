# Beewaz Interface Design System

This document captures Beewaz's own brand and product constraints. It is meant
to be read **alongside** the generic `apple-design` skill
(`.github/extensions/apple-design/SKILL.md`) — that skill supplies Apple's
fluid-motion/interaction principles (springs, 1:1 tracking, momentum,
restraint); this document supplies the Beewaz-specific rules that always take
precedence when the two would conflict.

**Precedence: Beewaz brand constraints below always win over generic Apple
Design guidance.** Apple's motion/interaction principles are additive polish,
never a license to override RTL layout, brand color, real product imagery,
accessibility, or performance budgets.

## Language & direction

- The entire site is Persian-first: `<html lang="fa" dir="rtl">` (see
  `src/app/layout.tsx`). Every new UI must be authored RTL-native, not
  LTR-then-mirrored. Logical CSS properties (`inset-inline-start`, `margin-inline`,
  etc.) over physical ones (`left`/`right`) wherever layout direction matters.
- All user-facing numbers (prices, stats, counts, dates) render through
  `toFaDigits()` / `toLocaleString('fa-IR')` — never raw Latin digits.
- Prices always go through `formatPrice(rial)` (`src/lib/utils.ts`): stored in
  Rial, displayed in whole Toman.

## Color system

Defined as Tailwind 4 `@theme` tokens in `src/app/globals.css` — use the
token scale, not ad hoc hex values, for any new component:

| Role | Token | Hex |
|---|---|---|
| Brand (navy, from logo) | `--color-brand-600` | `#1B3A8A` |
| Brand deepest | `--color-brand-950` | `#060B20` |
| Accent (orange, "ELECTRONIC" in logo) | `--color-accent-500` | `#F97316` |
| Accent deep | `--color-accent-600` | `#EA580C` |
| Gunmetal (cinematic dark sections / hero) | `--color-gunmetal-900` | `#03060F` |
| Surface (neutral light/dark UI) | `--color-surface-50`…`950` | slate scale |

No purple/magenta/neon, no crypto/gaming aesthetics, no excessive bloom or
particle effects — this applies to *all* visual work, including any Apple
Design-inspired motion or materials work. Restrained emissive/glow accents in
brand orange or brand-blue only.

## Typography

`Vazirmatn` (loaded from CDN in `layout.tsx`), falling back to `IRANSans`,
then `system-ui`. Respect the `--font-sans` / `--font-display` tokens; do not
introduce a second typeface without an explicit design decision.

## Imagery

Product visuals must be **real Beewaz product photography/renders**, not
generic stock photos or AI-generated fake products. Decorative/ambient 3D or
motion elements (e.g. the Phase B hero shield) are fine as abstractions, but
anything presented as an actual Beewaz product must be real.

## Accessibility

- Meaningful content (headlines, CTAs, trust/stat text, pricing) is always
  real DOM — never rendered only inside a `<canvas>`/WebGL scene.
- Decorative/animated visuals (particles, rings, canvases) get
  `aria-hidden="true"`; they must never be the only carrier of information a
  screen reader needs.
- Don't blanket-hide a whole container just because part of it is decorative
  — hide only the decorative subtree, and verify nothing meaningful was
  hidden along with it (see Phase B's `hero-shield-wrap` handling for the
  precedent).

## Reduced motion & performance

- Always honor `prefers-reduced-motion: reduce` — continuous/ambient
  animation must stop; content must remain fully visible without animation.
- Treat `navigator.connection.saveData` and low-core/low-memory devices as an
  equivalent "reduce" signal for any heavy visual feature (see Phase B's
  `resolveHero3DTier()` for the pattern: reduced-motion → Save-Data →
  low-power → capability-check, in that order, before loading heavy code).
- Heavy visual/animation code (3D engines, large motion libraries) must be
  loaded lazily and only after these checks pass — never as part of the
  critical/eager bundle for real DOM content (H1, CTA, trust copy).
- No blank placeholder on failure: any progressive-enhancement visual must
  have a static, always-rendered fallback and fail closed to it (WebGL
  context loss, import failure, etc.) with no retry loop.

## Motion tokens

Reuse the existing easing/duration tokens in `globals.css` instead of
inventing new ones for Apple-style spring/motion work:

- `--ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275)`
- `--ease-out-expo: cubic-bezier(0.19, 1, 0.22, 1)`
- `--duration-fast: 120ms` / `--duration-base: 200ms` / `--duration-slow: 320ms` / `--duration-slower: 500ms`

When the `apple-design` skill recommends a spring/physics-based interaction
(drag, sheet, momentum), prefer expressing it with these tokens/durations as
the starting point, adjusting only when a specific interaction genuinely
needs different physical values — not as a wholesale replacement of the
existing motion system.

## How to use this together with `apple-design`

1. Read `.github/extensions/apple-design/SKILL.md` for the interaction/motion
   *how* (springs, direct manipulation, feedback timing, restraint).
2. Read this file for the Beewaz-specific *what/constraints* (palette,
   language, imagery, accessibility, performance).
3. Where they conflict, this file wins. Where they don't conflict, apply
   Apple's fluidity principles inside Beewaz's brand system, not instead of it.
