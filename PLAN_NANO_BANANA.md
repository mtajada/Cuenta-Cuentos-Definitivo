# Plan de Implementación — Gemini “Nano Banana” como generador principal

## Objetivo

Usar **Gemini 2.5 Flash Image** (alias interno “Nano Banana”) como proveedor por defecto de ilustraciones verticales (relación **4:5**) para portadas y escenas del cuento, manteniendo **OpenAI GPT-Image-1** como fallback automático. Las imágenes se integrarán en PDFs A4 con una página de texto seguida de una página totalmente dedicada a la ilustración.

## Checklist global

- [ ] Completar Fase 0 – Preparativos
- [ ] Completar Fase 1 – Backend (Supabase Edge)
- [ ] Completar Fase 2 – Frontend
- [ ] Completar Fase 3 – Persistencia y limpieza
- [ ] Completar Fase 4 – QA y despliegue

---

## Flujo general

- [ ] Confirmar que el frontend mantiene el orden vigente (`cover → escenas`) e invoca `character` únicamente cuando `story.scenes.character` existe, asegurando que cada solicitud especifique el ratio deseado.
- [ ] Verificar que `generate-image` intenta Gemini con el ratio más cercano a 4:5 permitido por la API (vía helper) y aplica normalización a lienzo A4 mediante librería compatible con Deno.
- [ ] Asegurar que ante fallo técnico se ejecuta fallback OpenAI con `1024x1536` y se normaliza igual que Gemini.
- [ ] Validar que el resultado siempre se sube a `images-stories` con metadatos completos y el frontend consume únicamente URLs públicas para construir el PDF alternando texto/imágenes.

---

## Fase 0 – Preparativos

- [x] Configurar variables de entorno
  - [x] Registrar `GEMINI_API_KEY` y `OPENAI_API_KEY` en todos los entornos.
  - [x] Definir `IMAGE_PROVIDER_DEFAULT=gemini` y `IMAGE_PROVIDER_FALLBACK=openai` para las Edge Functions, y exponer `VITE_IMAGE_PROVIDER_DEFAULT` / `VITE_IMAGE_PROVIDER_FALLBACK` en el frontend.
  - [x] Documentar las nuevas variables en `docs/EDGE_FUNCTIONS.md` y en el archivo de ejemplo de entorno que se comparta con el equipo.
- [x] Normalizar ratios y helper de layout
  - [x] Documentar preferencia por el lienzo 4:5, listar los `aspectRatio` realmente soportados por Gemini (`1:1`, `3:4`, `4:3`, `9:16`, etc.) y mantener una tabla de mapeo para degradar a la opción más cercana cuando `'4:5'` no esté disponible.
  - [x] Implementar helper compartido (`mapAspectRatio`) en `_shared/image-layout.ts` y reutilizarlo en frontend (`src/lib/image-layout.ts`) para traducir el ratio deseado al permitido.
  - [x] Mantener tabla de tamaños heredados para OpenAI (`1024x1536`, etc.) como fallback.
  - [x] Centralizar la definición del layout en `supabase/functions/_shared/image-layout.ts` (export común) y generar automáticamente la contraparte `src/lib/image-layout.ts` usando el mismo contenido para preservar los imports actuales (`@/` en frontend, rutas relativas en Edge Functions).
- [x] Validar dependencias compatibles con Deno
  - [x] Seleccionar librería WASM (`imagescript@1.3.0` desde `deno.land/x`) para redimensionado/centrado.
  - [x] Documentar en `docs/EDGE_FUNCTIONS.md` la prohibición de librerías Node nativas (`sharp`, `jimp`) y detallar uso de la librería elegida.

---

## Fase 1 – Backend (Supabase Edge)

### 1.1 `supabase/functions/generate-image`

- [ ] Crear módulo `providers.ts`
  - [ ] Implementar `generateWithGemini(config)` que reciba `prompt`, `aspectRatio` soportado (según helper), tiempos de espera y devuelva `{ buffer, mimeType, provider: 'gemini', finishReason, latencyMs }`.
  - [ ] Reutilizar el helper `mapAspectRatio` para garantizar que siempre se envíe un valor permitido por Gemini y loggear el ratio final usado.
  - [ ] Reusar/ajustar `generateWithOpenAI(...)` para solicitar `1024x1536` (u otro tamaño heredado) cuando se active el fallback.
- [ ] Implementar `normalizeForLayout(buffer, mimeType)`
  - [ ] Abrir imagen con `imagescript`, obtener `width`/`height` reales y, si hace falta, escalar proporcionalmente hasta que la dimensión mayor alcance el objetivo manteniendo el aspecto.
  - [ ] Componer lienzo A4 parametrizable (defecto 1654×2339 px @200 dpi) centrando la ilustración sin deformarla; exportar como JPEG verificando si la librería elimina EXIF y, de no ser así, limpiando metadatos manualmente.
  - [ ] Añadir relleno controlado cuando el ratio obtenido no sea 4:5 para que el frontend decida si lo mantiene o aplica recorte adicional.
  - [ ] Registrar `originalResolution` usando `width × height` reales y calcular `resizedFrom`, `resizedTo` tras escalar proporcionalmente.
- [ ] Actualizar flujo principal de `generate-image`
  - [ ] Leer de la petición `desiredAspectRatio` (default `'4:5'`), mapearlo mediante helper a un `aspectRatio` permitido por Gemini y pasarlo en `imageConfig`.
  - [ ] Invocar Gemini con `responseModalities: ['Image']` y el `aspectRatio` derivado.
  - [ ] Validar presencia de `candidates[0].content.parts[].inlineData`; si falta, registrar `EMPTY_IMAGE` y activar fallback técnico.
  - [ ] Procesar siempre la imagen con `normalizeForLayout`, convirtiendo `inlineData.data` (base64) a `Uint8Array` antes de pasarla a la librería de imágenes.
  - [ ] Ejecutar fallback con OpenAI sólo ante errores técnicos (timeout, 5xx, respuesta vacía); nunca por `finishReason === 'SAFETY'`.
  - [ ] Registrar en `public.story_images` los metadatos finales (incluyendo `user_id`, `provider`, `fallback_used`, resoluciones y `latencyMs`) antes de devolver la respuesta, reutilizando el `storyId/chapterId/imageType` ya existente.
- [ ] Subir la imagen normalizada a `images-stories` (usando Fase 1.2) y devolver una respuesta JSON consistente:
  ```json
  {
    "success": true,
    "publicUrl": "...",
    "metadata": {
      "providerUsed": "gemini",
      "fallbackUsed": false,
      "latencyMs": 1234,
      "originalResolution": "providerWidthxproviderHeight",
      "finalResolution": "A4@200dpi",
      "resizedFrom": "providerWidthxproviderHeight",
      "resizedTo": "1654x2339"
    }
  }
  ```
  - [ ] Mantener `imageBase64` en la respuesta sólo cuando la subida falle, replicando la lógica que hoy usan los clientes con OpenAI.

### 1.2 `supabase/functions/upload-story-image`

- [ ] Recibir `imageBase64` + `mimeType` como camino principal (para la normalización), manteniendo compatibilidad con `imageUrl` tal como opera el flujo de OpenAI.
- [ ] Soportar `chapterId` opcional
  - [ ] Guardar `images-stories/<storyId>/character.<ext>` cuando falte `chapterId`.
  - [ ] Mantener `images-stories/<storyId>/<chapterId>/<imageType>.<ext>` cuando exista.
- [ ] Ajustar `contentType` al `mimeType` recibido y habilitar `upsert: true`.
- [ ] Incluir en la respuesta `publicUrl`, `storagePath`, `mimeType`, `providerUsed`.

### 1.3 Metadatos

- [ ] Crear tabla `public.story_images` con el siguiente esquema:
  ```sql
  id uuid default uuid_generate_v4() primary key,
  story_id uuid not null,
  chapter_id uuid null,
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
  user_id uuid not null,
  created_at timestamptz default now()
  ```
- [ ] Crear índice único que garantice una fila por imagen:
  ```sql
  create unique index uniq_story_images
  on public.story_images (story_id, coalesce(chapter_id, '00000000-0000-0000-0000-000000000000'::uuid), image_type);
  ```
- [ ] Añadir políticas RLS
  - [ ] Permitir `select` únicamente a usuarios propietarios de la historia mediante verificación directa de `user_id` o `exists` sobre `stories`.
  - [ ] Autorizar `insert/update` a Edge Functions (`service_role`).

---

## Fase 2 – Frontend

### 2.1 `src/services/ai/imageGenerationService.ts`

- [ ] Sustituir la constante `MODEL` por lectura dinámica de un helper (`getImageProviderConfig`) que resuelva `model`, tamaños y rutas a partir de `VITE_IMAGE_PROVIDER_DEFAULT` / `VITE_IMAGE_PROVIDER_FALLBACK`.
- [ ] Ajustar payload hacia Edge Function para incluir:
  ```ts
  {
    prompt,
    storyId,
    chapterId,
    imageType,
    desiredAspectRatio: '4:5'
  }
  ```
  - [ ] Usar el helper compartido `mapAspectRatio` para mostrar en logs/UI tanto el ratio solicitado como el efectivo que la API aceptó.
- [ ] Mantener la estructura de respuesta actual (`imageBase64` opcional + `publicUrl`) para garantizar compatibilidad con los consumidores existentes cuando la subida falle.
- [ ] Mantener orden de generación `cover → scene_1..closing` y añadir generación de `character` únicamente si `scenes.character` está presente, usando la misma cola concurrente (máximo 3) ya codificada.
- [ ] Propagar a la UI `providerUsed`, `fallbackUsed`, `latencyMs`, `resizedFrom`, `resizedTo`, junto con `storagePath` para reconciliar metadatos.

### 2.2 `src/services/storyPdfService.ts`

- [ ] Actualizar `validateRequiredImages` para aceptar `.jpeg` y `.png`.
  - [ ] Consultar `story_images` para obtener metadatos, reutilizar `storage_path` para armar la URL pública con `getPublicUrl` y evitar HEAD extras, mostrando proveedor y resolución al usuario.
  - [ ] Generar PDF insertando cada imagen centrada en página A4 completa, reutilizando la información de layout compartida.
- [ ] Alternar páginas `texto → imagen → texto → imagen` en todo el documento.

### 2.3 Simple toggles

- [ ] Leer proveedor activo desde `VITE_IMAGE_PROVIDER_DEFAULT` / `VITE_IMAGE_PROVIDER_FALLBACK` y exponerlo en la UI.
- [ ] Mostrar en `AdminIllustratedPdfPanel` el proveedor activo y los últimos metadatos generados leyendo `import.meta.env`.

---

## Fase 3 – Persistencia y limpieza

- [ ] Ejecutar backfill en `images-stories`
  - [ ] Reconvertir las imágenes existentes en `story-images` a JPEG mediante la misma rutina de normalización antes de moverlas y renombrarlas a `.jpeg`.
  - [ ] Registrar metadatos (`mimeType`, `originalResolution`, `finalResolution`, `storagePath`) para ilustraciones históricas.
  - [ ] Actualizar la Edge Function `generate-illustrated-pdf` y cualquier script que lea `story-images/*.png` para que utilicen `images-stories` y las nuevas rutas `.jpeg` antes del backfill.
- [ ] Actualizar documentación clave
  - [ ] Revisar `docs/ADMIN_ILLUSTRATED_PDF_PANEL.md` incorporando nuevo flujo y métricas.
  - [ ] Actualizar `docs/EDGE_FUNCTIONS.md` detallando el pipeline Gemini→normalización→OpenAI fallback, la librería de normalización elegida y la estructura de metadatos almacenados.
- [ ] Depurar referencias legacy
  - [ ] Reemplazar cualquier uso del bucket `story-images` por `images-stories` (incluyendo `generate-illustrated-pdf` y scripts asociados).
  - [ ] Eliminar flujos que descargaban imágenes desde el frontend en lugar de usar URLs públicas normalizadas.

---

## Fase 4 – QA y despliegue

- [ ] Ejecutar pruebas funcionales
  - [ ] Generar historia con personaje único y validar consistencia en todas las imágenes.
  - [ ] Generar historia con múltiples personajes asegurando coherencia visual gracias a la imagen de personaje.
  - [ ] Generar historia en idioma alternativo (por ejemplo, inglés) y confirmar compatibilidad.
  - [ ] Probar prompt bloqueado por políticas para verificar error 400 sin fallback automático.
- [ ] Automatizar validaciones técnicas
  - [ ] Crear script que descargue imágenes generadas y verifique `mimeType` correcto.
  - [ ] Confirmar resolución final A4 en las imágenes normalizadas.
  - [ ] Revisar presencia de la marca SynthID (cuando aplique).
- [ ] Monitorizar despliegue
  - [ ] Configurar métricas clave: latencia promedio Gemini/OpenAI, ratio de fallback, errores 4xx/5xx.
  - [ ] Observar logs durante 24 h y ajustar prompts/timeouts si `fallbackUsed` supera el 5 %.

---

## Resultado esperado

- Todas las ilustraciones se generan verticales (4:5) y se integran en PDFs A4 sin distorsiones ni bandas.
- El fallback a OpenAI se mantiene operativo pero transparente para el usuario.
- El almacenamiento y los metadatos quedan unificados en `images-stories` y `story_images`.
- El frontend consume únicamente URLs ya preparadas, simplificando la orquestación y reduciendo cargas base64.
