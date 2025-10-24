# Panel de Administración - PDF Ilustrados

## 📌 Descripción

Panel privado para generar PDFs ilustrados de cualquier historia en la base de datos, sin restricciones de usuario. Utiliza una Edge Function con `service_role` para bypasear las políticas RLS.

## 🔐 Acceso

- **URL**: `/admin/illustrated-pdf`
- **Código de Acceso**: `TaleMe2025`

## 🚀 Cómo Usar

### 1. Acceder al Panel

Navega a: `https://tu-dominio.com/admin/illustrated-pdf`

### 2. Autenticarse

Ingresa el código de acceso: `TaleMe2025`

### 3. Buscar Historia

1. Obtén el ID (UUID) de la historia desde la base de datos
2. Pega el ID en el campo de búsqueda
3. Click en "Buscar"

### 4. Seleccionar Capítulo

- El panel mostrará todos los capítulos disponibles
- Click en el capítulo que deseas ilustrar
- El primer capítulo se selecciona automáticamente

### 5. Generar PDF

1. Click en "Generar PDF Ilustrado"
2. Espera mientras:
   - Se validan imágenes existentes
   - Se generan imágenes faltantes con IA (portada, escena 1, escena 2)
   - Se crea el PDF ilustrado
3. El PDF se descargará automáticamente

## 🏗️ Arquitectura

### Edge Function: `admin-get-story`

**Ruta**: `/functions/v1/admin-get-story`

**Método**: POST

**Body**:
```json
{
  "storyId": "uuid-de-la-historia",
  "adminCode": "TaleMe2025"
}
```

**Respuesta**:
```json
{
  "story": {
    "id": "uuid",
    "title": "Título",
    "content": "Contenido...",
    "chapters": [...],
    "options": {...},
    "user_id": "uuid-del-usuario",
    ...
  }
}
```

**Características**:
- Usa `SUPABASE_SERVICE_ROLE_KEY` para bypasear RLS
- Valida código de administrador en servidor
- Retorna historia completa con capítulos
- Acceso a cualquier historia sin restricciones

### Componente Frontend: `AdminIllustratedPdfPanel.tsx`

**Ubicación**: `src/pages/AdminIllustratedPdfPanel.tsx`

**Características**:
- Autenticación con código en frontend
- Interfaz moderna con feedback visual
- Barra de progreso en tiempo real
- Gestión de errores completa
- Selección de capítulos
- Descarga automática de PDF

## 🔒 Seguridad

### Validación de Código

El código se valida **dos veces**:
1. En el frontend (para acceder al panel)
2. En la Edge Function (para acceder a los datos)

### Bypass de RLS

La Edge Function usa `service_role` key que tiene permisos totales:
- Solo disponible en el servidor
- Nunca expuesta al cliente
- Necesaria para acceder a datos de todos los usuarios

### Mejores Prácticas

1. **Mantén el código seguro**: Cambia `TaleMe2025` si se compromete
2. **URL privada**: No enlaces públicamente a `/admin/illustrated-pdf`
3. **Monitorea uso**: Revisa logs en Supabase Dashboard
4. **Audita accesos**: Considera agregar logs de quien usa el panel

## 📊 Proceso de Generación

```
1. Usuario ingresa Story ID
   ↓
2. Frontend llama a Edge Function con código
   ↓
3. Edge Function valida código y obtiene historia (bypass RLS)
   ↓
4. Frontend recibe historia completa
   ↓
5. Usuario selecciona capítulo
   ↓
6. StoryPdfService valida imágenes existentes
   ↓
7. Si faltan imágenes → ImageGenerationService genera con IA
   ↓
8. PdfService crea PDF ilustrado
   ↓
9. PDF se descarga automáticamente
```

## 🛠️ Mantenimiento

### Cambiar Código de Acceso

**Frontend**: `src/pages/AdminIllustratedPdfPanel.tsx`
```typescript
const ADMIN_CODE = 'TaleMe2025'; // Cambiar aquí
```

**Backend**: `supabase/functions/admin-get-story/index.ts`
```typescript
const ADMIN_CODE = 'TaleMe2025'; // Cambiar aquí también
```

Después de cambiar, redeploy la Edge Function:
```bash
npx supabase functions deploy admin-get-story
```

### Actualizar Edge Function

```bash
# Desplegar función actualizada
npx supabase functions deploy admin-get-story

# Ver logs en tiempo real
npx supabase functions logs admin-get-story --follow
```

### Agregar Nuevos Campos

Si necesitas más datos de la historia:

1. Actualiza el SELECT en la Edge Function
2. Actualiza el tipo `StoryWithChapters` en `src/types/index.ts`
3. Actualiza el mapeo en `AdminIllustratedPdfPanel.tsx`

## 🐛 Troubleshooting

### Error: "Historia no encontrada"

**Causas**:
- ID incorrecto
- Historia no existe en BD
- Edge Function no desplegada

**Solución**:
1. Verifica el UUID en la base de datos
2. Revisa logs: `npx supabase functions logs admin-get-story`
3. Redeploy: `npx supabase functions deploy admin-get-story`

### Error: "Código de administrador inválido"

**Causas**:
- Código incorrecto en frontend o backend
- Código no sincronizado

**Solución**:
1. Verifica que ambos códigos coincidan
2. Redeploy la Edge Function después de cambios

### Error: "Failed to generate images"

**Causas**:
- API de generación de imágenes sin cuota
- Problema de red
- Error en ImageGenerationService

**Solución**:
1. Revisa logs de generación de imágenes
2. Verifica credenciales de API de IA
3. El sistema generará PDF fallback sin imágenes

## 📝 Notas

- El panel no requiere autenticación de Supabase (solo código interno)
- Puede acceder a historias de cualquier usuario
- Las imágenes generadas se guardan en el bucket `images-stories`
- Los PDFs no se guardan, solo se descargan
- El progreso se muestra en tiempo real durante la generación

## 🔗 Enlaces Útiles

- **Supabase Dashboard**: https://supabase.com/dashboard/project/vljseinehlxrvlghxcyk
- **Edge Functions**: https://supabase.com/dashboard/project/vljseinehlxrvlghxcyk/functions
- **Logs**: Supabase Dashboard → Functions → admin-get-story → Logs

