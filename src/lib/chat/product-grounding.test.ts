import { describe, expect, it } from 'vitest'
import {
  buildStructuredSpecComparison,
  canonicalizeSku,
  extractCartDirective,
  extractCartSignals,
  hasCartPlanModificationIntent,
  inferCartPlanFromAssistantText,
  isCartCommitIntent,
  isExplicitCartPurchaseIntent,
  findMentionedProducts,
  findLatestSingleMentionedProduct,
  normalizeProductReferenceText,
  productAvailabilityLabel,
  type GroundedProduct,
} from './product-grounding'

const PRODUCTS: GroundedProduct[] = [
  { sku: 'BH20', name: 'دستگاه دزدگیر BH20 بیواز', stock: 4, status: 'active' },
  { sku: 'BH21', name: 'دستگاه دزدگیر BH21 بیواز', stock: 2, status: 'active' },
  { sku: 'MG10', name: 'مگنت سیمی بیواز MG10', stock: 50, status: 'active' },
  { sku: 'P100', name: 'چشمی حرکتی بیواز P100', stock: 20, status: 'active' },
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

  it('does not truncate legitimate quantities above twenty', () => {
    const parsed = extractCartDirective('[BEE_CART_ADD:MG10*25]')
    expect(parsed.items).toEqual([
      { sku: 'MG10', quantity: 25 },
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


  it('canonicalizes cosmetic SKU punctuation', () => {
    expect(canonicalizeSku('BH-21')).toBe('BH21')
    expect(canonicalizeSku(' bh 21 ')).toBe('BH21')
  })

  it('parses the Persian cart annotation seen in production', () => {
    const parsed = extractCartDirective(
      'حالا این ترکیب را به سبد خرید اضافه می‌کنم. [به سبد اضافه می‌شود: BH-21*1,MG10*8,P100*1]',
    )
    expect(parsed.cleanText).toBe('حالا این ترکیب را به سبد خرید اضافه می‌کنم.')
    expect(parsed.items).toEqual([
      { sku: 'BH21', quantity: 1 },
      { sku: 'MG10', quantity: 8 },
      { sku: 'P100', quantity: 1 },
    ])
  })


  it('parses and strips a provider-wrapped BEE_CART_ADD marker', () => {
    const parsed = extractCartDirective(
      'حالا ترکیب رو اضافه می‌کنم. [وارد سبد خرید می‌کنم: BEE_CART_ADD:BH-21*1,MG10*8,P100*1]',
    )
    expect(parsed.cleanText).toBe('حالا ترکیب رو اضافه می‌کنم.')
    expect(parsed.items).toEqual([
      { sku: 'BH21', quantity: 1 },
      { sku: 'MG10', quantity: 8 },
      { sku: 'P100', quantity: 1 },
    ])
  })

  it('recovers the exact package from a visible assistant recommendation', () => {
    const inferred = inferCartPlanFromAssistantText(
      [
        'ترکیب نهایی برای خرید:',
        '1. پنل دزدگیر BH21: ۲۰٬۹۰۰٬۰۰۰ تومان',
        '2. مگنت سیمی: ۸ عدد (۲۹۰٬۰۰۰ تومان برای هر کدوم)',
        '3. چشمی حرکتی P100: ۱ عدد',
      ].join('\n'),
      PRODUCTS,
    )

    expect(inferred).toEqual([
      { sku: 'BH21', quantity: 1 },
      { sku: 'MG10', quantity: 8 },
      { sku: 'P100', quantity: 1 },
    ])
  })


  it('keeps a proposed package separate from cart execution', () => {
    const parsed = extractCartSignals(
      'این ترکیب پیشنهادی منه. [BEE_CART_PLAN:BH21*1,MG10*8,P100*2]',
    )

    expect(parsed.cleanText).toBe('این ترکیب پیشنهادی منه.')
    expect(parsed.addItems).toEqual([])
    expect(parsed.planItems).toEqual([
      { sku: 'BH21', quantity: 1 },
      { sku: 'MG10', quantity: 8 },
      { sku: 'P100', quantity: 2 },
    ])
  })

  it('recognizes terse approvals only as commit intent when a plan exists upstream', () => {
    expect(isCartCommitIntent('خوب اوکیه اگر خودت میگی خوبه برام')).toBe(true)
    expect(isCartCommitIntent('آره موافقم می‌خوام بخرمش')).toBe(true)
    expect(isCartCommitIntent('اوکی سبد نهایی کن')).toBe(true)
    expect(isCartCommitIntent('پنلم همون چیزی که فکر می‌کنی خوبه رو بذار')).toBe(true)
    expect(isCartCommitIntent('باشه خوبه همینو برام بذار می‌برم')).toBe(true)
    expect(isCartCommitIntent('قیمت این پکیج چنده؟')).toBe(false)
  })


  it('does not treat conversational acknowledgements as standalone purchase intent', () => {
    expect(isExplicitCartPurchaseIntent('اوکی چی پیشنهاد میدی؟')).toBe(false)
    expect(isExplicitCartPurchaseIntent('باشه')).toBe(false)
    expect(isExplicitCartPurchaseIntent('اوکی')).toBe(false)
    expect(isExplicitCartPurchaseIntent('اوکی همینو برام بذار تو سبد')).toBe(true)
    expect(isExplicitCartPurchaseIntent('باشه خوبه همینو برام بذار می‌برم')).toBe(true)
    expect(isExplicitCartPurchaseIntent('می‌خوام بخرمش')).toBe(true)
  })

  it('detects plan modifications separately from plain approval', () => {
    expect(hasCartPlanModificationIntent('اوکی فقط یه چشمی دیگه اضافه کن')).toBe(true)
    expect(hasCartPlanModificationIntent('باشه همین خوبه')).toBe(false)
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
