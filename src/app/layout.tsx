import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import Script from 'next/script'
import { getSiteSettings } from '@/lib/cms'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { ChatWidget } from '@/components/chat/chat-widget'
import { Bee } from '@/components/bee/Bee'
import { BeeChatStateProvider } from '@/components/bee/BeeChatState'
import { ToastContainer } from '@/components/ui/toast'
import { PageTransition } from '@/components/ui/page-transition'
import { QuickViewModal } from '@/components/shop/quick-view-modal'
import { FloatingCart } from '@/components/layout/floating-cart'
import { FloatingCartButton } from '@/components/layout/floating-cart-button'
import { AppSessionProvider } from '@/components/providers/session-provider'
import { PageTracker } from '@/components/analytics/page-tracker'
import { CartTracker } from '@/components/analytics/cart-tracker'
import { WishlistSync } from '@/components/shop/wishlist-sync'
import './globals.css'

export const metadata: Metadata = {
  title: {
    template: '%s | بیواز',
    default: 'بیواز — سیستم دزدگیر اماکن و منزل',
  },
  description:
    'خرید آنلاین سیستم دزدگیر، حسگر، سیرن و تجهیزات امنیتی اماکن تجاری و مسکونی. ارسال سریع، گارانتی اصل و پشتیبانی ۲۴ ساعته.',
  keywords: ['دزدگیر', 'سیستم امنیتی', 'حسگر حرکتی', 'سیرن', 'دوربین مداربسته'],
  authors: [{ name: 'بیواز' }],
  creator: 'بیواز',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'fa_IR',
    siteName: 'بیواز',
  },
  twitter: { card: 'summary_large_image' },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'بیواز',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  themeColor: '#1B3A8A',
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''
  const isAdmin = pathname.startsWith('/admin')

  const settings = isAdmin ? {} : await getSiteSettings()
  const gaEnabled = settings.ga4_enabled === 'true' && !!settings.ga4_measurement_id
  const gtmId = settings.gtm_container_id
  const siteVerification = settings.google_site_verification

  return (
    <html lang="fa" dir="rtl">
      <head>
        <link
          rel="preconnect"
          href="https://cdn.jsdelivr.net"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css"
        />
        {siteVerification && (
          <meta name="google-site-verification" content={siteVerification} />
        )}
        {gaEnabled && (
          <>
            <Script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${settings.ga4_measurement_id}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${settings.ga4_measurement_id}');`}
            </Script>
          </>
        )}
        {gaEnabled && gtmId && (
          <Script id="gtm-init" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
          </Script>
        )}
      </head>
      <body className={`antialiased font-sans ${isAdmin ? 'bg-surface-50' : 'min-h-screen flex flex-col bg-surface-50'}`}>
        {isAdmin ? (
          // admin shell — sidebar layout is handled by /admin/layout.tsx
          <>
            {children}
            <ToastContainer />
          </>
        ) : (
          // public site
          <AppSessionProvider>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-brand-600 focus:text-white focus:font-semibold focus:shadow-lg"
            >
              پرش به محتوای اصلی
            </a>
            <Header />
            <main className="flex-1" id="main-content">
              <PageTransition>{children}</PageTransition>
            </main>
            <Footer />
            <BeeChatStateProvider>
              <ChatWidget />
              <Bee />
            </BeeChatStateProvider>
            <QuickViewModal />
            <FloatingCart />
            <FloatingCartButton />
            <ToastContainer />
            <PageTracker />
            <CartTracker />
            <WishlistSync />
          </AppSessionProvider>
        )}
      </body>
    </html>
  )
}
