-- =============================================================================
-- 0009 · Fase 6 (1 de 2): valor 'perdido' en tipo_avistamiento
-- perdido: el primer avistamiento de un reporte de animal perdido, el lugar y
-- el momento en que lo vieron por última vez.
--
-- Va en un archivo aparte porque un valor nuevo de enum no se puede usar en la
-- misma transacción en la que se agrega, y `supabase db push` corre cada
-- archivo en su propia transacción. La 0010 ya lo puede usar. En el SQL Editor
-- hay que ejecutar los dos archivos por separado, en orden.
-- =============================================================================

alter type public.tipo_avistamiento add value if not exists 'perdido';
