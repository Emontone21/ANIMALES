-- =============================================================================
-- 0004 · Fase 2: interacciones sobre un reporte
-- Seguimientos, denuncias, vistas de detalle y RPC para avistamientos y
-- cambios de estado hechos por terceros (no solo por quien publicó).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Seguimientos: "seguir" un caso para enterarse de novedades (fase 4: push).
-- ---------------------------------------------------------------------------
create table public.seguimientos (
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  animal_id uuid not null references public.animales (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (usuario_id, animal_id)
);

create index seguimientos_animal_idx on public.seguimientos (animal_id);

alter table public.seguimientos enable row level security;

create policy "seguimientos: ver los propios"
  on public.seguimientos for select to authenticated
  using ((select auth.uid()) = usuario_id);

create policy "seguimientos: seguir"
  on public.seguimientos for insert to authenticated
  with check ((select auth.uid()) = usuario_id);

create policy "seguimientos: dejar de seguir"
  on public.seguimientos for delete to authenticated
  using ((select auth.uid()) = usuario_id);

-- Quien publica sigue su propio caso automáticamente.
create or replace function public.seguir_al_publicar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.seguimientos (usuario_id, animal_id)
  values (new.creado_por, new.id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger animales_seguir_al_publicar
  after insert on public.animales
  for each row execute function public.seguir_al_publicar();

-- ---------------------------------------------------------------------------
-- Denuncias de publicaciones inapropiadas. Solo las ve quien denunció (y, en
-- fase 4, quienes moderan).
-- ---------------------------------------------------------------------------
create type public.motivo_denuncia as enum (
  'spam', 'contenido_inapropiado', 'informacion_falsa', 'maltrato', 'otro'
);
create type public.estado_denuncia as enum ('pendiente', 'revisada', 'descartada');

create table public.denuncias (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animales (id) on delete cascade,
  avistamiento_id uuid references public.avistamientos (id) on delete set null,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  motivo public.motivo_denuncia not null,
  detalle text check (char_length(detalle) <= 500),
  estado public.estado_denuncia not null default 'pendiente',
  created_at timestamptz not null default now(),
  unique (animal_id, usuario_id)
);

create index denuncias_animal_idx on public.denuncias (animal_id);
create index denuncias_estado_idx on public.denuncias (estado);

alter table public.denuncias enable row level security;

create policy "denuncias: ver las propias"
  on public.denuncias for select to authenticated
  using ((select auth.uid()) = usuario_id);

create policy "denuncias: crear"
  on public.denuncias for insert to authenticated
  with check ((select auth.uid()) = usuario_id);

-- ---------------------------------------------------------------------------
-- Vistas
-- ---------------------------------------------------------------------------

-- Igual que animales_mapa pero con TODOS los animales (incluye vinculados y
-- reunidos) y el campo vinculado_a, para la pantalla de detalle.
create view public.animales_detalle
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
  a.vinculado_a,
  a.foto_principal_path,
  a.creado_por,
  p.nombre_publico as creador_nombre,
  a.created_at,
  a.ultimo_avistamiento_en,
  extensions.st_y(u.ubicacion::extensions.geometry) as lat,
  extensions.st_x(u.ubicacion::extensions.geometry) as lng,
  u.visto_en as ultimo_visto_en,
  (select count(*) from public.avistamientos av where av.animal_id = a.id) as cantidad_avistamientos
from public.animales a
join public.perfiles p on p.id = a.creado_por
join lateral (
  select ubicacion, visto_en
  from public.avistamientos
  where animal_id = a.id
  order by visto_en desc
  limit 1
) u on true;

-- Historial de estados con el nombre público de quien lo cambió.
create view public.cambios_estado_detalle
with (security_invoker = true)
as
select
  c.id,
  c.animal_id,
  c.usuario_id,
  p.nombre_publico as usuario_nombre,
  c.estado_anterior,
  c.estado_nuevo,
  c.contacto_compartido,
  c.nota,
  c.created_at
from public.cambios_estado c
join public.perfiles p on p.id = c.usuario_id;

-- ---------------------------------------------------------------------------
-- RPC: "Lo vi acá también". Crea un avistamiento tipo 'visto' sobre un caso
-- abierto. security invoker: RLS aplica (usuario_id = auth.uid()).
-- ---------------------------------------------------------------------------
create or replace function public.registrar_avistamiento(
  p_animal_id uuid,
  p_foto_path text,
  p_lat double precision,
  p_lng double precision,
  p_visto_en timestamptz default now(),
  p_nota text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_estado public.estado_animal;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Necesitás una cuenta para avisar que lo viste' using errcode = '42501';
  end if;
  if p_foto_path is null or p_foto_path = '' then
    raise exception 'La foto es obligatoria' using errcode = '22023';
  end if;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'Ubicación inválida' using errcode = '22023';
  end if;

  select estado into v_estado from public.animales where id = p_animal_id;
  if v_estado is null then
    raise exception 'No encontramos este reporte' using errcode = 'P0002';
  end if;
  if v_estado not in ('avistado', 'resguardado') then
    raise exception 'Este caso ya está cerrado' using errcode = '22023';
  end if;

  insert into public.avistamientos (animal_id, usuario_id, tipo, foto_path, ubicacion, visto_en, nota)
  values (
    p_animal_id,
    v_uid,
    'visto',
    p_foto_path,
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
    coalesce(p_visto_en, now()),
    nullif(trim(p_nota), '')
  )
  returning id into v_id;

  insert into public.seguimientos (usuario_id, animal_id)
  values (v_uid, p_animal_id)
  on conflict do nothing;

  return v_id;
end;
$$;

revoke all on function public.registrar_avistamiento from public, anon;
grant execute on function public.registrar_avistamiento to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: cambiar el estado de un caso (resguardado / reunido / reabrir).
-- security definer porque la política de animales solo deja editar al creador;
-- acá validamos las transiciones permitidas y dejamos registro en el historial.
--
--   avistado    -> resguardado | reunido
--   resguardado -> reunido | avistado   (se volvió a escapar)
--   reunido     -> avistado             (solo quien publicó puede reabrir)
-- ---------------------------------------------------------------------------
create or replace function public.cambiar_estado_animal(
  p_animal_id uuid,
  p_estado_nuevo public.estado_animal,
  p_contacto_compartido text default null,
  p_nota text default null,
  p_lat double precision default null,
  p_lng double precision default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_actual public.estado_animal;
  v_creador uuid;
  v_ubicacion extensions.geography;
begin
  if v_uid is null then
    raise exception 'Necesitás una cuenta para cambiar el estado' using errcode = '42501';
  end if;
  if p_estado_nuevo = 'vinculado' then
    raise exception 'Para vincular reportes usá las coincidencias' using errcode = '22023';
  end if;

  select estado, creado_por into v_actual, v_creador
  from public.animales
  where id = p_animal_id
  for update;

  if v_actual is null then
    raise exception 'No encontramos este reporte' using errcode = 'P0002';
  end if;
  if v_actual = 'vinculado' then
    raise exception 'Este reporte está vinculado a otro' using errcode = '22023';
  end if;
  if v_actual = p_estado_nuevo then
    raise exception 'El animal ya está en ese estado' using errcode = '22023';
  end if;
  if v_actual = 'reunido' and v_uid <> v_creador then
    raise exception 'Solo quien publicó puede reabrir el caso' using errcode = '42501';
  end if;
  if not (
    (v_actual = 'avistado' and p_estado_nuevo in ('resguardado', 'reunido'))
    or (v_actual = 'resguardado' and p_estado_nuevo in ('reunido', 'avistado'))
    or (v_actual = 'reunido' and p_estado_nuevo = 'avistado')
  ) then
    raise exception 'Ese cambio de estado no está permitido' using errcode = '22023';
  end if;

  update public.animales set estado = p_estado_nuevo where id = p_animal_id;

  insert into public.cambios_estado (animal_id, usuario_id, estado_anterior, estado_nuevo, contacto_compartido, nota)
  values (
    p_animal_id, v_uid, v_actual, p_estado_nuevo,
    nullif(trim(p_contacto_compartido), ''), nullif(trim(p_nota), '')
  );

  -- Resguardarlo cuenta como un avistamiento (sin foto obligatoria).
  if p_estado_nuevo = 'resguardado' then
    if p_lat is not null and p_lng is not null then
      v_ubicacion := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
    else
      select ubicacion into v_ubicacion
      from public.avistamientos
      where animal_id = p_animal_id
      order by visto_en desc
      limit 1;
    end if;

    insert into public.avistamientos (animal_id, usuario_id, tipo, foto_path, ubicacion, visto_en, nota)
    values (p_animal_id, v_uid, 'resguardado', null, v_ubicacion, now(), nullif(trim(p_nota), ''));
  end if;

  insert into public.seguimientos (usuario_id, animal_id)
  values (v_uid, p_animal_id)
  on conflict do nothing;
end;
$$;

revoke all on function public.cambiar_estado_animal from public, anon;
grant execute on function public.cambiar_estado_animal to authenticated;
