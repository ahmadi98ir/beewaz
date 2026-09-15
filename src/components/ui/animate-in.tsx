'use client'

import { useEffect, useRef } from 'react'

type Direction = 'up' | 'left' | 'right' | 'scale'

type Props = {
  children: React.ReactNode
  className?: string
  delay?: number
  threshold?: number
  once?: boolean
  direction?: Direction
}

const directionClass: Record<Direction, string> = {
  up:    'reveal',
  left:  'reveal-left',
  right: 'reveal-right',
  scale: 'reveal-scale',
}

export function AnimateIn({
  children,
  className = '',
  delay = 0,
  threshold = 0.12,
  once = true,
  direction = 'up',
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // fail-open: کاربران reduced-motion یا مرورگرهای بدون IntersectionObserver
    // باید محتوا را فوراً ببینند، نه اینکه برای همیشه مخفی بماند
    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
      el.classList.add('visible')
      return
    }

    // fail-safe: اگر IntersectionObserver به هر دلیلی (اسکرول سریع، تأخیر مرورگر) دیر یا هرگز
    // فعال نشد، بعد از مدتی محتوا به‌صورت اجباری نمایش داده می‌شود
    const failSafeTimer = setTimeout(() => el.classList.add('visible'), 2500)

    const observer = new IntersectionObserver(
      (entries) => { const entry = entries[0]; if (!entry) return;
        if (entry?.isIntersecting) {
          const timer = setTimeout(() => el.classList.add('visible'), delay)
          if (once) observer.unobserve(el)
          return () => clearTimeout(timer)
        } else if (!once) {
          el.classList.remove('visible')
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' },
    )

    observer.observe(el)
    return () => {
      observer.disconnect()
      clearTimeout(failSafeTimer)
    }
  }, [delay, threshold, once, direction])

  return (
    <div ref={ref} className={`${directionClass[direction]} ${className}`}>
      {children}
    </div>
  )
}

export function AnimateInGroup({
  children,
  staggerMs = 80,
  className = '',
  direction = 'up',
}: {
  children: React.ReactNode[]
  staggerMs?: number
  className?: string
  direction?: Direction
}) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <AnimateIn key={i} delay={i * staggerMs} direction={direction}>
          {child}
        </AnimateIn>
      ))}
    </div>
  )
}
