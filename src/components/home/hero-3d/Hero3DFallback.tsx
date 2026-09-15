'use client'

import { Fragment } from 'react'

export interface Hero3DStat {
  val: string
  lbl: string
  color: string
  delay: number
}

interface Hero3DFallbackProps {
  stats: Hero3DStat[]
}

/**
 * The existing Phase A static shield visual, extracted verbatim.
 *
 * Rendered as a Fragment (no wrapping element) on purpose: its children are
 * `position:absolute` with no `top`/`left`, so they rely on the parent stage's
 * `display:flex; align-items:center; justify-content:center` for centering.
 * Wrapping them in an extra element here would break that centering. This is
 * also the permanent, always-visible Tier C / failure-mode experience.
 */
export function Hero3DFallback({ stats }: Hero3DFallbackProps) {
  return (
    <Fragment>
      <div style={{ position:'absolute', width:420, height:420, borderRadius:'50%', background:'radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)', animation:'floatUp 6s ease-in-out infinite' }} />
      {[0,1,2,3].map(i => (
        <div key={i} style={{ position:'absolute', width:300-i*20, height:300-i*20, borderRadius:'50%', border:`1px solid rgba(249,115,22,${0.15-i*0.03})`, animation:`radarPulse ${3+i*0.8}s ease-out infinite`, animationDelay:`${i*0.75}s`, pointerEvents:'none' }} />
      ))}
      <div style={{ position:'absolute', width:280, height:280, borderRadius:'50%', border:'1px dashed rgba(249,115,22,0.25)', animation:'orbitSpin 12s linear infinite', pointerEvents:'none' }}>
        <div style={{ position:'absolute', top:-5, left:'50%', marginLeft:-5, width:10, height:10, borderRadius:'50%', background:'linear-gradient(135deg,#F97316,#EA580C)', boxShadow:'0 0 12px rgba(249,115,22,0.8)' }} />
      </div>
      <div style={{ position:'absolute', width:220, height:220, borderRadius:'50%', border:'1px dashed rgba(100,130,250,0.2)', animation:'orbitSpin 18s linear infinite reverse', pointerEvents:'none' }}>
        <div style={{ position:'absolute', bottom:-4, right:'50%', marginRight:-4, width:8, height:8, borderRadius:'50%', background:'#6080FA', boxShadow:'0 0 10px rgba(100,130,250,0.8)' }} />
      </div>
      <div style={{ position:'relative', width:160, height:160, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(145deg, rgba(249,115,22,0.15), rgba(249,115,22,0.05))', backdropFilter:'blur(20px)', borderRadius:'50%', border:'1px solid rgba(249,115,22,0.35)', animation:'floatUp 5s ease-in-out infinite, borderGlow 3s ease-in-out infinite', boxShadow:'0 0 60px rgba(249,115,22,0.25), inset 0 1px 0 rgba(255,255,255,0.1)' }}>
        <div style={{ position:'absolute', left:12, right:12, height:1.5, background:'linear-gradient(90deg, transparent, rgba(249,115,22,0.8), transparent)', animation:'scanLine 2.5s linear infinite', pointerEvents:'none', overflow:'hidden', top:0 }} />
        <svg viewBox="0 0 56 64" fill="none" style={{ width:72, height:80, filter:'drop-shadow(0 0 20px rgba(249,115,22,0.6))' }}>
          <path d="M28 2L4 12v20c0 14.4 10.2 27.9 24 31.2C41.8 59.9 52 46.4 52 32V12L28 2z" fill="url(#shieldGrad)" stroke="rgba(249,115,22,0.6)" strokeWidth="1.5"/>
          <path d="M20 32l6 6 12-12" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
          <defs>
            <linearGradient id="shieldGrad" x1="28" y1="2" x2="28" y2="63" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="rgba(249,115,22,0.5)"/>
              <stop offset="100%" stopColor="rgba(234,88,12,0.2)"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      {/* Stat badges — desktop only (hidden on mobile via CSS) */}
      <div style={{ position:'absolute', display:'flex', flexDirection:'column', gap:'0.75rem', left:-40, top:'50%', transform:'translateY(-50%)' }}>
        {stats.map((s, i) => (
          <div key={i} style={{ background:'rgba(255,255,255,0.06)', backdropFilter:'blur(16px)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:'0.6rem 1rem', animation:`floatBadge ${4+i*0.5}s ease-in-out infinite`, animationDelay:`${s.delay}s`, whiteSpace:'nowrap', boxShadow:'0 8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize:'1.1rem', fontWeight:800, color:s.color, lineHeight:1 }}>{s.val}</div>
            <div style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.5)', marginTop:2 }}>{s.lbl}</div>
          </div>
        ))}
      </div>
    </Fragment>
  )
}
