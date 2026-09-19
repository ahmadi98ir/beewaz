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


/**
 * Returns the first unambiguous product reference from texts ordered newest
 * first. This is useful for recovering a previously selected product when a
 * terse follow-up such as «تأیید می‌کنم» no longer names the SKU.
 */
export function findLatestSingleMentionedProduct<T extends GroundedProduct>(
  textsNewestFirst: readonly string[],
  products: readonly T[],
): T | null {
  for (const text of textsNewestFirst) {
    const matches = findMentionedProducts(text, products)
    if (matches.length === 1) return matches[0]!
  }

  return null
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

export interface CartSignals {
  cleanText: string
  addItems: CartDirectiveItem[]
  planItems: CartDirectiveItem[]
}

export function canonicalizeSku(text: string): string {
  return normalizeDigits(text)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function parseCartPayloads(payloads: readonly string[]): CartDirectiveItem[] {
  const quantities = new Map<string, number>()

  for (const token of payloads.flatMap((payload) => payload.split(/[,،\n]+/))) {
    const trimmed = token
      .replace(/^[-•\s]+/, '')
      .replace(/\([^)]*\)/g, '')
      .trim()
      .toUpperCase()

    const parsed = trimmed.match(/^([A-Z0-9_-]{2,32})\s*(?:\*|×|X)?\s*(\d{1,2})?$/i)
    if (!parsed) continue

    const sku = canonicalizeSku(parsed[1]!)
    if (!sku) continue

    const rawQuantity = parsed[2] ? Number.parseInt(parsed[2], 10) : 1
    const quantity = Math.min(20, Math.max(1, Number.isFinite(rawQuantity) ? rawQuantity : 1))
    quantities.set(sku, Math.min(20, (quantities.get(sku) ?? 0) + quantity))
  }

  return Array.from(quantities, ([sku, quantity]) => ({ sku, quantity }))
}

function stripInternalCartAnnotations(value: string): string {
  return value
    .replace(/\s*\[BEE_CART_(?:ADD|PLAN):[^\]]+\]\s*/gi, '\n')
    .replace(
      /\s*\[\s*(?:به\s+سبد\s+اضافه\s+می(?:\u200c|\s)*شود|افزودن\s+به\s+سبد(?:\s+خرید)?|اضافه\s+به\s+سبد(?:\s+خرید)?|ربط\s+به\s+سبد\s+خرید)\s*:[\s\S]*?\]\s*/gi,
      '\n',
    )
    .trim()
}

/**
 * Extracts two different hidden channels:
 * - BEE_CART_PLAN: a proposed package that must NOT mutate the cart yet.
 * - BEE_CART_ADD: an explicit purchase action.
 *
 * Keeping proposal state separate from execution prevents short approvals such
 * as «اوکیه» from losing the panel/SKU context or entering a guard loop.
 */
export function extractCartSignals(text: string): CartSignals {
  const addMachineMatches = Array.from(text.matchAll(/\[BEE_CART_ADD:([^\]]+)\]/gi))
  const planMachineMatches = Array.from(text.matchAll(/\[BEE_CART_PLAN:([^\]]+)\]/gi))
  const persianAddMatches = Array.from(text.matchAll(
    /\[\s*(?:به\s+سبد\s+اضافه\s+می(?:\u200c|\s)*شود|افزودن\s+به\s+سبد(?:\s+خرید)?|اضافه\s+به\s+سبد(?:\s+خرید)?|ربط\s+به\s+سبد\s+خرید)\s*:\s*([^\]]+)\]/gi,
  ))

  return {
    cleanText: stripInternalCartAnnotations(text),
    addItems: parseCartPayloads([
      ...addMachineMatches.map((match) => match[1] ?? ''),
      ...persianAddMatches.map((match) => match[1] ?? ''),
    ]),
    planItems: parseCartPayloads(
      planMachineMatches.map((match) => match[1] ?? ''),
    ),
  }
}

/**
 * Backwards-compatible action parser used by existing tests/callers.
 */
export function extractCartDirective(text: string): CartDirective {
  const signals = extractCartSignals(text)
  return {
    cleanText: signals.cleanText,
    items: signals.addItems,
  }
}

export function isCartCommitIntent(text: string): boolean {
  const normalized = normalizeDigits(text)
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200f\u202a-\u202e]/g, ' ')
    .toLocaleLowerCase('fa-IR')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return false

  return (
    /(به\s*سبد|سبد.*(?:اضافه|نهایی)|(?:اضافه|بذار|بزار|قرار).*سبد)/i.test(normalized)
    || /(می\s*خوام\s*بخر|میخوام\s*بخر|بخرش|بخرمش|خریدش\s*کن|نهایی\s*کن)/i.test(normalized)
    || /^(?:آره\s*)?(?:اوکی|باشه|قبوله|موافقم|تایید|تأیید)(?:\s|$)/i.test(normalized)
    || /(همین(?:ه|\s+خوبه|\s+اوکیه)|اگر\s+خودت\s+میگی\s+خوبه)/i.test(normalized)
    || /(?:همون|همان)[^\n]{0,48}(?:بذار|بزار|انتخاب\s*کن|بردار)/i.test(normalized)
  )
}

export function hasCartPlanModificationIntent(text: string): boolean {
  const normalized = normalizeDigits(text)
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200f\u202a-\u202e]/g, ' ')
    .toLocaleLowerCase('fa-IR')

  return /(حذف|کمتر|بیشتر|یکی\s+دیگه|یک\s+دونه\s+دیگه|عوض|تغییر|بدون|به\s*جاش|جایگزین)/i.test(normalized)
}

