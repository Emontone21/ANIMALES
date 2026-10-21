-- =============================================================================
-- 0022 · El contacto de la familia se borra al cerrar el caso (B10)
-- animales.contacto_familia es público mientras se ve el caso. Cuando el caso
-- pasa a reunido o vinculado ya no hace falta, y seguía visible por la API.
-- Ahora se vacía en ese momento, venga de donde venga el cambio:
-- cambiar_estado_animal (reunido) o resolver_coincidencia (vinculado). Si la
-- familia reabre el caso, no vuelve: lo puede cargar de nuevo al editarlo.
-- También se vacía en los casos que ya estaban cerrados.
-- Ver docs/DECISIONES.md, "El contacto de la familia se borra al cerrar".
-- Prueba: supabase/tests/contacto_al_cerrar.sql.
-- =============================================================================

create or replace function public.vaciar_contacto_al_cerrar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.contacto_familia := null;
  return new;
end;
$$;

revoke all on function public.vaciar_contacto_al_cerrar from public, anon, authenticated;

create trigger animales_contacto_al_cerrar
  before update of estado on public.animales
  for each row
  when (
    new.estado in ('reunido', 'vinculado')
    and old.estado is distinct from new.estado
    and new.contacto_familia is not null
  )
  execute function public.vaciar_contacto_al_cerrar();

-- Los que ya estaban cerrados.
update public.animales set contacto_familia = null
where estado in ('reunido', 'vinculado') and contacto_familia is not null;
