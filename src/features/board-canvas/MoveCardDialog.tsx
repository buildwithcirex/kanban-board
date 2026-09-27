import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Select } from '@/components/ui/Select'
import type { BoardCard } from '@/lib/api/cards'
import type { List } from '@/lib/api/lists'
import { sortByPosition } from '@/lib/ordering'

type MoveCardDialogProps = {
  card: BoardCard | null
  lists: List[]
  cards: BoardCard[]
  onClose: () => void
  onMove: (listId: string, index: number) => void
  pending: boolean
}

/**
 * Moving a card without dragging it.
 *
 * The plan asks for this for accessibility, and it is the only way to move a card with a keyboard
 * or a screen reader — a pointer drag has no keyboard equivalent. It is also the fallback if a
 * drag misbehaves, so it stays available to everyone rather than being hidden behind a setting.
 */
export function MoveCardDialog({
  card,
  lists,
  cards,
  onClose,
  onMove,
  pending,
}: MoveCardDialogProps) {
  const orderedLists = sortByPosition(lists)
  const [listId, setListId] = useState('')
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (card) {
      setListId(card.list_id)
      const inList = sortByPosition(
        cards
          .filter((other) => other.list_id === card.list_id)
          .map((other) => ({
            id: other.id,
            position: other.position,
          })),
      )
      setIndex(
        Math.max(
          0,
          inList.findIndex((other) => other.id === card.id),
        ),
      )
    }
  }, [card, cards])

  // Positions offered for the chosen list: every gap, plus the end. Moving within the card's own
  // list must not count the card itself, or "last" would be one short.
  const others = cards.filter((other) => other.list_id === listId && other.id !== card?.id)
  const slots = Array.from({ length: others.length + 1 }, (_, slot) => slot)

  return (
    <Dialog
      open={card !== null}
      onClose={onClose}
      title="Move card"
      description={card ? card.title : undefined}
      footer={
        <>
          <Button size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            loading={pending}
            onClick={() => onMove(listId, index)}
          >
            Move
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select
          label="List"
          value={listId}
          onChange={(event) => {
            setListId(event.target.value)
            setIndex(0)
          }}
        >
          {orderedLists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.title}
            </option>
          ))}
        </Select>

        <Select
          label="Position"
          value={index}
          onChange={(event) => setIndex(Number(event.target.value))}
        >
          {slots.map((slot) => (
            <option key={slot} value={slot}>
              {slot + 1} of {slots.length}
              {slot === 0 && ' (first)'}
              {slot === slots.length - 1 && slots.length > 1 && ' (last)'}
            </option>
          ))}
        </Select>
      </div>
    </Dialog>
  )
}
