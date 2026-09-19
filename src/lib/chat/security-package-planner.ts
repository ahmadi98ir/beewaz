import { canonicalizeSku } from './product-grounding'
import {
  classifySecurityProduct,
  getPanelWiredZoneCapacity,
  getPanelWirelessZoneCapacity,
  getWirelessFrequenciesMHz,
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
  wiringPreference: 'wired' | 'wireless' | 'hybrid' | 'unknown'
  novice: boolean
}

export interface DeterministicPackageItem {
  product: DeterministicPackageProduct
  quantity: number
}

export type PackageQuestionKey = 'openings' | 'doors' | 'windows' | 'motion_areas'

export type DeterministicPackagePlan =
  | {
      status: 'needs_input'
      needs: SecurityNeeds
      questionKey: PackageQuestionKey
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
      design: 'wired_independent' | 'wireless' | 'hybrid'
      items: DeterministicPackageItem[]
      wiredDetectorCount: number
      wirelessDetectorCount: number
      panelWiredCapacity: number | null
      panelWirelessCapacity: number | null
      totalPrice: number
    }

const WORD_NUMBERS: Record<string, number> = {
  'صفر': 0,
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

function numberTokenPattern(): string {
  return '(\\d{1,2}|صفر|یک|یه|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|یازده|دوازده|سیزده|چهارده|پانزده|شانزده|هفده|هجده|نوزده|بیست)'
}

function findCount(
  text: string,
  nounPattern: string,
): number | null {
  const normalized = normalizeText(text)
  const match = normalized.match(
    new RegExp(numberTokenPattern() + '\\s*(?:تا|عدد)?\\s*(?:' + nounPattern + ')', 'i'),
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

export function extractSecurityNeeds(
  messages: readonly string[],
  initial?: Partial<SecurityNeeds> | null,
): SecurityNeeds {
  const needs: SecurityNeeds = {
    areaM2: initial?.areaM2 ?? null,
    doors: initial?.doors ?? null,
    windows: initial?.windows ?? null,
    motionAreas: initial?.motionAreas ?? null,
    wiringPreference: initial?.wiringPreference ?? 'unknown',
    novice: initial?.novice ?? false,
  }

  for (const raw of messages) {
    const normalized = normalizeText(raw)

    const area = findArea(normalized)
    if (area !== null) needs.areaM2 = area

    const doors = findCount(normalized, '(?:در|درب)(?:\\s*ورودی)?')
    if (doors !== null) needs.doors = doors

    const windows = findCount(normalized, 'پنجره')
    if (windows !== null) needs.windows = windows

    const motionAreas = findCount(
      normalized,
      '(?:فضا(?:ی)?\\s*اصلی|نقطه\\s*حرکتی|چشمی|سالن|راهرو|اتاق)',
    )
    if (motionAreas !== null) needs.motionAreas = motionAreas

    if (/(ترکیبی|هیبرید|hybrid)/i.test(normalized)) {
      needs.wiringPreference = 'hybrid'
    } else if (/(بی\s*سیم|بیسیم|wireless)/i.test(normalized)) {
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
  const normalized = normalizeText(messages.slice(-12).join(' '))
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
  const numberToken = '(?:\\d{1,2}|صفر|یک|یه|دو|سه|چهار|پنج|شش|هفت|هشت|نه|ده|یازده|دوازده|سیزده|چهارده|پانزده|شانزده|هفده|هجده|نوزده|بیست)'
  const hasCount = new RegExp(
    numberToken + '\\s*(?:تا|عدد)?\\s*(?:پنجره|(?:در|درب)(?:\\s*ورودی)?|فضا(?:ی)?\\s*اصلی|نقطه\\s*حرکتی|چشمی|سالن|راهرو|اتاق)',
    'i',
  ).test(normalized)
  const changesWiring = /(بی\s*سیم|بیسیم|سیمی|ترکیبی|هیبرید|wireless|wired|hybrid)/i.test(normalized)

  return hasCount || changesWiring
}

export function isUnknownPackageAnswer(text: string): boolean {
  const normalized = normalizeText(text)
  return /^(?:نمی\s*دونم|نمیدونم|نمی\s*دونم\s*خودت|هرچی\s*تو\s*بگی|خودت\s*بگو|خودت\s*انتخاب\s*کن)[.!؟?\s]*$/i.test(normalized)
}


export function applyPackageQuestionAnswer(
  current: SecurityNeeds,
  questionKey: PackageQuestionKey | null | undefined,
  text: string,
): { needs: SecurityNeeds; handled: boolean } {
  if (!questionKey) return { needs: current, handled: false }

  const normalized = normalizeText(text)
  const exact = normalized.match(
    new RegExp('^\\s*' + numberTokenPattern() + '\\s*(?:تا|عدد)?\\s*[.!؟?]*\\s*
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

function haveCommonWirelessFrequency(
  panel: DeterministicPackageProduct,
  detector: DeterministicPackageProduct,
): boolean {
  const panelFreqs = getWirelessFrequenciesMHz(panel)
  const detectorFreqs = getWirelessFrequenciesMHz(detector)
  if (panelFreqs.length === 0 || detectorFreqs.length === 0) return false

  return panelFreqs.some((panelFrequency) => (
    detectorFreqs.some((detectorFrequency) => Math.abs(panelFrequency - detectorFrequency) < 0.01)
  ))
}

function readyPlan(
  needs: SecurityNeeds,
  design: 'wired_independent' | 'wireless' | 'hybrid',
  items: DeterministicPackageItem[],
  wiredDetectorCount: number,
  wirelessDetectorCount: number,
  panelWiredCapacity: number | null,
  panelWirelessCapacity: number | null,
): DeterministicPackagePlan {
  const positiveItems = items.filter((item) => item.quantity > 0)
  return {
    status: 'ready',
    needs,
    design,
    items: positiveItems,
    wiredDetectorCount,
    wirelessDetectorCount,
    panelWiredCapacity,
    panelWirelessCapacity,
    totalPrice: positiveItems.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    ),
  }
}

export function buildDeterministicSecurityPackage(
  products: readonly DeterministicPackageProduct[],
  needs: SecurityNeeds,
): DeterministicPackagePlan {
  if (needs.doors === null && needs.windows === null) {
    return {
      status: 'needs_input',
      needs,
      questionKey: 'openings',
      question: 'فقط تعداد درهای ورودی و پنجره‌های قابل‌دسترسی رو بگو؛ بقیه انتخاب‌ها با من.',
    }
  }

  if (needs.doors === null) {
    return {
      status: 'needs_input',
      needs,
      questionKey: 'doors',
      question: 'فقط بگو چند تا در ورودی داری؛ بقیه‌ش با من.',
    }
  }

  if (needs.windows === null) {
    return {
      status: 'needs_input',
      needs,
      questionKey: 'windows',
      question: 'فقط بگو چند تا پنجره قابل‌دسترسی داری؛ بقیه‌ش با من.',
    }
  }

  const available = activeProducts(products)
  const openingCount = Math.max(0, needs.doors + needs.windows)

  // A "complete" indoor design cannot infer motion coverage from square meters
  // alone. Ask one concrete question rather than silently inventing a PIR count.
  if (needs.motionAreas === null && needs.wiringPreference !== 'wireless') {
    return {
      status: 'needs_input',
      needs,
      questionKey: 'motion_areas',
      question: 'فقط برای چشمی‌ها بگو چند فضای اصلی مثل پذیرایی، راهرو یا طبقه رو می‌خوای پوشش بدی؟ یک عدد کافیه.',
    }
  }

  if (openingCount === 0 && (needs.motionAreas ?? 0) === 0) {
    return {
      status: 'unsupported',
      needs,
      message: 'با صفر نقطه بازشو و صفر فضای حرکتی، حسگر تشخیص نفوذی برای پکیج باقی نمی‌مونه. حداقل یک نقطه حفاظتی باید مشخص بشه.',
    }
  }

  if (needs.wiringPreference === 'wireless') {
    const wirelessOpenings = openingCount > 0
      ? available.filter((product) => (
          classifySecurityProduct(product) === 'opening_sensor'
          && isWirelessSecurityProduct(product)
          && product.stock >= openingCount
        ))
      : []
    const openingSensor = openingCount > 0
      ? preferredProduct(wirelessOpenings, 'MG11')
      : null

    if (openingCount > 0 && !openingSensor) {
      return {
        status: 'unsupported',
        needs,
        message: 'برای در و پنجره‌ها حسگر بی‌سیمِ موجود و قابل‌تأیید با تعداد کافی پیدا نکردم؛ پکیج کاملاً بی‌سیم رو ناقص نمی‌بندم.',
      }
    }

    // First verify that the catalog actually has a wireless motion detector.
    // If it does not, there is no point asking the customer how many are needed.
    const anyWirelessMotion = available.filter((product) => (
      classifySecurityProduct(product) === 'motion_sensor'
      && isWirelessSecurityProduct(product)
    ))
    if (anyWirelessMotion.length === 0) {
      const openingFact = openingSensor
        ? `برای در و پنجره‌ها ${openingSensor.sku} بی‌سیم موجوده، `
        : ''
      return {
        status: 'unsupported',
        needs,
        message: `${openingFact}اما در کاتالوگ فعلی چشمی حرکتی بی‌سیمِ موجود و قابل‌تأیید پیدا نکردم. پکیج «کاملاً بی‌سیم» رو حدسی نمی‌بندم؛ اگر بخوای نسخه ترکیبی می‌چینم: مگنت‌های بی‌سیم + چشمی سیمی.`,
      }
    }

    if (needs.motionAreas === null) {
      return {
        status: 'needs_input',
        needs,
        questionKey: 'motion_areas',
        question: 'برای چشمی‌های بی‌سیم فقط بگو چند فضای اصلی مثل پذیرایی، راهرو یا طبقه رو می‌خوای پوشش بدی؟ یک عدد کافیه.',
      }
    }

    const motionCount = Math.max(0, needs.motionAreas)
    const wirelessMotions = available.filter((product) => (
      classifySecurityProduct(product) === 'motion_sensor'
      && isWirelessSecurityProduct(product)
      && product.stock >= motionCount
    ))
    const motionSensor = motionCount > 0
      ? preferredProduct(wirelessMotions, '')
      : null

    if (motionCount > 0 && !motionSensor) {
      return {
        status: 'unsupported',
        needs,
        message: 'تعداد چشمی بی‌سیم موردنیاز با موجودی فعلی کاتالوگ جور درنمیاد؛ تعداد رو حدسی کم نمی‌کنم.',
      }
    }

    if (openingCount === 0 && motionCount === 0) {
      return {
        status: 'unsupported',
        needs,
        message: 'برای پکیج بی‌سیم حداقل یک نقطه حفاظتی باید مشخص بشه.',
      }
    }

    const detectorCount = openingCount + motionCount
    const panelCandidates = available
      .filter((product) => classifySecurityProduct(product) === 'panel')
      .map((product) => ({
        product,
        capacity: getPanelWirelessZoneCapacity(product),
      }))
      .filter(
        (candidate): candidate is { product: DeterministicPackageProduct; capacity: number } => (
          candidate.capacity !== null
          && candidate.capacity >= detectorCount
          && (!openingSensor || haveCommonWirelessFrequency(candidate.product, openingSensor))
          && haveCommonWirelessFrequency(candidate.product, motionSensor)
        ),
      )
      .sort((a, b) => a.product.price - b.product.price || a.capacity - b.capacity)

    const selectedPanel = panelCandidates[0]
    if (!selectedPanel) {
      return {
        status: 'unsupported',
        needs,
        message: 'برای یک پکیج کاملاً بی‌سیم، پنل و حسگرهایی با ظرفیت و فرکانس سازگارِ ثبت‌شده پیدا نکردم؛ چیزی رو حدسی وارد سبد نمی‌کنم.',
      }
    }

    return readyPlan(
      needs,
      'wireless',
      [
        { product: selectedPanel.product, quantity: 1 },
        ...(openingSensor ? [{ product: openingSensor, quantity: openingCount }] : []),
        ...(motionSensor ? [{ product: motionSensor, quantity: motionCount }] : []),
      ],
      0,
      detectorCount,
      getPanelWiredZoneCapacity(selectedPanel.product),
      selectedPanel.capacity,
    )
  }

  const motionCount = Math.max(0, needs.motionAreas ?? 0)
  const useHybrid = needs.wiringPreference === 'hybrid'

  const openingCandidates = openingCount > 0
    ? available.filter((product) => (
        classifySecurityProduct(product) === 'opening_sensor'
        && (useHybrid ? isWirelessSecurityProduct(product) : isWiredSecurityProduct(product))
        && product.stock >= openingCount
      ))
    : []

  const motionCandidates = motionCount > 0
    ? available.filter((product) => (
        classifySecurityProduct(product) === 'motion_sensor'
        && isWiredSecurityProduct(product)
        && product.stock >= motionCount
      ))
    : []

  const openingSensor = openingCount > 0
    ? preferredProduct(openingCandidates, useHybrid ? 'MG11' : 'MG10')
    : null
  const motionSensor = motionCount > 0
    ? preferredProduct(motionCandidates, 'P100')
    : null

  if ((openingCount > 0 && !openingSensor) || (motionCount > 0 && !motionSensor)) {
    return {
      status: 'unsupported',
      needs,
      message: 'برای این طراحی، حسگر مناسب با موجودی و نوع اتصال لازم در کاتالوگ فعلی پیدا نکردم؛ جایگزین حدسی وارد سبد نمی‌کنم.',
    }
  }

  const wiredDetectorCount = motionCount + (useHybrid ? 0 : openingCount)
  const wirelessDetectorCount = useHybrid ? openingCount : 0

  const panelCandidates = available
    .filter((product) => classifySecurityProduct(product) === 'panel')
    .map((product) => ({
      product,
      wiredCapacity: getPanelWiredZoneCapacity(product),
      wirelessCapacity: getPanelWirelessZoneCapacity(product),
    }))
    .filter((candidate) => {
      if (wiredDetectorCount > 0) {
        if (candidate.wiredCapacity === null || candidate.wiredCapacity < wiredDetectorCount) return false
      }
      if (wirelessDetectorCount > 0) {
        if (candidate.wirelessCapacity === null || candidate.wirelessCapacity < wirelessDetectorCount) return false
        if (openingSensor && !haveCommonWirelessFrequency(candidate.product, openingSensor)) return false
      }
      return true
    })
    .sort((a, b) => (
      a.product.price - b.product.price
      || (a.wiredCapacity ?? Number.MAX_SAFE_INTEGER) - (b.wiredCapacity ?? Number.MAX_SAFE_INTEGER)
    ))

  const selectedPanel = panelCandidates[0]
  if (!selectedPanel) {
    const designLabel = useHybrid ? 'ترکیبی' : 'سیمی با زون‌های مستقل'
    return {
      status: 'unsupported',
      needs,
      message: `برای طراحی ${designLabel} با این تعداد نقطه، پنل موجودی با ظرفیت ثبت‌شده کافی پیدا نکردم. چیزی رو حدسی وارد سبد نمی‌کنم؛ باید روش زون‌بندی یا نوع اتصال عوض بشه.`,
    }
  }

  return readyPlan(
    needs,
    useHybrid ? 'hybrid' : 'wired_independent',
    [
      { product: selectedPanel.product, quantity: 1 },
      ...(openingSensor ? [{ product: openingSensor, quantity: openingCount }] : []),
      ...(motionSensor ? [{ product: motionSensor, quantity: motionCount }] : []),
    ],
    wiredDetectorCount,
    wirelessDetectorCount,
    selectedPanel.wiredCapacity,
    selectedPanel.wirelessCapacity,
  )
}
, 'i'),
  )
  const count = parseCountToken(exact?.[1])
  if (count === null) return { needs: current, handled: false }

  if (questionKey === 'doors') {
    return { needs: { ...current, doors: count }, handled: true }
  }
  if (questionKey === 'windows') {
    return { needs: { ...current, windows: count }, handled: true }
  }
  if (questionKey === 'motion_areas') {
    return { needs: { ...current, motionAreas: count }, handled: true }
  }

  // A single number cannot safely be split into separate door/window counts.
  return { needs: current, handled: false }
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

function haveCommonWirelessFrequency(
  panel: DeterministicPackageProduct,
  detector: DeterministicPackageProduct,
): boolean {
  const panelFreqs = getWirelessFrequenciesMHz(panel)
  const detectorFreqs = getWirelessFrequenciesMHz(detector)
  if (panelFreqs.length === 0 || detectorFreqs.length === 0) return false

  return panelFreqs.some((panelFrequency) => (
    detectorFreqs.some((detectorFrequency) => Math.abs(panelFrequency - detectorFrequency) < 0.01)
  ))
}

function readyPlan(
  needs: SecurityNeeds,
  design: 'wired_independent' | 'wireless' | 'hybrid',
  items: DeterministicPackageItem[],
  wiredDetectorCount: number,
  wirelessDetectorCount: number,
  panelWiredCapacity: number | null,
  panelWirelessCapacity: number | null,
): DeterministicPackagePlan {
  const positiveItems = items.filter((item) => item.quantity > 0)
  return {
    status: 'ready',
    needs,
    design,
    items: positiveItems,
    wiredDetectorCount,
    wirelessDetectorCount,
    panelWiredCapacity,
    panelWirelessCapacity,
    totalPrice: positiveItems.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    ),
  }
}

export function buildDeterministicSecurityPackage(
  products: readonly DeterministicPackageProduct[],
  needs: SecurityNeeds,
): DeterministicPackagePlan {
  if (needs.doors === null && needs.windows === null) {
    return {
      status: 'needs_input',
      needs,
      questionKey: 'openings',
      question: 'فقط تعداد درهای ورودی و پنجره‌های قابل‌دسترسی رو بگو؛ بقیه انتخاب‌ها با من.',
    }
  }

  if (needs.doors === null) {
    return {
      status: 'needs_input',
      needs,
      questionKey: 'doors',
      question: 'فقط بگو چند تا در ورودی داری؛ بقیه‌ش با من.',
    }
  }

  if (needs.windows === null) {
    return {
      status: 'needs_input',
      needs,
      questionKey: 'windows',
      question: 'فقط بگو چند تا پنجره قابل‌دسترسی داری؛ بقیه‌ش با من.',
    }
  }

  const available = activeProducts(products)
  const openingCount = Math.max(0, needs.doors + needs.windows)

  // A "complete" indoor design cannot infer motion coverage from square meters
  // alone. Ask one concrete question rather than silently inventing a PIR count.
  if (needs.motionAreas === null && needs.wiringPreference !== 'wireless') {
    return {
      status: 'needs_input',
      needs,
      questionKey: 'motion_areas',
      question: 'فقط برای چشمی‌ها بگو چند فضای اصلی مثل پذیرایی، راهرو یا طبقه رو می‌خوای پوشش بدی؟ یک عدد کافیه.',
    }
  }

  if (openingCount === 0 && (needs.motionAreas ?? 0) === 0) {
    return {
      status: 'unsupported',
      needs,
      message: 'با صفر نقطه بازشو و صفر فضای حرکتی، حسگر تشخیص نفوذی برای پکیج باقی نمی‌مونه. حداقل یک نقطه حفاظتی باید مشخص بشه.',
    }
  }

  if (needs.wiringPreference === 'wireless') {
    const wirelessOpenings = openingCount > 0
      ? available.filter((product) => (
          classifySecurityProduct(product) === 'opening_sensor'
          && isWirelessSecurityProduct(product)
          && product.stock >= openingCount
        ))
      : []
    const wirelessMotions = available.filter((product) => (
      classifySecurityProduct(product) === 'motion_sensor'
      && isWirelessSecurityProduct(product)
      && product.stock >= Math.max(1, needs.motionAreas ?? 1)
    ))

    const openingSensor = openingCount > 0
      ? preferredProduct(wirelessOpenings, 'MG11')
      : null
    const motionSensor = preferredProduct(wirelessMotions, '')

    if (!motionSensor) {
      const openingFact = openingSensor
        ? `برای در و پنجره‌ها ${openingSensor.sku} بی‌سیم موجوده، `
        : ''
      return {
        status: 'unsupported',
        needs,
        message: `${openingFact}اما در کاتالوگ فعلی چشمی حرکتی بی‌سیمِ موجود و قابل‌تأیید پیدا نکردم. پکیج «کاملاً بی‌سیم» رو حدسی نمی‌بندم؛ اگر بخوای نسخه ترکیبی می‌چینم: مگنت‌های بی‌سیم + چشمی سیمی.`,
      }
    }

    const motionCount = Math.max(1, needs.motionAreas ?? 1)
    const detectorCount = openingCount + motionCount
    const panelCandidates = available
      .filter((product) => classifySecurityProduct(product) === 'panel')
      .map((product) => ({
        product,
        capacity: getPanelWirelessZoneCapacity(product),
      }))
      .filter(
        (candidate): candidate is { product: DeterministicPackageProduct; capacity: number } => (
          candidate.capacity !== null
          && candidate.capacity >= detectorCount
          && (!openingSensor || haveCommonWirelessFrequency(candidate.product, openingSensor))
          && haveCommonWirelessFrequency(candidate.product, motionSensor)
        ),
      )
      .sort((a, b) => a.product.price - b.product.price || a.capacity - b.capacity)

    const selectedPanel = panelCandidates[0]
    if (!selectedPanel) {
      return {
        status: 'unsupported',
        needs,
        message: 'برای یک پکیج کاملاً بی‌سیم، پنل و حسگرهایی با ظرفیت و فرکانس سازگارِ ثبت‌شده پیدا نکردم؛ چیزی رو حدسی وارد سبد نمی‌کنم.',
      }
    }

    return readyPlan(
      needs,
      'wireless',
      [
        { product: selectedPanel.product, quantity: 1 },
        ...(openingSensor ? [{ product: openingSensor, quantity: openingCount }] : []),
        { product: motionSensor, quantity: motionCount },
      ],
      0,
      detectorCount,
      getPanelWiredZoneCapacity(selectedPanel.product),
      selectedPanel.capacity,
    )
  }

  const motionCount = Math.max(0, needs.motionAreas ?? 0)
  const useHybrid = needs.wiringPreference === 'hybrid'

  const openingCandidates = openingCount > 0
    ? available.filter((product) => (
        classifySecurityProduct(product) === 'opening_sensor'
        && (useHybrid ? isWirelessSecurityProduct(product) : isWiredSecurityProduct(product))
        && product.stock >= openingCount
      ))
    : []

  const motionCandidates = motionCount > 0
    ? available.filter((product) => (
        classifySecurityProduct(product) === 'motion_sensor'
        && isWiredSecurityProduct(product)
        && product.stock >= motionCount
      ))
    : []

  const openingSensor = openingCount > 0
    ? preferredProduct(openingCandidates, useHybrid ? 'MG11' : 'MG10')
    : null
  const motionSensor = motionCount > 0
    ? preferredProduct(motionCandidates, 'P100')
    : null

  if ((openingCount > 0 && !openingSensor) || (motionCount > 0 && !motionSensor)) {
    return {
      status: 'unsupported',
      needs,
      message: 'برای این طراحی، حسگر مناسب با موجودی و نوع اتصال لازم در کاتالوگ فعلی پیدا نکردم؛ جایگزین حدسی وارد سبد نمی‌کنم.',
    }
  }

  const wiredDetectorCount = motionCount + (useHybrid ? 0 : openingCount)
  const wirelessDetectorCount = useHybrid ? openingCount : 0

  const panelCandidates = available
    .filter((product) => classifySecurityProduct(product) === 'panel')
    .map((product) => ({
      product,
      wiredCapacity: getPanelWiredZoneCapacity(product),
      wirelessCapacity: getPanelWirelessZoneCapacity(product),
    }))
    .filter((candidate) => {
      if (wiredDetectorCount > 0) {
        if (candidate.wiredCapacity === null || candidate.wiredCapacity < wiredDetectorCount) return false
      }
      if (wirelessDetectorCount > 0) {
        if (candidate.wirelessCapacity === null || candidate.wirelessCapacity < wirelessDetectorCount) return false
        if (openingSensor && !haveCommonWirelessFrequency(candidate.product, openingSensor)) return false
      }
      return true
    })
    .sort((a, b) => (
      a.product.price - b.product.price
      || (a.wiredCapacity ?? Number.MAX_SAFE_INTEGER) - (b.wiredCapacity ?? Number.MAX_SAFE_INTEGER)
    ))

  const selectedPanel = panelCandidates[0]
  if (!selectedPanel) {
    const designLabel = useHybrid ? 'ترکیبی' : 'سیمی با زون‌های مستقل'
    return {
      status: 'unsupported',
      needs,
      message: `برای طراحی ${designLabel} با این تعداد نقطه، پنل موجودی با ظرفیت ثبت‌شده کافی پیدا نکردم. چیزی رو حدسی وارد سبد نمی‌کنم؛ باید روش زون‌بندی یا نوع اتصال عوض بشه.`,
    }
  }

  return readyPlan(
    needs,
    useHybrid ? 'hybrid' : 'wired_independent',
    [
      { product: selectedPanel.product, quantity: 1 },
      ...(openingSensor ? [{ product: openingSensor, quantity: openingCount }] : []),
      ...(motionSensor ? [{ product: motionSensor, quantity: motionCount }] : []),
    ],
    wiredDetectorCount,
    wirelessDetectorCount,
    selectedPanel.wiredCapacity,
    selectedPanel.wirelessCapacity,
  )
}
