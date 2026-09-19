import { describe, expect, it } from 'vitest'
import {
  applyPackageQuestionAnswer,
  applyPackageRequirementAdjustment,
  buildDeterministicSecurityPackage,
  extractSecurityNeeds,
  isPackageRecommendationIntent,
  isPackageRequirementsUpdate,
  isSecurityPackageConversation,
  isUnknownPackageAnswer,
  type DeterministicPackageProduct,
} from './security-package-planner'

const PRODUCTS: DeterministicPackageProduct[] = [
  {
    id: 'bh20',
    sku: 'BH20',
    name: 'دستگاه دزدگیر BH20 بیواز',
    price: 187_000_000,
    stock: 5,
    status: 'active',
    category: 'پنل های مرکزی هشدار',
    categorySlug: 'central-warning-panels',
    description: 'دارای 5 زون سیمی و 20 زون بی‌سیم',
    specs: [
      { key: 'اتصالات', value: '5 عدد زون سیمی / آنتن SUB GHz / آژیر / بلندگو' },
      { key: 'فرکانس بی‌سیم', value: '315 مگاهرتز' },
    ],
  },
  {
    id: 'bh21',
    sku: 'BH21',
    name: 'دستگاه دزدگیر BH21 بیواز',
    price: 209_000_000,
    stock: 5,
    status: 'active',
    category: 'پنل های مرکزی هشدار',
    categorySlug: 'central-warning-panels',
    description: 'دارای 9 زون سیمی و 20 زون بی‌سیم',
    specs: [
      { key: 'اتصالات', value: '9 عدد زون سیمی / آنتن SUB GHz / آژیر / بلندگو' },
      { key: 'فرکانس بی‌سیم', value: '315 مگاهرتز' },
    ],
  },
  {
    id: 'mg10',
    sku: 'MG10',
    name: 'مگنت سیمی بیواز MG10',
    price: 2_900_000,
    stock: 50,
    status: 'active',
    category: 'سنسورهای محیطی',
    description: 'حسگر مجاورت سیمی',
  },
  {
    id: 'mg11',
    sku: 'MG11',
    name: 'مگنت بی‌سیم بیواز MG11',
    price: 9_499_990,
    stock: 50,
    status: 'active',
    category: 'سنسورهای محیطی',
    description: 'مگنت بی‌سیم',
    specs: [{ key: 'فرکانس بی‌سیم', value: '۳۱۵/۴۳۳ مگاهرتز' }],
  },
  {
    id: 'p100',
    sku: 'P100',
    name: 'چشمی حرکتی بیواز P100',
    price: 13_200_000,
    stock: 20,
    status: 'active',
    category: 'سنسورهای تشخیص حرکت',
    description: 'حسگر حرکتی PIR سیمی',
  },
]

describe('deterministic security package planner', () => {
  it('extracts Persian requirements without inventing motion coverage', () => {
    const needs = extractSecurityNeeds([
      'من یه خونه ۳۰۰ متری دارم، ۳ تا پنجره و ۲ تا در ورودی دارم. از دزدگیر هیچی سر درنمیارم.',
    ])

    expect(needs).toEqual({
      areaM2: 300,
      doors: 2,
      windows: 3,
      motionAreas: null,
      wiringPreference: 'unknown',
      novice: true,
    })
  })

  it('understands Persian word numbers and explicit zero', () => {
    expect(extractSecurityNeeds([
      'خونه‌م دو تا در ورودی و شش تا پنجره داره',
    ])).toMatchObject({ doors: 2, windows: 6 })

    expect(extractSecurityNeeds([
      'صفر تا پنجره و یک در ورودی دارم',
    ])).toMatchObject({ doors: 1, windows: 0 })
  })

  it('recognizes package conversations, relevant updates and ignores arbitrary typos', () => {
    expect(isSecurityPackageConversation([
      'یه خونه ۳۰۰ متری دارم',
      'برای دزدگیر خودت یه پکیج پیشنهاد بده',
    ])).toBe(true)
    expect(isPackageRecommendationIntent('اوکی چی پیشنهاد میدی؟')).toBe(true)
    expect(isPackageRequirementsUpdate('۳ تا پنجره و ۲ تا در ورودی دارم')).toBe(true)
    expect(isPackageRequirementsUpdate('خوب بیسیم چی؟')).toBe(true)
    expect(isPackageRequirementsUpdate('۲ فضای اصلی دارم')).toBe(true)
    expect(isPackageRequirementsUpdate('اومی')).toBe(false)
    expect(isUnknownPackageAnswer('نمی‌دونم خودت')).toBe(true)
  })

  it('asks for motion coverage instead of silently inventing one PIR', () => {
    const needs = extractSecurityNeeds([
      'من یه خونه ۳۰۰ متری دارم، ۳ تا پنجره و ۲ تا در ورودی دارم. از دزدگیر هیچی سر درنمیارم، خودت یه پکیج مناسب و کامل پیشنهاد بده.',
    ])

    const result = buildDeterministicSecurityPackage(PRODUCTS, needs)
    expect(result).toMatchObject({
      status: 'needs_input',
      questionKey: 'motion_areas',
    })
  })

  it('binds a bare numeric reply to the pending motion question', () => {
    const before = extractSecurityNeeds([
      '۳ تا پنجره و ۲ تا در ورودی دارم',
    ])
    const answered = applyPackageQuestionAnswer(before, 'motion_areas', '۲')

    expect(answered.handled).toBe(true)
    expect(answered.needs.motionAreas).toBe(2)
  })

  it('applies relative changes against persisted requirements instead of resetting totals', () => {
    const current = extractSecurityNeeds([
      '۳ تا پنجره، ۲ تا در ورودی و ۲ فضای اصلی دارم',
    ])

    expect(
      applyPackageRequirementAdjustment(current, 'یه چشمی دیگه اضافه کن').needs.motionAreas,
    ).toBe(3)
    expect(
      applyPackageRequirementAdjustment(current, 'یک پنجره کم کن').needs.windows,
    ).toBe(2)
    expect(
      applyPackageRequirementAdjustment(current, 'دو تا در دیگه اضافه کن').needs.doors,
    ).toBe(4)
  })

  it('does not split one bare number into both door and window counts', () => {
    const before = extractSecurityNeeds(['یه خونه دارم'])
    const answered = applyPackageQuestionAnswer(before, 'openings', '۵')

    expect(answered.handled).toBe(false)
    expect(answered.needs.doors).toBeNull()
    expect(answered.needs.windows).toBeNull()
  })

  it('reproduces the production scenario after the vital follow-up: BH21 + 5 MG10 + 2 P100', () => {
    const initial = extractSecurityNeeds([
      'من یه خونه ۳۰۰ متری دارم، ۳ تا پنجره و ۲ تا در ورودی دارم. از دزدگیر هیچی سر درنمیارم.',
    ])
    const needs = applyPackageQuestionAnswer(initial, 'motion_areas', '۲').needs

    const result = buildDeterministicSecurityPackage(PRODUCTS, needs)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return

    expect(result.design).toBe('wired_independent')
    expect(result.items.map((item) => [item.product.sku, item.quantity])).toEqual([
      ['BH21', 1],
      ['MG10', 5],
      ['P100', 2],
    ])
    expect(result.wiredDetectorCount).toBe(7)
    expect(result.panelWiredCapacity).toBe(9)
  })

  it('uses BH21 for eight openings plus one independently zoned motion detector', () => {
    const needs = extractSecurityNeeds([
      'خونه ۳۰۰ متری، ۶ پنجره، ۲ در ورودی و ۱ فضای اصلی دارم؛ پکیج سیمی پیشنهاد بده',
    ])

    const result = buildDeterministicSecurityPackage(PRODUCTS, needs)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return

    expect(result.items.map((item) => [item.product.sku, item.quantity])).toEqual([
      ['BH21', 1],
      ['MG10', 8],
      ['P100', 1],
    ])
    expect(result.wiredDetectorCount).toBe(9)
    expect(result.panelWiredCapacity).toBe(9)
  })

  it('uses BH20 when five independent wired detector points fit it', () => {
    const needs = extractSecurityNeeds([
      '۲ در ورودی، ۲ پنجره و ۱ فضای اصلی دارم، پکیج سیمی بده',
    ])

    const result = buildDeterministicSecurityPackage(PRODUCTS, needs)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return

    expect(result.items[0]?.product.sku).toBe('BH20')
    expect(result.wiredDetectorCount).toBe(5)
  })

  it('never turns a zero-quantity opening requirement into a phantom MG10', () => {
    const needs = extractSecurityNeeds([
      'صفر پنجره، صفر در ورودی و ۱ فضای اصلی دارم، پکیج سیمی بده',
    ])

    const result = buildDeterministicSecurityPackage(PRODUCTS, needs)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return

    expect(result.items.map((item) => item.product.sku)).toEqual(['BH20', 'P100'])
    expect(result.items.every((item) => item.quantity > 0)).toBe(true)
  })

  it('does not silently clip a required opening-sensor quantity to current stock', () => {
    const lowStock = PRODUCTS.map((product) => (
      product.sku === 'MG10' ? { ...product, stock: 4 } : product
    ))
    const needs = extractSecurityNeeds([
      '۳ پنجره، ۲ در ورودی و ۱ فضای اصلی دارم، پکیج سیمی بده',
    ])

    const result = buildDeterministicSecurityPackage(lowStock, needs)
    expect(result.status).toBe('unsupported')
  })

  it('gives a useful wireless answer when MG11 exists but no wireless motion sensor is confirmed', () => {
    const needs = extractSecurityNeeds([
      '۳ پنجره، ۲ در ورودی دارم، پکیج کاملاً بیسیم بده',
    ])

    const result = buildDeterministicSecurityPackage(PRODUCTS, needs)
    expect(result.status).toBe('unsupported')
    if (result.status !== 'unsupported') return

    expect(result.message).toContain('MG11')
    expect(result.message).toContain('چشمی حرکتی بی‌سیم')
    expect(result.message).toContain('ترکیبی')
  })

  it('builds a hybrid package only when wireless capacity and frequency are compatible', () => {
    const needs = extractSecurityNeeds([
      '۳ پنجره، ۲ در ورودی و ۲ فضای اصلی دارم؛ پکیج ترکیبی بده',
    ])

    const result = buildDeterministicSecurityPackage(PRODUCTS, needs)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return

    expect(result.design).toBe('hybrid')
    expect(result.items.map((item) => [item.product.sku, item.quantity])).toEqual([
      ['BH20', 1],
      ['MG11', 5],
      ['P100', 2],
    ])
    expect(result.wiredDetectorCount).toBe(2)
    expect(result.wirelessDetectorCount).toBe(5)
    expect(result.panelWirelessCapacity).toBe(20)
  })

  it('asks for motion count before building a fully wireless package when a wireless PIR actually exists', () => {
    const catalog: DeterministicPackageProduct[] = [
      ...PRODUCTS,
      {
        id: 'wpir',
        sku: 'WPIR1',
        name: 'چشمی حرکتی بی‌سیم تست',
        price: 10_000_000,
        stock: 10,
        status: 'active',
        category: 'سنسورهای تشخیص حرکت',
        description: 'چشمی بی‌سیم',
        specs: [{ key: 'فرکانس بی‌سیم', value: '315 مگاهرتز' }],
      },
    ]
    const needs = extractSecurityNeeds([
      '۳ پنجره و ۲ در ورودی دارم، پکیج کاملاً بیسیم بده',
    ])

    const result = buildDeterministicSecurityPackage(catalog, needs)
    expect(result).toMatchObject({
      status: 'needs_input',
      questionKey: 'motion_areas',
    })
  })

  it('asks one concise openings question when both counts are absent', () => {
    const needs = extractSecurityNeeds([
      'یه خونه ۳۰۰ متری دارم و از دزدگیر هیچی سر درنمیارم؛ خودت پیشنهاد بده',
    ])

    expect(buildDeterministicSecurityPackage(PRODUCTS, needs)).toMatchObject({
      status: 'needs_input',
      questionKey: 'openings',
    })
  })
})
