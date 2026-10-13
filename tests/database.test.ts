// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
const db = new PGlite();
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const c = "33333333-3333-4333-8333-333333333333";
const session = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeAll(async () => {
  await db.exec(`
 create role anon; create role authenticated;
 create schema auth; create schema storage;
 create table auth.users(id uuid primary key);
 create table auth.sessions(id uuid primary key, user_id uuid references auth.users on delete cascade, created_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb$$;
 grant usage on schema auth to anon, authenticated;
 grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
 create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
 create table storage.objects(id uuid, bucket_id text, name text);
 alter table storage.objects enable row level security;
 grant usage on schema storage to anon,authenticated;
 grant select,insert,update,delete on storage.objects to anon,authenticated;
 create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(name,'/')$$;
 `);
  await db.exec(
    readFileSync(
      "supabase/migrations/20261013201644_initial_foundation.sql",
      "utf8",
    ).replace("create extension if not exists pgcrypto;", ""),
  );
  await db.exec(
    `insert into auth.users values ('${a}'),('${b}'),('${c}'); update public.profiles set username='Explorer',tags=array['Scenic Explorer'] where id='${a}';`,
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261013210310_account_profiles_v02.sql",
      "utf8",
    ),
  );
}, 30000);
afterAll(() => db.close());
async function asUser<T>(
  id: string,
  action: () => Promise<T>,
  role = "authenticated",
  fresh = false,
) {
  await db.exec("begin");
  try {
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
      [
        id,
        JSON.stringify({
          sub: id,
          session_id: fresh ? session : "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        }),
      ],
    );
    if (fresh)
      await db.query("insert into auth.sessions(id,user_id) values ($1,$2)", [
        session,
        id,
      ]);
    await db.exec(`set local role ${role}`);
    return await action();
  } finally {
    await db.exec("rollback");
  }
}
describe("PostgreSQL migration and authorization (local auth/storage fixture)", () => {
  it("preserves existing profiles and defaults them to private", async () => {
    const { rows } = await db.query<{
      username: string;
      visibility: string;
      tags: string[];
    }>("select username,visibility,tags from profiles where id=$1", [a]);
    expect(rows[0]).toEqual({
      username: "Explorer",
      visibility: "private",
      tags: ["Scenic Explorer"],
    });
  });
  it("creates both records for new auth users", async () => {
    const { rows } = await db.query<{ count: number }>(
      "select count(*)::int as count from drive_preferences",
    );
    expect(rows[0].count).toBe(3);
  });
  it("lets an owner read and edit only their profile", async () =>
    asUser(a, async () => {
      const { rows } = await db.query("select id from profiles");
      expect(rows).toEqual([{ id: a }]);
      const result = await db.query(
        "update profiles set bio=$1 where id=$2 returning bio",
        ["Hello", a],
      );
      expect(result.rows).toEqual([{ bio: "Hello" }]);
      const denied = await db.query(
        "update profiles set bio=$1 where id=$2 returning id",
        ["Other", b],
      );
      expect(denied.rows).toEqual([]);
    }));
  it("enforces case-insensitive username uniqueness", async () => {
    await expect(
      asUser(b, () =>
        db.exec("update profiles set username='eXpLoReR' where id='" + b + "'"),
      ),
    ).rejects.toThrow(/unique/i);
  });
  it("rejects invalid usernames and too many tags", async () => {
    await expect(
      asUser(a, () =>
        db.exec(`update profiles set username='!!' where id='${a}'`),
      ),
    ).rejects.toThrow(/username_format/);
    await expect(
      asUser(a, () =>
        db.exec(
          `update profiles set tags=array['1','2','3','4','5','6'] where id='${a}'`,
        ),
      ),
    ).rejects.toThrow(/tags_limit/);
  });
  it("prevents ID, timestamp and ownership edits", async () => {
    await expect(
      asUser(a, () => db.exec(`update profiles set id='${b}' where id='${a}'`)),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(a, () =>
        db.exec(`update profiles set created_at=now() where id='${a}'`),
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("hides private profiles from anonymous callers and allows public profiles", async () => {
    await asUser(
      "",
      async () => {
        expect((await db.query("select id from profiles")).rows).toEqual([]);
      },
      "anon",
    );
    await db.exec(`update profiles set visibility='public' where id='${b}'`);
    try {
      await asUser(
        "",
        async () => {
          expect((await db.query("select id from profiles")).rows).toEqual([
            { id: b },
          ]);
        },
        "anon",
      );
    } finally {
      await db.exec(`update profiles set visibility='private' where id='${b}'`);
    }
  });
  it("protects private preferences even for public profile owners", async () => {
    await asUser(a, async () => {
      expect(
        (await db.query("select user_id from drive_preferences")).rows,
      ).toEqual([{ user_id: a }]);
      expect(
        (
          await db.query(
            `update drive_preferences set avoid_highways=false where user_id='${b}' returning user_id`,
          )
        ).rows,
      ).toEqual([]);
    });
    await expect(
      asUser("", () => db.query("select * from drive_preferences"), "anon"),
    ).rejects.toThrow(/permission denied/);
  });
  it("restricts uploads to the owner folder and immutable webp paths", async () => {
    await asUser(a, () =>
      db.exec(
        `insert into storage.objects(bucket_id,name) values ('profile-media','${a}/avatar/aaa.webp')`,
      ),
    );
    await expect(
      asUser(a, () =>
        db.exec(
          `insert into storage.objects(bucket_id,name) values ('profile-media','${b}/avatar/aaa.webp')`,
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(a, () =>
        db.exec(
          `insert into storage.objects(bucket_id,name) values ('profile-media','${a}/avatar/aaa.svg')`,
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it("rejects another account’s media reference", async () => {
    await expect(
      asUser(a, () =>
        db.exec(
          `update profiles set avatar_path='${b}/avatar/aaa.webp' where id='${a}'`,
        ),
      ),
    ).rejects.toThrow(/avatar_owned_path/);
  });
  it("exposes only currently referenced media of a public profile", async () => {
    await db.exec(
      `insert into storage.objects(bucket_id,name) values ('profile-media','${b}/avatar/aaa.webp'),('profile-media','${b}/avatar/bbb.webp'); update profiles set visibility='public',avatar_path='${b}/avatar/aaa.webp' where id='${b}';`,
    );
    try {
      await asUser(
        "",
        async () => {
          expect(
            (await db.query("select name from storage.objects")).rows,
          ).toEqual([{ name: `${b}/avatar/aaa.webp` }]);
        },
        "anon",
      );
    } finally {
      await db.exec(
        `update profiles set visibility='private',avatar_path=null where id='${b}'; delete from storage.objects;`,
      );
    }
  });
  it("denies deletion without a recent session", async () => {
    await expect(
      asUser(a, () => db.query("select public.delete_my_account()")),
    ).rejects.toThrow(/Sign in again/);
    await expect(
      asUser("", () => db.query("select public.delete_my_account()"), "anon"),
    ).rejects.toThrow(/permission denied/);
  });
  it("requires storage cleanup before account deletion", async () => {
    await expect(
      asUser(
        a,
        async () => {
          await db.exec(
            `insert into storage.objects(bucket_id,name) values ('profile-media','${a}/avatar/aaa.webp')`,
          );
          await db.query("select public.delete_my_account()");
        },
        "authenticated",
        true,
      ),
    ).rejects.toThrow(/Remove your profile images/);
  });
  it("deletes only the authenticated account and cascades its records", async () =>
    asUser(
      c,
      async () => {
        await db.query("select public.delete_my_account()");
        expect((await db.query("select id from profiles")).rows).toEqual([]);
        await expect(
          db.exec(
            `insert into storage.objects(bucket_id,name) values ('profile-media','${c}/avatar/aaa.webp')`,
          ),
        ).rejects.toThrow(/row-level security/);
      },
      "authenticated",
      true,
    ));
  it("keeps the bucket private with enforced MIME and size restrictions", async () => {
    const { rows } = await db.query(
      "select public,file_size_limit,allowed_mime_types from storage.buckets",
    );
    expect(rows).toEqual([
      {
        public: false,
        file_size_limit: 5242880,
        allowed_mime_types: ["image/webp"],
      },
    ]);
  });
});
