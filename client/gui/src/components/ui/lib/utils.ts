import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const NUMERIC_INPUT_MAX = 65535

export function sanitizeDigitsInput(raw: string): string {
  return raw.replace(/\D/g, '')
}

export function sanitizeNumericInput(raw: string, max = NUMERIC_INPUT_MAX): string {
  const digits = sanitizeDigitsInput(raw)
  if (!digits) return ''
  const n = Number(digits)
  return n > max ? String(max) : digits
}
