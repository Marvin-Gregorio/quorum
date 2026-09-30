import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SignInPage from '@/app/sign-in/page';

// Header is an async Server Component (fetches the current Supabase auth
// session) and can't be rendered by plain React Testing Library — this test
// is about the OAuth buttons, not the header itself, so stub it out the same
// way `test:e2e` (a real Next server) is what actually exercises Header's
// auth-aware rendering.
vi.mock('@/components/header', () => ({
  Header: () => <header />,
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
});

describe('SignInPage', () => {
  it('renders both OAuth provider buttons', () => {
    render(<SignInPage />);
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with microsoft/i })).toBeInTheDocument();
  });
});
