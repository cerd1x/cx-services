/**
 *
 * @param value any value
 * @returns akan mengembalikan true jika parameter undefined  | null
 */
export function isMybe(value: any): boolean {
  if (value === undefined || value === null) return true;
  return false;
}
