import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SignInPage from '@/app/sign-in/page';

describe('SignInPage', () => {
  it('renders both OAuth provider buttons', () => {
    render(<SignInPage />);
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with microsoft/i })).toBeInTheDocument();
  });
});
