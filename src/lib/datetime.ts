// A cleared datetime-local input is '' (an Invalid Date), and
// Date.prototype.toISOString() throws on one instead of returning something
// the schema could reject, so map it to '' and let Zod report it.
export function toIsoOrEmpty(localValue: string): string {
  const date = new Date(localValue);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}
