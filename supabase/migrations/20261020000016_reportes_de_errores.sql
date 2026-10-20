-- =============================================================================
-- 0016 · Reportar un error
-- Cualquiera, con o sin cuenta, le avisa a moderación que algo de la app anda
-- mal. Los reportes los leen y los resuelven solo los moderadores. Requiere la
-- 0015 (el aviso 'error').
--   1. Tabla y RLS: se crea solo por reportar_error; leer, solo moderación.
--   2. Capturas: bucket privado "capturas" (nunca el público "fotos").
--   3. reportar_error: valida, limita (5 por hora por cuenta y un tope global
--      por hora para los que se mandan sin cuenta) y avisa a moderación.
--   4. resolver_reporte_error: solo moderación; avisa a quien lo mandó.
--   5. Al borrar la cuenta: sus reportes quedan sin autor y sin captura.
-- Ver docs/DECISIONES.md, "Reportar un error".
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabla
-- ---------------------------------------------------------------------------
create table public.reportes_errores (
  id uuid primary key default gen_random_uuid(),
  -- Null si se mandó sin cuenta o si la cuenta se borró después.
  usuario_id uuid references public.perfiles (id) on delete set null,
  -- Se mandó sin cuenta: es lo que cuenta para el tope de los anónimos (los de
  -- una cuenta borrada también quedan sin usuario, pero no cuentan).
  sin_cuenta boolean not null,
  que_paso text not null check (char_length(que_paso) between 10 and 1000),
  que_hacias text check (char_length(que_hacias) <= 1000),
  -- Solo sin cuenta (con cuenta, la respuesta llega a Actividad). Lo ven solo
  -- los moderadores: esta tabla no se lee desde la app salvo por ellos.
  contacto text check (char_length(contacto) <= 200),
  -- En el bucket privado "capturas", carpeta de quien lo mandó. Solo con cuenta.
  captura_path text check (char_length(captura_path) <= 300),
  -- Lo que suma la app sola.
  pantalla_anterior text check (char_length(pantalla_anterior) <= 300),
  navegador text check (char_length(navegador) <= 500),
  tamanio_pantalla text check (char_length(tamanio_pantalla) <= 40),
  plataforma text check (plataforma in ('web', 'ios', 'android')),
  version_app text check (char_length(version_app) <= 80),
  -- Resolución (moderación).
  resuelto_en timestamptz,
  resuelto_por uuid references public.perfiles (id) on delete set null,
  nota_resolucion text check (char_length(nota_resolucion) <= 1000),
  created_at timestamptz not null default now(),
  constraint reportes_errores_contacto_sin_cuenta check (contacto is null or sin_cuenta),
  constraint reportes_errores_captura_con_cuenta check (captura_path is null or not sin_cuenta)
);

comment on table public.reportes_errores is
  'Errores que reportan las personas desde Perfil. Solo los leen y resuelven los moderadores.';

-- Para los límites por hora y para listar pendientes y resueltos.
create index reportes_errores_usuario_idx on public.reportes_errores (usuario_id, created_at);
create index reportes_errores_sin_cuenta_idx on public.reportes_errores (created_at) where sin_cuenta;
create index reportes_errores_lista_idx on public.reportes_errores ((resuelto_en is null), created_at desc);

alter table public.reportes_errores enable row level security;

-- Se crea y se resuelve solo por las RPC de abajo; desde la API, solo leer.
revoke all on public.reportes_errores from anon, authenticated;
grant select on public.reportes_errores to authenticated;

create policy "reportes_errores: leen los moderadores"
  on public.reportes_errores for select to authenticated
  using ((select public.es_moderador()));

-- Con el nombre de quien lo mandó y de quien lo resolvió. Hereda la RLS.
create view public.reportes_errores_detalle
with (security_invoker = true)
as
select
  r.id,
  r.usuario_id,
  r.sin_cuenta,
  autor.nombre_publico as usuario_nombre,
  r.que_paso,
  r.que_hacias,
  r.contacto,
  r.captura_path,
  r.pantalla_anterior,
  r.navegador,
  r.tamanio_pantalla,
  r.plataforma,
  r.version_app,
  r.resuelto_en,
  r.resuelto_por,
  moderador.nombre_publico as resuelto_por_nombre,
  r.nota_resolucion,
  r.created_at
from public.reportes_errores r
left join public.perfiles autor on autor.id = r.usuario_id
left join public.perfiles moderador on moderador.id = r.resuelto_por;

revoke all on public.reportes_errores_detalle from anon, authenticated;
grant select on public.reportes_errores_detalle to authenticated;

-- Configurables sin tocar código (config_app no se lee desde la API).
insert into public.config_app (clave, valor) values
  ('errores_por_hora_cuenta', '5'),
  ('errores_por_hora_sin_cuenta', '30')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Capturas: bucket privado. Suben solo personas con cuenta, a su carpeta
-- (capturas/<uid>/<archivo>.jpg). Las leen quien la subió y moderación.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('capturas', 'capturas', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "capturas: subir a carpeta propia"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'capturas'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "capturas: leer las propias y moderacion"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'capturas'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.es_moderador())
    )
  );

-- Para borrar la cuenta: la app borra sus capturas con la API de Storage.
create policy "capturas: borrar las propias"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'capturas'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Como es_foto_propia, en el bucket de capturas.
create or replace function public.es_captura_propia(p_path text, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_uid is not null
      and split_part(p_path, '/', 1) = p_uid::text
      and exists (
        select 1 from storage.objects o
        where o.bucket_id = 'capturas' and o.name = p_path
      ),
    false
  );
$$;

revoke all on function public.es_captura_propia from public, anon, authenticated;

-- Las capturas de la carpeta propia, para borrarlas antes de borrar la cuenta
-- (como fotos_para_borrar con las fotos).
create or replace function public.capturas_para_borrar()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'capturas'
    and (select auth.uid()) is not null
    and split_part(o.name, '/', 1) = (select auth.uid())::text
  order by o.name;
$$;

revoke all on function public.capturas_para_borrar from public, anon;
grant execute on function public.capturas_para_borrar to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Reportar: valida, limita y avisa a moderación.
-- ---------------------------------------------------------------------------
create or replace function public.reportar_error(
  p_que_paso text,
  p_que_hacias text default null,
  p_contacto text default null,
  p_captura_path text default null,
  p_pantalla_anterior text default null,
  p_navegador text default null,
  p_tamanio_pantalla text default null,
  p_plataforma text default null,
  p_version_app text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_que_paso text := trim(coalesce(p_que_paso, ''));
  v_que_hacias text := nullif(trim(p_que_hacias), '');
  v_contacto text := nullif(trim(p_contacto), '');
  v_captura text := nullif(trim(p_captura_path), '');
  v_limite int;
  v_recientes int;
  v_id uuid;
  m record;
begin
  if char_length(v_que_paso) < 10 then
    raise exception 'Contá qué pasó con al menos 10 caracteres' using errcode = '22023';
  end if;
  if char_length(v_que_paso) > 1000 then
    raise exception 'Lo que pasó puede tener hasta 1000 caracteres' using errcode = '22023';
  end if;
  if char_length(v_que_hacias) > 1000 then
    raise exception 'Lo que estabas haciendo puede tener hasta 1000 caracteres' using errcode = '22023';
  end if;
  if v_contacto is not null and v_uid is not null then
    raise exception 'Con tu cuenta te avisamos en Actividad: no hace falta un contacto' using errcode = '22023';
  end if;
  if char_length(v_contacto) > 200 then
    raise exception 'El contacto puede tener hasta 200 caracteres' using errcode = '22023';
  end if;
  if v_captura is not null and not public.es_captura_propia(v_captura, v_uid) then
    raise exception 'La captura tiene que subirse desde la app, con tu cuenta' using errcode = '42501';
  end if;

  -- Límites por hora. El candado hace que dos reportes al mismo tiempo no
  -- pasen los dos con la misma cuenta (o con el mismo tope de anónimos).
  if v_uid is not null then
    perform pg_advisory_xact_lock(hashtextextended('reportar_error:' || v_uid::text, 0));
    select coalesce(nullif(valor, '')::int, 5) into v_limite
    from public.config_app where clave = 'errores_por_hora_cuenta';
    select count(*) into v_recientes from public.reportes_errores
    where usuario_id = v_uid and created_at > now() - interval '1 hour';
    if v_recientes >= coalesce(v_limite, 5) then
      raise exception 'Ya mandaste % reportes en la última hora. Probá de nuevo más tarde.',
        coalesce(v_limite, 5) using errcode = 'P0001';
    end if;
  else
    perform pg_advisory_xact_lock(hashtextextended('reportar_error:sin_cuenta', 0));
    select coalesce(nullif(valor, '')::int, 30) into v_limite
    from public.config_app where clave = 'errores_por_hora_sin_cuenta';
    select count(*) into v_recientes from public.reportes_errores
    where sin_cuenta and created_at > now() - interval '1 hour';
    if v_recientes >= coalesce(v_limite, 30) then
      raise exception 'Recibimos muchos reportes sin cuenta en la última hora. Probá más tarde o ingresá con tu cuenta.'
        using errcode = 'P0001';
    end if;
  end if;

  -- Los datos que suma la app se recortan en vez de rechazar el reporte.
  insert into public.reportes_errores (
    usuario_id, sin_cuenta, que_paso, que_hacias, contacto, captura_path,
    pantalla_anterior, navegador, tamanio_pantalla, plataforma, version_app
  ) values (
    v_uid, v_uid is null, v_que_paso, v_que_hacias, v_contacto, v_captura,
    left(nullif(trim(p_pantalla_anterior), ''), 300),
    left(nullif(trim(p_navegador), ''), 500),
    left(nullif(trim(p_tamanio_pantalla), ''), 40),
    case when p_plataforma in ('web', 'ios', 'android') then p_plataforma end,
    left(nullif(trim(p_version_app), ''), 80)
  )
  returning id into v_id;

  -- Un aviso a cada moderador (menos a quien lo mandó). El actor es quien lo
  -- mandó, como en el resto de los avisos: quien lo bloqueó no lo recibe, pero
  -- lo ve igual en el panel.
  for m in select id from public.perfiles where es_moderador and id is distinct from v_uid loop
    perform public.notificar(
      m.id,
      'error',
      'Nuevo reporte de un error',
      left(v_que_paso, 140),
      jsonb_build_object('reporte_error_id', v_id, 'moderacion', true),
      v_uid
    );
  end loop;

  return v_id;
end;
$$;

revoke all on function public.reportar_error from public;
grant execute on function public.reportar_error to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Resolver (solo moderación). Quien lo mandó con su cuenta recibe un aviso
-- en Actividad, con la nota si la hay. Sin actor: lo resuelve moderación, no
-- una persona, así que el aviso llega aunque haya bloqueado a quien lo resolvió.
-- ---------------------------------------------------------------------------
create or replace function public.resolver_reporte_error(p_id uuid, p_nota text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_nota text := nullif(trim(p_nota), '');
  v_reporte public.reportes_errores;
begin
  if not public.es_moderador() then
    raise exception 'Solo moderación puede resolver reportes' using errcode = '42501';
  end if;
  if char_length(v_nota) > 1000 then
    raise exception 'La nota puede tener hasta 1000 caracteres' using errcode = '22023';
  end if;
  select * into v_reporte from public.reportes_errores where id = p_id for update;
  if not found then
    raise exception 'No encontramos ese reporte' using errcode = 'P0002';
  end if;
  if v_reporte.resuelto_en is not null then
    raise exception 'Ese reporte ya está resuelto' using errcode = '22023';
  end if;

  update public.reportes_errores
  set resuelto_en = now(), resuelto_por = v_uid, nota_resolucion = v_nota
  where id = p_id;

  perform public.notificar(
    v_reporte.usuario_id,
    'error',
    'Resolvimos el error que reportaste',
    coalesce(v_nota, 'Gracias por avisarnos.'),
    jsonb_build_object('reporte_error_id', p_id),
    null
  );
end;
$$;

revoke all on function public.resolver_reporte_error from public, anon;
grant execute on function public.resolver_reporte_error to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Borrar la cuenta: igual que en la 0012, más los reportes de errores, que
-- quedan sin autor y sin captura (la app borra las capturas con la API de
-- Storage antes, con capturas_para_borrar). La clave usuario_id ya es "on
-- delete set null"; esto además borra la ruta de la captura.
-- ---------------------------------------------------------------------------
create or replace function public.limpiar_cuenta(p_uid uuid, p_conservar_abiertos boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conservar boolean := coalesce(p_conservar_abiertos, true);
  v_objetivo uuid[];
  v_afectados uuid[];
begin
  if p_uid is null then
    return;
  end if;

  -- Contactos: se borran siempre.
  delete from public.contactos_resguardo where usuario_id = p_uid;
  update public.animales set contacto_familia = null
  where creado_por = p_uid and contacto_familia is not null;

  -- Casos propios que se borran, con los reportes unidos a ellos: los
  -- perdidos siempre; los encontrados, si están cerrados o si no se conservan.
  select coalesce(array_agg(a.id), '{}') into v_objetivo
  from public.animales a
  where a.creado_por = p_uid
    and not (v_conservar and a.tipo_reporte = 'encontrado' and public.caso_abierto(a.id));

  perform public.borrar_casos(v_objetivo);

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

  -- Sus reportes de errores: sin autor y sin captura.
  update public.reportes_errores set usuario_id = null, captura_path = null
  where usuario_id = p_uid;
end;
$$;

revoke all on function public.limpiar_cuenta from public, anon, authenticated;
