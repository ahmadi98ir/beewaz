export interface GroundedProduct {
  sku: string
  name: string
  stock: number
  status: 'active' | 'out_of_stock'
}

function normalizeDigits(text: string): string {
  const persian = '۰۱۲۳۴۵۶۷۸۹'
  const arabic = '٠١٢٣٤٥٦٧٨٩'

  return Array.from(text).map((char) => {
    const p = persian.indexOf(char)
    if (p >= 0) return String(p)
    const a = arabic.indexOf(char)
    if (a >= 0) return String(a)
    return char
  }).join('')
}

export function normalizeProductReferenceText(text: string): string {
  return normalizeDigits(text)
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .toLocaleLowerCase('fa-IR')
    // Common Persian STT rendering of Latin model letters such as BH20/BH21.
    .replace(/بی\s*اچ/g, 'bh')
    .replace(/بى\s*اچ/g, 'bh')
    // Android/Persian STT occasionally renders spoken "بی اچ ۲۰" as "PH20".
    // Only normalize PH when it directly prefixes a numeric model code.
    .replace(/ph(?=\d)/g, 'bh')
    .replace(/[\u200c\u200f\u202a-\u202e]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

export function findMentionedProducts<T extends GroundedProduct>(
  text: string,
  products: readonly T[],
): T[] {
  const normalizedText = normalizeProductReferenceText(text)
  if (!normalizedText) return []

  return products.filter((product) => {
    const normalizedSku = normalizeProductReferenceText(product.sku)
    const normalizedName = normalizeProductReferenceText(product.name)

    if (normalizedSku.length >= 3 && normalizedText.includes(normalizedSku)) return true
    if (normalizedName.length >= 6 && normalizedText.includes(normalizedName)) return true
    return false
  })
}

export function productAvailabilityLabel(product: GroundedProduct): string {
  if (product.status === 'out_of_stock') return 'ناموجود'
  if (product.stock <= 0) return 'فعال در سایت، اما موجودی انبار صفر'
  return `موجود برای خرید (موجودی ثبت‌شده: ${product.stock})`
}
