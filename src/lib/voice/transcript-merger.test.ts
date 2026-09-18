import { describe, expect, it } from 'vitest'
import { mergeSpeechTranscript } from './transcript-merger'

describe('mergeSpeechTranscript', () => {
  it('replaces progressive cumulative recognition with the richer phrase', () => {
    let text = ''
    text = mergeSpeechTranscript(text, 'برای')
    text = mergeSpeechTranscript(text, 'برای خونه')
    text = mergeSpeechTranscript(text, 'برای خونه ۱۲۰ متری')
    text = mergeSpeechTranscript(text, 'برای خونه ۱۲۰ متری چه گزینه‌هایی داری')

    expect(text).toBe('برای خونه ۱۲۰ متری چه گزینه‌هایی داری')
  })

  it('joins chunks by their largest token overlap', () => {
    const merged = mergeSpeechTranscript(
      'برای خونه ۱۲۰ متری',
      '۱۲۰ متری چه گزینه‌هایی داری بهم پیشنهاد بدی',
    )

    expect(merged).toBe('برای خونه ۱۲۰ متری چه گزینه‌هایی داری بهم پیشنهاد بدی')
  })

  it('deduplicates equal phrases even across Persian and Arabic digits', () => {
    expect(mergeSpeechTranscript('BH۲۱ موجوده', 'BH21 موجوده')).toBe('BH21 موجوده')
  })

  it('keeps distinct sequential chunks', () => {
    expect(mergeSpeechTranscript('سلام', 'خوبی')).toBe('سلام خوبی')
  })
})
