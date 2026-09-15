'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { CmsContent } from '@/lib/cms'
import {
  ShieldIcon,
  SmartphoneIcon,
  BoltIcon,
  WrenchIcon,
  GemIcon,
  TagIcon,
} from '@/components/ui/icons'

interface WhyBeewazProps { cms?: CmsContent }

// آیکون‌ها به‌صورت SVG (بر اساس index) رندر می‌شوند تا مستقل از فونت emoji و
// داده‌های CMS همیشه نمایش داده شوند. مقدار `icon` در داده‌ها صرفاً برای سازگاری است.
const FEATURE_ICONS = [ShieldIcon, SmartphoneIcon, BoltIcon, WrenchIcon, GemIcon, TagIcon]

const DEFAULT_FEATURES = [
  { icon:'🛡️', title:'امنیت ۲۴ ساعته', desc:'سیستم‌های هوشمند ما بدون وقفه از اموال شما محافظت می‌کنند. هشدار فوری به موبایل در کمتر از ۳ ثانیه.', color:'#F97316', glow:'rgba(249,115,22,0.3)' },
  { icon:'📱', title:'کنترل از راه دور', desc:'با اپلیکیشن اختصاصی بیواز، از هر جای دنیا وضعیت امنیتی ملک خود را مشاهده و کنترل کنید.', color:'#6080FA', glow:'rgba(96,128,250,0.3)' },
  { icon:'⚡', title:'نصب سریع', desc:'تیم متخصص ما در کمتر از یک روز کاری سیستم را نصب و راه‌اندازی می‌کند. بدون خسارت به دیوار.', color:'#10B981', glow:'rgba(16,185,129,0.3)' },
  { icon:'🔧', title:'پشتیبانی فنی', desc:'تیم پشتیبانی ۲۴/۷ آماده پاسخگویی است. گارانتی ۲۴ ماهه قطعات و خدمات پس از فروش.', color:'#FB923C', glow:'rgba(251,146,60,0.3)' },
  { icon:'💎', title:'کیفیت اصل', desc:'تمام محصولات دارای گواهی اصالت و استاندارد CE اروپا هستند. فقط بهترین برای شما.', color:'#A78BFA', glow:'rgba(167,139,250,0.3)' },
  { icon:'💰', title:'قیمت رقابتی', desc:'بهترین کیفیت با مناسب‌ترین قیمت. امکان اقساط ۱۲ ماهه بدون بهره برای همه محصولات.', color:'#FBBF24', glow:'rgba(251,191,36,0.3)' },
]

function AnimateIn({ children, delay=0, className='' }: { children:ReactNode; delay?:number; className?:string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const failSafe = setTimeout(() => setVisible(true), 2500)
    const obs = new IntersectionObserver(entries => {
      const e = entries[0]; if (!e) return
      if (e.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold:0.1 })
    obs.observe(el)
    return () => { obs.disconnect(); clearTimeout(failSafe) }
  }, [])
  return (
    <div ref={ref} className={className} style={{ opacity:visible?1:0, transform:visible?'translateY(0)':'translateY(40px)', transition:`opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms` }}>
      {children}
    </div>
  )
}

export function WhyBeewaz({ cms }: WhyBeewazProps) {
  // اگر CMS مقدار داشته باشد آن را parse می‌کنیم، وگرنه defaults
  let features = DEFAULT_FEATURES
  if (cms?.why_features) {
    try {
      const parsed = JSON.parse(cms.why_features) as typeof DEFAULT_FEATURES
      if (Array.isArray(parsed) && parsed.length > 0) features = parsed
    } catch { /* use defaults */ }
  }

  const title    = cms?.why_title    ?? 'چرا بیواز؟'
  const subtitle = cms?.why_subtitle ?? 'بیش از ۱۰ سال تجربه در امنیت الکترونیک — اعتماد هزاران خانواده و کسب‌وکار ایرانی'

  return (
    <section dir="rtl" style={{ background:'#060B1A', padding:'clamp(4rem,8vw,7rem) clamp(1.25rem,4vw,3rem)' }}>
      <div style={{ maxWidth:1200, marginInline:'auto' }}>
        <AnimateIn>
          <div style={{ textAlign:'center', marginBottom:'clamp(2.5rem,5vw,4rem)' }}>
            <span style={{ display:'inline-block', background:'rgba(249,115,22,0.1)', border:'1px solid rgba(249,115,22,0.25)', borderRadius:99, padding:'0.35rem 1.1rem', fontSize:'0.8125rem', color:'#F97316', fontWeight:600, marginBottom:'1rem' }}>
              مزایای بیواز
            </span>
            <h2 style={{ fontSize:'clamp(1.75rem,4vw,3rem)', fontWeight:900, color:'#fff', marginBottom:'1rem' }}>{title}</h2>
            <p style={{ color:'rgba(255,255,255,0.5)', maxWidth:560, marginInline:'auto', fontSize:'1.05rem', lineHeight:1.7 }}>{subtitle}</p>
          </div>
        </AnimateIn>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:'1.5rem' }}>
          {features.map((f, i) => (
            <AnimateIn key={i} delay={i * 80}>
              <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:20, padding:'1.75rem', transition:'all 0.3s ease', cursor:'default' }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.background='rgba(255,255,255,0.06)'; el.style.borderColor=`rgba(${f.color.slice(1).match(/../g)!.map(h=>parseInt(h,16)).join(',')},0.3)`; el.style.transform='translateY(-4px)'; }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.background='rgba(255,255,255,0.03)'; el.style.borderColor='rgba(255,255,255,0.07)'; el.style.transform='translateY(0)'; }}>
                <div style={{ width:52, height:52, borderRadius:14, background:`rgba(${f.color.slice(1).match(/../g)!.map(h=>parseInt(h,16)).join(',')},0.12)`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'1.1rem', boxShadow:`0 0 20px ${f.glow}` }}>
                  {(() => { const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length]!; return <Icon size={26} style={{ color: f.color }} /> })()}
                </div>
                <h3 style={{ color:'#fff', fontWeight:700, fontSize:'1.05rem', marginBottom:'0.6rem' }}>{f.title}</h3>
                <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.9rem', lineHeight:1.7 }}>{f.desc}</p>
              </div>
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  )
}
