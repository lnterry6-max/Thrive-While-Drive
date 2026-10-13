-- Thrive While You Drive: standalone project only. Run against NEW Thrive Supabase project.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text unique,
 display_name text,
 tags text[] not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint username_format check (username is null or (username ~ '^[a-zA-Z0-9_]{3,24}$')),
 constraint tags_limit check (cardinality(tags) <= 5)
);
create unique index if not exists profiles_username_lower_unique on public.profiles(lower(username)) where username is not null;
create table if not exists public.drive_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 preferred_style text not null default 'Scenic',
 avoid_highways boolean not null default true,
 avoid_traffic boolean not null default true,
 avoid_complex_intersections boolean not null default false,
 updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.drive_preferences enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid())=id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid())=id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
create policy "preferences_select_own" on public.drive_preferences for select to authenticated using ((select auth.uid())=user_id);
create policy "preferences_insert_own" on public.drive_preferences for insert to authenticated with check ((select auth.uid())=user_id);
create policy "preferences_update_own" on public.drive_preferences for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create or replace function public.create_profile_for_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles (id) values (new.id) on conflict do nothing;
 insert into public.drive_preferences (user_id) values(new.id) on conflict do nothing;
 return new;
end; $$;
create trigger new_user_profile after insert on auth.users for each row execute function public.create_profile_for_new_user();
