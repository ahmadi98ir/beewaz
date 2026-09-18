import { describe, expect, it } from 'vitest'
import { isRetryableAIError } from './gemini'

describe('isRetryableAIError', () => {
  it('retries rate limits and transient server errors', () => {
    expect(isRetryableAIError({ status: 429 })).toBe(true)
    expect(isRetryableAIError({ status: 502 })).toBe(true)
    expect(isRetryableAIError({ status: 503 })).toBe(true)
  })

  it('does not retry permanent client/auth errors', () => {
    expect(isRetryableAIError({ status: 400 })).toBe(false)
    expect(isRetryableAIError({ status: 401 })).toBe(false)
    expect(isRetryableAIError({ status: 403 })).toBe(false)
  })

  it('retries common transport failures', () => {
    expect(isRetryableAIError({ code: 'ECONNRESET' })).toBe(true)
    expect(isRetryableAIError({ code: 'ETIMEDOUT' })).toBe(true)
    expect(isRetryableAIError({ name: 'APIConnectionTimeoutError' })).toBe(true)
  })
})
