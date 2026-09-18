// OpenAI-compatible LLM client — supports AvalAI, OpenAI, and any compatible endpoint.
// Configure via environment variables: AI_BASE_URL, AI_API_KEY, AI_MODEL

import OpenAI from 'openai'

const baseURL =
  process.env.AI_BASE_URL ??
  process.env.AVALAI_BASE_URL ??
  'https://api.avalai.ir/v1'

const apiKey =
  process.env.AI_API_KEY ??
  process.env.AVALAI_API_KEY ??
  process.env.GEMINI_API_KEY ??
  'no-key'

const model = process.env.AI_MODEL ?? 'gemini-2.0-flash'

const openai = new OpenAI({
  apiKey,
  baseURL,
  timeout: 25_000,
  maxRetries: 1,
})

if (!process.env.AI_API_KEY && !process.env.AVALAI_API_KEY && !process.env.GEMINI_API_KEY) {
  console.warn('[ai] No API key configured — set AI_API_KEY env var')
}

// ── Low-level completion call ─────────────────────────────────────────────────

export function isRetryableAIError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const maybe = error as {
    status?: unknown
    code?: unknown
    name?: unknown
  }

  const status = typeof maybe.status === 'number' ? maybe.status : Number(maybe.status)
  if (Number.isFinite(status)) {
    if ([408, 409, 429].includes(status)) return true
    if (status >= 500) return true
    return false
  }

  const code = typeof maybe.code === 'string' ? maybe.code : ''
  if (['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN'].includes(code)) return true

  const name = typeof maybe.name === 'string' ? maybe.name : ''
  return [
    'APIConnectionError',
    'APIConnectionTimeoutError',
    'FetchError',
    'TypeError',
  ].includes(name)
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function callAI(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
): Promise<string> {
  const delays = [0, 500, 1200]
  let lastError: unknown

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt]! > 0) await wait(delays[attempt]!)

    try {
      const completion = await openai.chat.completions.create({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      })
      const content = completion.choices[0]?.message?.content?.trim()
      if (!content) throw new Error('AI returned an empty completion')
      return content
    } catch (error) {
      lastError = error
      const finalAttempt = attempt === delays.length - 1
      if (finalAttempt || !isRetryableAIError(error)) throw error
      console.warn('[ai] transient completion error; retrying', {
        attempt: attempt + 1,
        status: typeof error === 'object' && error && 'status' in error
          ? (error as { status?: unknown }).status
          : undefined,
      })
    }
  }

  throw lastError instanceof Error ? lastError : new Error('AI completion failed')
}

// ── Public helpers ────────────────────────────────────────────────────────────

export async function generateText(prompt: string): Promise<string> {
  return callAI([{ role: 'user', content: prompt }])
}

export async function chat(
  history: { role: 'user' | 'model'; text: string }[],
  systemInstruction: string,
): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemInstruction },
    ...history.slice(-16).map((m) => ({
      role: m.role === 'model' ? ('assistant' as const) : ('user' as const),
      content: m.text,
    })),
  ]
  return callAI(messages)
}
