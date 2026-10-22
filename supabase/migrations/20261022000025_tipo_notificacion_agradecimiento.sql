-- =============================================================================
-- 0025 · Aviso nuevo en Actividad: el agradecimiento de una familia
-- Va solo en esta migración: Postgres no deja usar un valor de enum en la misma
-- transacción en que se agrega (ver docs/DECISIONES.md, "El valor 'perdido' del
-- enum va en una migración aparte"). Lo usa la 0026.
-- =============================================================================

alter type public.tipo_notificacion add value if not exists 'agradecimiento';
