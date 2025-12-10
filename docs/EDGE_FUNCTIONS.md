# Edge Functions de TaleMe!

Este documento describe las Edge Functions implementadas en Supabase para
manejar la generación de contenido utilizando modelos de lenguaje.

## Descripción General

Se han implementado las siguientes Edge Functions:

1. **generate-story**: Genera historias personalizadas basadas en las opciones
   proporcionadas.
2. **challenge**: Crea desafíos educativos basados en historias.
3. **story-continuation**: Genera continuaciones para historias existentes.

Estas funciones utilizan el modelo de lenguaje
**gemini-2.0-flash-thinking-exp-01-21** de Google para generar contenido de alta
calidad, permitiendo:

- Mantener las claves API seguras en el servidor.
- Reducir la carga en el dispositivo del cliente.
- Centralizar la lógica de generación de contenido.
- Mejorar la seguridad y el rendimiento.

## Configuración

Las funciones utilizan las siguientes variables de entorno relevantes para IA e imágenes:

- `GEMINI_API_KEY`: Clave para acceder a la API de Gemini de Google (generación de historias/imágenes).
- `OPENAI_API_KEY`: Clave privada para acceder a los servicios de OpenAI (fallback de imágenes, TTS).
- `IMAGE_PROVIDER_DEFAULT`: Proveedor gráfico principal. Para la iniciativa “Nano Banana” debe ser `gemini`.
- `IMAGE_PROVIDER_FALLBACK`: Proveedor alternativo cuando ocurre un fallo. Mantener `openai`.

> **Nota:** `IMAGE_PROVIDER_DEFAULT` y `IMAGE_PROVIDER_FALLBACK` se leen tanto en las Edge Functions como en el frontend (vía variables `VITE_IMAGE_PROVIDER_DEFAULT` y `VITE_IMAGE_PROVIDER_FALLBACK`) para alinear la UI con el backend.

Para configurar las variables de entorno en Supabase:

```bash
supabase secrets set \
  GEMINI_API_KEY="tu-clave-api" \
  OPENAI_API_KEY="tu-clave-openai" \
  IMAGE_PROVIDER_DEFAULT="gemini" \
  IMAGE_PROVIDER_FALLBACK="openai"
```

En desarrollo local, copia `.env.example` como `.env` y completa los valores. Asegúrate de definir los equivalentes `VITE_IMAGE_PROVIDER_DEFAULT` y `VITE_IMAGE_PROVIDER_FALLBACK` para que el frontend conozca el proveedor activo.

## Catálogo de estilos de ilustración

Todos los flujos validan y propagan el estilo de ilustración usando un catálogo común (`_shared/illustration-styles.ts` en Edge Functions y `src/lib/image-styles.ts` en frontend). Estilos permitidos:

| `styleId`           | Nombre visible                | Descriptor de prompt (resumen)                                                                      | `openAiStyle` |
|---------------------|--------------------------------|-----------------------------------------------------------------------------------------------------|---------------|
| `watercolor_child`  | Acuarela infantil             | acuarela suave con paleta pastel, bordes difuminados y texturas de papel, estética amable para niños | `vivid`       |
| `animation_magic`   | Animación mágica (tipo Disney) | animación cinematográfica brillante y expresiva, acabado de estudio, personajes de ojos grandes      | `vivid`       |
| `anime_bright`      | Anime luminoso                 | estética anime con línea limpia, sombreados suaves y fondos vibrantes                                | `vivid`       |
| `storybook_classic` | Ilustración de cuento clásico  | trazos de tinta con color plano, sensación editorial y granulado suave                               | `vivid`       |
| `realistic_soft`    | Realismo suave                | realismo cálido con luz natural y texturas delicadas, sin dureza                                     | `natural`     |

- Default y fallback: `watercolor_child`. Si `image_style` es `NULL` en BD, se degrada a este valor.
- El mapeo `styleId` → `openAiStyle` se usa en la función `generate-image` cuando el proveedor es OpenAI (`realistic_soft` → `natural`, resto `vivid`).
- El mismo `styleId` se persiste en `stories.image_style` y viaja a escenas, imágenes y PDFs ilustrados.

## Layout y relaciones de aspecto

- La iniciativa “Nano Banana” fija `aspectRatio: "4:5"` como preferencia para cualquier solicitud a Gemini. Esta proporción produce imágenes verticales ideales para portadas y escenas de los cuentos.
- Gemini 2.5 Flash Image expone únicamente los ratios: `1:1`, `3:4`, `4:3`, `9:16` y `16:9`. Cuando `"4:5"` no esté disponible en la API, degradamos automáticamente al valor más cercano (`"3:4"`) manteniendo un lienzo vertical.
- La resolución real que devuelve Gemini ronda los ~896×1152 px para escenas verticales. Se registra la resolución exacta y el ratio efectivo (`requestedAspectRatio → effectiveAspectRatio`) en runtime y se muestran en el panel de administración.
- Para el fallback de OpenAI mantenemos la tabla heredada de tamaños (`1024x1792`, `1024x1024`, `1792x1024`) y reutilizamos el helper compartido `mapAspectRatio` + `getImageLayout()` para normalizar al lienzo A4 (1654×2339 px @200 dpi).

| Ratio solicitado | Ratio Gemini efectivo | Tamaño OpenAI de fallback | Observaciones |
|------------------|-----------------------|---------------------------|---------------|
| `4:5` (preferido) | `3:4`                 | `1024x1792`               | Vertical, mantiene narrativa de portada/escena. |
| `3:4`             | `3:4`                 | `1024x1792`               | Coincide con el fallback principal. |
| `1:1`             | `1:1`                 | `1024x1024`               | Usar sólo para assets cuadrados especiales. |
| `9:16`            | `9:16`                | `1024x1792`               | Escenas ultra-verticales (no preferidas). |
| `4:3` / `16:9`    | `4:3` / `16:9`        | `1792x1024`               | Mantener horizontal para material secundario. |

El helper `getImageLayout()` centraliza esta información y expone (se muestra en el panel admin):

- `desiredAspectRatio`: `"4:5"`
- `resolvedAspectRatio`: ratio Gemini tras degradación (normalmente `3:4`).
- `canvas`: Lienzo A4 @200 dpi (1654x2339 px) y márgenes seguros de 72 px.
- `openaiFallbackSize`: tamaño recomendado para `gpt-image-1`.
- `minRenderSize`: tamaño mínimo esperado de render para poder normalizar sin pérdida visible.

> Nota: el helper vive en `supabase/functions/_shared/image-layout.ts` y se sincroniza al frontend con `npm run sync:image-layout` (genera `src/lib/image-layout.ts` con los mismos exports). Esto evita que el bundle de Vite importe directamente desde `supabase/functions` y mantiene los imports `@/` en la SPA.

## Dependencias para normalización de imágenes

- Se adopta **ImageScript** (`https://deno.land/x/imagescript@1.3.0`) como librería WASM compatible con Supabase Edge para escalar, centrar y exportar las ilustraciones.
- Queda prohibido utilizar librerías nativas de Node como `sharp` o `jimp`, ya que no son compatibles con el entorno Edge (no hay binarios nativos disponibles).
- Ejemplo de uso en Deno:

```ts
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { getImageLayout } from "../_shared/image-layout.ts"; // Ruta relativa desde la Edge Function

const source = await Image.decode(imageBuffer);
const { canvas, safeMarginPx } = getImageLayout();

const innerWidth = canvas.width - safeMarginPx.left - safeMarginPx.right;
const innerHeight = canvas.height - safeMarginPx.top - safeMarginPx.bottom;
const resized = source.clone().contain(
  innerWidth,
  innerHeight,
  Image.RESIZE_NEAREST_NEIGHBOR,
);

const composed = new Image(canvas.width, canvas.height);
composed.fill(0xffffffff);
const offsetX = Math.floor((canvas.width - resized.width) / 2);
const offsetY = Math.floor((canvas.height - resized.height) / 2);
composed.composite(resized, offsetX, offsetY);

const jpeg = await composed.encodeJPEG(92); // Calidad recomendada
```

- La función `getImageLayout()` ayudará a calcular el lienzo destino, márgenes y tamaños mínimos; `mapAspectRatio()` permite reutilizar la lógica de degradación tanto en Edge Functions como en el frontend.

## Pipeline de ilustraciones (Gemini → normalización → OpenAI fallback)

1. **Solicitud inicial a Gemini (`generate-image/providers.ts`)**
   - Se normaliza el `desiredAspectRatio` mediante `mapAspectRatio`.
   - Se envía la petición con `responseModalities: ['Image']` y se mide la latencia.
2. **Fallback automático a OpenAI**
   - Si Gemini falla por error técnico o respuesta vacía, se invoca `generateWithOpenAI` con los tamaños heredados (`1024x1792`, etc.).
   - Se marca `fallbackUsed=true` cuando la imagen final proviene de OpenAI.
3. **Normalización A4 unificada**
   - Independientemente del proveedor, el buffer pasa por `normalizeForLayout()` (ImageScript) para generar un lienzo A4 @200 dpi con fondo blanco y exportarlo a JPEG (calidad 92).
   - La rutina fuerza la eliminación de metadata EXIF/XMP en APP1 tras la codificación para cumplir la Fase 1 del plan (JPEG sin EXIF).
   - Se calculan y retornan `originalResolution`, `resizedFrom`, `resizedTo` y `finalResolution` para análisis posterior.
4. **Persistencia y metadatos**
   - El asset normalizado se sube al bucket `images-stories` usando la Edge Function `upload-story-image` (`storyId[/chapterId]/imageType.jpeg`).
   - Se registra un entry en `public.story_images` con la traza completa (proveedor, fallback, resoluciones normalizadas, latencia, storage path y usuario propietario). No existe lectura o fallback a buckets legacy en runtime; todo viaja por `images-stories` + `public.story_images`.

> El script `supabase/scripts/backfill-images-stories.ts` reutiliza exactamente la misma rutina de normalización para migrar assets heredados al bucket actual antes de eliminarlos; úsalo sólo para limpiar datos antiguos, no como parte del flujo en vivo.

### Metadatos en `public.story_images`

Cada ilustración almacenada incluye los siguientes campos clave:

- `story_id`, `chapter_id`, `image_type`: identifican de forma única la ilustración.
- `storage_path`: ruta relativa en `images-stories` (siempre `.jpeg` tras normalización).
- `provider`: `gemini` u `openai`. El valor `legacy` solo queda para entradas antiguas de backfill y no se genera en el pipeline actual.
- `fallback_used`: indica si se usó el proveedor alternativo.
- `mime_type`: siempre `image/jpeg` después de la normalización.
- `original_resolution`, `resized_from`, `resized_to`, `final_resolution`: strings `ancho×alto` que documentan el proceso.
- `latency_ms`: tiempo de respuesta del proveedor activo.
- `user_id`: propietario final del recurso (para cumplir con RLS).

Metadatos complementarios que expone la Edge Function y consume la UI (no persistidos en la tabla):

- `requestedAspectRatio` → `effectiveAspectRatio`: ratio solicitado vs ratio que realmente sirvió el proveedor.
- `requestSize`: tamaño solicitado al proveedor (p. ej. `1024x1792` en OpenAI).
- `finalCanvas`: siempre A4 normalizado (`1654x2339`).

El panel de administración muestra estos valores derivados junto con las resoluciones persistidas para validar que no queda flujo legacy.

## Panel de PDFs ilustrados (admin)

- Visualiza `VITE_IMAGE_PROVIDER_DEFAULT/FALLBACK`, ratio solicitado vs resuelto y el lienzo de normalización (A4).
- En la tabla de metadatos por imagen se listan: proveedor usado/fallback, ratio efectivo, resolución original, normalización (`from → to`), resolución final A4, MIME, storage y URL pública.
- Úsalo para validar que todo el capítulo tiene imágenes normalizadas y sin restos de `legacy_storage`.

El índice único `uniq_story_images` evita duplicados por combinación `story_id` + `chapter_id` + `image_type`. Las políticas RLS permiten lecturas a dueños de la historia y escrituras exclusivas al `service_role`.

## Funciones Disponibles

### generate-story

Genera una historia infantil personalizada basada en las opciones
proporcionadas.

#### Parámetros de Entrada (Request Payload):

```json
{
    "options": { // Opciones de la historia
        "character": { // Detalles del personaje principal
            "name": "Nombre del personaje",
            "profession": "Profesión",
            "hobbies": ["Afición 1", "Afición 2"],
            "characterType": "Tipo de personaje (ej. Animal, Humano)",
            "personality": "Personalidad (ej. Valiente, Tímido)"
        },
        "genre": "Género de la historia (ej. Aventura, Fantasía)",
        "moral": "Enseñanza o moraleja",
        "duration": "short|medium|long", // Duración deseada
        "creationMode": "standard|image", // Modo elegido en el wizard
        "imageStyle": "watercolor_child" // styleId válido del catálogo
    },
    "language": "español", // Idioma deseado para la historia
    "childAge": 7, // Edad del niño/a para adaptar el lenguaje y contenido
    "specialNeed": "Ninguna|TEA|TDAH|Dislexia|Ansiedad|Down|Comprension", // Necesidad especial para adaptar la historia
    "additionalDetails": "Texto libre con detalles adicionales para la historia", // Opcional
    "storyId": "uuid-de-la-historia" // Opcional: si se envía, la EF upserta public.stories con image_style y scenes
}
```

#### Respuesta Exitosa (Success Response):

```json
{
    "title": "Título Atractivo Generado por la IA",
    "content": "Texto completo de la historia generada...",
    "storyId": "uuid-de-la-historia",
    "imageStyle": "watercolor_child",
    "scenes": {
        "cover": "Prompt de portada en el estilo elegido",
        "scene_1": "Prompt de la primera escena",
        "...": "..."
    }
}
```

#### Respuesta de Error (Error Response):

```json
{
    "error": "Mensaje descriptivo del error"
}
```

#### Flujo de Implementación Interna:

1.  **Recepción y Validación:** La función recibe el payload JSON. Se valida la presencia de los campos requeridos (`options`).
2.  **Construcción del Prompt:**
    *   Se crea un **prompt de sistema** que instruye a la IA sobre su rol (generador de cuentos infantiles), el formato de salida esperado (JSON con `title` y `content`), y las restricciones generales (tono, longitud, creatividad para el título).
    *   Se crea un **prompt de usuario** detallado que incluye:
        *   Todas las `options` proporcionadas (personaje, género, moraleja, duración).
        *   El `language` solicitado.
        *   La `childAge`, indicando a la IA que adapte el lenguaje y la complejidad.
        *   La `specialNeed`, instruyendo a la IA para que considere sensibilidades o temas específicos si es relevante (evitando estereotipos).
        *   Los `additionalDetails` si se proporcionan.
        *   El `imageStyle` validado contra el catálogo, incluyendo el descriptor dinámico en cada prompt de escena.
    *   Si se envía `storyId` (UUID), se hace upsert en `public.stories` con `title`, `content`, `scenes`, `image_style` normalizado y `creation_mode`; si no se envía, sólo se devuelve la historia sin escribir en BD.
3.  **Llamada a la API de Gemini:** Se utiliza el cliente `@google/generative-ai` para enviar ambos prompts (sistema y usuario) al modelo Gemini configurado. Se especifica que la respuesta debe ser en formato JSON.
4.  **Procesamiento de la Respuesta:**
    *   Se intenta parsear la respuesta JSON recibida de Gemini.
    *   Se extraen los campos `title` y `content`.
    *   Se realiza una limpieza básica (ej. eliminar posibles bloques de código markdown alrededor del JSON).
    *   Se valida que `title` y `content` no estén vacíos.
5.  **Retorno:** Se devuelve un objeto JSON con `title` y `content` si todo fue exitoso, o un objeto con `error` si ocurrió algún problema.

#### Depuración y Problemas Anteriores:

*   **Problema Inicial:** Durante el desarrollo, se detectó que los parámetros `childAge` y `specialNeed` no llegaban correctamente a la Edge Function, resultando en `null` o valores por defecto, aunque el parámetro `language` sí se recibía bien.
*   **Diagnóstico:** La investigación reveló que el error no estaba en la Edge Function en sí, sino en el flujo de datos del lado del cliente antes de invocar la función. Específicamente, la lógica para guardar la configuración del perfil del usuario en la base de datos no persistía correctamente estos campos.
*   **Causa Raíz (Cliente):** La función `syncUserProfile` en `src/services/supabase.ts` recibía los datos mapeados desde `userStore` (con nombres de columna como `child_age`, `special_need`), pero intentaba acceder a ellos usando los nombres de propiedad originales de TypeScript (`profileSettings.childAge`, `profileSettings.specialNeed`), los cuales eran `undefined` en ese contexto. Esto causaba que se guardaran `null` o valores incorrectos en la base de datos.
*   **Solución (Cliente):** Se corrigió `syncUserProfile` para que utilizara directamente el objeto de datos mapeado (`dataToSync`) al preparar el objeto para la operación `upsert` de Supabase, asegurando que los nombres de columna correctos (`child_age`, `special_need`) se usaran con los valores correctos.
*   **Impacto en la Edge Function:** Una vez corregido el guardado en el cliente, la Edge Function comenzó a recibir los valores correctos para `childAge` y `specialNeed`, permitiéndole adaptar la generación de historias según lo previsto.

### generate-scenes-from-content

Regenera prompts de escenas a partir del texto ya almacenado (usado para PDFs ilustrados y regeneraciones on-demand).

#### Parámetros de Entrada:

```json
{
  "storyId": "uuid-de-la-historia",
  "title": "Título de la historia",
  "content": "Contenido completo del cuento",
  "language": "es",
  "imageStyle": "animation_magic" // opcional: prioriza stories.image_style o fallback default
}
```

- Valida `imageStyle` contra el catálogo y lo normaliza; si no se envía, usa `stories.image_style` o `watercolor_child`.
- Devuelve el `imageStyle` aplicado junto con los prompts de escenas para mantener trazabilidad.

#### Respuesta:

```json
{
  "imageStyle": "animation_magic",
  "scenes": {
    "cover": "Prompt portada con descriptor dinámico",
    "scene_1": "Prompt escena 1",
    "scene_2": "Prompt escena 2",
    "scene_3": "Prompt escena 3",
    "scene_4": "Prompt escena 4",
    "closing": "Prompt cierre"
  }
}
```

### generate-image

Genera imágenes con Gemini y fallback a OpenAI, registrando metadatos en `story_images`.

#### Parámetros de Entrada:

```json
{
  "prompt": "Prompt listo para el proveedor",
  "desiredAspectRatio": "4:5",
  "imageType": "cover|scene_1|scene_2|scene_3|scene_4|closing",
  "storyId": "uuid",
  "chapterId": "uuid|null",
  "styleId": "realistic_soft", // styleId del catálogo
  "imageStyle": "realistic_soft" // alias usado para metadata/trazabilidad
}
```

- `styleId` se valida y normaliza. Al usar OpenAI, se mapea a `style` (`realistic_soft` → `natural`; resto → `vivid`).
- El proveedor activo se toma de `IMAGE_PROVIDER_DEFAULT` con fallback configurado; el `styleId` se adjunta al payload y a la metadata de respuesta.
- Si se envía `styleId` inválido, la función devuelve error con la lista permitida (`getValidIllustrationStyleIds()`).

### challenge

Genera desafíos educativos basados en historias.

#### Acción: createChallenge

##### Solicitud:

```json
{
    "action": "createChallenge",
    "story": {
        "id": "id-de-la-historia",
        "title": "Título de la historia",
        "content": "Contenido completo de la historia...",
        "options": {
            "character": {
                "id": "id-del-personaje",
                "name": "Nombre del personaje",
                "profession": "Profesión",
                "characterType": "Tipo de personaje",
                "hobbies": ["Afición 1", "Afición 2"],
                "personality": "Personalidad"
            },
            "genre": "Género de la historia",
            "moral": "Enseñanza o moraleja",
            "duration": "short|medium|long"
        }
    },
    "category": "language|math|comprehension",
    "profileSettings": {
        "childAge": 7,
        "specialNeed": "Ninguna|TEA|TDAH|Dislexia",
        "language": "es"
    },
    "targetLanguage": "en" // Solo para desafíos de idiomas
}
```

##### Respuesta:

```json
{
    "id": "id-del-desafío",
    "storyId": "id-de-la-historia",
    "questions": [
        {
            "id": "id-de-la-pregunta",
            "category": "language|math|comprehension",
            "question": "Texto de la pregunta",
            "options": ["Opción 1", "Opción 2", "Opción 3", "Opción 4"],
            "correctOptionIndex": 0,
            "explanation": "Explicación de la respuesta correcta",
            "targetLanguage": "en" // Solo para desafíos de idiomas
        }
    ],
    "createdAt": "2023-01-01T00:00:00.000Z"
}
```

#### Acción: getLanguages

##### Solicitud:

```json
{
    "action": "getLanguages",
    "profileSettings": {
        "language": "es"
    }
}
```

##### Respuesta:

```json
{
    "languages": [
        { "code": "en", "name": "Inglés" },
        { "code": "fr", "name": "Francés" }
        // Otros idiomas...
    ]
}
```

### story-continuation

Genera continuaciones para historias existentes.

#### Lógica de Límites (Usuarios Gratuitos)

-   Un usuario gratuito puede generar **una continuación** por cada historia creada.
-   Esto significa que una historia gratuita puede tener un máximo de **dos capítulos**: el capítulo inicial generado con `generate-story` y una continuación generada a través de esta función (`story-continuation`).
-   La función verifica el número de capítulos existentes para la historia *antes* de generar una continuación (`optionContinuation`, `directedContinuation`, `freeContinuation`).
-   Si el usuario es gratuito y la historia ya tiene 2 o más capítulos, la función devolverá un error `403 Forbidden` indicando que se ha alcanzado el límite.
-   La acción `generateOptions` no está sujeta a este límite, ya que solo sugiere posibles caminos.

#### Acción: generateOptions

##### Solicitud:

```json
{
    "action": "generateOptions",
    "story": {
        "id": "id-de-la-historia",
        "title": "Título de la historia",
        "content": "Contenido principal de la historia...",
        "options": {
            "character": {/* datos del personaje */},
            "genre": "Género de la historia",
            "moral": "Enseñanza o moraleja",
            "duration": "short|medium|long"
        }
    },
    "chapters": [
        {
            "id": "id-del-capítulo",
            "storyId": "id-de-la-historia",
            "title": "Título del capítulo",
            "content": "Contenido del capítulo...",
            "order": 1,
            "createdAt": "2023-01-01T00:00:00.000Z"
        }
        // Más capítulos si existen...
    ]
}
```

##### Respuesta:

```json
{
    "options": [
        { "summary": "Buscar el tesoro escondido en el bosque." },
        { "summary": "Hablar con el misterioso anciano del pueblo." },
        { "summary": "Seguir el camino hacia las montañas nevadas." }
    ]
}
```

#### Acción: freeContinuation, optionContinuation, directedContinuation

Todos estos endpoints tienen estructuras similares, variando según el tipo de
continuación.

##### Respuesta para todas las acciones de continuación:

```json
{
    "content": "Texto completo de la continuación generada..."
}
```

#### Acción: generateTitle

##### Solicitud:

```json
{
    "action": "generateTitle",
    "content": "Contenido del capítulo para el cual se generará un título..."
}
```

##### Respuesta:

```json
{
    "title": "Título generado para el capítulo"
}
```

## Beneficios de la Migración a Edge Functions

1. **Seguridad**: Las claves API se almacenan de forma segura en el servidor y
   no se exponen al cliente.
2. **Rendimiento**: La generación de contenido se realiza en el servidor,
   reduciendo la carga en el dispositivo del cliente.
3. **Mantenibilidad**: La lógica de generación está centralizada y es más fácil
   de mantener y actualizar.
4. **Escalabilidad**: Las Edge Functions pueden escalar automáticamente según la
   demanda.

## Próximos Pasos

Considerar la migración de los siguientes servicios a Edge Functions:

1. **syncService**: Para sincronización de datos con la base de datos.
2. **Otros servicios** que requieran acceso a APIs externas o procesamiento
   intensivo.
