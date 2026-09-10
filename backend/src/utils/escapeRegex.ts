// Escapes user input for safe use inside a RegExp (case-insensitive substring
// search), so search terms can never inject regex operators.
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
