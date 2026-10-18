-- =============================================================================
-- 0005 · Fase 3: reconocimiento de animales repetidos
-- Embeddings con pgvector, cola de procesamiento para el servicio de visión,
-- coincidencias candidatas y su confirmación o rechazo por una persona.
-- NUNCA se fusionan reportes automáticamente.
-- =============================================================================

create extension if not exists vector with schema extensions;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Embedding por avistamiento (DINOv2 small: 384 dimensiones, normalizado).
-- ---------------------------------------------------------------------------
alter table public.avistamientos
  add column embedding extensions.vector(384),
  add column bbox_recorte jsonb,
  add column procesado_en timestamptz,
  add column error_procesamiento text;

comment on column public.avistamientos.bbox_recorte is 'Recorte usado para el embedding: {x, y, ancho, alto, confianza} en píxeles de la foto original, o null si se usó la foto entera.';

create index avistamientos_embedding_idx
  on public.avistamientos
  using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Configuración privada de la app (URL y secreto del servicio de visión).
-- Solo la lee el servidor; ningún rol de la API tiene acceso.
-- ---------------------------------------------------------------------------
create table public.config_app (
  clave text primary key,
  valor text not null,
  updated_at timestamptz not null default now()
);

alter table public.config_app enable row level security;
revoke all on public.config_app from anon, authenticated;

insert into public.config_app (clave, valor) values
  ('vision_url', ''),
  ('vision_secret', ''),
  ('umbral_similitud', '0.80'),
  ('radio_coincidencia_m', '15000'),
  ('ventana_coincidencia_dias', '60')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------------
-- Cola de procesamiento. Un renglón por avistamiento con foto. El servicio de
-- visión la consume (y además recibe un aviso por webhook si está configurado).
-- ---------------------------------------------------------------------------
create type public.estado_cola as enum ('pendiente', 'procesando', 'hecho', 'error');

create table public.cola_vision (
  avistamiento_id uuid primary key references public.avistamientos (id) on delete cascade,
  estado public.estado_cola not null default 'pendiente',
  intentos int not null default 0,
  ultimo_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cola_vision_pendientes_idx on public.cola_vision (created_at)
  where estado in ('pendiente', 'error');

alter table public.cola_vision enable row level security;
revoke all on public.cola_vision from anon, authenticated;

create trigger cola_vision_updated_at
  before update on public.cola_vision
  for each row execute function public.set_updated_at();

-- Avisar al servicio de visión por HTTP (si hay URL configurada). Es "best
-- effort": si falla, el servicio igual levanta el renglón al consultar la cola.
create or replace function public.encolar_avistamiento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if new.foto_path is null then
    return new;
  end if;

  insert into public.cola_vision (avistamiento_id)
  values (new.id)
  on conflict (avistamiento_id) do nothing;

  select valor into v_url from public.config_app where clave = 'vision_url';
  select valor into v_secret from public.config_app where clave = 'vision_secret';

  if coalesce(v_url, '') <> '' then
    perform net.http_post(
      url := v_url || '/procesar',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Vision-Secret', coalesce(v_secret, '')
      ),
      body := jsonb_build_object('avistamiento_id', new.id),
      timeout_milliseconds := 5000
    );
  end if;

  return new;
end;
$$;

create trigger avistamientos_encolar
  after insert on public.avistamientos
  for each row execute function public.encolar_avistamiento();

-- Lo que necesita el servicio para procesar un avistamiento.
create view public.cola_vision_pendientes as
select
  c.avistamiento_id,
  c.estado,
  c.intentos,
  av.foto_path,
  a.especie
from public.cola_vision c
join public.avistamientos av on av.id = c.avistamiento_id
join public.animales a on a.id = av.animal_id
where c.estado in ('pendiente', 'error') and c.intentos < 5
order by c.created_at;

revoke all on public.cola_vision_pendientes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Coincidencias candidatas entre dos animales. Una fila por par (sin repetir
-- el par invertido). Las resuelve una persona.
-- ---------------------------------------------------------------------------
create type public.estado_coincidencia as enum ('pendiente', 'confirmada', 'rechazada');

create table public.coincidencias (
  id uuid primary key default gen_random_uuid(),
  animal_origen uuid not null references public.animales (id) on delete cascade,
  animal_candidato uuid not null references public.animales (id) on delete cascade,
  avistamiento_origen uuid references public.avistamientos (id) on delete set null,
  avistamiento_candidato uuid references public.avistamientos (id) on delete set null,
  similitud real not null check (similitud between 0 and 1),
  distancia_m real,
  horas_diferencia real,
  estado public.estado_coincidencia not null default 'pendiente',
  resuelta_por uuid references public.perfiles (id) on delete set null,
  resuelta_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (animal_origen <> animal_candidato),
  -- El par se guarda ordenado para que (A, B) y (B, A) sean la misma fila.
  check (animal_origen < animal_candidato),
  unique (animal_origen, animal_candidato)
);

create index coincidencias_origen_idx on public.coincidencias (animal_origen, estado);
create index coincidencias_candidato_idx on public.coincidencias (animal_candidato, estado);

alter table public.coincidencias enable row level security;

-- Las coincidencias son visibles para cualquiera (no exponen datos personales
-- y sirven para que cualquier usuario ayude a confirmar).
create policy "coincidencias: lectura publica"
  on public.coincidencias for select
  using (true);

create trigger coincidencias_updated_at
  before update on public.coincidencias
  for each row execute function public.set_updated_at();

-- Vista con los datos de los dos animales para mostrar la tarjeta.
create view public.coincidencias_detalle
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
  ao.descripcion as origen_descripcion,
  ac.foto_principal_path as candidato_foto_path,
  ac.especie as candidato_especie,
  ac.estado as candidato_estado,
  ac.descripcion as candidato_descripcion
from public.coincidencias c
join public.animales ao on ao.id = c.animal_origen
join public.animales ac on ac.id = c.animal_candidato;

-- ---------------------------------------------------------------------------
-- RPC (servicio): guardar el embedding y buscar coincidencias.
-- Solo service_role. Compara contra el mejor avistamiento de cada OTRO animal
-- de la misma especie, abierto, dentro del radio y la ventana de tiempo.
-- ---------------------------------------------------------------------------
create or replace function public.guardar_embedding(
  p_avistamiento_id uuid,
  p_embedding extensions.vector(384),
  p_bbox jsonb default null
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_animal uuid;
  v_especie public.especie;
  v_ubicacion extensions.geography;
  v_visto_en timestamptz;
  v_umbral real;
  v_radio_m real;
  v_dias real;
  v_insertadas int := 0;
  r record;
begin
  update public.avistamientos
  set embedding = p_embedding,
      bbox_recorte = p_bbox,
      procesado_en = now(),
      error_procesamiento = null
  where id = p_avistamiento_id
  returning animal_id, ubicacion, visto_en into v_animal, v_ubicacion, v_visto_en;

  if v_animal is null then
    raise exception 'Avistamiento inexistente' using errcode = 'P0002';
  end if;

  select especie into v_especie from public.animales where id = v_animal;

  select valor::real into v_umbral from public.config_app where clave = 'umbral_similitud';
  select valor::real into v_radio_m from public.config_app where clave = 'radio_coincidencia_m';
  select valor::real into v_dias from public.config_app where clave = 'ventana_coincidencia_dias';
  v_umbral := coalesce(v_umbral, 0.80);
  v_radio_m := coalesce(v_radio_m, 15000);
  v_dias := coalesce(v_dias, 60);

  for r in
    select
      otro.animal_id,
      otro.id as avistamiento_id,
      otro.similitud,
      otro.distancia_m,
      otro.horas
    from (
      select distinct on (av.animal_id)
        av.animal_id,
        av.id,
        (1 - (av.embedding <=> p_embedding))::real as similitud,
        extensions.st_distance(av.ubicacion, v_ubicacion)::real as distancia_m,
        (abs(extract(epoch from (av.visto_en - v_visto_en))) / 3600)::real as horas
      from public.avistamientos av
      join public.animales a on a.id = av.animal_id
      where av.animal_id <> v_animal
        and av.embedding is not null
        and a.especie = v_especie
        and a.estado in ('avistado', 'resguardado')
        and extensions.st_dwithin(av.ubicacion, v_ubicacion, v_radio_m)
        and abs(extract(epoch from (av.visto_en - v_visto_en))) <= v_dias * 86400
      order by av.animal_id, (av.embedding <=> p_embedding)
    ) otro
    where otro.similitud >= v_umbral
    order by otro.similitud desc
    limit 10
  loop
    insert into public.coincidencias (
      animal_origen, animal_candidato, avistamiento_origen, avistamiento_candidato,
      similitud, distancia_m, horas_diferencia
    )
    values (
      least(v_animal, r.animal_id),
      greatest(v_animal, r.animal_id),
      case when v_animal < r.animal_id then p_avistamiento_id else r.avistamiento_id end,
      case when v_animal < r.animal_id then r.avistamiento_id else p_avistamiento_id end,
      r.similitud, r.distancia_m, r.horas
    )
    on conflict (animal_origen, animal_candidato) do update
      set similitud = greatest(public.coincidencias.similitud, excluded.similitud),
          distancia_m = least(public.coincidencias.distancia_m, excluded.distancia_m),
          horas_diferencia = least(public.coincidencias.horas_diferencia, excluded.horas_diferencia)
      where public.coincidencias.estado = 'pendiente';
    v_insertadas := v_insertadas + 1;
  end loop;

  update public.cola_vision
  set estado = 'hecho', ultimo_error = null
  where avistamiento_id = p_avistamiento_id;

  return v_insertadas;
end;
$$;

revoke all on function public.guardar_embedding from public, anon, authenticated;
grant execute on function public.guardar_embedding to service_role;

-- RPC (servicio): marcar un intento fallido.
create or replace function public.marcar_error_vision(p_avistamiento_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.cola_vision
  set estado = 'error', intentos = intentos + 1, ultimo_error = left(p_error, 500)
  where avistamiento_id = p_avistamiento_id;

  update public.avistamientos
  set error_procesamiento = left(p_error, 500)
  where id = p_avistamiento_id;
end;
$$;

revoke all on function public.marcar_error_vision from public, anon, authenticated;
grant execute on function public.marcar_error_vision to service_role;

-- ---------------------------------------------------------------------------
-- RPC (usuarios): confirmar o rechazar una coincidencia.
-- Confirmar = vincular: los avistamientos del animal más nuevo pasan al más
-- viejo, que queda como caso principal; el nuevo queda 'vinculado'.
-- Nada se borra. La decisión queda guardada para calibrar el umbral.
-- ---------------------------------------------------------------------------
create or replace function public.resolver_coincidencia(p_id uuid, p_confirmada boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_c public.coincidencias%rowtype;
  v_principal uuid;
  v_secundario uuid;
begin
  if v_uid is null then
    raise exception 'Necesitás una cuenta para confirmar coincidencias' using errcode = '42501';
  end if;

  select * into v_c from public.coincidencias where id = p_id for update;
  if v_c.id is null then
    raise exception 'Coincidencia inexistente' using errcode = 'P0002';
  end if;
  if v_c.estado <> 'pendiente' then
    raise exception 'Esta coincidencia ya fue resuelta' using errcode = '22023';
  end if;

  update public.coincidencias
  set estado = case when p_confirmada then 'confirmada' else 'rechazada' end,
      resuelta_por = v_uid,
      resuelta_en = now()
  where id = p_id;

  if not p_confirmada then
    return null;
  end if;

  -- El caso más viejo es el principal.
  select
    case when a1.created_at <= a2.created_at then a1.id else a2.id end,
    case when a1.created_at <= a2.created_at then a2.id else a1.id end
  into v_principal, v_secundario
  from public.animales a1, public.animales a2
  where a1.id = v_c.animal_origen and a2.id = v_c.animal_candidato;

  -- Si el secundario ya estaba vinculado a otro, no se puede re-vincular.
  if exists (select 1 from public.animales where id = v_secundario and estado = 'vinculado') then
    raise exception 'Ese reporte ya está vinculado a otro' using errcode = '22023';
  end if;

  update public.avistamientos set animal_id = v_principal where animal_id = v_secundario;

  update public.animales
  set estado = 'vinculado', vinculado_a = v_principal
  where id = v_secundario;

  update public.animales
  set ultimo_avistamiento_en = (
    select max(visto_en) from public.avistamientos where animal_id = v_principal
  )
  where id = v_principal;

  -- Quien seguía el secundario pasa a seguir el principal.
  insert into public.seguimientos (usuario_id, animal_id)
  select usuario_id, v_principal from public.seguimientos where animal_id = v_secundario
  on conflict do nothing;

  -- Las demás coincidencias pendientes del secundario pierden sentido.
  update public.coincidencias
  set estado = 'rechazada', resuelta_por = v_uid, resuelta_en = now()
  where estado = 'pendiente'
    and (animal_origen = v_secundario or animal_candidato = v_secundario);

  insert into public.cambios_estado (animal_id, usuario_id, estado_anterior, estado_nuevo, nota)
  select v_secundario, v_uid, 'avistado', 'vinculado', null;

  return v_principal;
end;
$$;

revoke all on function public.resolver_coincidencia from public, anon;
grant execute on function public.resolver_coincidencia to authenticated;
