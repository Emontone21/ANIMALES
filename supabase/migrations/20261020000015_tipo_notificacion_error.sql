-- =============================================================================
-- 0015 · Aviso nuevo en Actividad: reportes de errores
-- Va solo en esta migración: Postgres no deja usar un valor de enum en la misma
-- transacción en que se agrega (ver docs/DECISIONES.md, "El valor 'perdido' del
-- enum va en una migración aparte"). Lo usa la 0016.
-- =============================================================================

alter type public.tipo_notificacion add value if not exists 'error';
