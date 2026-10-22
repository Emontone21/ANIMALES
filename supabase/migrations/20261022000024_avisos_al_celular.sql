-- =============================================================================
-- 0024 · Notificaciones en el celular (Web Push)
-- 1. suscripciones_push: una por navegador o app instalada (el endpoint es
--    único), de una persona. Cada una ve y borra solo las suyas; se guardan
--    con guardar_suscripcion_push, que acepta solo los servicios de push de
--    los navegadores: la función avisar les manda pedidos, así que una URL
--    cualquiera no puede entrar.
-- 2. avisos_push: cada aviso de notificaciones que tiene que llegar al
--    celular, con su resultado. Solo service_role. El trigger de
--    notificaciones lo encola si la persona tiene suscripciones y despierta a
--    la función avisar (llamar_avisar: pg_net con X-Avisar-Secret, el mismo
--    esquema que reconocer), una vez por transacción.
-- 3. preparar_avisos_push y terminar_avisos_push (service_role): qué se manda
--    (un tope por persona y por hora, avisos_push_por_hora; uno por caso o
--    conversación cada 5 minutos; nada sobre un caso oculto, de alguien
--    bloqueado ni lo que ya se leyó en Actividad) y el resultado, que borra
--    las suscripciones que el servicio de push dio por vencidas.
-- 4. Los avisos de "lo vieron" y de cambios de estado guardan qué pasó
--    (datos.evento), para el texto del celular.
-- El push nativo de Expo (push_tokens, notificar) no cambia.
-- Prueba: supabase/tests/avisos_push.sql. Ver docs/DECISIONES.md,
-- "Notificaciones en el celular (Web Push)".
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Configuración (config_app no se lee desde la API). La URL y el secreto
--    se cargan en el cierre, como vision_url y vision_secret.
-- ---------------------------------------------------------------------------
insert into public.config_app (clave, valor) values
  ('avisos_push_por_hora', '6'),
  ('avisar_url', ''),
  ('avisar_secret', '')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Suscripciones
-- ---------------------------------------------------------------------------

-- Los servicios de push de Chrome, Edge, Firefox y Safari. Nada de puertos,
-- usuarios ni otros dominios: "fcm.googleapis.com.otro.example" no pasa.
-- La función avisar revisa lo mismo antes de mandar (push.ts).
create or replace function public.es_endpoint_push(p_endpoint text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    char_length(p_endpoint) <= 1024
    and p_endpoint ~ '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)*notify\.windows\.com|([a-z0-9-]+\.)*push\.apple\.com)/[A-Za-z0-9._~:/?#@!$&''()*+,;=%-]+$',
    false
  )
$$;

create table public.suscripciones_push (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  endpoint text not null unique check (public.es_endpoint_push(endpoint)),
  -- La clave pública del navegador (P-256, 65 bytes) y su secreto (16 bytes),
  -- en base64url sin relleno.
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{87}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{22}$'),
  created_at timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);

create index suscripciones_push_usuario_idx on public.suscripciones_push (usuario_id, actualizada_en desc);

alter table public.suscripciones_push enable row level security;
revoke all on public.suscripciones_push from anon, authenticated;
grant select, delete on public.suscripciones_push to authenticated;

create policy "suscripciones_push: ver las propias"
  on public.suscripciones_push for select to authenticated
  using ((select auth.uid()) = usuario_id);

create policy "suscripciones_push: borrar las propias"
  on public.suscripciones_push for delete to authenticated
  using ((select auth.uid()) = usuario_id);

-- Hasta 10 por persona: al pasarse, se borra la que hace más que no se usa.
create or replace function public.guardar_suscripcion_push(p_endpoint text, p_p256dh text, p_auth text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_endpoint text := trim(coalesce(p_endpoint, ''));
  v_p256dh text := rtrim(trim(coalesce(p_p256dh, '')), '=');
  v_auth text := rtrim(trim(coalesce(p_auth, '')), '=');
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Necesitás una cuenta para recibir avisos' using errcode = '42501';
  end if;
  if not public.es_endpoint_push(v_endpoint) then
    raise exception 'Este navegador no tiene un servicio de avisos conocido' using errcode = '22023';
  end if;
  if v_p256dh !~ '^[A-Za-z0-9_-]{87}$' or v_auth !~ '^[A-Za-z0-9_-]{22}$' then
    raise exception 'La suscripción del navegador no es válida' using errcode = '22023';
  end if;

  -- Dos pedidos a la vez de la misma cuenta no se pasan del tope.
  perform pg_advisory_xact_lock(hashtext('suscripciones_push:' || v_uid::text));

  -- Un navegador es de una persona: si otra cuenta lo había registrado (cerró
  -- sesión sin borrarlo), pasa a esta.
  insert into public.suscripciones_push (usuario_id, endpoint, p256dh, auth, actualizada_en)
  values (v_uid, v_endpoint, v_p256dh, v_auth, clock_timestamp())
  on conflict (endpoint) do update
    set usuario_id = excluded.usuario_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        actualizada_en = excluded.actualizada_en
  returning id into v_id;

  delete from public.suscripciones_push
  where id in (
    select id from public.suscripciones_push
    where usuario_id = v_uid
    order by actualizada_en desc, id
    offset 10
  );
  return v_id;
end;
$$;

revoke all on function public.guardar_suscripcion_push from public, anon;
grant execute on function public.guardar_suscripcion_push to authenticated;
revoke all on function public.es_endpoint_push from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. La cola de avisos al celular (solo service_role: sin políticas).
-- ---------------------------------------------------------------------------
create table public.avisos_push (
  id bigint generated always as identity primary key,
  notificacion_id uuid not null references public.notificaciones (id) on delete cascade,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'enviando', 'enviado', 'omitido', 'error')),
  -- Por qué no se mandó (omitido o error).
  motivo text check (motivo in (
    'leida', 'bloqueo', 'oculto', 'sin_suscripciones', 'agrupado', 'tope', 'vencido',
    'sin_respuesta', 'vencida', 'rechazado'
  )),
  -- El caso, la conversación o el reporte del aviso: uno por grupo cada 5 minutos.
  grupo text,
  created_at timestamptz not null default now(),
  tomado_en timestamptz,
  terminado_en timestamptz
);

create index avisos_push_pendientes_idx on public.avisos_push (id) where estado = 'pendiente';
create index avisos_push_usuario_idx on public.avisos_push (usuario_id, tomado_en);
create index avisos_push_notificacion_idx on public.avisos_push (notificacion_id);

alter table public.avisos_push enable row level security;
revoke all on public.avisos_push from anon, authenticated;

-- Lo que la función lee al recibir un pedido: el secreto para validarlo.
create or replace function public.config_avisar()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('secreto', public.config_texto('avisar_secret', ''))
$$;

revoke all on function public.config_avisar from public, anon, authenticated;
grant execute on function public.config_avisar to service_role;

-- Toda llamada de la base a la función pasa por acá. Sin URL o sin secreto,
-- no llama.
create or replace function public.llamar_avisar()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := public.config_texto('avisar_url', '');
  v_secret text := public.config_texto('avisar_secret', '');
begin
  if v_url = '' or v_secret = '' then
    return null;
  end if;
  return net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Avisar-Secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function public.llamar_avisar from public, anon, authenticated;

-- Cada notificación nueva de alguien con suscripciones entra a la cola. La
-- función se despierta una vez por transacción: pg_net manda el pedido
-- después del commit y ella toma todo lo pendiente.
create or replace function public.encolar_aviso_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.config_texto('avisar_url', '') = ''
     or not exists (select 1 from public.suscripciones_push where usuario_id = new.usuario_id) then
    return null;
  end if;
  insert into public.avisos_push (notificacion_id, usuario_id) values (new.id, new.usuario_id);
  if coalesce(current_setting('spot.avisar_llamado', true), '') <> '1' then
    perform set_config('spot.avisar_llamado', '1', true);
    perform public.llamar_avisar();
  end if;
  return null;
end;
$$;

revoke all on function public.encolar_aviso_push from public, anon, authenticated;

create trigger notificaciones_aviso_push
  after insert on public.notificaciones
  for each row
  execute function public.encolar_aviso_push();

-- Un uuid de datos, o null si no lo es.
create or replace function public.uuid_de(p_texto text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_texto ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p_texto::uuid
  end
$$;

revoke all on function public.uuid_de from public, anon, authenticated;

-- Toma hasta p_limite avisos pendientes y decide cada uno:
--   · omitido: ya se leyó, el actor está bloqueado, el caso está oculto (o el
--     otro de la coincidencia), no quedan suscripciones, ya salió uno del
--     mismo grupo en los últimos 5 minutos, o llegó al tope de la hora;
--   · enviando: lo que la función manda. Devuelve los datos del aviso (nunca
--     el texto de un mensaje ni datos de personas) y sus suscripciones.
-- Antes descarta lo que quedó viejo: un pendiente de más de una hora ya no se
-- manda y el registro dura dos días.
create or replace function public.preparar_avisos_push(p_limite integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tope integer := greatest(public.config_numero('avisos_push_por_hora', 6)::int, 0);
  r record;
  v_animal uuid;
  v_conversacion uuid;
  v_coincidencia uuid;
  v_reporte uuid;
  v_caso record;
  v_motivo text;
  v_grupo text;
  v_suscripciones jsonb;
  v_salida jsonb := '[]'::jsonb;
begin
  update public.avisos_push
  set estado = 'omitido', motivo = 'vencido', terminado_en = now()
  where estado = 'pendiente' and created_at < now() - interval '1 hour';
  update public.avisos_push
  set estado = 'error', motivo = 'sin_respuesta', terminado_en = now()
  where estado = 'enviando' and tomado_en < now() - interval '5 minutes';
  delete from public.avisos_push where created_at < now() - interval '2 days';

  for r in
    select a.id, a.usuario_id, n.tipo, n.datos, n.actor_id, n.leida_en
    from public.avisos_push a
    join public.notificaciones n on n.id = a.notificacion_id
    where a.estado = 'pendiente'
    order by a.id
    limit greatest(coalesce(p_limite, 50), 1)
    for update of a skip locked
  loop
    v_motivo := null;
    v_conversacion := public.uuid_de(r.datos ->> 'conversacion_id');
    v_coincidencia := public.uuid_de(r.datos ->> 'coincidencia_id');
    v_reporte := public.uuid_de(r.datos ->> 'reporte_error_id');
    v_animal := coalesce(
      public.uuid_de(r.datos ->> 'animal_id'),
      (select c.animal_id from public.conversaciones c where c.id = v_conversacion)
    );
    select a.nombre, a.especie, a.oculto, a.creado_por, a.tipo_reporte into v_caso
    from public.animales a where a.id = v_animal;

    v_grupo := case
      when v_conversacion is not null then 'conversacion:' || v_conversacion
      when v_animal is not null then 'caso:' || v_animal
      when v_reporte is not null then 'error:' || v_reporte
      else 'general'
    end;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth
    ) order by s.actualizada_en desc), '[]'::jsonb)
    into v_suscripciones
    from public.suscripciones_push s where s.usuario_id = r.usuario_id;

    if r.leida_en is not null then
      v_motivo := 'leida';
    elsif r.actor_id is not null and exists (
      select 1 from public.bloqueos b
      where b.bloqueador_id = r.usuario_id and b.bloqueado_id = r.actor_id
    ) then
      v_motivo := 'bloqueo';
    elsif coalesce(v_caso.oculto, false) or exists (
      select 1 from public.coincidencias co
      join public.animales x on x.id in (co.animal_origen, co.animal_candidato)
      where co.id = v_coincidencia and x.oculto
    ) then
      v_motivo := 'oculto';
    elsif jsonb_array_length(v_suscripciones) = 0 then
      v_motivo := 'sin_suscripciones';
    elsif exists (
      select 1 from public.avisos_push p
      where p.usuario_id = r.usuario_id and p.grupo = v_grupo
        and p.estado in ('enviando', 'enviado') and p.tomado_en > now() - interval '5 minutes'
    ) then
      v_motivo := 'agrupado';
    elsif (
      select count(*) from public.avisos_push p
      where p.usuario_id = r.usuario_id
        and p.estado in ('enviando', 'enviado') and p.tomado_en > now() - interval '1 hour'
    ) >= v_tope then
      v_motivo := 'tope';
    end if;

    if v_motivo is not null then
      update public.avisos_push
      set estado = 'omitido', motivo = v_motivo, grupo = v_grupo, terminado_en = now()
      where id = r.id;
      continue;
    end if;

    update public.avisos_push
    set estado = 'enviando', grupo = v_grupo, tomado_en = now()
    where id = r.id;

    v_salida := v_salida || jsonb_build_object(
      'aviso_id', r.id,
      'tipo', r.tipo,
      'evento', r.datos ->> 'evento',
      'animal_id', v_animal,
      'conversacion_id', v_conversacion,
      'reporte_error_id', v_reporte,
      'moderacion', coalesce((r.datos ->> 'moderacion')::boolean, false),
      'nombre', v_caso.nombre,
      'especie', v_caso.especie,
      -- La familia de un perdido, en sus coincidencias: "Encontraron un animal parecido a…".
      'para_familia', coalesce(r.tipo = 'coincidencia' and v_caso.tipo_reporte = 'perdido'
        and v_caso.creado_por = r.usuario_id, false),
      'suscripciones', v_suscripciones
    );
  end loop;

  return v_salida;
end;
$$;

revoke all on function public.preparar_avisos_push from public, anon, authenticated;
grant execute on function public.preparar_avisos_push to service_role;

-- El resultado de cada envío: [{aviso_id, suscripcion_id, resultado}] con
-- resultado 'ok', 'vencida' (404 o 410: se borra la suscripción) o 'error'.
-- Un aviso queda enviado si llegó a alguno de sus celulares.
create or replace function public.terminar_avisos_push(p_resultados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_borradas integer;
  v_terminados integer;
begin
  if jsonb_typeof(p_resultados) is distinct from 'array' then
    raise exception 'Se esperaba una lista de resultados' using errcode = '22023';
  end if;

  with x as (
    select r.aviso_id, r.suscripcion_id, r.resultado
    from jsonb_to_recordset(p_resultados) as r(aviso_id bigint, suscripcion_id uuid, resultado text)
    where r.resultado in ('ok', 'vencida', 'error')
  ),
  -- Solo suscripciones de avisos en curso y de su misma persona: la lista no
  -- puede borrar cualquiera.
  borradas as (
    delete from public.suscripciones_push s
    using x
    join public.avisos_push a on a.id = x.aviso_id and a.estado = 'enviando'
    where x.resultado = 'vencida' and s.id = x.suscripcion_id and s.usuario_id = a.usuario_id
    returning s.id
  ),
  por_aviso as (
    select aviso_id,
           bool_or(resultado = 'ok') as alguno_ok,
           bool_and(resultado = 'vencida') as solo_vencidas
    from x
    group by aviso_id
  ),
  terminados as (
    update public.avisos_push a
    set estado = case when p.alguno_ok then 'enviado' else 'error' end,
        motivo = case
          when p.alguno_ok then null
          when p.solo_vencidas then 'vencida'
          else 'rechazado'
        end,
        terminado_en = now()
    from por_aviso p
    where a.id = p.aviso_id and a.estado = 'enviando'
    returning a.id
  )
  select (select count(distinct id) from borradas), (select count(*) from terminados)
  into v_borradas, v_terminados;

  return jsonb_build_object('terminados', v_terminados, 'suscripciones_borradas', v_borradas);
end;
$$;

revoke all on function public.terminar_avisos_push from public, anon, authenticated;
grant execute on function public.terminar_avisos_push to service_role;

-- ---------------------------------------------------------------------------
-- 4. Qué pasó, en los datos del aviso (para el texto del celular)
-- ---------------------------------------------------------------------------

-- Igual que en la 0011, con datos.evento: 'visto' o 'resguardado'.
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
      jsonb_build_object('animal_id', new.animal_id, 'evento', new.tipo::text),
      new.usuario_id
    );
  end loop;
  return new;
end;
$$;

-- Igual que en la 0011, con datos.evento: 'reunido' o 'reabierto'.
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
      jsonb_build_object(
        'animal_id', new.animal_id,
        'evento', case when new.estado_nuevo = 'reunido' then 'reunido' else 'reabierto' end
      ),
      new.usuario_id
    );
  end loop;
  return new;
end;
$$;
