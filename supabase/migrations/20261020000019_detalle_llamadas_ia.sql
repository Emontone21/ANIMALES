-- =============================================================================
-- 0019 · El texto del error de la API en llamadas_ia.detalle
-- En la primera prueba real, la API rechazó las fotos de demo con
-- invalid_request_error y solo había quedado el tipo: no se supo por qué.
-- Desde ahora la función guarda también el texto del error, sin claves ni
-- datos personales (limpiarDetalle, supabase/functions/reconocer/claude.ts),
-- hasta 300 caracteres. En la cola (cola_vision.ultimo_error) sigue solo el
-- código. Ver docs/reportes/2026-10-20-cierre-reconocimiento-ia.md.
-- =============================================================================

alter table public.llamadas_ia drop constraint llamadas_ia_detalle_check;
alter table public.llamadas_ia
  add constraint llamadas_ia_detalle_check check (char_length(detalle) <= 300);

comment on column public.llamadas_ia.detalle is
  'El error de la API (tipo, texto y id del pedido, sin claves ni datos personales) o qué no validó. Hasta 300 caracteres.';

-- Igual que en la 0018, con el tope nuevo.
create or replace function public.terminar_llamada_ia(
  p_id bigint,
  p_resultado text,
  p_tokens_entrada integer,
  p_tokens_salida integer,
  p_costo_usd numeric,
  p_detalle text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.llamadas_ia
  set resultado = p_resultado,
      tokens_entrada = greatest(coalesce(p_tokens_entrada, 0), 0),
      tokens_salida = greatest(coalesce(p_tokens_salida, 0), 0),
      costo_usd = p_costo_usd,
      detalle = left(p_detalle, 300),
      terminada_en = now()
  where id = p_id;
end;
$$;

revoke all on function public.terminar_llamada_ia from public, anon, authenticated;
grant execute on function public.terminar_llamada_ia to service_role;
