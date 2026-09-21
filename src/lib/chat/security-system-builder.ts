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

function normalizedIdentityText(product: SecurityCatalogProduct): string {
  return normalizeProductReferenceText([
    product.sku,
    product.name,
    product.category ?? '',
    product.categorySlug ?? '',
  ].join(' '))
}

function normalizedDescriptionText(product: SecurityCatalogProduct): string {
  return normalizeProductReferenceText(product.description ?? '')
}

export function classifySecurityProduct(
  product: SecurityCatalogProduct,
): SecurityProductRole {
  // Classification must be driven by product identity (SKU/name/category), not
  // arbitrary words appearing in marketing descriptions. A shock sensor may
  // mention «درب» in its description and a panel may mention «سنسور» without
  // changing what the product actually is.
  const identity = normalizedIdentityText(product)
  const description = normalizedDescriptionText(product)

  if (/(پنل|دزدگیر|centralwarning|centralalarm|alarmpanel)/.test(identity)) {
    return 'panel'
  }

  if (/(چشمی|حرکتی|motionsensor|pir)/.test(identity)) return 'motion_sensor'
  if (/(مگنت|openingsensor|magnet|doorcontact|windowcontact)/.test(identity)) return 'opening_sensor'
  if (/(آژیر|بلندگو|siren|speaker|piezo|پیزو)/.test(identity)) return 'audible_alarm'
  if (/(منبعتغذیه|باتری|power|battery|psu)/.test(identity)) return 'power'
  if (/(ریموت|کیپد|کنترل|remote|keypad|control)/.test(identity)) return 'control'
  if (/(آنتن|تقویت|antenna|booster)/.test(identity)) return 'booster'

  // Description is only a fallback for products whose identity is genuinely
  // generic. Keep the fallback narrow to avoid cross-role contamination.
  if (/(motionsensor|pir|حسگرحرکتی|چشمیحرکتی)/.test(description)) return 'motion_sensor'
  if (/(مگنت|openingsensor|magnet|doorcontact|windowcontact)/.test(description)) return 'opening_sensor'
  if (/(siren|speaker|piezo|پیزو|آژیر|بلندگو)/.test(description)) return 'audible_alarm'

  return 'other'
}

export type SecurityConnectionType = 'wired' | 'wireless' | 'unknown'

export function getSecurityProductConnectionType(
  product: SecurityCatalogProduct,
): SecurityConnectionType {
  const identity = normalizedIdentityText(product)
  const description = normalizedDescriptionText(product)

  const detect = (text: string): SecurityConnectionType => {
    if (/(بیسیم|wireless)/.test(text)) return 'wireless'
    if (/(سیمی|wired)/.test(text)) return 'wired'
    return 'unknown'
  }

  const identityType = detect(identity)
  return identityType !== 'unknown' ? identityType : detect(description)
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
  return getSecurityProductConnectionType(product) === 'wired'
}

export function isWirelessSecurityProduct(product: SecurityCatalogProduct): boolean {
  return getSecurityProductConnectionType(product) === 'wireless'
}

function findZoneCapacity(
  text: string,
  connection: 'wired' | 'wireless',
): number | null {
  const normalized = toAsciiDigits(text)
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200f\u202a-\u202e]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const label = connection === 'wired'
    ? '(?:سیمی|با\\s*سیم)'
    : '(?:بی\\s*سیم|بیسیم|wireless)'

  const beforeLabel = normalized.match(
    new RegExp('(\\d+)\\s*(?:عدد\\s*)?زون(?:\\s*های?)?\\s*' + label, 'i'),
  )
  if (beforeLabel) return Number.parseInt(beforeLabel[1]!, 10)

  const afterLabel = normalized.match(
    new RegExp('زون(?:\\s*های?)?\\s*' + label + '\\s*[:：\\-]?\\s*(\\d+)', 'i'),
  )
  if (afterLabel) return Number.parseInt(afterLabel[1]!, 10)

  return null
}

function getPanelZoneCapacity(
  panel: SecurityCatalogProduct,
  connection: 'wired' | 'wireless',
): number | null {
  for (const spec of panel.specs ?? []) {
    const explicit = findZoneCapacity(`${spec.key} ${spec.value}`, connection)
    if (explicit !== null) return explicit

    const key = normalizeProductReferenceText(spec.key)
    const wantsWireless = connection === 'wireless'
    const keyMatches = wantsWireless
      ? key.includes('زون') && key.includes('بیسیم')
      : key.includes('زون') && key.includes('سیمی') && !key.includes('بیسیم')
    if (!keyMatches) continue

    const fallback = toAsciiDigits(spec.value).match(/\d+/)
    if (fallback) return Number.parseInt(fallback[0], 10)
  }

  return findZoneCapacity(
    [panel.name, panel.description ?? ''].join(' '),
    connection,
  )
}

export function getPanelWiredZoneCapacity(
  panel: SecurityCatalogProduct,
): number | null {
  return getPanelZoneCapacity(panel, 'wired')
}

export function getPanelWirelessZoneCapacity(
  panel: SecurityCatalogProduct,
): number | null {
  return getPanelZoneCapacity(panel, 'wireless')
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
