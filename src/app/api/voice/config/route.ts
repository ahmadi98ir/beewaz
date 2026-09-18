import { NextResponse } from 'next/server'

function envFlagEnabled(value: string | undefined): boolean {
  if (!value) return true
  return !['0', 'false', 'off', 'no'].includes(value.trim().toLowerCase())
}

export async function GET() {
  const configuredProvider = (process.env.VOICE_PROVIDER ?? 'browser').trim().toLowerCase()
  const provider = configuredProvider === 'browser' ? 'browser' : 'disabled'
  const enabled = envFlagEnabled(process.env.VOICE_ENABLED) && provider === 'browser'
  const handsFree = enabled && envFlagEnabled(process.env.BEE_HANDSFREE_ENABLED)
  const parsedSilenceMs = Number.parseInt(process.env.BEE_TURN_SILENCE_MS ?? '1200', 10)
  const turnSilenceMs = Number.isFinite(parsedSilenceMs)
    ? Math.min(3000, Math.max(600, parsedSilenceMs))
    : 1200

  return NextResponse.json(
    {
      enabled,
      provider: enabled ? 'browser' : 'disabled',
      language: 'fa-IR',
      handsFree,
      turnSilenceMs,
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  )
}
