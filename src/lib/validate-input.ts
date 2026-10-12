import type { z } from 'zod';

// Never throws, so Server Actions can return it across the server/client
// boundary and forms can feed the message straight into showError.
export function parseInput<T extends z.ZodType>(
  schema: T,
  input: unknown
): { data: z.output<T> } | { error: string } {
  const result = schema.safeParse(input);
  if (result.success) return { data: result.data };
  return { error: result.error.issues[0]?.message ?? 'Invalid input.' };
}
