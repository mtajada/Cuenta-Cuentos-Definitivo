-- Migration: Create illustrated_pdfs table
-- Date: 2024-12-01
-- Description: Creates table to store generated illustrated PDFs

-- Tabla para PDFs ilustrados generados
CREATE TABLE public.illustrated_pdfs (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  story_id uuid NOT NULL,
  chapter_id uuid NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  author text NULL,
  pdf_url text NULL,
  status text NOT NULL DEFAULT 'pending',
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT illustrated_pdfs_pkey PRIMARY KEY (id),
  CONSTRAINT illustrated_pdfs_story_id_fkey FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
  CONSTRAINT illustrated_pdfs_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES story_chapters(id) ON DELETE CASCADE,
  CONSTRAINT illustrated_pdfs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Crear índices para mejorar el rendimiento de consultas
CREATE INDEX idx_illustrated_pdfs_user_id ON public.illustrated_pdfs(user_id);
CREATE INDEX idx_illustrated_pdfs_story_id ON public.illustrated_pdfs(story_id);
CREATE INDEX idx_illustrated_pdfs_status ON public.illustrated_pdfs(status);
CREATE INDEX idx_illustrated_pdfs_generated_at ON public.illustrated_pdfs(generated_at);

-- Comentarios para documentar la tabla
COMMENT ON TABLE public.illustrated_pdfs IS 'Almacena los PDFs ilustrados generados por los usuarios';
COMMENT ON COLUMN public.illustrated_pdfs.id IS 'Identificador único del PDF ilustrado';
COMMENT ON COLUMN public.illustrated_pdfs.story_id IS 'ID de la historia asociada';
COMMENT ON COLUMN public.illustrated_pdfs.chapter_id IS 'ID del capítulo asociado';
COMMENT ON COLUMN public.illustrated_pdfs.user_id IS 'ID del usuario que generó el PDF';
COMMENT ON COLUMN public.illustrated_pdfs.title IS 'Título del cuento';
COMMENT ON COLUMN public.illustrated_pdfs.author IS 'Autor del cuento (opcional)';
COMMENT ON COLUMN public.illustrated_pdfs.pdf_url IS 'URL del PDF generado en storage';
COMMENT ON COLUMN public.illustrated_pdfs.status IS 'Estado del PDF: pending, processing, completed, failed';
COMMENT ON COLUMN public.illustrated_pdfs.generated_at IS 'Fecha y hora de generación';
COMMENT ON COLUMN public.illustrated_pdfs.updated_at IS 'Fecha y hora de última actualización'; 