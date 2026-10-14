import { vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
const mock = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  resend: vi.fn(),
  getUser: vi.fn(),
  unsubscribe: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  ilike: vi.fn(),
  from: vi.fn(),
  download: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  list: vi.fn(),
  rpc: vi.fn(),
  listener: undefined as
    undefined | ((event: string, session: Session | null) => void),
}));
vi.mock("../lib/supabase", () => ({
  supabaseConfigurationError: "",
  supabase: {
    auth: {
      getSession: mock.getSession,
      signInWithPassword: mock.signInWithPassword,
      signUp: mock.signUp,
      signOut: mock.signOut,
      updateUser: mock.updateUser,
      resetPasswordForEmail: mock.resetPasswordForEmail,
      resend: mock.resend,
      getUser: mock.getUser,
      onAuthStateChange: (listener: typeof mock.listener) => {
        mock.listener = listener;
        return { data: { subscription: { unsubscribe: mock.unsubscribe } } };
      },
    },
    from: mock.from,
    rpc: mock.rpc,
    storage: {
      from: () => ({
        download: mock.download,
        upload: mock.upload,
        remove: mock.remove,
        list: mock.list,
      }),
    },
  },
}));
export const profileFixture = {
  id: "user-a",
  username: "Explorer",
  display_name: "River",
  bio: "Taking the scenic way.",
  tags: ["Scenic Explorer"],
  visibility: "private",
  avatar_path: null,
  banner_path: null,
};
export const sessionFixture = (id = "user-a") =>
  ({
    user: {
      id,
      email: `${id}@example.com`,
      email_confirmed_at: "2026-10-01T00:00:00Z",
    },
  }) as Session;
export function resetSupabase() {
  vi.resetAllMocks();
  mock.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mock.signInWithPassword.mockResolvedValue({
    data: { session: sessionFixture(), user: sessionFixture().user },
    error: null,
  });
  mock.signUp.mockResolvedValue({ data: { session: null }, error: null });
  for (const fn of [
    mock.signOut,
    mock.updateUser,
    mock.resetPasswordForEmail,
    mock.resend,
    mock.remove,
    mock.upload,
    mock.rpc,
  ])
    fn.mockResolvedValue({ data: {}, error: null });
  mock.getUser.mockResolvedValue({
    data: { user: sessionFixture().user },
    error: null,
  });
  mock.download.mockResolvedValue({ data: null, error: null });
  mock.list.mockResolvedValue({ data: [], error: null });
  mock.read.mockImplementation((table: string) =>
    Promise.resolve({
      data:
        table === "profiles"
          ? { ...profileFixture }
          : {
              preferred_style: "Scenic",
              avoid_highways: true,
              avoid_traffic: true,
              avoid_complex_intersections: false,
            },
      error: null,
    }),
  );
  mock.write.mockResolvedValue({ data: { ...profileFixture }, error: null });
  mock.from.mockImplementation((table: string) => {
    let writing = false;
    const chain = {
      select: () => chain,
      eq: (...args: unknown[]) => {
        mock.eq(...args);
        return chain;
      },
      ilike: (...args: unknown[]) => {
        mock.ilike(...args);
        return chain;
      },
      update: (data: unknown) => {
        writing = true;
        mock.update(data);
        return chain;
      },
      single: () => (writing ? mock.write(table) : mock.read(table)),
      maybeSingle: () => mock.read(table),
    };
    return chain;
  });
}

export { mock };
