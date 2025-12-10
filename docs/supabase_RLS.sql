-- Habilitar RLS para todas las tablas relevantes (Asegúrate de que RLS esté habilitado para cada tabla)
-- Ejemplo: ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
--          ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
--          ... y así sucesivamente para todas las tablas con políticas ...
-- (Nota: Supabase suele habilitar RLS por defecto al crear políticas desde la UI,
--  pero es bueno verificarlo si las creas por SQL)

-- Políticas para la tabla characters
CREATE POLICY "Los usuarios pueden ver sus propios personajes"
ON public.characters
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden crear sus propios personajes"
ON public.characters
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus propios personajes"
ON public.characters
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus propios personajes"
ON public.characters
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Políticas para la tabla stories
CREATE POLICY "Los usuarios pueden ver sus propias historias"
ON public.stories
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden crear sus propias historias"
ON public.stories
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus propias historias"
ON public.stories
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus propias historias"
ON public.stories
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Políticas para la tabla audio_files
CREATE POLICY "Los usuarios pueden ver sus archivos de audio"
ON public.audio_files
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden crear sus archivos de audio"
ON public.audio_files
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus archivos de audio"
ON public.audio_files
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus archivos de audio"
ON public.audio_files
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Políticas para la tabla story_chapters
CREATE POLICY "Los usuarios pueden ver capítulos de sus historias"
ON public.story_chapters
FOR SELECT
TO authenticated
USING (auth.uid() IN (SELECT stories.user_id FROM public.stories WHERE stories.id = story_chapters.story_id));

CREATE POLICY "Los usuarios pueden crear capítulos en sus historias"
ON public.story_chapters
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IN (SELECT stories.user_id FROM public.stories WHERE stories.id = story_chapters.story_id));

CREATE POLICY "Los usuarios pueden actualizar capítulos de sus historias"
ON public.story_chapters
FOR UPDATE
TO authenticated
USING (auth.uid() IN (SELECT stories.user_id FROM public.stories WHERE stories.id = story_chapters.story_id))
WITH CHECK (auth.uid() IN (SELECT stories.user_id FROM public.stories WHERE stories.id = story_chapters.story_id));

CREATE POLICY "Los usuarios pueden eliminar capítulos de sus historias"
ON public.story_chapters
FOR DELETE
TO authenticated
USING (auth.uid() IN (SELECT stories.user_id FROM public.stories WHERE stories.id = story_chapters.story_id));

-- Políticas para la tabla story_images (ratios/proveedores en docs/EDGE_FUNCTIONS.md)
ALTER TABLE public.story_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their story images"
ON public.story_images
FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Service role can insert story images"
ON public.story_images
FOR INSERT
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can update story images"
ON public.story_images
FOR UPDATE
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Políticas para la tabla challenges
CREATE POLICY "Los usuarios pueden ver desafíos de sus historias"
ON public.challenges
FOR SELECT
TO authenticated
USING (auth.uid() IN (SELECT stories.user_id FROM public.stories WHERE stories.id = challenges.story_id));

CREATE POLICY "Los usuarios pueden crear desafíos en sus historias"
ON public.challenges
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IN (SELECT stories.user_id FROM public.stories WHERE stories.id = challenges.story_id));

CREATE POLICY "Los usuarios pueden actualizar desafíos de sus historias"
ON public.challenges
FOR UPDATE
TO authenticated
USING (auth.uid() IN (SELECT stories.user_id FROM public.stories WHERE stories.id = challenges.story_id))
WITH CHECK (auth.uid() IN (SELECT stories.user_id FROM public.stories WHERE stories.id = challenges.story_id));

CREATE POLICY "Los usuarios pueden eliminar desafíos de sus historias"
ON public.challenges
FOR DELETE
TO authenticated
USING (auth.uid() IN (SELECT stories.user_id FROM public.stories WHERE stories.id = challenges.story_id));

-- Políticas para la tabla challenge_questions
CREATE POLICY "Los usuarios pueden ver preguntas de desafíos de sus historias"
ON public.challenge_questions
FOR SELECT
TO authenticated
USING (auth.uid() IN (SELECT s.user_id FROM public.stories s JOIN public.challenges c ON s.id = c.story_id WHERE c.id = challenge_questions.challenge_id));

CREATE POLICY "Los usuarios pueden crear preguntas en desafíos de sus historias"
ON public.challenge_questions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IN (SELECT s.user_id FROM public.stories s JOIN public.challenges c ON s.id = c.story_id WHERE c.id = challenge_questions.challenge_id));

CREATE POLICY "Los usuarios pueden actualizar preguntas de desafíos de sus historias"
ON public.challenge_questions
FOR UPDATE
TO authenticated
USING (auth.uid() IN (SELECT s.user_id FROM public.stories s JOIN public.challenges c ON s.id = c.story_id WHERE c.id = challenge_questions.challenge_id))
WITH CHECK (auth.uid() IN (SELECT s.user_id FROM public.stories s JOIN public.challenges c ON s.id = c.story_id WHERE c.id = challenge_questions.challenge_id));

CREATE POLICY "Los usuarios pueden eliminar preguntas de desafíos de sus historias"
ON public.challenge_questions
FOR DELETE
TO authenticated
USING (auth.uid() IN (SELECT s.user_id FROM public.stories s JOIN public.challenges c ON s.id = c.story_id WHERE c.id = challenge_questions.challenge_id));

-- Políticas para la tabla profiles
CREATE POLICY "Allow authenticated users to read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Allow authenticated users to update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow authenticated users to insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Políticas para la tabla user_voices
CREATE POLICY "Users can select their own voices"
ON public.user_voices
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own voices"
ON public.user_voices
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own voices"
ON public.user_voices
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own voices"
ON public.user_voices
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Políticas para la tabla preset_suggestions
CREATE POLICY "Allow authenticated read access to active presets"
ON public.preset_suggestions
FOR SELECT
TO authenticated
USING (is_active = true);

-- (Opcional: Si necesitas que los administradores puedan gestionar presets)
-- CREATE POLICY "Allow admin full access to presets"
-- ON public.preset_suggestions
-- FOR ALL
-- TO service_role -- O a un rol de administrador personalizado
-- USING (true);
