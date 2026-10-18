-- =============================================================================
-- 0003 · RLS en todas las tablas, vistas para la app y RPC de publicación
-- Regla general: leer sin cuenta, escribir con cuenta y solo lo propio.
-- =============================================================================

alter table public.perfiles enable row level security;
alter table public.animales enable row level security;
alter table public.avistamientos enable row level security;
alter table public.cambios_estado enable row level security;

-- ---------------------------------------------------------------------------
-- perfiles
-- ---------------------------------------------------------------------------
create policy "perfiles: lectura publica"
  on public.perfiles for select
  using (true);

create policy "perfiles: editar el propio"
  on public.perfiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- animales
-- ---------------------------------------------------------------------------
create policy "animales: lectura publica"
  on public.animales for select
  using (true);

create policy "animales: publicar con cuenta"
  on public.animales for insert to authenticated
  with check ((select auth.uid()) = creado_por);

-- En Fase 1 solo quien publicó edita. En Fase 2 los cambios de estado de
-- terceros pasan por una RPC con security definer, no por esta política.
create policy "animales: editar el propio"
  on public.animales for update to authenticated
  using ((select auth.uid()) = creado_por)
  with check ((select auth.uid()) = creado_por);

create policy "animales: borrar el propio"
  on public.animales for delete to authenticated
  using ((select auth.uid()) = creado_por);

-- ---------------------------------------------------------------------------
-- avistamientos
-- ---------------------------------------------------------------------------
create policy "avistamientos: lectura publica"
  on public.avistamientos for select
  using (true);

create policy "avistamientos: crear con cuenta"
  on public.avistamientos for insert to authenticated
  with check ((select auth.uid()) = usuario_id);

create policy "avistamientos: editar el propio"
  on public.avistamientos for update to authenticated
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);

create policy "avistamientos: borrar el propio"
  on public.avistamientos for delete to authenticated
  using ((select auth.uid()) = usuario_id);

-- ---------------------------------------------------------------------------
-- cambios_estado
-- ---------------------------------------------------------------------------
create policy "cambios_estado: lectura publica"
  on public.cambios_estado for select
  using (true);

create policy "cambios_estado: crear con cuenta"
  on public.cambios_estado for insert to authenticated
  with check ((select auth.uid()) = usuario_id);

-- ---------------------------------------------------------------------------
-- Vistas para la app. security_invoker hace que apliquen las políticas de
-- arriba (todas de lectura pública, así que anon también las ve).
-- ---------------------------------------------------------------------------

-- Un renglón por animal con la posición de su último avistamiento.
-- Es lo que dibuja el mapa.
create view public.animales_mapa
with (security_invoker = true)
as
select
  a.id,
  a.especie,
  a.tamanio,
  a.color,
  a.tiene_collar,
  a.descripcion,
  a.estado,
  a.foto_principal_path,
  a.creado_por,
  a.created_at,
  a.ultimo_avistamiento_en,
  extensions.st_y(u.ubicacion::extensions.geometry) as lat,
  extensions.st_x(u.ubicacion::extensions.geometry) as lng,
  u.visto_en as ultimo_visto_en,
  (select count(*) from public.avistamientos av where av.animal_id = a.id) as cantidad_avistamientos
from public.animales a
join lateral (
  select ubicacion, visto_en
  from public.avistamientos
  where animal_id = a.id
  order by visto_en desc
  limit 1
) u on true
where a.estado <> 'vinculado';

-- Avistamientos con lat/lng ya extraídos y el nombre público de quien lo vio.
-- Es el historial del detalle y, en Fase 2, el recorrido en el mapa.
create view public.avistamientos_detalle
with (security_invoker = true)
as
select
  av.id,
  av.animal_id,
  av.usuario_id,
  p.nombre_publico as usuario_nombre,
  av.tipo,
  av.foto_path,
  extensions.st_y(av.ubicacion::extensions.geometry) as lat,
  extensions.st_x(av.ubicacion::extensions.geometry) as lng,
  av.visto_en,
  av.nota,
  av.created_at
from public.avistamientos av
join public.perfiles p on p.id = av.usuario_id;

-- ---------------------------------------------------------------------------
-- RPC: publicar un animal encontrado (animal + primer avistamiento, atómico).
-- security invoker: corre como el usuario, así que RLS aplica igual.
-- ---------------------------------------------------------------------------
create or replace function public.publicar_animal(
  p_especie public.especie,
  p_foto_path text,
  p_lat double precision,
  p_lng double precision,
  p_visto_en timestamptz default now(),
  p_tamanio public.tamanio default null,
  p_color text default null,
  p_tiene_collar boolean default false,
  p_descripcion text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_animal_id uuid;
begin
  if v_uid is null then
    raise exception 'Necesitás una cuenta para publicar' using errcode = '42501';
  end if;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'Ubicación inválida' using errcode = '22023';
  end if;
  if p_foto_path is null or p_foto_path = '' then
    raise exception 'La foto es obligatoria' using errcode = '22023';
  end if;

  insert into public.animales (
    especie, tamanio, color, tiene_collar, descripcion, foto_principal_path, creado_por
  )
  values (
    p_especie, p_tamanio, nullif(trim(p_color), ''), coalesce(p_tiene_collar, false),
    nullif(trim(p_descripcion), ''), p_foto_path, v_uid
  )
  returning id into v_animal_id;

  insert into public.avistamientos (animal_id, usuario_id, tipo, foto_path, ubicacion, visto_en)
  values (
    v_animal_id,
    v_uid,
    'encontrado',
    p_foto_path,
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
    coalesce(p_visto_en, now())
  );

  return v_animal_id;
end;
$$;

revoke all on function public.publicar_animal from public, anon;
grant execute on function public.publicar_animal to authenticated;
