'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { CmsContent } from '@/lib/cms'
import { Hero3D } from './hero-3d/Hero3D'

interface HeroProps { cms?: CmsContent }

const PARTICLES = [
  { x:5,  y:20, s:2,   d:18, dl:0   }, { x:12, y:75, s:1.5, d:25, dl:-4  },
  { x:20, y:45, s:3,   d:15, dl:-11 }, { x:28, y:88, s:1.5, d:22, dl:-7  },
  { x:35, y:15, s:2.5, d:30, dl:-2  }, { x:42, y:60, s:1,   d:20, dl:-15 },
  { x:50, y:35, s:2,   d:28, dl:-8  }, { x:58, y:90, s:3,   d:17, dl:-19 },
  { x:65, y:25, s:1.5, d:24, dl:-5  }, { x:72, y:70, s:2.5, d:21, dl:-13 },
  { x:80, y:50, s:1,   d:26, dl:-1  }, { x:88, y:10, s:2,   d:19, dl:-17 },
  { x:93, y:80, s:3,   d:23, dl:-9  }, { x:15, y:55, s:1.5, d:16, dl:-6  },
  { x:45, y:5,  s:2,   d:29, dl:-14 }, { x:75, y:40, s:1,   d:22, dl:-3  },
  { x:3,  y:65, s:2.5, d:27, dl:-12 }, { x:55, y:95, s:1.5, d:18, dl:-18 },
  { x:83, y:30, s:2,   d:24, dl:-10 }, { x:97, y:55, s:3,   d:20, dl:-16 },
  { x:32, y:78, s:1,   d:31, dl:-7  }, { x:68, y:18, s:2.5, d:25, dl:-20 },
  { x:22, y:95, s:2,   d:15, dl:-4  }, { x:47, y:48, s:1.5, d:28, dl:-9  },
  { x:90, y:85, s:1,   d:23, dl:-13 },
]

const DEFAULT_TRUST = ['نصب رایگان', 'ضمانت اصالت', 'پشتیبانی ۲۴/۷', 'گارانتی ۲۴ ماهه']

export function Hero({ cms }: HeroProps) {
  const [mounted, setMounted] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 })
  const [scrollY, setScrollY] = useState(0)
  const heroRef = useRef<HTMLElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => { setMounted(true) }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight })
    })
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('scroll', onScroll)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [handleMouseMove])

  const parallaxY = scrollY * 0.4
  const orbX1 = (mousePos.x - 0.5) * 60
  const orbY1 = (mousePos.y - 0.5) * 40
  const orbX2 = (mousePos.x - 0.5) * -40
  const orbY2 = (mousePos.y - 0.5) * -30

  // ── CMS values with fallbacks ──
  const badge         = cms?.hero_badge        ?? 'سیستم امنیتی فعال — پشتیبانی ۲۴/۷'
  const titleRaw      = cms?.hero_title        ?? ''
  const titleParts    = titleRaw.split('\n').map((s: string) => s.trim()).filter(Boolean)
  const titleLine1    = titleParts[0]          ?? 'امنیت اماکن'
  const titleLine2    = titleParts[1]          ?? 'با فناوری روز دنیا'
  const titleLine3    = titleParts[2]          ?? (cms?.site_tagline ?? 'دزدگیر هوشمند بیواز')
  const desc          = cms?.hero_subtitle     ?? (cms?.hero_desc ?? 'بیش از ۱۰ سال تجربه در تأمین امنیت منازل، فروشگاه‌ها و اماکن تجاری. نصب رایگان، ضمانت اصالت کالا و پشتیبانی ۲۴ ساعته در سراسر ایران.')
  const ctaPrimary    = cms?.hero_cta_primary      ?? 'مشاوره رایگان'
  const ctaPrimaryUrl = cms?.hero_cta_primary_url  ?? 'tel:02147956'
  const ctaSec        = cms?.hero_cta_secondary     ?? 'مشاهده محصولات'
  const ctaSecUrl     = cms?.hero_cta_secondary_url ?? '/shop'

  const trustPills: string[] = cms?.hero_features
    ? cms.hero_features.split('\n').map((s: string) => s.trim()).filter(Boolean)
    : DEFAULT_TRUST

  const stats: { val: string; lbl: string; color: string; delay: number }[] = [
    { val: cms?.hero_stat1_value ?? '۵۰۰۰+', lbl: cms?.hero_stat1_label ?? 'مشتری',     color: '#F97316', delay: 0   },
    { val: cms?.hero_stat2_value ?? '۱۰+',             lbl: cms?.hero_stat2_label ?? 'سال تجربه', color: '#6080FA', delay: 0.3 },
    { val: cms?.hero_stat3_value ?? '۹۸٪',        lbl: cms?.hero_stat3_label ?? 'رضایت',     color: '#10B981', delay: 0.6 },
  ]

  return (
    <section
      ref={heroRef}
      dir="rtl"
      style={{ position:'relative', minHeight:'100svh', display:'flex', alignItems:'center', overflow:'hidden', background:'#03060F' }}
    >
      <style>{`
        @keyframes floatUp { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-18px) scale(1.05)} }
        @keyframes radarPulse { 0%{transform:scale(0.3);opacity:0.9} 100%{transform:scale(2.2);opacity:0} }
        @keyframes orbitSpin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes scanLine { 0%{top:-2px;opacity:0.8} 100%{top:100%;opacity:0} }
        @keyframes shimmer { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes ctaGlow { 0%,100%{box-shadow:0 0 20px rgba(249,115,22,0.4),0 4px 24px rgba(249,115,22,0.25)} 50%{box-shadow:0 0 40px rgba(249,115,22,0.7),0 4px 32px rgba(249,115,22,0.45)} }
        @keyframes badgePing { 0%{transform:scale(1);opacity:1} 75%,100%{transform:scale(2.2);opacity:0} }
        @keyframes floatBadge { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes gridShimmer { 0%{opacity:0.015} 50%{opacity:0.04} 100%{opacity:0.015} }
        @keyframes heroFadeIn { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes borderGlow { 0%,100%{border-color:rgba(249,115,22,0.3)} 50%{border-color:rgba(249,115,22,0.8)} }
        .hero-cta-primary:hover { transform:translateY(-3px) scale(1.03) !important; box-shadow:0 0 50px rgba(249,115,22,0.8),0 8px 40px rgba(249,115,22,0.5) !important; }
        .hero-cta-secondary:hover { transform:translateY(-3px) !important; background:rgba(255,255,255,0.12) !important; border-color:rgba(255,255,255,0.35) !important; }
        .trust-pill:hover { background:rgba(249,115,22,0.15) !important; border-color:rgba(249,115,22,0.4) !important; transform:translateY(-2px) !important; }
        @media(max-width:768px){
          .hero-headline{font-size:clamp(2rem,8vw,3rem)!important;}
          .hero-trust{flex-wrap:wrap!important;gap:0.5rem!important;}
          .hero-grid{grid-template-columns:1fr!important;gap:2rem!important;padding-top:6rem!important;padding-bottom:4rem!important;}
          .hero-shield-wrap{display:none!important;}
          .hero-badges{position:static!important;transform:none!important;flex-direction:row!important;gap:0.75rem!important;flex-wrap:wrap!important;margin-top:1.5rem!important;}
          .hero-badge-item{flex:1!important;min-width:120px!important;}
        }
        /* fail-open برای کاربران reduced-motion — انیمیشن‌های تزئینی مداوم متوقف می‌شوند
           اما محتوا (متن، دکمه‌ها، آیکون شیلد) همیشه کامل و بدون افکت ورود نمایش داده می‌شود */
        @media (prefers-reduced-motion: reduce) {
          .hero-headline span, .hero-trust, .hero-shield-wrap {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
          .hero-cta-primary, .hero-cta-secondary {
            animation: none !important;
          }
        }
      `}</style>

      {/* Background */}
      <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 80% 60% at 70% 30%, rgba(249,115,22,0.08) 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 20% 80%, rgba(30,60,200,0.12) 0%, transparent 60%)' }} />
      <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(249,115,22,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.04) 1px, transparent 1px)', backgroundSize:'60px 60px', animation:'gridShimmer 4s ease-in-out infinite' }} />

      {/* Orbs */}
      <div style={{ position:'absolute', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)', top:'10%', right:'5%', transform:`translate(${orbX1}px, ${orbY1}px)`, transition:'transform 0.6s cubic-bezier(0.16,1,0.3,1)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle, rgba(30,60,220,0.15) 0%, transparent 70%)', bottom:'5%', left:'10%', transform:`translate(${orbX2}px, ${orbY2}px)`, transition:'transform 0.8s cubic-bezier(0.16,1,0.3,1)', pointerEvents:'none' }} />

      {/* Particles */}
      {mounted && PARTICLES.map((p, i) => (
        <div key={i} style={{ position:'absolute', left:`${p.x}%`, top:`${p.y}%`, width:p.s, height:p.s, borderRadius:'50%', background:i%3===0?'#F97316':i%3===1?'#6080FA':'rgba(255,255,255,0.6)', animation:`floatUp ${p.d}s ease-in-out infinite`, animationDelay:`${p.dl}s`, opacity:i%3===0?0.7:0.4, pointerEvents:'none' }} />
      ))}

      {/* Parallax accents */}
      <div style={{ position:'absolute', inset:0, transform:`translateY(${parallaxY}px)`, pointerEvents:'none' }}>
        <div style={{ position:'absolute', top:'15%', right:'15%', width:1, height:200, background:'linear-gradient(to bottom, transparent, rgba(249,115,22,0.4), transparent)', transform:'rotate(30deg)' }} />
        <div style={{ position:'absolute', bottom:'20%', left:'20%', width:1, height:150, background:'linear-gradient(to bottom, transparent, rgba(100,130,250,0.4), transparent)', transform:'rotate(-20deg)' }} />
      </div>

      {/* Main content */}
      <div className="hero-grid" style={{ position:'relative', zIndex:10, maxWidth:1200, marginInline:'auto', padding:'clamp(6rem,12vw,9rem) clamp(1.25rem,4vw,3rem) clamp(5rem,10vw,8rem)', width:'100%', display:'grid', gridTemplateColumns:'1fr min(480px,45%)', gap:'clamp(3rem,6vw,6rem)', alignItems:'center' }}>

        {/* Text content */}
        <div style={{ animation:'heroFadeIn 0.8s ease both' }}>

          {/* Status badge */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem', background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.25)', borderRadius:99, padding:'0.35rem 1rem', marginBottom:'1.75rem' }}>
            <span style={{ position:'relative', display:'inline-block', width:8, height:8 }}>
              <span style={{ position:'absolute', inset:0, borderRadius:'50%', background:'#22C55E', animation:'badgePing 1.5s ease-out infinite' }} />
              <span style={{ position:'relative', display:'block', width:8, height:8, borderRadius:'50%', background:'#22C55E' }} />
            </span>
            <span style={{ color:'#86EFAC', fontSize:'0.8125rem', fontWeight:600 }}>{badge}</span>
          </div>

          {/* Headline */}
          <h1 className="hero-headline" style={{ fontSize:'clamp(2.4rem,5.5vw,4.5rem)', fontWeight:900, lineHeight:1.15, marginBottom:'1.25rem', color:'#fff', letterSpacing:'-0.02em' }}>
            <span style={{ display:'block', animation:'heroFadeIn 0.7s 0.1s ease both', opacity:0, animationFillMode:'forwards' }}>{titleLine1}</span>
            <span style={{ display:'block', background:'linear-gradient(90deg, #FDE68A 0%, #F97316 40%, #EA580C 80%, #FDE68A 100%)', backgroundSize:'200% auto', backgroundClip:'text', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', animation:'heroFadeIn 0.7s 0.2s ease both, shimmer 3s linear infinite', opacity:0, animationFillMode:'forwards' }}>{titleLine2}</span>
            <span style={{ display:'block', color:'rgba(255,255,255,0.75)', fontSize:'0.65em', fontWeight:700, animation:'heroFadeIn 0.7s 0.3s ease both', opacity:0, animationFillMode:'forwards' }}>{titleLine3}</span>
          </h1>

          {/* Description */}
          <p style={{ color:'rgba(255,255,255,0.55)', fontSize:'clamp(1rem,1.8vw,1.125rem)', lineHeight:1.8, maxWidth:520, marginBottom:'2.5rem', animation:'heroFadeIn 0.7s 0.4s ease both', opacity:0, animationFillMode:'forwards' }}>{desc}</p>

          {/* CTA buttons */}
          <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap', marginBottom:'2.75rem', animation:'heroFadeIn 0.7s 0.5s ease both', opacity:0, animationFillMode:'forwards' }}>
            <a href={ctaPrimaryUrl} className="hero-cta-primary" style={{ display:'inline-flex', alignItems:'center', gap:'0.6rem', background:'linear-gradient(135deg, #F97316, #EA580C)', color:'#fff', fontWeight:700, fontSize:'1.05rem', padding:'0.9rem 2rem', borderRadius:14, textDecoration:'none', animation:'ctaGlow 2.5s ease-in-out infinite', transition:'transform 0.25s ease, box-shadow 0.25s ease' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width:20, height:20 }}>
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.75 12a19.79 19.79 0 01-3.07-8.67A2 2 0 013.66 1.27h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.91 8.91a16 16 0 006.07 6.07l.99-.99a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7a2 2 0 011.72 2z"/>
              </svg>
              {ctaPrimary}
            </a>
            <a href={ctaSecUrl} className="hero-cta-secondary" style={{ display:'inline-flex', alignItems:'center', gap:'0.6rem', background:'rgba(255,255,255,0.07)', color:'#fff', fontWeight:600, fontSize:'1.05rem', padding:'0.9rem 2rem', borderRadius:14, textDecoration:'none', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.18)', transition:'all 0.25s ease' }}>
              {ctaSec}
              <svg viewBox="0 0 20 20" fill="currentColor" style={{ width:18, height:18, transform:'rotate(180deg)' }}>
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
              </svg>
            </a>
          </div>

          {/* Trust pills */}
          <div className="hero-trust" style={{ display:'flex', gap:'0.6rem', flexWrap:'wrap', animation:'heroFadeIn 0.7s 0.6s ease both', opacity:0, animationFillMode:'forwards' }}>
            {trustPills.map((t: string, i: number) => (
              <span key={i} className="trust-pill" style={{ display:'inline-flex', alignItems:'center', gap:'0.4rem', background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.2)', borderRadius:99, padding:'0.3rem 0.85rem', fontSize:'0.8125rem', color:'rgba(255,255,255,0.8)', transition:'all 0.25s ease' }}>
                <svg viewBox="0 0 12 12" fill="#F97316" style={{ width:10, height:10, flexShrink:0 }}>
                  <path d="M10.293 1.293a1 1 0 011.414 1.414l-6 6a1 1 0 01-1.414 0l-3-3a1 1 0 011.414-1.414L5 6.586l5.293-5.293z"/>
                </svg>
                {t}
              </span>
            ))}
          </div>
        </div>

        {/*
          Shield visual — این کانتینر مرز/جایگاه رزرو‌شده برای صحنه سه‌بعدی BEE در Phase B است.
          در Phase A فقط ساختار/مرز کامپوننت آماده می‌شود؛ هیچ WebGL/Canvas یا جعبه خالی تزئینی
          اضافه نشده — محتوای فعلی (آیکون شیلد SVG استاتیک) کاملاً واقعی و قابل مشاهده می‌ماند
          و در Phase B با اسکن 3D جایگزین خواهد شد (aspect-ratio و اندازه‌بندی از قبل رزرو شده است).
        */}
        <div
          className="hero-shield-wrap"
          data-future-3d-slot="hero-shield"
          style={{ display:'flex', alignItems:'center', justifyContent:'center', position:'relative', animation:'heroFadeIn 0.9s 0.3s ease both', opacity:0, animationFillMode:'forwards' }}>
          <Hero3D stats={stats} />
        </div>

        {/* Stat badges — mobile only (shown below content) */}
        <div className="hero-badges" style={{ display:'none' }}>
          {stats.map((s, i) => (
            <div key={i} className="hero-badge-item" style={{ background:'rgba(255,255,255,0.06)', backdropFilter:'blur(16px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:'0.75rem 1rem', textAlign:'center', boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}>
              <div style={{ fontSize:'1.2rem', fontWeight:800, color:s.color, lineHeight:1 }}>{s.val}</div>
              <div style={{ fontSize:'0.75rem', color:'rgba(255,255,255,0.5)', marginTop:4 }}>{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom fade */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:120, background:'linear-gradient(to top, #060B1A, transparent)', pointerEvents:'none', zIndex:5 }} />
      {/* Scroll indicator */}
      <div style={{ position:'absolute', bottom:32, left:'50%', transform:'translateX(-50%)', display:'flex', flexDirection:'column', alignItems:'center', gap:8, opacity:0.4, zIndex:10 }}>
        <span style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.6)', letterSpacing:3 }}>SCROLL</span>
        <div style={{ width:1, height:40, background:'linear-gradient(to bottom, rgba(249,115,22,0.8), transparent)', animation:'scanLine 1.8s ease-in-out infinite' }} />
      </div>
    </section>
  )
}
