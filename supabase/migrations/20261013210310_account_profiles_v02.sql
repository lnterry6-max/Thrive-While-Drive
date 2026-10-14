-- v0.2: additive profile fields, private media and narrowly scoped self-service deletion.
-- Existing profiles and drive preferences are preserved. No location data is stored.
alter table public.profiles
  add column bio text not null default '',
  add column avatar_path text,
  add column banner_path text,
  add column visibility text not null default 'private',
  add constraint profile_bio_length check (char_length(bio) <= 280),
  add constraint profile_display_name_length check (char_length(display_name) <= 60),
  add constraint profile_visibility_values check (visibility in ('private', 'public')),
  add constraint avatar_owned_path check (avatar_path is null or avatar_path ~ ('^' || id::text || '/avatar/[a-f0-9-]+\.webp$')),
  add constraint banner_owned_path check (banner_path is null or banner_path ~ ('^' || id::text || '/banner/[a-f0-9-]+\.webp$'));
-- Case-insensitive unique username index already exists in the foundation migration.
-- Tighten grants: no direct profile creation/deletion or timestamp/ID changes.
revoke all on public.profiles, public.drive_preferences from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (username, display_name, bio, tags, avatar_path, banner_path, visibility) on public.profiles to authenticated;
grant select on public.drive_preferences to authenticated;
grant update (preferred_style, avoid_highways, avoid_traffic, avoid_complex_intersections) on public.drive_preferences to authenticated;
create policy profiles_public_read on public.profiles for select to anon, authenticated
  using (visibility = 'public');

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create function private.touch_updated_at() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function private.touch_updated_at();
create trigger preferences_touch_updated_at before update on public.drive_preferences
for each row execute function private.touch_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', false, 5242880, array['image/webp']);
-- Images are decoded/re-encoded client-side; only generated WebP paths are accepted.
create policy profile_media_insert on storage.objects for insert to authenticated
with check (bucket_id = 'profile-media'
  and name ~ ('^' || (select auth.uid())::text || '/(avatar|banner)/[a-f0-9-]+\.webp$')
  and exists (select 1 from public.profiles where id = (select auth.uid())));
create policy profile_media_owner_read on storage.objects for select to authenticated
using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.profiles where id = (select auth.uid())));
create policy profile_media_public_read on storage.objects for select to anon, authenticated
using (bucket_id = 'profile-media' and exists (
  select 1 from public.profiles p where p.visibility = 'public'
  and (p.avatar_path = name or p.banner_path = name)));
create policy profile_media_delete on storage.objects for delete to authenticated
using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- No UPDATE policy: immutable names avoid cached replacements and cross-user overwrites.

-- The private definer is necessary only to remove the caller's Auth record.
-- The public API wrapper is SECURITY INVOKER. No user-id parameter can be supplied.
create function private.delete_current_account() returns void
language plpgsql security definer set search_path = '' as $$
declare caller uuid := (select auth.uid());
begin
  if caller is null or not exists (
    select 1 from auth.sessions s where s.user_id = caller
    and s.id::text = (select auth.jwt())->>'session_id'
    and s.created_at > now() - interval '5 minutes'
  ) then raise exception 'Sign in again before deleting your account.' using errcode = '42501'; end if;
  if exists (select 1 from storage.objects where bucket_id = 'profile-media'
    and (storage.foldername(name))[1] = caller::text) then
    raise exception 'Remove your profile images before deleting your account.';
  end if;
  delete from auth.users where id = caller;
  if not found then raise exception 'Account no longer exists.'; end if;
end;
$$;
revoke all on function private.delete_current_account() from public, anon;
grant execute on function private.delete_current_account() to authenticated;
create function public.delete_my_account() returns void
language sql security invoker set search_path = '' as $$
  select private.delete_current_account();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
