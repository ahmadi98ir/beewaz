'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { BeeState } from './bee-config'

interface BeeChatStateContextValue {
  state: BeeState
  setState: (state: BeeState) => void
  setTransientState: (state: BeeState, durationMs?: number, fallbackState?: BeeState) => void
}

const BeeChatStateContext = createContext<BeeChatStateContextValue | null>(null)

function defaultTransientDurationMs(state: BeeState): number {
  switch (state) {
    case 'greeting':
      return 900
    case 'speaking':
      return 1400
    case 'error':
      return 1600
    default:
      return 1000
  }
}

export function BeeChatStateProvider({ children }: { children: ReactNode }) {
  const [state, setStateInternal] = useState<BeeState>('idle')
  const timerRef = useRef<number | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const setState = useCallback((nextState: BeeState) => {
    clearTimer()
    setStateInternal(nextState)
  }, [clearTimer])

  const setTransientState = useCallback((
    nextState: BeeState,
    durationMs = defaultTransientDurationMs(nextState),
    fallbackState: BeeState = 'idle',
  ) => {
    clearTimer()
    setStateInternal(nextState)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      setStateInternal(fallbackState)
    }, durationMs)
  }, [clearTimer])

  useEffect(() => clearTimer, [clearTimer])

  const value = useMemo(
    () => ({ state, setState, setTransientState }),
    [state, setState, setTransientState],
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
