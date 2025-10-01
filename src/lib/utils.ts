import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuprRating(rating: number): string {
  const formatted = rating.toFixed(2);
  // Remove trailing zero if second decimal is 0
  return formatted.endsWith('0') && !formatted.endsWith('00') 
    ? rating.toFixed(1) 
    : formatted;
}
