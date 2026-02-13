import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a price consistently using Swedish locale.
 * Handles special cases like "Bortskänkes", missing price, etc.
 */
export function formatPrice(text: string | null | undefined, amount: number | null | undefined): string {
  if (text === 'Bortskänkes' || text?.toLowerCase().includes('bortskänk')) return 'Bortskänkes';
  if (amount && amount > 0) return new Intl.NumberFormat('sv-SE').format(amount) + ' kr';
  if (text && /\d/.test(text)) return text;
  return 'Pris ej angivet';
}
