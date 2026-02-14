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

/** Match ad against search query: every word in the query must appear in title, location or price_text. */
export function adMatchesSearchQuery(
  ad: { title: string; location?: string | null; price_text?: string | null },
  searchQuery: string
): boolean {
  const q = searchQuery.toLowerCase().trim();
  if (!q) return true;
  const words = q.split(/\s+/).filter(Boolean);
  const text = [ad.title, ad.location ?? '', ad.price_text ?? ''].join(' ').toLowerCase();
  return words.every((word) => text.includes(word));
}
