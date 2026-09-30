import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HomePage from '@/app/page';

describe('HomePage', () => {
  it('renders the headline and both calls to action', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { name: /run a vote your whole organization can trust/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create an election/i })).toHaveAttribute('href', '/create');
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/sign-in');
  });
});
