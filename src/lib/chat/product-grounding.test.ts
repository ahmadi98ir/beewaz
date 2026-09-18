import { describe, expect, it } from 'vitest'
import {
  findMentionedProducts,
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

  it('distinguishes visible zero-stock products from purchasable products', () => {
    expect(productAvailabilityLabel(PRODUCTS[0]!)).toContain('موجود برای خرید')
    expect(productAvailabilityLabel({ ...PRODUCTS[1]!, stock: 0 })).toBe(
      'فعال در سایت، اما موجودی انبار صفر',
    )
  })
})
