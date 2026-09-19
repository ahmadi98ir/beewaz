import { describe, expect, it } from 'vitest'
import {
  assessSecurityCart,
  classifySecurityProduct,
  getPanelWiredZoneCapacity,
  getPanelWirelessZoneCapacity,
  getWirelessFrequenciesMHz,
  securityCartGuardMessage,
  shouldEnforceSystemCompleteness,
  wiredZoneCapacityGuardMessage,
} from './security-system-builder'

describe('security system builder', () => {
  it('classifies Beewaz products from stable identity fields', () => {
    expect(classifySecurityProduct({
      sku: 'BH21',
      name: 'دستگاه دزدگیر BH21 بیواز',
      category: 'پنل های مرکزی هشدار',
      categorySlug: 'central-warning-panels',
      description: 'سازگار با سنسور و مگنت و چشمی',
    })).toBe('panel')

    expect(classifySecurityProduct({
      sku: 'P100',
      name: 'چشمی حرکتی بیواز P100',
      category: 'سنسورهای تشخیص حرکت',
      description: 'حسگر حرکتی PIR سیمی',
    })).toBe('motion_sensor')

    expect(classifySecurityProduct({
      sku: 'MG10',
      name: 'مگنت سیمی بیواز MG10',
      category: 'سنسورهای محیطی',
    })).toBe('opening_sensor')

    expect(classifySecurityProduct({
      sku: 'BSH30',
      name: 'شوک‌سنسور سیمی بیواز BSH30',
      category: 'سنسورهای محیطی',
      description: 'برای شکست شیشه، ضربه و حتی باز شدن درب',
    })).toBe('intrusion_sensor')
  })

  it('rejects incomplete detector-only and panel-only system carts', () => {
    const detectorOnly = assessSecurityCart([
      { sku: 'MG10', name: 'مگنت سیمی بیواز MG10', category: 'حسگر ها', quantity: 2 },
    ])
    expect(detectorOnly.missingRequired).toContain('central_panel')
    expect(securityCartGuardMessage(detectorOnly)).toContain('پنل مرکزی')

    const panelOnly = assessSecurityCart([
      { sku: 'BH21', name: 'دستگاه دزدگیر BH21 بیواز', category: 'پنل های مرکزی هشدار', quantity: 1 },
    ])
    expect(panelOnly.missingRequired).toContain('intrusion_detection')
    expect(securityCartGuardMessage(panelOnly)).toContain('حسگر تشخیص نفوذ')
  })

  it('accepts motion, opening and shock sensors as intrusion detection', () => {
    for (const detector of [
      { sku: 'P100', name: 'چشمی حرکتی بیواز P100', category: 'سنسورهای تشخیص حرکت' },
      { sku: 'MG10', name: 'مگنت سیمی بیواز MG10', category: 'حسگر ها' },
      { sku: 'BSH30', name: 'شوک‌سنسور سیمی بیواز BSH30', category: 'حسگر ها' },
    ]) {
      const assessment = assessSecurityCart([
        { sku: 'BH21', name: 'دستگاه دزدگیر BH21 بیواز', category: 'پنل های مرکزی هشدار', quantity: 1 },
        { ...detector, quantity: 1 },
      ])
      expect(assessment.missingRequired).toEqual([])
    }
  })

  it('does not warn for an external siren when panel data documents audible outputs', () => {
    const assessment = assessSecurityCart([
      {
        sku: 'BH21',
        name: 'دستگاه دزدگیر BH21 بیواز',
        category: 'پنل های مرکزی هشدار',
        quantity: 1,
        specs: [{
          key: 'اتصالات',
          value: 'آنتن GSM / باتری پشتیبان / آژیر / بلندگو',
        }],
      },
      {
        sku: 'MG10',
        name: 'مگنت سیمی بیواز MG10',
        category: 'حسگر ها',
        quantity: 1,
      },
    ])

    expect(assessment.panelHasIntegratedAudible).toBe(true)
    expect(assessment.advisories).toEqual([])
  })

  it('enforces completeness for a novice system request but not an explicit panel-only purchase', () => {
    expect(shouldEnforceSystemCompleteness(
      'من برای خونه ۱۲۰ متری هیچی از دزدگیر سر درنمیارم، سیستم کامل می‌خوام',
    )).toBe(true)
    expect(shouldEnforceSystemCompleteness(
      'فقط پنل BH21 رو به سبد اضافه کن',
    )).toBe(false)
  })

  it('reads wired and wireless capacities from production-shaped specs/descriptions', () => {
    const bh21 = {
      sku: 'BH21',
      name: 'دستگاه دزدگیر BH21 بیواز',
      category: 'پنل های مرکزی هشدار',
      description: 'دارای 9 زون سیمی و 20 زون بی‌سیم',
      specs: [{
        key: 'اتصالات',
        value: '9 عدد زون سیمی / آنتن SUB GHz / آژیر / بلندگو',
      }],
    }

    expect(getPanelWiredZoneCapacity(bh21)).toBe(9)
    expect(getPanelWirelessZoneCapacity(bh21)).toBe(20)

    expect(getPanelWiredZoneCapacity({
      sku: 'BH20',
      name: 'دستگاه دزدگیر BH20 بیواز',
      category: 'پنل های مرکزی هشدار',
      specs: [{
        key: 'اتصالات',
        value: '5 عدد زون سیمی / برد 4 رله / آنتن GSM',
      }],
    })).toBe(5)
  })

  it('extracts both values from slash-separated wireless frequency specs', () => {
    expect(getWirelessFrequenciesMHz({
      sku: 'MG11',
      name: 'مگنت بی‌سیم بیواز MG11',
      specs: [{ key: 'فرکانس بی‌سیم', value: '۳۱۵/۴۳۳ مگاهرتز' }],
    })).toEqual([315, 433])

    expect(getWirelessFrequenciesMHz({
      sku: 'BH21',
      name: 'دستگاه دزدگیر BH21 بیواز',
      specs: [{ key: 'فرکانس بی‌سیم', value: '315 مگاهرتز' }],
    })).toEqual([315])
  })

  it('explains independent-zone overflow without claiming grouping is impossible', () => {
    const message = wiredZoneCapacityGuardMessage([
      {
        sku: 'BH20',
        name: 'دستگاه دزدگیر BH20 بیواز',
        category: 'پنل های مرکزی هشدار',
        quantity: 1,
        specs: [{ key: 'اتصالات', value: '۵ عدد زون سیمی' }],
      },
      {
        sku: 'MG10',
        name: 'مگنت سیمی بیواز MG10',
        quantity: 5,
      },
      {
        sku: 'P100',
        name: 'چشمی حرکتی سیمی بیواز P100',
        quantity: 2,
      },
    ])

    expect(message).toContain('۷ حسگر سیمی')
    expect(message).toContain('۵ زون سیمی')
    expect(message).toContain('گروه‌بندی')
  })

  it('allows an independent-zone design that fits the panel capacity', () => {
    expect(wiredZoneCapacityGuardMessage([
      {
        sku: 'BH21',
        name: 'دستگاه دزدگیر BH21 بیواز',
        category: 'پنل های مرکزی هشدار',
        quantity: 1,
        specs: [{ key: 'اتصالات', value: '۹ عدد زون سیمی' }],
      },
      {
        sku: 'MG10',
        name: 'مگنت سیمی بیواز MG10',
        quantity: 5,
      },
      {
        sku: 'P100',
        name: 'چشمی حرکتی سیمی بیواز P100',
        quantity: 2,
      },
    ])).toBeNull()
  })
})
