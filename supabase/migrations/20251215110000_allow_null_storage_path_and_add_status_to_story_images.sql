-- Allow storage_path to be null so inline_base64 fallback metadata can be persisted
alter table public.story_images
  alter column storage_path drop not null;

alter table public.story_images
  add column if not exists status text not null default 'uploaded';

update public.story_images
  set status = 'uploaded'
  where status is null;
