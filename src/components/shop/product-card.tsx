'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { ShoppingCartIcon, HeartIcon } from '@/components/ui/icons'
import { formatPrice, discountPercent, toFaDigits } from '@/lib/utils'
import { useCart } from '@/stores/cart'
import { useToast } from '@/stores/toast'
import { useQuickView } from '@/stores/quick-view'
import { useWishlist } from '@/stores/wishlist'
import { ProductSvgIcon } from '@/components/shop/product-svg-icon'
import type { ShopProduct } from '@/lib/shop-product'

type Props = {
  product: ShopProduct
  view?: 'grid' | 'list'
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`امتیاز ${rating} از ۵`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          viewBox="0 0 12 12"
          className={`w-3 h-3 ${i < Math.floor(rating) ? 'text-amber-400' : 'text-surface-200'}`}
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M6 0l1.5 4H12L8.5 7l1.5 4L6 9l-4 2 1.5-4L0 4h4.5z" />
        </svg>
      ))}
    </div>
  )
}

export function ProductCard({ product, view = 'grid' }: Props) {
  const addItem = useCart((s) => s.addItem)
  const toast = useToast()
  const showQuickView = useQuickView((s) => s.show)
  const { status } = useSession()
  const wishlisted = useWishlist((s) => s.ids.has(product.id))
  const addWish = useWishlist((s) => s.add)
  const removeWish = useWishlist((s) => s.remove)

  const hasDiscount = !!product.comparePrice
  const discount = hasDiscount ? discountPercent(product.price, product.comparePrice!) : 0
  const isLowStock = product.stock > 0 && product.stock <= 5

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    if (status !== 'authenticated') {
      window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`
      return
    }
    if (wishlisted) {
      removeWish(product.id)
      fetch(`/api/wishlist?productId=${product.id}`, { method: 'DELETE' }).catch(() => {})
    } else {
      addWish(product.id)
      toast.success(`${product.nameFa} به علاقه‌مندی‌ها اضافه شد`, {
        label: 'مشاهده لیست ←',
        onClick: () => { window.location.href = '/profile?tab=wishlist' },
      })
      fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id }),
      }).catch(() => {})
    }
  }

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    if (product.stock === 0) return
    addItem({
      id: product.id,
      slug: product.slug,
      categorySlug: product.categorySlug,
      nameFa: product.nameFa,
      sku: product.sku,
      price: product.price,
      comparePrice: product.comparePrice,
      placeholderFrom: product.placeholderFrom,
      placeholderTo: product.placeholderTo,
    })
    toast.success(`${product.nameFa} به سبد اضافه شد`, {
      label: 'ادامه و پرداخت ←',
      onClick: () => { window.location.href = '/checkout' },
    })
  }

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault()
    showQuickView(product)
  }

  const href = `/shop/${product.categorySlug || 'products'}/${product.slug}`

  if (view === 'list') {
    return (
      <div className="card hover-lift flex flex-col sm:flex-row overflow-hidden group">
        <Link href={href} className="flex-shrink-0 sm:w-52">
          <ProductImage product={product} className="aspect-square sm:aspect-auto sm:h-full" />
        </Link>

        <div className="flex flex-col flex-1 p-5 gap-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-brand-600 mb-1 block">
                {product.categoryName}
              </span>
              <Link href={href}>
                <h3 className="font-bold text-surface-900 hover:text-brand-600 transition-colors leading-snug">
                  {product.nameFa}
                </h3>
              </Link>
            </div>
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <span className="text-xs text-surface-400 font-mono">{product.sku}</span>
              <button
                onClick={handleToggleWishlist}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  wishlisted ? 'text-red-500' : 'text-surface-300 hover:text-brand-600'
                }`}
                aria-label={wishlisted ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
              >
                <HeartIcon size={16} fill={wishlisted ? 'currentColor' : 'none'} />
              </button>
            </div>
          </div>

          {product.descriptionFa && (
            <p className="text-sm text-surface-500 leading-relaxed line-clamp-2">
              {product.descriptionFa}
            </p>
          )}

          {product.reviewCount > 0 && (
            <div className="flex items-center gap-3">
              <StarRating rating={product.rating} />
              <span className="text-xs text-surface-400">({product.reviewCount} نظر)</span>
            </div>
          )}

          <div className="flex items-center justify-between mt-auto pt-3 border-t border-surface-100">
            <div>
              <div className="text-xl font-black text-surface-900">
                {formatPrice(product.price)}
              </div>
              {hasDiscount && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm text-surface-400 line-through">
                    {formatPrice(product.comparePrice!)}
                  </span>
                  <span className="badge badge-brand text-xs">{discount}٪ تخفیف</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleQuickView}
                className="btn btn-ghost py-2.5 px-4 text-sm text-surface-600"
              >
                مشاهده سریع
              </button>
              <button
                onClick={handleAddToCart}
                disabled={product.stock === 0}
                className="btn btn-primary py-2.5 px-5 text-sm gap-2"
              >
                <ShoppingCartIcon size={16} />
                {product.stock === 0 ? 'ناموجود' : 'افزودن به سبد'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card hover-lift group relative flex flex-col">
      {/* تصویر محصول */}
      <div className="relative overflow-hidden">
        <Link href={href} tabIndex={-1}>
          <ProductImage product={product} className="aspect-square" />
        </Link>

        {/* Badges */}
        <div className="absolute top-3 start-3 flex flex-col gap-1.5">
          {product.isNew && (
            <span className="inline-flex px-2.5 py-1 text-xs font-bold rounded-lg bg-surface-900 text-white">
              جدید
            </span>
          )}
          {hasDiscount && (
            <span className="inline-flex px-2.5 py-1 text-xs font-bold rounded-lg text-white badge-accent">
              {discount}٪ تخفیف
            </span>
          )}
        </div>

        {/* دکمه‌های hover */}
        <div className="absolute top-3 end-3 flex flex-col gap-1.5">
          <button
            onClick={handleToggleWishlist}
            className={`w-8 h-8 rounded-xl bg-white/90 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:scale-110 ${
              wishlisted
                ? 'text-red-500 opacity-100'
                : 'text-surface-400 hover:text-brand-600 opacity-0 group-hover:opacity-100'
            }`}
            aria-label={wishlisted ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
          >
            <HeartIcon size={16} fill={wishlisted ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={handleQuickView}
            className="w-8 h-8 rounded-xl bg-white/90 backdrop-blur-sm flex items-center justify-center text-surface-400 hover:text-brand-600 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110 delay-75"
            aria-label="مشاهده سریع"
          >
            <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M1 10C1 10 4 4 10 4s9 6 9 6-3 6-9 6-9-6-9-6z" strokeLinecap="round" />
              <circle cx="10" cy="10" r="2.5" />
            </svg>
          </button>
        </div>

        {/* دکمه افزودن به سبد روی تصویر */}
        <div className="absolute inset-x-0 bottom-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-250">
          <button
            onClick={handleAddToCart}
            disabled={product.stock === 0}
            className="btn btn-accent w-full py-2.5 text-sm gap-2 shadow-lg disabled:opacity-60"
          >
            <ShoppingCartIcon size={15} />
            {product.stock === 0 ? 'ناموجود' : 'افزودن به سبد'}
          </button>
        </div>

        {isLowStock && (
          <div className="absolute bottom-3 start-3 end-3 group-hover:opacity-0 transition-opacity">
            <div className="bg-amber-50 text-amber-700 text-xs font-semibold text-center py-1.5 px-3 rounded-lg border border-amber-200">
              فقط {toFaDigits(product.stock)} عدد باقی مانده
            </div>
          </div>
        )}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
            <span className="bg-surface-900 text-white text-sm font-bold px-5 py-2 rounded-xl">
              ناموجود
            </span>
          </div>
        )}
      </div>

      {/* اطلاعات محصول */}
      <div className="p-4 flex flex-col flex-1 gap-2">
        {product.categoryName && (
          <span className="text-xs font-semibold text-brand-600">{product.categoryName}</span>
        )}

        <Link href={href}>
          <h3 className="text-sm font-bold text-surface-900 hover:text-brand-600 transition-colors leading-snug line-clamp-2">
            {product.nameFa}
          </h3>
        </Link>

        {product.reviewCount > 0 && (
          <div className="flex items-center gap-2">
            <StarRating rating={product.rating} />
            <span className="text-xs text-surface-400">({product.reviewCount})</span>
          </div>
        )}

        <div className="mt-auto pt-2 border-t border-surface-50">
          {hasDiscount && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-surface-400 line-through block">
                {formatPrice(product.comparePrice!)}
              </span>
              <span className="badge-accent text-xs px-1.5 py-0.5 rounded font-bold">{discount}٪</span>
            </div>
          )}
          <span
            className={`font-black text-base ${hasDiscount ? '' : 'text-surface-900'}`}
            style={hasDiscount ? { color: '#F97316' } : undefined}
          >
            {formatPrice(product.price)}
          </span>
        </div>
      </div>
    </div>
  )
}

function ProductImage({ product, className = '' }: { product: ShopProduct; className?: string }) {
  const firstImage = product.images?.[0]

  if (firstImage) {
    return (
      <div
        className={`w-full relative overflow-hidden transition-transform duration-500 group-hover:scale-105 ${className}`}
        style={{ background: `linear-gradient(135deg, ${product.placeholderFrom} 0%, ${product.placeholderTo} 100%)` }}
      >
        <Image
          src={firstImage.url}
          alt={firstImage.alt ?? product.nameFa}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 220px"
          className="object-contain p-3"
        />
      </div>
    )
  }

  return (
    <div
      className={`w-full relative transition-transform duration-500 group-hover:scale-105 ${className}`}
      style={{
        background: `linear-gradient(135deg, ${product.placeholderFrom} 0%, ${product.placeholderTo} 100%)`,
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <ProductSvgIcon
          categorySlug={product.categorySlug}
          size={80}
          className="text-surface-500/60"
        />
      </div>
    </div>
  )
}
