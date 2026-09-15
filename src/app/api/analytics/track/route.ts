/**
 * POST /api/analytics/track
 * ثبت بازدید صفحه — صدا زده می‌شود از middleware یا client
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { pageViews } from '@/lib/db/schema'
import { UAParser } from 'ua-parser-js'

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      path: string
      referrer?: string
      sessionId?: string
    }

    if (!body.path || typeof body.path !== 'string') {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const ua = req.headers.get('user-agent') ?? ''
    const parsed = UAParser(ua)
    const deviceType = parsed.device.type
    const device = deviceType === 'mobile' ? 'mobile' : deviceType === 'tablet' ? 'tablet' : 'desktop'
    const browser = parsed.browser.name?.slice(0, 32)
    const os = parsed.os.name?.slice(0, 32)

    await db.insert(pageViews).values({
      path: body.path.slice(0, 500),
      referrer: typeof body.referrer === 'string' ? body.referrer.slice(0, 500) : undefined,
      userAgent: ua.slice(0, 300),
      device,
      browser,
      os,
      sessionId: typeof body.sessionId === 'string' ? body.sessionId.slice(0, 64) : undefined,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    // بازدیدها اگر fail شدن مشکلی نیست — silent fail سمت کلاینت (fire-and-forget)
    // اما لاگ سمت سرور حفظ می‌شود تا خطاهای واقعی از قطع‌شدن درخواست هنگام ناوبری صفحه
    // (که خودش خطای عادی و بی‌ضرر است) قابل تشخیص باشند
    console.error('[analytics/track] insert failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
