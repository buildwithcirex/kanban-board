import { useEffect, useState } from 'react'

/** How long a finger must rest on a card before it can be dragged. */
export const LONG_PRESS_MS = 350
/** Moving further than this before the timer fires is a swipe, not a press. */
export const LONG_PRESS_SLOP_PX = 10

/**
 * On a touch screen, a card only becomes draggable after a long press.
 *
 * Without this a finger landing on a card would drag it, and there would be no way left to pan
 * the board — the gesture a phone user reaches for first (plan §3). A long press arms exactly one
 * card; everything else stays undraggable, so a swipe pans.
 *
 * ⚠️ The behaviour cannot be exercised by this project's test tooling: driving it needs real
 * pointer capture, which synthetic events cannot provide. The timing rules below are unit-tested
 * through `longPressReducer`; the gesture itself is a manual check on a device.
 */

export type LongPressState =
  | { phase: 'idle' }
  | { phase: 'pressing'; cardId: string; x: number; y: number }
  | { phase: 'armed'; cardId: string }

export type LongPressEvent =
  | { type: 'press'; cardId: string; x: number; y: number }
  | { type: 'move'; x: number; y: number }
  | { type: 'elapsed' }
  | { type: 'release' }

/** The gesture as a state machine, kept pure so the rules can be tested. */
export function longPressReducer(state: LongPressState, event: LongPressEvent): LongPressState {
  switch (event.type) {
    case 'press':
      return { phase: 'pressing', cardId: event.cardId, x: event.x, y: event.y }
    case 'move': {
      if (state.phase !== 'pressing') return state
      const moved = Math.hypot(event.x - state.x, event.y - state.y)
      // Past the slop it is a pan, so the press is abandoned.
      return moved > LONG_PRESS_SLOP_PX ? { phase: 'idle' } : state
    }
    case 'elapsed':
      return state.phase === 'pressing' ? { phase: 'armed', cardId: state.cardId } : state
    case 'release':
      return { phase: 'idle' }
  }
}

/** The card id under a pointer event, or null when the event is not on a card. */
export function cardIdFromEvent(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null
  const node = target.closest<HTMLElement>('.react-flow__node')
  if (!node || node.dataset.id?.startsWith('list:')) return null
  return node.dataset.id ?? null
}

export function useTouchDragArming(enabled: boolean): {
  armedCardId: string | null
  coarsePointer: boolean
} {
  const [coarsePointer, setCoarsePointer] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  )
  const [state, setState] = useState<LongPressState>({ phase: 'idle' })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const query = window.matchMedia('(pointer: coarse)')
    const onChange = () => setCoarsePointer(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!enabled || !coarsePointer || typeof window === 'undefined') return

    let timer: number | undefined
    const dispatch = (event: LongPressEvent) =>
      setState((current) => longPressReducer(current, event))

    function onPointerDown(event: PointerEvent) {
      if (event.pointerType !== 'touch') return
      const cardId = cardIdFromEvent(event.target)
      if (!cardId) return
      dispatch({ type: 'press', cardId, x: event.clientX, y: event.clientY })
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        dispatch({ type: 'elapsed' })
        // A short buzz is the only signal that the card is now draggable.
        navigator.vibrate?.(10)
      }, LONG_PRESS_MS)
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerType !== 'touch') return
      dispatch({ type: 'move', x: event.clientX, y: event.clientY })
    }

    function onPointerUp() {
      window.clearTimeout(timer)
      dispatch({ type: 'release' })
    }

    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true })
    window.addEventListener('pointercancel', onPointerUp, { passive: true })

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [enabled, coarsePointer])

  return { armedCardId: state.phase === 'armed' ? state.cardId : null, coarsePointer }
}
