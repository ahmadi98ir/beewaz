'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useBeeChatState } from '@/components/bee/BeeChatState'
import { BrowserVoiceProvider } from '@/lib/voice/browser-voice-provider'
import { BrowserVoiceActivityDetector } from '@/lib/voice/browser-voice-activity-detector'
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
  bargeIn?: boolean
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
  const [bargeInEnabled, setBargeInEnabled] = useState(false)
  const [sessionActive, setSessionActive] = useState(false)
  const [phase, setPhase] = useState<VoicePhase>('idle')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const providerRef = useRef<VoiceProvider | null>(null)
  const vadRef = useRef<BrowserVoiceActivityDetector | null>(null)
  const languageRef = useRef(LANGUAGE)
  const permissionGrantedRef = useRef(false)
  const sessionActiveRef = useRef(false)
  const sessionOptionsRef = useRef<StartListeningOptions | null>(null)
  const listenTokenRef = useRef(0)
  const speakTokenRef = useRef(0)
  const messageTimerRef = useRef<number | null>(null)
  const restartTimerRef = useRef<number | null>(null)
  const turnSilenceTimerRef = useRef<number | null>(null)
  const bargeInArmTimerRef = useRef<number | null>(null)
  const turnSilenceMsRef = useRef(1200)
  const bargeInArmedRef = useRef(false)
  const phaseRef = useRef<VoicePhase>('idle')
  const resumeSessionRef = useRef<() => void>(() => {})
  const interruptSpeechRef = useRef<() => void>(() => {})

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

  const clearBargeInArmTimer = useCallback(() => {
    if (bargeInArmTimerRef.current !== null) {
      window.clearTimeout(bargeInArmTimerRef.current)
      bargeInArmTimerRef.current = null
    }
    bargeInArmedRef.current = false
  }, [])

  const stopVoiceActivityDetector = useCallback(() => {
    clearBargeInArmTimer()
    vadRef.current?.stop()
    vadRef.current = null
  }, [clearBargeInArmTimer])

  const startVoiceActivityDetector = useCallback(async () => {
    if (!bargeInEnabled || vadRef.current || !BrowserVoiceActivityDetector.isSupported()) return

    const detector = new BrowserVoiceActivityDetector({
      // A slightly conservative profile reduces false interruption from BEE's own
      // speaker audio; echoCancellation/noiseSuppression are also requested.
      minThreshold: 0.035,
      thresholdMultiplier: 3.4,
      minSpeechMs: 260,
      hangoverMs: 420,
      onSpeechStart: () => interruptSpeechRef.current(),
    })
    vadRef.current = detector

    try {
      await detector.start()
    } catch {
      detector.stop()
      if (vadRef.current === detector) vadRef.current = null
    }
  }, [bargeInEnabled])

  const setVoiceSessionActive = useCallback((active: boolean) => {
    sessionActiveRef.current = active
    setSessionActive(active)
  }, [])

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

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
    clearTurnSilenceTimer()
    stopVoiceActivityDetector()
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
    clearTurnSilenceTimer,
    scheduleStatusClear,
    stopVoiceActivityDetector,
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
        setBargeInEnabled(isEnabled && config.handsFree !== false && config.bargeIn === true)
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
          setBargeInEnabled(false)
        }
      })

    return () => {
      cancelled = true
      sessionActiveRef.current = false
      listenTokenRef.current += 1
      speakTokenRef.current += 1
      clearRestartTimer()
      clearTurnSilenceTimer()
      stopVoiceActivityDetector()
      provider?.destroy()
      if (providerRef.current === provider) providerRef.current = null
      clearMessageTimer()
    }
  }, [
    clearMessageTimer,
    clearRestartTimer,
    clearTurnSilenceTimer,
    stopVoiceActivityDetector,
  ])

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

    // Never keep a raw getUserMedia VAD stream open while browser
    // SpeechRecognition owns the microphone. Android Chrome can otherwise
    // starve recognition or leave it stuck without transcripts.
    stopVoiceActivityDetector()
    providerRef.current?.stopSpeaking()
    beginListeningTurn(callbacks, true)
  }, [beginListeningTurn, stopVoiceActivityDetector])

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
    stopVoiceActivityDetector()
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
    stopVoiceActivityDetector,
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
    clearBargeInArmTimer()
    stopVoiceActivityDetector()
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
  }, [clearBargeInArmTimer, setConversationPhase, stopVoiceActivityDetector])

  useEffect(() => {
    interruptSpeechRef.current = () => {
      if (
        !bargeInEnabled
        || !bargeInArmedRef.current
        || !sessionActiveRef.current
        || phaseRef.current !== 'speaking'
      ) {
        return
      }

      bargeInArmedRef.current = false
      stopSpeaking()
      setStatusMessage('صدات رو شنیدم؛ BEE گوش می‌ده…')
    }

    return () => {
      interruptSpeechRef.current = () => {}
    }
  }, [bargeInEnabled, stopSpeaking])

  const speak = useCallback((text: string) => {
    const provider = providerRef.current
    if (!enabled || !provider) return

    clearMessageTimer()
    clearRestartTimer()
    clearTurnSilenceTimer()
    clearBargeInArmTimer()
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

        if (bargeInEnabled && sessionActiveRef.current) {
          // VAD is deliberately acquired only while BEE is speaking. Keeping a
          // second raw microphone stream alive during SpeechRecognition breaks
          // recognition on some Android Chrome devices.
          void startVoiceActivityDetector().then(() => {
            if (
              token !== speakTokenRef.current
              || !sessionActiveRef.current
              || phaseRef.current !== 'speaking'
              || !vadRef.current
            ) {
              return
            }

            clearBargeInArmTimer()
            // Give acoustic echo cancellation time to settle before arming.
            bargeInArmTimerRef.current = window.setTimeout(() => {
              bargeInArmTimerRef.current = null
              bargeInArmedRef.current = true
            }, 700)
          })
        }
      },
      onEnd: () => {
        clearBargeInArmTimer()
        stopVoiceActivityDetector()
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
        clearBargeInArmTimer()
        stopVoiceActivityDetector()
        if (token !== speakTokenRef.current) return
        failSession(error)
      },
    })
  }, [
    bargeInEnabled,
    clearBargeInArmTimer,
    clearMessageTimer,
    clearRestartTimer,
    clearTurnSilenceTimer,
    enabled,
    failSession,
    scheduleStatusClear,
    setBeeTransientState,
    setConversationPhase,
    startVoiceActivityDetector,
    stopVoiceActivityDetector,
  ])

  return {
    enabled,
    available,
    handsFreeEnabled,
    bargeInEnabled,
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
