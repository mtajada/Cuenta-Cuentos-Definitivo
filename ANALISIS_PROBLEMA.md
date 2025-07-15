# Plan de Implementación: Selección Múltiple de Personajes

## Problema

### Descripción del Problema Actual
La aplicación TaleMe actualmente solo permite seleccionar un personaje para generar historias. Los usuarios no pueden crear historias con múltiples personajes interactuando entre sí, lo que limita la narrativa y la experiencia del usuario.

### Análisis Técnico del Estado Actual

**1. Arquitectura de Datos (Limitaciones)**
- **Tipos de Datos**: `StoryCharacter` y `StoryOptions` diseñados para un solo personaje
- **Estado Global**: `characterStore.currentCharacter` almacena solo un personaje
- **Almacenamiento**: `storyOptionsStore.currentStoryOptions.character` es singular

**2. Flujo de Selección de Personajes**
- **UI Actual**: Grid de personajes con selección individual
- **Navegación**: Clic en personaje → selección inmediata → siguiente página
- **Problema**: No hay modo de selección múltiple ni botón "Continuar" independiente

**3. Flujo de Creación de Personajes**
- **Problema Identificado**: Después de crear un personaje nuevo, el usuario va directamente a `/story-genre` en lugar de regresar a `/character-selection`
- **Navegación Incorrecta**: No permite ver el personaje recién creado ni seleccionar múltiples personajes

**4. Integración con Edge Functions**
- **generate-story**: Recibe `options.character` (singular) en el payload
- **story-continuation**: Usa `story.options.character.name` para el contexto
- **Prompts de AI**: Estructurados para narrativas de un solo personaje

**5. Servicios y Almacenes**
- **GenerateStoryService**: Pasa un solo personaje en `options.character`
- **StoryContinuationService**: Maneja contexto de un solo personaje
- **storyGenerator.ts**: Usa `currentCharacter` singular del estado

## Solución Propuesta

### Enfoque de Implementación: Evolución Progresiva con Compatibilidad Hacia Atrás

**Estrategia Elegida**: Implementar selección múltiple manteniendo compatibilidad con el sistema actual, permitiendo tanto historias de un personaje como de múltiples personajes.

**Ventajas del Enfoque**:
- ✅ Mantiene funcionalidad existente
- ✅ Permite migración gradual
- ✅ Reduce riesgo de romper features existentes
- ✅ Facilita testing y validación

**Arquitectura de Datos Propuesta**:
```typescript
// Tipos extendidos (manteniendo compatibilidad)
interface StoryOptions {
  character?: StoryCharacter;      // Mantener para compatibilidad
  characters?: StoryCharacter[];   // Nuevo para múltiples personajes
  // ... otros campos
}

interface CharacterState {
  currentCharacter: StoryCharacter | null;     // Mantener para compatibilidad
  selectedCharacters: StoryCharacter[];        // Nuevo para múltiples personajes
  // ... otros campos
}
```

**Experiencia de Usuario Mejorada**:
- Selección múltiple con checkboxes en lugar de navegación inmediata
- Botón "Continuar" siempre visible (habilitado solo con al menos un personaje)
- Indicadores visuales de personajes seleccionados
- Opción para crear personajes adicionales sin perder selecciones actuales

## Plan de Tareas

### Fase 1: Preparación y Tipos de Datos ✅ COMPLETADA CON BREAKING CHANGES
- [x] **Extender tipos de datos en `storeTypes.ts`** ✅
  - Añadir `selectedCharacters: StoryCharacter[]` a `CharacterState`
  - Añadir `characters?: StoryCharacter[]` a `StoryOptions`
  - 🔥 **REMOVIDO**: Funciones legacy de selección única
- [x] **Actualizar `characterStore.ts`** ✅
  - Implementar `selectedCharacters` en el estado
  - Crear funciones: `toggleCharacterSelection()`, `clearSelectedCharacters()`, `getSelectedCharacters()`, `isCharacterSelected()`, `canSelectMoreCharacters()`, `setSelectedCharacters()`
  - 🔥 **REMOVIDO**: `selectCharacter()` y funciones legacy
- [x] **Actualizar `storyOptionsStore.ts`** ✅
  - Añadir soporte para almacenar múltiples personajes
  - Simplificar lógica - solo usar array `characters`

#### 📋 NOTA TÉCNICA PARA FUTUROS AGENTES - FASE 1 COMPLETADA (SISTEMA SIMPLIFICADO)

**Estado Actual del Sistema:**
La infraestructura para selección múltiple de personajes está **completamente implementada con arquitectura simplificada**. Los siguientes componentes están listos:

**🏗️ Arquitectura de Stores (SIMPLIFICADA):**
- **`CharacterState`**: Con `selectedCharacters: StoryCharacter[]` y `maxCharacters: 4`
- **`currentCharacter`**: MANTENIDO solo para flujo de creación de personajes
- **`StoryOptionsState`**: Añadido `selectedCharacterIds: string[]` para tracking
- **`StoryOptions`**: Campo `characters?: StoryCharacter[]` para array de personajes

**⚙️ Funciones Implementadas (6 nuevas en CharacterStore):**
1. `toggleCharacterSelection(characterId)` - Seleccionar/deseleccionar con validación
2. `clearSelectedCharacters()` - Limpiar selección
3. `getSelectedCharacters()` - Obtener personajes seleccionados  
4. `isCharacterSelected(characterId)` - Verificar si está seleccionado
5. `canSelectMoreCharacters()` - Validar capacidad (máx. 4)
6. `setSelectedCharacters(characters[])` - Establecer selección múltiple

**🔍 Sistema de Validación:**
- **Archivo**: `src/store/character/characterValidation.ts`
- **Límites**: 1-4 personajes (configurable en `CHARACTER_LIMITS`)
- **Mensajes**: Tono amigable de la app con emoji ✨
- **Validaciones**: Duplicados, límites, caracteres inválidos
- **Funciones clave**: `validateCharacterSelection()`, `validateMultipleCharacterSelection()`, `getCharacterSelectionMessage()`

**🔥 CAMBIOS ARQUITECTURALES (BREAKING CHANGES):**
- ❌ **REMOVIDO**: Función `selectCharacter()` - Ya no existe en el sistema
- ❌ **REMOVIDO**: `syncCharacterSelection()` - No necesaria en el sistema simplificado
- ✅ **SIMPLIFICADO**: Sistema unificado que siempre permite selección múltiple (1-4)
- ✅ **MANTENIDO**: `currentCharacter` solo para flujo de creación de personajes

**🚀 Listos para Fase 2:**
- **CharacterStore**: Todas las funciones exportadas y listas para UI
- **Validación**: Sistema completo con mensajes UX-friendly
- **Estado**: Persistencia automática con separación por usuario
- **Integración**: StoryOptionsStore sincronizado correctamente

**📁 Archivos Modificados:**
- `src/store/types/storeTypes.ts` - Extensiones de tipos
- `src/types/index.ts` - StoryOptions extendido
- `src/store/character/characterStore.ts` - Funciones múltiples personajes
- `src/store/storyOptions/storyOptionsStore.ts` - Integración múltiples personajes  
- `src/store/character/characterValidation.ts` - Sistema validación (NUEVO)

**⚠️ Importante para Fase 2:**
- Usar `useCharacterStore.getState().toggleCharacterSelection(id)` para selección
- Validar con `validateCharacterSelection()` antes de mostrar UI
- Mostrar mensaje con `getCharacterSelectionMessage(count)` 
- Límite hard-coded a 4 personajes en `CHARACTER_LIMITS.MAX_CHARACTERS`

---

### Fase 2: Interfaz de Usuario - Selección Múltiple ✅ COMPLETADA (SIMPLIFICADA)
- [x] **Modificar `CharacterSelection.tsx`** ✅
  - Cambiar de navegación inmediata a selección con checkboxes
  - 🔥 **REMOVIDO**: Toggle entre modos único/múltiple - siempre modo múltiple
  - Implementar seguimiento de selecciones (1-4 personajes)
  - Añadir botón "Continuar" siempre presente (habilitado con ≥1 personaje)
  - Mantener indicadores visuales de selección
  - 🔥 **ELIMINADO**: Lógica dual - solo selección múltiple
  - **Añadir mensaje explicativo**: "✨ ¡Puedes elegir hasta 4 personajes para tu historia! Para cuentos cortitos, recomendamos menos personajes para que cada uno brille más."
- [x] **Actualizar estilos y UX** ✅
  - Diseñar indicadores visuales para personajes seleccionados
  - Implementar animaciones de selección/deselección  
  - Añadir contador de personajes seleccionados (ej: "2/4 personajes seleccionados")
  - Deshabilitar selección cuando se alcancen 4 personajes

### Fase 3: Corrección del Flujo de Creación de Personajes ✅ COMPLETADA
- [x] **Modificar `CharacterProfession.tsx`** ✅
  - Detectar si viene de creación nueva (`?action=create`)
  - Redirigir a `/character-selection` en lugar de `/story-genre` para nuevos personajes
  - Mantener redirección actual para edición desde management
- [x] **Actualizar `CharacterSelection.tsx`** ✅
  - Modificar `handleCreateNewCharacter()` para añadir parámetro `?action=create`
  - Implementar auto-selección opcional del personaje recién creado
  - Mostrar mensaje de éxito al regresar con personaje nuevo
- [x] **Actualizar flujo completo** ✅
  - Propagar parámetro `?action=create` a través de CharacterName.tsx
  - Propagar parámetro a través de CharacterHobbies.tsx  
  - Propagar parámetro a través de CharacterPersonality.tsx
  - Asegurar retorno correcto a CharacterSelection al completar creación

#### 📋 NOTA TÉCNICA PARA FUTUROS AGENTES - FASES 2 y 3 COMPLETADAS

**Estado Actual del Sistema UI:**
La interfaz de usuario para selección múltiple de personajes está **completamente implementada y funcional**. Los siguientes componentes están listos:

**🎨 UI de Selección Múltiple (SIMPLIFICADA):**
- **REMOVIDO**: Toggle de modo - Ahora siempre es selección múltiple
- **Checkboxes**: Componente Radix UI checkbox en tarjetas de personajes
- **Indicadores Visuales**: Badges, iconos UserCheck, bordes purple para seleccionados
- **Contador**: Badge con "2/4" personajes seleccionados visible
- **Mensajes**: Sistema completo con `getCharacterSelectionMessage()`

**🔄 Flujo de Navegación (UNIFICADO):**
- **Modo Único ELIMINADO**: Ya no existe navegación inmediata al hacer clic
- **Selección Múltiple**: Único modo - Clic → toggle selection, botón "Continuar" siempre presente
- **Validación**: Límite 1-4 personajes, deshabilita selección cuando máximo alcanzado
- **Feedback**: Botón "Limpiar Selección", contador dinámico en texto del botón

**🏗️ Flujo de Creación Arreglado:**
- **Parámetro `?action=create`**: Propagado a través de todo el flujo
- **Navegación Corregida**: CharacterProfession ahora regresa a `/character-selection`
- **Archivos Actualizados**: CharacterName, CharacterHobbies, CharacterPersonality, CharacterProfession
- **URL Management**: Uso consistente de `URLSearchParams` para parámetros

**🎯 Estado de Funcionalidad (SISTEMA SIMPLIFICADO):**
- 🔥 **Selección Única REMOVIDA**: Ya no existe como modo separado
- ✅ **Selección Múltiple**: Sistema unificado 1-4 personajes con validación
- ✅ **Creación de Personajes**: Regresa correctamente a selección
- ✅ **Validación**: Sistema completo con mensajes amigables
- ✅ **UX**: Animaciones, hover effects, disabled states
- ❌ **BREAKING CHANGE**: Sistema anterior de selección única eliminado

**📱 Componentes UI Implementados (SIMPLIFICADOS):**
- 🔥 **REMOVIDO**: `isMultipleMode` state - Ya no existe toggle de modos
- ✅ **Checkboxes**: Siempre visibles con estilos brand purple
- ✅ **Badge counter**: En contador central y tarjetas seleccionadas
- Botón "Limpiar Selección" para reset
- Texto dinámico en botón "Continuar" con count de personajes
- Deshabilita tarjetas cuando se alcanza máximo (opacity-50)

**🚀 Listo para Fase 4:**
- **CharacterSelection.tsx**: UI completamente funcional
- **Navigation Flow**: Creación y selección funcionando perfectamente  
- **Store Integration**: `updateSelectedCharacters()` llamada correctamente
- **Validation**: Todo validado antes de continuar a `/story-genre`

**🎯 Mejoras Implementadas Post-Feedback:**
- ✅ **Eliminado toggle de modo**: Ahora siempre permite selección múltiple (más intuitivo)
- ✅ **Arreglado problema de clicks**: Checkboxes ahora funcionan correctamente
- ✅ **UX simplificada**: Un solo modo - selecciona 1-4 personajes según necesites
- ✅ **Feedback mejorado**: Botón "Continuar" muestra estado actual claramente

**🧹 Limpieza de Código Legacy Completada:**
- ✅ **CharacterStore**: Eliminado `selectCharacter` legacy (MANTENIDO `currentCharacter` para creación)
- ✅ **StoreTypes**: Removidos tipos y funciones de selección única
- ✅ **StoryOptionsStore**: Eliminada lógica de compatibilidad hacia atrás
- ✅ **CharacterSelection**: Removidos imports y referencias legacy (sin `isMultipleMode`)
- ✅ **Páginas actualizadas**: CharactersManagement y páginas de creación funcionando
- ✅ **Build exitoso**: TypeScript compila sin errores, funcionalidad verificada

**⚠️ Para Fase 4 (Servicios):**
- UI ya llama `updateSelectedCharacters(selectedCharacters)` 
- `storyOptionsStore` ya tiene `selectedCharacterIds` y funciones necesarias
- Los servicios deben usar tanto `character` como `characters` del payload
- Edge functions deben manejar arrays de personajes en prompts automáticamente

---

## 🔥 BREAKING CHANGES IMPLEMENTADOS

### Funciones y Conceptos Eliminados

**❌ REMOVIDO COMPLETAMENTE:**
- `selectCharacter()` - Función legacy de selección única eliminada
- `syncCharacterSelection()` - Helper de sincronización ya no necesario
- Toggle de modos único/múltiple - Interfaz simplificada
- `isMultipleMode` state - Solo existe modo selección múltiple
- Compatibilidad hacia atrás - Sistema completamente nuevo

**❌ ARQUITECTURA ANTERIOR:**
- **Sistema Dual**: Antes había dos modos (único vs múltiple)
- **Navegación Automática**: Clic en personaje navegaba inmediatamente
- **Función Legacy**: `selectCharacter()` manejaba selección única
- **Estado Complejo**: Múltiples formas de manejar selección

**✅ ARQUITECTURA NUEVA:**
- **Sistema Unificado**: Solo selección múltiple (1-4 personajes)
- **Selección Manual**: Checkboxes + botón "Continuar" explícito
- **Funciones Modernas**: `toggleCharacterSelection()` maneja todo
- **Estado Simplificado**: Una sola forma de seleccionar personajes

### Impacto en el Código

**🏗️ Stores Afectados:**
- `CharacterStore`: Eliminado `selectCharacter()`, mantenido `currentCharacter` solo para creación
- `StoryOptionsStore`: Simplificado para usar solo array `characters`
- `CharacterState`: Removidas interfaces legacy de selección única

**🎨 UI Simplificada:**
- `CharacterSelection.tsx`: Eliminado toggle, siempre checkboxes visibles
- Flujo unificado: Seleccionar → Continuar (no navegación automática)
- UX más clara: Un solo modo de interacción

### Migración para Desarrolladores

**Si estás integrando con este sistema:**
```typescript
// ❌ ANTES (ya no funciona)
const character = useCharacterStore(state => state.currentCharacter);
characterStore.selectCharacter(character);

// ✅ AHORA (forma correcta)
const { selectedCharacters, toggleCharacterSelection } = useCharacterStore();
toggleCharacterSelection(characterId);
```

**Para servicios que usan personajes:**
```typescript
// ✅ Usar siempre el array characters
const characters = storyOptions.characters; // Array de 1-4 personajes
```

---

### Fase 4: Servicios y Generación de Historias
- [ ] **Actualizar `GenerateStoryService.ts`**
  - Modificar para enviar tanto `character` como `characters` en el payload
  - Implementar lógica de respaldo para compatibilidad
  - Añadir validación para múltiples personajes
- [ ] **Actualizar `StoryContinuationService.ts`**
  - Modificar para manejar múltiples personajes en continuaciones
  - Mantener contexto de todos los personajes seleccionados
- [ ] **Actualizar `storyGenerator.ts`**
  - Modificar para usar `selectedCharacters` además de `currentCharacter`
  - Implementar lógica híbrida para compatibilidad

### Fase 5: Edge Functions Backend
- [ ] **Modificar `generate-story/index.ts`**
  - Añadir validación para `params.options.characters` (array)
  - Mantener validación existente para `params.options.character`
  - Implementar lógica para procesar múltiples personajes
  - Actualizar manejo de errores para múltiples personajes
- [ ] **Actualizar `generate-story/prompt.ts`**
  - Modificar prompts para incluir múltiples personajes
  - Añadir lógica para describir relaciones entre personajes
  - Mantener prompts existentes para compatibilidad con un personaje
- [ ] **Modificar `story-continuation/index.ts`**
  - Añadir soporte para múltiples personajes en continuaciones
  - Mantener contexto de todos los personajes a través de las continuaciones
  - Actualizar validación de parámetros

### Fase 6: Prompts de AI y Narrativa
- [ ] **Mejorar prompts para múltiples personajes**
  - Crear plantillas de introducción para múltiples personajes
  - Implementar lógica para generar interacciones entre personajes
  - Añadir guidelines para dinámicas de grupo
  - Mantener calidad narrativa con múltiples protagonistas
- [ ] **Actualizar prompts de continuación**
  - Asegurar que todos los personajes mantengan consistencia
  - Implementar rotación de perspectivas si es apropiado
  - Añadir lógica para manejar arcos narrativos múltiples

### Fase 7: Testing y Validación
- [ ] **Pruebas de compatibilidad hacia atrás**
  - Validar que historias con un personaje siguen funcionando
  - Probar flujo de creación de personajes actualizado
  - Verificar que edge functions manejan ambos casos
- [ ] **Pruebas de selección múltiple**
  - Validar selección y deselección de múltiples personajes
  - Probar generación de historias con 2-4 personajes
  - Verificar continuaciones con múltiples personajes
  - Probar límite máximo de 4 personajes y mensaje explicativo
- [ ] **Pruebas de UX**
  - Validar que la navegación es intuitiva
  - Probar flujo completo de creación y selección
  - Verificar indicadores visuales y feedback del usuario

### Fase 8: Optimizaciones y Refinamientos
- [ ] **Optimizaciones de rendimiento**
  - Revisar cargas de datos para múltiples personajes
  - Optimizar prompts para contextos más grandes
  - Implementar lazy loading si es necesario
- [ ] **Mejoras de UX**
  - Implementar sugerencias de combinaciones de personajes
  - Añadir preview de cómo los personajes interactuarán
  - Mostrar mensaje explicativo con tono amigable de la app
- [ ] **Documentación y mantenimiento**
  - Actualizar documentación técnica
  - Documentar nuevos endpoints y parámetros
  - Crear guías de uso para múltiples personajes

## Consideraciones Técnicas

### Compatibilidad hacia Atrás
- **Prioridad Alta**: Mantener toda la funcionalidad existente
- **Estrategia**: Implementar campos adicionales sin modificar los existentes
- **Validación**: Asegurar que historias existentes continúen funcionando

### Limitaciones y Restricciones
- **Límite de Personajes**: Máximo 4 personajes por historia (por rendimiento y calidad narrativa)
- **Selección Opcional**: Los usuarios pueden elegir entre 1-4 personajes según sus preferencias
- **Recomendaciones UX**: Mostrar mensaje explicativo sobre historias cortas (tono amigable de la app)
- **Complejidad de Prompts**: Múltiples personajes requieren contexto más complejo
- **Costos de API**: Más personajes = prompts más largos = mayor costo

### Monitoreo y Métricas
- **Tracking**: Implementar métricas para uso de múltiples personajes
- **Performance**: Monitorear tiempo de respuesta con múltiples personajes
- **Calidad**: Seguir calidad narrativa con múltiples protagonistas

## Implementaciones Futuras

### Asignación de Roles a Personajes
**Descripción**: Permitir asignar roles específicos a cada personaje (protagonista, amigo, mentor, antagonista, etc.)

**Implementación Detallada**:

#### Fase 1: Extensión de Tipos de Datos
```typescript
// Nuevos tipos para roles
type CharacterRole = 'protagonist' | 'friend' | 'mentor' | 'antagonist' | 'sidekick' | 'wise_elder' | 'comic_relief';

interface CharacterWithRole extends StoryCharacter {
  role?: CharacterRole;
  roleDescription?: string;
}

interface StoryOptionsWithRoles extends StoryOptions {
  charactersWithRoles?: CharacterWithRole[];
}
```

#### Fase 2: UI de Asignación de Roles
- **Nueva página**: `CharacterRoleAssignment.tsx` después de `CharacterSelection.tsx`
- **Funcionalidad**:
  - Mostrar personajes seleccionados en tarjetas
  - Dropdown para seleccionar rol de cada personaje
  - Descripciones explicativas de cada rol
  - Validación: máximo 1 protagonista, roles balanceados
  - Sugerencias automáticas basadas en personalidades

#### Fase 3: Integración con Prompts de AI
- **Prompts específicos por rol**:
  - Protagonista: lidera la acción, toma decisiones importantes
  - Amigo: apoya al protagonista, momentos de compañerismo
  - Mentor: ofrece consejos, guía al protagonista
  - Antagonista: crea conflicto constructivo (apropiado para niños)
- **Dinámicas de roles**: Interacciones específicas entre roles diferentes
- **Arcos narrativos**: Cada rol tiene objetivos específicos en la historia

#### Fase 4: Configuración Avanzada
- **Roles personalizados**: Permitir crear roles únicos
- **Plantillas de historias**: Configuraciones predefinidas de roles para diferentes tipos de historias
- **Sugerencias inteligentes**: IA sugiere roles basándose en personalidades y hobbies

## Cronograma Estimado

**Fase 1-2**: 2-3 días (Tipos de datos + UI básica)
**Fase 3**: 1 día (Corrección flujo de creación)
**Fase 4-5**: 3-4 días (Servicios + Edge functions)
**Fase 6**: 2-3 días (Prompts de AI)
**Fase 7-8**: 2-3 días (Testing + optimizaciones)

**Total Estimado**: 10-14 días de desarrollo

## ⚠️ PENDIENTE: Eliminación Completa de Single Character Legacy

### Análisis Post-Implementación (Enero 2025)

**DISCREPANCIA DETECTADA** entre documentación y implementación real:

**📋 Documentación dice:**
> "Compatibilidad hacia atrás - Sistema completamente nuevo"  
> "REMOVIDO COMPLETAMENTE"

**🔍 Realidad encontrada:**
- ✅ **Frontend eliminado**: UI solo permite selección múltiple (1-4 personajes)
- ❌ **Backend mantenido**: Edge Functions procesan tanto `character` como `characters`
- ❌ **Tests mantienen compatibilidad**: Scripts incluyen tests de `single` character
- ❌ **Documentación desactualizada**: ANALISIS_PROBLEMA.md no refleja estado real

### Archivos que Mantienen Single Character Legacy:

**Tests:**
- `test-simple.js` líneas 243-261: Función `testSingleCharacter()` completa
- `test-data.js` líneas 59-71: `singleCharacterPayload` con estructura legacy
- `README.md`: Documenta comando `single` como opción válida

**Backend (posiblemente):**
- Edge Functions procesan campo `character` (singular) además de `characters` (array)
- Validation logic maneja ambos formatos para compatibilidad

### Propuesta de Unificación

**HIPÓTESIS TÉCNICA**: Con el sistema actual de múltiples personajes, seleccionar **1 solo personaje** debería ser funcionalmente **idéntico** al sistema legacy:

```javascript
// Sistema Legacy (a eliminar)
{ character: { name: "Luna", profession: "Astronauta" } }

// Sistema Nuevo (seleccionar 1 personaje)  
{ characters: [{ name: "Luna", profession: "Astronauta" }] }
```

**PLAN DE LIMPIEZA PROPUESTO:**

1. **Validar hipótesis**: Confirmar que seleccionar 1 personaje = funcionalidad legacy
2. **Eliminar tests legacy**: Remover `testSingleCharacter()` y `singleCharacterPayload`
3. **Simplificar Edge Functions**: Eliminar procesamiento de campo `character` singular
4. **Actualizar documentación**: Corregir ANALISIS_PROBLEMA.md para reflejar realidad
5. **Confirmar no breaking changes**: Asegurar que no afecta funcionalidad existente

### Beneficios de la Limpieza:

- ✅ **Código más simple**: Una sola forma de manejar personajes
- ✅ **Tests más claros**: Eliminar confusion entre modos
- ✅ **Documentación precisa**: Reflejar estado real del sistema
- ✅ **Mantenimiento reducido**: Menos código legacy que mantener

### Estado Actual: **✅ COMPLETADO - ENERO 2025**

**Resultado**: Sistema unificado implementado exitosamente  
**Código Legacy**: Completamente eliminado  
**Funcionalidad**: Sistema múltiples personajes (1-4) funcionando

---

## Criterios de Éxito

- [ ] ✅ Usuarios pueden seleccionar múltiples personajes (1-4)
- [ ] ✅ Flujo de creación de personajes regresa a selección
- [ ] ✅ Historias se generan correctamente con múltiples personajes
- [ ] ✅ Continuaciones mantienen consistencia entre personajes
- [ ] ✅ Compatibilidad hacia atrás 100% funcional
- [ ] ✅ Performance aceptable con múltiples personajes
- [ ] ✅ UX intuitiva y fluida