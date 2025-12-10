-- Add optional style metadata to story_images for traceability
alter table public.story_images
  add column if not exists style_id text,
  add column if not exists openai_style text;

comment on column public.story_images.style_id is 'Illustration style identifier (matches _shared/illustration-styles.ts)';
comment on column public.story_images.openai_style is 'Mapped OpenAI image style (vivid|natural) derived from the illustration style';
