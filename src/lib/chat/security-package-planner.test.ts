import { describe, expect, it } from 'vitest'
import {
  buildDeterministicSecurityPackage,
  extractSecurityNeeds,
  isPackageRecommendationIntent,
  isPackageRequirementsUpdate,
  isSecurityPackageConversation,
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
    specs: [{ key: 'اتصالات', value: '5 عدد زون سیمی / برد 4 رله / آنتن GSM' }],
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
    specs: [{ key: 'اتصالات', value: '9 عدد زون سیمی / برد 4 رله / آنتن GSM / آنتن SUB GHz' }],
  },
  {
    id: 'mg10',
    sku: 'MG10',
    name: 'مگنت سیمی بیواز MG10',
    price: 2_900_000,
    stock: 50,
    status: 'active',
    category: 'سنسورهای محیطی',
  },
  {
    id: 'p100',
    sku: 'P100',
    name: 'چشمی حرکتی سیمی بیواز P100',
    price: 13_200_000,
    stock: 20,
    status: 'active',
    category: 'سنسورهای تشخیص حرکت',
  },
]

describe('deterministic security package planner', () => {
  it('extracts the production scenario from Persian text', () => {
    const needs = extractSecurityNeeds([
      'من یه خونه ۳۰۰ متری دارم، ۶ تا پنجره و ۲ تا در ورودی دارم. از دزدگیر هیچی سر درنمیارم.',
    ])

    expect(needs).toEqual({
      areaM2: 300,
      doors: 2,
      windows: 6,
      motionAreas: null,
      wiringPreference: 'unknown',
      novice: true,
    })
  })

  it('understands Persian word-number counts', () => {
    const needs = extractSecurityNeeds([
      'خونه‌م دو تا در ورودی و شش تا پنجره داره',
    ])

    expect(needs.doors).toBe(2)
    expect(needs.windows).toBe(6)
  })

  it('recognizes a security package conversation and recommendation intent', () => {
    expect(isSecurityPackageConversation([
      'یه خونه ۳۰۰ متری دارم',
      'برای دزدگیر خودت یه پکیج پیشنهاد بده',
    ])).toBe(true)
    expect(isPackageRecommendationIntent('اوکی چی پیشنهاد میدی؟')).toBe(true)
  })


  it('keeps package flow active only for real requirement updates, not arbitrary typos', () => {
    expect(isPackageRequirementsUpdate('۳ تا پنجره و ۲ تا در ورودی دارم')).toBe(true)
    expect(isPackageRequirementsUpdate('خوب بیسیم چی؟')).toBe(true)
    expect(isPackageRequirementsUpdate('اومی')).toBe(false)
  })

  it('reproduces the failed production case: 3 windows + 2 doors selects BH21 for 6 wired points', () => {
    const needs = extractSecurityNeeds([
      'من یه خونه ۳۰۰ متری دارم، ۳ تا پنجره و ۲ تا در ورودی دارم. از دزدگیر هیچی سر درنمیارم، خودت یه پکیج مناسب و کامل پیشنهاد بده.',
    ])

    const result = buildDeterministicSecurityPackage(PRODUCTS, needs)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return

    expect(result.items.map((item) => [item.product.sku, item.quantity])).toEqual([
      ['BH21', 1],
      ['MG10', 5],
      ['P100', 1],
    ])
    expect(result.wiredDetectorCount).toBe(6)
    expect(result.panelWiredCapacity).toBe(9)
  })

  it('builds BH21 + 8 MG10 + 1 P100 for 6 windows and 2 doors', () => {
    const needs = extractSecurityNeeds([
      'من یه خونه ۳۰۰ متری دارم، ۶ تا پنجره و ۲ تا در ورودی دارم. از دزدگیر هیچی سر درنمیارم، خودت یه پکیج مناسب و کامل پیشنهاد بده.',
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
    expect(result.totalPrice).toBe(245_400_000)
  })

  it('uses BH20 when five wired detector points fit it', () => {
    const needs = extractSecurityNeeds([
      'یه خونه دارم با ۲ تا در و ۲ تا پنجره، خودت پکیج سیمی پیشنهاد بده',
    ])

    const result = buildDeterministicSecurityPackage(PRODUCTS, needs)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect(result.items[0]?.product.sku).toBe('BH20')
    expect(result.wiredDetectorCount).toBe(5)
  })

  it('asks exactly one concise question when opening counts are missing', () => {
    const needs = extractSecurityNeeds([
      'یه خونه ۳۰۰ متری دارم و از دزدگیر هیچی سر درنمیارم؛ خودت پیشنهاد بده',
    ])

    const result = buildDeterministicSecurityPackage(PRODUCTS, needs)
    expect(result).toMatchObject({
      status: 'needs_input',
      question: 'فقط تعداد درهای ورودی و پنجره‌های قابل‌دسترسی رو بهم بگو؛ بقیه انتخاب‌ها با من.',
    })
  })

  it('refuses to invent a fully wireless package without structured compatibility data', () => {
    const needs = extractSecurityNeeds([
      'خونه من ۲ تا در و ۶ تا پنجره داره، یه پکیج کاملاً بی‌سیم بده',
    ])

    const result = buildDeterministicSecurityPackage(PRODUCTS, needs)
    expect(result.status).toBe('unsupported')
  })
})
