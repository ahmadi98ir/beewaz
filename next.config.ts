import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // خروجی standalone برای Docker (Dockerfile.ci)
  output: 'standalone',

  // فعال‌سازی experimental ها
  experimental: {
    // Server Actions با body سایز بالاتر برای آپلود تصاویر محصول
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // typedRoutes: disabled — codebase uses dynamic router.push(string) extensively
  },

  // تنظیمات تصاویر — Liara Bucket یا CDN ایرانی
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.liara.run' },
      { protocol: 'https', hostname: '*.arvanstorage.ir' },
      { protocol: 'https', hostname: 'cdn.beewaz.ir' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 روز
  },

  // امنیت Header ها
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            // Phase E: microphone is allowed only for this origin and is still
            // user-permission gated by the browser. Camera remains disabled.
            value: 'camera=(), microphone=(self), geolocation=(self)',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },

  // Redirects برای مهاجرت از سایت قدیم — بعداً پر می‌کنیم
  async redirects() {
    return [
      // مثال:
      // { source: '/old-product', destination: '/products/bh11', permanent: true },
    ]
  },
}

export default nextConfig
