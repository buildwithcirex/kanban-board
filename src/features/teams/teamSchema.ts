import { z } from 'zod'

/**
 * Form-level validation. The same rules are enforced by table constraints in
 * 20260925090000_core_schema.sql — this layer exists to give an answer without a round trip, not
 * to be the only check.
 */

export const teamNameSchema = z
  .string()
  .trim()
  .min(1, 'Give the team a name')
  .max(80, 'Keep the name under 80 characters')

export const teamDescriptionSchema = z
  .string()
  .trim()
  .max(500, 'Keep the description under 500 characters')

export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a colour')

export const memberEmailSchema = z
  .string()
  .trim()
  .min(1, 'Enter an email address')
  .max(320, 'That email address is too long')
  .pipe(z.email('Enter a valid email address'))

/** Palette offered when creating or editing a team. */
export const teamColors = [
  '#4b7bec',
  '#20bf6b',
  '#eb3b5a',
  '#f7b731',
  '#8854d0',
  '#0fb9b1',
  '#fa8231',
  '#2d98da',
] as const

/** Returns the first validation message, or null when the value is acceptable. */
export function firstIssue(schema: z.ZodType, value: unknown): string | null {
  const result = schema.safeParse(value)
  return result.success ? null : (result.error.issues[0]?.message ?? 'That value is not valid')
}
