import { describe, expect, it } from 'vitest'
import {
  buildStructuredSpecComparison,
  extractCartDirective,
  findMentionedProducts,
  findLatestSingleMentionedProduct,
  normalizeProductReferenceText,
  productAvailabilityLabel,
  type GroundedProduct,
} from './product-grounding'

const PRODUCTS: GroundedProduct[] = [
  { sku: 'BH20', name: 'دستگاه دزدگیر BH20 بیواز', stock: 4, status: 'active' },
  { sku: 'BH21', name: 'دستگاه دزدگیر BH21 بیواز', stock: 2, status: 'active' },
]

describe('product grounding helpers', () => {
  it('normalizes spoken Persian model names and Persian digits', () => {
    expect(normalizeProductReferenceText('بی اچ ۲۱')).toBe('bh21')
  })

  it('finds a product mentioned by spoken model code', () => {
    const matches = findMentionedProducts('چرا دستگاه بی اچ ۲۱ رو پیشنهاد ندادی؟', PRODUCTS)
    expect(matches.map((product) => product.sku)).toEqual(['BH21'])
  })

  it('recovers PH model codes produced by mobile STT', () => {
    const matches = findMentionedProducts('مدل BH۲۱ با PH۲۰ چه فرقی دارند؟', PRODUCTS)
    expect(matches.map((product) => product.sku)).toEqual(['BH20', 'BH21'])
  })

  it('recovers BHP model codes produced by mobile STT', () => {
    const matches = findMentionedProducts('پنل bh۲۱ و پنل bhp۲۰', PRODUCTS)
    expect(matches.map((product) => product.sku)).toEqual(['BH20', 'BH21'])
  })


  it('recovers the most recent unambiguous panel from follow-up context', () => {
    const selected = findLatestSingleMentionedProduct(
      [
        'ترکیب نهایی به سبد اضافه می‌شود.',
        'من پنل BH21 رو برای این ترکیب انتخاب می‌کنم.',
        'بین BH20 و BH21 کدوم بهتره؟',
      ],
      PRODUCTS,
    )

    expect(selected?.sku).toBe('BH21')
  })

  it('skips ambiguous messages and keeps searching older context', () => {
    const selected = findLatestSingleMentionedProduct(
      [
        'BH20 و BH21 هر دو موجودند.',
        'برای این پکیج BH21 رو انتخاب می‌کنم.',
      ],
      PRODUCTS,
    )

    expect(selected?.sku).toBe('BH21')
  })


  it('builds only structured differences for product comparison', () => {
    const products = [
      { ...PRODUCTS[0]!, id: 'p20' },
      { ...PRODUCTS[1]!, id: 'p21' },
    ]
    const lines = buildStructuredSpecComparison(products, [
      { productId: 'p20', key: 'زون‌های سیمی', value: '5 عدد' },
      { productId: 'p21', key: 'زون‌های سیمی', value: '9 عدد' },
      { productId: 'p20', key: 'نمایشگر', value: 'LCD رنگی' },
      { productId: 'p21', key: 'نمایشگر', value: 'LCD رنگی' },
    ])

    expect(lines).toEqual([
      '- زون‌های سیمی: BH20 = 5 عدد | BH21 = 9 عدد',
    ])
  })


  it('extracts and strips a narrow cart directive', () => {
    const parsed = extractCartDirective(
      'این سه مورد رو برات انتخاب کردم. [BEE_CART_ADD:BH21,P100,MG10]',
    )
    expect(parsed.cleanText).toBe('این سه مورد رو برات انتخاب کردم.')
    expect(parsed.items).toEqual([
      { sku: 'BH21', quantity: 1 },
      { sku: 'P100', quantity: 1 },
      { sku: 'MG10', quantity: 1 },
    ])
  })

  it('ignores malformed cart directive SKUs', () => {
    const parsed = extractCartDirective('[BEE_CART_ADD:BH21,../../bad,P100]')
    expect(parsed.items).toEqual([
      { sku: 'BH21', quantity: 1 },
      { sku: 'P100', quantity: 1 },
    ])
  })

  it('parses quantities and merges duplicate SKUs', () => {
    const parsed = extractCartDirective(
      '[BEE_CART_ADD:BH21*1,P100*2,MG10*3,P100*1]',
    )
    expect(parsed.items).toEqual([
      { sku: 'BH21', quantity: 1 },
      { sku: 'P100', quantity: 3 },
      { sku: 'MG10', quantity: 3 },
    ])
  })

  it('strips bracketed Persian internal cart-action explanations', () => {
    const parsed = extractCartDirective(
      'ترکیب آماده شد. [ربط به سبد خرید:\n- BH20 * 1\n- MG10 * 7]',
    )
    expect(parsed.cleanText).toBe('ترکیب آماده شد.')
  })

  it('distinguishes visible zero-stock products from purchasable products', () => {
    expect(productAvailabilityLabel(PRODUCTS[0]!)).toContain('موجود برای خرید')
    expect(productAvailabilityLabel({ ...PRODUCTS[1]!, stock: 0 })).toBe(
      'فعال در سایت، اما موجودی انبار صفر',
    )
  })
})
