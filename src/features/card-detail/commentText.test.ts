import { describe, expect, it } from 'vitest'
import type { TeamMember } from '@/lib/api/teams'
import { describeActivity, findMentions, timeAgo } from './commentText'

const member = (userId: string, name: string): TeamMember => ({
  userId,
  name,
  role: 'member',
  email: `${name.split(' ')[0]?.toLowerCase()}@kanban.test`,
  avatarUrl: null,
  color: '#4b7bec',
})

const members = [
  member('ada', 'Ada Lovelace'),
  member('grace', 'Grace Hopper'),
  member('linus', 'Linus Torvalds'),
]

describe('findMentions', () => {
  it('matches a first name', () => {
    expect(findMentions('nice one @Grace', members)).toEqual(['grace'])
  })

  it('matches a full name, spaces and all', () => {
    expect(findMentions('over to you @Ada Lovelace', members)).toEqual(['ada'])
  })

  it('ignores case', () => {
    expect(findMentions('@grace and @LINUS please', members).sort()).toEqual(['grace', 'linus'])
  })

  it('never repeats the same person', () => {
    expect(findMentions('@Grace @Grace Hopper @grace', members)).toEqual(['grace'])
  })

  it('does not match a name without the @', () => {
    expect(findMentions('Grace said so', members)).toEqual([])
  })

  it('does not match a longer word that merely starts with a name', () => {
    expect(findMentions('@Gracefully done', members)).toEqual([])
  })

  it('returns nothing for a comment with no mentions', () => {
    expect(findMentions('looks good to me', members)).toEqual([])
  })

  // The server re-checks every id against the board's team, so a wrong guess here can only fail
  // to notify — never notify someone who should not hear about it.
  it('cannot invent a member who is not in the list', () => {
    expect(findMentions('@Mallory are you there', members)).toEqual([])
  })
})

describe('timeAgo', () => {
  const now = new Date('2026-09-27T12:00:00.000Z')
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()

  it.each([
    [10_000, 'just now'],
    [5 * 60_000, '5m ago'],
    [3 * 3600_000, '3h ago'],
    [2 * 86400_000, '2d ago'],
  ])('describes %i ms ago as "%s"', (delta, expected) => {
    expect(timeAgo(ago(delta), now)).toBe(expected)
  })

  it('falls back to a date beyond a week', () => {
    expect(timeAgo(ago(30 * 86400_000), now)).not.toContain('ago')
  })

  it('returns nothing for an unparseable timestamp', () => {
    expect(timeAgo('not a date', now)).toBe('')
  })
})

describe('describeActivity', () => {
  const names = new Map([
    ['ada', 'Ada Lovelace'],
    ['grace', 'Grace Hopper'],
  ])
  const entry = (type: string, payload: Record<string, unknown> = {}) => ({
    id: 1,
    type,
    actorId: 'ada',
    createdAt: '2026-09-27T12:00:00.000Z',
    payload,
  })

  it('names the actor and the target', () => {
    expect(describeActivity(entry('card.assigned', { user_id: 'grace' }), names)).toBe(
      'Ada Lovelace assigned Grace Hopper',
    )
  })

  it('copes with an actor whose account is gone', () => {
    expect(describeActivity({ ...entry('card.created'), actorId: null }, names)).toBe(
      'Someone added this card',
    )
  })

  it('copes with a target who is no longer in the team', () => {
    expect(describeActivity(entry('card.unassigned', { user_id: 'gone' }), names)).toBe(
      'Ada Lovelace unassigned someone',
    )
  })

  it('falls back to the raw type rather than dropping an entry it does not know', () => {
    expect(describeActivity(entry('card.something_new'), names)).toContain('card.something_new')
  })
})
