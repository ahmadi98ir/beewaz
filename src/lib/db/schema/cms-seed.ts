/**
 * داده‌های اولیه CMS
 * اجرا: این فایل از migrate.ts صدا زده می‌شود
 * یا مستقل: tsx scripts/seed-cms.ts
 */

import type { NewSiteSetting, NewPageContent } from './cms'

// ─── Site Settings defaults ───────────────────────────────────────────────────

export const DEFAULT_SITE_SETTINGS: NewSiteSetting[] = [
  // ── General ──
  { key: 'site_name',        value: 'بیواز',                    type: 'text',    label: 'نام سایت',             group: 'general', isRequired: true },
  { key: 'site_tagline',     value: 'دزدگیر اماکن و منزل',      type: 'text',    label: 'شعار سایت',            group: 'general' },
  { key: 'site_description', value: 'خرید آنلاین سیستم دزدگیر حرفه‌ای برای خانه و کسب‌وکار', type: 'text', label: 'توضیح سایت (SEO)', group: 'seo' },
  { key: 'site_keywords',    value: 'دزدگیر اماکن,دزدگیر منزل,سیستم امنیتی,بیواز,BH10,BH11', type: 'text', label: 'کلمات کلیدی SEO', group: 'seo', hint: 'با کاما جدا کنید' },
  { key: 'logo_url',         value: '/images/logo.png',          type: 'image',   label: 'لوگو',                 group: 'general' },
  { key: 'favicon_url',      value: '/favicon.ico',              type: 'image',   label: 'فاوآیکون',             group: 'general' },
  { key: 'og_image_url',     value: '/images/og-image.jpg',      type: 'image',   label: 'تصویر اشتراک‌گذاری (OG)', group: 'seo' },

  // ── Contact ──
  { key: 'contact_phone',    value: '021-47956',                 type: 'text',    label: 'شماره تماس',           group: 'contact' },
  { key: 'contact_phone2',   value: '',                          type: 'text',    label: 'شماره موبایل',         group: 'contact' },
  { key: 'contact_email',    value: 'info@beewaz.ir',        type: 'text',    label: 'ایمیل',                group: 'contact', isRequired: true },
  { key: 'contact_address',  value: 'تهران، ...',                type: 'text',    label: 'آدرس',                 group: 'contact' },
  { key: 'contact_hours',    value: 'شنبه تا چهارشنبه ۸ تا ۱۷ — پنجشنبه ۸ تا ۱۲', type: 'text', label: 'ساعت کاری', group: 'contact' },
  { key: 'whatsapp_number',  value: '',                          type: 'text',    label: 'شماره واتساپ',         group: 'contact', hint: 'مثال: 989121234567' },

  // ── Social ──
  { key: 'social_instagram', value: 'https://instagram.com/beewaz_co', type: 'url', label: 'اینستاگرام',     group: 'social' },
  { key: 'social_telegram',  value: '',                          type: 'url',     label: 'تلگرام',               group: 'social' },
  { key: 'social_youtube',   value: '',                          type: 'url',     label: 'یوتیوب',               group: 'social' },
  { key: 'social_linkedin',  value: '',                          type: 'url',     label: 'لینکدین',              group: 'social' },

  // ── Commerce ──
  { key: 'free_shipping_threshold', value: '2000000',            type: 'number',  label: 'حد نصاب ارسال رایگان (ریال)', group: 'commerce' },
  { key: 'shipping_cost',           value: '150000',             type: 'number',  label: 'هزینه ارسال (ریال)',           group: 'commerce', hint: 'برای سفارش‌های زیر حد نصاب' },
  { key: 'default_warranty_months', value: '24',                 type: 'number',  label: 'ماه‌های گارانتی پیش‌فرض', group: 'commerce' },
  { key: 'shop_enabled',     value: 'true',                      type: 'boolean', label: 'فروشگاه فعال است',     group: 'commerce' },
  { key: 'checkout_notes',   value: '',                          type: 'text',    label: 'توضیح صفحه پرداخت',   group: 'commerce' },
  { key: 'bank_card_enabled', value: 'false',                    type: 'boolean', label: 'فعال‌سازی پرداخت کارت به کارت', group: 'commerce' },
  { key: 'bank_card_number', value: '',                          type: 'text',    label: 'شماره کارت بانکی',     group: 'commerce', hint: '16 رقم بدون فاصله' },
  { key: 'bank_card_holder', value: '',                          type: 'text',    label: 'نام صاحب حساب',        group: 'commerce' },
  { key: 'bank_card_bank',   value: '',                          type: 'text',    label: 'نام بانک',             group: 'commerce', hint: 'مثال: بانک ملت' },
  { key: 'return_window_days', value: '7', type: 'number', label: 'بازه زمانی مرجوعی (روز)', group: 'commerce', hint: 'تعداد روزهایی که مشتری می‌تواند بعد از تحویل، درخواست مرجوعی دهد', isRequired: false, isEditable: true },

  // ── Notification ──
  { key: 'admin_order_notify_phone', value: '', type: 'text', label: 'شماره اطلاع‌رسانی سفارش جدید', group: 'notification', hint: 'SMS هنگام ثبت سفارش' },

  // ── Payment Gateways ──
  { key: 'zarinpal_enabled',     value: 'false', type: 'boolean', label: 'زرین‌پال فعال',              group: 'payment' },
  { key: 'zarinpal_merchant_id', value: '',       type: 'text',    label: 'Merchant ID زرین‌پال',       group: 'payment', hint: 'UUID از پنل زرین‌پال' },
  { key: 'zarinpal_sandbox',     value: 'false',  type: 'boolean', label: 'حالت آزمایشی (Sandbox)',     group: 'payment' },
  { key: 'idpay_enabled',        value: 'false',  type: 'boolean', label: 'آیدی‌پی فعال',               group: 'payment' },
  { key: 'idpay_api_key',        value: '',       type: 'text',    label: 'API Key آیدی‌پی',            group: 'payment', hint: 'از داشبورد idpay.ir' },
  { key: 'idpay_sandbox',        value: 'false',  type: 'boolean', label: 'حالت آزمایشی آیدی‌پی',       group: 'payment' },

  // ── Analytics ──
  { key: 'ga4_enabled',              value: 'false', type: 'boolean', label: 'گوگل آنالیتکس فعال',        group: 'analytics' },
  { key: 'ga4_measurement_id',       value: '',      type: 'text',    label: 'Measurement ID',            group: 'analytics', hint: 'مثال: G-XXXXXXXXXX — از پنل Google Analytics بخش Admin > Data Streams' },
  { key: 'google_site_verification', value: '',      type: 'text',    label: 'کد تأیید Search Console',  group: 'analytics', hint: 'محتوای متاتگ google-site-verification — از Google Search Console بخش Settings > Ownership verification' },
  { key: 'gtm_container_id',         value: '',      type: 'text',    label: 'Google Tag Manager ID',     group: 'analytics', hint: 'اختیاری — مثال: GTM-XXXXXXX' },
]

// ─── Page Content defaults ────────────────────────────────────────────────────

export const DEFAULT_PAGE_CONTENT: NewPageContent[] = [
  // ── Home — Announcement Bar ──
  { page: 'global', key: 'announcement_active', type: 'boolean', label: 'نوار اطلاع‌رسانی فعال', valueFa: 'true', position: 1 },
  { page: 'global', key: 'announcement_text',   type: 'text',    label: 'متن نوار اطلاع‌رسانی', valueFa: '🎉 ارسال رایگان برای سفارش‌های بالای ۵۰۰ هزار تومان', position: 2 },
  { page: 'global', key: 'announcement_url',    type: 'url',     label: 'لینک نوار اطلاع‌رسانی', valueFa: '/shop', position: 3 },
  { page: 'global', key: 'announcement_color',  type: 'color',   label: 'رنگ نوار اطلاع‌رسانی', valueFa: '#f59e0b', position: 4 },

  // ── Home — Hero ──
  { page: 'home', key: 'hero_badge',        type: 'text',    label: 'بج روی عنوان hero',   valueFa: '🔒 بیش از ۱۵,۰۰۰ مشتری راضی', position: 1 },
  { page: 'home', key: 'hero_title',        type: 'text',    label: 'عنوان اصلی hero',     valueFa: 'امنیت خانه و کسب‌وکار\nرا به بیواز بسپارید', position: 2 },
  { page: 'home', key: 'hero_subtitle',     type: 'text',    label: 'زیرعنوان hero',       valueFa: 'سیستم‌های دزدگیر هوشمند ایرانی با ۱۰ سال سابقه، گارانتی ۲۴ ماهه و پشتیبانی ۲۴ ساعته', position: 3 },
  { page: 'home', key: 'hero_cta_primary',  type: 'text',    label: 'دکمه اول hero',       valueFa: 'مشاوره رایگان', position: 4 },
  { page: 'home', key: 'hero_cta_primary_url', type: 'url', label: 'لینک دکمه اول',       valueFa: '/contact', position: 5 },
  { page: 'home', key: 'hero_cta_secondary',  type: 'text', label: 'دکمه دوم hero',       valueFa: 'مشاهده محصولات', position: 6 },
  { page: 'home', key: 'hero_cta_secondary_url', type: 'url', label: 'لینک دکمه دوم',    valueFa: '/shop', position: 7 },
  { page: 'home', key: 'hero_image',        type: 'image',   label: 'تصویر hero',          valueFa: '', position: 8 },

  // ── Home — Featured Section ──
  { page: 'home', key: 'featured_title',    type: 'text',    label: 'عنوان بخش محصولات ویژه', valueFa: 'هر آنچه برای امنیت نیاز دارید', position: 10 },
  { page: 'home', key: 'featured_subtitle', type: 'text',    label: 'زیرعنوان بخش محصولات',  valueFa: 'از دزدگیر تا حسگر، همه‌چیز با گارانتی اصالت', position: 11 },

  // ── Home — CTA Section ──
  { page: 'home', key: 'cta_title',         type: 'text',    label: 'عنوان بخش CTA',      valueFa: 'نمی‌دانید چه دزدگیری برای شما مناسب است؟', position: 20 },
  { page: 'home', key: 'cta_subtitle',      type: 'text',    label: 'زیرعنوان CTA',       valueFa: 'کارشناسان بیواز رایگان راهنمایی می‌کنند', position: 21 },
  { page: 'home', key: 'cta_button',        type: 'text',    label: 'دکمه CTA',            valueFa: 'مشاوره رایگان', position: 22 },
  { page: 'home', key: 'cta_button_url',    type: 'url',     label: 'لینک CTA',            valueFa: '/contact', position: 23 },

  // ── Home — How It Works ──
  { page: 'home', key: 'how_title',         type: 'text',    label: 'عنوان «چطور کار می‌کند»', valueFa: '۴ گام تا امنیت کامل', position: 30 },
  { page: 'home', key: 'how_steps',         type: 'json',    label: 'مراحل (JSON)',        valueFa: JSON.stringify([
    { icon: '📞', title: 'مشاوره رایگان', desc: 'با کارشناسان ما تماس بگیرید' },
    { icon: '🎯', title: 'انتخاب محصول', desc: 'بهترین دزدگیر برای فضای شما' },
    { icon: '🔧', title: 'نصب تخصصی', desc: 'تیم فنی در محل شما نصب می‌کند' },
    { icon: '🛡️', title: 'پشتیبانی دائمی', desc: 'گارانتی ۲۴ ماهه و پشتیبانی ۲۴/۷' },
  ]), position: 31 },

  // ── About ──
  { page: 'about', key: 'hero_title',       type: 'text',    label: 'عنوان صفحه درباره ما', valueFa: 'درباره بیواز', position: 1 },
  { page: 'about', key: 'story_title',      type: 'text',    label: 'عنوان داستان',        valueFa: 'از یک ایده تا ۱۵ هزار مشتری', position: 2 },
  { page: 'about', key: 'story_text',       type: 'richtext',label: 'متن داستان شرکت',     valueFa: '<p>بیواز در سال ۱۳۹۳ با هدف تولید دزدگیرهای باکیفیت و اقتصادی برای بازار ایران تأسیس شد...</p>', position: 3 },
  { page: 'about', key: 'founded_year',     type: 'text',    label: 'سال تأسیس',           valueFa: '۱۳۹۳', position: 4 },
  { page: 'about', key: 'customers_count',  type: 'text',    label: 'تعداد مشتریان',       valueFa: '+۱۵,۰۰۰', position: 5 },
  { page: 'about', key: 'experience_years', type: 'text',    label: 'سال‌های تجربه',       valueFa: '+۱۰', position: 6 },

  // ── Contact ──
  { page: 'contact', key: 'hero_title',     type: 'text',    label: 'عنوان صفحه تماس',    valueFa: 'چطور می‌توانیم کمک کنیم؟', position: 1 },
  { page: 'contact', key: 'hero_subtitle',  type: 'text',    label: 'زیرعنوان تماس',      valueFa: 'تیم پشتیبانی بیواز آماده پاسخگویی است', position: 2 },
  { page: 'contact', key: 'map_embed',      type: 'text',    label: 'کد Embed نقشه',       valueFa: '', hint: 'کد iframe گوگل‌مپ', position: 3 },

  // ── Chatbot ──
  { page: 'chatbot', key: 'bot_name',       type: 'text',    label: '\u0646\u0627\u0645 \u0631\u0628\u0627\u062a',             valueFa: '\u067e\u0634\u062a\u06cc\u0628\u0627\u0646 \u0628\u06cc\u0648\u0627\u0632', position: 1 },
  { page: 'chatbot', key: 'bot_status',     type: 'text',    label: '\u0648\u0636\u0639\u06cc\u062a \u0646\u0645\u0627\u06cc\u0634\u06cc',        valueFa: '\u0622\u0646\u0644\u0627\u06cc\u0646', position: 2 },
  { page: 'chatbot', key: 'welcome_msg',    type: 'text',    label: '\u067e\u06cc\u0627\u0645 \u062e\u0648\u0634\u200c\u0622\u0645\u062f',        valueFa: '\u0633\u0644\u0627\u0645! \ud83d\udc4b \u0645\u0646 \u062f\u0633\u062a\u06cc\u0627\u0631 \u0647\u0648\u0634\u0645\u0646\u062f \u0628\u06cc\u0648\u0627\u0632 \u0647\u0633\u062a\u0645. \u0686\u0637\u0648\u0631 \u0645\u06cc\u200c\u062a\u0648\u0646\u0645 \u06a9\u0645\u06a9\u062a\u0648\u0646 \u06a9\u0646\u0645\u061f', position: 3 },
  { page: 'chatbot', key: 'quick_replies',  type: 'json',    label: '\u067e\u0627\u0633\u062e\u200c\u0647\u0627\u06cc \u0633\u0631\u06cc\u0639 (JSON)', valueFa: JSON.stringify(['\u0642\u06cc\u0645\u062a \u0645\u062d\u0635\u0648\u0644\u0627\u062a', '\u0645\u0634\u0627\u0648\u0631\u0647 \u062e\u0631\u06cc\u062f', '\u067e\u0634\u062a\u06cc\u0628\u0627\u0646\u06cc \u0641\u0646\u06cc', '\u0627\u0631\u0633\u0627\u0644 \u0633\u0641\u0627\u0631\u0634']), hint: '\u0622\u0631\u0627\u06cc\u0647 JSON \u0627\u0632 \u0631\u0634\u062a\u0647\u200c\u0647\u0627', position: 4 },
  { page: 'chatbot', key: 'footer_text',    type: 'text',    label: '\u0645\u062a\u0646 \u0641\u0648\u062a\u0631 \u0686\u062a',         valueFa: '\u067e\u0627\u0633\u062e\u06af\u0648\u06cc \u06f2\u06f4 \u0633\u0627\u0639\u062a\u0647 | \u0628\u06cc\u0648\u0627\u0632', position: 5 },
  { page: 'chatbot', key: 'system_prompt',  type: 'richtext',label: 'System Prompt \u0647\u0648\u0634 \u0645\u0635\u0646\u0648\u0639\u06cc', valueFa: '\u062a\u0648 \u062f\u0633\u062a\u06cc\u0627\u0631 \u0641\u0631\u0648\u0634 \u0628\u0631\u0646\u062f \u0628\u06cc\u0648\u0627\u0632 \u0647\u0633\u062a\u06cc. \u0645\u062d\u0635\u0648\u0644\u0627\u062a \u0627\u0635\u0644\u06cc: BH10 \u0648 BH11. \u0647\u0645\u06cc\u0634\u0647 \u0628\u0647 \u0641\u0627\u0631\u0633\u06cc \u0648 \u0645\u0648\u062f\u0628\u0627\u0646\u0647 \u067e\u0627\u0633\u062e \u0628\u062f\u0647.', hint: '\u062f\u0633\u062a\u0648\u0631\u0627\u0644\u0639\u0645\u0644 \u0631\u0641\u062a\u0627\u0631 \u0631\u0628\u0627\u062a \u0628\u0647 LLM', position: 6 },
]

