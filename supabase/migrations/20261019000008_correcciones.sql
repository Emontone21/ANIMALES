-- =============================================================================
-- 0008 · INSERT limitado por columna en mensajes y denuncias
-- La 0007 acotó los UPDATE por columna, pero los INSERT seguían aceptando
-- cualquier columna:
--   · mensajes: quien envía podía fijar leido_en (el mensaje llegaba ya leído y
--     no sumaba a "no leídos") o created_at (reordenar la conversación).
--   · denuncias: quien denuncia podía crearla ya 'revisada' o 'descartada' y
--     sacarla de la cola de moderación, o fijar created_at.
-- Se conceden solo las columnas que manda la app; el resto toma su default.
-- Las políticas de INSERT existentes siguen limitando qué filas.
-- =============================================================================

revoke insert on public.mensajes from anon, authenticated;
grant insert (conversacion_id, emisor_id, cuerpo) on public.mensajes to authenticated;

revoke insert on public.denuncias from anon, authenticated;
grant insert (animal_id, avistamiento_id, usuario_id, motivo, detalle) on public.denuncias to authenticated;
