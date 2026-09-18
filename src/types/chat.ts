// ── Chatbot State Machine Types ─────────────────────────────────────────────

export type ChatStep =
  | 'GREETING'
  | 'ASK_PLACE'
  | 'ASK_SIZE'
  | 'ASK_BUDGET'
  | 'ASK_PHONE'
  | 'PHONE_VALIDATION_ERROR'
  | 'CONFIRM'
  | 'FOLLOW_UP'

export type SessionData = {
  place?: string
  size?: string
  budget?: string
  phone?: string
}

export type MessageRole = 'user' | 'bot'

export type ChatMessage = {
  id: string
  role: MessageRole
  content: string
  timestamp: number
  quickReplies?: string[]
  retryText?: string
  requirePhoneInput?: boolean
}

// ── API Types ────────────────────────────────────────────────────────────────

export type ChatRequest = {
  message: string
  step: ChatStep
  sessionData: SessionData
}

export type ChatResponse = {
  message: string
  nextStep: ChatStep
  quickReplies?: string[]
  requirePhoneInput?: boolean
  leadCaptured?: boolean
  sessionData: SessionData
}

export type LeadRequest = {
  phone: string
  place?: string
  size?: string
  budget?: string
  source: 'chatbot'
  visitorToken?: string
}

export type LeadResponse = {
  success: boolean
  leadId?: string
  message: string
}
