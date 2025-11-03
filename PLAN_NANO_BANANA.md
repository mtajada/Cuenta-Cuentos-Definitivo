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

- [ ] Confirmar que el frontend genera solicitudes en orden `character → cover → escenas` usando formato 4:5.
- [ ] Verificar que `generate-image` intenta Gemini con `aspectRatio: "4:5"` y aplica normalización a lienzo A4 mediante librería compatible con Deno.
- [ ] Asegurar que ante fallo técnico se ejecuta fallback OpenAI con `1024x1536` y se normaliza igual que Gemini.
- [ ] Validar que el resultado siempre se sube a `images-stories` con metadatos completos y el frontend consume únicamente URLs públicas para construir el PDF alternando texto/imágenes.

---

## Fase 0 – Preparativos

- [ ] Configurar variables de entorno
  - [ ] Registrar `GEMINI_API_KEY` y `OPENAI_API_KEY` en todos los entornos.
  - [ ] Definir `IMAGE_PROVIDER_DEFAULT=gemini` y `IMAGE_PROVIDER_FALLBACK=openai` (Edge + frontend).
  - [ ] Actualizar `.env.example` y `docs/EDGE_FUNCTIONS.md`.
- [ ] Normalizar ratios y helper de layout
  - [ ] Documentar uso exclusivo de `aspectRatio: "4:5"` (896×1152) para Gemini.
  - [ ] Mantener tabla de tamaños heredados para OpenAI (`1024x1536`, etc.) como fallback.
  - [ ] Implementar helper compartido `getImageLayout()` con ratio 4:5, resolución mínima y márgenes para A4.
- [ ] Validar dependencias compatibles con Deno
  - [ ] Seleccionar librería WASM (`imagescript@^1.4` o equivalente) para redimensionado/centrado.
  - [ ] Documentar en `docs/EDGE_FUNCTIONS.md` la prohibición de librerías Node nativas (`sharp`, `jimp`) y detallar uso de la librería elegida.

---

## Fase 1 – Backend (Supabase Edge)

### 1.1 `supabase/functions/generate-image`

- [ ] Crear módulo `providers.ts`
  - [ ] Implementar `generateWithGemini(...)` que devuelva `{ buffer, mimeType, provider: 'gemini', finishReason, latencyMs }`.
  - [ ] Reusar/ajustar `generateWithOpenAI(...)` para solicitar `1024x1536` (u otro tamaño heredado) cuando se active el fallback.
- [ ] Implementar `normalizeForLayout(buffer, mimeType)`
  - [ ] Abrir imagen con `imagescript` y escalar a 896×1152 si fuera necesario sin alterar el ratio.
  - [ ] Componer lienzo A4 (2480×3508 px a 300 dpi) centrando la ilustración y exportar (JPEG/PNG) manteniendo metadatos.
  - [ ] Registrar `originalResolution`, `finalResolution`, `resizedFrom`, `resizedTo`.
- [ ] Actualizar flujo principal de `generate-image`
  - [ ] Invocar Gemini con `aspectRatio: "4:5"` y `responseModalities: ['IMAGE']`.
  - [ ] Validar presencia de `inline_data`; si falta, registrar `EMPTY_IMAGE` y activar fallback técnico.
  - [ ] Procesar siempre la imagen con `normalizeForLayout`.
  - [ ] Ejecutar fallback con OpenAI sólo ante errores técnicos (timeout, 5xx, respuesta vacía); nunca por `finishReason === 'SAFETY'`.
- [ ] Subir la imagen normalizada a `images-stories` (usando Fase 1.2) y devolver una respuesta JSON consistente:
  ```json
  {
    "success": true,
    "publicUrl": "...",
    "metadata": {
      "providerUsed": "gemini",
      "fallbackUsed": false,
      "latencyMs": 1234,
      "originalResolution": "896x1152",
      "finalResolution": "A4@300dpi",
      "resizedFrom": "896x1152",
      "resizedTo": "2480x3508"
    }
  }
  ```

### 1.2 `supabase/functions/upload-story-image`

- [ ] Forzar uso de `imageBase64` + `mimeType` como entrada obligatoria.
- [ ] Soportar `chapterId` opcional
  - [ ] Guardar `images-stories/<storyId>/character.<ext>` cuando falte `chapterId`.
  - [ ] Mantener `images-stories/<storyId>/<chapterId>/<imageType>.<ext>` cuando exista.
- [ ] Ajustar `contentType` al `mimeType` recibido y habilitar `upsert: true`.
- [ ] Incluir en la respuesta `publicUrl`, `path`, `mimeType`, `providerUsed`.

### 1.3 Metadatos

- [ ] Crear tabla `public.story_images` con el siguiente esquema:
  ```sql
  story_id uuid not null,
  chapter_id uuid null,
  image_type text not null,
  provider text not null,
  fallback_used boolean not null default false,
  mime_type text not null,
  original_resolution text,
  final_resolution text,
  resized_from text,
  resized_to text,
  latency_ms integer,
  created_at timestamptz default now(),
  primary key (story_id, coalesce(chapter_id, uuid_nil()), image_type)
  ```
- [ ] Añadir políticas RLS
  - [ ] Permitir `select` únicamente a usuarios propietarios de la historia.
  - [ ] Autorizar `insert/update` a Edge Functions (`service_role`).

---

## Fase 2 – Frontend

### 2.1 `src/services/ai/imageGenerationService.ts`

- [ ] Sustituir la constante `MODEL` por lectura dinámica de `getDefaultImageProvider()`.
- [ ] Ajustar payload hacia Edge Function para incluir:
  ```ts
  {
    prompt,
    storyId,
    chapterId,
    imageType,
    desiredAspectRatio: '4:5',
    includeBase64: false
  }
  ```
- [ ] Persistir únicamente `publicUrl` en el array de resultados.
- [ ] Mantener orden de generación `character → cover → scene_1..closing`.
- [ ] Limitar concurrencia a 2 peticiones simultáneas.
- [ ] Propagar a la UI `providerUsed`, `fallbackUsed`, `latencyMs`, `resizedFrom`, `resizedTo`.

### 2.2 `src/services/storyPdfService.ts`

- [ ] Actualizar `validateRequiredImages` para aceptar `.jpeg` y `.png`.
- [ ] Consultar `story_images` para obtener metadatos evitando HEAD extras.
- [ ] Generar PDF insertando cada imagen centrada en página A4 completa.
- [ ] Alternar páginas `texto → imagen → texto → imagen` en todo el documento.

### 2.3 Simple toggles

- [ ] Leer proveedor activo desde variables (`IMAGE_PROVIDER_DEFAULT`, `IMAGE_PROVIDER_FALLBACK`) y exponerlo en la UI.
- [ ] Mostrar en `AdminIllustratedPdfPanel` el proveedor activo leyendo `import.meta.env`.

---

## Fase 3 – Persistencia y limpieza

- [ ] Ejecutar backfill en `images-stories`
  - [ ] Normalizar extensiones existentes a `.jpeg`.
  - [ ] Registrar metadatos (`mimeType`, `originalResolution`, `finalResolution`) para ilustraciones históricas.
- [ ] Actualizar documentación clave
  - [ ] Revisar `docs/ADMIN_ILLUSTRATED_PDF_PANEL.md` incorporando nuevo flujo y métricas.
  - [ ] Actualizar `docs/EDGE_FUNCTIONS.md` con pipeline 4:5 y la librería de normalización.
- [ ] Depurar referencias legacy
  - [ ] Reemplazar cualquier uso del bucket `story-images` por `images-stories`.
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
