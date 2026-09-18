import {
  VoiceProviderError,
  type VoiceErrorCode,
  type VoiceListenOptions,
  type VoiceProvider,
  type VoiceSpeakOptions,
} from './voice-provider'

interface SpeechRecognitionAlternativeLike {
  transcript: string
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean
  readonly length: number
  readonly [index: number]: SpeechRecognitionAlternativeLike | undefined
}

interface SpeechRecognitionResultListLike {
  readonly length: number
  readonly [index: number]: SpeechRecognitionResultLike | undefined
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultListLike
}

interface SpeechRecognitionErrorEventLike {
  readonly error: string
  readonly message?: string
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike
}

type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const speechWindow = window as WindowWithSpeechRecognition
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
}

export function mapRecognitionErrorCode(error: string): VoiceErrorCode {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'permission-denied'
    case 'no-speech':
      return 'no-speech'
    case 'audio-capture':
      return 'audio-capture'
    case 'network':
      return 'network'
    case 'aborted':
      return 'aborted'
    default:
      return 'unknown'
  }
}

function microphonePermissionError(error: unknown): VoiceProviderError {
  const name = error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new VoiceProviderError('permission-denied')
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'NotReadableError') {
    return new VoiceProviderError('audio-capture')
  }
  return new VoiceProviderError('unknown', error instanceof Error ? error.message : undefined)
}

export function toSpeechText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[*_~>#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function selectPersianVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return voices.find((voice) => /^fa(?:[-_]|$)/i.test(voice.lang))
}

export class BrowserVoiceProvider implements VoiceProvider {
  readonly id = 'browser' as const

  private recognition: SpeechRecognitionLike | null = null
  private utterance: SpeechSynthesisUtterance | null = null

  canListen(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
    return !!getRecognitionConstructor() && !!navigator.mediaDevices?.getUserMedia
  }

  canSpeak(): boolean {
    return typeof window !== 'undefined'
      && 'speechSynthesis' in window
      && typeof SpeechSynthesisUtterance !== 'undefined'
  }

  async requestMicrophonePermission(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new VoiceProviderError('not-supported')
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
    } catch (error) {
      throw microphonePermissionError(error)
    }
  }

  startListening(options: VoiceListenOptions): void {
    const Recognition = getRecognitionConstructor()
    if (!Recognition) throw new VoiceProviderError('not-supported')

    this.stopListening()

    const recognition = new Recognition()
    recognition.lang = options.language
    // Keep recognition alive across natural pauses when the browser supports it.
    // Mobile Chrome may still terminate a recognition session on its own; the
    // conversation hook treats that as a recoverable boundary and restarts it.
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => options.onStart?.()
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const alternative = result?.[0]
        const text = alternative?.transcript?.trim()
        if (!result || !text) continue
        options.onTranscript({ text, isFinal: result.isFinal })
      }
    }
    recognition.onerror = (event) => {
      options.onError?.(
        new VoiceProviderError(mapRecognitionErrorCode(event.error), event.message || event.error),
      )
    }
    recognition.onend = () => {
      if (this.recognition === recognition) this.recognition = null
      options.onEnd?.()
    }

    this.recognition = recognition

    try {
      recognition.start()
    } catch (error) {
      this.clearRecognitionHandlers(recognition)
      this.recognition = null
      if (error instanceof VoiceProviderError) throw error
      throw new VoiceProviderError('unknown', error instanceof Error ? error.message : undefined)
    }
  }

  stopListening(): void {
    if (!this.recognition) return
    try {
      this.recognition.stop()
    } catch {
      // The Web Speech API can throw if stop() races with its own onend.
    }
  }

  speak(text: string, options: VoiceSpeakOptions): void {
    const speechText = toSpeechText(text)
    if (!speechText) {
      options.onEnd?.()
      return
    }
    if (!this.canSpeak()) {
      options.onError?.(new VoiceProviderError('not-supported'))
      return
    }

    this.stopSpeaking()

    const utterance = new SpeechSynthesisUtterance(speechText)
    utterance.lang = options.language
    utterance.rate = 0.96
    utterance.pitch = 1

    const voice = selectPersianVoice(window.speechSynthesis.getVoices())
    if (voice) utterance.voice = voice

    utterance.onstart = () => options.onStart?.()
    utterance.onend = () => {
      if (this.utterance === utterance) this.utterance = null
      options.onEnd?.()
    }
    utterance.onerror = (event) => {
      if (this.utterance === utterance) this.utterance = null
      const code = event.error === 'not-allowed' ? 'permission-denied' : 'unknown'
      options.onError?.(new VoiceProviderError(code, event.error))
    }

    this.utterance = utterance
    window.speechSynthesis.speak(utterance)
  }

  stopSpeaking(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    if (this.utterance) {
      this.utterance.onstart = null
      this.utterance.onend = null
      this.utterance.onerror = null
      this.utterance = null
    }
    window.speechSynthesis.cancel()
  }

  destroy(): void {
    if (this.recognition) {
      const recognition = this.recognition
      this.clearRecognitionHandlers(recognition)
      this.recognition = null
      try {
        recognition.abort()
      } catch {
        // Best-effort cleanup only.
      }
    }
    this.stopSpeaking()
  }

  private clearRecognitionHandlers(recognition: SpeechRecognitionLike): void {
    recognition.onstart = null
    recognition.onresult = null
    recognition.onerror = null
    recognition.onend = null
  }
}
