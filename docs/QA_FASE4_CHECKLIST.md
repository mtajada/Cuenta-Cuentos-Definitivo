# QA Fase 4 – Ilustraciones (Gemini → OpenAI fallback)

Guía rápida para validar el pipeline de generación de imágenes y monitorear el despliegue. Cubre pruebas manuales de extremo a extremo y las métricas mínimas que se deben observar tras cada release.

## Checklist manual (funcional)

- Historia con un personaje: crear/generar un cuento con un solo personaje; verificar que todas las ilustraciones (cover + escenas) llegan como `.jpeg`, ratio 4:5 y que `providerUsed` sea `gemini` salvo fallos técnicos; revisar que el PDF A4 alterna texto/imagen sin bandas.
- Historia con múltiples personajes (1-4): generar con 3-4 personajes (puedes usar los de `test-edge-functions/test-data.js`); comprobar coherencia visual usando la ilustración de personaje y que cada escena los menciona; revisar que `story_images` tenga filas por `image_type` y `fallback_used=false` salvo error real.
- Idioma alternativo: generar la misma historia en inglés (u otro idioma soportado); validar que el texto completo y las imágenes se generan y que las URLs públicas funcionan en el PDF; no debe haber regresiones por idioma.
- Prompt bloqueado por políticas: enviar un prompt intencionalmente bloqueado; esperar un `400` con mensaje de política y **sin** fallback a OpenAI; la UI debe mostrar el error claro sin reintentos automáticos.
- Descarga y revisión de assets: usar el script `scripts/qa/image-audit.js` para las URLs generadas; validar `mimeType=image/jpeg`, resolución final A4 (1654x2339 px) y registrar si hay marca SynthID cuando aplique.

### Script `scripts/qa/image-audit.js`
- Ejecutar con `node scripts/qa/image-audit.js --file urls.txt` (una URL por línea) o pasando URLs sueltas.
- Salida: muestra mime del header vs sniff, resolución, peso y un hint de SynthID (header si existe). Devuelve código de salida `1` si encuentra fallos de mime/resolución/descarga.
- A4 esperado: 1654x2339 px (200 dpi). Mime esperado: `image/jpeg`.

## Métricas de despliegue (Supabase)

- Latencia media por proveedor (ms, últimos 7 días):
  ```sql
  select provider, round(avg(latency_ms)) as avg_latency_ms, count(*) as total
  from public.story_images
  where created_at > now() - interval '7 days'
  group by provider;
  ```
- Ratio de fallback (Gemini→OpenAI):
  ```sql
  select round(100.0 * sum(case when fallback_used then 1 else 0 end) / nullif(count(*),0), 2) as fallback_pct,
         sum(case when fallback_used then 1 else 0 end) as fallback_count,
         count(*) as total
  from public.story_images
  where created_at > now() - interval '7 days';
  ```
- Errores 4xx/5xx en Edge Functions: en el Log Explorer de Supabase, filtrar función `generate-image` y agrupar por `status >= 500` vs `status = 400`; abrir alerta si 5xx > 2% o 400 por políticas aumenta.
- Bloqueos de políticas: contar respuestas con `finishReason === 'SAFETY'` (logs de generate-image) y asegurar que no generan fallback; si superan el 3%, ajustar prompt/instrucciones.
- SynthID/seguridad: registrar manualmente en las revisiones si la marca está presente (ver script); si se detecta, documentar proveedor y fecha para trazabilidad.

## Procedimiento rápido de QA (por release)

1) Ejecutar los 4 casos manuales anteriores en staging (idioma ES + EN, 1 personaje, 3-4 personajes, prompt bloqueado).  
2) Descargar las URLs resultantes y correr `node scripts/qa/image-audit.js --file urls.txt` (ver script).  
3) Consultar métricas con las consultas SQL y revisar logs de Supabase (generate-image/upload-story-image).  
4) Si `fallback_pct > 5%` o latencia media > 6s en Gemini, ajustar timeouts/prompts antes de producción.  
5) Registrar hallazgos y capturas breves en el canal de despliegue.
