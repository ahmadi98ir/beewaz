export type VoiceProviderId = 'browser'

export type VoicePhase =
  | 'idle'
  | 'requesting-permission'
  | 'listening'
  | 'speaking'
  | 'error'

export type VoiceErrorCode =
  | 'not-supported'
  | 'permission-denied'
  | 'no-speech'
  | 'audio-capture'
  | 'network'
  | 'aborted'
  | 'unknown'

export class VoiceProviderError extends Error {
  readonly code: VoiceErrorCode

  constructor(code: VoiceErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'VoiceProviderError'
    this.code = code
  }
}

export interface VoiceTranscriptEvent {
  text: string
  isFinal: boolean
}

export interface VoiceListenOptions {
  language: string
  onStart?: () => void
  onTranscript: (event: VoiceTranscriptEvent) => void
  onEnd?: () => void
  onError?: (error: VoiceProviderError) => void
}

export interface VoiceSpeakOptions {
  language: string
  onStart?: () => void
  onEnd?: () => void
  onError?: (error: VoiceProviderError) => void
}

export interface VoiceProvider {
  readonly id: VoiceProviderId
  canListen(): boolean
  canSpeak(): boolean
  requestMicrophonePermission(): Promise<void>
  startListening(options: VoiceListenOptions): void
  stopListening(): void
  speak(text: string, options: VoiceSpeakOptions): void
  stopSpeaking(): void
  destroy(): void
}

export function voiceErrorMessageFa(error: VoiceProviderError): string {
  switch (error.code) {
    case 'permission-denied':
      return 'دسترسی میکروفون داده نشد. از تنظیمات مرورگر اجازهٔ میکروفون را فعال کنید.'
    case 'no-speech':
      return 'صدایی دریافت نشد. دوباره روی میکروفون بزنید و صحبت کنید.'
    case 'audio-capture':
      return 'میکروفون در دسترس نیست یا توسط برنامهٔ دیگری استفاده می‌شود.'
    case 'network':
      return 'سرویس تشخیص گفتار مرورگر در دسترس نیست. می‌توانید از چت متنی استفاده کنید.'
    case 'not-supported':
      return 'مرورگر شما ورودی صوتی فارسی را پشتیبانی نمی‌کند. چت متنی همچنان در دسترس است.'
    case 'aborted':
      return ''
    case 'unknown':
    default:
      return 'ورودی صوتی با خطا روبه‌رو شد. می‌توانید دوباره امتحان کنید یا متن بنویسید.'
  }
}
