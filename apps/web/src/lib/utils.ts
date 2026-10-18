import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utilitas penggabung class Tailwind & conditional classnames (shadcn/ui convention)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
