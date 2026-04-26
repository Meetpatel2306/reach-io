// Form testing template — submission, validation, controlled inputs, accessibility.
// Uses @testing-library/user-event (more realistic than fireEvent for typing).

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

// Replace with your real component:
// import LoginForm from '@/components/LoginForm';

function LoginForm({ onSubmit }: { onSubmit: (creds: { email: string; password: string }) => Promise<void> | void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      aria-label="login"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!email.includes('@')) return setError('invalid email');
        if (password.length < 6) return setError('password too short');
        setError(null);
        setSubmitting(true);
        try { await onSubmit({ email, password }); }
        catch (e: any) { setError(e?.message ?? 'failed'); }
        finally { setSubmitting(false); }
      }}
    >
      <label>
        Email
        <input name="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Password
        <input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}

describe('LoginForm — happy path', () => {
  it('submits the entered credentials', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'hunter2');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.com', password: 'hunter2' });
    });
  });
});

describe('LoginForm — client-side validation', () => {
  it('shows an error for an invalid email', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/email/i), 'no-at-sign');
    await user.type(screen.getByLabelText(/password/i), 'abcdef');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/invalid email/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows an error for a too-short password', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), '123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/too short/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('LoginForm — submitting state and server errors', () => {
  it('disables the button while submitting', async () => {
    const user = userEvent.setup();
    let resolveOuter: () => void = () => {};
    const onSubmit = vi.fn(() => new Promise<void>((r) => { resolveOuter = r; }));
    render(<LoginForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'abcdef');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(screen.getByRole('button')).toBeDisabled();
    resolveOuter();
    await waitFor(() => expect(screen.getByRole('button')).not.toBeDisabled());
  });

  it('surfaces the server error message', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error('bad creds'));
    render(<LoginForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'abcdef');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/bad creds/i));
  });
});

describe('LoginForm — accessibility basics', () => {
  it('every input has an accessible name', () => {
    render(<LoginForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('the submit button is reachable by keyboard', async () => {
    const user = userEvent.setup();
    render(<LoginForm onSubmit={vi.fn()} />);
    await user.tab(); // email
    await user.tab(); // password
    await user.tab(); // submit
    expect(screen.getByRole('button', { name: /sign in/i })).toHaveFocus();
  });
});
