-- =============================================================================
-- Pruebas de las notificaciones en el celular (migración 0024): las
-- suscripciones con su RLS, la cola que llena el trigger de notificaciones y
-- despierta a la función avisar una vez por transacción, y lo que decide
-- preparar_avisos_push (tope por hora, uno por caso cada 5 minutos, casos
-- ocultos, bloqueos y avisos ya leídos), más terminar_avisos_push, que borra
-- las suscripciones vencidas.
-- Todo corre dentro de begin/rollback: no deja usuarios, casos ni
-- suscripciones, y cambia config_app solo dentro de la transacción. No manda
-- nada: pg_net guarda el pedido y nadie lo atiende.
-- Toda la prueba es una sola transacción: para simular otra, se borra la marca
-- spot.avisar_llamado.
--
-- Personas: F (familia de Toby), V (lo ve y le escribe) y S (sigue el caso).
-- =============================================================================
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000002401', 'prueba-push-f@spot.test', '{"nombre_publico":"Prueba Familia"}'),
  ('00000000-0000-4000-8000-000000002402', 'prueba-push-v@spot.test', '{"nombre_publico":"Prueba Vio"}'),
  ('00000000-0000-4000-8000-000000002403', 'prueba-push-s@spot.test', '{"nombre_publico":"Prueba Sigue"}');
update public.perfiles
set terminos_version = public.version_terminos(), terminos_aceptados_en = now()
where id::text like '00000000-0000-4000-8000-00000000240_';

do $$
begin
  if public.config_numero('avisos_push_por_hora', 0) <> 6
     or public.config_texto('avisar_url', 'x') <> '' then
    raise exception 'FALLA 0: config_app no tiene avisos_push_por_hora en 6 y avisar_url vacía';
  end if;
end $$;

-- Para la prueba: la función "configurada" (nadie la atiende) y topes altos de publicar.
update public.config_app set valor = 'https://ejemplo.supabase.co/functions/v1/avisar' where clave = 'avisar_url';
update public.config_app set valor = repeat('ab', 32) where clave = 'avisar_secret';
update public.config_app set valor = '100'
where clave in ('publicaciones_por_hora_cuenta', 'avisos_por_hora_cuenta');

create function pg_temp.foto(p_uid uuid) returns text language sql security definer as $$
  insert into storage.objects (bucket_id, name)
  values ('fotos', p_uid::text || '/' || gen_random_uuid()::text || '.jpg')
  returning name
$$;

-- Claves con la forma de las de un navegador (87 y 22 caracteres base64url).
create function pg_temp.p256dh(p_letra text) returns text language sql as $$
  select 'B' || repeat(p_letra, 86)
$$;
create function pg_temp.auth(p_letra text) returns text language sql as $$
  select repeat(p_letra, 22)
$$;

-- Los pedidos de pg_net a la función avisar.
create function pg_temp.llamadas() returns bigint language sql as $$
  select count(*) from net.http_request_queue
  where url = 'https://ejemplo.supabase.co/functions/v1/avisar'
$$;

create temp table casos (nombre text primary key, animal uuid) on commit drop;
grant all on casos to public;
create temp table subs (nombre text primary key, id uuid) on commit drop;
grant all on subs to public;

-- -----------------------------------------------------------------------------
-- 1. Suscripciones: cada persona las suyas, y solo servicios de push conocidos.
-- -----------------------------------------------------------------------------
do $$
begin
  if has_function_privilege('anon', 'public.guardar_suscripcion_push(text, text, text)', 'execute') then
    raise exception 'FALLA 1a: anon puede guardar suscripciones';
  end if;
  if has_table_privilege('authenticated', 'public.suscripciones_push', 'insert')
     or has_table_privilege('authenticated', 'public.suscripciones_push', 'update')
     or has_table_privilege('anon', 'public.suscripciones_push', 'select') then
    raise exception 'FALLA 1a: suscripciones_push se puede escribir sin la RPC o leer sin cuenta';
  end if;
end $$;

set local role authenticated;

do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002401';
  v constant uuid := '00000000-0000-4000-8000-000000002402';
  malo text;
  bueno text;
  n integer;
begin
  -- 1b. F guarda la de su celular (Chrome) y la ve; V no la ve.
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  insert into subs values ('F', public.guardar_suscripcion_push(
    'https://fcm.googleapis.com/fcm/send/prueba-celular-f', pg_temp.p256dh('F'), pg_temp.auth('f') || '=='));
  if (select count(*) from public.suscripciones_push) <> 1 then
    raise exception 'FALLA 1b: F no ve su suscripción';
  end if;
  if (select auth from public.suscripciones_push) <> pg_temp.auth('f') then
    raise exception 'FALLA 1b: el secreto no se guardó sin el relleno';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  if (select count(*) from public.suscripciones_push) <> 0 then
    raise exception 'FALLA 1b: V ve la suscripción de F';
  end if;
  -- 1c. V no la puede borrar.
  delete from public.suscripciones_push where endpoint like '%prueba-celular-f';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FALLA 1c: V borró la suscripción de F';
  end if;

  -- 1d. Solo los servicios de push de los navegadores, por https y sin puerto.
  foreach malo in array array[
    'http://fcm.googleapis.com/fcm/send/x',
    'https://fcm.googleapis.com.otro.example/fcm/send/x',
    'https://fcm.googleapis.com:8443/fcm/send/x',
    'https://usuario@fcm.googleapis.com/fcm/send/x',
    'https://ejemplo.supabase.co/functions/v1/avisar',
    'https://127.0.0.1/x',
    'https://push.apple.com.example/x',
    'https://web.push.apple.com/x y',
    'https://fcm.googleapis.com/' || repeat('x', 1100)
  ] loop
    begin
      perform public.guardar_suscripcion_push(malo, pg_temp.p256dh('V'), pg_temp.auth('v'));
      raise exception 'FALLA 1d: aceptó el endpoint %', malo;
    exception when invalid_parameter_value then
      null;
    end;
  end loop;
  foreach bueno in array array[
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAAAB-prueba',
    'https://wns2-par02p.notify.windows.com/w/?token=BQYAAAB%3d%3d',
    'https://web.push.apple.com/QGx-prueba_1'
  ] loop
    perform public.guardar_suscripcion_push(bueno, pg_temp.p256dh('V'), pg_temp.auth('v'));
  end loop;

  -- 1e. Claves que no son de un navegador.
  begin
    perform public.guardar_suscripcion_push('https://fcm.googleapis.com/fcm/send/v2', 'corta', pg_temp.auth('v'));
    raise exception 'FALLA 1e: aceptó una clave p256dh corta';
  exception when invalid_parameter_value then
    null;
  end;
  begin
    perform public.guardar_suscripcion_push('https://fcm.googleapis.com/fcm/send/v2', pg_temp.p256dh('V'), 'no/es+base64url-!!!!!');
    raise exception 'FALLA 1e: aceptó un secreto con otra forma';
  exception when invalid_parameter_value then
    null;
  end;

  -- 1f. Sin la RPC no se escribe.
  begin
    insert into public.suscripciones_push (usuario_id, endpoint, p256dh, auth)
    values (v, 'https://fcm.googleapis.com/fcm/send/directa', pg_temp.p256dh('V'), pg_temp.auth('v'));
    raise exception 'FALLA 1f: V insertó una suscripción sin la RPC';
  exception when insufficient_privilege then
    null;
  end;

  -- 1g. El mismo navegador con otra cuenta pasa a esa cuenta.
  perform public.guardar_suscripcion_push(
    'https://fcm.googleapis.com/fcm/send/compartido', pg_temp.p256dh('V'), pg_temp.auth('v'));
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  perform public.guardar_suscripcion_push(
    'https://fcm.googleapis.com/fcm/send/compartido', pg_temp.p256dh('G'), pg_temp.auth('g'));
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.suscripciones_push where endpoint like '%/compartido') then
    raise exception 'FALLA 1g: el navegador compartido sigue en la cuenta de V';
  end if;

  -- 1h. Hasta 10 por persona: se va la más vieja.
  for n in 1..12 loop
    perform public.guardar_suscripcion_push(
      'https://fcm.googleapis.com/fcm/send/v-' || n, pg_temp.p256dh('V'), pg_temp.auth('v'));
  end loop;
  if (select count(*) from public.suscripciones_push) <> 10 then
    raise exception 'FALLA 1h: V tiene % suscripciones (máximo 10)', (select count(*) from public.suscripciones_push);
  end if;
  if exists (select 1 from public.suscripciones_push where endpoint like '%mozilla%') then
    raise exception 'FALLA 1h: no se borró la más vieja';
  end if;

  -- 1i. F borra la suya del navegador compartido (al cerrar sesión).
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  delete from public.suscripciones_push where endpoint like '%/compartido';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'FALLA 1i: F no pudo borrar su suscripción';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. La cola: un aviso nuevo de alguien con suscripciones entra y despierta a
--    la función, una vez por transacción.
-- -----------------------------------------------------------------------------
reset role;
-- V no recibe nada en el celular en esta prueba: sin suscripciones.
delete from public.suscripciones_push where usuario_id = '00000000-0000-4000-8000-000000002402';
do $$ begin perform set_config('spot.avisar_llamado', '', true); end $$;
set local role authenticated;

do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002401';
  v constant uuid := '00000000-0000-4000-8000-000000002402';
  s constant uuid := '00000000-0000-4000-8000-000000002403';
  p uuid;
  q uuid;
  r uuid;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  p := public.publicar_animal('perro', pg_temp.foto(f), -34.91, -56.16, now() - interval '1 day',
    'mediano', 'marrón', false, null, 'perdido', 'Toby');
  q := public.publicar_animal('gato', pg_temp.foto(f), -34.91, -56.16, now() - interval '1 day',
    'chico', 'gris', false, null, 'perdido', null);
  r := public.publicar_animal('perro', pg_temp.foto(f), -34.91, -56.16, now() - interval '1 day',
    'grande', 'negro', false, null, 'perdido', 'Luna');
  insert into casos values ('Toby', p), ('Gato', q), ('Luna', r);

  -- S sigue a Toby (para los cambios de estado).
  perform set_config('request.jwt.claims', json_build_object('sub', s, 'role', 'authenticated')::text, true);
  insert into public.seguimientos (usuario_id, animal_id) values (s, p);
end $$;

reset role;
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002401';
  antes bigint := pg_temp.llamadas();
begin
  -- Publicar no avisa a nadie: ni cola ni pedido.
  if exists (select 1 from public.avisos_push) or antes <> 0 then
    raise exception 'FALLA 2a: publicar encoló avisos o llamó a la función';
  end if;
end $$;

set local role authenticated;
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002401';
  v constant uuid := '00000000-0000-4000-8000-000000002402';
  p uuid := (select animal from casos where nombre = 'Toby');
  q uuid := (select animal from casos where nombre = 'Gato');
begin
  -- 2b. V lo ve dos veces (Toby y el gato) en la misma transacción.
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  perform public.registrar_avistamiento(p, pg_temp.foto(v), -34.912, -56.162);
  perform public.registrar_avistamiento(q, pg_temp.foto(v), -34.912, -56.162);
end $$;

reset role;
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002401';
  p uuid := (select animal from casos where nombre = 'Toby');
  pedido record;
begin
  if (select count(*) from public.avisos_push where usuario_id = f and estado = 'pendiente') <> 2 then
    raise exception 'FALLA 2b: los dos avisos de F no quedaron pendientes';
  end if;
  if pg_temp.llamadas() <> 1 then
    raise exception 'FALLA 2b: la función se llamó % veces (una por transacción)', pg_temp.llamadas();
  end if;
  select * into pedido from net.http_request_queue
  where url = 'https://ejemplo.supabase.co/functions/v1/avisar';
  if pedido.headers ->> 'X-Avisar-Secret' is distinct from repeat('ab', 32)
     or convert_from(pedido.body, 'UTF8')::jsonb <> '{}'::jsonb then
    raise exception 'FALLA 2b: el pedido no lleva el secreto o lleva datos en el cuerpo';
  end if;
  -- 2c. El aviso guarda qué pasó.
  if not exists (
    select 1 from public.notificaciones
    where usuario_id = f and datos ->> 'animal_id' = p::text and datos ->> 'evento' = 'visto'
  ) then
    raise exception 'FALLA 2c: el aviso de "lo vieron" no tiene evento visto';
  end if;
  -- 2d. V no tiene suscripciones: sus avisos no entran a la cola.
  perform public.notificar('00000000-0000-4000-8000-000000002402', 'estado', 'x', 'y', '{}'::jsonb);
  if exists (select 1 from public.avisos_push where usuario_id = '00000000-0000-4000-8000-000000002402') then
    raise exception 'FALLA 2d: entró a la cola un aviso de alguien sin suscripciones';
  end if;
  -- 2e. Sin la URL de la función, nada entra a la cola.
  update public.config_app set valor = '' where clave = 'avisar_url';
  perform public.notificar(f, 'estado', 'x', 'y', '{}'::jsonb);
  if (select count(*) from public.avisos_push) <> 2 then
    raise exception 'FALLA 2e: sin avisar_url entró un aviso a la cola';
  end if;
  update public.config_app set valor = 'https://ejemplo.supabase.co/functions/v1/avisar' where clave = 'avisar_url';
end $$;

-- -----------------------------------------------------------------------------
-- 3. preparar y terminar (service_role)
-- -----------------------------------------------------------------------------
set local role service_role;
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002401';
  p uuid := (select animal from casos where nombre = 'Toby');
  q uuid := (select animal from casos where nombre = 'Gato');
  lista jsonb;
  toby jsonb;
  gato jsonb;
  sub uuid := (select id from subs where nombre = 'F');
  resultado jsonb;
begin
  lista := public.preparar_avisos_push(50);
  if jsonb_array_length(lista) <> 2 then
    raise exception 'FALLA 3a: preparar devolvió % avisos (2)', jsonb_array_length(lista);
  end if;
  select e into toby from jsonb_array_elements(lista) e where e ->> 'animal_id' = p::text;
  select e into gato from jsonb_array_elements(lista) e where e ->> 'animal_id' = q::text;
  if toby ->> 'tipo' <> 'avistamiento' or toby ->> 'evento' <> 'visto' or toby ->> 'nombre' <> 'Toby'
     or toby ->> 'especie' <> 'perro' or (toby ->> 'para_familia')::boolean
     or gato ->> 'nombre' is not null or gato ->> 'especie' <> 'gato' then
    raise exception 'FALLA 3a: los datos del aviso no son los esperados: %', toby;
  end if;
  -- 3b. Solo lo que necesita el texto: ni el título ni el cuerpo de Actividad
  -- (que nombran a quien lo vio), ni datos de personas.
  if (select array_agg(k order by k) from jsonb_object_keys(toby) k) <> array[
    'animal_id', 'aviso_id', 'conversacion_id', 'especie', 'evento', 'moderacion', 'nombre',
    'para_familia', 'reporte_error_id', 'suscripciones', 'tipo'
  ] or (toby -> 'suscripciones' -> 0 ->> 'endpoint') <> 'https://fcm.googleapis.com/fcm/send/prueba-celular-f'
     or jsonb_array_length(toby -> 'suscripciones') <> 1 then
    raise exception 'FALLA 3b: el aviso trae otras claves o no trae su suscripción: %', toby;
  end if;
  if exists (select 1 from public.avisos_push where estado <> 'enviando') then
    raise exception 'FALLA 3a: los avisos tomados no quedaron enviando';
  end if;
  -- 3c. Otra vuelta no los vuelve a tomar.
  if jsonb_array_length(public.preparar_avisos_push(50)) <> 0 then
    raise exception 'FALLA 3c: preparar tomó dos veces el mismo aviso';
  end if;

  -- 3d. Toby llegó; el del gato, el servicio dice que la suscripción venció.
  resultado := public.terminar_avisos_push(jsonb_build_array(
    jsonb_build_object('aviso_id', (toby ->> 'aviso_id')::bigint, 'suscripcion_id', sub, 'resultado', 'ok'),
    jsonb_build_object('aviso_id', (gato ->> 'aviso_id')::bigint, 'suscripcion_id', sub, 'resultado', 'vencida')
  ));
  if (select estado from public.avisos_push where id = (toby ->> 'aviso_id')::bigint) <> 'enviado'
     or (select estado || '/' || motivo from public.avisos_push where id = (gato ->> 'aviso_id')::bigint) <> 'error/vencida' then
    raise exception 'FALLA 3d: los avisos no quedaron enviado y error/vencida';
  end if;
  if exists (select 1 from public.suscripciones_push where id = sub) or (resultado ->> 'suscripciones_borradas')::int <> 1 then
    raise exception 'FALLA 3d: la suscripción vencida no se borró';
  end if;
end $$;

-- 3e. terminar no borra una suscripción de otra persona ni de un aviso que no está en curso.
reset role;
do $$
declare
  s constant uuid := '00000000-0000-4000-8000-000000002403';
  ajena uuid;
  aviso bigint := (select max(id) from public.avisos_push);
begin
  perform set_config('request.jwt.claims', json_build_object('sub', s, 'role', 'authenticated')::text, true);
  ajena := public.guardar_suscripcion_push('https://fcm.googleapis.com/fcm/send/prueba-s', pg_temp.p256dh('S'), pg_temp.auth('s'));
  perform public.terminar_avisos_push(jsonb_build_array(
    jsonb_build_object('aviso_id', aviso, 'suscripcion_id', ajena, 'resultado', 'vencida')
  ));
  if not exists (select 1 from public.suscripciones_push where id = ajena) then
    raise exception 'FALLA 3e: terminar borró una suscripción ajena';
  end if;
  insert into subs values ('S', ajena);
end $$;

-- -----------------------------------------------------------------------------
-- 4. Tope por hora y uno por caso cada 5 minutos.
-- -----------------------------------------------------------------------------
reset role;
delete from public.avisos_push;
update public.config_app set valor = '2' where clave = 'avisos_push_por_hora';
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002401';
  v constant uuid := '00000000-0000-4000-8000-000000002402';
  p uuid := (select animal from casos where nombre = 'Toby');
  q uuid := (select animal from casos where nombre = 'Gato');
  r uuid := (select animal from casos where nombre = 'Luna');
  lista jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  insert into subs values ('F2', public.guardar_suscripcion_push(
    'https://fcm.googleapis.com/fcm/send/prueba-celular-f2', pg_temp.p256dh('F'), pg_temp.auth('f')));
  -- Cuatro avisos: dos de Toby, uno del gato y uno de Luna.
  perform public.notificar(f, 'avistamiento', 't', 'c', jsonb_build_object('animal_id', p, 'evento', 'visto'), v);
  perform public.notificar(f, 'avistamiento', 't', 'c', jsonb_build_object('animal_id', p, 'evento', 'visto'), v);
  perform public.notificar(f, 'avistamiento', 't', 'c', jsonb_build_object('animal_id', q, 'evento', 'visto'), v);
  perform public.notificar(f, 'avistamiento', 't', 'c', jsonb_build_object('animal_id', r, 'evento', 'visto'), v);

  lista := public.preparar_avisos_push(50);
  if jsonb_array_length(lista) <> 2 then
    raise exception 'FALLA 4a: salieron % avisos con tope 2', jsonb_array_length(lista);
  end if;
  if (select array_agg(motivo order by id) from public.avisos_push where estado = 'omitido')
     is distinct from array['agrupado', 'tope'] then
    raise exception 'FALLA 4a: el segundo de Toby no se agrupó o Luna no quedó por el tope: %',
      (select array_agg(motivo order by id) from public.avisos_push where estado = 'omitido');
  end if;
  -- 4b. Lo del tope sigue en Actividad.
  if (select count(*) from public.notificaciones where usuario_id = f and titulo = 't') <> 4 then
    raise exception 'FALLA 4b: los avisos que no salieron al celular faltan en Actividad';
  end if;

  -- 4c. Un pendiente de más de una hora ya no sale.
  perform public.notificar(f, 'estado', 't', 'c', jsonb_build_object('animal_id', r, 'evento', 'reunido'), v);
  update public.avisos_push set created_at = now() - interval '2 hours' where estado = 'pendiente';
  perform public.preparar_avisos_push(50);
  if not exists (select 1 from public.avisos_push where motivo = 'vencido') then
    raise exception 'FALLA 4c: un aviso de hace dos horas no quedó vencido';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Casos ocultos: nada al celular (siguen en Actividad).
-- -----------------------------------------------------------------------------
reset role;
delete from public.avisos_push;
update public.config_app set valor = '100' where clave = 'avisos_push_por_hora';
do $$ begin perform set_config('spot.avisar_llamado', '', true); end $$;

set local role authenticated;
do $$
declare
  v constant uuid := '00000000-0000-4000-8000-000000002402';
  p uuid := (select animal from casos where nombre = 'Toby');
  conv uuid;
begin
  -- V abre una conversación con la familia antes de que se oculte el caso.
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  conv := public.abrir_conversacion(p, '00000000-0000-4000-8000-000000002401');
  insert into casos values ('conv', conv);
end $$;

reset role;
update public.animales set oculto = true where id = (select animal from casos where nombre = 'Toby');
set local role authenticated;

do $$
declare
  v constant uuid := '00000000-0000-4000-8000-000000002402';
  conv uuid := (select animal from casos where nombre = 'conv');
begin
  -- La conversación sigue: V le escribe a F.
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  insert into public.mensajes (conversacion_id, emisor_id, cuerpo) values (conv, v, 'Hola, lo tengo yo');
end $$;

reset role;
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002401';
  v constant uuid := '00000000-0000-4000-8000-000000002402';
  p uuid := (select animal from casos where nombre = 'Toby');
  q uuid := (select animal from casos where nombre = 'Gato');
  co uuid;
  lista jsonb;
begin
  -- Un aviso sobre el caso oculto y una coincidencia con él (desde el gato).
  perform public.notificar(f, 'avistamiento', 't', 'c', jsonb_build_object('animal_id', p, 'evento', 'visto'), v);
  insert into public.coincidencias (animal_origen, animal_candidato, similitud)
  values (least(q, p), greatest(q, p), 0.9) returning id into co;
  delete from public.avisos_push where notificacion_id in (
    select id from public.notificaciones where tipo = 'coincidencia');
  perform public.notificar(f, 'coincidencia', 't', 'c', jsonb_build_object('animal_id', q, 'coincidencia_id', co), v);

  set local role service_role;
  lista := public.preparar_avisos_push(50);
  reset role;
  if jsonb_array_length(lista) <> 0 then
    raise exception 'FALLA 5: salieron % avisos de un caso oculto: %', jsonb_array_length(lista), lista;
  end if;
  if (select count(*) from public.avisos_push where motivo = 'oculto') <> 3 then
    raise exception 'FALLA 5: el mensaje, el aviso y la coincidencia del caso oculto no quedaron omitidos (%)',
      (select array_agg(coalesce(motivo, estado)) from public.avisos_push);
  end if;
  -- El mensaje sigue en Actividad.
  if not exists (select 1 from public.notificaciones where usuario_id = f and tipo = 'mensaje') then
    raise exception 'FALLA 5: el aviso del mensaje no está en Actividad';
  end if;
end $$;

update public.animales set oculto = false where id = (select animal from casos where nombre = 'Toby');

-- -----------------------------------------------------------------------------
-- 6. Bloqueos y avisos ya leídos.
-- -----------------------------------------------------------------------------
delete from public.avisos_push;
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002401';
  v constant uuid := '00000000-0000-4000-8000-000000002402';
  q uuid := (select animal from casos where nombre = 'Gato');
  r uuid := (select animal from casos where nombre = 'Luna');
  lista jsonb;
begin
  -- 6a. El aviso entra a la cola y, antes de salir, F bloquea a V.
  perform public.notificar(f, 'avistamiento', 't', 'c', jsonb_build_object('animal_id', q, 'evento', 'visto'), v);
  insert into public.bloqueos (bloqueador_id, bloqueado_id) values (f, v);
  -- 6b. Otro lo leyó en Actividad antes de que salga.
  perform public.notificar(f, 'estado', 't', 'c', jsonb_build_object('animal_id', r, 'evento', 'reunido'), null);
  update public.notificaciones set leida_en = now()
  where usuario_id = f and datos ->> 'animal_id' = r::text and tipo = 'estado';

  set local role service_role;
  lista := public.preparar_avisos_push(50);
  reset role;
  if jsonb_array_length(lista) <> 0
     or (select array_agg(motivo order by id) from public.avisos_push) is distinct from array['bloqueo', 'leida'] then
    raise exception 'FALLA 6: salió un aviso de alguien bloqueado o uno ya leído: %',
      (select array_agg(coalesce(motivo, estado) order by id) from public.avisos_push);
  end if;
  delete from public.bloqueos where bloqueador_id = f;
end $$;

-- -----------------------------------------------------------------------------
-- 7. Qué pasó, en los cambios de estado; y un mensaje sin su texto.
-- -----------------------------------------------------------------------------
delete from public.avisos_push;
set local role authenticated;
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002401';
  p uuid := (select animal from casos where nombre = 'Toby');
begin
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  perform public.cambiar_estado_animal(p, 'reunido');
end $$;

reset role;
do $$
declare
  s constant uuid := '00000000-0000-4000-8000-000000002403';
  v constant uuid := '00000000-0000-4000-8000-000000002402';
  f constant uuid := '00000000-0000-4000-8000-000000002401';
  p uuid := (select animal from casos where nombre = 'Toby');
  conv uuid := (select animal from casos where nombre = 'conv');
  lista jsonb;
  mensaje jsonb;
begin
  if not exists (
    select 1 from public.notificaciones
    where usuario_id = s and tipo = 'estado' and datos ->> 'evento' = 'reunido' and datos ->> 'animal_id' = p::text
  ) then
    raise exception 'FALLA 7a: el aviso de reunido no tiene evento reunido';
  end if;

  insert into public.mensajes (conversacion_id, emisor_id, cuerpo) values (conv, v, 'Mi teléfono es 099 123 456');
  set local role service_role;
  lista := public.preparar_avisos_push(50);
  reset role;
  select e into mensaje from jsonb_array_elements(lista) e where e ->> 'tipo' = 'mensaje';
  if mensaje is null or mensaje ->> 'conversacion_id' <> conv::text or mensaje ->> 'animal_id' <> p::text
     or mensaje::text like '%099%' or mensaje::text like '%Prueba Vio%' then
    raise exception 'FALLA 7b: el aviso del mensaje no es el esperado o trae su texto: %', mensaje;
  end if;
  -- El de S (sigue a Toby) también sale, con su evento.
  if not exists (
    select 1 from jsonb_array_elements(lista) e
    where e ->> 'tipo' = 'estado' and e ->> 'evento' = 'reunido'
      and e -> 'suscripciones' -> 0 ->> 'endpoint' like '%prueba-s'
  ) then
    raise exception 'FALLA 7c: el aviso de reunido de S no salió: %', lista;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 8. Permisos: la cola y sus funciones son solo del servidor.
-- -----------------------------------------------------------------------------
do $$
declare
  rol text;
  funcion text;
begin
  foreach rol in array array['anon', 'authenticated'] loop
    if has_table_privilege(rol, 'public.avisos_push', 'select') then
      raise exception 'FALLA 8: % puede leer avisos_push', rol;
    end if;
    foreach funcion in array array[
      'public.preparar_avisos_push(integer)',
      'public.terminar_avisos_push(jsonb)',
      'public.llamar_avisar()',
      'public.config_avisar()',
      'public.encolar_aviso_push()',
      'public.es_endpoint_push(text)'
    ] loop
      if has_function_privilege(rol, funcion, 'execute') then
        raise exception 'FALLA 8: % puede ejecutar %', rol, funcion;
      end if;
    end loop;
  end loop;
  if not has_function_privilege('service_role', 'public.preparar_avisos_push(integer)', 'execute')
     or not has_function_privilege('service_role', 'public.terminar_avisos_push(jsonb)', 'execute')
     or not has_function_privilege('service_role', 'public.config_avisar()', 'execute') then
    raise exception 'FALLA 8: service_role no puede usar la cola';
  end if;
end $$;

-- 9. config_avisar devuelve el secreto (para la función) y nada más.
set local role service_role;
do $$
begin
  if public.config_avisar() <> jsonb_build_object('secreto', repeat('ab', 32)) then
    raise exception 'FALLA 9: config_avisar no devuelve solo el secreto';
  end if;
end $$;

rollback;
