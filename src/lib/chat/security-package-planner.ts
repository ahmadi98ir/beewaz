import { canonicalizeSku } from './product-grounding'
import {
  classifySecurityProduct,
  getPanelWiredZoneCapacity,
  getPanelWirelessZoneCapacity,
  isWiredSecurityProduct,
  isWirelessSecurityProduct,
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
  wirelessStrict: boolean
  novice: boolean
}

export interface DeterministicPackageItem {
  product: DeterministicPackageProduct
  quantity: number
}

export type DeterministicPackageMode = 'wired' | 'wireless' | 'hybrid'

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
      mode: DeterministicPackageMode
      wiredDetectorCount: number
      wirelessDetectorCount: number
      panelWiredCapacity: number | null
      panelWirelessCapacity: number | null
      totalPrice: number
    }

export interface DeterministicPackageOptions {
  preferredPanelSku?: string | null
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

function findCount(text: string, nounPattern: string): number | null {
  const normalized = normalizeText(text)
  const numberToken = '(\\d{1,3}|یک|یه|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|یازده|دوازده|سیزده|چهارده|پانزده|شانزده|هفده|هجده|نوزده|بیست)'
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
    wirelessStrict: false,
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
      needs.wirelessStrict = /(کاملا|کاملاً|تماما|تماماً|صد\s*در\s*صد|فقط)[^\n]{0,24}(?:بی\s*سیم|بیسیم|wireless)/i.test(normalized)
        || /(?:بی\s*سیم|بیسیم|wireless)[^\n]{0,24}(?:کامل|تمام)/i.test(normalized)
    } else if (/(سیمی|wired)/i.test(normalized)) {
      needs.wiringPreference = 'wired'
      needs.wirelessStrict = false
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
  const numberToken = '(?:\\d{1,3}|یک|یه|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|یازده|دوازده|سیزده|چهارده|پانزده|شانزده|هفده|هجده|نوزده|بیست)'
  const hasOpeningCount = new RegExp(
    numberToken + '\\s*(?:تا|عدد)?\\s*(?:پنجره|(?:در|درب)(?:\\s*ورودی)?)',
    'i',
  ).test(normalized)
  const changesWiring = /(بی\s*سیم|بیسیم|سیمی|wireless|wired)/i.test(normalized)
  const changesMotion = new RegExp(
    numberToken + '\\s*(?:تا|عدد)?\\s*(?:سالن|فضا(?:ی)?\\s*اصلی|اتاق)',
    'i',
  ).test(normalized)

  return hasOpeningCount || changesWiring || changesMotion
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
  options: DeterministicPackageOptions = {},
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

  const available = activeProducts(products)
  const openingCount = Math.max(0, needs.doors + needs.windows)
  const motionCount = Math.max(1, needs.motionAreas ?? 1)

  const wiredOpeningCandidates = available.filter((product) => (
    classifySecurityProduct(product) === 'opening_sensor'
    && isWiredSecurityProduct(product)
    && product.stock >= openingCount
  ))
  const wirelessOpeningCandidates = available.filter((product) => (
    classifySecurityProduct(product) === 'opening_sensor'
    && isWirelessSecurityProduct(product)
    && product.stock >= openingCount
  ))
  const wiredMotionCandidates = available.filter((product) => (
    classifySecurityProduct(product) === 'motion_sensor'
    && isWiredSecurityProduct(product)
    && product.stock >= motionCount
  ))
  const wirelessMotionCandidates = available.filter((product) => (
    classifySecurityProduct(product) === 'motion_sensor'
    && isWirelessSecurityProduct(product)
    && product.stock >= motionCount
  ))

  let openingSensor: DeterministicPackageProduct | null
  let motionSensor: DeterministicPackageProduct | null

  if (needs.wiringPreference === 'wireless') {
    openingSensor = openingCount > 0
      ? preferredProduct(wirelessOpeningCandidates, 'MG11')
      : null

    if (openingCount > 0 && !openingSensor) {
      return {
        status: 'unsupported',
        needs,
        message: 'مگنت بی‌سیم با موجودی کافی برای تعداد در و پنجره‌های شما پیدا نکردم؛ چیزی رو جایگزین حدسی نمی‌ذارم.',
      }
    }

    motionSensor = preferredProduct(wirelessMotionCandidates, '')
    if (!motionSensor && needs.wirelessStrict) {
      return {
        status: 'unsupported',
        needs,
        message: 'برای پکیج کاملاً بی‌سیم، چشمی حرکتی بی‌سیمِ فعال و قابل استناد در کاتالوگ فعلی پیدا نکردم. می‌تونم نزدیک‌ترین ترکیب هیبریدی رو بچینم: مگنت‌های بی‌سیم + چشمی سیمی.',
      }
    }

    if (!motionSensor) {
      motionSensor = preferredProduct(wiredMotionCandidates, 'P100')
    }
  } else {
    openingSensor = openingCount > 0
      ? preferredProduct(wiredOpeningCandidates, 'MG10')
      : null
    motionSensor = preferredProduct(wiredMotionCandidates, 'P100')
  }

  if ((openingCount > 0 && !openingSensor) || !motionSensor) {
    return {
      status: 'unsupported',
      needs,
      message: 'برای این ترکیب، حسگر مناسب با موجودی و نوع اتصال مشخص در کاتالوگ فعلی پیدا نکردم؛ نمی‌خوام جایگزین حدسی وارد سبد کنم.',
    }
  }

  const detectorItems = [
    ...(openingSensor && openingCount > 0 ? [{ product: openingSensor, quantity: openingCount }] : []),
    { product: motionSensor, quantity: motionCount },
  ]

  const wiredDetectorCount = detectorItems.reduce(
    (sum, item) => sum + (isWiredSecurityProduct(item.product) ? item.quantity : 0),
    0,
  )
  const wirelessDetectorCount = detectorItems.reduce(
    (sum, item) => sum + (isWirelessSecurityProduct(item.product) ? item.quantity : 0),
    0,
  )

  const panelCandidates = available
    .filter((product) => classifySecurityProduct(product) === 'panel')
    .map((product) => ({
      product,
      wiredCapacity: getPanelWiredZoneCapacity(product),
      wirelessCapacity: getPanelWirelessZoneCapacity(product),
    }))
    .filter((candidate) => (
      (wiredDetectorCount === 0
        || (candidate.wiredCapacity !== null && candidate.wiredCapacity >= wiredDetectorCount))
      && (wirelessDetectorCount === 0
        || (candidate.wirelessCapacity !== null && candidate.wirelessCapacity >= wirelessDetectorCount))
    ))
    .sort((a, b) => (
      a.product.price - b.product.price
      || (a.wiredCapacity ?? Number.MAX_SAFE_INTEGER) - (b.wiredCapacity ?? Number.MAX_SAFE_INTEGER)
      || (a.wirelessCapacity ?? Number.MAX_SAFE_INTEGER) - (b.wirelessCapacity ?? Number.MAX_SAFE_INTEGER)
    ))

  const preferredPanel = options.preferredPanelSku
    ? panelCandidates.find(
        (candidate) => canonicalizeSku(candidate.product.sku) === canonicalizeSku(options.preferredPanelSku!),
      )
    : null
  const selectedPanel = preferredPanel ?? panelCandidates[0]

  if (!selectedPanel) {
    const needsText = [
      wiredDetectorCount > 0 ? `${wiredDetectorCount} نقطه سیمی` : '',
      wirelessDetectorCount > 0 ? `${wirelessDetectorCount} نقطه بی‌سیم` : '',
    ].filter(Boolean).join(' و ')

    return {
      status: 'unsupported',
      needs,
      message: `برای ${needsText || 'این تعداد حسگر'}، پنل موجودی با ظرفیت ثبت‌شده کافی پیدا نکردم؛ باید ترکیب حسگرها یا طراحی نصب عوض شود.`,
    }
  }

  const items: DeterministicPackageItem[] = [
    { product: selectedPanel.product, quantity: 1 },
    ...detectorItems,
  ]

  const mode: DeterministicPackageMode = wiredDetectorCount > 0 && wirelessDetectorCount > 0
    ? 'hybrid'
    : wirelessDetectorCount > 0
      ? 'wireless'
      : 'wired'

  return {
    status: 'ready',
    needs,
    items,
    mode,
    wiredDetectorCount,
    wirelessDetectorCount,
    panelWiredCapacity: selectedPanel.wiredCapacity,
    panelWirelessCapacity: selectedPanel.wirelessCapacity,
    totalPrice: items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    ),
  }
}
