-- Create table to persist generated image metadata
create table if not exists public.story_images (
  id uuid default uuid_generate_v4() primary key,
  story_id uuid not null references public.stories(id) on delete cascade,
  chapter_id uuid null references public.story_chapters(id) on delete set null,
  image_type text not null,
  storage_path text not null,
  provider text not null,
  fallback_used boolean not null default false,
  mime_type text not null,
  original_resolution text,
  final_resolution text,
  resized_from text,
  resized_to text,
  latency_ms integer,
  user_id uuid not null references auth.users(id),
  created_at timestamptz default now()
);

alter table public.story_images enable row level security;

create unique index if not exists uniq_story_images
on public.story_images (story_id, coalesce(chapter_id, '00000000-0000-0000-0000-000000000000'::uuid), image_type);

create policy "Users can view their story images" on public.story_images
  for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.stories s where s.id = story_id and s.user_id = auth.uid()
    )
  );

create policy "Service role can insert story images" on public.story_images
  for insert
  with check (auth.jwt() ->> 'role' = 'service_role');

create policy "Service role can update story images" on public.story_images
  for update
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');
