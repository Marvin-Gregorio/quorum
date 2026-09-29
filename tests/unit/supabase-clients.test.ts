import { describe, it, expect, beforeAll } from 'vitest';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
});

describe('createBrowserSupabaseClient', () => {
  it('returns a client with auth and from()', () => {
    const client = createBrowserSupabaseClient();
    expect(client.auth).toBeDefined();
    expect(typeof client.from).toBe('function');
  });
});
