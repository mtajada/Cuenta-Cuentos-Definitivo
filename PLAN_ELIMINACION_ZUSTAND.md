# Plan Detallado: Eliminación Completa de Zustand Store

## 📊 Análisis del Estado Actual

### Estructura de Stores Identificada

#### 🏗️ Stores Principales (7 stores)
```
src/store/
├── character/
│   ├── characterStore.ts          # 391 líneas - CRUD personajes + validaciones
│   └── characterValidation.ts     # Validaciones de selección múltiple
├── stories/
│   ├── storiesStore.ts            # 91 líneas - Gestión historias principales
│   ├── chapters/
│   │   └── chaptersStore.ts       # Gestión capítulos por historia
│   ├── challenges/
│   │   └── challengesStore.ts     # Gestión desafíos educativos
│   ├── audio/
│   │   └── audioStore.ts          # Cache de audio + estados de generación
│   └── storyGenerator.ts          # Lógica de generación
├── storyOptions/
│   └── storyOptionsStore.ts       # Opciones temporales para creación
├── user/
│   └── userStore.ts               # 281 líneas - Auth + perfil + suscripciones
├── core/
│   ├── createStore.ts             # 131 líneas - Factory de stores con persistencia
│   └── utils.ts                   # Utilidades para stores
├── types/
│   └── storeTypes.ts              # 147 líneas - Tipos TypeScript
└── index.ts                       # Exportaciones centralizadas
```

#### 🔗 Dependencias y Middleware
- **Zustand**: `"zustand": "^4.5.6"` (línea 78 package.json)
- **Persist Middleware**: Usado en todos los stores principales
- **CreateStore Factory**: Sistema personalizado de creación con user ID
- **Sync Queue**: Sistema de sincronización offline

#### 📱 Componentes Afectados (Identificados)

**Autenticación y Usuario (8 componentes):**
- `AuthGuard.tsx` - Protección de rutas + redirección
- `Login.tsx` - Autenticación
- `SettingsPage.tsx` - Configuración de usuario
- `ProfileConfigPage.tsx` - Setup inicial
- `PlansPage.tsx` - Gestión suscripciones
- `ManageSubscriptionButton.tsx` - Botones de suscripción
- `Welcome.tsx` - Página de bienvenida
- `Home.tsx` - Dashboard principal

**Gestión de Personajes (6 componentes):**
- `CharacterSelection.tsx` - Selección múltiple de personajes
- `CharacterName.tsx` - Creación de nombres
- `CharacterPersonality.tsx` - Definición de personalidad
- `CharacterProfession.tsx` - Profesiones
- `CharacterHobbies.tsx` - Intereses y hobbies
- `CharactersManagement.tsx` - CRUD completo

**Historias y Contenido (12 componentes):**
- `SavedStories.tsx` - Lista de historias guardadas
- `StoryViewer.tsx` - Visualización de historias
- `GeneratingStory.tsx` - Estados de generación
- `StoryDetailsInput.tsx` - Entrada de detalles
- `StoryGenre.tsx` - Selección de género
- `StoryMoral.tsx` - Selección de moraleja
- `DurationSelection.tsx` - Duración de historia
- `StoryContinuation.tsx` - Continuación de capítulos
- `StoryContinuationOptions.tsx` - Opciones de continuación
- `StoryChapter.tsx` - Componente de capítulo
- `ChallengeQuestion.tsx` - Preguntas educativas
- `ChallengeSelector.tsx` - Selector de desafíos

**Audio y Multimedia (4 componentes):**
- `StoryAudioPlayer.tsx` - Reproductor principal
- `AudioPlayer.tsx` - Componente de audio base
- `VoiceSettings.tsx` - Configuración de voces
- `PreviewVoiceModal.tsx` - Preview de voces

### 🔍 Patrones de Uso Identificados

#### 1. **Patrón de Destructuring Directo**
```typescript
const { user, profileSettings, logoutUser, isPremium } = useUserStore();
```

#### 2. **Patrón de Selector Optimizado**
```typescript
const { checkAuth, intendedRedirectPath } = useUserStore(state => ({
  checkAuth: state.checkAuth,
  intendedRedirectPath: state.intendedRedirectPath,
}));
```

#### 3. **Patrón de Acceso Imperativo**
```typescript
const user = useUserStore.getState().user;
useCharacterStore.setState({ savedCharacters: [] });
```

#### 4. **Patrón de Funciones Computadas**
```typescript
if (canCreateStory()) {
  navigate("/duration");
}
```

#### 5. **Patrón de Persistencia Multi-Usuario**
```typescript
const storeName = `story-app-${userId}-${baseName}`;
```

---

## 🎯 Arquitectura Objetivo (Sin Zustand)

### Principios de Diseño
1. **Supabase como Fuente Única de Verdad**
2. **Hooks Personalizados de React** para estado local
3. **Context API** para estado global crítico (auth)
4. **TanStack Query** para gestión de servidor state
5. **LocalStorage directo** para persistencia simple

### Estructura Objetivo
```
src/
├── hooks/
│   ├── useAuth.ts              # Hook de autenticación
│   ├── useCharacters.ts        # Hook CRUD personajes
│   ├── useStories.ts           # Hook gestión historias
│   ├── useAudio.ts             # Hook cache audio
│   └── useStoryOptions.ts      # Hook opciones temporales
├── contexts/
│   └── AuthContext.tsx         # Context global de auth
├── services/
│   └── supabase.ts             # Servicios expandidos (ya existe)
└── utils/
    ├── persistence.ts          # Utilidades localStorage
    └── validation.ts           # Validaciones extraídas
```

### Estrategias de Reemplazo

#### Estado Global → Context + Hooks
```typescript
// Antes (Zustand)
const { user, isPremium } = useUserStore();

// Después (Context + Hook)
const { user } = useAuthContext();
const { isPremium } = useSubscription(user?.id);
```

#### Estado Local → useState + Custom Hooks
```typescript
// Antes (Store)
const { currentCharacter, updateCharacter } = useCharacterStore();

// Después (Hook personalizado)
const { character, updateCharacter } = useCharacterForm();
```

#### Persistencia → TanStack Query + LocalStorage
```typescript
// Antes (Zustand persist)
const { savedCharacters } = useCharacterStore();

// Después (React Query)
const { data: characters } = useCharacters(userId);
```

---

## 📋 Fases Detalladas de Migración

### 🔧 **FASE 1: Preparación y Servicios Base**

#### 1.1 Crear Hooks Base
- [x] `src/hooks/useAuth.ts` - Reemplazar userStore auth
- [x] `src/hooks/useLocalStorage.ts` - Persistencia simple
- [x] `src/hooks/useSupabaseQuery.ts` - Wrapper para queries
- [x] `src/contexts/AuthContext.tsx` - Context global auth

#### 1.2 Expandir Servicios Supabase
- [x] Añadir funciones para estado reactivo
- [x] Implementar sistema de subscripciones tiempo real
- [x] Expandir cache y optimización de queries

#### 1.3 Configurar TanStack Query
- [x] Configurar query client en `main.tsx`
- [x] Definir query keys estándar
- [x] Implementar invalidación automática

### 🏗️ **FASE 2: Migración por Stores (Orden por Complejidad)**

#### 2.1 StoryOptionsStore (Más Simple)
**Archivos a modificar:**
- [ ] `src/store/storyOptions/storyOptionsStore.ts` → **ELIMINAR**
- [ ] `src/hooks/useStoryOptions.ts` → **CREAR**

**Componentes afectados:**
- [ ] `CharacterSelection.tsx`
- [ ] `StoryGenre.tsx` 
- [ ] `StoryMoral.tsx`
- [ ] `DurationSelection.tsx`
- [ ] `StoryDetailsInput.tsx`

**Estrategia:** Usar `useState` simple + sessionStorage

#### 2.2 AudioStore (Cache Estado)
**Archivos a modificar:**
- [ ] `src/store/stories/audio/audioStore.ts` → **ELIMINAR**
- [ ] `src/hooks/useAudio.ts` → **CREAR**

**Componentes afectados:**
- [ ] `StoryAudioPlayer.tsx`
- [ ] `AudioPlayer.tsx`
- [ ] `VoiceSettings.tsx`
- [ ] `PreviewVoiceModal.tsx`

**Estrategia:** Hook con Map + localStorage para cache

#### 2.3 UserStore (Autenticación Critical)
**Archivos a modificar:**
- [ ] `src/store/user/userStore.ts` → **ELIMINAR**
- [ ] `src/contexts/AuthContext.tsx` → **CREAR**
- [ ] `src/hooks/useAuth.ts` → **CREAR**
- [ ] `src/hooks/useSubscription.ts` → **CREAR**

**Componentes afectados:**
- [ ] `AuthGuard.tsx`
- [ ] `Login.tsx`
- [ ] `SettingsPage.tsx` 
- [ ] `ProfileConfigPage.tsx`
- [ ] `PlansPage.tsx`
- [ ] `ManageSubscriptionButton.tsx`
- [ ] `Welcome.tsx`
- [ ] `Home.tsx`

**Estrategia:** Context para auth + TanStack Query para perfil

#### 2.4 CharacterStore (CRUD Complejo)
**Archivos a modificar:**
- [ ] `src/store/character/characterStore.ts` → **ELIMINAR**
- [ ] `src/store/character/characterValidation.ts` → `src/utils/validation.ts`
- [ ] `src/hooks/useCharacters.ts` → **CREAR**
- [ ] `src/hooks/useCharacterForm.ts` → **CREAR**

**Componentes afectados:**
- [ ] `CharacterSelection.tsx`
- [ ] `CharacterName.tsx`
- [ ] `CharacterPersonality.tsx`
- [ ] `CharacterProfession.tsx`
- [ ] `CharacterHobbies.tsx`
- [ ] `CharactersManagement.tsx`

**Estrategia:** TanStack Query + optimistic updates

#### 2.5 StoriesStore (Estado Principal)
**Archivos a modificar:**
- [ ] `src/store/stories/storiesStore.ts` → **ELIMINAR**
- [ ] `src/hooks/useStories.ts` → **CREAR**

**Componentes afectados:**
- [ ] `SavedStories.tsx`
- [ ] `StoryViewer.tsx`
- [ ] `GeneratingStory.tsx`

**Estrategia:** TanStack Query con pagination

#### 2.6 ChaptersStore y ChallengesStore (Relaciones)
**Archivos a modificar:**
- [ ] `src/store/stories/chapters/chaptersStore.ts` → **ELIMINAR**
- [ ] `src/store/stories/challenges/challengesStore.ts` → **ELIMINAR**
- [ ] `src/hooks/useChapters.ts` → **CREAR**
- [ ] `src/hooks/useChallenges.ts` → **CREAR**

**Componentes afectados:**
- [ ] `StoryContinuation.tsx`
- [ ] `StoryContinuationOptions.tsx`
- [ ] `StoryChapter.tsx`
- [ ] `ChallengeQuestion.tsx`
- [ ] `ChallengeSelector.tsx`

**Estrategia:** Queries relacionadas con parallel fetching

### 🔄 **FASE 3: Refactorización de Componentes**

#### 3.1 Componentes de Autenticación
- [ ] `AuthGuard.tsx` - Migrar a useAuth hook
- [ ] `Login.tsx` - Reemplazar loginUser con context
- [ ] `SettingsPage.tsx` - Usar hooks específicos
- [ ] `ProfileConfigPage.tsx` - useState + supabase directo
- [ ] `PlansPage.tsx` - useSubscription hook
- [ ] `ManageSubscriptionButton.tsx` - Botones con nuevo estado
- [ ] `Welcome.tsx` - hasCompletedProfile → computed
- [ ] `Home.tsx` - canCreateStory → computed

#### 3.2 Componentes de Personajes  
- [ ] `CharacterSelection.tsx` - useCharacters + selection state
- [ ] `CharacterName.tsx` - useCharacterForm hook
- [ ] `CharacterPersonality.tsx` - Form state local
- [ ] `CharacterProfession.tsx` - Form state local
- [ ] `CharacterHobbies.tsx` - Form state local
- [ ] `CharactersManagement.tsx` - CRUD con TanStack Query

#### 3.3 Componentes de Historias
- [ ] `SavedStories.tsx` - useStories hook
- [ ] `StoryViewer.tsx` - Query por ID específico
- [ ] `GeneratingStory.tsx` - useState para loading
- [ ] `StoryDetailsInput.tsx` - Form local + session storage
- [ ] `StoryGenre.tsx` - useState local
- [ ] `StoryMoral.tsx` - useState local
- [ ] `DurationSelection.tsx` - useState local
- [ ] `StoryContinuation.tsx` - useChapters hook
- [ ] `StoryContinuationOptions.tsx` - Form state
- [ ] `StoryChapter.tsx` - Props directos
- [ ] `ChallengeQuestion.tsx` - useChallenges hook
- [ ] `ChallengeSelector.tsx` - Query challenges

#### 3.4 Componentes de Audio
- [ ] `StoryAudioPlayer.tsx` - useAudio hook
- [ ] `AudioPlayer.tsx` - Props + local state
- [ ] `VoiceSettings.tsx` - localStorage directo
- [ ] `PreviewVoiceModal.tsx` - useState temporal

### 🧹 **FASE 4: Limpieza y Optimización**

#### 4.1 Eliminar Archivos de Store
- [ ] **ELIMINAR** `src/store/character/characterStore.ts`
- [ ] **ELIMINAR** `src/store/stories/storiesStore.ts`
- [ ] **ELIMINAR** `src/store/stories/chapters/chaptersStore.ts`
- [ ] **ELIMINAR** `src/store/stories/challenges/challengesStore.ts`
- [ ] **ELIMINAR** `src/store/stories/audio/audioStore.ts`
- [ ] **ELIMINAR** `src/store/stories/storyGenerator.ts`
- [ ] **ELIMINAR** `src/store/storyOptions/storyOptionsStore.ts`
- [ ] **ELIMINAR** `src/store/user/userStore.ts`
- [ ] **ELIMINAR** `src/store/core/createStore.ts`
- [ ] **ELIMINAR** `src/store/core/utils.ts`
- [ ] **ELIMINAR** `src/store/types/storeTypes.ts`
- [ ] **ELIMINAR** `src/store/index.ts`
- [ ] **ELIMINAR** `src/store/` (directorio completo)

#### 4.2 Actualizar Dependencias
- [ ] **ELIMINAR** `"zustand": "^4.5.6"` de package.json
- [ ] **VERIFICAR** que no hay imports huérfanos
- [ ] **LIMPIAR** tipos de TypeScript no usados

#### 4.3 Verificar Funcionalidad
- [ ] **TESTING** flujo completo de autenticación
- [ ] **TESTING** CRUD de personajes
- [ ] **TESTING** generación de historias
- [ ] **TESTING** reproducción de audio
- [ ] **TESTING** persistencia de datos
- [ ] **TESTING** sincronización offline
- [ ] **TESTING** subscripciones y límites

#### 4.4 Optimización Final
- [ ] **REVIEW** performance de renders
- [ ] **CONFIGURAR** React DevTools profiling
- [ ] **IMPLEMENTAR** memoización donde necesario
- [ ] **VERIFICAR** memory leaks en audio/cache

---

## ✅ Plan de Validación y Testing

### Funcionalidades Críticas a Verificar

#### 🔐 Autenticación y Usuarios
- [ ] Login/logout funcional
- [ ] Persistencia de sesión
- [ ] Redirección correcta post-login
- [ ] Verificación de setup completo
- [ ] Estado de suscripción actualizado
- [ ] Límites mensuales aplicados correctly

#### 👥 Gestión de Personajes  
- [ ] Crear personaje nuevo
- [ ] Editar personaje existente
- [ ] Eliminar personaje
- [ ] Selección múltiple funcional
- [ ] Validaciones aplicadas
- [ ] Persistencia en Supabase

#### 📚 Historias y Contenido
- [ ] Generación de historia nueva
- [ ] Continuación de capítulos
- [ ] Guardado en Supabase
- [ ] Lista de historias guardadas
- [ ] Visualización correcta
- [ ] Desafíos educativos funcionando

#### 🔊 Audio y Multimedia
- [ ] Generación de audio TTS
- [ ] Cache de audio funcionando
- [ ] Reproducción fluida
- [ ] Selección de voces
- [ ] Preview de voces
- [ ] Estados de carga correctos

### Métricas de Éxito
1. **Funcionalidad**: 100% de features funcionando
2. **Performance**: No degradación vs versión actual
3. **Persistencia**: Datos se mantienen entre sesiones
4. **Sincronización**: Offline/online funciona
5. **UX**: No cambios perceptibles para usuario

### Plan de Rollback
1. **Git branch** dedicado para migración
2. **Backup completo** antes de iniciar
3. **Testing por fases** - rollback granular posible
4. **Feature flags** si es necesario

---

## 📊 Estimaciones de Tiempo

| Fase | Estimación | Riesgo | Dependencias |
|------|-----------|--------|--------------|
| **Fase 1** | 1 día | Bajo | - |
| **Fase 2** | 3 días | Alto | Fase 1 |
| **Fase 3** | 2 días | Medio | Fase 2 |
| **Fase 4** | 1 día | Bajo | Fases 1-3 |
| **Total** | **7 días** | **Medio** | Secuencial |

### Factores de Riesgo
- **Alto**: UserStore (autenticación crítica)
- **Alto**: CharacterStore (lógica compleja + validaciones)
- **Medio**: TanStack Query setup nuevo
- **Bajo**: Componentes individuales

---

## 🚀 Próximos Pasos

1. **Aprobación** del plan detallado
2. **Creación** de branch dedicado `feature/remove-zustand`
3. **Backup** completo del estado actual
4. **Inicio** por Fase 1: Hooks base y servicios

---

**Documento creado**: Enero 2025  
**Versión**: 1.0  
**Autor**: Claude Code Assistant