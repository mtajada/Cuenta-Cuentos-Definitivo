# Selección de estilo de imagen para la creación de historias

## Objetivo
- Añadir un paso en el flujo de creación de historias que permita elegir “Creación con imagen” y, dentro de esa opción, seleccionar un estilo visual (p.ej. acuarela infantil, animación tipo Disney, anime luminoso, realista suave).
- Propagar el estilo hasta las llamadas de IA (prompts de escenas y generación de imágenes) y persistirlo en la historia para reutilizarlo en PDFs ilustrados y regeneraciones.

## Buenas prácticas (investigación rápida)
- Curar un set corto de estilos (4–6) con descriptores claros y seguros para menores; evita nombres de IPs en prompts (usar “animación cinematográfica” en vez de “Disney” literal).
- Mostrar muestras/miniaturas estáticas en la UI; no generar previews en tiempo real para no consumir créditos.
- Preseleccionar un estilo por defecto y recordar la última elección del usuario (persistencia local) para consistencia entre capítulos.
- Mantener las instrucciones de estilo centralizadas para que frontend y Edge Functions usen la misma cadena (sin divergencias de prompts).
- Mapear estilos a parámetros del proveedor cuando aplique (OpenAI: `style: vivid` para estilos coloridos, `natural` para realismo).
- Añadir copy de contexto (“pensado para niños, colores suaves, sin contenido adulto”) para ayudar a las políticas de seguridad de los modelos.

## Estado actual
- Flujo de creación: `/duration` → `/character-selection` → `/story-genre` → `/story-moral` → `/story-details-input` → `/generating`. No existe selección de modo “con imagen” ni de estilo.
- Los prompts de escenas se generan en las Edge Functions:
  - `supabase/functions/generate-story/prompt.ts`: prefix fijo “Estilo acuarela tradicional infantil…” en cada escena y mención explícita a “clásicos de Disney”.
  - `supabase/functions/generate-scenes-from-content/prompt.ts`: también fuerza acuarela de forma rígida.
- Las escenas se guardan en `stories.scenes` (ver migración `20251028143640_add_scenes_to_stories.sql`) y se consumen por `StoryPdfService.generateCompleteIllustratedPdf`, que delega en `ImageGenerationService.generateStoryImages`.
- `generate-image` Edge Function admite `style` (`vivid|natural`) pero el frontend siempre envía el valor por defecto del config (`imageProviderConfig.ts`), no depende de la historia.
- Persistencia: la EF `generate-story` no crea filas en `stories`; el front hace `upsert` vía `syncStory`, hoy sin `image_style`.
- Regeneración: `generate-scenes-from-content` no acepta `imageStyle`; el fallback de prompts (cuando `scenes` no existe) siempre rehace acuarela aunque la historia original tuviera otro estilo.

## Diseño UX/UI propuesto
- Nuevo paso “Modo de creación” similar a las pantallas actuales:
  - Opción “Cuento estándar” (texto/voz habituales).
  - Opción “Creación con imagen”. Al seleccionarla, se despliega una cuadrícula de estilos.
  - Botón “Continuar” que lleva a `/duration`.
- Estilos sugeridos (ids + copy + orientación de prompt + mapeo de estilo OpenAI):
  - `watercolor_child`: “Acuarela infantil” — colores suaves, bordes difuminados, pasteles (OpenAI `vivid`).
  - `animation_magic`: “Animación mágica (Disney-like)” — animación cinematográfica brillante, expresiva, ojos grandes (OpenAI `vivid`).
  - `anime_bright`: “Anime luminoso” — línea limpia, shading suave, fondos vibrantes (OpenAI `vivid`).
  - `storybook_classic`: “Ilustración de cuento clásico” — trazos de tinta + color plano, apariencia editorial (OpenAI `vivid`).
  - `realistic_soft`: “Realismo suave” — iluminación natural, texturas ligeras, paleta cálida (OpenAI `natural`).
- Mostrar ayuda breve: “El estilo se aplicará a portada y escenas del cuento ilustrado.”

## Cambios en frontend
1) Modelos y estado
- `src/types/index.ts`: añadir `creationMode?: 'standard' | 'image'` y `imageStyle?: string` a `StoryOptions`; opcionalmente `imageStyleLabel` si se quiere mostrar en UI.
- `src/store/types/storeTypes.ts` y `src/store/storyOptions/storyOptionsStore.ts`:
  - Incluir `creationMode` e `imageStyle` en `currentStoryOptions`, con defaults (`'standard'`, `'watercolor_child'`).
  - Nuevos setters `setCreationMode`, `setImageStyle`, `reset` que restablezcan estos campos.
  - Mantener persistencia local para recordar la última selección.
- `src/store/stories/storyGenerator.ts` y `src/services/ai/GenerateStoryService.ts`: propagar `imageStyle` en `GenerateStoryParams` y en la llamada a la Edge Function.

2) UI y flujo
- Nueva página (e.g. `src/pages/StoryCreationMode.tsx`) usando `StoryOptionCard` + grid de estilos. Registrar ruta en `App.tsx`.
- `src/pages/Home.tsx` y `IllustratedBooksModal`: navegar a la nueva ruta (no directo a `/duration`) para que el usuario elija modo y estilo antes de seguir el wizard.
- `GeneratingStory.tsx`: opcional, mostrar el estilo seleccionado en el resumen mientras se crea.

3) Servicios y consumo de historias
- `src/services/supabase.ts`:
  - `syncStory` y `getUserStories` deben enviar/leer `image_style` (nuevo campo) y colocarlo en `story.options.imageStyle`.
  - En `generateScenesOnDemand`, pasar `imageStyle` a `ScenesGenerationService.generateScenesFromContent` (usando fallback por defecto si no existe).
- `src/services/ai/scenesGenerationService.ts`: ampliar el payload para incluir `imageStyle` y enviarlo a la Edge Function.
- `src/services/ai/imageProviderConfig.ts`: permitir override de `openAiStyle` según `imageStyle` (p.ej. si el estilo incluye “realistic”, usar `natural`).
- `StoryPdfService`: al invocar `generateStoryImages`, asegurar que las escenas ya traen el estilo correcto; añadir fallback `watercolor_child` si no hay estilo.

## Cambios en Supabase / Edge Functions
1) Base de datos
- Migración nueva: `ALTER TABLE public.stories ADD COLUMN image_style text DEFAULT 'watercolor_child';` + comentario y, si se desea, índice b-tree simple.
- Actualizar seeds/scripts si existen para rellenar el estilo por defecto en historias previas.

2) Edge Functions
- `generate-story/index.ts` y `prompt.ts`:
  - Aceptar `imageStyle` en el body, validarlo contra un listado permitido.
  - Inyectar el descriptor de estilo en el prompt (reemplazar el prefix fijo por uno dinámico).
  - Guardar `image_style` al escribir la historia en DB.
- `generate-scenes-from-content/index.ts` y `prompt.ts`:
  - Aceptar `imageStyle` opcional y usarlo en la plantilla (sin asumir acuarela).
  - Si la historia ya tiene `image_style`, usarlo como default al regenerar escenas.
- `generate-image/index.ts`:
  - Aceptar `styleId` opcional (para logging) y mapear a `style` de OpenAI (`vivid|natural`) cuando el proveedor activo sea OpenAI.
  - Registrar `image_style` en metadatos si se pasa (para trazabilidad).
- Añadir helper compartido en `supabase/functions/_shared/illustration-styles.ts` con el mismo catálogo de estilos que el frontend para evitar divergencias en prompts.

## Consideraciones y compatibilidad
- Historias existentes: usar `watercolor_child` como fallback cuando `image_style` sea `NULL` para no romper PDF ilustrado.
- Evitar términos de marca en prompts finales; el label de UI puede mencionar “tipo Disney”, pero el descriptor que se envía debe ser genérico.
- Validar el estilo en frontend y backend para evitar inyección en prompts.
- Mantener el ratio preferido actual (`4:5` → `3:4` fallback) sin cambios; el estilo solo afecta estética, no layout.
- Persistencia: la EF `generate-story` no guarda en DB; el front (`syncStory`) debe upsert `image_style` en `stories`.
- Metadatos: opcionalmente registrar `image_style` en `story_images` para trazabilidad; si no se hace, al menos devolver `styleId` en `generate-image` para logging.

## Plan de pruebas sugerido
- UI: selección de modo/estilo, persistencia al volver atrás, desactivación del botón Continuar sin selección.
- Payloads: verificar en network que `/generate-story` y `/generate-scenes-from-content` reciben `imageStyle` correcto.
- Prompts: inspeccionar logs de Edge Functions y confirmar que el descriptor de estilo sustituye la línea fija de acuarela.
- Generación: crear historia con cada estilo y validar que las imágenes guardadas reflejan el estilo (y que `style` en OpenAI cambia a `natural` para `realistic_soft`).
- Reintentos: regenerar escenas “on-demand” desde `StoryPdfService` y confirmar que respeta el estilo almacenado.
- Retrocompatibilidad: historias previas sin `image_style` siguen generando PDF ilustrado con el estilo por defecto.

## Plan de implementación por fases (checklist detallado)

### Fase 0 – Alineación rápida
Decisiones cerradas (Fase 0):
- Catálogo final de estilos (ids fijos, label visible, descriptor seguro para prompts, mapeo `openAiStyle`):
  - `watercolor_child` — “Acuarela infantil”; descriptor: “acuarela suave con paleta pastel, bordes difuminados y texturas de papel, estética amable para niños”; `openAiStyle: vivid`.
  - `animation_magic` — “Animación mágica (tipo Disney)”; descriptor: “animación cinematográfica brillante y expresiva, acabado de estudio, personajes de ojos grandes e iluminación vibrante”; `openAiStyle: vivid`. (Nunca enviar “Disney” en prompts).
  - `anime_bright` — “Anime luminoso”; descriptor: “estética anime con línea limpia, sombreados suaves, colores saturados y fondos vibrantes”; `openAiStyle: vivid`.
  - `storybook_classic` — “Ilustración de cuento clásico”; descriptor: “trazos de tinta con color plano, sensación editorial, texturas ligeras y granulado suave”; `openAiStyle: vivid`.
  - `realistic_soft` — “Realismo suave”; descriptor: “realismo cálido con luz natural, profundidad de campo ligera y texturas delicadas, sin dureza”; `openAiStyle: natural`.
- Default y retrocompatibilidad: estilo global por defecto `watercolor_child`; fallback para historias antiguas o `NULL` → `watercolor_child`.
- Naming visible: la UI puede mostrar “(tipo Disney)” como referencia cultural, pero los prompts y cualquier descriptor enviado a modelos deben usar las cadenas genéricas anteriores sin marcas registradas.
- Helper compartido: catálogo único en `supabase/functions/_shared/illustration-styles.ts` (ids, label, promptDescriptor, openAiStyle, constantes `DEFAULT_IMAGE_STYLE_ID`/`FALLBACK_IMAGE_STYLE_ID` = `watercolor_child`). El frontend tendrá la misma estructura en `src/lib/illustration-styles.ts` sincronizada con ese catálogo para validación y construcción de prompts.

- [x] Validar catálogo de estilos (ids, copy visible, descriptores de prompt, mapeo `vivid|natural`) y evitar marcas (sustituir “Disney” por “animación cinematográfica” en prompts).
- [x] Confirmar default global `watercolor_child` y fallback para historias antiguas (`NULL` → default).
- [x] Acordar naming visible (evitar marcas en prompts; “animación mágica” vs “Disney-like”).
- [x] Definir helper de catálogo compartido (frontend + Supabase `_shared/illustration-styles.ts`) para descriptores y mapeos.

### Fase 1 – Modelado y contratos
- [ ] Ampliar tipos (`src/types/index.ts`): `creationMode?: 'standard' | 'image'`, `imageStyle?: string` en `StoryOptions` y reflejar en `Story`/`StoryWithChapters`.
- [ ] Actualizar store types (`src/store/types/storeTypes.ts`): añadir campos y firmas de setters; garantizar que `reset` preserve o restablezca defaults sin perder la última elección guardada en persistencia.
- [ ] Store (`src/store/storyOptions/storyOptionsStore.ts`): defaults (`creationMode: 'standard'`, `imageStyle: 'watercolor_child'`), setters `setCreationMode`/`setImageStyle`, reset y persistencia (recordar última elección).
- [ ] Payloads `GenerateStoryParams` + `GenerateStoryService.generateStoryWithAI`: incluir `imageStyle`.
- [ ] `storyGenerator.generateStory`: propagar `creationMode`/`imageStyle` en `payload.options`.
- [ ] Supabase service (`src/services/supabase.ts`): `syncStory`/`getUserStories` envían y leen `image_style` hacia/desde `story.options.imageStyle`; ajustar `syncQueue` para incluir el campo.
- [ ] Definir fallback al leer historias: si `image_style` es `NULL`, usar `watercolor_child`.

### Fase 2 – UI/UX de selección
- [ ] Nueva ruta/pantalla `StoryCreationMode.tsx` (grid de modo + estilos con selección única y miniaturas estáticas).
- [ ] Registrar ruta en `App.tsx`.
- [ ] CTA de `Home` y `IllustratedBooksModal` apuntan a `/creation-mode` (no directo a `/duration`).
- [ ] Botón Continuar activo solo con modo; si modo `image`, requiere estilo seleccionado; setear defaults (modo `image` + `watercolor_child` al entrar desde Libros ilustrados).
- [ ] Ayuda/tooltip: “El estilo se aplicará a portada y escenas.”

### Fase 3 – Propagación y consumo en frontend
- [ ] `GeneratingStory.tsx`: mostrar `creationMode`/`imageStyle` en el resumen.
- [ ] `StoryPdfService`: usar `story.options.imageStyle || 'watercolor_child'` como fallback y pasar `imageStyle` a generación/regeneración de escenas e imágenes.
- [ ] `ScenesGenerationService.generateScenesFromContent`: aceptar y enviar `imageStyle`.
- [ ] Helper catálogo frontend (`src/lib/image-styles.ts`): ids, labels, descriptores de prompt, mapeo a `openAiStyle`; compartir con backend.
- [ ] `imageProviderConfig` o wrapper: si `imageStyle` es realista → `openAiStyle = 'natural'`; resto `vivid`; exponer `styleId` a `ImageGenerationService.callGenerateImageEdge`.
- [ ] `ImageGenerationService`: permitir `openAiStyle` dinámico según `imageStyle`, propagar `styleId` al body de `generate-image`.

### Fase 4 – Backend / Edge Functions
- [ ] Migración DB: `ALTER TABLE public.stories ADD COLUMN image_style text DEFAULT 'watercolor_child';` + comentario; opcional índice b-tree.
- [ ] `generate-story/index.ts`: validar `imageStyle` (lista permitida), guardar en DB, pasar a prompts.
- [ ] `generate-story/prompt.ts`: sustituir prefix fijo de acuarela por descriptor dinámico según `imageStyle` (usar helper compartido) y eliminar referencias de marca.
- [ ] `generate-scenes-from-content/index.ts`: aceptar `imageStyle`, default al guardado en la historia (o `watercolor_child`), pasar a plantilla.
- [ ] `generate-scenes-from-content/prompt.ts`: usar descriptor dinámico, no asumir acuarela.
- [ ] `generate-image/index.ts`: aceptar `styleId` opcional, mapear a `style` OpenAI (`vivid|natural`), registrar en metadata; opcional: persistir `image_style` en `story_images` o al menos devolver `styleId` en la respuesta.
- [ ] Helper compartido `_shared/illustration-styles.ts`: catálogo único para prompts y validación.

### Fase 5 – Retrocompatibilidad y datos existentes
- [ ] Backfill opcional: set `image_style = 'watercolor_child'` en historias previas.
- [ ] Verificar que PDFs ilustrados antiguos funcionan con fallback y no fallan generación.
- [ ] Confirmar que RLS no requiere cambios (columna nueva en `stories`).

### Fase 6 – QA integral
- [ ] UI: selección modo/estilo, navegación adelante/atrás, persistencia local, botones deshabilitados correctamente.
- [ ] Network: requests a `generate-story` y `generate-scenes-from-content` llevan `imageStyle`.
- [ ] Logs de Edge: prompts muestran descriptor dinámico (sin prefix fijo acuarela).
- [ ] Generar 1 historia por estilo y revisar metadata (provider, `openAiStyle` esperado).
- [ ] Regenerar escenas on-demand desde `StoryPdfService` y verificar estilo aplicado.
- [ ] Historias antiguas: generar PDF ilustrado → usa fallback, sin errores.

### Fase 7 – Cierre y entrega
- [ ] `npm run lint` y `npm run build` OK.
- [ ] Migración aplicada en Supabase; revisar secrets existentes (sin nuevas env vars).
- [ ] Actualizar `docs/EDGE_FUNCTIONS.md` con campo `image_style` y catálogo.
- [ ] Changelog: entrada breve describiendo la selección de estilos y propagación a imágenes.
