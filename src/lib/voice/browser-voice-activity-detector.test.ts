import { describe, expect, it } from 'vitest'
import { computeRms, decideVoiceActivity } from './browser-voice-activity-detector'

describe('browser voice activity helpers', () => {
  it('returns zero RMS for centered silence', () => {
    expect(computeRms(new Uint8Array([128, 128, 128, 128]))).toBe(0)
  })

  it('returns a larger RMS for stronger waveform samples', () => {
    const quiet = computeRms(new Uint8Array([126, 130, 126, 130]))
    const loud = computeRms(new Uint8Array([80, 176, 80, 176]))

    expect(loud).toBeGreaterThan(quiet)
  })

  it('uses both the minimum threshold and adaptive noise floor', () => {
    expect(decideVoiceActivity(0.02, 0.005, 0.03, 3.2)).toMatchObject({
      threshold: 0.03,
      active: false,
    })

    const noisyRoom = decideVoiceActivity(0.09, 0.03, 0.03, 3.2)
    expect(noisyRoom.threshold).toBeCloseTo(0.096)
    expect(noisyRoom.active).toBe(false)

    const speech = decideVoiceActivity(0.13, 0.03, 0.03, 3.2)
    expect(speech.active).toBe(true)
  })
})
