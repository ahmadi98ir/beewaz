import { describe, expect, it } from 'vitest'
import {
  assessSecurityCart,
  classifySecurityProduct,
  getPanelWiredZoneCapacity,
  getPanelWirelessZoneCapacity,
  getSecurityProductConnectionType,
  securityCartGuardMessage,
  shouldEnforceSystemCompleteness,
  wiredZoneCapacityGuardMessage,
  wirelessZoneCapacityGuardMessage,
} from './security-system-builder'

describe('security system builder', () => {
  it('classifies common Beewaz security product roles', () => {
    expect(classifySecurityProduct({
      sku: 'BH21',
      name: 'دستگاه دزدگیر BH21 بیواز',
      category: 'پنل های مرکزی هشدار',
    })).toBe('panel')

    expect(classifySecurityProduct({
      sku: 'P100',
      name: 'چشمی حرکتی بیواز P100',
      category: 'سنسورهای تشخیص حرکت',
    })).toBe('motion_sensor')

    expect(classifySecurityProduct({
      sku: 'MG10',
      name: 'مگنت سیمی بیواز MG10',
      category: 'حسگر ها',
    })).toBe('opening_sensor')
  })

  it('does not misclassify a panel because its description mentions sensors', () => {
    expect(classifySecurityProduct({
      sku: 'BH21',
      name: 'دستگاه دزدگیر BH21 بیواز',
      category: 'پنل های مرکزی هشدار',
      description: 'پشتیبانی از سنسورهای سیمی و بی‌سیم و مگنت در و پنجره',
    })).toBe('panel')
  })

  it('does not misclassify a shock sensor as an opening sensor just because its description mentions a door', () => {
    expect(classifySecurityProduct({
      sku: 'BSH30',
      name: 'شوک‌سنسور سیمی بیواز BSH30',
      category: 'سنسورهای محیطی',
      description: 'برای تشخیص شوک، شکست شیشه و حتی باز شدن درب',
    })).toBe('other')
  })

  it('detects connection type from product identity before description noise', () => {
    expect(getSecurityProductConnectionType({
      sku: 'MG11',
      name: 'مگنت بی‌سیم بیواز MG11',
      description: 'قابل استفاده در کنار تجهیزات سیمی دیگر',
    })).toBe('wireless')

    expect(getSecurityProductConnectionType({
      sku: 'P100',
      name: 'چشمی حرکتی بیواز P100',
      description: 'حسگر حرکتی PIR سیمی',
    })).toBe('wired')
  })

  it('rejects a detector-only cart as incomplete because it has no panel', () => {
    const assessment = assessSecurityCart([
      { sku: 'MG10', name: 'مگنت سیمی بیواز MG10', category: 'حسگر ها', quantity: 8 },
      { sku: 'P100', name: 'چشمی حرکتی بیواز P100', category: 'سنسورهای تشخیص حرکت', quantity: 3 },
    ])

    expect(assessment.hasPanel).toBe(false)
    expect(assessment.hasDetection).toBe(true)
    expect(assessment.missingRequired).toContain('central_panel')
    expect(securityCartGuardMessage(assessment)).toContain('پنل مرکزی')
  })

  it('rejects a panel-only cart as incomplete', () => {
    const assessment = assessSecurityCart([
      { sku: 'BH21', name: 'دستگاه دزدگیر BH21 بیواز', category: 'پنل های مرکزی هشدار', quantity: 1 },
    ])

    expect(assessment.hasPanel).toBe(true)
    expect(assessment.hasDetection).toBe(false)
    expect(assessment.missingRequired).toContain('intrusion_detection')
    expect(securityCartGuardMessage(assessment)).toContain('پنل به‌تنهایی')
  })

  it('accepts a panel with at least one intrusion detector', () => {
    const assessment = assessSecurityCart([
      { sku: 'BH21', name: 'دستگاه دزدگیر BH21 بیواز', category: 'پنل های مرکزی هشدار', quantity: 1 },
      { sku: 'P100', name: 'چشمی حرکتی بیواز P100', category: 'سنسورهای تشخیص حرکت', quantity: 2 },
      { sku: 'MG10', name: 'مگنت سیمی بیواز MG10', category: 'حسگر ها', quantity: 1 },
    ])

    expect(assessment.missingRequired).toEqual([])
    expect(securityCartGuardMessage(assessment)).toBeNull()
  })

  it('enforces completeness for novice home-system conversations', () => {
    expect(shouldEnforceSystemCompleteness(
      'من برای خونه ۱۲۰ متری هیچی از دزدگیر سر درنمیارم، سیستم کامل می‌خوام',
    )).toBe(true)
  })

  it('allows an explicit panel-only purchase', () => {
    expect(shouldEnforceSystemCompleteness(
      'فقط پنل BH21 رو به سبد اضافه کن',
    )).toBe(false)
  })

  it('reads wired capacity from the production-shaped اتصالات spec value', () => {
    expect(getPanelWiredZoneCapacity({
      sku: 'BH21',
      name: 'دستگاه دزدگیر BH21 بیواز',
      category: 'پنل های مرکزی هشدار',
      specs: [{
        key: 'اتصالات',
        value: '9 عدد زون سیمی / برد 4 رله / آنتن GSM / آنتن SUB GHz',
      }],
    })).toBe(9)

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

  it('falls back to the product description when a wired-zone spec row is missing', () => {
    expect(getPanelWiredZoneCapacity({
      sku: 'BH21',
      name: 'دستگاه دزدگیر BH21 بیواز',
      category: 'پنل های مرکزی هشدار',
      description: 'این دستگاه دارای 9 زون سیمی و 20 زون بی‌سیم است.',
      specs: [],
    })).toBe(9)
  })


  it('reads wireless zone capacity from panel description without confusing it with wired capacity', () => {
    const panel = {
      sku: 'BH21',
      name: 'دستگاه دزدگیر BH21 بیواز',
      category: 'پنل های مرکزی هشدار',
      description: 'این دستگاه دارای 9 زون سیمی و 20 زون بی‌سیم است.',
      specs: [{ key: 'اتصالات', value: '9 عدد زون سیمی / برد 4 رله' }],
    }

    expect(getPanelWiredZoneCapacity(panel)).toBe(9)
    expect(getPanelWirelessZoneCapacity(panel)).toBe(20)
  })

  it('blocks a ready-to-install claim when wired detectors exceed registered wired zones', () => {
    const message = wiredZoneCapacityGuardMessage([
      {
        sku: 'BH20',
        name: 'دستگاه دزدگیر BH20 بیواز',
        category: 'پنل های مرکزی هشدار',
        quantity: 1,
        specs: [{ key: 'زون‌های سیمی', value: '۵ زون' }],
      },
      {
        sku: 'MG10',
        name: 'مگنت سیمی بیواز MG10',
        category: 'سنسورهای محیطی',
        description: 'حسگر مجاورت سیمی',
        quantity: 7,
      },
      {
        sku: 'P100',
        name: 'چشمی حرکتی بیواز P100',
        category: 'سنسورهای تشخیص حرکت',
        description: 'حسگر حرکتی PIR سیمی',
        quantity: 2,
      },
    ])

    expect(message).toContain('۹ حسگر سیمی')
    expect(message).toContain('۵ زون سیمی')
  })

  it('blocks wireless detectors that exceed the panel registered wireless zones', () => {
    const message = wirelessZoneCapacityGuardMessage([
      {
        sku: 'BH20',
        name: 'دستگاه دزدگیر BH20 بیواز',
        category: 'پنل های مرکزی هشدار',
        description: 'دارای 5 زون سیمی و 20 زون بی‌سیم',
        quantity: 1,
      },
      {
        sku: 'MG11',
        name: 'مگنت بی‌سیم بیواز MG11',
        description: 'مگنت بی‌سیم',
        quantity: 21,
      },
    ])

    expect(message).toContain('۲۱ حسگر بی‌سیم')
    expect(message).toContain('۲۰ زون بی‌سیم')
  })

  it('allows an independently zoned layout that fits panel wired capacity', () => {
    expect(wiredZoneCapacityGuardMessage([
      {
        sku: 'BH21',
        name: 'دستگاه دزدگیر BH21 بیواز',
        category: 'پنل های مرکزی هشدار',
        quantity: 1,
        specs: [{ key: 'زون‌های سیمی', value: '۹ زون' }],
      },
      {
        sku: 'MG10',
        name: 'مگنت سیمی بیواز MG10',
        description: 'مگنت سیمی',
        quantity: 7,
      },
      {
        sku: 'P100',
        name: 'چشمی حرکتی بیواز P100',
        description: 'چشمی حرکتی سیمی',
        quantity: 2,
      },
    ])).toBeNull()
  })
})
