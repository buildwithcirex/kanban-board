import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { Dialog } from './Dialog'
import { Input } from './Input'

describe('Button', () => {
  it('is disabled and marked busy while loading', async () => {
    const onClick = vi.fn<() => void>()
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('defaults to type="button" so it never submits forms by accident', () => {
    render(<Button>Go</Button>)
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('type', 'button')
  })
})

describe('Input', () => {
  it('links the label and error message to the input', () => {
    render(<Input label="Team name" error="Name is required" />)
    const input = screen.getByLabelText('Team name')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Name is required')
  })
})

describe('Dialog', () => {
  it('renders an accessible modal and closes via the close button', async () => {
    const onClose = vi.fn<() => void>()
    render(
      <Dialog open onClose={onClose} title="Create team" description="Name your team.">
        <p>Body</p>
      </Dialog>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Create team' })
    expect(dialog).toHaveAccessibleDescription('Name your team.')
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
