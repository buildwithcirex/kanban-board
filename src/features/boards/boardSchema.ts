import { z } from 'zod'

/**
 * Form-level validation. The same limits are table constraints in
 * 20260925090000_core_schema.sql — this layer only exists to answer without a round trip.
 */

export const boardTitleSchema = z
  .string()
  .trim()
  .min(1, 'Give the board a title')
  .max(120, 'Keep the title under 120 characters')

export const listTitleSchema = z
  .string()
  .trim()
  .min(1, 'Give the list a title')
  .max(120, 'Keep the title under 120 characters')

export const wipLimitSchema = z
  .number()
  .int('Use a whole number')
  .min(1, 'A limit of zero would block the list')
  .max(999, 'That limit is too high to be useful')

/** Background colours offered when creating or editing a board. */
export const boardColors = [
  '#0f4c81',
  '#1f7a5a',
  '#8a4b1f',
  '#7a2f4e',
  '#4b3f8a',
  '#1f6f7a',
  '#5c5f10',
  '#3d3d46',
] as const

/** Uploads are capped here as well as by the bucket, so the error arrives before the bytes do. */
export const MAX_BACKGROUND_BYTES = 5 * 1024 * 1024
export const ACCEPTED_BACKGROUND_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

export function backgroundFileIssue(file: File): string | null {
  if (!ACCEPTED_BACKGROUND_TYPES.includes(file.type)) {
    return 'Choose a JPEG, PNG, WebP or AVIF image'
  }
  if (file.size > MAX_BACKGROUND_BYTES) return 'That image is larger than 5 MB'
  return null
}
