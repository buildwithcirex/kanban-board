import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { teamColors } from './teamSchema'

type ColorPickerProps = {
  value: string
  onChange: (color: string) => void
  legend: string
  name: string
}

/**
 * A radio group of swatches. Radios rather than buttons so arrow keys move between colours and
 * the choice is announced as one group.
 */
export function ColorPicker({ value, onChange, legend, name }: ColorPickerProps) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-fg">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {teamColors.map((color) => {
          const selected = color.toLowerCase() === value.toLowerCase()
          return (
            <label
              key={color}
              className={cn(
                'flex size-8 cursor-pointer items-center justify-center rounded-full ring-offset-2 ring-offset-surface',
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
