import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HomePage from '@/app/page';

// Header is an async Server Component (fetches the current Supabase auth
// session) and can't be rendered by plain React Testing Library — this test
// is about the marketing content around it, not the header itself, so stub
// it out the same way `test:e2e` (a real Next server) is what actually
// exercises Header's auth-aware rendering.
vi.mock('@/components/header', () => ({
  Header: ({ children }: { children?: React.ReactNode }) => <header>{children}</header>,
}));

describe('HomePage', () => {
  it('renders the headline, the create-election CTA, and the marketing nav link', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: /run a vote your whole organization can trust/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create an election/i })).toHaveAttribute('href', '/create');
    // "How it works" is passed as children into Header (stubbed above) —
    // asserting on it confirms HomePage still threads its one piece of
    // extra nav through, not Header's own (untestable-here) auth slot.
    expect(screen.getByRole('link', { name: /how it works/i })).toHaveAttribute('href', '#how-it-works');
  });
});
