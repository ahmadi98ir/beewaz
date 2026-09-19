import { canonicalizeSku } from './product-grounding'
import {
  classifySecurityProduct,
  getPanelWiredZoneCapacity,
  isWiredSecurityProduct,
} from './security-system-builder'

export interface DeterministicPackageProduct {
  id: string
  sku: string
  name: string
  price: number
  stock: number
  status: 'active' | 'out_of_stock'
  category?: string | null
  categorySlug?: string | null
  description?: string | null
  specs?: Array<{ key: string; value: string }>
}

export interface SecurityNeeds {
  areaM2: number | null
  doors: number | null
  windows: number | null
  motionAreas: number | null
  wiringPreference: 'wired' | 'wireless' | 'unknown'
  novice: boolean
}

export interface DeterministicPackageItem {
  product: DeterministicPackageProduct
  quantity: number
}

export type DeterministicPackagePlan =
  | {
      status: 'needs_input'
      needs: SecurityNeeds
      question: string
    }
  | {
      status: 'unsupported'
      needs: SecurityNeeds
      message: string
    }
  | {
      status: 'ready'
      needs: SecurityNeeds
      items: DeterministicPackageItem[]
      wiredDetectorCount: number
      panelWiredCapacity: number
      totalPrice: number
    }

const WORD_NUMBERS: Record<string, number> = {
  'یک': 1,
  'یه': 1,
  'دو': 2,
  'سه': 3,
  'چهار': 4,
  'پنج': 5,
  'شش': 6,
  'هفت': 7,
  'هشت': 8,
  'نه': 9,
  'ده': 10,
  'یازده': 11,
  'دوازده': 12,
  'سیزده': 13,
  'چهارده': 14,
  'پانزده': 15,
  'شانزده': 16,
  'هفده': 17,
  'هجده': 18,
  'نوزده': 19,
  'بیست': 20,
}

function toAsciiDigits(text: string): string {
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

function normalizeText(text: string): string {
  return toAsciiDigits(text)
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200f\u202a-\u202e]/g, ' ')
    .toLocaleLowerCase('fa-IR')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseCountToken(token: string | undefined): number | null {
  if (!token) return null
  if (/^\d+$/.test(token)) {
    const value = Number.parseInt(token, 10)
    return Number.isFinite(value) ? value : null
  }
  return WORD_NUMBERS[token] ?? null
}

function findCount(
  text: string,
  nounPattern: string,
): number | null {
  const normalized = normalizeText(text)
  const numberToken = '(\\d{1,2}|یک|یه|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|یازده|دوازده|سیزده|چهارده|پانزده|شانزده|هفده|هجده|نوزده|بیست)'
  const match = normalized.match(
    new RegExp(numberToken + '\\s*(?:تا|عدد)?\\s*(?:' + nounPattern + ')', 'i'),
  )
  return parseCountToken(match?.[1])
}

function findArea(text: string): number | null {
  const normalized = normalizeText(text)
  const match = normalized.match(/(\d{2,4})\s*(?:متر\s*مربع|مترمربع|متری|متر)/i)
  if (!match) return null
  const value = Number.parseInt(match[1]!, 10)
  return Number.isFinite(value) && value > 0 ? value : null
}

export function extractSecurityNeeds(messages: readonly string[]): SecurityNeeds {
  const needs: SecurityNeeds = {
    areaM2: null,
    doors: null,
    windows: null,
    motionAreas: null,
    wiringPreference: 'unknown',
    novice: false,
  }

  for (const raw of messages) {
    const normalized = normalizeText(raw)

    const area = findArea(normalized)
    if (area !== null) needs.areaM2 = area

    const doors = findCount(normalized, '(?:در|درب)(?:\\s*ورودی)?')
    if (doors !== null) needs.doors = doors

    const windows = findCount(normalized, 'پنجره')
    if (windows !== null) needs.windows = windows

    const motionAreas = findCount(normalized, '(?:سالن|فضا(?:ی)?\\s*اصلی|اتاق)')
    if (motionAreas !== null) needs.motionAreas = motionAreas

    if (/(بی\s*سیم|بیسیم|wireless)/i.test(normalized)) {
      needs.wiringPreference = 'wireless'
    } else if (/(سیمی|wired)/i.test(normalized)) {
      needs.wiringPreference = 'wired'
    }

    if (/(هیچی.*سر.*در|هیچ.*اطلاع|نمی\s*دونم|نمیدونم|سر\s*در\s*نمیارم|مبتدی)/i.test(normalized)) {
      needs.novice = true
    }
  }

  return needs
}

export function isSecurityPackageConversation(messages: readonly string[]): boolean {
  const normalized = normalizeText(messages.slice(-8).join(' '))
  const property = /(خونه|خانه|آپارتمان|ویلا|مغازه|فروشگاه|دفتر|ملک)/i.test(normalized)
  const security = /(دزدگیر|سیستم\s*حفاظتی|سیستم\s*امنیتی|پکیج|سنسور|حسگر|پنل)/i.test(normalized)
  return property && security
}

export function isPackageRecommendationIntent(text: string): boolean {
  const normalized = normalizeText(text)
  return /(پیشنهاد|چی\s*(?:بگیر|بخر|پیشنهاد)|خودت|مناسب|کامل|پکیج|سیستم|راهنما)/i.test(normalized)
}


export function isPackageRequirementsUpdate(text: string): boolean {
  const normalized = normalizeText(text)
  const numberToken = '(?:\\d{1,2}|یک|یه|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|یازده|دوازده|سیزده|چهارده|پانزده|شانزده|هفده|هجده|نوزده|بیست)'
  const hasOpeningCount = new RegExp(
    numberToken + '\\s*(?:تا|عدد)?\\s*(?:پنجره|(?:در|درب)(?:\\s*ورودی)?)',
    'i',
  ).test(normalized)
  const changesWiring = /(بی\s*سیم|بیسیم|سیمی|wireless|wired)/i.test(normalized)

  return hasOpeningCount || changesWiring
}

function activeProducts(
  products: readonly DeterministicPackageProduct[],
): DeterministicPackageProduct[] {
  return products.filter((product) => product.status === 'active' && product.stock > 0)
}

function preferredProduct(
  products: readonly DeterministicPackageProduct[],
  preferredSku: string,
): DeterministicPackageProduct | null {
  const preferred = products.find(
    (product) => canonicalizeSku(product.sku) === canonicalizeSku(preferredSku),
  )
  if (preferred) return preferred
  return products.slice().sort((a, b) => a.price - b.price)[0] ?? null
}

export function buildDeterministicSecurityPackage(
  products: readonly DeterministicPackageProduct[],
  needs: SecurityNeeds,
): DeterministicPackagePlan {
  if (needs.doors === null && needs.windows === null) {
    return {
      status: 'needs_input',
      needs,
      question: 'فقط تعداد درهای ورودی و پنجره‌های قابل‌دسترسی رو بهم بگو؛ بقیه انتخاب‌ها با من.',
    }
  }

  if (needs.doors === null) {
    return {
      status: 'needs_input',
      needs,
      question: 'فقط بگو چند تا در ورودی داری؛ بقیه‌ش با من.',
    }
  }

  if (needs.windows === null) {
    return {
      status: 'needs_input',
      needs,
      question: 'فقط بگو چند تا پنجره قابل‌دسترسی داری؛ بقیه‌ش با من.',
    }
  }

  if (needs.wiringPreference === 'wireless') {
    return {
      status: 'unsupported',
      needs,
      message: 'برای نسخه کاملاً بی‌سیم باید ظرفیت بی‌سیم پنل و مدل چشمی سازگار رو جدا بررسی کنم؛ این مسیر رو بدون داده قطعی حدس نمی‌زنم.',
    }
  }

  const available = activeProducts(products)
  const openingCount = Math.max(0, needs.doors + needs.windows)
  const motionCount = Math.max(1, needs.motionAreas ?? 1)

  const openingCandidates = available.filter((product) => (
    classifySecurityProduct(product) === 'opening_sensor'
    && isWiredSecurityProduct(product)
    && product.stock >= openingCount
  ))
  const motionCandidates = available.filter((product) => (
    classifySecurityProduct(product) === 'motion_sensor'
    && isWiredSecurityProduct(product)
    && product.stock >= motionCount
  ))

  const openingSensor = preferredProduct(openingCandidates, 'MG10')
  const motionSensor = preferredProduct(motionCandidates, 'P100')

  if (!openingSensor || !motionSensor) {
    return {
      status: 'unsupported',
      needs,
      message: 'برای ساخت پکیج سیمی کامل، حسگر مناسب با موجودی کافی در کاتالوگ فعلی پیدا نکردم؛ نمی‌خوام جایگزین حدسی وارد سبد کنم.',
    }
  }

  const wiredDetectorCount = openingCount + motionCount
  const panelCandidates = available
    .filter((product) => classifySecurityProduct(product) === 'panel')
    .map((product) => ({
      product,
      capacity: getPanelWiredZoneCapacity(product),
    }))
    .filter(
      (candidate): candidate is { product: DeterministicPackageProduct; capacity: number } => (
        candidate.capacity !== null
        && candidate.capacity >= wiredDetectorCount
      ),
    )
    .sort((a, b) => (
      a.product.price - b.product.price
      || a.capacity - b.capacity
    ))

  const selectedPanel = panelCandidates[0]
  if (!selectedPanel) {
    return {
      status: 'unsupported',
      needs,
      message: `برای ${wiredDetectorCount} نقطه سیمی، پنل موجودی با ظرفیت ثبت‌شده کافی پیدا نکردم؛ اینجا باید طراحی نصب یا ترکیب سیمی/بی‌سیم عوض شود.`,
    }
  }

  const items: DeterministicPackageItem[] = [
    { product: selectedPanel.product, quantity: 1 },
    { product: openingSensor, quantity: openingCount },
    { product: motionSensor, quantity: motionCount },
  ]

  return {
    status: 'ready',
    needs,
    items,
    wiredDetectorCount,
    panelWiredCapacity: selectedPanel.capacity,
    totalPrice: items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    ),
  }
}
