# 📘 Instrucciones: Proyecto "Cuento con Lili" - Next.js

## 🎯 Objetivo

Crear un nuevo proyecto base en Next.js para la aplicación de generación de cuentos infantiles con **nueva marca "Cuento con Lili"**, nuevo diseño visual, manteniendo funcionalidades core del proyecto actual (TaleMe). El proyecto debe seguir principios SOLID, Clean Architecture y ser altamente escalable mediante componentes desacoplados.

---

## ⚡ Resumen Ejecutivo: Integración con Edge Functions

### 🎯 Punto Clave

**Las Edge Functions YA ESTÁN CREADAS y en producción.** El nuevo proyecto "Cuento con Lili" **NO necesita recrearlas**, solo debe invocarlas desde sus API Routes de Next.js.

### 📦 ¿Qué ya existe y está listo?

| Componente | Estado | Ubicación | Acción |
|------------|--------|-----------|--------|
| Edge Functions | ✅ Producción | `/supabase/functions/` | **Reutilizar (no modificar)** |
| Base de Datos (schemas) | ✅ Configurada | Supabase Dashboard | **Reutilizar tablas existentes** |
| Prompts de AI | ✅ Optimizados | `/supabase/functions/*/prompt.ts` | **Usar tal cual** |
| Storage Buckets | ✅ Configurados | Supabase Storage | **Reutilizar** |
| RLS Policies | ✅ Configuradas | Supabase → SQL Editor | **Reutilizar** |

### 🔨 ¿Qué necesitamos crear?

| Componente | Estado | Ubicación | Acción |
|------------|--------|-----------|--------|
| Proyecto Next.js | ⏳ Por crear | `/cuento-con-lili/` | **Crear desde cero** |
| UI Components | ⏳ Por crear | `/cuento-con-lili/components/` | **Diseñar con nueva marca** |
| API Routes (proxy) | ⏳ Por crear | `/cuento-con-lili/app/api/` | **Crear wrappers a Edge Functions** |
| Páginas (vistas) | ⏳ Por crear | `/cuento-con-lili/app/` | **4 vistas principales** |
| Hooks personalizados | ⏳ Por crear | `/cuento-con-lili/hooks/` | **Abstraer lógica** |
| Servicios frontend | ⏳ Por crear | `/cuento-con-lili/lib/api/` | **Capa de abstracción** |

### 🌊 Flujo de Datos Completo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROYECTO: "Cuento con Lili"                         │
│                              (Next.js - Nuevo)                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │
                    ┌─────────────────▼─────────────────┐
                    │    Usuario Interactúa con UI      │
                    │   (componentes desacoplados)      │
                    └─────────────────┬─────────────────┘
                                      │
                                      │ onClick / onSubmit
                                      │
                    ┌─────────────────▼─────────────────┐
                    │    Custom Hooks (useStoryGen)     │
                    │      (lógica de negocio)          │
                    └─────────────────┬─────────────────┘
                                      │
                                      │ fetch('/api/...')
                                      │
                    ┌─────────────────▼─────────────────┐
                    │  API Routes Next.js (Proxy)       │
                    │  /app/api/generate-story/route.ts │
                    │                                   │
                    │  ✓ Valida autenticación           │
                    │  ✓ Valida inputs                  │
                    │  ✓ Adapta payload                 │
                    │  ✓ Logging unificado              │
                    └─────────────────┬─────────────────┘
                                      │
                                      │ supabase.functions.invoke()
                                      │
┌─────────────────────────────────────▼─────────────────────────────────────┐
│                        EDGE FUNCTIONS EXISTENTES                           │
│                         (Ya en producción - Reutilizar)                    │
│                                                                            │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐    │
│  │ generate-story    │  │ generate-image    │  │ generate-audio    │    │
│  │                   │  │                   │  │                   │    │
│  │ OpenAI/Gemini     │  │ DALL-E/Imagen     │  │ OpenAI TTS        │    │
│  └─────────┬─────────┘  └─────────┬─────────┘  └─────────┬─────────┘    │
│            │                       │                       │               │
│            └───────────────────────┴───────────────────────┘               │
│                                    │                                       │
└────────────────────────────────────┼───────────────────────────────────────┘
                                     │
                                     │ Response: { title, content, scenes }
                                     │
                    ┌────────────────▼────────────────┐
                    │   Supabase Database (Existing)  │
                    │   ┌──────────────────────────┐  │
                    │   │ stories (table)          │  │
                    │   │ profiles (table)         │  │
                    │   │ story_chapters (table)   │  │
                    │   └──────────────────────────┘  │
                    └────────────────┬────────────────┘
                                     │
                                     │ Data persisted
                                     │
                    ┌────────────────▼────────────────┐
                    │  API Route retorna a cliente    │
                    │  { success, story, message }    │
                    └────────────────┬────────────────┘
                                     │
                                     │
                    ┌────────────────▼────────────────┐
                    │  UI actualiza (success state)   │
                    │  Muestra historia generada      │
                    └─────────────────────────────────┘
```

### 🎨 Adaptación de Marca

```typescript
// ❌ NO modificar Edge Functions
// ✅ SÍ adaptar en API Routes de Next.js

// API Route: /app/api/generate-story/route.ts
const { data, error } = await supabase.functions.invoke('generate-story', {
  body: { /* payload estándar */ }
});

// ✅ Adaptar respuesta con branding de "Cuento con Lili"
return NextResponse.json({
  success: true,
  story: data,
  message: '¡Tu cuento mágico con Lili está listo! 🎉✨',  // ← Nueva marca
  branding: 'Cuento con Lili',
  theme: 'magical',
});
```

### 🔑 Puntos Críticos de Integración

1. **Autenticación**: Next.js API Routes validan usuario antes de llamar Edge Function
2. **Validación**: Inputs se validan en API Route (capa extra de seguridad)
3. **Transformación**: API Route adapta formato si es necesario
4. **Logging**: Logs con prefijo `[Cuento con Lili]` para filtrar en producción
5. **Error Handling**: API Route maneja errores y retorna mensajes friendly
6. **Branding**: Respuestas adaptadas a nueva marca sin tocar Edge Functions

---

## 🏗️ Stack Tecnológico

### Core
- **Framework**: Next.js 16+ (App Router)
- **Package Manager**: pnpm
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 4
- **Backend**: Supabase (Auth, Database, Storage, Edge Functions)
- **AI Provider**: OpenAI GPT-5 / Google Gemini (via Edge Functions)

### Arquitectura
- **Frontend**: Next.js React Server Components + Client Components
- **Backend**: Next.js API Routes (proxy/wrapper) → Supabase Edge Functions
- **State Management**: React Context + Hooks (zustand si se requiere escalabilidad mayor)
- **Data Fetching**: React Query / SWR (opcional, según complejidad)

---

## 📁 Estructura del Proyecto

```
cuento-con-lili/
├── app/                                # Next.js App Router
│   ├── layout.tsx                      # Root layout con providers
│   ├── page.tsx                        # Home page
│   ├── api/                            # API Routes (proxies a Edge Functions)
│   │   ├── generate-story/
│   │   │   └── route.ts                # POST /api/generate-story
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── route.ts            # Auth callback
│   │   └── user-profile/
│   │       └── route.ts                # GET/PUT /api/user-profile
│   ├── story-genre/
│   │   └── page.tsx                    # Página selección de género
│   ├── story-moral/
│   │   └── page.tsx                    # Página selección de moraleja
│   ├── story-details-input/
│   │   └── page.tsx                    # Página detalles del cuento
│   └── my-stories/
│       └── page.tsx                    # Mis historias guardadas
│
├── components/                         # Componentes React (desacoplados)
│   ├── ui/                             # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   └── ...
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── MainLayout.tsx
│   ├── story/
│   │   ├── GenreSelector.tsx           # Selector de género (desacoplado)
│   │   ├── MoralSelector.tsx           # Selector de moraleja (desacoplado)
│   │   ├── StoryDetailsForm.tsx        # Formulario detalles (desacoplado)
│   │   └── StoryCard.tsx               # Card para lista de historias
│   └── common/
│       ├── LoadingSpinner.tsx
│       └── ErrorMessage.tsx
│
├── lib/                                # Utilities y configuración
│   ├── supabase/
│   │   ├── client.ts                   # Supabase client (browser)
│   │   ├── server.ts                   # Supabase client (server)
│   │   └── middleware.ts               # Auth middleware
│   ├── api/
│   │   ├── story.service.ts            # Story API calls
│   │   └── user.service.ts             # User API calls
│   ├── utils.ts                        # Utility functions
│   └── config.ts                       # App configuration
│
├── types/                              # TypeScript types
│   ├── story.types.ts
│   ├── user.types.ts
│   └── index.ts
│
├── hooks/                              # Custom React hooks
│   ├── useStoryGeneration.ts
│   ├── useUserProfile.ts
│   └── useAuth.ts
│
├── styles/                             # Estilos globales
│   └── globals.css
│
├── public/
│   └── assets/
│       ├── logo.png                    # Logo "Cuento con Lili"
│       └── background-app.png          # Background principal
│
├── .env.local                          # Variables de entorno
├── tailwind.config.ts                  # Tailwind config (tema personalizado)
├── next.config.ts                      # Next.js config
├── tsconfig.json                       # TypeScript config (strict)
└── package.json                        # pnpm dependencies
```

---

## 🎨 Diseño y Paleta de Colores

### Assets Disponibles
- **Logo**: `/public/assets/logo.png`
- **Background**: `/public/assets/background-app.png`

### Paleta de Colores (extraer del logo/background)
Analizar los assets para definir:
- **Primary**: Color principal del logo
- **Secondary**: Color secundario/acento
- **Background**: Colores suaves del fondo
- **Text**: Grises oscuros (#222) para legibilidad
- **Accent**: Colores complementarios para CTAs

### Configuración en Tailwind

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#YOUR_PRIMARY_COLOR',
          light: '#YOUR_LIGHT_PRIMARY',
          dark: '#YOUR_DARK_PRIMARY',
        },
        secondary: {
          DEFAULT: '#YOUR_SECONDARY_COLOR',
        },
        background: {
          DEFAULT: '#YOUR_BG_COLOR',
          light: '#YOUR_LIGHT_BG',
        },
        accent: '#YOUR_ACCENT_COLOR',
      },
      backgroundImage: {
        'app-pattern': "url('/assets/background-app.png')",
      },
    },
  },
  plugins: [],
};

export default config;
```

---

## 📄 Vistas a Implementar

### 1. Home (`app/page.tsx`)

**Descripción**: Página principal con dos opciones principales.

**Componentes**:
- `<Header />` - Logo y navegación
- `<MainMenu />` - Dos botones principales:
  - **"Generar Nueva Historia"** → Navega a `/story-genre`
  - **"Mis Historias"** → Navega a `/my-stories`
- `<Footer />` - Enlaces legales

**Características**:
- Fondo con `background-app.png`
- Diseño centrado, mobile-first
- Animaciones suaves (framer-motion)

---

### 2. Selección de Género (`app/story-genre/page.tsx`)

**Descripción**: Usuario selecciona el género del cuento.

**Componentes**:
- `<GenreSelector />` (desacoplado)
  - Props: `onSelect: (genre: string) => void`, `selectedGenre?: string`
  - Renderiza cards/opciones de géneros (Aventura, Fantasía, Ciencia Ficción, etc.)
- `<BackButton />` - Volver a Home
- `<NextButton />` - Continuar a `/story-moral` (deshabilitado si no hay selección)

**Estado**:
- Guardar selección en `localStorage` o context
- Validar selección antes de navegar

---

### 3. Selección de Moraleja (`app/story-moral/page.tsx`)

**Descripción**: Usuario selecciona la enseñanza/moraleja del cuento.

**Componentes**:
- `<MoralSelector />` (desacoplado)
  - Props: `onSelect: (moral: string) => void`, `selectedMoral?: string`
  - Input de texto o selección de opciones predefinidas
- `<BackButton />` - Volver a `/story-genre`
- `<NextButton />` - Continuar a `/story-details-input`

---

### 4. Detalles del Cuento (`app/story-details-input/page.tsx`)

**Descripción**: Usuario ingresa detalles adicionales para personalizar el cuento.

**Componentes**:
- `<StoryDetailsForm />` (desacoplado)
  - Props: `onSubmit: (details: StoryDetails) => void`
  - Campos:
    - Nombre del personaje principal
    - Edad del niño/a (para adaptar complejidad)
    - Detalles adicionales (textarea libre)
- `<BackButton />` - Volver a `/story-moral`
- `<GenerateButton />` - Botón principal "Generar Historia"

**Flujo al Generar**:
1. Recopilar datos de todos los pasos (género, moraleja, detalles)
2. Llamar a `/api/generate-story` (API Route)
3. Mostrar loading state (spinner/animación)
4. Al completar, navegar a vista de historia generada (futura implementación)

---

### 5. Mis Historias (`app/my-stories/page.tsx`)

**Descripción**: Lista de historias guardadas del usuario.

**Componentes**:
- `<StoryCard />` (desacoplado)
  - Props: `story: Story`, `onClick: () => void`
  - Muestra título, fecha, preview del contenido
- `<EmptyState />` - Si no hay historias guardadas
- `<BackButton />` - Volver a Home

**Funcionalidad**:
- Fetch historias desde Supabase (via API Route o directo)
- Implementar paginación/scroll infinito (opcional)

---

## 🔌 Integración con Supabase Edge Functions

### ⚠️ IMPORTANTE: Edge Functions Ya Existentes

Las **Edge Functions ya están implementadas y probadas** en el proyecto actual (TaleMe). **NO necesitamos recrearlas**, solo invocarlas desde las API Routes de Next.js adaptando la marca y el flujo.

### Edge Functions Disponibles

| Edge Function | Descripción | Estado |
|--------------|-------------|--------|
| `generate-story` | Genera cuento completo con scenes | ✅ Listo para usar |
| `generate-image` | Genera imagen individual | ✅ Listo para usar |
| `generate-audio` | Genera narración TTS | ✅ Listo para usar |
| `story-continuation` | Genera continuación de historia | ✅ Listo para usar |
| `challenge` | Genera desafíos educativos | ✅ Listo para usar |

**Ubicación**: `/supabase/functions/` en el proyecto actual

### Flujo de Comunicación

```
Client (Next.js) → API Route (/api/*) → Supabase Edge Function (existente) → OpenAI/Gemini → Response
                      ↓
                 Adaptación de marca
                 Validación adicional
                 Logging unificado
```

### Ventajas de API Routes como Proxy

1. **Seguridad**: No exponer URL de Edge Functions al cliente
2. **Middleware**: Validación, auth, rate limiting
3. **Transformación**: Adaptar datos antes/después de llamar Edge Function
4. **Logging**: Centralizar logs de requests
5. **Branding**: Adaptar respuestas a la nueva marca sin modificar Edge Functions

### Ejemplo: `/api/generate-story/route.ts`

```typescript
// app/api/generate-story/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { StoryGenerationRequest, StoryGenerationResponse } from '@/types/story.types';

/**
 * API Route para generación de historias - Invoca Edge Function existente
 * @param {NextRequest} request - POST request with story generation parameters
 * @returns {NextResponse<StoryGenerationResponse>} - Generated story data
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Validate authentication
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse and validate request body
    const body: StoryGenerationRequest = await request.json();
    
    // Validation logic
    if (!body.genre || !body.moral) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validar campos específicos
    if (body.characterName && body.characterName.length > 50) {
      return NextResponse.json({ error: 'Character name too long' }, { status: 400 });
    }

    console.log('[Cuento con Lili] Generating story for user:', user.id, {
      genre: body.genre,
      moral: body.moral,
    });

    // 3. ⭐ LLAMADA A EDGE FUNCTION EXISTENTE ⭐
    // La Edge Function "generate-story" ya existe en /supabase/functions/generate-story/
    // Solo la invocamos con los parámetros correctos
    const { data, error } = await supabase.functions.invoke('generate-story', {
      body: {
        options: {
          genre: body.genre,
          moral: body.moral,
          character: {
            name: body.characterName,
            characterType: body.characterType || 'Humano',
            personality: body.personality,
            hobbies: body.hobbies || [],
            profession: body.profession,
          },
          duration: body.duration || 'medium',
        },
        language: body.language || 'Español',
        childAge: body.childAge,
        specialNeed: body.specialNeed || 'Ninguna',
        additionalDetails: body.additionalDetails,
      },
    });

    if (error) {
      console.error('[Cuento con Lili] Edge Function error:', error);
      return NextResponse.json({ 
        error: 'Story generation failed',
        details: error.message 
      }, { status: 500 });
    }

    // 4. Validar respuesta de Edge Function
    if (!data || !data.title || !data.content || !data.scenes) {
      console.error('[Cuento con Lili] Invalid response from Edge Function:', data);
      return NextResponse.json({ 
        error: 'Invalid story data received' 
      }, { status: 500 });
    }

    // 5. Guardar en base de datos (la Edge Function retorna los datos, nosotros los guardamos)
    const storyId = `story_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const storyData = {
      id: storyId,
      user_id: user.id,
      title: data.title,
      content: data.content,
      scenes: data.scenes, // JSON con prompts para imágenes
      options: {
        genre: body.genre,
        moral: body.moral,
        characters: [{
          id: `char_${Date.now()}`,
          name: body.characterName,
          characterType: body.characterType || 'Humano',
          personality: body.personality,
          hobbies: body.hobbies || [],
          profession: body.profession || '',
          description: '',
        }],
        duration: body.duration || 'medium',
        language: body.language || 'Español',
        userProvidedContext: body.additionalDetails,
      },
      created_at: new Date().toISOString(),
    };

    const { error: dbError } = await supabase.from('stories').insert(storyData);
    
    if (dbError) {
      console.error('[Cuento con Lili] Database error:', dbError);
      // No retornamos error, la historia se generó correctamente
      // Solo loggeamos el problema de persistencia
    }

    console.log('[Cuento con Lili] Story generated successfully:', storyId);

    // 6. Return response adaptado a nueva marca
    return NextResponse.json({
      success: true,
      story: {
        id: storyId,
        title: data.title,
        content: data.content,
        scenes: data.scenes,
        createdAt: new Date().toISOString(),
      },
      message: '¡Tu cuento mágico está listo! 🎉',
    });

  } catch (error) {
    console.error('[Cuento con Lili] API Route error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: 'Hubo un problema generando tu cuento. Por favor intenta de nuevo.' 
    }, { status: 500 });
  }
}
```

### Otras API Routes a Implementar

#### `/api/user-profile/route.ts` - Gestión de perfil

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET - Obtener perfil del usuario
 */
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}

/**
 * PUT - Actualizar perfil del usuario
 */
export async function PUT(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      ...body,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

#### `/api/stories/route.ts` - Listar historias

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET - Obtener todas las historias del usuario
 */
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ stories: data });
}
```

#### `/api/stories/[id]/route.ts` - Gestionar historia individual

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET - Obtener historia por ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Story not found' }, { status: 404 });
  }

  return NextResponse.json({ story: data });
}

/**
 * DELETE - Eliminar historia
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('stories')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

---

## 📦 Tipos TypeScript

### `types/story.types.ts`

```typescript
export type StoryDuration = 'short' | 'medium' | 'long';

export interface StoryCharacter {
  id: string;
  name: string;
  characterType?: string;
  personality?: string;
  hobbies?: string[];
  profession?: string;
}

export interface StoryOptions {
  genre: string;
  moral: string;
  character: StoryCharacter;
  duration: StoryDuration;
  language?: string;
  additionalDetails?: string;
}

export interface StoryScenes {
  character: string;
  cover: string;
  scene_1: string;
  scene_2: string;
  scene_3: string;
  scene_4: string;
  closing: string;
}

export interface Story {
  id: string;
  userId: string;
  title: string;
  content: string;
  options: StoryOptions;
  scenes?: StoryScenes;
  audioUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface StoryGenerationRequest {
  genre: string;
  moral: string;
  characterName: string;
  childAge?: number;
  specialNeed?: string;
  language?: string;
  duration?: StoryDuration;
  additionalDetails?: string;
}

export interface StoryGenerationResponse {
  success: boolean;
  story?: {
    title: string;
    content: string;
    scenes: StoryScenes;
  };
  error?: string;
}
```

### `types/user.types.ts`

```typescript
export interface UserProfile {
  id: string;
  email: string;
  childAge?: number;
  specialNeed?: string;
  language: string;
  hasCompletedSetup: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

## 🪝 Custom Hooks

### `hooks/useStoryGeneration.ts`

```typescript
import { useState } from 'react';
import { StoryGenerationRequest, StoryGenerationResponse } from '@/types/story.types';

/**
 * Custom hook for story generation logic
 * @returns {object} - generateStory function, loading state, error state, story data
 */
export function useStoryGeneration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [story, setStory] = useState<StoryGenerationResponse['story'] | null>(null);

  const generateStory = async (params: StoryGenerationRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error('Failed to generate story');
      }

      const data: StoryGenerationResponse = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setStory(data.story || null);
      return data.story;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { generateStory, loading, error, story };
}
```

---

## 🛠️ Servicios (Capa de Abstracción)

### `lib/api/story.service.ts`

```typescript
import { createClient } from '@/lib/supabase/client';
import { Story, StoryGenerationRequest } from '@/types/story.types';

/**
 * Service for story-related API operations
 */
export class StoryService {
  private supabase = createClient();

  /**
   * Fetch all stories for current user
   * @returns {Promise<Story[]>} - List of user stories
   */
  async getUserStories(): Promise<Story[]> {
    const { data, error } = await this.supabase
      .from('stories')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Fetch single story by ID
   * @param {string} storyId - Story ID
   * @returns {Promise<Story>} - Story data
   */
  async getStoryById(storyId: string): Promise<Story> {
    const { data, error } = await this.supabase
      .from('stories')
      .select('*')
      .eq('id', storyId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete story by ID
   * @param {string} storyId - Story ID
   */
  async deleteStory(storyId: string): Promise<void> {
    const { error } = await this.supabase
      .from('stories')
      .delete()
      .eq('id', storyId);

    if (error) throw error;
  }

  /**
   * Generate new story via API Route
   * @param {StoryGenerationRequest} params - Generation parameters
   * @returns {Promise<Story>} - Generated story
   */
  async generateStory(params: StoryGenerationRequest): Promise<Story> {
    const response = await fetch('/api/generate-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error('Failed to generate story');
    }

    const data = await response.json();
    return data.story;
  }
}

export const storyService = new StoryService();
```

---

## 🧩 Componentes Desacoplados

### Principios de Diseño

1. **Single Responsibility**: Cada componente tiene una única responsabilidad
2. **Props Interface**: Interfaces TypeScript claras para todas las props
3. **No Side Effects**: Componentes puros, lógica en hooks/services
4. **Composabilidad**: Componentes pequeños que se componen
5. **Accessibility**: ARIA labels, keyboard navigation

### Ejemplo: `GenreSelector.tsx`

```typescript
// components/story/GenreSelector.tsx
import { useState } from 'react';

/**
 * Genre option interface
 */
export interface GenreOption {
  id: string;
  label: string;
  icon?: string;
  description?: string;
}

/**
 * Props for GenreSelector component
 */
interface GenreSelectorProps {
  genres: GenreOption[];
  selectedGenreId?: string;
  onSelect: (genreId: string) => void;
  disabled?: boolean;
}

/**
 * GenreSelector - Desacoplado component para selección de género
 * @param {GenreSelectorProps} props
 */
export function GenreSelector({ 
  genres, 
  selectedGenreId, 
  onSelect, 
  disabled = false 
}: GenreSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {genres.map((genre) => (
        <button
          key={genre.id}
          onClick={() => onSelect(genre.id)}
          disabled={disabled}
          className={`
            p-6 rounded-lg border-2 transition-all
            ${selectedGenreId === genre.id 
              ? 'border-primary bg-primary/10' 
              : 'border-gray-200 hover:border-primary/50'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          aria-pressed={selectedGenreId === genre.id}
        >
          {genre.icon && <span className="text-4xl mb-2">{genre.icon}</span>}
          <h3 className="font-semibold text-lg">{genre.label}</h3>
          {genre.description && (
            <p className="text-sm text-gray-600 mt-1">{genre.description}</p>
          )}
        </button>
      ))}
    </div>
  );
}
```

### Ejemplo de Uso

```typescript
// app/story-genre/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GenreSelector, GenreOption } from '@/components/story/GenreSelector';

const GENRES: GenreOption[] = [
  { id: 'adventure', label: 'Aventura', icon: '🏔️', description: 'Viajes y exploración' },
  { id: 'fantasy', label: 'Fantasía', icon: '🧙‍♂️', description: 'Mundos mágicos' },
  { id: 'scifi', label: 'Ciencia Ficción', icon: '🚀', description: 'Futuro y tecnología' },
];

export default function StoryGenrePage() {
  const router = useRouter();
  const [selectedGenre, setSelectedGenre] = useState<string>();

  const handleNext = () => {
    if (selectedGenre) {
      // Guardar en localStorage o context
      localStorage.setItem('story-genre', selectedGenre);
      router.push('/story-moral');
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Elige el género del cuento</h1>
      
      <GenreSelector
        genres={GENRES}
        selectedGenreId={selectedGenre}
        onSelect={setSelectedGenre}
      />

      <div className="mt-8 flex justify-between">
        <button onClick={() => router.back()}>Atrás</button>
        <button 
          onClick={handleNext}
          disabled={!selectedGenre}
          className="bg-primary text-white px-6 py-2 rounded-lg disabled:opacity-50"
        >
          Siguiente
        </button>
      </div>
    </main>
  );
}
```

---

## ⚙️ Configuración Inicial

### 1. Instalación

```bash
cd cuento-con-lili
pnpm install
```

### 2. Variables de Entorno (`.env.local`)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# App Config
NEXT_PUBLIC_APP_NAME="Cuento con Lili"
NEXT_PUBLIC_APP_VERSION=1.0.0

# Features Flags
NEXT_PUBLIC_ENABLE_PAYMENT=false
NEXT_PUBLIC_ENABLE_AUDIO=false
```

### 3. Supabase Client Setup

```typescript
// lib/supabase/client.ts (browser)
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

```typescript
// lib/supabase/server.ts (server-side)
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
}
```

### 4. Iniciar Desarrollo

```bash
pnpm dev
```

---

## 🔐 Autenticación (Supabase Auth)

### Middleware para Rutas Protegidas

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Rutas protegidas
  const protectedRoutes = ['/story-genre', '/story-moral', '/story-details-input', '/my-stories'];
  const isProtectedRoute = protectedRoutes.some(route => request.nextUrl.pathname.startsWith(route));

  if (isProtectedRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

## 🚀 Flujo Completo de Generación de Historia

### Diagrama de Flujo

```
1. Usuario en Home → Click "Generar Nueva Historia"
   ↓
2. /story-genre → Selecciona género (ej: Aventura) → localStorage
   ↓
3. /story-moral → Selecciona moraleja (ej: Amistad) → localStorage
   ↓
4. /story-details-input → Ingresa nombre, edad, detalles → Click "Generar"
   ↓
5. API Route /api/generate-story
   ↓
6. Supabase Edge Function "generate-story"
   ↓
7. OpenAI/Gemini genera cuento + scenes
   ↓
8. Guarda en DB (tabla stories)
   ↓
9. Retorna a cliente
   ↓
10. Redirige a vista de historia generada (futura)
```

### Implementación en `/story-details-input/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStoryGeneration } from '@/hooks/useStoryGeneration';
import { StoryDetailsForm } from '@/components/story/StoryDetailsForm';

export default function StoryDetailsInputPage() {
  const router = useRouter();
  const { generateStory, loading, error } = useStoryGeneration();

  const handleSubmit = async (details: any) => {
    // Recuperar datos previos
    const genre = localStorage.getItem('story-genre');
    const moral = localStorage.getItem('story-moral');

    if (!genre || !moral) {
      alert('Faltan datos. Vuelve a los pasos anteriores.');
      return;
    }

    try {
      const story = await generateStory({
        genre,
        moral,
        characterName: details.characterName,
        childAge: details.childAge,
        additionalDetails: details.additionalDetails,
        language: 'Español',
        duration: 'medium',
      });

      // Limpiar localStorage
      localStorage.removeItem('story-genre');
      localStorage.removeItem('story-moral');

      // Navegar a historia generada
      router.push(`/story/${story.id}`);
    } catch (err) {
      console.error('Error generando historia:', err);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Detalles del Cuento</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <StoryDetailsForm onSubmit={handleSubmit} disabled={loading} />

      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-center">Generando tu historia mágica...</p>
          </div>
        </div>
      )}
    </main>
  );
}
```

---

## 📋 Buenas Prácticas Aplicadas

### SOLID Principles

1. **Single Responsibility**: Cada componente/servicio tiene una única responsabilidad
2. **Open/Closed**: Componentes extensibles mediante props, sin modificar internamente
3. **Liskov Substitution**: Interfaces consistentes, componentes intercambiables
4. **Interface Segregation**: Props específicas, no interfaces gigantes
5. **Dependency Injection**: Servicios inyectados via props/context

### Clean Code

- Nombres descriptivos (no abreviaciones)
- Funciones < 50 líneas
- Comentarios TSDoc en funciones públicas
- Sin código muerto
- Imports organizados (externos → internos → locales)

### Clean Architecture

```
Presentación (Components/Pages)
        ↓
Aplicación (Hooks/Services)
        ↓
Dominio (Types/Interfaces)
        ↓
Infraestructura (Supabase/API)
```

### Accesibilidad (a11y)

- Semantic HTML
- ARIA labels
- Keyboard navigation
- Focus management
- Contraste de colores (WCAG AA)

### Performance

- React Server Components por defecto
- Client Components solo donde sea necesario (`'use client'`)
- Lazy loading de componentes pesados
- Optimización de imágenes (Next.js Image)
- Memoización selectiva (`useMemo`, `useCallback`)

---

## 🧪 Testing (Opcional - Fase Futura)

### Setup Recomendado

- **Unit Tests**: Vitest
- **Integration Tests**: Testing Library
- **E2E Tests**: Playwright

### Ejemplo de Test

```typescript
// components/story/GenreSelector.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { GenreSelector } from './GenreSelector';

describe('GenreSelector', () => {
  const mockGenres = [
    { id: 'adventure', label: 'Aventura', icon: '🏔️' },
    { id: 'fantasy', label: 'Fantasía', icon: '🧙‍♂️' },
  ];

  it('renders all genres', () => {
    render(<GenreSelector genres={mockGenres} onSelect={() => {}} />);
    expect(screen.getByText('Aventura')).toBeInTheDocument();
    expect(screen.getByText('Fantasía')).toBeInTheDocument();
  });

  it('calls onSelect when genre is clicked', () => {
    const handleSelect = vi.fn();
    render(<GenreSelector genres={mockGenres} onSelect={handleSelect} />);
    
    fireEvent.click(screen.getByText('Aventura'));
    expect(handleSelect).toHaveBeenCalledWith('adventure');
  });
});
```

---

## 📝 Checklist de Implementación

### Fase 1: Setup Base
- [ ] Crear proyecto Next.js con `create-next-app`
- [ ] Instalar dependencias (`pnpm install`)
- [ ] Configurar Tailwind CSS
- [ ] Extraer colores de assets y configurar theme
- [ ] Configurar TypeScript (strict mode)
- [ ] Setup Supabase clients (browser/server)

### Fase 2: Estructura
- [ ] Crear estructura de carpetas
- [ ] Definir tipos TypeScript (`types/`)
- [ ] Crear servicios base (`lib/api/`)
- [ ] Configurar variables de entorno

### Fase 3: UI Components
- [ ] Implementar `<Header />` y `<Footer />`
- [ ] Crear componentes UI base (Button, Card, Input)
- [ ] Implementar `<GenreSelector />`
- [ ] Implementar `<MoralSelector />`
- [ ] Implementar `<StoryDetailsForm />`
- [ ] Implementar `<StoryCard />`

### Fase 4: Pages
- [ ] Implementar Home (`app/page.tsx`)
- [ ] Implementar `/story-genre`
- [ ] Implementar `/story-moral`
- [ ] Implementar `/story-details-input`
- [ ] Implementar `/my-stories`

### Fase 5: Backend Integration
- [ ] Crear API Route `/api/generate-story`
- [ ] Crear API Route `/api/user-profile`
- [ ] Implementar custom hooks (`useStoryGeneration`, etc.)
- [ ] Configurar middleware de autenticación

### Fase 6: Integración con Edge Functions Existentes
- [ ] ⚠️ **NO CREAR Edge Functions nuevas** - ya existen en `/supabase/functions/`
- [ ] Verificar que Edge Function `generate-story` esté desplegada en Supabase
- [ ] Verificar secrets en Supabase (`GEMINI_API_KEY`, `OPENAI_API_KEY`)
- [ ] Probar Edge Function desde Next.js API Route
- [ ] Documentar estructura de payload y response esperados

### Fase 7: Testing & Polish
- [ ] Testing manual de flujo completo
- [ ] Responsive design (mobile/tablet/desktop)
- [ ] Optimización de performance
- [ ] Accesibilidad (a11y audit)

---

## 🔗 Referencias del Proyecto Actual

### ⭐ Edge Functions Existentes (Reutilizar)

**Ubicación**: `/Users/ivanogarcia/Projects/Cuenta-Cuentos-Definitivo/supabase/functions/`

| Edge Function | Archivo | Descripción | Estado |
|--------------|---------|-------------|--------|
| `generate-story` | `/supabase/functions/generate-story/index.ts` | Genera cuento completo con scenes (OpenAI/Gemini) | ✅ Producción |
| `generate-image` | `/supabase/functions/generate-image/index.ts` | Genera imagen individual con OpenAI/Imagen | ✅ Producción |
| `generate-audio` | `/supabase/functions/generate-audio/index.ts` | Genera audio TTS | ✅ Producción |
| `story-continuation` | `/supabase/functions/story-continuation/index.ts` | Genera continuaciones de historia | ✅ Producción |
| `challenge` | `/supabase/functions/challenge/index.ts` | Genera desafíos educativos | ✅ Producción |
| `upload-story-image` | `/supabase/functions/upload-story-image/index.ts` | Sube imagen a Supabase Storage | ✅ Producción |

**⚠️ IMPORTANTE**: Estas funciones **NO deben modificarse ni recrearse**. El proyecto "Cuento con Lili" las invocará desde sus API Routes de Next.js.

### Archivos Clave a Consultar

- **Edge Functions**: `/supabase/functions/` (ver lista arriba)
- **Prompts de AI**: `/supabase/functions/generate-story/prompt.ts`
- **Tipos**: `/src/types/index.ts`
- **Servicios**: `/src/services/supabase.ts`
- **Documentación**: 
  - `/docs/NUEVA_IMPLEMENTACION_CUENTOS.md` - Arquitectura de generación de cuentos
  - `/docs/EDGE_FUNCTIONS.md` - Documentación detallada de cada Edge Function
  - `/docs/supabase_tables.sql` - Schema de base de datos

### Schemas de Supabase (Reutilizar)

Las tablas ya existen y están configuradas:

- **`profiles`**: Perfiles de usuario con configuración
- **`stories`**: Historias generadas (incluye columna `scenes` JSONB)
- **`story_chapters`**: Capítulos de continuación de historias
- **`challenges`**: Desafíos educativos
- **Storage Buckets**: `story-images`, `story-audio`

### Funcionalidades a Reutilizar (Sin Modificar)

1. ✅ **Edge Function `generate-story`**: Ya implementada, probada y en producción
2. ✅ **Edge Function `generate-image`**: Para ilustraciones (fase futura MVP)
3. ✅ **Edge Function `generate-audio`**: Para narración (fase futura MVP)
4. ✅ **Tipos TypeScript**: `Story`, `StoryOptions`, `StoryScenes`
5. ✅ **Estructura de datos**: Schemas de Supabase
6. ✅ **Prompts de AI**: Optimizados en `/supabase/functions/generate-story/prompt.ts`

### Funcionalidades Nuevas en "Cuento con Lili"

1. ✨ **Flujo simplificado**: Solo 4 vistas principales (vs 20+ en TaleMe)
2. ✨ **Nueva marca**: Identidad visual "Cuento con Lili"
3. ✨ **Arquitectura Next.js**: App Router + React Server Components (vs React + Vite)
4. ✨ **API Routes como proxy**: Capa adicional de seguridad y branding
5. ✨ **UX simplificada**: Enfocado en experiencia de generación de cuentos
6. ✨ **Mobile-first**: Diseño optimizado para dispositivos móviles

### Cómo Invocar Edge Functions desde Next.js

```typescript
// Desde API Route de Next.js
import { createClient } from '@/lib/supabase/server';

const supabase = createClient();

// Invocar Edge Function existente
const { data, error } = await supabase.functions.invoke('generate-story', {
  body: {
    options: { /* ... */ },
    language: 'Español',
    childAge: 7,
    specialNeed: 'Ninguna',
    additionalDetails: 'Detalles adicionales...'
  }
});

// La Edge Function retorna:
// {
//   title: string,
//   content: string,
//   scenes: {
//     character: string,
//     cover: string,
//     scene_1: string,
//     scene_2: string,
//     scene_3: string,
//     scene_4: string,
//     closing: string
//   }
// }
```

---

## 📡 Guía de Referencia: Edge Functions Existentes

### 1. `generate-story` - Generación de Cuento Completo

**Endpoint**: `supabase.functions.invoke('generate-story', { body })`

**Request Body**:
```typescript
{
  options: {
    genre: string;              // Ej: "Aventura", "Fantasía", "Ciencia Ficción"
    moral: string;              // Ej: "La importancia de la amistad"
    character: {
      name: string;             // Nombre del personaje principal
      characterType?: string;   // Ej: "Humano", "Animal", "Robot"
      personality?: string;     // Ej: "Valiente", "Tímido", "Curioso"
      hobbies?: string[];       // Ej: ["Leer", "Explorar"]
      profession?: string;      // Ej: "Explorador", "Científico"
    };
    duration: 'short' | 'medium' | 'long';  // Longitud del cuento
  };
  language: string;             // Ej: "Español", "English"
  childAge: number;             // Edad del niño (adapta complejidad)
  specialNeed?: string;         // Ej: "TEA", "TDAH", "Dislexia", "Ninguna"
  additionalDetails?: string;   // Detalles adicionales opcionales
}
```

**Response**:
```typescript
{
  title: string;        // Título generado por AI
  content: string;      // Texto completo del cuento (formateado)
  scenes: {
    character: string;  // Descripción visual del personaje
    cover: string;      // Prompt para imagen de portada
    scene_1: string;    // Prompt para escena 1
    scene_2: string;    // Prompt para escena 2
    scene_3: string;    // Prompt para escena 3
    scene_4: string;    // Prompt para escena 4
    closing: string;    // Prompt para imagen de cierre
  }
}
```

**Uso desde Next.js**:
```typescript
// app/api/generate-story/route.ts
const { data, error } = await supabase.functions.invoke('generate-story', {
  body: {
    options: {
      genre: body.genre,
      moral: body.moral,
      character: {
        name: body.characterName,
        characterType: body.characterType || 'Humano',
      },
      duration: 'medium',
    },
    language: 'Español',
    childAge: body.childAge || 7,
    specialNeed: body.specialNeed || 'Ninguna',
    additionalDetails: body.additionalDetails,
  }
});
```

---

### 2. `generate-image` - Generación de Imagen Individual

**Endpoint**: `supabase.functions.invoke('generate-image', { body })`

**Request Body**:
```typescript
{
  prompt: string;           // Prompt detallado para la imagen
  storyId: string;          // ID de la historia
  imageType: string;        // Ej: "cover", "scene_1", "scene_2", etc.
  characterDescription?: string;  // Descripción del personaje para consistencia
}
```

**Response**:
```typescript
{
  imageUrl: string;         // URL de la imagen generada
  imageType: string;        // Tipo de imagen generada
  storyId: string;          // ID de la historia
}
```

**Uso desde Next.js** (fase futura - post-MVP):
```typescript
// app/api/generate-image/route.ts
const { data, error } = await supabase.functions.invoke('generate-image', {
  body: {
    prompt: scenes.cover,  // Prompt desde la historia generada
    storyId: storyId,
    imageType: 'cover',
    characterDescription: scenes.character,
  }
});
```

---

### 3. `story-continuation` - Continuación de Historia

**Endpoint**: `supabase.functions.invoke('story-continuation', { body })`

**Request Body**:
```typescript
{
  action: 'generateOptions' | 'freeContinuation' | 'optionContinuation' | 'directedContinuation';
  story: {
    id: string;
    title: string;
    content: string;
    options: StoryOptions;
  };
  chapters?: StoryChapter[];  // Capítulos existentes
  selectedOption?: number;    // Si action es 'optionContinuation'
  customDirection?: string;   // Si action es 'directedContinuation'
}
```

**Response**:
```typescript
// Para 'generateOptions':
{
  options: [
    { summary: string },
    { summary: string },
    { summary: string }
  ]
}

// Para continuaciones:
{
  content: string;  // Contenido del nuevo capítulo
}
```

---

### 4. `challenge` - Generación de Desafíos Educativos

**Endpoint**: `supabase.functions.invoke('challenge', { body })`

**Request Body**:
```typescript
{
  action: 'createChallenge' | 'getLanguages';
  story: Story;
  category: 'language' | 'math' | 'comprehension';
  profileSettings: {
    childAge: number;
    specialNeed: string;
    language: string;
  };
  targetLanguage?: string;  // Para desafíos de idioma
}
```

**Response**:
```typescript
{
  id: string;
  storyId: string;
  questions: [
    {
      id: string;
      category: string;
      question: string;
      options: string[];
      correctOptionIndex: number;
      explanation: string;
      targetLanguage?: string;
    }
  ];
  createdAt: string;
}
```

---

### 5. `upload-story-image` - Subir Imagen a Storage

**Endpoint**: `supabase.functions.invoke('upload-story-image', { body })`

**Request Body**:
```typescript
{
  storyId: string;
  imageData: string;    // Base64 encoded image
  imageType: string;    // Ej: "cover", "scene_1"
}
```

**Response**:
```typescript
{
  publicUrl: string;    // URL pública de la imagen
  path: string;         // Path en Storage
}
```

---

## 🔍 Verificación de Edge Functions

### Comandos Útiles

```bash
# Listar Edge Functions desplegadas
supabase functions list

# Ver logs de una Edge Function
supabase functions logs generate-story

# Invocar Edge Function desde CLI (testing)
supabase functions invoke generate-story \
  --body '{"options":{"genre":"Aventura","moral":"Amistad","character":{"name":"Leo"},"duration":"medium"},"language":"Español","childAge":7}'

# Verificar secrets configurados
supabase secrets list
```

### Verificar desde Supabase Dashboard

1. Ve a tu proyecto en Supabase
2. Edge Functions → Functions
3. Verifica que las siguientes funciones estén desplegadas:
   - `generate-story` ✅
   - `generate-image` ✅
   - `generate-audio` ✅
   - `story-continuation` ✅
   - `challenge` ✅
   - `upload-story-image` ✅

4. Settings → Secrets
5. Verifica que existan:
   - `GEMINI_API_KEY` ✅
   - `OPENAI_API_KEY` ✅

---

## 🛡️ Manejo de Errores en API Routes

### Template de Error Handling

```typescript
// app/api/[endpoint]/route.ts
try {
  // 1. Auth validation
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return NextResponse.json({ 
      error: 'Unauthorized',
      code: 'AUTH_REQUIRED' 
    }, { status: 401 });
  }

  // 2. Input validation
  const body = await request.json();
  if (!body.requiredField) {
    return NextResponse.json({ 
      error: 'Missing required field',
      code: 'VALIDATION_ERROR',
      field: 'requiredField'
    }, { status: 400 });
  }

  // 3. Edge Function invocation
  const { data, error } = await supabase.functions.invoke('edge-function-name', {
    body: { /* ... */ }
  });

  if (error) {
    console.error('[Cuento con Lili] Edge Function error:', error);
    return NextResponse.json({ 
      error: 'Operation failed',
      code: 'EDGE_FUNCTION_ERROR',
      details: error.message 
    }, { status: 500 });
  }

  // 4. Response validation
  if (!data || !data.expectedField) {
    return NextResponse.json({ 
      error: 'Invalid response',
      code: 'INVALID_RESPONSE' 
    }, { status: 500 });
  }

  // 5. Success response
  return NextResponse.json({
    success: true,
    data: data,
    message: '¡Operación exitosa! 🎉'
  });

} catch (error) {
  console.error('[Cuento con Lili] Unexpected error:', error);
  return NextResponse.json({ 
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    message: 'Algo salió mal. Por favor intenta de nuevo.'
  }, { status: 500 });
}
```

---

## 📊 Logging y Monitoreo

### Estructura de Logs

```typescript
// Usar prefijo consistente para filtrar logs
console.log('[Cuento con Lili]', 'message', { context });
console.error('[Cuento con Lili] ERROR:', error, { context });
console.warn('[Cuento con Lili] WARNING:', warning);

// Ejemplos:
console.log('[Cuento con Lili] Story generation started:', {
  userId: user.id,
  genre: body.genre,
  moral: body.moral,
  timestamp: new Date().toISOString(),
});

console.log('[Cuento con Lili] Edge Function invoked:', {
  function: 'generate-story',
  duration: `${Date.now() - startTime}ms`,
});

console.error('[Cuento con Lili] Edge Function failed:', {
  function: 'generate-story',
  error: error.message,
  userId: user.id,
  timestamp: new Date().toISOString(),
});
```

---

## 🚧 Consideraciones de Escalabilidad

### Estado Global (si se necesita)

Si el proyecto crece y necesitas estado global más complejo:

```typescript
// store/storyStore.ts (con Zustand)
import { create } from 'zustand';
import { Story } from '@/types/story.types';

interface StoryStore {
  currentStory: Story | null;
  stories: Story[];
  setCurrentStory: (story: Story) => void;
  addStory: (story: Story) => void;
  removeStory: (id: string) => void;
}

export const useStoryStore = create<StoryStore>((set) => ({
  currentStory: null,
  stories: [],
  setCurrentStory: (story) => set({ currentStory: story }),
  addStory: (story) => set((state) => ({ stories: [...state.stories, story] })),
  removeStory: (id) => set((state) => ({ 
    stories: state.stories.filter(s => s.id !== id) 
  })),
}));
```

### Data Fetching (React Query)

Si necesitas caching y sincronización automática:

```typescript
// hooks/useStories.ts
import { useQuery } from '@tanstack/react-query';
import { storyService } from '@/lib/api/story.service';

export function useStories() {
  return useQuery({
    queryKey: ['stories'],
    queryFn: () => storyService.getUserStories(),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}
```

---

## 🎯 Objetivos de Calidad

### Performance Targets
- **Lighthouse Score**: > 90 en todas las métricas
- **FCP (First Contentful Paint)**: < 1.5s
- **TTI (Time to Interactive)**: < 3s

### Accessibility Targets
- **WCAG Level**: AA compliance
- **Screen Reader**: Totalmente navegable
- **Keyboard Navigation**: 100% accesible

### Code Quality Targets
- **TypeScript**: 0 errores, 0 `any`
- **ESLint**: 0 warnings
- **Test Coverage**: > 80% (cuando se implemente testing)

---

## 📞 Soporte y Documentación

### Si necesitas ayuda durante la implementación:

1. **Consultar archivos del proyecto actual** en `/Users/ivanogarcia/Projects/Cuenta-Cuentos-Definitivo/`
2. **Revisar documentación** en `/docs/`
3. **Verificar Edge Functions** en `/supabase/functions/`
4. **Consultar tipos** en `/src/types/index.ts`

---

## ✅ Criterios de Aceptación

El proyecto estará completo cuando:

1. ✅ Usuario puede navegar por las 4 vistas principales
2. ✅ Formulario completo genera historia llamando a Edge Function
3. ✅ Historias se guardan en Supabase
4. ✅ Usuario puede ver lista de historias en "Mis Historias"
5. ✅ Diseño responsive (mobile-first)
6. ✅ Autenticación funcional con Supabase Auth
7. ✅ 0 errores de TypeScript
8. ✅ Código cumple principios SOLID y Clean Code
9. ✅ Componentes completamente desacoplados
10. ✅ Accesibilidad básica implementada (a11y)

---

## 🚀 Próximos Pasos (Post-MVP)

Funcionalidades a agregar en futuras fases:

1. **Visualización de historia completa** (con animaciones)
2. **Generación de imágenes** (ilustraciones del cuento)
3. **Generación de audio** (narración con TTS)
4. **Generación de PDF** (libro ilustrado descargable)
5. **Sistema de desafíos educativos** (preguntas sobre el cuento)
6. **Continuación de historias** (capítulos adicionales)
7. **Gestión de personajes** (crear y guardar personajes personalizados)
8. **Sistema de suscripciones** (Stripe integration)
9. **Compartir historias** (redes sociales, link público)
10. **Modo offline** (PWA, Service Workers)

---

**Fin del documento de instrucciones** 📚✨

*Última actualización: Noviembre 2025*
*Versión: 1.0*

