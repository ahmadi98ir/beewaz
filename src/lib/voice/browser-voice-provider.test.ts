import { describe, expect, it } from 'vitest'
import { mapRecognitionErrorCode, toSpeechText } from './browser-voice-provider'

describe('browser voice helpers', () => {
  it('maps Web Speech recognition errors to stable provider errors', () => {
    expect(mapRecognitionErrorCode('not-allowed')).toBe('permission-denied')
    expect(mapRecognitionErrorCode('service-not-allowed')).toBe('permission-denied')
    expect(mapRecognitionErrorCode('no-speech')).toBe('no-speech')
    expect(mapRecognitionErrorCode('audio-capture')).toBe('audio-capture')
    expect(mapRecognitionErrorCode('network')).toBe('network')
    expect(mapRecognitionErrorCode('aborted')).toBe('aborted')
    expect(mapRecognitionErrorCode('something-new')).toBe('unknown')
  })

  it('turns formatted assistant text into cleaner speech text', () => {
    const input = '**سلام!** [راهنمای نصب](https://beewaz.ir/help) را ببینید. `BH20` آماده است.'
    expect(toSpeechText(input)).toBe('سلام! راهنمای نصب را ببینید. BH20 آماده است.')
  })

  it('removes code blocks and bare URLs from speech output', () => {
    const input = 'پاسخ کوتاه\n```js\nconsole.log("x")\n```\nhttps://example.com ادامه'
    expect(toSpeechText(input)).toBe('پاسخ کوتاه ادامه')
  })
})
