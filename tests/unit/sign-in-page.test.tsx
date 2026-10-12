import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SignInPage from '@/app/sign-in/page';
import { FeedbackProvider } from '@/components/feedback-provider';

// Header is an async Server Component (fetches the current Supabase auth
// session) and can't be rendered by plain React Testing Library — this test
// is about the OAuth buttons, not the header itself, so stub it out the same
// way `test:e2e` (a real Next server) is what actually exercises Header's
// auth-aware rendering.
vi.mock('@/components/header', () => ({
  Header: () => <header />,
}));

const signInWithOAuth = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createBrowserSupabaseClient: () => ({ auth: { signInWithOAuth } }),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
});

describe('SignInPage', () => {
  it('renders both OAuth provider buttons', () => {
    render(
      <FeedbackProvider>
        <SignInPage />
      </FeedbackProvider>
    );
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with microsoft/i })).toBeInTheDocument();
  });

  describe('post-sign-in redirect', () => {
    afterEach(() => {
      cleanup();
      signInWithOAuth.mockReset();
      window.history.replaceState({}, '', '/');
      document.cookie = 'post_auth_redirect=; path=/; max-age=0';
    });

    async function clickGoogleAt(url: string) {
      signInWithOAuth.mockResolvedValue({ error: null });
      window.history.replaceState({}, '', url);
      render(
        <FeedbackProvider>
          <SignInPage />
        </FeedbackProvider>
      );
      fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
      await waitFor(() => expect(signInWithOAuth).toHaveBeenCalled());
      return new URL(signInWithOAuth.mock.calls[0][0].options.redirectTo);
    }

    it('forwards a same-origin next path through the callback URL and cookie', async () => {
      const callback = await clickGoogleAt('/sign-in?next=%2Fvote%2Fabc%2Fdef');
      expect(callback.searchParams.get('next')).toBe('/vote/abc/def');
      expect(document.cookie).toContain('post_auth_redirect=');
    });

    it.each(['//evil.com', 'https://evil.com', '/\\evil.com'])('drops an unsafe next value: %s', async (next) => {
      const callback = await clickGoogleAt(`/sign-in?next=${encodeURIComponent(next)}`);
      expect(callback.searchParams.has('next')).toBe(false);
      expect(document.cookie).not.toContain('post_auth_redirect=');
    });
  });
});
