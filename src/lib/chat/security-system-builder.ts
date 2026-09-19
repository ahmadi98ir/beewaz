import { normalizeProductReferenceText } from './product-grounding'

export type SecurityProductRole =
  | 'panel'
  | 'motion_sensor'
  | 'opening_sensor'
  | 'intrusion_sensor'
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

function normalizedCoreProductText(product: SecurityCatalogProduct): string {
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

function normalizedProductText(product: SecurityCatalogProduct): string {
  return normalizeProductReferenceText([
    product.sku,
    product.name,
    product.category ?? '',
    product.categorySlug ?? '',
    product.description ?? '',
  ].join(' '))
}

/**
 * Product role classification deliberately prioritizes stable identity fields
 * (SKU/name/category/slug). Free-form descriptions are not used to decide
 * detector roles because they routinely mention doors, windows, sensors, etc.
 * as prose and previously caused products such as shock sensors to be
 * misclassified as opening contacts.
 */
export function classifySecurityProduct(
  product: SecurityCatalogProduct,
): SecurityProductRole {
  const core = normalizedCoreProductText(product)
  const sku = normalizeProductReferenceText(product.sku)
  const name = normalizeProductReferenceText(product.name)
  const category = normalizeProductReferenceText(product.category ?? '')
  const categorySlug = normalizeProductReferenceText(product.categorySlug ?? '')

  if (
    /centralwarningpanels|centralalarmpanels|alarmpanels/.test(categorySlug)
    || /پنل.*مرکزی|مرکزی.*هشدار/.test(category)
    || (/^bh\d+$/.test(sku) && /(دزدگیر|پنل)/.test(name))
  ) {
    return 'panel'
  }

  if (/(چشمی|حرکتی|motionsensor|pir)/.test(core)) return 'motion_sensor'
  if (/(مگنت|openingsensor|magnet)/.test(core)) return 'opening_sensor'
  if (/(شوک|shock|glassbreak|شکستشیشه)/.test(core)) return 'intrusion_sensor'
  if (/(آژیر|بلندگو|siren|speaker|piezo|پیزو)/.test(core)) return 'audible_alarm'
  if (/(منبعتغذیه|power|battery|psu)/.test(core)) return 'power'
  if (/(ریموت|کیپد|remote|keypad)/.test(core)) return 'control'
  if (/(آنتن|تقویت|antenna|booster)/.test(core)) return 'booster'

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
  panelHasIntegratedAudible: boolean
  missingRequired: Array<'central_panel' | 'intrusion_detection'>
  advisories: string[]
}

function panelHasIntegratedAudibleOutput(product: CartSelectionProduct): boolean {
  if (classifySecurityProduct(product) !== 'panel') return false

  const specText = normalizeProductReferenceText(
    (product.specs ?? []).map((spec) => `${spec.key} ${spec.value}`).join(' '),
  )
  const description = normalizedDescriptionText(product)

  return /(آژیر|بلندگو|siren|speaker)/.test(`${specText}${description}`)
}

/**
 * A central alarm panel by itself is not a functional intrusion-detection
 * solution. At minimum it needs a detector/contact. Other components depend on
 * the panel, site and installation and stay advisory unless documented.
 */
export function assessSecurityCart(
  products: readonly CartSelectionProduct[],
): SecurityCartAssessment {
  const activeProducts = products.filter((product) => product.quantity > 0)
  const roles = activeProducts.map((product) => classifySecurityProduct(product))

  const hasPanel = roles.includes('panel')
  const hasMotionSensor = roles.includes('motion_sensor')
  const hasOpeningSensor = roles.includes('opening_sensor')
  const hasIntrusionSensor = roles.includes('intrusion_sensor')
  const hasDetection = hasMotionSensor || hasOpeningSensor || hasIntrusionSensor
  const hasAudibleAlarm = roles.includes('audible_alarm')
  const panelHasIntegratedAudible = activeProducts.some(panelHasIntegratedAudibleOutput)

  const missingRequired: SecurityCartAssessment['missingRequired'] = []
  const advisories: string[] = []

  if (!hasPanel) missingRequired.push('central_panel')
  if (!hasDetection) missingRequired.push('intrusion_detection')

  if (hasPanel && !hasAudibleAlarm && !panelHasIntegratedAudible) {
    advisories.push(
      'وضعیت آژیر/بلندگوی پنل از داده ثبت‌شده روشن نیست؛ قبل از ادعای پکیج آماده نصب باید خروجی هشدار صوتی بررسی شود.',
    )
  }

  return {
    hasPanel,
    hasDetection,
    hasMotionSensor,
    hasOpeningSensor,
    hasAudibleAlarm,
    panelHasIntegratedAudible,
    missingRequired,
    advisories,
  }
}

export function securityCartGuardMessage(
  assessment: SecurityCartAssessment,
): string | null {
  if (assessment.missingRequired.includes('central_panel')) {
    return 'این ترکیب پنل مرکزی ندارد. برای خرید یک سیستم کامل، اول پنل مناسب را با حسگرها یکجا نهایی می‌کنم.'
  }

  if (assessment.missingRequired.includes('intrusion_detection')) {
    return 'این ترکیب فقط پنل دارد و هنوز حسگر تشخیص نفوذ ندارد. برای سیستم کامل باید حداقل چشمی، مگنت یا حسگر نفوذ مناسب هم مشخص شود.'
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
  const core = normalizedCoreProductText(product)
  const description = normalizedDescriptionText(product)

  if (/(بیسیم|wireless)/.test(core)) return false
  if (/(سیمی|wired)/.test(core)) return true

  return /(سیمی|wired)/.test(description) && !/(بیسیم|wireless)/.test(description)
}

export function isWirelessSecurityProduct(product: SecurityCatalogProduct): boolean {
  const core = normalizedCoreProductText(product)
  const description = normalizedDescriptionText(product)

  if (/(بیسیم|wireless)/.test(core)) return true
  return /(بیسیم|wireless)/.test(description)
}

function normalizeCapacityText(text: string): string {
  return toAsciiDigits(text)
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200f\u202a-\u202e]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function findZoneCapacity(text: string, wireless: boolean): number | null {
  const normalized = normalizeCapacityText(text)
  const label = wireless
    ? '(?:بی\\s*سیم|بیسیم|wireless)'
    : '(?:سیمی|با\\s*سیم|wired)'

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
  wireless: boolean,
): number | null {
  for (const spec of panel.specs ?? []) {
    const explicit = findZoneCapacity(`${spec.key} ${spec.value}`, wireless)
    if (explicit !== null) return explicit

    const key = normalizeProductReferenceText(spec.key)
    const targetKey = wireless ? key.includes('بیسیم') : key.includes('سیمی') && !key.includes('بیسیم')
    if (!key.includes('زون') || !targetKey) continue

    const fallback = toAsciiDigits(spec.value).match(/\d+/)
    if (fallback) return Number.parseInt(fallback[0], 10)
  }

  return findZoneCapacity(
    [panel.name, panel.description ?? ''].join(' '),
    wireless,
  )
}

export function getPanelWiredZoneCapacity(
  panel: SecurityCatalogProduct,
): number | null {
  return getPanelZoneCapacity(panel, false)
}

export function getPanelWirelessZoneCapacity(
  panel: SecurityCatalogProduct,
): number | null {
  return getPanelZoneCapacity(panel, true)
}

/**
 * A wired detector count is not inherently the same thing as used wired zones:
 * installers can group multiple contacts on one zone. We only block the
 * "independent-zone" design when every proposed detector is being treated as an
 * individually addressable wired point.
 */
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
    const detector = (
      role === 'motion_sensor'
      || role === 'opening_sensor'
      || role === 'intrusion_sensor'
    )
    return detector && isWiredSecurityProduct(product)
      ? sum + Math.max(0, product.quantity)
      : sum
  }, 0)

  if (wiredDetectorCount <= capacity) return null

  return `اگر بخوای هر ${toPersianDigits(wiredDetectorCount)} حسگر سیمی یک زون مستقل داشته باشه، ظرفیت ${toPersianDigits(capacity)} زون سیمی پنل ${panel.sku} کافی نیست. می‌شه بعضی مگنت‌ها را با نظر نصاب گروه‌بندی کرد یا پنل/نوع اتصال را عوض کرد؛ تا روش زون‌بندی مشخص نشه این ترکیب رو «آماده نصب با زون مستقل» ثبت نمی‌کنم.`
}

export function hasSecurityRole(
  products: readonly CartSelectionProduct[],
  role: SecurityProductRole,
): boolean {
  return products.some(
    (product) => product.quantity > 0 && classifySecurityProduct(product) === role,
  )
}
