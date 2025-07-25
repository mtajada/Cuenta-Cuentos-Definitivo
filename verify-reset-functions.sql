-- ======================================
-- VERIFICACIÓN DE FUNCIONES DE RESET
-- ======================================

-- 1. VERIFICAR SI EL CRON JOB ESTÁ PROGRAMADO
SELECT * FROM cron.job WHERE jobname = 'monthly_story_reset';

-- 2. VER HISTORIAL DE EJECUCIONES DEL CRON JOB (últimas 10)
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'monthly_story_reset')
ORDER BY start_time DESC 
LIMIT 10;

-- 3. VERIFICAR ESTADO ACTUAL DE USUARIOS (muestra de datos)
SELECT 
    id,
    subscription_status,
    monthly_stories_generated,
    monthly_voice_generations_used,
    voice_credits,
    created_at,
    updated_at
FROM public.profiles 
ORDER BY updated_at DESC 
LIMIT 10;

-- 4. CONTAR USUARIOS POR TIPO DE SUSCRIPCIÓN
SELECT 
    subscription_status,
    COUNT(*) as user_count,
    AVG(monthly_stories_generated) as avg_stories,
    AVG(monthly_voice_generations_used) as avg_voice_generations,
    AVG(voice_credits) as avg_voice_credits
FROM public.profiles 
GROUP BY subscription_status;

-- 5. VERIFICAR USUARIOS QUE NECESITAN RESET (solo gratuitos con historias > 0)
SELECT 
    id,
    subscription_status,
    monthly_stories_generated,
    updated_at
FROM public.profiles 
WHERE (subscription_status IS NULL OR subscription_status NOT IN ('active', 'trialing'))
  AND monthly_stories_generated > 0
ORDER BY monthly_stories_generated DESC;

-- 6. SIMULAR EJECUCIÓN DE RESET (NO ejecutar en producción sin backup)
-- SELECT public.reset_monthly_counters(); -- DESCOMENTADO SOLO PARA TESTING

-- 7. VERIFICAR LOGS DE POSTGRESQL (requiere permisos de superusuario)
-- SELECT * FROM pg_stat_statements WHERE query LIKE '%reset_monthly_counters%'; 