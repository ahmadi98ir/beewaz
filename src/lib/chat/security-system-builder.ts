import { normalizeProductReferenceText } from './product-grounding'

export type SecurityProductRole =
  | 'panel'
  | 'motion_sensor'
  | 'opening_sensor'
  | 'audible_alarm'
  | 'power'
  | 'control'
  | 'booster'
  | 'other'

export interface SecurityCatalogProduct {
  sku: string
  name: string
  category?: string | null
  categorySlug?: string | null
  description?: string | null
  specs?: Array<{ key: string; value: string }>
}

function normalizedProductText(product: SecurityCatalogProduct): string {
  return normalizeProductReferenceText([
    product.sku,
    product.name,
    product.category ?? '',
    product.categorySlug ?? '',
    product.description ?? '',
  ].join(' '))
}

export function classifySecurityProduct(
  product: SecurityCatalogProduct,
): SecurityProductRole {
  const text = normalizedProductText(product)

  if (
    /(پنل|دزدگیر|centralwarning|centralalarm|alarmpanel)/.test(text)
    && !/(سنسور|حسگر|چشمی|مگنت|آژیر|بلندگو|ریموت|آنتن)/.test(text)
  ) {
    return 'panel'
  }

  if (/(چشمی|حرکتی|motionsensor|pir)/.test(text)) return 'motion_sensor'
  if (/(مگنت|درب|پنجره|openingsensor|magnet)/.test(text)) return 'opening_sensor'
  if (/(آژیر|بلندگو|siren|speaker|piezo|پیزو)/.test(text)) return 'audible_alarm'
  if (/(منبعتغذیه|باتری|power|battery|psu)/.test(text)) return 'power'
  if (/(ریموت|کیپد|کنترل|remote|keypad|control)/.test(text)) return 'control'
  if (/(آنتن|تقویت|antenna|booster)/.test(text)) return 'booster'

  return 'other'
}

export interface CartSelectionProduct extends SecurityCatalogProduct {
  quantity: number
}

export interface SecurityCartAssessment {
  hasPanel: boolean
  hasDetection: boolean
  hasMotionSensor: boolean
  hasOpeningSensor: boolean
  hasAudibleAlarm: boolean
  missingRequired: Array<'central_panel' | 'intrusion_detection'>
  advisories: string[]
}

/**
 * A central alarm panel by itself is not a functional intrusion-detection
 * solution. At minimum it needs a detector/contact. Other components such as
 * local audible alarm, remotes, antennas and backup power depend on the panel,
 * site and installation and therefore stay advisory unless explicitly known.
 */
export function assessSecurityCart(
  products: readonly CartSelectionProduct[],
): SecurityCartAssessment {
  const roles = products.flatMap((product) =>
    product.quantity > 0 ? [classifySecurityProduct(product)] : [],
  )

  const hasPanel = roles.includes('panel')
  const hasMotionSensor = roles.includes('motion_sensor')
  const hasOpeningSensor = roles.includes('opening_sensor')
  const hasDetection = hasMotionSensor || hasOpeningSensor
  const hasAudibleAlarm = roles.includes('audible_alarm')

  const missingRequired: SecurityCartAssessment['missingRequired'] = []
  const advisories: string[] = []

  if (!hasPanel) {
    missingRequired.push('central_panel')
  }

  if (!hasDetection) {
    missingRequired.push('intrusion_detection')
  }

  if (hasPanel && !hasAudibleAlarm) {
    advisories.push(
      'برای هشدار محلی، وضعیت آژیر/بلندگوی داخلی یا خارجی پنل باید بررسی شود؛ اگر پنل آژیر مناسبِ یکپارچه ندارد، آژیر/بلندگو هم به ترکیب اضافه شود.',
    )
  }

  return {
    hasPanel,
    hasDetection,
    hasMotionSensor,
    hasOpeningSensor,
    hasAudibleAlarm,
    missingRequired,
    advisories,
  }
}

export function securityCartGuardMessage(
  assessment: SecurityCartAssessment,
): string | null {
  if (assessment.missingRequired.includes('central_panel')) {
    return 'یه نکته مهم قبل از خرید داریم: پنل مرکزی هنوز توی ترکیب نهایی مشخص نشده. نمی‌خوام حسگرها رو جدا و ناقص برات ثبت کنم؛ اول پنل درست رو قطعی می‌کنیم و بعد کل پکیج رو یکجا می‌فرستم توی سبد.'
  }

  if (assessment.missingRequired.includes('intrusion_detection')) {
    return 'یه نکته مهم قبل از خرید داریم: پنل به‌تنهایی سیستم حفاظتی کامل نیست. باید حداقل حسگر تشخیص نفوذ مناسب، مثل چشمی و/یا مگنت در و پنجره، هم با تعداد درست کنار پنل باشه تا پکیج واقعاً قابل استفاده باشه.'
  }

  return null
}


function normalizeConversationText(text: string): string {
  return text
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200f\u202a-\u202e]/g, ' ')
    .toLocaleLowerCase('fa-IR')
}

export function isExplicitPanelOnlyRequest(text: string): boolean {
  const normalized = normalizeConversationText(text)
  return /(فقط|تنها)[^\n]{0,24}(پنل|دستگاه|bh\s*[0-9۰-۹]+)/i.test(normalized)
}

export function shouldEnforceSystemCompleteness(conversationText: string): boolean {
  const normalized = normalizeConversationText(conversationText)

  if (isExplicitPanelOnlyRequest(normalized)) return false

  return /(سیستم|پکیج|کامل|خونه|خانه|آپارتمان|ویلا|سنسور|حسگر|امنیت|حفاظت|راهنما|هیچی.*سر.*در|لازم|نیاز)/i.test(normalized)
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

function toPersianDigits(value: number): string {
  return String(value).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]!)
}

export function isWiredSecurityProduct(product: SecurityCatalogProduct): boolean {
  const text = normalizedProductText(product)
  return /(سیمی|wired)/.test(text) && !/(بیسیم|wireless)/.test(text)
}

export function getPanelWiredZoneCapacity(
  panel: SecurityCatalogProduct,
): number | null {
  for (const spec of panel.specs ?? []) {
    const key = normalizeProductReferenceText(spec.key)
    if (!key.includes('زون') || !key.includes('سیمی') || key.includes('بیسیم')) continue

    const match = toAsciiDigits(spec.value).match(/\d+/)
    if (match) return Number.parseInt(match[0], 10)
  }

  return null
}

export function wiredZoneCapacityGuardMessage(
  products: readonly CartSelectionProduct[],
): string | null {
  const panel = products.find(
    (product) => product.quantity > 0 && classifySecurityProduct(product) === 'panel',
  )
  if (!panel) return null

  const capacity = getPanelWiredZoneCapacity(panel)
  if (capacity === null) return null

  const wiredDetectorCount = products.reduce((sum, product) => {
    const role = classifySecurityProduct(product)
    const detector = role === 'motion_sensor' || role === 'opening_sensor'
    return detector && isWiredSecurityProduct(product)
      ? sum + Math.max(0, product.quantity)
      : sum
  }, 0)

  if (wiredDetectorCount <= capacity) return null

  return `یه نکته مهم قبل از خرید داریم: ترکیب فعلی ${toPersianDigits(wiredDetectorCount)} حسگر سیمی دارد، ولی برای پنل ${panel.sku} فقط ${toPersianDigits(capacity)} زون سیمی در مشخصات ثبت شده. نمی‌خوام چیزی بخری که موقع نصب دردسر درست کنه؛ باید یا زون‌ها با نظر نصاب گروه‌بندی شوند، یا بخشی از حسگرها بی‌سیم شوند، یا پنل مناسب‌تری انتخاب کنیم. فعلاً این ترکیب را به‌عنوان پکیج آماده نصب وارد سبد نمی‌کنم.`
}


export function hasSecurityRole(
  products: readonly CartSelectionProduct[],
  role: SecurityProductRole,
): boolean {
  return products.some(
    (product) => product.quantity > 0 && classifySecurityProduct(product) === role,
  )
}
