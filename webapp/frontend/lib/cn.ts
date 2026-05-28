/**
 * Class-name composition helper.
 *
 * Combines `clsx` (conditional class joining) with `tailwind-merge`
 * (conflict-aware merging — e.g. the second `p-4` wins over the first
 * `p-2`). Every component variant in the design system goes through this.
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
