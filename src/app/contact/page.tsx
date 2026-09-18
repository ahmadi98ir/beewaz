/**
 * صفحه تماس با ما — Server Component
 * اطلاعات تماس از CMS و site_settings خوانده می‌شود
 * فرم تماس داخل ContactForm (client component) است
 */

import { getCmsContent } from '@/lib/cms'
import { ContactForm } from '@/components/contact/contact-form'
import { db } from '@/lib/db'
import { siteSettings } from '@/lib/db/schema'
import { inArray } from 'drizzle-orm'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'تماس با ما',
  description: 'با تیم پشتیبانی بیواز تماس بگیرید. مشاوره رایگان، پاسخگویی سریع و پشتیبانی ۲۴ ساعته.',
}

export default async function ContactPage() {
  // خواندن محتوای CMS + تنظیمات تماس
  const [cms, settings] = await Promise.all([
    getCmsContent('contact', {
      hero_title:    'چطور می‌توانیم کمک کنیم؟',
      hero_subtitle: 'تیم پشتیبانی بیواز آماده پاسخگویی است',
    }),
    db
      .select({ key: siteSettings.key, value: siteSettings.value })
      .from(siteSettings)
      .where(
        inArray(siteSettings.key, [
          'contact_phone',
          'contact_email',
          'contact_address',
          'contact_hours',
        ]),
      )
      .catch(() => []),
  ])

  // تبدیل آرایه تنظیمات به map
  const settingsMap: Record<string, string> = {}
  for (const s of settings) {
    if (s.value) settingsMap[s.key] = s.value
  }

  // اولویت: page_content > site_settings > مقدار پیش‌فرض واقعی
  const phone   = cms.contact_phone   ?? settingsMap.contact_phone   ?? '۰۲۱-۴۷۹۵۶'
  const email   = cms.contact_email   ?? settingsMap.contact_email   ?? 'info@beewaz.ir'
  const address = cms.contact_address ?? settingsMap.contact_address ?? ''
  const hours   = cms.contact_hours   ?? settingsMap.contact_hours   ?? 'شنبه تا چهارشنبه ۸ تا ۱۷ — پنجشنبه ۸ تا ۱۲'

  return (
    <main>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-900 to-brand-700 py-14 sm:py-20 text-center">
        <div className="container-page">
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">{cms.hero_title}</h1>
          <p className="text-white/75 text-lg max-w-lg mx-auto">{cms.hero_subtitle}</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 sm:py-16">
        <div className="container-page">
          <ContactForm
            phone={phone || undefined}
            email={email || undefined}
            address={address || undefined}
            hours={hours || undefined}
          />
        </div>
      </section>

      {/* Map (اختیاری — اگر در CMS وجود داشت) */}
      {cms.map_embed && (
        <section className="pb-12">
          <div className="container-page">
            <div
              className="w-full h-64 rounded-2xl overflow-hidden border border-surface-100"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: cms.map_embed }}
            />
          </div>
        </section>
      )}
    </main>
  )
}
