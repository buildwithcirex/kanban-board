import { describe, expect, it } from 'vitest'
import { LONG_PRESS_SLOP_PX, longPressReducer, type LongPressState } from './useTouchDragArming'

const idle: LongPressState = { phase: 'idle' }
const press = (x = 0, y = 0) => longPressReducer(idle, { type: 'press', cardId: 'c1', x, y })

describe('longPressReducer', () => {
  it('arms a card only after the press has lasted long enough', () => {
    const pressing = press()
    expect(pressing.phase).toBe('pressing')
    expect(longPressReducer(pressing, { type: 'elapsed' })).toEqual({
      phase: 'armed',
      cardId: 'c1',
    })
  })

  it('treats a finger that travels as a swipe, so the board pans instead', () => {
    const pressing = press(0, 0)
    const moved = longPressReducer(pressing, {
      type: 'move',
      x: LONG_PRESS_SLOP_PX + 1,
      y: 0,
    })
    expect(moved).toEqual(idle)
    // The timer firing afterwards must not resurrect the drag.
    expect(longPressReducer(moved, { type: 'elapsed' })).toEqual(idle)
  })

  it('tolerates a small wobble while the finger rests', () => {
    const pressing = press(0, 0)
    const wobbled = longPressReducer(pressing, { type: 'move', x: 3, y: 3 })
    expect(wobbled).toEqual(pressing)
    expect(longPressReducer(wobbled, { type: 'elapsed' }).phase).toBe('armed')
  })

  it('disarms when the finger lifts', () => {
    const armed = longPressReducer(press(), { type: 'elapsed' })
    expect(longPressReducer(armed, { type: 'release' })).toEqual(idle)
  })

  it('ignores movement when nothing is being pressed', () => {
    expect(longPressReducer(idle, { type: 'move', x: 500, y: 500 })).toEqual(idle)
  })
})
