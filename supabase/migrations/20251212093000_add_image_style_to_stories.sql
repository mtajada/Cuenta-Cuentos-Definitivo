-- Add illustration style to stories for image generation pipeline
alter table public.stories
  add column if not exists image_style text default 'watercolor_child';

comment on column public.stories.image_style is 'Estilo de ilustración seleccionado para la historia';

create index if not exists idx_stories_image_style on public.stories (image_style);
