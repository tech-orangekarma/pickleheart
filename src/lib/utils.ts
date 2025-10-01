import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuprRating(rating: number): string {
  const formatted = rating.toFixed(2);
  // Remove trailing zero if not the only decimal digit (e.g., 3.50 → 3.5, but 3.00 → 3.0)
  if (formatted.endsWith('0') && !formatted.endsWith('.0')) {
    return formatted.slice(0, -1);
  }
  return formatted;
}
