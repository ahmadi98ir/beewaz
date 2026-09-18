import type { BeeState } from './bee-config'

export type BeeConversationPhase =
  | 'boot'
  | 'greeting'
  | 'awaiting-voice-consent'
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'recommending'
  | 'success'
  | 'error'
  | 'interrupted'

export type BeeInteractionMode = 'text' | 'voice'
export type BeeVoiceConsent = 'unknown' | 'granted' | 'denied'

export interface BeeConversationSnapshot {
  phase: BeeConversationPhase
  chatOpen: boolean
  interactionMode: BeeInteractionMode
  voiceConsent: BeeVoiceConsent
}

export type BeeConversationEvent =
  | { type: 'OPEN_CHAT' }
  | { type: 'CLOSE_CHAT' }
  | { type: 'TOGGLE_CHAT' }
  | { type: 'SET_PHASE'; phase: BeeConversationPhase }
  | { type: 'SET_INTERACTION_MODE'; mode: BeeInteractionMode }
  | { type: 'SET_VOICE_CONSENT'; consent: BeeVoiceConsent }

export const INITIAL_BEE_CONVERSATION: BeeConversationSnapshot = {
  phase: 'boot',
  chatOpen: false,
  interactionMode: 'text',
  voiceConsent: 'unknown',
}

function openPhase(phase: BeeConversationPhase): BeeConversationPhase {
  return phase === 'boot' ? 'greeting' : phase
}

export function beeConversationReducer(
  state: BeeConversationSnapshot,
  event: BeeConversationEvent,
): BeeConversationSnapshot {
  switch (event.type) {
    case 'OPEN_CHAT':
      return {
        ...state,
        chatOpen: true,
        phase: openPhase(state.phase),
      }

    case 'CLOSE_CHAT':
      return {
        ...state,
        chatOpen: false,
        phase: 'idle',
      }

    case 'TOGGLE_CHAT':
      return state.chatOpen
        ? {
            ...state,
            chatOpen: false,
            phase: 'idle',
          }
        : {
            ...state,
            chatOpen: true,
            phase: openPhase(state.phase),
          }

    case 'SET_PHASE':
      return {
        ...state,
        phase: event.phase,
      }

    case 'SET_INTERACTION_MODE':
      return {
        ...state,
        interactionMode: event.mode,
      }

    case 'SET_VOICE_CONSENT':
      return {
        ...state,
        voiceConsent: event.consent,
        interactionMode: event.consent === 'granted' ? 'voice' : 'text',
      }

    default:
      return state
  }
}

export function phaseToBeeState(phase: BeeConversationPhase): BeeState {
  switch (phase) {
    case 'boot':
      return 'idle'
    case 'awaiting-voice-consent':
      return 'greeting'
    case 'interrupted':
      return 'listening'
    default:
      return phase
  }
}
