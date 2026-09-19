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
    // Common Persian STT renderings of Latin model letters such as BH20/BH21.
    .replace(/بی\s*اچ\s*پی(?=\s*\d)/g, 'bh')
    .replace(/بى\s*اچ\s*پى(?=\s*\d)/g, 'bh')
    .replace(/بی\s*اچ/g, 'bh')
    .replace(/بى\s*اچ/g, 'bh')
    // Android/Persian STT occasionally renders spoken "بی اچ ۲۰" as PH20/BHP20.
    // Normalize only when the token directly prefixes a numeric model code.
    .replace(/bhp(?=\d)/g, 'bh')
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


export interface ComparableProduct extends GroundedProduct {
  id: string
}

export interface ComparableSpec {
  productId: string
  key: string
  value: string
}

/**
 * Builds deterministic, side-by-side differences from structured DB specs.
 * Cross-product comparison should prefer these facts over free-form synthesis.
 */
export function buildStructuredSpecComparison<T extends ComparableProduct>(
  products: readonly T[],
  specs: readonly ComparableSpec[],
): string[] {
  if (products.length < 2) return []

  const productIds = new Set(products.map((product) => product.id))
  const relevantSpecs = specs.filter((spec) => productIds.has(spec.productId))
  const keys = Array.from(new Set(relevantSpecs.map((spec) => spec.key)))
  const lines: string[] = []

  for (const key of keys) {
    const values = products.map((product) => {
      const spec = relevantSpecs.find(
        (item) => item.productId === product.id && item.key === key,
      )
      return {
        sku: product.sku,
        value: spec?.value?.trim() || 'ثبت نشده',
      }
    })

    const distinct = new Set(values.map((item) => item.value))
    if (distinct.size <= 1) continue

    lines.push(
      `- ${key}: ${values.map((item) => `${item.sku} = ${item.value}`).join(' | ')}`,
    )
  }

  return lines
}


export interface CartDirectiveItem {
  sku: string
  quantity: number
}

export interface CartDirective {
  cleanText: string
  items: CartDirectiveItem[]
}

/**
 * Parses the hidden cart action marker emitted by BEE and strips it from the
 * user-visible reply.
 *
 * Supported forms:
 *   [BEE_CART_ADD:BH21,P100]
 *   [BEE_CART_ADD:BH21*1,P100*2,MG10*3]
 *
 * Quantity is clamped to 1..20. Duplicate SKUs are merged. The narrow grammar
 * prevents arbitrary model text from becoming cart mutations.
 */
export function extractCartDirective(text: string): CartDirective {
  const matches = Array.from(text.matchAll(/\[BEE_CART_ADD:([^\]]+)\]/gi))
  if (matches.length === 0) {
    return { cleanText: text.trim(), items: [] }
  }

  const quantities = new Map<string, number>()

  for (const token of matches.flatMap((match) => (match[1] ?? '').split(','))) {
    const trimmed = token.trim().toUpperCase()
    const parsed = trimmed.match(/^([A-Z0-9_-]{2,32})(?:\*(\d{1,2}))?$/)
    if (!parsed) continue

    const sku = parsed[1]!
    const rawQuantity = parsed[2] ? Number.parseInt(parsed[2], 10) : 1
    const quantity = Math.min(20, Math.max(1, Number.isFinite(rawQuantity) ? rawQuantity : 1))
    quantities.set(sku, Math.min(20, (quantities.get(sku) ?? 0) + quantity))
  }

  const cleanText = text
    .replace(/\s*\[BEE_CART_ADD:[^\]]+\]\s*/gi, '\n')
    // Occasionally the model explains the hidden action in Persian. Strip only
    // bracketed internal-action looking blocks; ordinary cart prose stays visible.
    .replace(/\s*\[\s*(?:ربط|افزودن|اضافه)[^\]]{0,32}سبد\s*خرید\s*:[\s\S]*?\]\s*/gi, '\n')
    .trim()

  return {
    cleanText,
    items: Array.from(quantities, ([sku, quantity]) => ({ sku, quantity })),
  }
}
