import { Link } from 'react-router'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Board } from '@/lib/api/boards'
import { useBoardBackground } from './useBoards'

type BoardTileProps = {
  board: Board
  /** Shown under the title when boards from several teams are listed together. */
  teamName?: string
  className?: string
}

/**
 * A board in a grid. The background is decorative, so the title sits on a scrim rather than
 * relying on the image or colour for contrast — a photo cannot be trusted to stay legible.
 */
export function BoardTile({ board, teamName, className }: BoardTileProps) {
  const { color, imageUrl } = useBoardBackground(board.background)

  return (
    <Link
      to={`/t/${board.team_id}/b/${board.id}`}
      className={cn(
        'group relative flex h-24 flex-col justify-end overflow-hidden rounded-lg border border-border p-3 transition-colors',
        !color && !imageUrl && 'bg-surface hover:bg-surface-sunken',
        className,
      )}
      style={{
        backgroundColor: color ?? undefined,
        backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {(color || imageUrl) && (
        <span
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent"
        />
      )}
      <span className="relative flex items-center gap-1.5">
        <span
          className={cn(
            'min-w-0 flex-1 truncate font-medium',
            color || imageUrl ? 'text-white' : 'text-fg',
          )}
        >
          {board.title}
        </span>
        {board.visibility === 'private' && (
          <Lock
            className={cn(
              'size-3.5 shrink-0',
              color || imageUrl ? 'text-white/80' : 'text-fg-muted',
            )}
            aria-label="Private board"
          />
        )}
      </span>
      {teamName && (
        <span
          className={cn(
            'relative truncate text-xs',
            color || imageUrl ? 'text-white/75' : 'text-fg-muted',
          )}
        >
          {teamName}
        </span>
      )}
    </Link>
  )
}
