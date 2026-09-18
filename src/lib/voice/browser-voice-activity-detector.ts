export interface VoiceActivityDecision {
  rms: number
  threshold: number
  active: boolean
}

export interface VoiceActivityDetectorOptions {
  onSpeechStart?: () => void
  onSpeechEnd?: () => void
  minThreshold?: number
  thresholdMultiplier?: number
  minSpeechMs?: number
  hangoverMs?: number
}

export function computeRms(samples: Uint8Array): number {
  if (samples.length === 0) return 0

  let sumSquares = 0
  for (const sample of samples) {
    const normalized = (sample - 128) / 128
    sumSquares += normalized * normalized
  }
  return Math.sqrt(sumSquares / samples.length)
}

export function decideVoiceActivity(
  rms: number,
  noiseFloor: number,
  minThreshold = 0.03,
  thresholdMultiplier = 3.2,
): VoiceActivityDecision {
  const threshold = Math.max(minThreshold, noiseFloor * thresholdMultiplier)
  return {
    rms,
    threshold,
    active: rms >= threshold,
  }
}

export class BrowserVoiceActivityDetector {
  private readonly options: Required<
    Pick<
      VoiceActivityDetectorOptions,
      'minThreshold' | 'thresholdMultiplier' | 'minSpeechMs' | 'hangoverMs'
    >
  > & Omit<
    VoiceActivityDetectorOptions,
    'minThreshold' | 'thresholdMultiplier' | 'minSpeechMs' | 'hangoverMs'
  >

  private stream: MediaStream | null = null
  private context: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private frameId: number | null = null
  private noiseFloor = 0.008
  private aboveSince: number | null = null
  private belowSince: number | null = null
  private speaking = false
  private samples = new Uint8Array(512)

  constructor(options: VoiceActivityDetectorOptions = {}) {
    this.options = {
      minThreshold: options.minThreshold ?? 0.03,
      thresholdMultiplier: options.thresholdMultiplier ?? 3.2,
      minSpeechMs: options.minSpeechMs ?? 220,
      hangoverMs: options.hangoverMs ?? 420,
      onSpeechStart: options.onSpeechStart,
      onSpeechEnd: options.onSpeechEnd,
    }
  }

  static isSupported(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
    return !!navigator.mediaDevices?.getUserMedia
      && !!(window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
  }

  async start(): Promise<void> {
    if (this.stream) return
    if (!BrowserVoiceActivityDetector.isSupported()) {
      throw new Error('Browser voice activity detection is not supported')
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })

    const AudioContextCtor = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) {
      stream.getTracks().forEach((track) => track.stop())
      throw new Error('AudioContext is not supported')
    }

    const context = new AudioContextCtor()
    const source = context.createMediaStreamSource(stream)
    const analyser = context.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.15
    source.connect(analyser)

    this.stream = stream
    this.context = context
    this.source = source
    this.analyser = analyser
    this.samples = new Uint8Array(analyser.fftSize)

    if (context.state === 'suspended') {
      try {
        await context.resume()
      } catch {
        // Some browsers keep the context suspended until the next user gesture.
        // The loop can still start and recover after the context resumes.
      }
    }

    this.loop()
  }

  stop(): void {
    if (this.frameId !== null) {
      window.cancelAnimationFrame(this.frameId)
      this.frameId = null
    }

    this.source?.disconnect()
    this.source = null
    this.analyser?.disconnect()
    this.analyser = null

    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null

    if (this.context) {
      void this.context.close().catch(() => {})
      this.context = null
    }

    this.aboveSince = null
    this.belowSince = null
    this.speaking = false
    this.noiseFloor = 0.008
  }

  private loop = () => {
    const analyser = this.analyser
    if (!analyser) return

    analyser.getByteTimeDomainData(this.samples)
    const rms = computeRms(this.samples)
    const decision = decideVoiceActivity(
      rms,
      this.noiseFloor,
      this.options.minThreshold,
      this.options.thresholdMultiplier,
    )
    const now = performance.now()

    if (!this.speaking && !decision.active) {
      // Slowly adapt to the local room/microphone baseline, but cap the floor so
      // a temporarily noisy environment cannot make the detector permanently deaf.
      const nextNoiseFloor = this.noiseFloor * 0.97 + rms * 0.03
      this.noiseFloor = Math.min(0.08, Math.max(0.004, nextNoiseFloor))
    }

    if (decision.active) {
      this.belowSince = null
      if (this.aboveSince === null) this.aboveSince = now

      if (!this.speaking && now - this.aboveSince >= this.options.minSpeechMs) {
        this.speaking = true
        this.options.onSpeechStart?.()
      }
    } else {
      this.aboveSince = null

      if (this.speaking) {
        if (this.belowSince === null) this.belowSince = now

        if (now - this.belowSince >= this.options.hangoverMs) {
          this.speaking = false
          this.belowSince = null
          this.options.onSpeechEnd?.()
        }
      }
    }

    this.frameId = window.requestAnimationFrame(this.loop)
  }
}
