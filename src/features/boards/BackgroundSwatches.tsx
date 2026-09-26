import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { boardColors } from './boardSchema'

type BackgroundSwatchesProps = {
  value: string | null
  onChange: (color: string) => void
  legend: string
  name: string
}

/**
 * Board background colours, as a radio group so arrow keys move between them and the choice is
 * announced once rather than as eight separate buttons.
 */
export function BackgroundSwatches({ value, onChange, legend, name }: BackgroundSwatchesProps) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-fg">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {boardColors.map((color) => {
          const selected = color.toLowerCase() === value?.toLowerCase()
          return (
            <label
              key={color}
              className={cn(
                'flex h-9 w-12 cursor-pointer items-center justify-center rounded-md ring-offset-2 ring-offset-surface',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
                selected && 'ring-2 ring-fg',
              )}
              style={{ backgroundColor: color }}
            >
              <input
                type="radio"
                name={name}
                value={color}
                checked={selected}
                onChange={() => onChange(color)}
                className="sr-only"
              />
              <span className="sr-only">{color}</span>
              {selected && <Check className="size-4 text-white" aria-hidden />}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
