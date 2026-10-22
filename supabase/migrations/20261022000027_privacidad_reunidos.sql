-- =============================================================================
-- 0027 · Privacidad de los casos reunidos
-- Cuando el animal volvió a casa, el mapa, la zona donde se perdió, los avisos,
-- el historial, las coincidencias y los contactos ya no le sirven al público y
-- pueden ayudar a ubicar la casa de la familia. En un caso reunido (y en los
-- reportes unidos a él), quien no participó ve solo lo básico: la foto, el
-- nombre si la familia lo mostró, la especie y que volvió a casa (la historia
-- del muro sale de sus RPC de siempre). Participaron, en cualquier reporte del
-- caso:
--   - quien publicó un reporte;
--   - quien avisó que lo vio, lo encontró o lo resguardó (avistamientos);
--   - quien le cambió el estado (cambios_estado);
--   - quien escribió en una conversación del caso antes de que se reuniera
--     (escribir después no abre el resto);
--   - moderación.
-- Si la familia bloqueó a alguien, esa persona ve lo básico aunque haya
-- participado. Sin cuenta, siempre lo básico.
-- 1. ve_detalle_del_caso: la regla, en las políticas de lectura de
--    avistamientos, cambios_estado, contactos_resguardo y coincidencias.
-- 2. animales.nombre y animales.descripcion dejan de leerse directo de la
--    tabla: salen de vista_del_caso, que aplica la regla y, si la familia contó
--    la historia sin el nombre, tampoco lo da.
-- 3. Las vistas: animales_detalle deja solo lo básico y suma "reservado";
--    animales_mapa ya no trae esos casos; coincidencias_detalle y
--    denuncias_detalle toman el nombre y la descripción de vista_del_caso.
-- Si el caso se reabre, vuelve a verse todo: la regla mira el estado actual.
-- Prueba: supabase/tests/privacidad_reunidos.sql. Ver docs/DECISIONES.md,
-- "Privacidad de los casos reunidos".
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. La regla
-- ---------------------------------------------------------------------------

-- Si p_uid participó en el caso de p_principal (todo el árbol de reportes
-- unidos). Interna: la usa ve_detalle_del_caso.
create or replace function public.participo_en_caso(p_principal uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with arbol as (
    select x.id from public.arbol_de_casos(array[p_principal]) as x (id)
  ), caso as (
    select
      a.creado_por as familia,
      -- La última vez que se reunió. Sin ese registro (datos cargados por
      -- SQL), cuenta todo lo escrito.
      coalesce(
        (select max(c.created_at) from public.cambios_estado c
         where c.animal_id = a.id and c.estado_nuevo = 'reunido'),
        'infinity'::timestamptz
      ) as reunido_en
    from public.animales a
    where a.id = p_principal
  )
  select p_uid is not null
    and not exists (
      select 1 from caso
      join public.bloqueos b on b.bloqueador_id = caso.familia and b.bloqueado_id = p_uid
    )
    and (
      exists (
        select 1 from public.animales a
        where a.id in (select arbol.id from arbol) and a.creado_por = p_uid
      )
      or exists (
        select 1 from public.avistamientos av
        where av.animal_id in (select arbol.id from arbol) and av.usuario_id = p_uid
      )
      or exists (
        select 1 from public.cambios_estado c
        where c.animal_id in (select arbol.id from arbol) and c.usuario_id = p_uid
      )
      or exists (
        select 1
        from public.conversaciones cv
        join public.mensajes m on m.conversacion_id = cv.id
        cross join caso
        where cv.animal_id in (select arbol.id from arbol)
          and m.emisor_id = p_uid
          and m.created_at <= caso.reunido_en
      )
    );
$$;

-- Si quien llama ve el detalle del caso (el recorrido, los avisos, el
-- historial, las coincidencias y los contactos). Siempre, salvo en un caso
-- reunido (o un reporte unido a uno reunido): ahí, solo quien participó y
-- moderación. Un caso que no existe da true: lo decide la política de animales.
create or replace function public.ve_detalle_del_caso(p_animal_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_principal uuid := p_animal_id;
  v_estado public.estado_animal;
begin
  select a.estado into v_estado from public.animales a where a.id = p_animal_id;
  if v_estado = 'vinculado' then
    v_principal := public.caso_principal(p_animal_id);
    select a.estado into v_estado from public.animales a where a.id = v_principal;
  end if;
  if v_estado is distinct from 'reunido' then
    return true;
  end if;
  return public.es_moderador() or public.participo_en_caso(v_principal, (select auth.uid()));
end;
$$;

-- Lo que la tabla ya no da: si se ve todo el caso, el nombre y la
-- descripción. A quien no ve el detalle de un caso reunido, nada de la
-- descripción (texto libre, donde suele estar la zona) y el nombre solo si
-- la familia lo mostró y no parece un contacto. Un caso que quien llama no ve
-- (oculto o borrado) no devuelve filas, como la política de animales.
create or replace function public.vista_del_caso(p_animal_id uuid)
returns table (completo boolean, nombre text, descripcion text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    v.completo,
    case
      when v.completo then a.nombre
      when exists (
        select 1 from public.historias_reencuentro h
        where h.animal_id = public.caso_principal(a.id) and not h.mostrar_nombre
      ) then null
      else public.nombre_publicable(a.nombre)
    end,
    case when v.completo then a.descripcion end
  from public.animales a
  cross join lateral (select public.ve_detalle_del_caso(a.id) as completo) v
  where a.id = p_animal_id
    and (not a.oculto or a.creado_por = (select auth.uid()) or public.es_moderador());
$$;

revoke all on function public.participo_en_caso(uuid, uuid) from public, anon, authenticated;
-- Las usan las políticas y las vistas (security_invoker): las ejecuta quien lee.
revoke all on function public.ve_detalle_del_caso(uuid) from public, anon, authenticated;
revoke all on function public.vista_del_caso(uuid) from public, anon, authenticated;
grant execute on function public.ve_detalle_del_caso(uuid) to anon, authenticated;
grant execute on function public.vista_del_caso(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Las políticas: lo mismo de la 0014, más la regla
-- ---------------------------------------------------------------------------

drop policy "avistamientos: lectura si se ve el caso" on public.avistamientos;
create policy "avistamientos: lectura si se ve el caso"
  on public.avistamientos for select
  using (
    exists (select 1 from public.animales a where a.id = avistamientos.animal_id)
    and public.ve_detalle_del_caso(avistamientos.animal_id)
  );

drop policy "cambios_estado: lectura si se ve el caso" on public.cambios_estado;
create policy "cambios_estado: lectura si se ve el caso"
  on public.cambios_estado for select
  using (
    exists (select 1 from public.animales a where a.id = cambios_estado.animal_id)
    and public.ve_detalle_del_caso(cambios_estado.animal_id)
  );

drop policy "coincidencias: lectura si se ven los dos casos" on public.coincidencias;
create policy "coincidencias: lectura si se ven los dos casos"
  on public.coincidencias for select
  using (
    exists (select 1 from public.animales a where a.id = coincidencias.animal_origen)
    and exists (select 1 from public.animales a where a.id = coincidencias.animal_candidato)
    and public.ve_detalle_del_caso(coincidencias.animal_origen)
    and public.ve_detalle_del_caso(coincidencias.animal_candidato)
  );

drop policy "contactos_resguardo: lectura segun el caso" on public.contactos_resguardo;
create policy "contactos_resguardo: lectura segun el caso"
  on public.contactos_resguardo for select
  using (
    public.puede_ver_contacto_resguardo(animal_id, usuario_id)
    and exists (select 1 from public.animales a where a.id = contactos_resguardo.animal_id)
    and public.ve_detalle_del_caso(contactos_resguardo.animal_id)
  );

-- ---------------------------------------------------------------------------
-- 3. animales: todas las columnas menos el nombre y la descripción
-- ---------------------------------------------------------------------------

-- Ninguna política ni vista lee esas dos columnas con los permisos de quien
-- consulta (las vistas de abajo las toman de vista_del_caso). Las RPC son
-- security definer y siguen leyendo todo.
revoke select on public.animales from anon, authenticated;
grant select (
  id, especie, tamanio, color, tiene_collar, estado, vinculado_a, foto_principal_path,
  creado_por, ultimo_avistamiento_en, created_at, updated_at, oculto, tipo_reporte,
  contacto_familia
) on public.animales to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Las vistas (create or replace: mismas columnas, en el mismo orden; las
--    nuevas, al final)
-- ---------------------------------------------------------------------------

-- El detalle. A quien no ve el detalle de un caso reunido: la foto, la
-- especie, el nombre (según vista_del_caso), el estado y "reservado". Lo que
-- sale de avistamientos (el último punto, cuántos avisos, desde cuándo se
-- perdió) ya llega vacío por su política.
create or replace view public.animales_detalle
with (security_invoker = true)
as
select
  a.id,
  a.especie,
  case when v.completo then a.tamanio end as tamanio,
  case when v.completo then a.color end as color,
  case when v.completo then a.tiene_collar end as tiene_collar,
  v.descripcion,
  a.estado,
  a.vinculado_a,
  a.foto_principal_path,
  case when v.completo then a.creado_por end as creado_por,
  case when v.completo then p.nombre_publico end as creador_nombre,
  a.created_at,
  case when v.completo then a.ultimo_avistamiento_en end as ultimo_avistamiento_en,
  extensions.st_y(u.ubicacion::extensions.geometry) as lat,
  extensions.st_x(u.ubicacion::extensions.geometry) as lng,
  u.visto_en as ultimo_visto_en,
  (select count(*) from public.avistamientos av where av.animal_id = a.id) as cantidad_avistamientos,
  a.oculto,
  a.tipo_reporte,
  v.nombre,
  case when v.completo then a.contacto_familia end as contacto_familia,
  (
    select min(av.visto_en) from public.avistamientos av
    where av.animal_id = a.id and av.tipo = 'perdido'
  ) as perdido_desde,
  not v.completo as reservado
from public.animales a
cross join lateral public.vista_del_caso(a.id) v
left join public.perfiles p on p.id = a.creado_por
left join lateral (
  select avistamientos.ubicacion, avistamientos.visto_en
  from public.avistamientos
  where avistamientos.animal_id = a.id
  order by avistamientos.visto_en desc
  limit 1
) u on true;

-- El mapa: un caso reunido sale solo para quien participó (sin avistamientos
-- visibles tampoco tendría punto).
create or replace view public.animales_mapa
with (security_invoker = true)
as
select
  a.id,
  a.especie,
  a.tamanio,
  a.color,
  a.tiene_collar,
  v.descripcion,
  a.estado,
  a.foto_principal_path,
  a.creado_por,
  a.created_at,
  a.ultimo_avistamiento_en,
  extensions.st_y(u.ubicacion::extensions.geometry) as lat,
  extensions.st_x(u.ubicacion::extensions.geometry) as lng,
  u.visto_en as ultimo_visto_en,
  (select count(*) from public.avistamientos av where av.animal_id = a.id) as cantidad_avistamientos,
  a.tipo_reporte,
  v.nombre,
  a.contacto_familia
from public.animales a
join lateral (
  select avistamientos.ubicacion, avistamientos.visto_en
  from public.avistamientos
  where avistamientos.animal_id = a.id
  order by avistamientos.visto_en desc
  limit 1
) u on true
cross join lateral public.vista_del_caso(a.id) v
where a.estado <> 'vinculado' and a.oculto = false and v.completo;

-- Las coincidencias: su política ya exige ver el detalle de los dos casos.
create or replace view public.coincidencias_detalle
with (security_invoker = true)
as
select
  c.id,
  c.animal_origen,
  c.animal_candidato,
  c.similitud,
  c.distancia_m,
  c.horas_diferencia,
  c.estado,
  c.resuelta_por,
  c.resuelta_en,
  c.created_at,
  ao.foto_principal_path as origen_foto_path,
  ao.especie as origen_especie,
  ao.estado as origen_estado,
  vo.descripcion as origen_descripcion,
  ac.foto_principal_path as candidato_foto_path,
  ac.especie as candidato_especie,
  ac.estado as candidato_estado,
  vc.descripcion as candidato_descripcion,
  ao.tipo_reporte as origen_tipo_reporte,
  vo.nombre as origen_nombre,
  ao.creado_por as origen_creado_por,
  ac.tipo_reporte as candidato_tipo_reporte,
  vc.nombre as candidato_nombre,
  ac.creado_por as candidato_creado_por,
  c.confianza,
  c.motivo,
  c.origen
from public.coincidencias c
join public.animales ao on ao.id = c.animal_origen
join public.animales ac on ac.id = c.animal_candidato
cross join lateral public.vista_del_caso(ao.id) vo
cross join lateral public.vista_del_caso(ac.id) vc;

-- Las denuncias (las de quien denunció y, todas, moderación), igual que en la
-- 0026 con la descripción de vista_del_caso.
create or replace view public.denuncias_detalle
with (security_invoker = true)
as
select
  d.id,
  d.animal_id,
  d.avistamiento_id,
  d.usuario_id,
  p.nombre_publico as denunciante_nombre,
  d.motivo,
  d.detalle,
  d.estado,
  d.created_at,
  a.foto_principal_path as animal_foto_path,
  a.especie as animal_especie,
  v.descripcion as animal_descripcion,
  a.oculto as animal_oculto,
  a.estado as animal_estado,
  p.created_at > d.created_at - interval '7 days' as cuenta_nueva,
  d.historia,
  h.frase as historia_frase,
  h.foto_path as historia_foto_path,
  coalesce(h.oculta, false) as historia_oculta
from public.denuncias d
join public.perfiles p on p.id = d.usuario_id
join public.animales a on a.id = d.animal_id
left join lateral public.vista_del_caso(a.id) v on true
left join public.historias_reencuentro h on d.historia and h.animal_id = d.animal_id;
