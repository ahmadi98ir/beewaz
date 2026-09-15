'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { CmsContent } from '@/lib/cms'

interface CtaSectionProps { cms?: CmsContent }

function AnimateIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const failSafe = setTimeout(() => setVisible(true), 2500)
    const obs = new IntersectionObserver((entries) => { const e = entries[0]; if (!e) return; if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.15 })
    obs.observe(el); return () => { obs.disconnect(); clearTimeout(failSafe) }
  }, [])
  return (
    <div ref={ref} className={className} style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(28px)', transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms` }}>
      {children}
    </div>
  )
}

export function CtaSection({ cms = {} }: CtaSectionProps) {
  const title     = cms.cta_title     ?? 'نمی‌دانید چه دزدگیری برای شما مناسب است؟'
  const subtitle  = cms.cta_subtitle  ?? 'کارشناسان بیواز رایگان راهنمایی می‌کنند — همین الان تماس بگیرید'
  const button    = cms.cta_button    ?? 'مشاوره رایگان'
  const buttonUrl = cms.cta_button_url ?? '/contact'
  const phone     = cms.contact_phone  ?? ''

  return (
    <section className="relative py-20 sm:py-32 overflow-hidden bg-[#030712]">
      <style>{`
        @keyframes ctaPulse { 0%,100%{transform:scale(1);opacity:0.4} 50%{transform:scale(1.08);opacity:0.7} }
        @keyframes ctaOrbit { from{transform:rotate(0deg) translateX(160px) rotate(0deg)} to{transform:rotate(360deg) translateX(160px) rotate(-360deg)} }
        @keyframes ctaOrbit2 { from{transform:rotate(180deg) translateX(220px) rotate(-180deg)} to{transform:rotate(540deg) translateX(220px) rotate(-540deg)} }
        @keyframes gradientShift { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
      `}</style>

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full" style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.08) 50%, transparent 80%)', animation: 'ctaPulse 6s ease-in-out infinite' }} />
      </div>

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
        <AnimateIn>
          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg,#1e1b4b 0%,#312e81 30%,#4c1d95 60%,#1e1b4b 100%)', backgroundSize: '300% 300%', animation: 'gradientShift 8s ease infinite' }} />
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.1) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0 hidden sm:block">
              <div className="absolute w-3 h-3 rounded-full bg-violet-300/60" style={{ animation: 'ctaOrbit 12s linear infinite' }} />
              <div className="absolute w-2 h-2 rounded-full bg-indigo-300/50" style={{ animation: 'ctaOrbit2 18s linear infinite' }} />
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-violet-400/20 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-400/20 blur-3xl rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="relative z-10 px-8 py-14 sm:px-16 sm:py-20 text-center">
              <AnimateIn delay={100}>
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white/80 text-sm font-medium px-4 py-2 rounded-full mb-8">
                  <svg viewBox="0 0 20 20" className="w-4 h-4 text-yellow-400" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  مشاوره کاملاً رایگان
                </div>
              </AnimateIn>
              <AnimateIn delay={180}>
                <h2 className="text-3xl sm:text-5xl font-black text-white mb-5 leading-tight">{title}</h2>
              </AnimateIn>
              <AnimateIn delay={260}>
                <p className="text-white/60 text-lg sm:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">{subtitle}</p>
              </AnimateIn>
              <AnimateIn delay={340}>
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <Link href={buttonUrl} className="group inline-flex items-center gap-3 bg-white text-indigo-700 font-black text-lg px-8 py-4 rounded-2xl shadow-2xl hover:shadow-white/20 hover:-translate-y-1 transition-all duration-300">
                    <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                      <svg viewBox="0 0 20 20" className="w-4 h-4 text-white" fill="currentColor">
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                      </svg>
                    </span>
                    {button}
                  </Link>
                  {phone ? (
                    <a href={`tel:${phone.replace(/\D/g, '')}`} className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/30 text-white font-bold text-lg px-8 py-4 rounded-2xl hover:bg-white/20 transition-all duration-300 hover:-translate-y-1">
                      <svg viewBox="0 0 20 20" className="w-5 h-5 text-green-400" fill="currentColor">
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                      </svg>
                      {phone}
                    </a>
                  ) : (
                    <Link href="/shop" className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/30 text-white font-bold text-lg px-8 py-4 rounded-2xl hover:bg-white/20 transition-all duration-300 hover:-translate-y-1">
                      <svg viewBox="0 0 20 20" className="w-5 h-5 text-indigo-300" fill="currentColor">
                        <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                      </svg>
                      مشاهده محصولات
                    </Link>
                  )}
                </div>
              </AnimateIn>
              <AnimateIn delay={440}>
                <div className="mt-12 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-white/40 text-sm border-t border-white/10 pt-8">
                  <span className="flex items-center gap-2"><span className="text-white/70 font-bold text-base">+۱۵,۰۰۰</span> مشتری راضی</span>
                  <span className="w-px h-4 bg-white/20 hidden sm:block" />
                  <span className="flex items-center gap-2"><span className="text-white/70 font-bold text-base">۱۸</span> ماه گارانتی</span>
                  <span className="w-px h-4 bg-white/20 hidden sm:block" />
                  <span className="flex items-center gap-2"><span className="text-white/70 font-bold text-base">۲۴/۷</span> پشتیبانی</span>
                  <span className="w-px h-4 bg-white/20 hidden sm:block" />
                  <span className="flex items-center gap-2"><span className="text-white/70 font-bold text-base">۱۰</span> سال تجربه</span>
                </div>
              </AnimateIn>
            </div>
          </div>
        </AnimateIn>
      </div>
    </section>
  )
}
