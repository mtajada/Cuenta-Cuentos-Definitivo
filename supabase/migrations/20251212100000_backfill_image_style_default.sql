-- Backfill existing stories with default illustration style
update public.stories
set image_style = 'watercolor_child'
where image_style is null;
