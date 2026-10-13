import { afterEach, expect, it, vi } from 'vitest';
const createClient = vi.hoisted(() => vi.fn(() => ({ configured: true })));
vi.mock('@supabase/supabase-js', () => ({ createClient }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
it('uses only environment configuration', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://nnpehyhqomhbznvjwtsl.supabase.co');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test_fixture');
  const { supabase } = await import('./supabase');
  expect(supabase).toEqual({ configured: true });
  expect(createClient).toHaveBeenCalledWith('https://nnpehyhqomhbznvjwtsl.supabase.co', 'sb_publishable_test_fixture');
});
it.each([
  ['', ''], ['invalid-url', 'sb_publishable_test_fixture'],
  ['https://example.supabase.co', 'sb_secret_test_fixture'],
  ['https://example.supabase.co', ''],
])('fails safely for invalid configuration (%s)', async (url, key) => {
  vi.stubEnv('VITE_SUPABASE_URL', url);
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', key);
  const { supabase, supabaseConfigurationError } = await import('./supabase');
  expect(supabase).toBeNull();
  expect(supabaseConfigurationError).not.toBe('');
  expect(createClient).not.toHaveBeenCalled();
});
