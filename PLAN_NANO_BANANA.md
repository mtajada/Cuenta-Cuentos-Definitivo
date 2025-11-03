# Plan de Implementación — “Andando a Banana” como proveedor de imágenes por defecto

## Objetivos generales

- **Adoptar “Andando a Banana” (Gemini 2.5 Flash Image, alias oficial “Nano
  Banana”)** como generador principal de
  ilustraciones para cuentos, manteniendo **OpenAI GPT-Image-1** como fallback
  automático y transparente para el usuario.
- **Reutilizar íntegramente los prompts existentes** (`scenes.character`,
  `scenes.cover`, `scene_1`…`closing`) y derivar una **imagen de referencia del
  personaje** para inline prompts que preserve coherencia estética.
- **Alinear los formatos de entrada y salida** con la documentación oficial de
  Gemini (`responseModalities`, `imageConfig.aspectRatio`, `inline_data`) y con
  la infraestructura actual (Supabase Edge Functions + almacenamiento en
  `images-stories`).
- **Mantener la compatibilidad con el flujo actual** (frontend y backend),
  evitando regresiones en la generación de PDFs ilustrados, en la persistencia
  de imágenes, y en los mecanismos de autenticación/registro.
- **Instrumentar observabilidad y métricas clave** (latencia, ratio de fallback,
  bloqueos de política, consistencia) para un rollout controlado.

---

## Resumen arquitectónico

- **Proveedor por defecto:** Gemini (`gemini-2.5-flash-image`), alias interno
  “Andando a Banana”.
- **Fallback:** OpenAI (`gpt-image-1`) invocado automáticamente cuando Gemini
  devuelva error, timeout o respuesta inválida.
- **Pipeline**:
  1. Frontend (`ImageGenerationService`) solicita imágenes en lote respetando el
     orden `character → cover → scene_1 → … → closing`.
  2. Edge Function `generate-image` genera la imagen con Gemini; en caso de
     fallo explícito o validación negativa, ejecuta el mismo request contra
     OpenAI antes de responder.
  3. Edge Function `upload-story-image` almacena la imagen en
     `images-stories/<storyId>/<chapterId>/<imageType>.<ext>` con el `mimeType`
     correcto (`image/png` o `image/jpeg`).
  4. Las URLs públicas se consumen en `StoryPdfService` y en vistas de usuario,
     manteniendo compatibilidad con `.jpeg` y `.png`.

---

## Fase 0 — Preparativos y gobierno del cambio (pre-work obligatorio)

**Subtareas**

- [ ] **Variables de entorno y configuración**
  - [ ] Definir `VITE_IMAGE_PROVIDER_DEFAULT=gemini` y
        `VITE_IMAGE_PROVIDER_FALLBACK=openai` para frontend; en Edge Functions
        usar `IMAGE_PROVIDER_DEFAULT`/`IMAGE_PROVIDER_FALLBACK` sin prefijo
        `VITE_`.
  - [ ] Consolidar `GEMINI_API_KEY`, `GEMINI_COMPATIBLE_ENDPOINT` (para texto
        vía endpoint OpenAI‑compatible `.../v1beta/openai/`), `OPENAI_API_KEY` y
        `IMAGE_MODEL_ID_*` en todos los entornos (local, staging, producción).
  - [ ] Documentar que cualquier configuración compartida debe exponerse
        mediante un helper que resuelva según la plataforma (Vite vs Deno) para
        evitar imports cruzados.
  - [ ] Validar expiración/rotación de claves (política actual de 90 días) e
        incluir alarmas de expiración.

- [ ] **Mapa de tamaños → aspect ratios** (según documentación oficial de
      Gemini)
  - [ ] Adoptar los ratios soportados y sus resoluciones reales (tabla oficial:
        `1:1 → 1024x1024`, `2:3 → 832x1248`, `3:2 → 1248x832`, `4:5 → 896x1152`,
        `5:4 → 1152x896`, `9:16 → 768x1344`, `16:9 → 1344x768`, `21:9 → 1536x672`
        — 1290 tokens por imagen).
  - [ ] Crear helper compartido `mapRequestedSizeToGeminiConfig(size)` que
        traduzca los tamaños heredados (`1024x1536`, `1024x1024`, `1792x1024`,
        `1024x1792`) a `aspectRatio` + `targetResolution` y documente la
        resolución real recibida en metadata (`geminiResolution`).
  - [ ] Añadir verificación automática: si el frontend solicita un `size`
        no reconocido, retornar 400 con mensaje claro antes de invocar Gemini.
  - [ ] Incorporar post-procesado en Edge: cuando la resolución devuelta no
        cumpla con la dimensión esperada por PDFs/UI, reescalar con `Sharp`
        (manteniendo `mimeType` y registrando `resizedFrom` y `resizedTo` en
        metadata). Documentar impacto de latencia.
  - [ ] En fallback OpenAI, solicitar la resolución histórica y, tras recibir la
        imagen, alinear metadatos (`aspectRatioFallback`, `resizedFrom`) para
        mantener consistencia en almacenamiento y consumo.

- [ ] **Feature flag multicapas**
  - [ ] Centralizar lectura de
        `IMAGE_PROVIDER_DEFAULT`/`VITE_IMAGE_PROVIDER_DEFAULT` y
        `IMAGE_PROVIDER_FALLBACK`/`VITE_IMAGE_PROVIDER_FALLBACK` mediante
        helpers específicos para Edge (TypeScript sin Vite) y frontend (Vite).
  - [ ] Crear tabla `app_settings` (`key text PK`, `value jsonb`,
        `updated_at timestamptz`, `updated_by uuid`) con migración y aplicar RLS
        restrictivo: solo rol `service_role` podrá `select`/`update`; crear
        función `fn_get_app_setting(key text)` (SECURITY DEFINER) que exponga
        lectura segura para Edge Functions y vista `app_settings_public` con
        campos whitelisted para el frontend admin (solo usuarios con rol
        `is_admin`).
  - [ ] Implementar `cache` en memoria (TTL 60 s) en Edge y `swr` en frontend
        admin con invalidación explícita tras updates, evitando inconsistencias.
  - [ ] Documentar procedimiento de override manual: mutación desde panel admin
        (llama a RPC autenticada con `service_role`), verificación en Supabase
        Dashboard y limpieza de cachés (frontend + Edge).
  - [ ] Asegurar logs diferenciados por proveedor (`[ANDANDO]`,
        `[OPENAI_FALLBACK]`) con IDs hashed de historia/capítulo y
        `storyRegion`, redactando prompts sensibles.

- [ ] **Checklist de cumplimiento**
  - [ ] Extender perfiles con `country_code` (ISO-3166-1 alpha-2) mediante
        migración y sincronizarlo en onboarding; si no se dispone, requerir
        parámetro explícito en el request del frontend (`storyRegion`).
  - [ ] Revisar restricciones regionales documentadas: Gemini solo prohíbe
        subir imágenes de menores en EEA/CH/UK; la generación `text-to-image`
        permanece permitida. Implementar validación que impida cargar fotos
        reales desde esas regiones (por si en el futuro se admite uploads) y
        registrar `policyContext='child_upload_restricted'` cuando se rechace.
  - [ ] Alinear manejo de bloqueos: si Gemini responde `SAFETY`, devolver 400
        con detalle y no forzar fallback. Solo utilizar fallback ante errores
        técnicos (timeout, 5xx, respuesta incompleta).
  - [ ] Confirmar aceptación del watermark SynthID y documentar en términos de
        uso internos y políticas públicas.
  - [ ] Definir mecanismo para conocer región (perfil, override manual, geo-IP)
        y propagarla por request (Edge anota `storyRegion` en metadata).
  - [ ] Documentar métricas claves (tiempo por imagen, ratio de fallbacks,
        errores 4xx/5xx, bloqueos de política) y publicarlas en dashboard.
  - [ ] Ajustar límites de consumo contemplando coste Gemini (1290
        tokens/imagen) y reflejarlo en mensajes de cuota.

---

## Fase 1 — Backend (Supabase Edge Functions)

### Subfase 1.1 — Actualizar `generate-image`

- [ ] **Arquitectura multi-proveedor**
  - [ ] Crear módulo `providers.ts` con funciones `generateWithGemini` y
        `generateWithOpenAI` que regresen respuesta normalizada (`base64`,
        `mimeType`, `latencyMs`, `finishReason`, `safetyRatings`,
        `originalResolution`).
  - [ ] Resolver proveedor por solicitud: intentar Gemini cuando
        `imageProviderDefault === 'gemini'` y la región lo permita; ante errores
        técnicos (timeout, `AbortError`, `HTTP>=500`, `EMPTY_IMAGE`) ejecutar
        fallback automático contra OpenAI.
  - [ ] Incorporar helper `normalizeImageResolution` que reciba el `Uint8Array`
        generado, aplique reescalado cuando `targetResolution` difiera y devuelva
        buffer + metadata actualizada.
  - [ ] Ante bloqueos de política (`finishReason === 'SAFETY'` o
        `safetyRatings[].blocked === true`) devolver 400 y no invocar fallback,
        alineando cumplimiento.
  - [ ] Registrar métricas (`latencyGeminiMs`, `latencyOpenAiMs`,
        `fallbackReason`, `resizedFrom`, `resizedTo`) y devolverlas al cliente.
  - [ ] Exponer en la respuesta final `metadata.providerUsed`,
        `metadata.fallbackUsed`, `metadata.fallbackReason`.
- [ ] **Cliente Gemini**
  - [ ] Sustituir `OpenAI` por `fetch` (o cliente minimalista) contra
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent`,
        usando **direct endpoint nativo** (no el compatible con OpenAI) según la
        documentación de imagen.
  - [ ] Incluir encabezados `x-goog-api-key` y
        `Content-Type: 'application/json'`.
  - [ ] Construir body con `contents` y `generationConfig` exactamente como
        detalla la guía oficial (ver snippet en doc).
  - [ ] Aplicar `AbortController` con timeout ≤ 55s y manejo explícito de
        `AbortError`.
  - [ ] Añadir logging de request (prompt resumido, ratio) sin exponer datos
        sensibles.
  - [ ] Normalizar parámetros según proveedor: eliminar `quality='medium'` y
        `background` para Gemini; mapear a `{"style": "natural" | "vivid"}` solo
        en OpenAI.

- [ ] **Soporte de imagen de referencia**
  - [ ] Añadir campos opcionales `referenceImageBase64`, `referenceImagePath` y
        `referenceImageMimeType` al request interno.
  - [ ] Insertar `inline_data` solo cuando exista referencia válida (`image/png`
        o `image/jpeg`).
  - [ ] Validar límite de Gemini: máx. 3 imágenes en entrada → restringir a 1
        referencia (character) y rechazar solicitudes con más.
  - [ ] Sanitizar base64 para evitar inputs malformados y registrar
        `consistencyLost=true` cuando falte referencia.
  - [ ] Gestionar la referencia únicamente desde backend: el frontend sólo envía
        `storyId`/`chapterId`, y el Edge Function lee la referencia desde
        Storage para mantener una única fuente de verdad.

- [ ] **Parseo de respuesta**
  - [ ] Extraer `inline_data.data` y `mime_type` de
        `candidates[0].content.parts`.
  - [ ] Validar `finishReason` distinto de `SAFETY` o `STOP` inesperado; si es
        `SAFETY` → retornar error 400 específico (política).
  - [ ] Verificar que la respuesta incluya al menos una parte de imagen; si solo
        hay texto, disparar fallback.
  - [ ] Manejar `response.candidates` vacío → fallback inmediato e
        instrumentar `fallbackReason='EMPTY_CANDIDATES'`.

- [ ] **Fallback OpenAI**
  - [ ] Ejecutar fallback únicamente ante `AbortError`, `HTTP>=500`, errores de
        red o respuestas vacías.
  - [ ] Reutilizar cliente actual de OpenAI ajustando `size` al mapa de
        degradación (`2:3` heredado → solicitar `1024x1536` y reescalar a
        `832x1248`, etc.), manteniendo consistencia con los ratios de Gemini.
  - [ ] Registrar métricas (`providerUsed`, `fallbackReason`, `latencyMs`,
        `aspectRatioFallback`, `resizedFrom`, `resizedTo`).
  - [ ] Propagar en la respuesta `metadata.providerUsed = 'gemini' | 'openai'`,
        `metadata.fallbackUsed`, `metadata.consistencyLost`.

- [ ] **Metadatos y respuesta**
  - [ ] Mantener `success`, `imageBase64`, `imageUrl`, `publicUrl`, `metadata`.
  - [ ] En `metadata`, añadir `providerUsed`, `fallbackUsed`, `fallbackReason`,
        `aspectRatio`, `aspectRatioFallback`, `mimeType`, `latencyMs`,
        `consistencyLost`, `storyRegion`, `originalResolution`, `finalResolution`.
  - [ ] Hacer opcional `imageBase64`: devolverlo solo cuando el cliente lo
        solicite explícitamente (`includeBase64`) o cuando `publicUrl` no esté
        disponible, reduciendo payload y latencia. Documentar ajuste para
        clientes legacy (StoryPdfService usa URLs).

### Subfase 1.2 — Generar y persistir imagen de personaje

- [ ] **Extender flujo para `IMAGES_TYPE.CHARACTER`**
  - [ ] Incorporar endpoint (ya sea dentro de `generate-image` o como helper)
        que genere `character` con `scenes.character` antes de las escenas.
  - [ ] Guardar resultado en
        `images-stories/<storyId>/character.<ext>` (sin `chapterId`) con
        metadata (`provider`, `mimeType`, `latencyMs`, `originalResolution`).
  - [ ] Evitar regeneraciones: si la ruta existe y la metadata es válida,
        reutilizar la imagen y registrar `characterCacheHit=true`.
- [ ] **Uso como referencia**
  - [ ] Al generar `cover` y escenas, recuperar la imagen del personaje (desde
        storage o caché) y enviarla como `referenceImageBase64`.
  - [ ] Si no se puede recuperar, reintentar generarla; tras dos fallos,
        continuar sin referencia pero marcar `consistencyLost=true`.

### Subfase 1.3 — Actualizar `upload-story-image`

- [ ] **Entradas ampliadas**
  - [ ] Aceptar `mimeType` obligatorio cuando se recibe `imageBase64`; validar
        enumeración (`image/png`, `image/jpeg`).
  - [ ] Permitir `fileExtension` opcional (derivada automáticamente si no se
        pasa).
  - [ ] Mantener soporte legacy para `imageUrl` remoto (aunque Gemini no lo
        use).
  - [ ] Registrar `providerUsed` e `imageHash` en metadata opcional para
        auditoría.
  - [ ] Actualizar los callers (`generateWithGemini`, `generateWithOpenAI`,
        fallback en frontend) para enviar `mimeType` y `providerUsed`, evitando
        regresiones.

- [ ] **Rutas dinámicas**
  - [ ] Generar path usando extensión consistente (`.png` o `.jpeg`).
  - [ ] Ajustar `contentType` en `storage.upload` al `mimeType` real.
  - [ ] Seguir usando `upsert: true` y registrar operación exitosa.

- [ ] **Respuesta**
  - [ ] Incluir `mimeType`, `extension`, `providerUsed` en el payload.
  - [ ] Mantener `success`, `publicUrl`, `path` para compatibilidad.
  - [ ] Añadir logs detallados (`[UPLOAD_STORY_IMAGE]`) con tamaño de archivo y
        proveedor.
  - [ ] Registrar/actualizar fila en `story_images` con metadata completa
        (`provider`, `fallback_used`, `latency_ms`, `original_resolution`,
        `final_resolution`, `resized_from`, `resized_to`, `storyRegion`).

### Subfase 1.4 — Validaciones y pruebas unitarias

- [ ] **Casos positivos**
  - [ ] Generación de `character` → almacena imagen única y reutilizable.
  - [ ] Solicitud con `referenceImageBase64` → Gemini responde imagen, se sube
        `.png`.
  - [ ] Solicitud sin referencia → Gemini genera imagen; sin errores.
  - [ ] Gemini falla → fallback OpenAI entrega imagen válida.

- [ ] **Casos negativos**
  - [ ] Aspect ratio no soportado → 400 con mensaje claro y sin consumir
        créditos.
  - [ ] `mimeType` inválido → 400 (validación server-side).
  - [ ] Timeout Gemini → fallback + log; si fallback también falla,
        retornar 502.
  - [ ] Rechazo por políticas (`SAFETY`) → retornar 400 y sugerir modificar
        prompt.
  - [ ] Simulación de upload de imagen real de menor desde EEA/CH/UK → rechazar
        con código y mensaje documentado (`policyContext='child_upload_restricted'`).
  - [ ] Errores de storage (bucket lleno, permisos) → 500 con trazas y reintento
        manual documentado.

---

## Fase 2 — Frontend (Servicios y stores)

### Subfase 2.1 — Servicio `ImageGenerationService`

- [ ] **Configuración**
  - [ ] Reemplazar la constante `MODEL = 'gpt-image-1'` por lectura del helper
        de provider (incluye modelo y parámetros) usando
        `VITE_IMAGE_PROVIDER_DEFAULT`.
  - [ ] Mapear `size` a `aspectRatio` mediante helper compartido (mismo mapa que
        en backend) y registrar warnings en caso de fallback a `'1:1'`.
  - [ ] Propagar `IMAGE_PROVIDER_FALLBACK` y `providerOverride` (QA) para
        telemetría.

- [ ] **Secuencia de imágenes**
  - [ ] Generar `IMAGES_TYPE.CHARACTER` primero; si falla → reintentar una vez
        y, de persistir, abortar con error orientado.
  - [ ] Mantener solo `path` y metadata ligera del personaje en memoria (sin
        almacenar `base64`) y permitir refrescarlo desde backend bajo demanda.
  - [ ] Para `cover` y `scene_1..closing`, continuar enviando `prompt` +
        identificadores (`storyId`, `chapterId`) y flags; eliminar cualquier
        flujo que envíe `base64` desde el cliente para evitar duplicados.
  - [ ] Limitar concurrencia previa según proveedor activo (si
        `IMAGE_PROVIDER_DEFAULT==='gemini'`, iniciar con pool=2; caso contrario
        mantener 3).
  - [ ] Incluir `imageGenerationProgress` granular (por imagen) notificando
        proveedor y duración.

- [ ] **Fallback automático y reporting**
  - [ ] Detectar `metadata.fallbackUsed` → registrar warning, actualizar
        contador local y emitir evento UI opcional.
  - [ ] Si fallback también falla, devolver error claro y sugerir reintento.
  - [ ] Adjuntar en los resultados `providerUsed`, `fallbackUsed`, `latencyMs`,
        `mimeType`, `consistencyLost`, `originalResolution`, `finalResolution`.

- [ ] **Compatibilidad con prompts**
  - [ ] Reutilizar `scenes.<key>` tal como llegan (sin sanitizar ni truncar).
  - [ ] Validar que `scenes.character` ≥ 100 caracteres y mostrar aviso si no
        cumple.
  - [ ] Mantener check de prompts vacíos (throw Error) e instruir al usuario a
        regenerar scenes.
  - [ ] Ajustar requests a Edge para enviar `includeBase64=false` por defecto y
        `desiredResolution` (para logging), alineado con el nuevo helper.

### Subfase 2.2 — Integraciones posteriores

- [ ] **StoryPdfService**
  - [ ] Actualizar `validateRequiredImages` para buscar `.jpeg` y, si no existe,
        `.png`.
  - [ ] Adaptar validación HEAD para ambos MIME.
  - [ ] Leer metadata desde `story_images` (cuando exista) para evitar llamadas
        repetidas y enriquecer el flujo sin recalcular hashes.
  - [ ] Persistir metadata por imagen (`providerUsed`, `fallbackUsed`,
        `latencyMs`, `originalResolution`, `finalResolution`) en la respuesta
        agregada y exponerla a la UI/admin.
  - [ ] Mostrar en progreso si alguna imagen proviene del fallback (para
        soporte) y si se reescaló (`resizedFrom`).

- [ ] **UI / Feedback al usuario**
  - [ ] Opcional: mensaje discreto cuando se use fallback (para debugging).
  - [ ] Mantener progress bar 35s y disparar toast si se supera, sugiriendo
        esperar.
  - [ ] Verificar que los prompts no aparezcan visibles en UI (seguridad).
  - [ ] Mostrar proveedor usado, latencia y si hubo reescalado por imagen en el
        panel admin (apoyándose en metadata persistida).
  - [ ] Actualizar `docs/ADMIN_ILLUSTRATED_PDF_PANEL.md` con nuevas métricas y
        toggles.

- [ ] **Feature toggle en runtime**
  - [ ] Implementar carga de flags desde Supabase (p. ej., tabla
        `app_settings`) usando vista `app_settings_public`.
  - [ ] Cachear valor con TTL corto (60s) para reaccionar rápido y permitir
        invalidación manual tras overrides.
  - [ ] Mostrar proveedor activo, porcentaje de fallbacks y fecha del último
        override en `/admin/illustrated-pdf`.

---

## Fase 3 — Persistencia y coherencia de almacenamiento

**Subtareas**

- [ ] **Bucket `images-stories`**
  - [ ] Revisar políticas RLS/ACL (no se esperan cambios, pero auditar accesos).
  - [ ] Registrar nuevas rutas `.png` en auditoría.
  - [ ] Validar expiración de URLs públicas con `getPublicUrl` (se mantiene).
  - [ ] Ejecutar script de backfill para asignar `mimeType` a imágenes
        existentes y normalizar extensiones engañosas, registrando también
        `originalResolution` y `finalResolution` calculadas.
  - [ ] Generar reporte mensual (`CSV + dashboard Supabase`) de tamaño promedio
        por imagen y ratio de reescalado para estimar coste de almacenamiento.

- [ ] **Base de datos (`stories.scenes`)**
  - [ ] Confirmar que `scenes` sigue siendo JSON válido tras generación (no se
        requiere migración).
  - [ ] Actualizar documentación interna aclarando que `scenes.character`
        alimenta la referencia visual.
  - [ ] Añadir check en QA que verifique coherencia semántica (descr. incluye
        colores/ropa).
  - [ ] Crear tabla `story_images` con metadatos (`story_id`, `chapter_id`,
        `image_type`, `provider`, `fallback_used`, `mimeType`,
        `original_resolution`, `final_resolution`, `latency_ms`,
        `consistency_lost`, `resized_from`, `resized_to`, `created_at`) y vista
        agregada para panel admin.

- [ ] **Referencias a extensión en otros servicios**
  - [ ] Auditar scripts o cron jobs que supongan `.jpeg`.
  - [ ] Documentar formato final (aceptar `.jpeg` y `.png`) en README
        repositorio y runbooks.
  - [ ] Depurar funciones obsoletas (`generate-illustrated-story`,
        `generate-illustrated-pdf`) o alinearlas con el nuevo flujo para evitar
        confusión.

---

## Fase 4 — QA, monitorización y despliegue

### Subfase 4.1 — QA funcional

- [ ] **Escenarios guiados**
  - [ ] Historia con 1 personaje → verificar consistencia en 6 imágenes (sin
        fallback idealmente).
  - [ ] Historia con 4 personajes → confirmar que prompts conservan detalles de
        todos y la referencia funciona.
  - [ ] Historia generada en inglés → confirmar que Gemini responde
        correctamente (idioma soportado).
- [ ] **Validaciones automatizadas**
  - [ ] Script QA que descargue las seis imágenes, verifique `mimeType`, tamaño
        esperado y presencia de SynthID.
  - [ ] Verificar que `finalResolution` coincide con lo almacenado y que, si se
        aplicó reescalado, la imagen mantiene proporciones correctas.
  - [ ] Validar que la imagen de personaje se reutiliza (comparar hash) y que
        `consistencyLost` no se activa.
  - [ ] Generar PDF ilustrado y confirmar que renderiza `.png` sin fondos
        transparentes indeseados.

- [ ] **Casos especiales**
  - [ ] Petición desde cuenta/región EU (si detectable) → confirmar que la
        generación `text-to-image` funciona y que se registra `storyRegion` en
        metadata sin activar fallback.
  - [ ] Prompt con texto prohibido (violencia explícita) → se espera error de
        Gemini; fallback no debe ejecutarse para evitar incumplir políticas
        (salvo si negocio decide lo contrario).
  - [ ] Solicitud sin `scenes` (legacy) → generar scenes on demand antes de
        invocar generación de imágenes.

### Subfase 4.2 — QA técnico

- [ ] **Latencia y tasa de éxito**
  - [ ] Medir tiempo promedio por imagen (Gemini vs fallback) y comparar con
        baseline OpenAI.
  - [ ] Objetivo: ratio de fallback < 5%; si supera umbral, ajustar prompts o
        incrementar timeouts.
  - [ ] Configurar alertas: `fallbackRatio>10%` (warning),
        `GeminiLatencyP95>25s` (critical), `consistencyLost` > 0 en 3 historias
        consecutivas (critical), `PolicyBlocks>0` en 24 h (warning).

- [ ] **Validación de formatos**
  - [ ] Auditar `mimeType` almacenado en Supabase (dashboard o script).
  - [ ] Descargar muestras aleatorias y verificar presencia de SynthID
        (metadatos) y calidad.
  - [ ] Confirmar que las imágenes siguen siendo aptas para PDF (sin
        transparencias problemáticas) y que el reescalado conserva la relación
        de aspecto objetivo.

### Subfase 4.3 — Rollout por etapas

- [ ] **Deploy en Supabase (Edge Functions)**
  - [ ] Deploy `generate-image` y `upload-story-image` (en ese orden).
  - [ ] Activar logs `debug` temporalmente y verificar en consola Supabase.

- [ ] **Deploy frontend**
  - [ ] Actualizar bundle con nuevo flujo y toggles.
  - [ ] Cambiar `IMAGE_PROVIDER_DEFAULT` a `gemini` una vez verificado backend.

- [ ] **Post-rollout**
  - [ ] Monitorizar logs ≥ 24h (especialmente `fallbackReason`,
        `consistencyLost`).
  - [ ] Revisar métricas (latencia, tasa de error, bloqueos regionales) y
        notificar a stakeholders.
  - [ ] Desactivar logs `debug` tras validación para reducir ruido.
  - [ ] Programar retro a 7 días para evaluar costes, feedback de usuarios y
        posibles ajustes de prompts.

---

## Especificación técnica por capa

- **Backend (Supabase Edge)**
  - `supabase/functions/generate-image/index.ts`
    - Manejo de proveedores múltiples, mapping de aspect ratios, generación de
      personaje, fallback y métricas.
  - `supabase/functions/upload-story-image/index.ts`
    - Storage multi-mime y metadata extendida.
  - `supabase/functions/generate-scenes-from-content/index.ts`
    - Fuente de prompts; validar longitud de `scenes.character` y calidad antes
      de generar imágenes.
  - Seguridad: mantiene autenticación `Bearer`, CORS dinámico
    (`_shared/cors.ts`).

- **Frontend**
  - `src/services/ai/imageGenerationService.ts`
    - Secuencia controlada, referencia visual delegada al backend, manejo de
      fallback y reporting de métricas.
  - `src/services/storyPdfService.ts`
    - Validación doble extensión, logs de provider y fallback en PDF.
  - `src/pages/AdminIllustratedPdfPanel.tsx`
    - Mostrar proveedor activo, ratio de fallbacks y permitir toggle manual
      admin.

- **Prompts**
  - `supabase/functions/generate-story/prompt.ts`
    - Sin cambios; se garantiza que `scenes` incluyen descripción exhaustiva y
      se reutilizan tal cual.

---

## Referencias

- Documentación oficial Gemini Image Generation (aka Nano Banana):
  `https://ai.google.dev/gemini-api/docs/image-generation`
- Código actual relevante:
  - `supabase/functions/generate-image/index.ts` (flujo de imágenes).
  - `supabase/functions/upload-story-image/index.ts` (subida a storage).
  - `supabase/functions/generate-scenes-from-content/index.ts` (regeneración de
    prompts).
  - `src/services/ai/imageGenerationService.ts` (orquestación frontend).
  - `src/services/storyPdfService.ts` (consumo y validación).
  - `supabase/functions/generate-story/prompt.ts` (prompts reutilizados con
    `scenes`).
- Referencia de aspect ratios (Gemini): tabla incluida en documentación oficial
  (`Aspect ratios`).

---

## Resultado esperado

- “Andando a Banana” genera todas las imágenes por defecto, aprovechando las
  descripciones existentes en `scenes`.
- OpenAI solo interviene cuando Gemini rechaza o falla, sin bloquear al usuario.
- El pipeline conserva la consistencia visual gracias a la imagen de referencia
  y a los prompts sin cambios.
- El almacenamiento maneja múltiples formatos y el frontend sigue funcionando
  con independencia del proveedor activo.
- Observabilidad y métricas permiten detectar a tiempo degradaciones (latencia,
  fallbacks, bloqueos regionales) y actuar con toggles.
