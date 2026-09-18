import { describe, expect, it } from 'vitest'
import {
  assessSecurityCart,
  classifySecurityProduct,
  securityCartGuardMessage,
  shouldEnforceSystemCompleteness,
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

  it('rejects a panel-only cart as incomplete', () => {
    const assessment = assessSecurityCart([
      { sku: 'BH21', name: 'دستگاه دزدگیر BH21 بیواز', category: 'پنل های مرکزی هشدار', quantity: 1 },
    ])

    expect(assessment.hasPanel).toBe(true)
    expect(assessment.hasDetection).toBe(false)
    expect(assessment.missingRequired).toContain('intrusion_detection')
    expect(securityCartGuardMessage(assessment)).toContain('پنل مرکزی به‌تنهایی')
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
})
