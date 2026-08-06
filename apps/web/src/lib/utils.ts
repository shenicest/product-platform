import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function projectIdLabel(id: number) {
  return `P-${String(id).padStart(3, '0')}`
}
