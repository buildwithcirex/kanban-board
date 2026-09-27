import { describe, expect, it } from 'vitest'
import { notificationHref, type InboxItem } from '@/lib/api/notifications'
import { describeNotification } from './describeNotification'

const item = (overrides: Partial<InboxItem> = {}): InboxItem => ({
  id: 1,
  type: 'card_assigned',
  actorId: 'grace',
  teamId: 'team-1',
  boardId: 'board-1',
  cardId: 'card-1',
  payload: { title: 'Ship it' },
  readAt: null,
  createdAt: '2026-09-27T12:00:00.000Z',
  ...overrides,
})

describe('describeNotification', () => {
  it.each([
    ['card_assigned', 'Grace assigned you Ship it'],
    ['mention', 'Grace mentioned you on Ship it'],
    ['comment', 'Grace commented on Ship it'],
    ['added_to_team', 'Grace added you to a team'],
  ] as const)('describes %s', (type, expected) => {
    expect(describeNotification(item({ type }), 'Grace')).toBe(expected)
  })

  it('does not name an actor for a reminder nobody sent', () => {
    expect(describeNotification(item({ type: 'overdue' }), 'Grace')).toBe('Ship it is overdue')
  })

  it('falls back when the payload has no title', () => {
    expect(describeNotification(item({ payload: {} }), 'Grace')).toContain('a card')
  })
})

describe('notificationHref', () => {
  it('links to the card when it knows the team, board and card', () => {
    expect(notificationHref(item())).toBe('/t/team-1/b/board-1/c/card-1')
  })

  it('links to the team when there is no card', () => {
    expect(notificationHref(item({ type: 'added_to_team', boardId: null, cardId: null }))).toBe(
      '/t/team-1',
    )
  })

  it('links nowhere rather than somewhere wrong when the team is unknown', () => {
    expect(notificationHref(item({ teamId: null }))).toBeNull()
  })
})
