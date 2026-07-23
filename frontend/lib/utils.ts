import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Prefix / left-to-right word match.
 * - "am" matches "Amara Okafor" (starts with "am")
 * - "oka" matches "Amara Okafor" (word "Okafor" starts with "oka")
 * - "APP" matches "APP-1001" (ID starts with "APP")
 * - "1001" does NOT match "APP-1001" (substring, not prefix)
 */
export function matchPrefix(query: string, ...targets: string[]): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return targets.some((t) =>
    t.toLowerCase().split(/\s+/).some((word) => word.startsWith(q))
  )
}
