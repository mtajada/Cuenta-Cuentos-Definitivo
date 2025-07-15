# 🧪 Test Edge Functions - TaleMe

Scripts para testear Edge Functions de múltiples personajes con autenticación real.

## 🎯 Tests Disponibles

### 📖 Story Generation (generate-story)
- **`multiple`**: Genera historia con 3 personajes (Luna, Chef Max, Dra. Ruby)
- **REMOVIDO `single`**: Sistema unificado maneja 1-4 personajes automáticamente

### 📚 Story Continuation (story-continuation) 
- **`continue-options`**: Genera 3 opciones de continuación (solo opciones)
- **`continue-selected`**: Continúa historia con opción seleccionada (genera capítulo completo)
- **`continue-free`**: Continuación libre sin opción específica (genera capítulo completo)
- **`continue-directed`**: Continuación dirigida por usuario (genera capítulo completo)
- **`continue-all`**: Ejecuta todos los tests de continuación
- **`continue`**: Alias para `continue-options` (legacy)

---

## 🚀 Comandos por Caso de Uso

### 🔬 Testing & Desarrollo

```bash
# SIEMPRE ejecutar desde la carpeta correcta:
cd "/Users/miguel/Mizat Ventures/TaleMe/test-edge-functions"

# Ejecutar todos los tests (consume más créditos)
deno run --allow-env --allow-net test-simple.js

# Solo Story Generation - Múltiples personajes
deno run --allow-env --allow-net test-simple.js multiple

# Solo Story Continuation - Generar opciones
deno run --allow-env --allow-net test-simple.js continue-options

# Story Continuation - Continuar con opción seleccionada  
deno run --allow-env --allow-net test-simple.js continue-selected

# Story Continuation - Continuación libre
deno run --allow-env --allow-net test-simple.js continue-free

# Story Continuation - Continuación dirigida
deno run --allow-env --allow-net test-simple.js continue-directed

# Todos los tests de Story Continuation
deno run --allow-env --allow-net test-simple.js continue-all

# Sistema unificado - test con 1 personaje usando múltiples
# Nota: El sistema ahora maneja 1-4 personajes de forma unificada
```

### 🔍 Debugging & Diagnóstico

```bash
# PRIMERO: Ir a la carpeta correcta
cd "/Users/miguel/Mizat Ventures/TaleMe/test-edge-functions"

# Ver payload completo enviado a Edge Functions
deno run --allow-env --allow-net test-simple.js multiple --verbose

# Diagnosticar por qué faltan personajes en historias
deno run --allow-env --allow-net test-simple.js multiple --verbose

# Ver respuesta completa del modelo de lenguaje - Opciones
deno run --allow-env --allow-net test-simple.js continue-options --verbose

# Ver respuesta completa - Continuación con opción seleccionada
deno run --allow-env --allow-net test-simple.js continue-selected --verbose

# Ver respuesta completa - Continuación libre
deno run --allow-env --allow-net test-simple.js continue-free --verbose

# Ver respuesta completa - Continuación dirigida
deno run --allow-env --allow-net test-simple.js continue-directed --verbose

# Debugging completo (todos los tests con logs)
deno run --allow-env --allow-net test-simple.js --verbose
```

### 💡 Casos Específicos

```bash
# PRIMERO: Ir a la carpeta correcta
cd "/Users/miguel/Mizat Ventures/TaleMe/test-edge-functions"

# Problema: Dra. Ruby no aparece en historias
deno run --allow-env --allow-net test-simple.js multiple --verbose

# Verificar que Story Continuation - Opciones funciona
deno run --allow-env --allow-net test-simple.js continue-options

# Verificar que Story Continuation - Capítulos completos funciona
deno run --allow-env --allow-net test-simple.js continue-selected

# Probar continuación libre sin opciones
deno run --allow-env --allow-net test-simple.js continue-free

# Probar continuación dirigida por usuario
deno run --allow-env --allow-net test-simple.js continue-directed

# Sistema unificado - usar multiple con 1 personaje si necesario
# Nota: El comando 'single' ha sido eliminado

# Ver ayuda completa
deno run --allow-env --allow-net test-simple.js --help
```

---

## 🎯 Diferencias entre Tests de Story Continuation

### ✅ **continue-options** (generateOptions)
- **Qué hace**: Genera 3 opciones de continuación
- **Output**: Array de opciones con `summary` 
- **NO genera contenido**: Solo devuelve opciones para elegir
- **Ejemplo output**: `["Opción 1", "Opción 2", "Opción 3"]`

### ✅ **continue-selected** (optionContinuation) 
- **Qué hace**: Toma una opción y genera capítulo completo
- **Output**: `{ title: string, content: string }`
- **SÍ genera contenido**: Historia completa basada en la opción
- **Ejemplo output**: Capítulo completo de 1000+ palabras

### ✅ **continue-free** (freeContinuation)
- **Qué hace**: Continúa la historia libremente
- **Output**: `{ title: string, content: string }`
- **SÍ genera contenido**: Historia sin opción específica
- **Ejemplo output**: Capítulo completo siguiendo la narrativa

### ✅ **continue-directed** (directedContinuation)
- **Qué hace**: Continúa basándose en dirección del usuario
- **Output**: `{ title: string, content: string }`
- **SÍ genera contenido**: Historia siguiendo la dirección especificada
- **Ejemplo output**: Capítulo que incluye los elementos solicitados

---

## 🔍 Información de Debugging

### 📊 Con `--verbose` verás:

- **📤 Payload completo**: JSON exacto enviado a la Edge Function
- **🔐 Headers**: Autenticación y metadatos de la request
- **📥 Respuesta completa**: Output del modelo de lenguaje (Gemini)
- **🎯 Análisis detallado**: Conteo de menciones por personaje

### 🕵️ Para diagnosticar problemas:

1. **Edge Function no recibe datos**: Verificar payload en logs
2. **Modelo ignora personajes**: Ver respuesta completa en logs  
3. **Prompt mal formado**: Revisar cómo se construye el prompt
4. **Token limits**: Verificar si la respuesta se trunca

### 📈 Análisis de Personajes

El script muestra automáticamente:
```
📊 Análisis de Personajes:
  ✅ Luna: 15 menciones
  ✅ Chef Max: 10 menciones  
  ❌ Dra. Ruby: 0 menciones  ← Problema detectado
```

---

## 🔧 Configuración

### Variables Ya Configuradas ✅
- **SUPABASE_URL**: Proyecto TaleMe  
- **SUPABASE_ANON_KEY**: Autenticación pública
- **SUPABASE_SERVICE_ROLE_KEY**: Autenticación admin (fallback)
- **GEMINI_API_KEY**: Google Generative AI
- **Usuario Test**: 4zgz2000@gmail.com (configurado)

### Modelo de Lenguaje
- **Modelo**: gemini-2.5-flash
- **Configurado en**: Edge Functions de Supabase
- **Endpoint**: Via OpenAI-compatible API

---

## 📁 Archivos del Proyecto

- **`test-simple.js`**: Script principal con autenticación y logging
- **`test-data.js`**: Datos de prueba (personajes, payloads, validadores)  
- **`README.md`**: Esta documentación

---

## ⚠️ Troubleshooting

### 🔐 Problemas de Autenticación

**Error: "invalid claim: missing sub claim"**
- ✅ **Solucionado**: Script usa usuario real de la aplicación
- Si persiste: Verificar credenciales en `test-simple.js`

**Error: "email rate limit exceeded"**
- Las credenciales actuales son de usuario real (no necesita crear usuario)
- Si aparece: Usuario real está configurado, no debería ocurrir

### 💳 Límites de Uso

**Error: "Límite mensual (10) alcanzado"**
- Usuario free tiene límite de 10 historias/mes
- **Solución**: Usar tests específicos para no gastar créditos:
  ```bash
  deno run --allow-env --allow-net test-simple.js continue-options  # Solo opciones
  deno run --allow-env --allow-net test-simple.js multiple          # Solo múltiples
  deno run --allow-env --allow-net test-simple.js continue-selected # Solo un capítulo
  ```

### 🐛 Problemas de Personajes

**Personajes no aparecen en historias**
1. Ejecutar debugging: `deno run --allow-env --allow-net test-simple.js multiple --verbose`
2. Verificar payload: ¿Llegan los 3 personajes en `options.characters`?
3. Ver respuesta: ¿Menciona Gemini a todos los personajes?
4. Si payload OK pero respuesta incompleta: Problema en prompt generation

---

## 🎯 Casos de Uso Recomendados

### 👨‍💻 Desarrollo
```bash
cd "/Users/miguel/Mizat Ventures/TaleMe/test-edge-functions"

# Test rápido después de cambios en Edge Functions
deno run --allow-env --allow-net test-simple.js multiple

# Validar Story Continuation - Opciones tras cambios
deno run --allow-env --allow-net test-simple.js continue-options

# Validar Story Continuation - Capítulos completos tras cambios
deno run --allow-env --allow-net test-simple.js continue-selected
```

### 🔧 Debugging
```bash
cd "/Users/miguel/Mizat Ventures/TaleMe/test-edge-functions"

# Investigar problemas de personajes
deno run --allow-env --allow-net test-simple.js multiple --verbose

# Ver logs completos de opciones de continuación
deno run --allow-env --allow-net test-simple.js continue-options --verbose

# Ver logs completos de capítulos de continuación
deno run --allow-env --allow-net test-simple.js continue-selected --verbose
```

### ✅ Testing Completo
```bash
cd "/Users/miguel/Mizat Ventures/TaleMe/test-edge-functions"

# Ejecutar suite completa (cuidado con límites de créditos)
deno run --allow-env --allow-net test-simple.js
```

---

**¡Todo listo para testear! 🎉**

**Comandos más usados**: 
- Para Story Generation: `deno run --allow-env --allow-net test-simple.js multiple --verbose`
- Para Story Continuation: `deno run --allow-env --allow-net test-simple.js continue-selected --verbose`