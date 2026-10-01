import { describe, it, expect, vi, afterEach } from 'vitest';

describe('rate-limit', () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('@upstash/ratelimit');
    vi.doUnmock('@upstash/redis');
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  });

  it('always allows when Upstash credentials are not configured', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.resetModules();

    const { createElectionRateLimit } = await import('@/lib/rate-limit');
    const result = await createElectionRateLimit.limit('user-1');
    expect(result).toEqual({ success: true });
  });

  it('delegates to a real Ratelimit instance when credentials are configured', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    vi.resetModules();

    const limitMock = vi.fn().mockResolvedValue({ success: false });
    vi.doMock('@upstash/redis', () => ({ Redis: { fromEnv: () => ({}) } }));
    vi.doMock('@upstash/ratelimit', () => {
      function MockRatelimit() {
        return { limit: limitMock };
      }
      MockRatelimit.slidingWindow = vi.fn().mockReturnValue('algorithm');
      return { Ratelimit: MockRatelimit };
    });

    const { voteRateLimit } = await import('@/lib/rate-limit');
    const result = await voteRateLimit.limit('user-2');

    expect(limitMock).toHaveBeenCalledWith('user-2');
    expect(result).toEqual({ success: false });
  });
});
