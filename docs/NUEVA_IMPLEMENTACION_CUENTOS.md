# Nueva Implementación de Cuentos Ilustrados

## 📋 Resumen Ejecutivo

Esta documentación describe la nueva arquitectura implementada para la generación de cuentos ilustrados, donde el AI genera tanto el contenido de la historia como los prompts detallados para todas las imágenes, asegurando consistencia visual y narrativa perfecta.

## 🏗️ Arquitectura General

### Flujo de Generación
```
1. Usuario solicita cuento → 2. AI genera JSON (title, content, scenes) → 3. Se guarda en BD → 4. Se generan imágenes → 5. Se crea PDF ilustrado
```

### Componentes Principales

#### 🎯 Edge Functions
- **`generate-story`**: Genera cuento con escenas detalladas
- **`upload-story-image`**: Almacena imágenes generadas

#### 🗄️ Base de Datos
- **Tabla `stories`**: Nueva columna `scenes` (jsonb) con prompts de imágenes
- **Storage**: Imágenes organizadas por `storyId/chapterId/imageType`

#### 🎨 Generación de Imágenes
- **6 imágenes por cuento**: cover, scene_1, scene_2, scene_3, scene_4, closing
- **Prompts generados por AI**: Garantizan consistencia visual
- **Estilo watercolor**: Pinturas manuales, acuarelas tradicionales

## 📊 Estructura de Datos

### JSON de Respuesta del AI
```json
{
  "title": "Título del cuento",
  "content": "Historia completa del cuento",
  "scenes": {
    "character": "Descripción detallada del personaje: edad, apariencia, ropa, colores",
    "cover": "Imagen de portada: personaje + título + escenario",
    "scene_1": "Primera escena clave del cuento",
    "scene_2": "Segunda escena clave",
    "scene_3": "Tercera escena clave",
    "scene_4": "Cuarta escena clave",
    "closing": "Personaje(s) de espaldas caminando hacia el horizonte"
  }
}
```

### Tipos TypeScript
```typescript
interface StoryScenes {
  character: string;
  cover: string;
  scene_1: string;
  scene_2: string;
  scene_3: string;
  scene_4: string;
  closing: string;
}

type Story = {
  id: string;
  title: string;
  content: string;
  scenes: StoryScenes; // NUEVO: AI-generated image prompts
  // ... otros campos
}
```

## 🔧 Configuración y Variables

### Variables de Entorno
```env
VITE_ENABLE_PAY=false  # Habilita/deshabilita pago para testing
```

### Configuración de Aplicación
```typescript
// src/config/app.ts
enablePayment: import.meta.env.VITE_ENABLE_PAY === 'true'
```

## 🚀 Flujo de Generación Detallado

### 1. Generación del Cuento (Edge Function)
**Archivo:** `supabase/functions/generate-story/index.ts`

```typescript
// Llama a OpenAI con prompt específico para JSON estructurado
const chatCompletion = await openai.chat.completions.create({
  model: TEXT_MODEL_GENERATE,
  messages: [{ role: "user", content: combinedPrompt }],
  response_format: { type: "json_object" },
  temperature: 0.8,
  top_p: 0.95,
  max_tokens: 20000 // Incrementado para escenas
});
```

### 2. Validación y Procesamiento
**Archivo:** `supabase/functions/generate-story/index.ts`

```typescript
interface StoryGenerationResult {
  title: string;
  content: string;
  scenes: {
    character: string;
    cover: string;
    scene_1: string;
    scene_2: string;
    scene_3: string;
    scene_4: string;
    closing: string;
  };
}

// Validación estricta de la estructura
function isValidStoryResult(obj: any): obj is StoryGenerationResult {
  return obj &&
         typeof obj.title === 'string' &&
         typeof obj.content === 'string' &&
         obj.scenes &&
         typeof obj.scenes.character === 'string' &&
         // ... validación de todas las escenas
}
```

### 3. Almacenamiento en Base de Datos
**Archivo:** `src/services/supabase.ts`

```typescript
export const syncStory = async (userId: string, story: Story) => {
  const storyData = {
    id: story.id,
    user_id: userId,
    title: story.title,
    content: story.content,
    scenes: story.scenes, // ← NUEVO: JSONB con prompts
    // ... otros campos
  };

  const { error } = await supabase.from("stories").upsert(storyData);
};
```

### 4. Generación de Imágenes
**Archivo:** `src/services/ai/imageGenerationService.ts`

```typescript
// Usa prompts desde la BD en lugar de generarlos internamente
const promptMap: Record<string, string> = {
  [IMAGES_TYPE.COVER]: scenes.cover,
  [IMAGES_TYPE.SCENE_1]: scenes.scene_1,
  // ... todas las escenas
  [IMAGES_TYPE.CLOSING]: scenes.closing,
};
```

### 5. Creación del PDF Ilustrado
**Archivo:** `src/services/storyPdfService.ts`

```typescript
// Ahora incluye 6 imágenes + página de cierre
private static readonly REQUIRED_IMAGES = [
  IMAGES_TYPE.COVER,
  IMAGES_TYPE.SCENE_1,
  IMAGES_TYPE.SCENE_2,
  IMAGES_TYPE.SCENE_3,
  IMAGES_TYPE.SCENE_4,
  IMAGES_TYPE.CLOSING
];
```

## 🎨 Sistema de Imágenes

### Tipos de Imágenes
| Tipo | Descripción | Propósito |
|------|-------------|-----------|
| `cover` | Portada con personaje + título | Primera impresión |
| `scene_1-4` | Escenas clave de la historia | Narrativa visual |
| `closing` | Personaje(s) caminando de espaldas | Cierre emocional |

### Prompt Engineering
Los prompts incluyen automáticamente:
- **Descripción del personaje**: Para consistencia visual
- **Estilo watercolor**: Pinturas manuales, acuarelas
- **Contexto narrativo**: Relacionado con la escena específica
- **Atmósfera del cuento**: Mantiene el tono general

## 💰 Sistema de Pagos

### Configuración Condicional
```typescript
// src/components/StoryPdfPreview.tsx
const handleConfirmImageGeneration = async () => {
  if (APP_CONFIG.enablePayment) {
    await handleCheckout(); // Redirect to Stripe
  } else {
    await handleDownloadIllustratedPdf(); // Direct generation
  }
};
```

### Estados de Pago
- **`VITE_ENABLE_PAY=true`**: Requiere pago para ilustraciones
- **`VITE_ENABLE_PAY=false`**: Generación gratuita (testing)

## 🔄 Migración de Base de Datos

### Script de Migración
**Archivo:** `supabase/migrations/20251028143640_add_scenes_to_stories.sql`

```sql
-- Agregar columna scenes
ALTER TABLE public.stories
ADD COLUMN IF NOT EXISTS scenes jsonb NULL;

-- Crear índice para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_stories_scenes ON public.stories USING gin(scenes);

-- Documentación
COMMENT ON COLUMN public.stories.scenes IS 'JSON structure containing AI-generated prompts for images: {character, cover, scene_1, scene_2, scene_3, scene_4, closing}. Generated by the story AI to ensure visual consistency across all images.';
```

## 🐛 Solución de Problemas

### Error: "No contiene contenido, título y scenes válidos"
**Causa:** Edge Function no está retornando `scenes`
**Solución:** Verificar logs de Edge Function y estructura JSON

### Error: "content_filter: PROHIBITED_CONTENT"
**Causa:** Prompt demasiado largo o complejo
**Solución:** Simplificar prompt en `generate-story/prompt.ts`

### Error: "No se guardaron las scenes"
**Causa:** Frontend no está enviando `scenes` a Supabase
**Solución:** Verificar `syncStory` incluye `story.scenes`

## 📈 Beneficios de la Nueva Arquitectura

### ✅ Consistencia Visual
- Mismo personaje en todas las escenas
- Vestimenta coherente
- Estilo artístico uniforme

### ✅ Eficiencia
- Prompts generados una sola vez por AI
- Reutilización desde base de datos
- Generación asíncrona de imágenes

### ✅ Escalabilidad
- Estructura JSON extensible
- Fácil agregar nuevas escenas
- Optimización de costos de AI

### ✅ Mantenibilidad
- Separación clara de responsabilidades
- Tipos TypeScript estrictos
- Documentación integrada

## 🔮 Futuras Extensiones

### Posibles Mejoras
- **Más escenas**: Agregar scene_5, scene_6, etc.
- **Estilos múltiples**: Permitir diferentes estilos artísticos
- **Personalización**: Permitir al usuario modificar prompts
- **Cache inteligente**: Evitar regeneración de imágenes existentes

## 📚 Referencias

### Archivos Clave
- `supabase/functions/generate-story/index.ts`
- `supabase/functions/generate-story/prompt.ts`
- `src/services/ai/imageGenerationService.ts`
- `src/services/storyPdfService.ts`
- `src/services/supabase.ts`
- `src/types/index.ts`

### Documentación Relacionada
- `docs/EDGE_FUNCTIONS.md`
- `docs/project_structure.md`
- `docs/Stripe_integration.md`
