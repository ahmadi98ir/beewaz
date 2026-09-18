import { describe, expect, it } from 'vitest'
import {
  INITIAL_BEE_CONVERSATION,
  beeConversationReducer,
  phaseToBeeState,
} from './bee-conversation-machine'

describe('beeConversationReducer', () => {
  it('opens the first conversation in greeting state', () => {
    const next = beeConversationReducer(INITIAL_BEE_CONVERSATION, { type: 'OPEN_CHAT' })

    expect(next.chatOpen).toBe(true)
    expect(next.phase).toBe('greeting')
  })

  it('closes the panel and returns the visual state to idle', () => {
    const open = beeConversationReducer(INITIAL_BEE_CONVERSATION, { type: 'OPEN_CHAT' })
    const listening = beeConversationReducer(open, { type: 'SET_PHASE', phase: 'listening' })
    const closed = beeConversationReducer(listening, { type: 'CLOSE_CHAT' })

    expect(closed.chatOpen).toBe(false)
    expect(closed.phase).toBe('idle')
  })

  it('switches to voice mode only after voice consent is granted', () => {
    const granted = beeConversationReducer(INITIAL_BEE_CONVERSATION, {
      type: 'SET_VOICE_CONSENT',
      consent: 'granted',
    })
    const denied = beeConversationReducer(granted, {
      type: 'SET_VOICE_CONSENT',
      consent: 'denied',
    })

    expect(granted.interactionMode).toBe('voice')
    expect(granted.voiceConsent).toBe('granted')
    expect(denied.interactionMode).toBe('text')
    expect(denied.voiceConsent).toBe('denied')
  })
})

describe('phaseToBeeState', () => {
  it('maps orchestration-only phases onto existing Bee visuals', () => {
    expect(phaseToBeeState('boot')).toBe('idle')
    expect(phaseToBeeState('awaiting-voice-consent')).toBe('greeting')
    expect(phaseToBeeState('interrupted')).toBe('listening')
  })

  it('keeps visual phases unchanged', () => {
    expect(phaseToBeeState('thinking')).toBe('thinking')
    expect(phaseToBeeState('speaking')).toBe('speaking')
    expect(phaseToBeeState('error')).toBe('error')
  })
})
