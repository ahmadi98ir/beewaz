'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeeChatState } from '@/components/bee/BeeChatState'
import { BrowserVoiceProvider } from '@/lib/voice/browser-voice-provider'
import {
  VoiceProviderError,
  voiceErrorMessageFa,
  type VoicePhase,
  type VoiceProvider,
} from '@/lib/voice/voice-provider'

const LANGUAGE = 'fa-IR'

interface VoiceRuntimeConfig {
  enabled: boolean
  provider: 'browser' | 'disabled'
  language?: string
}

interface StartListeningOptions {
  onDraft: (text: string) => void
  onFinal: (text: string) => void
}

function asVoiceError(error: unknown): VoiceProviderError {
  return error instanceof VoiceProviderError
    ? error
    : new VoiceProviderError('unknown', error instanceof Error ? error.message : undefined)
}

export function useVoiceAssistant() {
  const { setState: setBeeState, setTransientState: setBeeTransientState } = useBeeChatState()
  const [enabled, setEnabled] = useState(false)
  const [available, setAvailable] = useState(false)
  const [phase, setPhase] = useState<VoicePhase>('idle')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const providerRef = useRef<VoiceProvider | null>(null)
  const languageRef = useRef(LANGUAGE)
  const listenTokenRef = useRef(0)
  const speakTokenRef = useRef(0)
  const messageTimerRef = useRef<number | null>(null)

  const clearMessageTimer = useCallback(() => {
    if (messageTimerRef.current !== null) {
      window.clearTimeout(messageTimerRef.current)
      messageTimerRef.current = null
    }
  }, [])

  const scheduleStatusClear = useCallback((durationMs = 2600) => {
    clearMessageTimer()
    messageTimerRef.current = window.setTimeout(() => {
      messageTimerRef.current = null
      setStatusMessage(null)
      setPhase((current) => current === 'error' ? 'idle' : current)
    }, durationMs)
  }, [clearMessageTimer])

  const showError = useCallback((error: VoiceProviderError) => {
    if (error.code === 'aborted') {
      setPhase('idle')
      setStatusMessage(null)
      setBeeState('idle')
      return
    }

    setPhase('error')
    setStatusMessage(voiceErrorMessageFa(error))
    setBeeTransientState('error', 1800)
    scheduleStatusClear()
  }, [scheduleStatusClear, setBeeState, setBeeTransientState])

  useEffect(() => {
    let cancelled = false
    let provider: VoiceProvider | null = null

    fetch('/api/voice/config', { cache: 'no-store' })
      .then((response) => response.json() as Promise<VoiceRuntimeConfig>)
      .then((config) => {
        if (cancelled) return
        const isEnabled = config.enabled && config.provider === 'browser'
        setEnabled(isEnabled)
        if (!isEnabled) return

        languageRef.current = config.language || LANGUAGE
        provider = new BrowserVoiceProvider()
        providerRef.current = provider
        setAvailable(provider.canListen())
      })
      .catch(() => {
        if (!cancelled) {
          setEnabled(false)
          setAvailable(false)
        }
      })

    return () => {
      cancelled = true
      listenTokenRef.current += 1
      speakTokenRef.current += 1
      provider?.destroy()
      if (providerRef.current === provider) providerRef.current = null
      clearMessageTimer()
    }
  }, [clearMessageTimer])

  const cancelAll = useCallback(() => {
    listenTokenRef.current += 1
    speakTokenRef.current += 1
    clearMessageTimer()
    providerRef.current?.destroy()
    setPhase('idle')
    setStatusMessage(null)
    setBeeState('idle')
  }, [clearMessageTimer, setBeeState])

  const finishListening = useCallback(() => {
    providerRef.current?.stopListening()
    setStatusMessage('در حال پایان شنیدن و ارسال پیام…')
  }, [])

  const startListening = useCallback(async ({ onDraft, onFinal }: StartListeningOptions) => {
    const provider = providerRef.current
    if (!enabled || !available || !provider) {
      showError(new VoiceProviderError('not-supported'))
      return
    }

    // Never let the assistant's own TTS feed back into recognition.
    speakTokenRef.current += 1
    provider.stopSpeaking()
    clearMessageTimer()

    const token = ++listenTokenRef.current
    let failed = false
    let latestTranscript = ''
    const finalChunks: string[] = []

    setPhase('requesting-permission')
    setStatusMessage('در حال درخواست دسترسی میکروفون…')
    setBeeState('listening')

    try {
      await provider.requestMicrophonePermission()
    } catch (error) {
      if (token === listenTokenRef.current) showError(asVoiceError(error))
      return
    }

    if (token !== listenTokenRef.current) return

    try {
      provider.startListening({
        language: languageRef.current,
        onStart: () => {
          if (token !== listenTokenRef.current) return
          setPhase('listening')
          setStatusMessage('دارم گوش می‌دم… برای پایان و ارسال دوباره روی میکروفون بزنید.')
          setBeeState('listening')
        },
        onTranscript: ({ text, isFinal }) => {
          if (token !== listenTokenRef.current) return
          latestTranscript = text
          if (isFinal) finalChunks.push(text)
          const draft = [...finalChunks, ...(isFinal ? [] : [text])].join(' ').trim()
          if (draft) onDraft(draft)
        },
        onError: (error) => {
          if (token !== listenTokenRef.current) return
          failed = true
          showError(error)
        },
        onEnd: () => {
          if (token !== listenTokenRef.current || failed) return
          setPhase('idle')
          setStatusMessage(null)
          setBeeState('idle')

          const finalText = (finalChunks.join(' ') || latestTranscript).trim()
          if (finalText) {
            onDraft(finalText)
            onFinal(finalText)
          } else {
            showError(new VoiceProviderError('no-speech'))
          }
        },
      })
    } catch (error) {
      if (token === listenTokenRef.current) showError(asVoiceError(error))
    }
  }, [available, clearMessageTimer, enabled, setBeeState, showError])

  const stopSpeaking = useCallback(() => {
    speakTokenRef.current += 1
    providerRef.current?.stopSpeaking()
    setPhase('idle')
    setStatusMessage(null)
    setBeeState('idle')
  }, [setBeeState])

  const speak = useCallback((text: string) => {
    const provider = providerRef.current
    if (!enabled || !provider) return

    clearMessageTimer()
    const token = ++speakTokenRef.current

    if (!provider.canSpeak()) {
      setBeeTransientState('speaking')
      setStatusMessage('پاسخ متنی آماده است؛ پخش صوت در این مرورگر پشتیبانی نمی‌شود.')
      scheduleStatusClear(3000)
      return
    }

    setPhase('speaking')
    setStatusMessage('بی‌واز در حال پاسخ صوتی است…')
    setBeeState('speaking')

    provider.speak(text, {
      language: languageRef.current,
      onStart: () => {
        if (token !== speakTokenRef.current) return
        setPhase('speaking')
        setStatusMessage('بی‌واز در حال پاسخ صوتی است…')
        setBeeState('speaking')
      },
      onEnd: () => {
        if (token !== speakTokenRef.current) return
        setPhase('idle')
        setStatusMessage(null)
        setBeeState('idle')
      },
      onError: (error) => {
        if (token !== speakTokenRef.current) return
        showError(error)
      },
    })
  }, [clearMessageTimer, enabled, scheduleStatusClear, setBeeState, setBeeTransientState, showError])

  return {
    enabled,
    available,
    phase,
    statusMessage,
    startListening,
    finishListening,
    speak,
    stopSpeaking,
    cancelAll,
  }
}
