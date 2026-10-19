-- =============================================================================
-- 0011 · Fase 7: cuenta y protección de usuarios
--   · Términos: perfiles guarda la versión aceptada y cuándo. Hay que tener
--     aceptada la vigente para publicar, avisar que lo viste, cambiar el
--     estado de un caso, escribir y denunciar.
--   · Perfil: el nombre se guarda sin espacios de más y el avatar solo puede
--     ser una foto de la carpeta propia. Nadie ve los datos de términos ajenos.
--   · Borrado de cuenta: las claves hacia perfiles se revisaron una por una.
--     Lo que queda publicado puede quedar anónimo (usuario en null) y todo lo
--     demás se borra. Ver docs/DECISIONES.md.
--   · Bloqueos: quien está bloqueado no abre conversaciones ni manda mensajes,
--     y quien bloquea deja de recibir sus notificaciones.
--   · Denuncias: para ocultar solo cuentan las de cuentas con 7 días o más.
--   · Resguardo de un perdido: hace falta una foto actual, y el contacto de
--     quien lo resguarda lo ven solo la familia y esa persona.
--   · Volver de resguardado a avistado en un encontrado: solo quien lo publicó
--     o quien lo resguarda.
--   · Las comparaciones con un usuario que puede faltar usan "is distinct
--     from": con null, "<>" da null y la validación se saltearía.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Términos de uso y política de privacidad
-- ---------------------------------------------------------------------------

-- La versión vigente. Cambia junto con los textos de la app
-- (src/features/legal/terminos.ts): una versión nueva obliga a aceptar de nuevo.
insert into public.config_app (clave, valor) values ('terminos_version', '2026-10-19')
on conflict (clave) do nothing;

alter table public.perfiles
  add column terminos_version text check (char_length(terminos_version) <= 40),
  add column terminos_aceptados_en timestamptz,
  add constraint terminos_coherentes
    check ((terminos_version is null) = (terminos_aceptados_en is null));

comment on column public.perfiles.terminos_version is 'Versión de los términos y la política de privacidad que aceptó. Solo la ve su dueño (mis_terminos).';

create or replace function public.version_terminos()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select valor from public.config_app where clave = 'terminos_version';
$$;

revoke all on function public.version_terminos from public, anon, authenticated;

-- ¿El usuario actual aceptó la versión vigente? Se usa en RPC y políticas.
create or replace function public.acepto_terminos()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.terminos_version = public.version_terminos()
  );
$$;

revoke all on function public.acepto_terminos from public, anon, authenticated;
grant execute on function public.acepto_terminos to authenticated;

create or replace function public.exigir_terminos()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.acepto_terminos() then
    raise exception 'Para seguir, aceptá los términos de uso y la política de privacidad'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.exigir_terminos from public, anon, authenticated;

-- Aceptar desde la app. La app manda la versión que mostró: si no es la
-- vigente, los textos cambiaron y tiene que recargarse.
create or replace function public.aceptar_terminos(p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_vigente text := public.version_terminos();
begin
  if v_uid is null then
    raise exception 'Necesitás una cuenta para aceptar los términos' using errcode = '42501';
  end if;
  if p_version is distinct from v_vigente then
    raise exception 'Los términos cambiaron. Recargá la app para ver la versión nueva.'
      using errcode = '22023';
  end if;

  update public.perfiles
  set terminos_version = v_vigente, terminos_aceptados_en = now()
  where id = v_uid and terminos_version is distinct from v_vigente;
end;
$$;

revoke all on function public.aceptar_terminos from public, anon;
grant execute on function public.aceptar_terminos to authenticated;

-- Lo que aceptó el usuario actual y cuál es la versión vigente.
create or replace function public.mis_terminos()
returns table (version text, aceptados_en timestamptz, vigente text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.terminos_version, p.terminos_aceptados_en, public.version_terminos()
  from public.perfiles p
  where p.id = (select auth.uid());
$$;

revoke all on function public.mis_terminos from public, anon;
grant execute on function public.mis_terminos to authenticated;

-- Al registrarse con email, la app manda en user_metadata la versión que
-- aceptó con la casilla. Solo vale si es la vigente; quien entra con Google
-- no la trae y la acepta después, antes de publicar, escribir o denunciar.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nombre text;
  v_version text := nullif(trim(new.raw_user_meta_data ->> 'terminos_version'), '');
  v_acepto boolean;
begin
  nombre := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'nombre_publico'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, 'usuario'), '@', 1)
  );
  nombre := left(nombre, 40);
  if char_length(nombre) < 2 then
    nombre := 'Usuario';
  end if;

  v_acepto := v_version is not null and v_version = public.version_terminos();

  insert into public.perfiles (id, nombre_publico, terminos_version, terminos_aceptados_en)
  values (
    new.id, nombre,
    case when v_acepto then v_version end,
    case when v_acepto then now() end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Perfiles
-- ---------------------------------------------------------------------------

-- Los datos de términos no se publican: la lectura pública queda limitada a
-- las columnas de siempre. El dueño ve los suyos con mis_terminos().
revoke select on public.perfiles from anon, authenticated;
grant select (id, nombre_publico, avatar_path, es_moderador, created_at, updated_at)
  on public.perfiles to anon, authenticated;

-- Nombre sin espacios de más (el CHECK de 2 a 40 corre después) y avatar
-- solo desde la carpeta propia del bucket "fotos", como las fotos de los casos.
create or replace function public.validar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.nombre_publico := trim(new.nombre_publico);
  if new.avatar_path is not null
     and new.avatar_path is distinct from old.avatar_path
     and not public.es_foto_propia(new.avatar_path, new.id) then
    raise exception 'La foto tiene que estar subida desde la app' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger perfiles_validar
  before update of nombre_publico, avatar_path on public.perfiles
  for each row execute function public.validar_perfil();

-- ---------------------------------------------------------------------------
-- 3. Bloqueos
-- ---------------------------------------------------------------------------
create table public.bloqueos (
  bloqueador_id uuid not null references public.perfiles (id) on delete cascade,
  bloqueado_id uuid not null references public.perfiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (bloqueador_id, bloqueado_id),
  check (bloqueador_id <> bloqueado_id)
);

comment on table public.bloqueos is 'Quién bloqueó a quién. Cada uno ve y maneja solo los suyos; a quien bloquean no se le avisa.';

create index bloqueos_bloqueado_idx on public.bloqueos (bloqueado_id);

alter table public.bloqueos enable row level security;

-- Las tablas nuevas reciben todos los permisos por defecto: se dejan solo
-- los que usa la app (bloquear con insert, desbloquear con delete).
revoke all on public.bloqueos from anon, authenticated;
grant select, delete on public.bloqueos to authenticated;
grant insert (bloqueador_id, bloqueado_id) on public.bloqueos to authenticated;

create policy "bloqueos: ver los propios"
  on public.bloqueos for select to authenticated
  using ((select auth.uid()) = bloqueador_id);

create policy "bloqueos: bloquear"
  on public.bloqueos for insert to authenticated
  with check ((select auth.uid()) = bloqueador_id);

create policy "bloqueos: desbloquear"
  on public.bloqueos for delete to authenticated
  using ((select auth.uid()) = bloqueador_id);

-- ¿Hay un bloqueo, en cualquier sentido, entre el usuario actual y otro?
-- Solo pregunta por el propio usuario: no deja averiguar bloqueos ajenos.
create or replace function public.hay_bloqueo_con(p_otro uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bloqueos b
    where (b.bloqueador_id = (select auth.uid()) and b.bloqueado_id = p_otro)
       or (b.bloqueador_id = p_otro and b.bloqueado_id = (select auth.uid()))
  );
$$;

revoke all on function public.hay_bloqueo_con from public, anon, authenticated;
grant execute on function public.hay_bloqueo_con to authenticated;

-- Lista de bloqueados para Perfil.
create view public.bloqueos_detalle
with (security_invoker = true)
as
select
  b.bloqueado_id,
  p.nombre_publico as bloqueado_nombre,
  p.avatar_path as bloqueado_avatar_path,
  b.created_at
from public.bloqueos b
join public.perfiles p on p.id = b.bloqueado_id;

revoke all on public.bloqueos_detalle from anon, authenticated;
grant select on public.bloqueos_detalle to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Notificaciones con actor
-- actor_id es quién causó el aviso (quien lo vio, cambió el estado o escribió).
-- Sirve para no avisar a quien lo bloqueó y para que, al borrar su cuenta, se
-- borren los avisos que llevan su nombre o el texto de sus mensajes.
-- ---------------------------------------------------------------------------
alter table public.notificaciones
  add column actor_id uuid references public.perfiles (id) on delete cascade;

create index notificaciones_actor_idx on public.notificaciones (actor_id) where actor_id is not null;

-- Los avisos de mensajes ya existentes: el actor es el otro participante.
update public.notificaciones n
set actor_id = case when c.participante_a = n.usuario_id then c.participante_b else c.participante_a end
from public.conversaciones c
where n.tipo = 'mensaje' and n.actor_id is null and c.id::text = n.datos ->> 'conversacion_id';

-- La firma cambia (p_actor), así que se borra la vieja: con las dos, una
-- llamada de cinco argumentos sería ambigua.
drop function public.notificar(uuid, public.tipo_notificacion, text, text, jsonb);

create function public.notificar(
  p_usuario_id uuid,
  p_tipo public.tipo_notificacion,
  p_titulo text,
  p_cuerpo text,
  p_datos jsonb default '{}'::jsonb,
  p_actor uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if p_usuario_id is null then
    return;
  end if;
  -- Nadie recibe avisos de lo que hizo, ni de alguien a quien bloqueó.
  if p_actor is not null and (
    p_actor = p_usuario_id
    or exists (
      select 1 from public.bloqueos
      where bloqueador_id = p_usuario_id and bloqueado_id = p_actor
    )
  ) then
    return;
  end if;

  insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, datos, actor_id)
  values (p_usuario_id, p_tipo, p_titulo, p_cuerpo, coalesce(p_datos, '{}'::jsonb), p_actor);

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

-- Un caso anónimo no tiene quien lo publicó.
create or replace function public.interesados_en(p_animal_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select creado_por from public.animales where id = p_animal_id and creado_por is not null
  union
  select usuario_id from public.seguimientos where animal_id = p_animal_id;
$$;

revoke all on function public.interesados_en from public, anon, authenticated;

-- Igual que en la 0010; si la familia de un perdido borró su cuenta, no hay a
-- quién mandarle el aviso propio.
create or replace function public.notificar_coincidencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_animal uuid;
  v_perdido uuid;
  v_familia uuid;
  v_nombre text;
  v_creadores uuid[];
  v_avisados uuid[] := '{}';
begin
  select id, creado_por, nombre into v_perdido, v_familia, v_nombre
  from public.animales
  where id in (new.animal_origen, new.animal_candidato) and tipo_reporte = 'perdido'
  limit 1;

  select array_agg(creado_por) into v_creadores
  from public.animales
  where id in (new.animal_origen, new.animal_candidato);

  if v_perdido is not null and v_familia is not null then
    perform public.notificar(
      v_familia,
      'coincidencia',
      case
        when v_nombre is not null then 'Encontraron un animal parecido a ' || v_nombre
        else 'Encontraron un animal parecido al tuyo'
      end,
      'Mirá las fotos y decidí si es o no. Solo vos podés confirmarlo.',
      jsonb_build_object('animal_id', v_perdido, 'coincidencia_id', new.id)
    );
    v_avisados := array[v_familia];
  end if;

  foreach v_animal in array array[new.animal_origen, new.animal_candidato] loop
    for v_uid in select interesados_en from public.interesados_en(v_animal) loop
      if v_uid = any (v_avisados) then
        continue;
      end if;
      perform public.notificar(
        v_uid,
        'coincidencia',
        'Posible coincidencia',
        case
          when v_perdido is not null then
            'Un reporte que seguís podría ser un animal perdido. Su familia va a confirmar si es o no.'
          when v_uid = any (v_creadores) then
            'Encontramos un reporte que podría ser el mismo animal. Entrá y confirmá si es o no.'
          else
            'Encontramos un reporte que podría ser el mismo animal. Quien lo publicó va a confirmar si es o no.'
        end,
        jsonb_build_object('animal_id', v_animal, 'coincidencia_id', new.id)
      );
      v_avisados := v_avisados || v_uid;
    end loop;
  end loop;
  return new;
end;
$$;

-- Igual que en la 0010, con el actor.
create or replace function public.notificar_avistamiento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_nombre text;
  v_animal text;
begin
  -- El primer avistamiento es la publicación: no hay a quién avisar.
  if new.tipo in ('encontrado', 'perdido') then
    return new;
  end if;
  select nombre_publico into v_nombre from public.perfiles where id = new.usuario_id;
  select coalesce('a ' || nombre, 'al ' || especie::text) into v_animal
  from public.animales where id = new.animal_id;

  for v_uid in select interesados_en from public.interesados_en(new.animal_id) loop
    if v_uid is not distinct from new.usuario_id then
      continue;
    end if;
    perform public.notificar(
      v_uid,
      'avistamiento',
      case when new.tipo = 'resguardado' then 'Lo resguardaron' else 'Lo vieron de nuevo' end,
      case
        when new.tipo = 'resguardado' then coalesce(v_nombre, 'Alguien') || ' tiene ' || v_animal || ' a salvo.'
        else coalesce(v_nombre, 'Alguien') || ' vio ' || v_animal || ' en otro lugar.'
      end,
      jsonb_build_object('animal_id', new.animal_id),
      new.usuario_id
    );
  end loop;
  return new;
end;
$$;

-- Igual que en la 0006, con el actor.
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
    if v_uid is not distinct from new.usuario_id then
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
      jsonb_build_object('animal_id', new.animal_id),
      new.usuario_id
    );
  end loop;
  return new;
end;
$$;

-- Igual que en la 0006, con el actor.
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
    jsonb_build_object('conversacion_id', new.conversacion_id),
    new.emisor_id
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Anonimato: revisión de las claves hacia perfiles
--   · animales.creado_por, avistamientos.usuario_id, cambios_estado.usuario_id:
--     pasan a aceptar null (lo que queda publicado sin autor) y on delete set
--     null. Lo decide limpiar_cuenta (más abajo) antes de borrar el perfil.
--   · animales.vinculado_a: on delete cascade. Si se borra el caso principal,
--     el reporte unido a él ya no tiene avistamientos (pasaron al principal).
--   · Siguen en cascade: seguimientos, denuncias, push_tokens,
--     notificaciones (también por actor_id), conversaciones y mensajes, y
--     bloqueos. coincidencias.resuelta_por sigue en set null.
-- ---------------------------------------------------------------------------
alter table public.animales alter column creado_por drop not null;
alter table public.animales
  drop constraint animales_creado_por_fkey,
  add constraint animales_creado_por_fkey
    foreign key (creado_por) references public.perfiles (id) on delete set null,
  drop constraint animales_vinculado_a_fkey,
  add constraint animales_vinculado_a_fkey
    foreign key (vinculado_a) references public.animales (id) on delete cascade;

alter table public.avistamientos alter column usuario_id drop not null;
alter table public.avistamientos
  drop constraint avistamientos_usuario_id_fkey,
  add constraint avistamientos_usuario_id_fkey
    foreign key (usuario_id) references public.perfiles (id) on delete set null;

alter table public.cambios_estado alter column usuario_id drop not null;
alter table public.cambios_estado
  drop constraint cambios_estado_usuario_id_fkey,
  add constraint cambios_estado_usuario_id_fkey
    foreign key (usuario_id) references public.perfiles (id) on delete set null;

create index cambios_estado_usuario_idx on public.cambios_estado (usuario_id);
create index animales_vinculado_a_idx on public.animales (vinculado_a) where vinculado_a is not null;

comment on column public.animales.creado_por is 'Quien publicó. null: borró su cuenta y eligió dejar el caso publicado sin su nombre.';

-- ---------------------------------------------------------------------------
-- 6. Contacto de quien resguarda
-- Pasa de cambios_estado.contacto_compartido (lectura pública) a una tabla
-- con RLS: en un encontrado lo ve cualquiera, como hasta ahora; en un perdido,
-- o en un encontrado unido a un perdido, solo la familia y quien lo resguarda.
-- No alcanza con ocultarlo en la app: cambios_estado se lee por la API.
-- ---------------------------------------------------------------------------

-- Sigue vinculado_a hasta el caso principal (el mismo si no está vinculado).
create or replace function public.caso_principal(p_animal uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  with recursive cadena (id, vinculado_a, paso) as (
    select a.id, a.vinculado_a, 0 from public.animales a where a.id = p_animal
    union all
    select a.id, a.vinculado_a, c.paso + 1
    from cadena c
    join public.animales a on a.id = c.vinculado_a
    where c.paso < 20
  )
  select id from cadena order by paso desc limit 1;
$$;

revoke all on function public.caso_principal from public, anon, authenticated;

create table public.contactos_resguardo (
  cambio_id uuid primary key references public.cambios_estado (id) on delete cascade,
  animal_id uuid not null references public.animales (id) on delete cascade,
  -- Quien lo resguarda. Al borrar su cuenta, su contacto se borra siempre.
  usuario_id uuid references public.perfiles (id) on delete cascade,
  contacto text not null check (char_length(contacto) between 1 and 200),
  created_at timestamptz not null default now()
);

comment on table public.contactos_resguardo is 'El contacto que comparte quien resguarda un animal. En los perdidos solo lo ven su familia y quien lo resguarda.';

create index contactos_resguardo_animal_idx on public.contactos_resguardo (animal_id);
create index contactos_resguardo_usuario_idx on public.contactos_resguardo (usuario_id);

alter table public.contactos_resguardo enable row level security;

-- Solo lectura desde la API: lo escriben cambiar_estado_animal y resolver_coincidencia.
revoke all on public.contactos_resguardo from anon, authenticated;
grant select on public.contactos_resguardo to anon, authenticated;

create or replace function public.puede_ver_contacto_resguardo(p_animal uuid, p_resguardante uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (p_resguardante is not null and p_resguardante = (select auth.uid()))
    or coalesce((
      select
        case
          when a.tipo_reporte = 'encontrado' and pr.tipo_reporte = 'encontrado' then true
          else (select auth.uid()) in (a.creado_por, pr.creado_por)
        end
      from public.animales a
      join public.animales pr on pr.id = public.caso_principal(a.id)
      where a.id = p_animal
    ), false);
$$;

revoke all on function public.puede_ver_contacto_resguardo from public, anon, authenticated;
grant execute on function public.puede_ver_contacto_resguardo to anon, authenticated;

create policy "contactos_resguardo: lectura segun el caso"
  on public.contactos_resguardo for select
  using (public.puede_ver_contacto_resguardo(animal_id, usuario_id));

-- Los contactos ya cargados pasan a la tabla nueva.
insert into public.contactos_resguardo (cambio_id, animal_id, usuario_id, contacto, created_at)
select c.id, c.animal_id, c.usuario_id, left(trim(c.contacto_compartido), 200), c.created_at
from public.cambios_estado c
where c.contacto_compartido is not null and trim(c.contacto_compartido) <> '';

-- La vista sigue teniendo la columna contacto_compartido, ahora filtrada por
-- RLS. Para sacar la columna de la tabla hay que recrear la vista.
drop view public.cambios_estado_detalle;
alter table public.cambios_estado drop column contacto_compartido;

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
  cr.contacto as contacto_compartido,
  c.nota,
  c.created_at
from public.cambios_estado c
left join public.perfiles p on p.id = c.usuario_id
left join public.contactos_resguardo cr on cr.cambio_id = c.id;

grant select on public.cambios_estado_detalle to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Vistas con autor anónimo: left join a perfiles (mismas columnas).
-- ---------------------------------------------------------------------------
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
  a.oculto,
  a.tipo_reporte,
  a.nombre,
  a.contacto_familia,
  (
    select min(av.visto_en) from public.avistamientos av
    where av.animal_id = a.id and av.tipo = 'perdido'
  ) as perdido_desde
from public.animales a
left join public.perfiles p on p.id = a.creado_por
left join lateral (
  select ubicacion, visto_en
  from public.avistamientos
  where animal_id = a.id
  order by visto_en desc
  limit 1
) u on true;

create or replace view public.avistamientos_detalle
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
left join public.perfiles p on p.id = av.usuario_id;

-- ---------------------------------------------------------------------------
-- 8. RPC con términos, bloqueos y comparaciones seguras con null
-- ---------------------------------------------------------------------------

-- Igual que en la 0010, más los términos.
create or replace function public.publicar_animal(
  p_especie public.especie,
  p_foto_path text,
  p_lat double precision,
  p_lng double precision,
  p_visto_en timestamptz default now(),
  p_tamanio public.tamanio default null,
  p_color text default null,
  p_tiene_collar boolean default false,
  p_descripcion text default null,
  p_tipo public.tipo_reporte default 'encontrado',
  p_nombre text default null,
  p_contacto_familia text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_tipo public.tipo_reporte := coalesce(p_tipo, 'encontrado');
  v_nombre text := nullif(trim(p_nombre), '');
  v_contacto text := nullif(trim(p_contacto_familia), '');
  v_lat double precision := p_lat;
  v_lng double precision := p_lng;
  v_animal_id uuid;
begin
  if v_uid is null then
    raise exception 'Necesitás una cuenta para publicar' using errcode = '42501';
  end if;
  perform public.exigir_terminos();
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'Ubicación inválida' using errcode = '22023';
  end if;
  if p_foto_path is null or p_foto_path = '' then
    raise exception 'La foto es obligatoria' using errcode = '22023';
  end if;
  if not public.es_foto_propia(p_foto_path, v_uid) then
    raise exception 'La foto tiene que estar subida desde la app' using errcode = '22023';
  end if;
  if char_length(v_nombre) > 40 then
    raise exception 'El nombre puede tener hasta 40 caracteres' using errcode = '22023';
  end if;
  if char_length(v_contacto) > 200 then
    raise exception 'El contacto puede tener hasta 200 caracteres' using errcode = '22023';
  end if;

  if v_tipo = 'perdido' then
    -- Donde lo vieron por última vez suele ser la casa de la familia: se
    -- guarda redondeado a 3 decimales (unos 100 m).
    v_lat := round(p_lat::numeric, 3)::double precision;
    v_lng := round(p_lng::numeric, 3)::double precision;
  else
    -- Quien encuentra no conoce el contacto de la familia.
    v_contacto := null;
  end if;

  insert into public.animales (
    especie, tamanio, color, tiene_collar, descripcion, foto_principal_path, creado_por,
    tipo_reporte, nombre, contacto_familia
  )
  values (
    p_especie, p_tamanio, nullif(trim(p_color), ''), coalesce(p_tiene_collar, false),
    nullif(trim(p_descripcion), ''), p_foto_path, v_uid,
    v_tipo, v_nombre, v_contacto
  )
  returning id into v_animal_id;

  insert into public.avistamientos (animal_id, usuario_id, tipo, foto_path, ubicacion, visto_en)
  values (
    v_animal_id,
    v_uid,
    case when v_tipo = 'perdido' then 'perdido' else 'encontrado' end::public.tipo_avistamiento,
    p_foto_path,
    extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography,
    coalesce(p_visto_en, now())
  );

  return v_animal_id;
end;
$$;

-- Igual que en la 0010, más los términos.
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
security definer
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
  perform public.exigir_terminos();
  if p_foto_path is null or p_foto_path = '' then
    raise exception 'La foto es obligatoria' using errcode = '22023';
  end if;
  if not public.es_foto_propia(p_foto_path, v_uid) then
    raise exception 'La foto tiene que estar subida desde la app' using errcode = '22023';
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

-- cambiar_estado_animal suma p_foto_path: cambia la firma, se borra la vieja.
-- Transiciones de siempre:
--   avistado    -> resguardado | reunido
--   resguardado -> reunido | avistado   (se volvió a escapar)
--   reunido     -> avistado             (reabrir)
-- Quién puede:
--   · resguardarlo: cualquiera con cuenta. En un perdido, con una foto
--     actual subida desde la app, que entra a la cola de reconocimiento.
--   · perdido: solo su familia lo marca como reunido o lo reabre.
--   · encontrado: lo marca como reunido, o lo vuelve a avistado, quien lo
--     publicó o quien lo resguarda; reabrir uno cerrado, solo quien lo publicó.
drop function public.cambiar_estado_animal(
  uuid, public.estado_animal, text, text, double precision, double precision
);

create function public.cambiar_estado_animal(
  p_animal_id uuid,
  p_estado_nuevo public.estado_animal,
  p_contacto_compartido text default null,
  p_nota text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_foto_path text default null
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
  v_tipo public.tipo_reporte;
  v_resguarda uuid;
  v_ubicacion extensions.geography;
  v_foto text := nullif(trim(p_foto_path), '');
  v_contacto text := nullif(trim(p_contacto_compartido), '');
  v_cambio uuid;
begin
  if v_uid is null then
    raise exception 'Necesitás una cuenta para cambiar el estado' using errcode = '42501';
  end if;
  perform public.exigir_terminos();
  if p_estado_nuevo = 'vinculado' then
    raise exception 'Para vincular reportes usá las coincidencias' using errcode = '22023';
  end if;

  select estado, creado_por, tipo_reporte into v_actual, v_creador, v_tipo
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
  if not (
    (v_actual = 'avistado' and p_estado_nuevo in ('resguardado', 'reunido'))
    or (v_actual = 'resguardado' and p_estado_nuevo in ('reunido', 'avistado'))
    or (v_actual = 'reunido' and p_estado_nuevo = 'avistado')
  ) then
    raise exception 'Ese cambio de estado no está permitido' using errcode = '22023';
  end if;

  -- Quien lo tiene resguardado: el último que lo pasó a resguardado.
  if v_actual = 'resguardado' then
    select usuario_id into v_resguarda
    from public.cambios_estado
    where animal_id = p_animal_id and estado_nuevo = 'resguardado'
    order by created_at desc
    limit 1;
  end if;

  if p_estado_nuevo = 'resguardado' then
    if v_tipo = 'perdido' and v_foto is null then
      raise exception 'Para avisar que lo tenés, sacale una foto actual' using errcode = '22023';
    end if;
    if v_foto is not null and not public.es_foto_propia(v_foto, v_uid) then
      raise exception 'La foto tiene que estar subida desde la app' using errcode = '22023';
    end if;
    if char_length(v_contacto) > 200 then
      raise exception 'El contacto puede tener hasta 200 caracteres' using errcode = '22023';
    end if;
  end if;

  if p_estado_nuevo = 'reunido' then
    if v_tipo = 'perdido' and v_uid is distinct from v_creador then
      raise exception 'Solo su familia puede marcarlo como reunido' using errcode = '42501';
    end if;
    if v_tipo = 'encontrado' and v_uid is distinct from v_creador and v_uid is distinct from v_resguarda then
      raise exception 'Solo quien lo publicó o quien lo tiene resguardado puede marcarlo como reunido'
        using errcode = '42501';
    end if;
  end if;

  if p_estado_nuevo = 'avistado' then
    if v_tipo = 'perdido' and v_uid is distinct from v_creador then
      raise exception 'Solo su familia puede reabrir el caso' using errcode = '42501';
    end if;
    if v_actual = 'reunido' and v_uid is distinct from v_creador then
      raise exception 'Solo quien publicó puede reabrir el caso' using errcode = '42501';
    end if;
    if v_actual = 'resguardado' and v_uid is distinct from v_creador and v_uid is distinct from v_resguarda then
      raise exception 'Solo quien lo publicó o quien lo tiene resguardado puede decir que se volvió a escapar'
        using errcode = '42501';
    end if;
  end if;

  update public.animales set estado = p_estado_nuevo where id = p_animal_id;

  insert into public.cambios_estado (animal_id, usuario_id, estado_anterior, estado_nuevo, nota)
  values (p_animal_id, v_uid, v_actual, p_estado_nuevo, nullif(trim(p_nota), ''))
  returning id into v_cambio;

  if p_estado_nuevo = 'resguardado' then
    if v_contacto is not null then
      insert into public.contactos_resguardo (cambio_id, animal_id, usuario_id, contacto)
      values (v_cambio, p_animal_id, v_uid, v_contacto);
    end if;

    -- Resguardarlo cuenta como un avistamiento. Con foto, entra a la cola de
    -- reconocimiento (trigger avistamientos_encolar).
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
    values (p_animal_id, v_uid, 'resguardado', v_foto, v_ubicacion, now(), nullif(trim(p_nota), ''));
  end if;

  insert into public.seguimientos (usuario_id, animal_id)
  values (v_uid, p_animal_id)
  on conflict do nothing;
end;
$$;

revoke all on function public.cambiar_estado_animal from public, anon;
grant execute on function public.cambiar_estado_animal to authenticated;

-- Igual que en la 0010, con comparaciones seguras con null (un caso anónimo
-- no tiene creado_por) y el contacto en contactos_resguardo. Una coincidencia
-- con un perdido cuya familia borró su cuenta no la puede decidir nadie.
create or replace function public.resolver_coincidencia(p_id uuid, p_confirmada boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_c public.coincidencias%rowtype;
  v_origen public.animales%rowtype;
  v_candidato public.animales%rowtype;
  v_perdido uuid;
  v_familia uuid;
  v_principal uuid;
  v_secundario uuid;
  v_estado_principal public.estado_animal;
  v_estado_secundario public.estado_animal;
  v_creador_secundario uuid;
  v_resguarda uuid;
  v_contacto text;
  v_cambio uuid;
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

  select * into v_origen from public.animales where id = v_c.animal_origen;
  select * into v_candidato from public.animales where id = v_c.animal_candidato;

  if v_origen.tipo_reporte = 'perdido' then
    v_perdido := v_origen.id;
    v_familia := v_origen.creado_por;
  elsif v_candidato.tipo_reporte = 'perdido' then
    v_perdido := v_candidato.id;
    v_familia := v_candidato.creado_por;
  end if;

  if v_perdido is not null then
    if v_uid is distinct from v_familia then
      raise exception 'Solo la familia del animal perdido puede confirmar o rechazar esta coincidencia'
        using errcode = '42501';
    end if;
  elsif not (
    v_uid is not distinct from v_origen.creado_por
    or v_uid is not distinct from v_candidato.creado_por
    or public.es_moderador()
  ) then
    raise exception 'Solo quien publicó alguno de los dos reportes o un moderador puede confirmar o rechazar esta coincidencia'
      using errcode = '42501';
  end if;

  update public.coincidencias
  set estado = (case when p_confirmada then 'confirmada' else 'rechazada' end)::public.estado_coincidencia,
      resuelta_por = v_uid,
      resuelta_en = now()
  where id = p_id;

  if not p_confirmada then
    return null;
  end if;

  -- El perdido es siempre el principal; entre dos encontrados, el más viejo.
  if v_perdido is not null then
    v_principal := v_perdido;
    v_secundario := case when v_perdido = v_origen.id then v_candidato.id else v_origen.id end;
  elsif v_origen.created_at <= v_candidato.created_at then
    v_principal := v_origen.id;
    v_secundario := v_candidato.id;
  else
    v_principal := v_candidato.id;
    v_secundario := v_origen.id;
  end if;

  select estado, creado_por into v_estado_secundario, v_creador_secundario
  from public.animales
  where id = v_secundario
  for update;

  select estado into v_estado_principal
  from public.animales
  where id = v_principal
  for update;

  -- Si el secundario ya estaba vinculado a otro, no se puede re-vincular.
  if v_estado_secundario = 'vinculado' then
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

  -- Quien lo tenía resguardado lo sigue teniendo: el principal pasa a
  -- resguardado con el mismo contacto.
  if v_estado_secundario = 'resguardado' and v_estado_principal = 'avistado' then
    select c.usuario_id, cr.contacto into v_resguarda, v_contacto
    from public.cambios_estado c
    left join public.contactos_resguardo cr on cr.cambio_id = c.id
    where c.animal_id = v_secundario and c.estado_nuevo = 'resguardado'
    order by c.created_at desc
    limit 1;

    v_resguarda := coalesce(v_resguarda, v_creador_secundario);

    update public.animales set estado = 'resguardado' where id = v_principal;

    insert into public.cambios_estado (animal_id, usuario_id, estado_anterior, estado_nuevo, nota)
    values (v_principal, v_resguarda, 'avistado', 'resguardado', null)
    returning id into v_cambio;

    if v_contacto is not null then
      insert into public.contactos_resguardo (cambio_id, animal_id, usuario_id, contacto)
      values (v_cambio, v_principal, v_resguarda, v_contacto);
    end if;
  end if;

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
  values (v_secundario, v_uid, v_estado_secundario, 'vinculado', null);

  return v_principal;
end;
$$;

revoke all on function public.resolver_coincidencia from public, anon;
grant execute on function public.resolver_coincidencia to authenticated;

-- Igual que en la 0006, más los términos y los bloqueos.
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
  perform public.exigir_terminos();
  if p_otro_usuario is null or p_otro_usuario = v_uid then
    raise exception 'No podés escribirte a vos' using errcode = '22023';
  end if;
  if not exists (select 1 from public.perfiles where id = p_otro_usuario) then
    raise exception 'Ese usuario no existe' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.animales where id = p_animal_id) then
    raise exception 'No encontramos este reporte' using errcode = 'P0002';
  end if;
  if public.hay_bloqueo_con(p_otro_usuario) then
    raise exception 'No podés escribirle a esta persona' using errcode = '42501';
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

-- Mandar un mensaje: además de ser participante, sin bloqueos entre los dos
-- y con los términos aceptados.
drop policy "mensajes: enviar en mis conversaciones" on public.mensajes;
create policy "mensajes: enviar en mis conversaciones"
  on public.mensajes for insert to authenticated
  with check (
    (select auth.uid()) = emisor_id
    and exists (
      select 1 from public.conversaciones c
      where c.id = conversacion_id
        and (select auth.uid()) in (c.participante_a, c.participante_b)
        and not public.hay_bloqueo_con(
          case when c.participante_a = (select auth.uid()) then c.participante_b else c.participante_a end
        )
    )
    and public.acepto_terminos()
  );

-- Conversaciones con el estado del bloqueo, para mostrarlo en la app:
-- bloqueada (en cualquier sentido) y bloqueaste (vos a la otra persona).
create or replace view public.conversaciones_detalle
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
  c.updated_at,
  public.hay_bloqueo_con(p.id) as bloqueada,
  exists (
    select 1 from public.bloqueos b
    where b.bloqueador_id = (select auth.uid()) and b.bloqueado_id = p.id
  ) as bloqueaste
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

-- ---------------------------------------------------------------------------
-- 9. Denuncias
-- ---------------------------------------------------------------------------

-- Denunciar pide los términos aceptados.
drop policy "denuncias: crear" on public.denuncias;
create policy "denuncias: crear"
  on public.denuncias for insert to authenticated
  with check ((select auth.uid()) = usuario_id and public.acepto_terminos());

-- Para ocultar solas, solo cuentan las denuncias de cuentas que tenían al
-- menos 7 días al denunciar: crear cuentas para tirar una publicación no alcanza.
create or replace function public.ocultar_por_denuncias()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(distinct d.usuario_id)
    from public.denuncias d
    join public.perfiles p on p.id = d.usuario_id
    where d.animal_id = new.animal_id
      and p.created_at <= d.created_at - interval '7 days'
  ) >= 3 then
    update public.animales set oculto = true where id = new.animal_id and oculto = false;
  end if;
  return new;
end;
$$;

-- Los moderadores siguen viendo todas; cuenta_nueva marca las que no cuentan.
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
  a.descripcion as animal_descripcion,
  a.oculto as animal_oculto,
  a.estado as animal_estado,
  p.created_at > d.created_at - interval '7 days' as cuenta_nueva
from public.denuncias d
join public.perfiles p on p.id = d.usuario_id
join public.animales a on a.id = d.animal_id;

-- ---------------------------------------------------------------------------
-- 10. Borrar la cuenta
-- Lo que se conserva, si la persona elige dejarlo publicado (por defecto):
--   · sus casos abiertos, sin autor;
--   · sus avistamientos y cambios de estado en casos abiertos de otros, sin autor.
-- "Abierto" es que el caso principal (siguiendo vinculado_a) esté avistado o
-- resguardado. Si elige borrarlo, se borra también eso.
-- Siempre se borran: sus casos cerrados (con lo que tienen adentro), sus
-- avistamientos y cambios de estado en casos cerrados, su contacto de
-- resguardo, el contacto_familia y, por cascada al borrar el perfil,
-- seguimientos, notificaciones (las suyas y las que causó), tokens, denuncias
-- hechas, bloqueos, conversaciones y mensajes.
-- Las fotos no se borran acá (no se tocan filas de storage.objects por SQL):
-- la app pide la lista con fotos_para_borrar y las borra con la API de Storage.
-- ---------------------------------------------------------------------------
create or replace function public.caso_abierto(p_animal uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select a.estado in ('avistado', 'resguardado')
    from public.animales a
    where a.id = public.caso_principal(p_animal)
  ), false);
$$;

revoke all on function public.caso_abierto from public, anon, authenticated;

create or replace function public.limpiar_cuenta(p_uid uuid, p_conservar_abiertos boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conservar boolean := coalesce(p_conservar_abiertos, true);
  v_borrados uuid[];
  v_afectados uuid[];
begin
  if p_uid is null then
    return;
  end if;

  -- Contactos: se borran siempre.
  delete from public.contactos_resguardo where usuario_id = p_uid;
  update public.animales set contacto_familia = null
  where creado_por = p_uid and contacto_familia is not null;

  -- Casos propios que se borran, con los reportes unidos a ellos.
  with recursive objetivo as (
    select a.id from public.animales a
    where a.creado_por = p_uid and not (v_conservar and public.caso_abierto(a.id))
  ), arbol as (
    select id from objetivo
    union
    select a.id from public.animales a join arbol on a.vinculado_a = arbol.id
  )
  select coalesce(array_agg(id), '{}') into v_borrados from arbol;

  delete from public.animales where id = any (v_borrados);

  -- Los avisos de otras personas que apuntaban a esos casos.
  delete from public.notificaciones where datos ->> 'animal_id' = any (v_borrados::text[]);

  -- Sus avistamientos en casos que no se conservan.
  with borrados as (
    delete from public.avistamientos av
    where av.usuario_id = p_uid and not (v_conservar and public.caso_abierto(av.animal_id))
    returning av.animal_id
  )
  select coalesce(array_agg(distinct animal_id), '{}') into v_afectados from borrados;

  update public.animales a
  set ultimo_avistamiento_en = (select max(visto_en) from public.avistamientos where animal_id = a.id)
  where a.id = any (v_afectados);

  -- Sus cambios de estado en casos que no se conservan.
  delete from public.cambios_estado c
  where c.usuario_id = p_uid and not (v_conservar and public.caso_abierto(c.animal_id));

  -- Lo que queda publicado, sin autor.
  update public.avistamientos set usuario_id = null where usuario_id = p_uid;
  update public.cambios_estado set usuario_id = null where usuario_id = p_uid;
  update public.animales set creado_por = null where creado_por = p_uid;
end;
$$;

revoke all on function public.limpiar_cuenta from public, anon, authenticated;

-- Si se borra un usuario desde el panel de Supabase (sin pasar por la app),
-- se aplica lo mismo con la opción por defecto: dejar publicado lo abierto.
create or replace function public.al_borrar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.limpiar_cuenta(old.id, true);
  return old;
end;
$$;

create trigger perfiles_al_borrar
  before delete on public.perfiles
  for each row execute function public.al_borrar_perfil();

-- Las fotos de la carpeta del usuario que hay que borrar antes de borrar la
-- cuenta: todas menos las de lo que queda publicado sin autor.
create or replace function public.fotos_para_borrar(p_conservar_abiertos boolean default true)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'fotos'
    and (select auth.uid()) is not null
    and split_part(o.name, '/', 1) = (select auth.uid())::text
    and not (
      coalesce(p_conservar_abiertos, true)
      and (
        exists (
          select 1 from public.animales a
          where a.creado_por = (select auth.uid())
            and a.foto_principal_path = o.name
            and public.caso_abierto(a.id)
        )
        or exists (
          select 1 from public.avistamientos av
          where av.usuario_id = (select auth.uid())
            and av.foto_path = o.name
            and public.caso_abierto(av.animal_id)
        )
      )
    )
  order by o.name;
$$;

revoke all on function public.fotos_para_borrar from public, anon;
grant execute on function public.fotos_para_borrar to authenticated;

-- Borra la cuenta del usuario actual, y solo la suya.
create or replace function public.borrar_mi_cuenta(p_conservar_abiertos boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Necesitás una cuenta para borrarla' using errcode = '42501';
  end if;

  perform public.limpiar_cuenta(v_uid, coalesce(p_conservar_abiertos, true));

  -- Borra también el perfil y todo lo que cuelga de él, por cascada.
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.borrar_mi_cuenta from public, anon;
grant execute on function public.borrar_mi_cuenta to authenticated;
