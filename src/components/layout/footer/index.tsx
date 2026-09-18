import Link from 'next/link'
import { BeewazLogo } from '@/components/ui/logo'
import {
  PhoneIcon,
  MailIcon,
  MapPinIcon,
  InstagramIcon,
  TelegramIcon,
  WhatsAppIcon,
  ShieldIcon,
  CheckIcon,
} from '@/components/ui/icons'
import { NewsletterForm } from './newsletter-form'
import { getSiteSettings, getFooterLinks } from '@/lib/cms'

// Server Component

const trustSignals = [
  { icon: ShieldIcon, label: 'گارانتی اصالت کالا' },
  { icon: CheckIcon,  label: 'ضمانت بازگشت وجه' },
  { icon: ShieldIcon, label: 'درگاه پرداخت امن' },
  { icon: CheckIcon,  label: 'پشتیبانی ۲۴/۷' },
]

export async function Footer() {
  const [settings, footerLinks] = await Promise.all([getSiteSettings(), getFooterLinks()])
  const currentYear = new Date().getFullYear()
  const persianYear = currentYear - 621

  const phone    = settings.contact_phone   ?? '۰۲۱-۴۷۹۵۶'
  const email    = settings.contact_email   ?? 'info@beewaz.ir'
  const address  = settings.contact_address ?? 'تهران، ایران'
  const tagline  = settings.site_tagline    ?? 'طراح و سازنده سیستم‌های هوشمند و حفاظتی اماکن تجاری و مسکونی.'
  const siteName = settings.site_name      ?? 'بیواز'

  const instagram  = settings.social_instagram ?? 'https://instagram.com/beewaz_co'
  const telegram   = settings.social_telegram  ?? 'https://t.me/beewaz'
  const waNumber   = settings.whatsapp_number  ?? '989000000000'
  const whatsapp   = `https://wa.me/${waNumber}`

  const socialLinks = [
    { icon: InstagramIcon, href: instagram, label: 'اینستاگرام' },
    { icon: TelegramIcon,  href: telegram,  label: 'تلگرام' },
    { icon: WhatsAppIcon,  href: whatsapp,  label: 'واتساپ' },
  ]

  return (
    <footer className="bg-surface-900 text-white" aria-label="فوتر سایت">

      {/* Trust Bar */}
      <div className="border-b border-white/10">
        <div className="container-main py-6">
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-4" role="list">
            {trustSignals.map(({ icon: Icon, label }, i) => (
              <li key={label} className="flex items-center gap-3 group">
                <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-110"
                  style={i % 2 === 0
                    ? { background: 'rgb(249 115 22 / 0.18)', boxShadow: '0 0 12px rgb(249 115 22 / 0.2)' }
                    : { background: 'rgb(27 58 138 / 0.35)' }}>
                  <Icon size={18} style={{ color: i % 2 === 0 ? '#FB923C' : '#93B4FF' }} />
                </div>
                <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Main Footer */}
      <div className="container-main py-12 lg:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">

          {/* ستون ۱ — برند و تماس */}
          <div className="sm:col-span-2 lg:col-span-1 space-y-6">
            <BeewazLogo variant="light" size="md" />
            <p className="text-sm text-white/60 leading-relaxed max-w-xs">{tagline}</p>

            {/* اطلاعات تماس */}
            <address className="not-italic space-y-3">
              <a href={`tel:${phone.replace(/-/g, '')}`}
                className="flex items-center gap-3 text-sm text-white/70 hover:text-white transition-colors group">
                <PhoneIcon size={15} className="flex-shrink-0 transition-colors group-hover:opacity-80" style={{ color: '#FB923C' }} />
                <span dir="ltr">{phone}</span>
              </a>
              <a href={`mailto:${email}`}
                className="flex items-center gap-3 text-sm text-white/70 hover:text-white transition-colors group">
                <MailIcon size={15} className="flex-shrink-0 transition-colors group-hover:opacity-80" style={{ color: '#FB923C' }} />
                <span dir="ltr">{email}</span>
              </a>
              <div className="flex items-start gap-3 text-sm text-white/70">
                <MapPinIcon size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#FB923C' }} />
                <span>{address}</span>
              </div>
            </address>

            {/* شبکه‌های اجتماعی */}
            <div className="flex items-center gap-2">
              {socialLinks.map(({ icon: Icon, href, label }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
                  className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center transition-all duration-200 hover:scale-110 hover:bg-accent-500">
                  <Icon size={16} />
                </a>
              ))}
            </div>

            {/* نماد اعتماد الکترونیکی */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a href="https://trustseal.enamad.ir/?id=733910&Code=1fDUu6rrYqBiYkpnIrcclfpuPGF2bvxs"
              target="_blank" referrerPolicy="origin">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://trustseal.enamad.ir/logo.aspx?id=733910&Code=1fDUu6rrYqBiYkpnIrcclfpuPGF2bvxs"
                alt="نماد اعتماد الکترونیکی"
                referrerPolicy="origin"
                style={{ cursor: 'pointer', height: '96px', width: 'auto' }} />
            </a>
          </div>

          {/* ستون ۲ — فروشگاه */}
          <div>
            <h3 className="text-sm font-bold text-white mb-5 pb-3 border-b border-white/10">فروشگاه</h3>
            <ul className="space-y-3" role="list">
              {footerLinks.shop.map(({ label, href }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-white/60 hover:text-white transition-colors hover:translate-x-0.5 inline-flex items-center gap-1.5 group">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ستون ۳ — دانش */}
          <div>
            <h3 className="text-sm font-bold text-white mb-5 pb-3 border-b border-white/10">پایگاه دانش</h3>
            <ul className="space-y-3" role="list">
              {footerLinks.knowledge.map(({ label, href }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-white/60 hover:text-white transition-colors hover:translate-x-0.5 inline-flex items-center gap-1.5 group">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ستون ۴ — شرکت */}
          <div>
            <h3 className="text-sm font-bold text-white mb-5 pb-3 border-b border-white/10">شرکت</h3>
            <ul className="space-y-3" role="list">
              {footerLinks.company.map(({ label, href }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-white/60 hover:text-white transition-colors hover:translate-x-0.5 inline-flex items-center gap-1.5 group">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <p className="text-xs text-white/50 mb-3">دریافت آخرین اخبار و تخفیف‌ها:</p>
              <NewsletterForm />
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="container-main py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
          <p>© {persianYear} — {currentYear} {siteName}. تمامی حقوق محفوظ است.</p>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <Link href="/privacy" className="hover:text-white/70 transition-colors">حریم خصوصی</Link>
            <Link href="/terms" className="hover:text-white/70 transition-colors">شرایط استفاده</Link>
            <span className="text-white/20">|</span>
            <span>ساخته شده با ❤️ در ایران</span>
          </div>
        </div>
      </div>

    </footer>
  )
}
