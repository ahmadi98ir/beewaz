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
  handsFree?: boolean
  turnSilenceMs?: number
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
  const {
    setState: setBeeState,
    setTransientState: setBeeTransientState,
    setPhase: setConversationPhase,
    setInteractionMode,
    setVoiceConsent,
  } = useBeeChatState()

  const [enabled, setEnabled] = useState(false)
  const [available, setAvailable] = useState(false)
  const [handsFreeEnabled, setHandsFreeEnabled] = useState(false)
  const [sessionActive, setSessionActive] = useState(false)
  const [phase, setPhase] = useState<VoicePhase>('idle')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const providerRef = useRef<VoiceProvider | null>(null)
  const languageRef = useRef(LANGUAGE)
  const permissionGrantedRef = useRef(false)
  const sessionActiveRef = useRef(false)
  const sessionOptionsRef = useRef<StartListeningOptions | null>(null)
  const listenTokenRef = useRef(0)
  const speakTokenRef = useRef(0)
  const messageTimerRef = useRef<number | null>(null)
  const restartTimerRef = useRef<number | null>(null)
  const turnSilenceTimerRef = useRef<number | null>(null)
  const turnSilenceMsRef = useRef(1200)
  const resumeSessionRef = useRef<() => void>(() => {})

  const clearMessageTimer = useCallback(() => {
    if (messageTimerRef.current !== null) {
      window.clearTimeout(messageTimerRef.current)
      messageTimerRef.current = null
    }
  }, [])

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
  }, [])

  const clearTurnSilenceTimer = useCallback(() => {
    if (turnSilenceTimerRef.current !== null) {
      window.clearTimeout(turnSilenceTimerRef.current)
      turnSilenceTimerRef.current = null
    }
  }, [])

  const setVoiceSessionActive = useCallback((active: boolean) => {
    sessionActiveRef.current = active
    setSessionActive(active)
  }, [])

  const scheduleStatusClear = useCallback((durationMs = 2600) => {
    clearMessageTimer()
    messageTimerRef.current = window.setTimeout(() => {
      messageTimerRef.current = null
      setStatusMessage(null)
      setPhase((current) => current === 'error' ? 'idle' : current)
    }, durationMs)
  }, [clearMessageTimer])

  const failSession = useCallback((error: VoiceProviderError) => {
    clearRestartTimer()
    setVoiceSessionActive(false)
    sessionOptionsRef.current = null
    listenTokenRef.current += 1

    if (error.code === 'permission-denied') {
      setVoiceConsent('denied')
      setInteractionMode('text')
    }

    if (error.code === 'aborted') {
      setPhase('idle')
      setStatusMessage(null)
      setConversationPhase('idle')
      return
    }

    setPhase('error')
    setStatusMessage(voiceErrorMessageFa(error))
    setBeeTransientState('error', 1800)
    scheduleStatusClear()
  }, [
    clearRestartTimer,
    scheduleStatusClear,
    setBeeTransientState,
    setConversationPhase,
    setInteractionMode,
    setVoiceConsent,
    setVoiceSessionActive,
  ])

  useEffect(() => {
    let cancelled = false
    let provider: VoiceProvider | null = null

    fetch('/api/voice/config', { cache: 'no-store' })
      .then((response) => response.json() as Promise<VoiceRuntimeConfig>)
      .then((config) => {
        if (cancelled) return
        const isEnabled = config.enabled && config.provider === 'browser'
        setEnabled(isEnabled)
        setHandsFreeEnabled(isEnabled && config.handsFree !== false)
        if (!isEnabled) return

        languageRef.current = config.language || LANGUAGE
        if (typeof config.turnSilenceMs === 'number') {
          turnSilenceMsRef.current = Math.min(3000, Math.max(600, config.turnSilenceMs))
        }
        provider = new BrowserVoiceProvider()
        providerRef.current = provider
        setAvailable(provider.canListen())
      })
      .catch(() => {
        if (!cancelled) {
          setEnabled(false)
          setAvailable(false)
          setHandsFreeEnabled(false)
        }
      })

    return () => {
      cancelled = true
      setVoiceSessionActive(false)
      listenTokenRef.current += 1
      speakTokenRef.current += 1
      clearRestartTimer()
      clearTurnSilenceTimer()
      provider?.destroy()
      if (providerRef.current === provider) providerRef.current = null
      clearMessageTimer()
    }
  }, [clearMessageTimer, clearRestartTimer, clearTurnSilenceTimer, setVoiceSessionActive])

  const beginListeningTurn = useCallback((
    callbacks: StartListeningOptions,
    keepAlive: boolean,
  ) => {
    const provider = providerRef.current
    if (!provider || !enabled || !available) {
      failSession(new VoiceProviderError('not-supported'))
      return
    }

    clearRestartTimer()
    clearTurnSilenceTimer()
    const token = ++listenTokenRef.current
    let failed = false
    let latestTranscript = ''
    const finalChunks: string[] = []

    try {
      provider.startListening({
        language: languageRef.current,
        onStart: () => {
          if (token !== listenTokenRef.current) return
          setPhase('listening')
          setStatusMessage(keepAlive
            ? 'BEE گوش می‌دهد… طبیعی صحبت کنید.'
            : 'دارم گوش می‌دم… برای پایان و ارسال دوباره روی میکروفون بزنید.')
          setConversationPhase('listening')
        },
        onTranscript: ({ text, isFinal }) => {
          if (token !== listenTokenRef.current) return
          latestTranscript = text
          if (isFinal) finalChunks.push(text)
          const draft = [...finalChunks, ...(isFinal ? [] : [text])].join(' ').trim()
          if (draft) callbacks.onDraft(draft)

          if (keepAlive && sessionActiveRef.current) {
            clearTurnSilenceTimer()
            turnSilenceTimerRef.current = window.setTimeout(() => {
              turnSilenceTimerRef.current = null
              // Browser SpeechRecognition does not expose raw VAD events.
              // Treat a quiet window after the last transcript as the turn boundary.
              providerRef.current?.stopListening()
            }, turnSilenceMsRef.current)
          }
        },
        onError: (error) => {
          if (token !== listenTokenRef.current) return

          // Some browsers end a continuous recognition window with a recoverable
          // no-speech/aborted event. In an active hands-free session, treat that as
          // a transport boundary instead of terminating the conversation.
          if (
            keepAlive
            && sessionActiveRef.current
            && (error.code === 'no-speech' || error.code === 'aborted')
          ) {
            failed = true
            restartTimerRef.current = window.setTimeout(() => {
              restartTimerRef.current = null
              resumeSessionRef.current()
            }, 350)
            return
          }

          failed = true
          failSession(error)
        },
        onEnd: () => {
          clearTurnSilenceTimer()
          if (token !== listenTokenRef.current || failed) return

          const finalText = (finalChunks.join(' ') || latestTranscript).trim()
          if (finalText) {
            setPhase('idle')
            setStatusMessage('پیامت رو گرفتم؛ BEE داره فکر می‌کنه…')
            setConversationPhase('thinking')
            callbacks.onDraft(finalText)
            callbacks.onFinal(finalText)
            return
          }

          if (keepAlive && sessionActiveRef.current) {
            setStatusMessage('منتظر صدای شما هستم…')
            restartTimerRef.current = window.setTimeout(() => {
              restartTimerRef.current = null
              resumeSessionRef.current()
            }, 350)
            return
          }

          setPhase('idle')
          setStatusMessage(null)
          setConversationPhase('idle')
          failSession(new VoiceProviderError('no-speech'))
        },
      })
    } catch (error) {
      if (token === listenTokenRef.current) failSession(asVoiceError(error))
    }
  }, [
    available,
    clearRestartTimer,
    clearTurnSilenceTimer,
    enabled,
    failSession,
    setConversationPhase,
  ])

  const resumeSession = useCallback(() => {
    if (!sessionActiveRef.current) return
    const callbacks = sessionOptionsRef.current
    if (!callbacks) return

    providerRef.current?.stopSpeaking()
    beginListeningTurn(callbacks, true)
  }, [beginListeningTurn])

  useEffect(() => {
    resumeSessionRef.current = resumeSession
    return () => {
      resumeSessionRef.current = () => {}
    }
  }, [resumeSession])

  const startSession = useCallback(async (callbacks: StartListeningOptions) => {
    const provider = providerRef.current
    if (!enabled || !available || !handsFreeEnabled || !provider) {
      failSession(new VoiceProviderError('not-supported'))
      return false
    }

    clearMessageTimer()
    clearRestartTimer()
    clearTurnSilenceTimer()
    speakTokenRef.current += 1
    provider.stopSpeaking()
    sessionOptionsRef.current = callbacks
    setConversationPhase('awaiting-voice-consent')
    setPhase('requesting-permission')
    setStatusMessage('برای گفت‌وگو با BEE، دسترسی میکروفون را تأیید کنید…')

    if (!permissionGrantedRef.current) {
      try {
        await provider.requestMicrophonePermission()
        permissionGrantedRef.current = true
      } catch (error) {
        failSession(asVoiceError(error))
        return false
      }
    }

    setVoiceConsent('granted')
    setInteractionMode('voice')
    setVoiceSessionActive(true)
    beginListeningTurn(callbacks, true)
    return true
  }, [
    available,
    beginListeningTurn,
    clearMessageTimer,
    clearRestartTimer,
    clearTurnSilenceTimer,
    enabled,
    failSession,
    handsFreeEnabled,
    setConversationPhase,
    setInteractionMode,
    setVoiceConsent,
    setVoiceSessionActive,
  ])

  const stopSession = useCallback(() => {
    setVoiceSessionActive(false)
    sessionOptionsRef.current = null
    clearRestartTimer()
    clearTurnSilenceTimer()
    listenTokenRef.current += 1
    speakTokenRef.current += 1
    providerRef.current?.destroy()
    setPhase('idle')
    setStatusMessage(null)
    setInteractionMode('text')
    setConversationPhase('idle')
  }, [
    clearRestartTimer,
    clearTurnSilenceTimer,
    setConversationPhase,
    setInteractionMode,
    setVoiceSessionActive,
  ])

  const cancelAll = useCallback(() => {
    stopSession()
    clearMessageTimer()
  }, [clearMessageTimer, stopSession])

  const finishListening = useCallback(() => {
    providerRef.current?.stopListening()
    setStatusMessage('در حال پایان شنیدن و ارسال پیام…')
  }, [])

  const startListening = useCallback(async (callbacks: StartListeningOptions) => {
    const provider = providerRef.current
    if (!enabled || !available || !provider) {
      failSession(new VoiceProviderError('not-supported'))
      return
    }

    setVoiceSessionActive(false)
    sessionOptionsRef.current = null
    clearMessageTimer()
    speakTokenRef.current += 1
    provider.stopSpeaking()

    setPhase('requesting-permission')
    setStatusMessage('در حال درخواست دسترسی میکروفون…')
    setBeeState('listening')

    if (!permissionGrantedRef.current) {
      try {
        await provider.requestMicrophonePermission()
        permissionGrantedRef.current = true
      } catch (error) {
        failSession(asVoiceError(error))
        return
      }
    }

    beginListeningTurn(callbacks, false)
  }, [
    available,
    beginListeningTurn,
    clearMessageTimer,
    enabled,
    failSession,
    setBeeState,
    setVoiceSessionActive,
  ])

  const stopSpeaking = useCallback(() => {
    speakTokenRef.current += 1
    providerRef.current?.stopSpeaking()
    setPhase('idle')
    setStatusMessage(null)

    if (sessionActiveRef.current) {
      setConversationPhase('interrupted')
      window.setTimeout(() => resumeSessionRef.current(), 120)
    } else {
      setConversationPhase('idle')
    }
  }, [setConversationPhase])

  const speak = useCallback((text: string) => {
    const provider = providerRef.current
    if (!enabled || !provider) return

    clearMessageTimer()
    clearRestartTimer()
    clearTurnSilenceTimer()
    const token = ++speakTokenRef.current

    if (!provider.canSpeak()) {
      setBeeTransientState('speaking')
      setStatusMessage('پاسخ متنی آماده است؛ پخش صوت در این مرورگر پشتیبانی نمی‌شود.')
      scheduleStatusClear(3000)
      if (sessionActiveRef.current) {
        restartTimerRef.current = window.setTimeout(() => {
          restartTimerRef.current = null
          resumeSessionRef.current()
        }, 500)
      }
      return
    }

    setPhase('speaking')
    setStatusMessage('BEE در حال پاسخ صوتی است…')
    setConversationPhase('speaking')

    provider.speak(text, {
      language: languageRef.current,
      onStart: () => {
        if (token !== speakTokenRef.current) return
        setPhase('speaking')
        setStatusMessage('BEE در حال پاسخ صوتی است…')
        setConversationPhase('speaking')
      },
      onEnd: () => {
        if (token !== speakTokenRef.current) return
        setPhase('idle')
        setStatusMessage(null)

        if (sessionActiveRef.current) {
          restartTimerRef.current = window.setTimeout(() => {
            restartTimerRef.current = null
            resumeSessionRef.current()
          }, 180)
        } else {
          setConversationPhase('idle')
        }
      },
      onError: (error) => {
        if (token !== speakTokenRef.current) return
        failSession(error)
      },
    })
  }, [
    clearMessageTimer,
    clearRestartTimer,
    clearTurnSilenceTimer,
    enabled,
    failSession,
    scheduleStatusClear,
    setBeeTransientState,
    setConversationPhase,
  ])

  return {
    enabled,
    available,
    handsFreeEnabled,
    sessionActive,
    phase,
    statusMessage,
    startListening,
    finishListening,
    startSession,
    stopSession,
    resumeSession,
    speak,
    stopSpeaking,
    cancelAll,
  }
}
