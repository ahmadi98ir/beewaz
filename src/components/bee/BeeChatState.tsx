'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import type { BeeState } from './bee-config'
import {
  INITIAL_BEE_CONVERSATION,
  beeConversationReducer,
  phaseToBeeState,
  type BeeConversationPhase,
  type BeeInteractionMode,
  type BeeVoiceConsent,
} from './bee-conversation-machine'

interface BeeChatStateContextValue {
  /** Existing visual state consumed by Bee/BeeScene. */
  state: BeeState
  /** Conversation-orchestration state. This is now the source of truth. */
  phase: BeeConversationPhase
  chatOpen: boolean
  interactionMode: BeeInteractionMode
  voiceConsent: BeeVoiceConsent
  setState: (state: BeeState) => void
  setPhase: (phase: BeeConversationPhase) => void
  setTransientState: (state: BeeState, durationMs?: number, fallbackState?: BeeState) => void
  setTransientPhase: (
    phase: BeeConversationPhase,
    durationMs?: number,
    fallbackPhase?: BeeConversationPhase,
  ) => void
  openChat: () => void
  closeChat: () => void
  toggleChat: () => void
  setInteractionMode: (mode: BeeInteractionMode) => void
  setVoiceConsent: (consent: BeeVoiceConsent) => void
}

const BeeChatStateContext = createContext<BeeChatStateContextValue | null>(null)

function defaultTransientDurationMs(state: BeeConversationPhase): number {
  switch (state) {
    case 'greeting':
      return 1400
    case 'speaking':
      return 1800
    case 'error':
      return 1800
    case 'success':
      return 1500
    default:
      return 1000
  }
}

export function BeeChatStateProvider({ children }: { children: ReactNode }) {
  const [conversation, dispatch] = useReducer(
    beeConversationReducer,
    INITIAL_BEE_CONVERSATION,
  )
  const timerRef = useRef<number | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const setPhase = useCallback((nextPhase: BeeConversationPhase) => {
    clearTimer()
    dispatch({ type: 'SET_PHASE', phase: nextPhase })
  }, [clearTimer])

  const setState = useCallback((nextState: BeeState) => {
    setPhase(nextState)
  }, [setPhase])

  const setTransientPhase = useCallback((
    nextPhase: BeeConversationPhase,
    durationMs = defaultTransientDurationMs(nextPhase),
    fallbackPhase: BeeConversationPhase = 'idle',
  ) => {
    clearTimer()
    dispatch({ type: 'SET_PHASE', phase: nextPhase })
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      dispatch({ type: 'SET_PHASE', phase: fallbackPhase })
    }, durationMs)
  }, [clearTimer])

  const setTransientState = useCallback((
    nextState: BeeState,
    durationMs = defaultTransientDurationMs(nextState),
    fallbackState: BeeState = 'idle',
  ) => {
    setTransientPhase(nextState, durationMs, fallbackState)
  }, [setTransientPhase])

  const openChat = useCallback(() => {
    dispatch({ type: 'OPEN_CHAT' })
  }, [])

  const closeChat = useCallback(() => {
    clearTimer()
    dispatch({ type: 'CLOSE_CHAT' })
  }, [clearTimer])

  const toggleChat = useCallback(() => {
    clearTimer()
    dispatch({ type: 'TOGGLE_CHAT' })
  }, [clearTimer])

  const setInteractionMode = useCallback((mode: BeeInteractionMode) => {
    dispatch({ type: 'SET_INTERACTION_MODE', mode })
  }, [])

  const setVoiceConsent = useCallback((consent: BeeVoiceConsent) => {
    dispatch({ type: 'SET_VOICE_CONSENT', consent })
  }, [])

  useEffect(() => clearTimer, [clearTimer])

  const state = phaseToBeeState(conversation.phase)

  const value = useMemo(
    () => ({
      state,
      phase: conversation.phase,
      chatOpen: conversation.chatOpen,
      interactionMode: conversation.interactionMode,
      voiceConsent: conversation.voiceConsent,
      setState,
      setPhase,
      setTransientState,
      setTransientPhase,
      openChat,
      closeChat,
      toggleChat,
      setInteractionMode,
      setVoiceConsent,
    }),
    [
      state,
      conversation.phase,
      conversation.chatOpen,
      conversation.interactionMode,
      conversation.voiceConsent,
      setState,
      setPhase,
      setTransientState,
      setTransientPhase,
      openChat,
      closeChat,
      toggleChat,
      setInteractionMode,
      setVoiceConsent,
    ],
  )

  return (
    <BeeChatStateContext.Provider value={value}>
      {children}
    </BeeChatStateContext.Provider>
  )
}

export function useBeeChatState(): BeeChatStateContextValue {
  const context = useContext(BeeChatStateContext)
  if (!context) {
    throw new Error('useBeeChatState must be used inside BeeChatStateProvider')
  }
  return context
}
