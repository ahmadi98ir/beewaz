import { NextResponse } from 'next/server'

function envFlagEnabled(value: string | undefined): boolean {
  if (!value) return true
  return !['0', 'false', 'off', 'no'].includes(value.trim().toLowerCase())
}

export async function GET() {
  const configuredProvider = (process.env.VOICE_PROVIDER ?? 'browser').trim().toLowerCase()
  const provider = configuredProvider === 'browser' ? 'browser' : 'disabled'
  const enabled = envFlagEnabled(process.env.VOICE_ENABLED) && provider === 'browser'

  return NextResponse.json(
    {
      enabled,
      provider: enabled ? 'browser' : 'disabled',
      language: 'fa-IR',
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    },
  )
}
