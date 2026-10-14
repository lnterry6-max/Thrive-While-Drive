-- v0.2.1: retain strict private profile-media ownership while supporting Safari JPEG fallback.
-- Existing WebP objects and profile references remain valid.
alter table public.profiles
  drop constraint if exists avatar_owned_path,
  drop constraint if exists banner_owned_path;

alter table public.profiles
  add constraint avatar_owned_path
    check (avatar_path is null or avatar_path ~ ('^' || id::text || '/avatar/[a-f0-9-]+\.(webp|jpg)$')),
  add constraint banner_owned_path
    check (banner_path is null or banner_path ~ ('^' || id::text || '/banner/[a-f0-9-]+\.(webp|jpg)$'));

update storage.buckets
set allowed_mime_types = array['image/webp', 'image/jpeg']
where id = 'profile-media';

drop policy if exists profile_media_insert on storage.objects;
create policy profile_media_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'profile-media'
  and name ~ ('^' || (select auth.uid())::text || '/(avatar|banner)/[a-f0-9-]+\.(webp|jpg)$')
  and exists (select 1 from public.profiles where id = (select auth.uid()))
);
-- Unchanged: private bucket, 5 MB limit, owner-only mutation, public reads only for referenced public-profile media.
