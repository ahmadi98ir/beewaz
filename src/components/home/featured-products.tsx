import Link from 'next/link'
import Image from 'next/image'
import { db } from '@/lib/db'
import { products, categories, productImages } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { formatPrice } from '@/lib/utils'
import { AnimateIn } from '@/components/ui/animate-in'

export async function FeaturedProducts() {
  let items: { id: string; nameFa: string; slug: string; price: number; comparePrice: number | null; categorySlug: string | null; imageUrl: string | null }[] = []
  try {
    const rows = await db.select({ id: products.id, nameFa: products.nameFa, slug: products.slug, price: products.price, comparePrice: products.comparePrice, categorySlug: categories.slug, imageUrl: productImages.url })
      .from(products).leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(productImages, eq(productImages.productId, products.id))
      .where(eq(products.status, 'active')).orderBy(desc(products.createdAt)).limit(8)
    const seen = new Set<string>()
    for (const row of rows) { if (!seen.has(row.id)) { seen.add(row.id); items.push(row) } }
  } catch { return null }
  if (items.length === 0) return null

  return (
    <section className="py-14 sm:py-20 bg-surface-50">
      <div className="container-page">
        <AnimateIn direction="up" className="flex items-end justify-between mb-8">
          <div>
            <div className="orange-divider mb-3" />
            <h2 className="text-2xl sm:text-3xl font-black text-surface-900 mb-1">محصولات برتر</h2>
            <p className="text-surface-400 text-sm">محبوب‌ترین دزدگیرهای بیواز</p>
          </div>
          <Link href="/shop" className="text-sm font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors">
            همه محصولات
            <svg viewBox="0 0 20 20" className="w-4 h-4 rotate-180" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
          </Link>
        </AnimateIn>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item, i) => {
            const dirs: ('left'|'up'|'right')[] = ['left','up','up','right','left','up','up','right']
            const dir = dirs[i % dirs.length] ?? 'up'
            const href = item.categorySlug ? `/shop/${item.categorySlug}/${item.slug}` : `/shop/${item.slug}`
            const discount = item.comparePrice && item.comparePrice > item.price
              ? Math.round(((item.comparePrice - item.price) / item.comparePrice) * 100) : 0
            return (
              <AnimateIn key={item.id} direction={dir} delay={i * 60}>
                <Link href={href} className="group bg-white rounded-2xl border border-surface-100 overflow-hidden hover:shadow-lg hover:border-brand-200 transition-all duration-300 hover-lift block">
                  <div className="relative aspect-square bg-surface-50 overflow-hidden">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.nameFa}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-cover group-hover:scale-108 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl opacity-25">📦</div>
                    )}
                    {discount > 0 && (
                      <span className="absolute top-2 start-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{discount}٩ تخفیف</span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-surface-800 line-clamp-2 mb-3 group-hover:text-brand-700 transition-colors leading-relaxed">{item.nameFa}</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="font-black text-surface-900 text-base">{formatPrice(item.price)}</span>
                      {item.comparePrice && item.comparePrice > item.price && (
                        <span className="text-xs text-surface-400 line-through">{formatPrice(item.comparePrice)}</span>
                      )}
                    </div>
                  </div>
                </Link>
              </AnimateIn>
            )
          })}
        </div>
      </div>
    </section>
  )
}
