import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from './App';
const map = vi.hoisted(() => ({ remove: vi.fn(), addControl: vi.fn(), on: vi.fn(), construct: vi.fn() }));
vi.mock('maplibre-gl', () => ({
  Map: class { constructor() { map.construct(); } remove = map.remove; addControl = map.addControl; on = map.on; },
  NavigationControl: class {},
}));
vi.mock('./lib/supabase', () => ({ supabase: null, supabaseConfigurationError: 'Configure Supabase to sign in.' }));
beforeEach(() => { vi.stubEnv('VITE_MAP_STYLE_URL', ''); });
afterEach(() => vi.unstubAllEnvs());
const renderPage = (path = '/') => render(<MemoryRouter initialEntries={[path]}><App/></MemoryRouter>);
it('renders the home page with no map credentials', () => {
  renderPage();
  expect(screen.getByRole('heading', { name: 'A new way to explore.' })).toBeVisible();
  expect(screen.getByText('Map ready to connect')).toBeVisible();
});
it('keeps planning controls working and navigation disabled', async () => {
  renderPage('/explore');
  await userEvent.type(screen.getByLabelText('Explore a city or area'), 'Boston');
  await userEvent.selectOptions(screen.getByLabelText('Time exploring'), '45');
  await userEvent.selectOptions(screen.getByLabelText('Drive style'), 'Relaxing');
  expect(screen.getByText('Boston · 45 minutes exploring · Relaxing')).toBeVisible();
  expect(screen.getByRole('button', { name: /Generate route/ })).toBeDisabled();
});
it.each([['/community', 'Routes worth sharing.'], ['/statistics', 'Every road is a discovery.']])('renders %s', (path, title) => {
  renderPage(path);
  expect(screen.getByRole('heading', { name: title })).toBeVisible();
});
it('disables authentication with missing configuration', () => {
  renderPage('/profile');
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  expect(screen.getByText('Configure Supabase to sign in.')).toBeVisible();
});
it('catches map initialization failures', () => {
  vi.stubEnv('VITE_MAP_STYLE_URL', 'https://example.com/style.json');
  map.construct.mockImplementationOnce(() => { throw new Error('No WebGL'); });
  renderPage();
  expect(screen.getByText('Map unavailable')).toBeVisible();
});
it('handles map provider errors and cleans up on unmount', () => {
  vi.stubEnv('VITE_MAP_STYLE_URL', 'https://example.com/style.json');
  const view = renderPage();
  const onError = map.on.mock.calls.find(call => call[0] === 'error')?.[1];
  act(() => onError());
  expect(screen.getByText('Map unavailable')).toBeVisible();
  view.unmount();
  expect(map.remove).toHaveBeenCalledOnce();
});
