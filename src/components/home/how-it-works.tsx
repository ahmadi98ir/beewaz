'use client'

import { useEffect, useRef, useState } from 'react'
import type { CmsContent } from '@/lib/cms'

interface Step {
  icon: string
  title: string
  desc: string
  color?: string
  glow?: string
}

const DEFAULT_STEPS: Step[] = [
  { icon: '📞', title: 'مشاوره رایگان', desc: 'با کارشناسان ما تماس بگیرید تا بهترین راهکار امنیتی را برای شما طراحی کنیم', color: 'from-blue-500 to-cyan-400', glow: 'shadow-blue-500/30' },
  { icon: '🎯', title: 'انتخاب محصول', desc: 'بهترین دزدگیر برای فضا و بودجه شما را با دقت انتخاب و سفارشی‌سازی می‌کنیم', color: 'from-violet-500 to-purple-400', glow: 'shadow-violet-500/30' },
  { icon: '🔧', title: 'نصب تخصصی', desc: 'تیم فنی حرفه‌ای ما در محل شما نصب استاندارد و آزمایش کامل انجام می‌دهد', color: 'from-amber-500 to-orange-400', glow: 'shadow-amber-500/30' },
  { icon: '🛡️', title: 'پشتیبانی دائمی', desc: 'گارانتی ۲۴ ماهه و پشتیبانی ۲۴ ساعته — ۷ روز هفته در خدمت شما هستیم', color: 'from-emerald-500 to-green-400', glow: 'shadow-emerald-500/30' },
]

interface HowItWorksProps { cms?: CmsContent }

function AnimateIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const failSafe = setTimeout(() => setVisible(true), 2500)
    const obs = new IntersectionObserver((entries) => { const entry = entries[0]; if (!entry) return; if (entry.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.15 })
    obs.observe(el); return () => { obs.disconnect(); clearTimeout(failSafe) }
  }, [])
  return (
    <div ref={ref} className={className} style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(32px)', transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms` }}>
      {children}
    </div>
  )
}

export function HowItWorks({ cms = {} }: HowItWorksProps) {
  const title    = cms.how_title    ?? '۴ گام تا امنیت کامل'
  const subtitle = cms.how_subtitle ?? 'از مشاوره اولیه تا پشتیبانی دائمی، در هر قدم همراه شما هستیم'

  let steps = DEFAULT_STEPS
  if (cms.how_steps) {
    try {
      const parsed = JSON.parse(cms.how_steps)
      if (Array.isArray(parsed) && parsed.length > 0) {
        steps = parsed.map((s: { icon: string; title: string; desc: string }, i: number) => ({ ...(DEFAULT_STEPS[i] ?? DEFAULT_STEPS[0]!), ...s }))
      }
    } catch { /* use defaults */ }
  }

  return (
    <section className="relative py-20 sm:py-32 overflow-hidden bg-[#030712]">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.15) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
        <AnimateIn className="text-center mb-16 sm:mb-24">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm font-medium px-4 py-2 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            فرآیند ساده و سریع
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-4">{title}</h2>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">{subtitle}</p>
        </AnimateIn>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-blue-500/0 via-violet-500/30 to-emerald-500/0" />
          <style>{`
            @keyframes shimmerLine { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
          `}</style>

          {steps.map((step, i) => (
            <AnimateIn key={i} delay={i * 120}>
              <div className={`group relative bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 text-center hover:bg-white/[0.06] hover:border-white/20 transition-all duration-500 shadow-xl ${step.glow ?? 'shadow-blue-500/30'}`}>
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br ${step.color ?? 'from-blue-500 to-cyan-400'} text-white font-black text-sm mb-5 shadow-lg`}>
                  {(i + 1).toLocaleString('fa-IR')}
                </div>
                <div className="relative mx-auto w-20 h-20 mb-5">
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${step.color ?? 'from-blue-500 to-cyan-400'} opacity-15 group-hover:opacity-25 transition-opacity blur-sm`} />
                  <div className={`relative w-full h-full rounded-2xl bg-gradient-to-br ${step.color ?? 'from-blue-500 to-cyan-400'} bg-opacity-10 border border-white/10 flex items-center justify-center text-4xl`}>{step.icon}</div>
                </div>
                <h3 className="text-white font-bold text-lg mb-3">{step.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{step.desc}</p>
                <div className={`absolute bottom-0 left-6 right-6 h-0.5 rounded-full bg-gradient-to-r ${step.color ?? 'from-blue-500 to-cyan-400'} opacity-0 group-hover:opacity-60 transition-opacity`} />
              </div>
            </AnimateIn>
          ))}
        </div>

        <AnimateIn delay={500} className="mt-16 text-center">
          <a href="/contact" className="inline-flex items-center gap-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold px-8 py-4 rounded-2xl shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 transition-all duration-300 hover:-translate-y-0.5">
            <span>همین الان شروع کن</span>
            <svg viewBox="0 0 20 20" className="w-5 h-5 rotate-180" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </a>
        </AnimateIn>
      </div>
    </section>
  )
}
