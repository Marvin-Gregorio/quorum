import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Upstash requires an account only the deployer can create — a contributor
// running `npm run dev` or the test suites shouldn't need one, and CI
// shouldn't need a new secret just to run lint/unit/RLS jobs. Every limiter
// below silently no-ops (always allows) when these aren't set, so rate
// limiting is enforced in production but optional everywhere else.
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? Redis.fromEnv() : null;

type RateLimiter = { limit: (key: string) => Promise<{ success: boolean }> };

function makeLimiter(limiter: ConstructorParameters<typeof Ratelimit>[0]['limiter'], prefix: string): RateLimiter {
  const ratelimit = redis ? new Ratelimit({ redis, limiter, prefix }) : null;
  return {
    limit: async (key) => (ratelimit ? ratelimit.limit(key) : { success: true }),
  };
}

// A real org creates one election, rarely several within an hour — this is
// sized to stop a script loop, not to constrain legitimate use. Keyed on
// the resource-exhaustion vector that matters: unlimited page creation can
// burn through the shared Supabase free-tier project's storage/Realtime
// budget for every tenant, not just the attacker's own pages.
export const createElectionRateLimit = makeLimiter(Ratelimit.slidingWindow(5, '1 h'), 'ratelimit:create-election');

// Comfortably covers someone genuinely changing their mind repeatedly; the
// upsert constraint already prevents this from corrupting data, this just
// stops a rapid-fire loop from burning DB writes and invocations for free.
export const voteRateLimit = makeLimiter(Ratelimit.slidingWindow(20, '1 m'), 'ratelimit:vote');

// A backstop, not the primary defense — the results route already caches
// public responses at the edge (s-maxage=5), which absorbs most repeated
// polling on its own. This catches a client that evades the cache.
export const resultsPollRateLimit = makeLimiter(Ratelimit.slidingWindow(30, '10 s'), 'ratelimit:results-poll');
