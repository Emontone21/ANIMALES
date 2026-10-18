-- =============================================================================
-- 0006 · Fase 4: notificaciones (in-app y push), mensajería interna y moderación
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tokens de Expo Push (solo app nativa). Un usuario puede tener varios.
-- ---------------------------------------------------------------------------
create table public.push_tokens (
  token text primary key,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  plataforma text not null check (plataforma in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_tokens_usuario_idx on public.push_tokens (usuario_id);

alter table public.push_tokens enable row level security;

create policy "push_tokens: ver los propios"
  on public.push_tokens for select to authenticated
  using ((select auth.uid()) = usuario_id);

create policy "push_tokens: registrar"
  on public.push_tokens for insert to authenticated
  with check ((select auth.uid()) = usuario_id);

create policy "push_tokens: actualizar"
  on public.push_tokens for update to authenticated
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);

create policy "push_tokens: borrar"
  on public.push_tokens for delete to authenticated
  using ((select auth.uid()) = usuario_id);

create trigger push_tokens_updated_at
  before update on public.push_tokens
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Notificaciones in-app (la "Actividad"). Cada una puede además ir por push.
-- ---------------------------------------------------------------------------
create type public.tipo_notificacion as enum ('coincidencia', 'avistamiento', 'estado', 'mensaje');

create table public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  tipo public.tipo_notificacion not null,
  titulo text not null,
  cuerpo text not null,
  -- {animal_id?, coincidencia_id?, conversacion_id?}
  datos jsonb not null default '{}'::jsonb,
  leida_en timestamptz,
  created_at timestamptz not null default now()
);

create index notificaciones_usuario_idx on public.notificaciones (usuario_id, created_at desc);
create index notificaciones_no_leidas_idx on public.notificaciones (usuario_id) where leida_en is null;

alter table public.notificaciones enable row level security;

create policy "notificaciones: ver las propias"
  on public.notificaciones for select to authenticated
  using ((select auth.uid()) = usuario_id);

create policy "notificaciones: marcar leidas"
  on public.notificaciones for update to authenticated
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);

-- Crea la notificación y la manda por push a cada token del usuario.
-- Expo Push API no exige credenciales para el envío básico.
create or replace function public.notificar(
  p_usuario_id uuid,
  p_tipo public.tipo_notificacion,
  p_titulo text,
  p_cuerpo text,
  p_datos jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, datos)
  values (p_usuario_id, p_tipo, p_titulo, p_cuerpo, coalesce(p_datos, '{}'::jsonb));

  for r in select token from public.push_tokens where usuario_id = p_usuario_id loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'to', r.token,
        'title', p_titulo,
        'body', p_cuerpo,
        'data', coalesce(p_datos, '{}'::jsonb) || jsonb_build_object('tipo', p_tipo),
        'sound', 'default'
      ),
      timeout_milliseconds := 5000
    );
  end loop;
end;
$$;

revoke all on function public.notificar from public, anon, authenticated;

-- Quiénes se enteran de lo que pasa con un animal: quien publicó y quienes lo siguen.
create or replace function public.interesados_en(p_animal_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select creado_por from public.animales where id = p_animal_id
  union
  select usuario_id from public.seguimientos where animal_id = p_animal_id;
$$;

revoke all on function public.interesados_en from public, anon, authenticated;

-- Nueva coincidencia: avisar a los interesados de los dos animales.
create or replace function public.notificar_coincidencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  for v_uid in
    select interesados_en from public.interesados_en(new.animal_origen)
    union
    select interesados_en from public.interesados_en(new.animal_candidato)
  loop
    perform public.notificar(
      v_uid,
      'coincidencia',
      'Posible coincidencia',
      'Encontramos un reporte que podría ser el mismo animal. Entrá y confirmá si es o no.',
      jsonb_build_object('animal_id', new.animal_origen, 'coincidencia_id', new.id)
    );
  end loop;
  return new;
end;
$$;

create trigger coincidencias_notificar
  after insert on public.coincidencias
  for each row execute function public.notificar_coincidencia();

-- Alguien lo vio o lo resguardó: avisar a los interesados menos a quien lo hizo.
create or replace function public.notificar_avistamiento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_nombre text;
  v_especie text;
begin
  if new.tipo = 'encontrado' then
    return new;
  end if;
  select nombre_publico into v_nombre from public.perfiles where id = new.usuario_id;
  select especie::text into v_especie from public.animales where id = new.animal_id;

  for v_uid in select interesados_en from public.interesados_en(new.animal_id) loop
    if v_uid = new.usuario_id then
      continue;
    end if;
    perform public.notificar(
      v_uid,
      'avistamiento',
      case when new.tipo = 'resguardado' then 'Lo resguardaron' else 'Lo vieron de nuevo' end,
      case
        when new.tipo = 'resguardado' then v_nombre || ' tiene al ' || v_especie || ' a salvo.'
        else v_nombre || ' vio al ' || v_especie || ' en otro lugar.'
      end,
      jsonb_build_object('animal_id', new.animal_id)
    );
  end loop;
  return new;
end;
$$;

create trigger avistamientos_notificar
  after insert on public.avistamientos
  for each row execute function public.notificar_avistamiento();

-- Cambio de estado a "reunido" o reapertura: avisar a los interesados.
create or replace function public.notificar_cambio_estado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  if new.estado_nuevo not in ('reunido', 'avistado') then
    return new;
  end if;
  for v_uid in select interesados_en from public.interesados_en(new.animal_id) loop
    if v_uid = new.usuario_id then
      continue;
    end if;
    perform public.notificar(
      v_uid,
      'estado',
      case when new.estado_nuevo = 'reunido' then '¡Volvió con su familia!' else 'El caso se reabrió' end,
      case
        when new.estado_nuevo = 'reunido' then 'Un caso que seguías se cerró con final feliz.'
        else 'Un animal que seguías se volvió a escapar. Atento al mapa.'
      end,
      jsonb_build_object('animal_id', new.animal_id)
    );
  end loop;
  return new;
end;
$$;

create trigger cambios_estado_notificar
  after insert on public.cambios_estado
  for each row execute function public.notificar_cambio_estado();

-- ---------------------------------------------------------------------------
-- Mensajería interna: una conversación por par de usuarios y animal.
-- Nadie ve emails ni teléfonos; se habla dentro de la app.
-- ---------------------------------------------------------------------------
create table public.conversaciones (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animales (id) on delete cascade,
  participante_a uuid not null references public.perfiles (id) on delete cascade,
  participante_b uuid not null references public.perfiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (participante_a < participante_b),
  unique (animal_id, participante_a, participante_b)
);

create index conversaciones_a_idx on public.conversaciones (participante_a, updated_at desc);
create index conversaciones_b_idx on public.conversaciones (participante_b, updated_at desc);

alter table public.conversaciones enable row level security;

create policy "conversaciones: ver las propias"
  on public.conversaciones for select to authenticated
  using ((select auth.uid()) in (participante_a, participante_b));

create table public.mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.conversaciones (id) on delete cascade,
  emisor_id uuid not null references public.perfiles (id) on delete cascade,
  cuerpo text not null check (char_length(cuerpo) between 1 and 2000),
  leido_en timestamptz,
  created_at timestamptz not null default now()
);

create index mensajes_conversacion_idx on public.mensajes (conversacion_id, created_at);

alter table public.mensajes enable row level security;

create policy "mensajes: ver los de mis conversaciones"
  on public.mensajes for select to authenticated
  using (
    exists (
      select 1 from public.conversaciones c
      where c.id = conversacion_id
        and (select auth.uid()) in (c.participante_a, c.participante_b)
    )
  );

create policy "mensajes: enviar en mis conversaciones"
  on public.mensajes for insert to authenticated
  with check (
    (select auth.uid()) = emisor_id
    and exists (
      select 1 from public.conversaciones c
      where c.id = conversacion_id
        and (select auth.uid()) in (c.participante_a, c.participante_b)
    )
  );

-- El receptor marca como leídos (solo mensajes ajenos de sus conversaciones).
create policy "mensajes: marcar leidos"
  on public.mensajes for update to authenticated
  using (
    emisor_id <> (select auth.uid())
    and exists (
      select 1 from public.conversaciones c
      where c.id = conversacion_id
        and (select auth.uid()) in (c.participante_a, c.participante_b)
    )
  )
  with check (emisor_id <> (select auth.uid()));

-- Abrir (o reutilizar) la conversación con otro usuario sobre un animal.
create or replace function public.abrir_conversacion(p_animal_id uuid, p_otro_usuario uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Necesitás una cuenta para enviar mensajes' using errcode = '42501';
  end if;
  if p_otro_usuario is null or p_otro_usuario = v_uid then
    raise exception 'No podés escribirte a vos' using errcode = '22023';
  end if;
  if not exists (select 1 from public.perfiles where id = p_otro_usuario) then
    raise exception 'Ese usuario no existe' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.animales where id = p_animal_id) then
    raise exception 'No encontramos este reporte' using errcode = 'P0002';
  end if;

  insert into public.conversaciones (animal_id, participante_a, participante_b)
  values (p_animal_id, least(v_uid, p_otro_usuario), greatest(v_uid, p_otro_usuario))
  on conflict (animal_id, participante_a, participante_b) do update set updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.abrir_conversacion from public, anon;
grant execute on function public.abrir_conversacion to authenticated;

-- Un mensaje nuevo actualiza la conversación y avisa al otro participante.
create or replace function public.al_enviar_mensaje()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_otro uuid;
  v_nombre text;
begin
  update public.conversaciones set updated_at = now() where id = new.conversacion_id;

  select case when participante_a = new.emisor_id then participante_b else participante_a end
  into v_otro
  from public.conversaciones where id = new.conversacion_id;

  select nombre_publico into v_nombre from public.perfiles where id = new.emisor_id;

  perform public.notificar(
    v_otro,
    'mensaje',
    'Mensaje de ' || v_nombre,
    left(new.cuerpo, 120),
    jsonb_build_object('conversacion_id', new.conversacion_id)
  );
  return new;
end;
$$;

create trigger mensajes_al_enviar
  after insert on public.mensajes
  for each row execute function public.al_enviar_mensaje();

-- Lista de conversaciones del usuario con el otro nombre, el animal y lo no leído.
create view public.conversaciones_detalle
with (security_invoker = true)
as
select
  c.id,
  c.animal_id,
  a.foto_principal_path as animal_foto_path,
  a.especie as animal_especie,
  case when c.participante_a = (select auth.uid()) then c.participante_b else c.participante_a end as otro_id,
  p.nombre_publico as otro_nombre,
  u.cuerpo as ultimo_mensaje,
  u.created_at as ultimo_mensaje_en,
  (
    select count(*) from public.mensajes m
    where m.conversacion_id = c.id and m.emisor_id <> (select auth.uid()) and m.leido_en is null
  ) as no_leidos,
  c.updated_at
from public.conversaciones c
join public.animales a on a.id = c.animal_id
join public.perfiles p
  on p.id = case when c.participante_a = (select auth.uid()) then c.participante_b else c.participante_a end
left join lateral (
  select cuerpo, created_at from public.mensajes
  where conversacion_id = c.id
  order by created_at desc
  limit 1
) u on true;

-- Mensajes con el nombre de quien los mandó.
create view public.mensajes_detalle
with (security_invoker = true)
as
select
  m.id,
  m.conversacion_id,
  m.emisor_id,
  p.nombre_publico as emisor_nombre,
  m.cuerpo,
  m.leido_en,
  m.created_at
from public.mensajes m
join public.perfiles p on p.id = m.emisor_id;

-- ---------------------------------------------------------------------------
-- Moderación
-- ---------------------------------------------------------------------------
alter table public.perfiles add column es_moderador boolean not null default false;
alter table public.animales add column oculto boolean not null default false;

comment on column public.perfiles.es_moderador is 'Se asigna a mano desde SQL. Permite ver denuncias y ocultar publicaciones.';

create or replace function public.es_moderador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select es_moderador from public.perfiles where id = (select auth.uid())), false);
$$;

-- Las publicaciones ocultas desaparecen del mapa (misma lista de columnas: se puede reemplazar).
create or replace view public.animales_mapa
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
where a.estado <> 'vinculado' and a.oculto = false;

-- El detalle agrega la columna oculto al final (permitido por create or replace).
create or replace view public.animales_detalle
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
  (select count(*) from public.avistamientos av where av.animal_id = a.id) as cantidad_avistamientos,
  a.oculto
from public.animales a
join public.perfiles p on p.id = a.creado_por
join lateral (
  select ubicacion, visto_en
  from public.avistamientos
  where animal_id = a.id
  order by visto_en desc
  limit 1
) u on true;

-- Moderadores: ven todas las denuncias, las resuelven y ocultan/muestran animales.
create policy "denuncias: moderadores ven todas"
  on public.denuncias for select to authenticated
  using (public.es_moderador());

create policy "denuncias: moderadores resuelven"
  on public.denuncias for update to authenticated
  using (public.es_moderador())
  with check (public.es_moderador());

create policy "animales: moderadores editan"
  on public.animales for update to authenticated
  using (public.es_moderador())
  with check (public.es_moderador());

-- Tres denuncias de personas distintas ocultan la publicación hasta que alguien la revise.
create or replace function public.ocultar_por_denuncias()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(distinct usuario_id) from public.denuncias where animal_id = new.animal_id) >= 3 then
    update public.animales set oculto = true where id = new.animal_id and oculto = false;
  end if;
  return new;
end;
$$;

create trigger denuncias_ocultar
  after insert on public.denuncias
  for each row execute function public.ocultar_por_denuncias();

-- Vista para el panel de moderación.
create view public.denuncias_detalle
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
  a.descripcion as animal_descripcion,
  a.oculto as animal_oculto,
  a.estado as animal_estado
from public.denuncias d
join public.perfiles p on p.id = d.usuario_id
join public.animales a on a.id = d.animal_id;
