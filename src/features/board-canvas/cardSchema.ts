import { z } from 'zod'

/** Mirrors the `cards` table constraint in 20260925090000_core_schema.sql. */
export const cardTitleSchema = z
  .string()
  .trim()
  .min(1, 'Give the card a title')
  .max(512, 'Keep the title under 512 characters')
