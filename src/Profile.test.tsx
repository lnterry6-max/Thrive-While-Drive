import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import Profile from './Profile';

const mock = vi.hoisted(() => ({
  getSession: vi.fn(), signInWithPassword: vi.fn(), signUp: vi.fn(), signOut: vi.fn(),
  unsubscribe: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), single: vi.fn(), update: vi.fn(),
  listener: undefined as undefined | ((event: string, session: Session | null) => void),
}));
vi.mock('./lib/supabase', () => ({
  supabaseConfigurationError: '',
  supabase: {
    auth: {
      getSession: mock.getSession, signInWithPassword: mock.signInWithPassword,
      signUp: mock.signUp, signOut: mock.signOut,
      onAuthStateChange: (listener: typeof mock.listener) => {
        mock.listener = listener;
        return { data: { subscription: { unsubscribe: mock.unsubscribe } } };
      },
    },
    from: mock.from,
  },
}));
const session = (id = 'user-a') => ({ user: { id, email: `${id}@example.com` } }) as Session;
const chain = { select: mock.select, eq: mock.eq, single: mock.single, update: mock.update };
beforeEach(() => {
  vi.resetAllMocks();
  mock.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mock.signInWithPassword.mockResolvedValue({ data: { session: session() }, error: null });
  mock.signUp.mockResolvedValue({ data: { session: null }, error: null });
  mock.signOut.mockResolvedValue({ error: null });
  for (const fn of [mock.from, mock.select, mock.eq, mock.update]) fn.mockReturnValue(chain);
  mock.single.mockResolvedValue({ data: { tags: ['Scenic Explorer'] }, error: null });
});
async function signedIn() {
  mock.getSession.mockResolvedValue({ data: { session: session() }, error: null });
  const view = render(<Profile/>);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save tags' })).toBeEnabled());
  return view;
}
async function credentials() {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Email'), 'driver@example.com');
  await user.type(screen.getByLabelText('Password'), 'test-password');
  return user;
}
describe('authentication and profiles', () => {
  it('submits sign-in credentials and surfaces errors', async () => {
    mock.signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } });
    render(<Profile/>);
    const user = await credentials();
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(mock.signInWithPassword).toHaveBeenCalledWith({ email: 'driver@example.com', password: 'test-password' });
    expect(await screen.findByText('Invalid login credentials')).toBeVisible();
  });
  it('explains email confirmation after signup', async () => {
    render(<Profile/>);
    const user = await credentials();
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(mock.signUp).toHaveBeenCalledWith({ email: 'driver@example.com', password: 'test-password' });
    expect(await screen.findByText('Check your email to confirm registration.')).toBeVisible();
  });
  it('handles rejected auth requests and allows retry', async () => {
    mock.signInWithPassword.mockRejectedValue(new Error('Network unavailable'));
    render(<Profile/>);
    const user = await credentials();
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Network unavailable')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });
  it('loads persisted tags and saves only the current user profile', async () => {
    await signedIn();
    expect(screen.getByRole('button', { name: 'Scenic Explorer' })).toHaveAttribute('aria-pressed', 'true');
    mock.single.mockResolvedValue({ data: { id: 'user-a' }, error: null });
    await userEvent.click(screen.getByRole('button', { name: 'Road Tripper' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save tags' }));
    expect(mock.update).toHaveBeenCalledWith({ tags: ['Scenic Explorer', 'Road Tripper'], updated_at: expect.any(String) });
    expect(mock.eq).toHaveBeenLastCalledWith('id', 'user-a');
    expect(await screen.findByText('Profile tags saved.')).toBeVisible();
  });
  it('does not report success for a missing or inaccessible profile row', async () => {
    await signedIn();
    mock.single.mockResolvedValue({ data: null, error: { message: 'No row returned' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save tags' }));
    expect(await screen.findByText('No row returned')).toBeVisible();
    expect(screen.queryByText('Profile tags saved.')).not.toBeInTheDocument();
  });
  it('blocks saving when profile loading fails', async () => {
    mock.getSession.mockResolvedValue({ data: { session: session() }, error: null });
    mock.single.mockRejectedValue(new Error('Profile load failed'));
    render(<Profile/>);
    expect(await screen.findByText('Profile load failed')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save tags' })).toBeDisabled();
  });
  it('enforces five tags and lets users deselect', async () => {
    await signedIn();
    for (const name of ['New Driver', 'Learning Driver', 'Experienced Driver', 'Driving Enthusiast', 'Road Tripper']) {
      await userEvent.click(screen.getByRole('button', { name }));
    }
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Road Tripper' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'New Driver' }));
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(4);
  });
  it('surfaces sign-out errors and clears tags after signing out', async () => {
    await signedIn();
    mock.signOut.mockResolvedValueOnce({ error: { message: 'Sign-out failed' } });
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText('Sign-out failed')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    act(() => mock.listener?.('SIGNED_OUT', null));
    expect(screen.getByLabelText('Email')).toBeVisible();
    mock.single.mockResolvedValue({ data: { tags: [] }, error: null });
    act(() => mock.listener?.('SIGNED_IN', session('user-b')));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save tags' })).toBeEnabled());
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(8);
  });
  it('ignores an old profile response after the account changes', async () => {
    let resolve!: (value: unknown) => void;
    mock.getSession.mockResolvedValue({ data: { session: session() }, error: null });
    mock.single.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    render(<Profile/>);
    await waitFor(() => expect(mock.single).toHaveBeenCalledTimes(1));
    mock.single.mockResolvedValue({ data: { tags: ['City Explorer'] }, error: null });
    act(() => mock.listener?.('SIGNED_IN', session('user-b')));
    await waitFor(() => expect(screen.getByRole('button', { name: 'City Explorer' })).toHaveAttribute('aria-pressed', 'true'));
    await act(async () => resolve({ data: { tags: ['New Driver'] }, error: null }));
    expect(screen.getByRole('button', { name: 'New Driver' })).toHaveAttribute('aria-pressed', 'false');
  });
  it('does not overwrite an auth event with a stale initial session', async () => {
    let resolve!: (value: unknown) => void;
    mock.getSession.mockReturnValue(new Promise(r => { resolve = r; }));
    const view = render(<Profile/>);
    act(() => mock.listener?.('SIGNED_IN', session('user-b')));
    await act(async () => resolve({ data: { session: null }, error: null }));
    expect(screen.getByText('user-b@example.com')).toBeVisible();
    view.unmount();
    expect(mock.unsubscribe).toHaveBeenCalledTimes(1);
  });
  it('handles initial session rejection', async () => {
    mock.getSession.mockRejectedValue(new Error('Session unavailable'));
    render(<Profile/>);
    expect(await screen.findByText('Session unavailable')).toBeVisible();
    expect(screen.getByLabelText('Email')).toBeVisible();
  });
});
