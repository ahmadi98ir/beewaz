'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useBeeChatState } from '@/components/bee/BeeChatState'
import { XIcon, PhoneIcon } from '@/components/ui/icons'
import type { ChatMessage } from '@/types/chat'
import { MessageBubble } from './message-bubble'
import { TypingIndicator } from './typing-indicator'
import { useVoiceAssistant } from './use-voice-assistant'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatConfig {
  bot_name: string
  bot_status: string
  welcome_msg: string
  quickReplies: string[]
  footer_text: string
}

interface GeminiMessage {
  role: 'user' | 'model'
  text: string
}

interface SendMessageOptions {
  /** Speak the successful assistant reply only when the user explicitly
   * initiated this turn from the microphone control. */
  voiceReply?: boolean
}

const CONFIG_DEFAULTS: ChatConfig = {
  bot_name: 'دستیار هوشمند بیواز',
  bot_status: 'آنلاین — پاسخگو ۲۴ ساعته',
  welcome_msg: 'سلام! 👋 چطور می‌تونم کمکتون کنم؟\n\nمی‌تونم در انتخاب سیستم امنیتی مناسب، قیمت‌ها و شرایط نصب کمکتون کنم.',
  quickReplies: ['مشاوره انتخاب دزدگیر', 'قیمت محصولات', 'شرایط نصب'],
  footer_text: 'بیواز — مشاوره رایگان ۲۴/۷',
}

const PHONE_REGEX = /^(\+98|0)?9\d{9}/

function makeId() {
  return Math.random().toString(36).slice(2, 9)
}

function makeVisitorToken() {
  if (typeof window === 'undefined') return ''
  const key = 'beewaz_vid'
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const id = 'v_' + makeId() + makeId()
  localStorage.setItem(key, id)
  return id
}

// ── Main Widget ────────────────────────────────────────────────────────────

export function ChatWidget() {
  const {
    state: beeState,
    chatOpen,
    voiceConsent,
    setState: setBeeState,
    setPhase: setConversationPhase,
    setTransientState: setBeeTransientState,
    setTransientPhase: setBeeTransientPhase,
    openChat,
    closeChat,
    setInteractionMode,
    setVoiceConsent,
  } = useBeeChatState()
  const [config, setConfig] = useState<ChatConfig>(CONFIG_DEFAULTS)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [history, setHistory] = useState<GeminiMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [leadSaved, setLeadSaved] = useState(false)
  const [hasNewMsg, setHasNewMsg] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const visitorToken = useRef('')
  const sessionId = useRef<string | undefined>(undefined)
  const voiceSpeakRef = useRef<(text: string) => void>(() => {})
  const voiceCancelRef = useRef<() => void>(() => {})
  const voiceResumeRef = useRef<() => void>(() => {})

  useEffect(() => {
    visitorToken.current = makeVisitorToken()
    const stored = typeof window !== 'undefined' ? localStorage.getItem('beewaz_sid') : null
    if (stored) sessionId.current = stored
    fetch('/api/chat/config')
      .then((r) => r.json())
      .then((data: ChatConfig) => setConfig(data))
      .catch(() => {})
      .finally(() => {
        setConfigLoaded(true)
      })
  }, [])

  // welcome message
  useEffect(() => {
    if (!configLoaded) return
    setMessages([{
      id: 'init',
      role: 'bot',
      content: config.welcome_msg,
      timestamp: Date.now(),
      quickReplies: config.quickReplies,
    }])
  }, [configLoaded, config])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  useEffect(() => {
    if (chatOpen) {
      setHasNewMsg(false)
      inputRef.current?.focus()
    }
  }, [chatOpen])

  // First-entry orchestration: BEE greets visually, then opens the transcript.
  // The browser cannot safely auto-grant microphone/audio permissions, so the
  // actual voice session still starts from an explicit user gesture.
  useEffect(() => {
    if (!configLoaded || typeof window === 'undefined') return

    const sessionKey = 'beewaz_auto_greeted'
    try {
      if (window.sessionStorage.getItem(sessionKey) === '1') return
    } catch {
      // Session storage can be unavailable in hardened/private browser modes.
    }

    const beeTimer = window.setTimeout(() => {
      setBeeState('greeting')
    }, 700)

    const chatTimer = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(sessionKey, '1')
      } catch {
        // Best effort only; failure must not block the assistant.
      }
      openChat()
      setHasNewMsg(false)
      setBeeTransientPhase('greeting', 1600, 'idle')
    }, 1200)

    return () => {
      window.clearTimeout(beeTimer)
      window.clearTimeout(chatTimer)
    }
  }, [configLoaded, openChat, setBeeState, setBeeTransientPhase])

  const pushBotMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg])
    if (!chatOpen) setHasNewMsg(true)
  }, [chatOpen])

  const sendMessage = useCallback(async (text: string, options?: SendMessageOptions) => {
    if (!text.trim() || isTyping) return

    // Typed turns leave voice mode; microphone-originated turns keep the
    // hands-free session alive so BEE can resume listening after speaking.
    if (!options?.voiceReply) voiceCancelRef.current()

    const userMsg: ChatMessage = {
      id: makeId(),
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInputValue('')
    setIsTyping(true)
    setInteractionMode(options?.voiceReply ? 'voice' : 'text')
    setBeeState('thinking')

    const newHistory: GeminiMessage[] = [...history, { role: 'user', text: text.trim() }]
    setHistory(newHistory)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory,
          session_id: sessionId.current,
          visitorToken: visitorToken.current,
        }),
      })

      const data = await res.json() as {
        message: string
        session_id?: string
        leadCaptured?: boolean
        phone?: string
        error?: string
      }

      if (data.session_id) {
        sessionId.current = data.session_id
        if (typeof window !== 'undefined') localStorage.setItem('beewaz_sid', data.session_id)
      }

      setIsTyping(false)

      const replyText = data.error ?? data.message
      const responseIsError = !res.ok || !!data.error

      // Extract quick replies from bot response if it contains numbered options
      let quickReplies: string[] | undefined
      const numbered = replyText.match(/[۱۲۳۴۵\d]\.\s*([^\n]+)/g)
      if (numbered && numbered.length >= 2 && numbered.length <= 5) {
        quickReplies = numbered.map((s) => s.replace(/^[۱۲۳۴۵\d]\.\s*/, '').trim()).slice(0, 4)
      }

      pushBotMessage({
        id: makeId(),
        role: 'bot',
        content: replyText,
        timestamp: Date.now(),
        quickReplies,
      })

      setHistory((prev) => [...prev, { role: 'model', text: replyText }])

      if (responseIsError) {
        setBeeTransientState('error')
        if (options?.voiceReply) {
          window.setTimeout(() => voiceResumeRef.current(), 700)
        }
      } else if (options?.voiceReply) {
        // No autoplay for ordinary text chat. Audio is produced only for a turn
        // the user explicitly started from the microphone button.
        voiceSpeakRef.current(replyText)
      } else {
        setBeeTransientState('speaking')
      }

      // Lead capture — detect phone number
      if (data.leadCaptured && data.phone && !leadSaved) {
        setLeadSaved(true)
        const phone = data.phone.replace(/\D/g, '')
        const normalized = phone.startsWith('98') ? '0' + phone.slice(2) : phone.startsWith('9') ? '0' + phone : phone
        fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: normalized,
            source: 'chatbot',
            visitorToken: visitorToken.current,
          }),
        }).catch(console.error)
      }
    } catch {
      setIsTyping(false)
      setBeeTransientState('error')
      if (options?.voiceReply) {
        window.setTimeout(() => voiceResumeRef.current(), 700)
      }
      pushBotMessage({
        id: makeId(),
        role: 'bot',
        content: 'مشکلی پیش آمد. لطفاً دوباره تلاش کنید.',
        timestamp: Date.now(),
        quickReplies: ['تلاش مجدد'],
      })
    }
  }, [history, isTyping, leadSaved, pushBotMessage, setBeeState, setBeeTransientState, setInteractionMode])

  const voice = useVoiceAssistant()

  useEffect(() => {
    voiceSpeakRef.current = voice.speak
    voiceCancelRef.current = voice.cancelAll
    voiceResumeRef.current = voice.resumeSession
    return () => {
      voiceSpeakRef.current = () => {}
      voiceCancelRef.current = () => {}
      voiceResumeRef.current = () => {}
    }
  }, [voice.cancelAll, voice.resumeSession, voice.speak])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) void sendMessage(inputValue)
  }

  const startBeeVoiceSession = () => {
    void voice.startSession({
      onDraft: setInputValue,
      onFinal: (text) => {
        void sendMessage(text, { voiceReply: true })
      },
    })
  }

  const handleVoiceControl = () => {
    if (voice.phase === 'speaking' && voice.sessionActive) {
      // Explicit interruption: stop BEE speaking and immediately resume listening.
      voice.stopSpeaking()
      return
    }
    if (voice.phase === 'listening' && voice.sessionActive) {
      // Optional manual turn boundary; normal hands-free use does not require this.
      voice.finishListening()
      return
    }
    if (voice.phase === 'requesting-permission') {
      voice.cancelAll()
      return
    }
    if (voice.sessionActive) {
      voice.stopSession()
      return
    }
    if (voice.handsFreeEnabled) {
      startBeeVoiceSession()
      return
    }

    void voice.startListening({
      onDraft: setInputValue,
      onFinal: (text) => {
        void sendMessage(text, { voiceReply: true })
      },
    })
  }

  const handleTextMode = () => {
    voice.stopSession()
    setVoiceConsent('denied')
    setInteractionMode('text')
    setConversationPhase('idle')
    inputRef.current?.focus()
  }

  const handleCloseChat = () => {
    voice.cancelAll()
    closeChat()
    setHasNewMsg(false)
  }

  const handleToggleChat = () => {
    if (chatOpen) {
      handleCloseChat()
      return
    }

    try {
      window.sessionStorage.setItem('beewaz_auto_greeted', '1')
    } catch {
      // Best effort only.
    }
    openChat()
    setHasNewMsg(false)
    if (!isTyping && beeState === 'idle') {
      setBeeTransientState('greeting')
    }
  }

  if (!configLoaded) return null

  const voiceInputLocked = voice.phase === 'requesting-permission' || voice.phase === 'listening'
  const voiceActive = voiceInputLocked || voice.phase === 'speaking' || voice.sessionActive
  const voiceButtonLabel = voice.phase === 'speaking'
    ? 'توقف پاسخ صوتی'
    : voice.phase === 'listening'
      ? 'پایان شنیدن و ارسال'
      : voice.phase === 'requesting-permission'
        ? 'لغو درخواست میکروفون'
        : 'شروع گفت‌وگوی صوتی فارسی'

  return (
    <>
      {/* ── Chat Window ──────────────────────────────────────────────────── */}
      <div
        className={[
          'fixed bottom-20 right-4 sm:right-6 z-50 w-80 sm:w-96 max-w-[calc(100vw-2rem)]',
          'transition-all duration-300 ease-out origin-bottom-right',
          chatOpen
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-95 translate-y-4 pointer-events-none',
        ].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label="چت‌بات بیواز"
      >
        <div className="bg-white rounded-3xl shadow-2xl border border-surface-200 overflow-hidden flex flex-col h-[500px] sm:h-[560px]">

          {/* Header */}
          <div className="bg-gradient-to-l from-brand-700 to-brand-600 px-4 py-3.5 flex items-center gap-3 flex-shrink-0">
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                <PhoneIcon size={18} className="text-white" />
              </div>
              <span className="absolute -bottom-0.5 -end-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-brand-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-tight">{config.bot_name}</p>
              <p className="text-xs text-white/70">{config.bot_status}</p>
            </div>
            <button
              onClick={handleCloseChat}
              className="p-1.5 rounded-xl hover:bg-white/15 transition-colors text-white/80 hover:text-white"
              aria-label="بستن چت"
            >
              <XIcon size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scroll-smooth">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} onQuickReply={sendMessage} />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 border-t border-surface-100 p-3 bg-surface-50/50">
            {voice.available && voice.handsFreeEnabled && voiceConsent === 'unknown' && !voice.sessionActive && (
              <div className="mb-3 rounded-2xl border border-brand-100 bg-brand-50/60 p-3 text-center">
                <p className="text-sm font-semibold text-surface-800">
                  می‌خوای مستقیم با BEE صحبت کنی؟
                </p>
                <p className="mt-1 text-xs leading-5 text-surface-500">
                  یک‌بار اجازهٔ میکروفون را بده؛ بعد مکالمه به‌صورت رفت‌وبرگشتی ادامه پیدا می‌کند.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={startBeeVoiceSession}
                    className="flex-1 rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white hover:bg-brand-700"
                  >
                    🎙 شروع گفت‌وگو با BEE
                  </button>
                  <button
                    type="button"
                    onClick={handleTextMode}
                    className="rounded-xl border border-surface-200 bg-white px-3 py-2 text-xs font-semibold text-surface-600"
                  >
                    تایپ می‌کنم
                  </button>
                </div>
              </div>
            )}

            {voice.sessionActive && (
              <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-orange-100 bg-orange-50/70 px-3 py-2">
                <span className="text-xs font-semibold text-orange-800">
                  ● گفت‌وگوی صوتی با BEE فعال است
                </span>
                <button
                  type="button"
                  onClick={voice.stopSession}
                  className="text-xs font-bold text-orange-800 underline underline-offset-2"
                >
                  پایان
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={voiceInputLocked ? 'در حال شنیدن…' : 'پیام بنویسید...'}
                disabled={isTyping || voiceInputLocked}
                dir="rtl"
                className="flex-1 input text-sm py-2.5 px-3.5 disabled:opacity-50"
                autoComplete="off"
              />
              {voice.available && (
                <button
                  type="button"
                  onClick={handleVoiceControl}
                  disabled={isTyping}
                  className={[
                    'flex-shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center transition-colors',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                    voiceActive
                      ? 'bg-orange-50 border-orange-200 text-orange-700'
                      : 'bg-white border-surface-200 text-surface-600 hover:text-brand-700 hover:border-brand-300',
                  ].join(' ')}
                  aria-label={voiceButtonLabel}
                  aria-pressed={voiceActive}
                  title="ورودی صوتی فارسی؛ فایل صوتی در سرور بیواز ذخیره نمی‌شود و تشخیص گفتار توسط مرورگر انجام می‌شود."
                >
                  {voiceActive ? (
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                      <rect x="7" y="7" width="10" height="10" rx="1.5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="9" y="2" width="6" height="12" rx="3" />
                      <path d="M5 10a7 7 0 0 0 14 0" />
                      <path d="M12 17v5" />
                      <path d="M8 22h8" />
                    </svg>
                  )}
                </button>
              )}
              <button
                type="submit"
                disabled={isTyping || voiceInputLocked || !inputValue.trim()}
                className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="ارسال پیام"
              >
                <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </form>
            {voice.statusMessage && (
              <p
                className={[
                  'text-center text-xs mt-2',
                  voice.phase === 'error' ? 'text-red-600' : 'text-surface-500',
                ].join(' ')}
                role="status"
                aria-live={voice.phase === 'error' ? 'assertive' : 'polite'}
              >
                {voice.statusMessage}
              </p>
            )}
            <p className="text-center text-xs text-surface-400 mt-2">{config.footer_text}</p>
          </div>
        </div>
      </div>

      {/* ── Floating Button ───────────────────────────────────────────────── */}
      <button
        onClick={handleToggleChat}
        className={[
          'fixed bottom-4 right-4 sm:right-6 z-50 w-14 h-14 rounded-2xl shadow-xl',
          'flex items-center justify-center transition-all duration-300',
          chatOpen ? 'bg-surface-700' : 'bg-brand-600 hover:bg-brand-700 hover:scale-105',
        ].join(' ')}
        aria-label={chatOpen ? 'بستن چت' : 'باز کردن چت'}
        aria-expanded={chatOpen}
      >
        {!chatOpen && (
          <>
            <span className="absolute inset-0 rounded-2xl bg-brand-600 animate-ping opacity-30" />
            <span className="absolute inset-0 rounded-2xl bg-brand-600 animate-ping opacity-20 animation-delay-500" />
          </>
        )}
        {chatOpen ? (
          <XIcon size={22} className="text-white" />
        ) : (
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor" aria-hidden="true">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
          </svg>
        )}
        {hasNewMsg && !chatOpen && (
          <span className="absolute -top-1 -start-1 w-4 h-4 rounded-full bg-green-400 border-2 border-white animate-bounce" />
        )}
      </button>
    </>
  )
}
