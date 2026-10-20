-- =============================================================================
-- Pruebas del reconocimiento en Cloud Run (0017).
-- Requiere las migraciones 0001 a 0017. Pegalo entero en el SQL Editor y tocá Run.
-- Bien: termina en "Success. No rows returned". Mal: ERROR con "FALLA n: ..." que dice qué.
-- Todo corre dentro de begin/rollback: no deja usuarios, fotos ni casos, y los
-- pedidos al servicio de visión no salen (pg_net los manda al confirmar).
-- Nunca borra filas de storage.objects (Supabase no lo permite por SQL).
--
-- Personas: F publica un perdido; U tiene cuenta y nada más; M es moderadora.
-- Durante la prueba, las fotos que ya estaban en la cola se marcan como hechas,
-- para que solo cuente la de la prueba (se deshace al terminar).
-- =============================================================================
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000c01', 'prueba-vision-f@encontrados.test', '{"nombre_publico":"Prueba Familia"}'),
  ('00000000-0000-4000-8000-000000000c02', 'prueba-vision-u@encontrados.test', '{"nombre_publico":"Prueba Usuaria"}'),
  ('00000000-0000-4000-8000-000000000c03', 'prueba-vision-m@encontrados.test', '{"nombre_publico":"Prueba Modera"}');

update public.perfiles
set terminos_version = public.version_terminos(), terminos_aceptados_en = now()
where id::text like '00000000-0000-4000-8000-000000000c0%';
update public.perfiles set es_moderador = true where id = '00000000-0000-4000-8000-000000000c03';

insert into storage.objects (bucket_id, name) values
  ('fotos', '00000000-0000-4000-8000-000000000c01/vision-1.jpg'),
  ('fotos', '00000000-0000-4000-8000-000000000c01/vision-1.miniatura.jpg');

-- Solo cuenta la cola de la prueba.
update public.cola_vision set estado = 'hecho' where estado <> 'hecho';

-- Los pedidos de la prueba van a una URL que no existe (y no salen: rollback).
create function pg_temp.pedidos(p_ruta text) returns integer language sql as $$
  select count(*)::integer from net.http_request_queue
  where url = 'https://vision.prueba.invalid' || p_ruta
$$;

-- -----------------------------------------------------------------------------
-- 1. El trabajo de pg_cron existe, cada 2 minutos, y la función no se puede
--    llamar desde la API.
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from cron.job
    where jobname = 'vision-pendientes' and schedule = '*/2 * * * *' and active
      and command = 'select public.despertar_vision()'
  ) then
    raise exception 'FALLA 1a: falta el trabajo de pg_cron "vision-pendientes" cada 2 minutos';
  end if;
  if not exists (select 1 from cron.job where jobname = 'vision-limpiar-historial' and active) then
    raise exception 'FALLA 1b: falta el trabajo que limpia el historial de pg_cron';
  end if;
  if has_function_privilege('anon', 'public.despertar_vision()', 'execute')
     or has_function_privilege('authenticated', 'public.despertar_vision()', 'execute')
     or has_function_privilege('authenticated', 'public.llamar_vision(text, jsonb, integer)', 'execute') then
    raise exception 'FALLA 1c: despertar_vision o llamar_vision se pueden llamar desde la API';
  end if;
  if has_function_privilege('anon', 'public.procesar_pendientes_vision()', 'execute')
     or has_function_privilege('anon', 'public.estado_reconocimiento()', 'execute') then
    raise exception 'FALLA 1d: alguien sin cuenta puede usar las RPC de moderación del reconocimiento';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. El cron solo llama si está configurado y hay pendientes.
-- -----------------------------------------------------------------------------
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000000c01';
  p uuid;
  av uuid;
  v_espera int;
begin
  -- Sin URL: no llama.
  update public.config_app set valor = '' where clave = 'vision_url';
  if public.despertar_vision() <> 'sin_configurar' then
    raise exception 'FALLA 2a: sin URL configurada, despertar_vision no dijo "sin_configurar"';
  end if;

  -- Con URL (con barra al final) y sin pendientes: no llama.
  update public.config_app set valor = 'https://vision.prueba.invalid/' where clave = 'vision_url';
  update public.config_app set valor = 'secreto-de-prueba' where clave = 'vision_secret';
  if public.despertar_vision() <> 'sin_pendientes' then
    raise exception 'FALLA 2b: sin fotos pendientes, despertar_vision no dijo "sin_pendientes"';
  end if;
  if pg_temp.pedidos('/procesar-pendientes') <> 0 then
    raise exception 'FALLA 2c: sin fotos pendientes, se llamó al servicio';
  end if;

  -- Una foto nueva: el aviso sale enseguida, con la espera nueva y el secreto.
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  p := public.publicar_animal('perro', f || '/vision-1.jpg', -34.91, -56.16, now() - interval '1 hour',
    'mediano', 'marrón', true, null, 'perdido', 'Toby', null);
  perform set_config('request.jwt.claims', '', true);
  select id into av from public.avistamientos where animal_id = p;
  select timeout_milliseconds into v_espera from net.http_request_queue
  where url = 'https://vision.prueba.invalid/procesar'
    and convert_from(body, 'UTF8')::jsonb ->> 'avistamiento_id' = av::text
    and headers ->> 'X-Vision-Secret' = 'secreto-de-prueba';
  if v_espera is null then
    raise exception 'FALLA 2d: la foto nueva no avisó al servicio';
  end if;
  if v_espera < 30000 then
    raise exception 'FALLA 2e: el aviso espera % ms, menos que un arranque en frío', v_espera;
  end if;

  -- Con la foto pendiente, el cron llama a /procesar-pendientes.
  if public.despertar_vision() <> 'enviado' then
    raise exception 'FALLA 2f: con una foto pendiente, despertar_vision no llamó';
  end if;
  select timeout_milliseconds into v_espera from net.http_request_queue
  where url = 'https://vision.prueba.invalid/procesar-pendientes';
  if v_espera is null or v_espera < 120000 then
    raise exception 'FALLA 2g: /procesar-pendientes espera % ms, menos que el arranque y el tope del servicio', v_espera;
  end if;

  -- Una foto con error que todavía espera su reintento no despierta al servicio.
  update public.cola_vision set estado = 'error', intentos = 1, updated_at = now()
  where avistamiento_id = av;
  if public.despertar_vision() <> 'sin_pendientes' then
    raise exception 'FALLA 2h: una foto que espera su reintento despertó al servicio';
  end if;
  -- Cumplida la espera (5 minutos después del primer error), sí. Se vuelve a
  -- insertar porque un update pone updated_at en now().
  delete from public.cola_vision where avistamiento_id = av;
  insert into public.cola_vision (avistamiento_id, estado, intentos, created_at, updated_at)
  values (av, 'error', 1, now() - interval '1 hour', now() - interval '6 minutes');
  if public.despertar_vision() <> 'enviado' then
    raise exception 'FALLA 2i: una foto con el reintento vencido no despertó al servicio';
  end if;
  -- Agotados los intentos, ya no.
  update public.cola_vision set intentos = 8 where avistamiento_id = av;
  if public.despertar_vision() <> 'sin_pendientes' then
    raise exception 'FALLA 2j: una foto que agotó los intentos despertó al servicio';
  end if;
  if pg_temp.pedidos('/procesar-pendientes') <> 2 then
    raise exception 'FALLA 2k: se esperaban 2 llamadas a /procesar-pendientes y hubo %',
      pg_temp.pedidos('/procesar-pendientes');
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Estado y "Procesar pendientes ahora": solo moderación, sin URL ni secreto.
-- -----------------------------------------------------------------------------
set local role authenticated;
do $$
declare
  u constant uuid := '00000000-0000-4000-8000-000000000c02';
  m constant uuid := '00000000-0000-4000-8000-000000000c03';
  e record;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  begin
    perform public.procesar_pendientes_vision();
    raise exception 'FALLA 3a: alguien que no modera pudo procesar las fotos pendientes';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.estado_reconocimiento();
    raise exception 'FALLA 3b: alguien que no modera vio el estado del reconocimiento';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  -- La foto de la prueba agotó sus intentos (parte 2).
  select * into e from public.estado_reconocimiento();
  if not e.configurado or e.pendientes <> 0 or e.reintentando <> 0 or e.con_error <> 1 then
    raise exception 'FALLA 3c: estado inesperado: configurado %, pendientes %, reintentando %, con error %',
      e.configurado, e.pendientes, e.reintentando, e.con_error;
  end if;
  if public.procesar_pendientes_vision() <> 'sin_pendientes' then
    raise exception 'FALLA 3d: sin pendientes, el botón no dijo "sin_pendientes"';
  end if;
end;
$$;
reset role;

-- Alguien la vuelve a la cola, como dice el README del servicio.
update public.cola_vision set estado = 'pendiente', intentos = 0, ultimo_error = null
where estado = 'error' and avistamiento_id in (
  select av.id from public.avistamientos av
  join public.animales a on a.id = av.animal_id
  where a.creado_por = '00000000-0000-4000-8000-000000000c01'
);

set local role authenticated;
do $$
declare
  m constant uuid := '00000000-0000-4000-8000-000000000c03';
  e record;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  select * into e from public.estado_reconocimiento();
  if e.pendientes <> 1 or e.reintentando <> 0 or e.con_error <> 0 then
    raise exception 'FALLA 3e: después de volverla a la cola: pendientes %, con error %', e.pendientes, e.con_error;
  end if;
  if public.procesar_pendientes_vision() <> 'enviado' then
    raise exception 'FALLA 3f: con una foto pendiente, el botón no llamó al servicio';
  end if;
end;
$$;
reset role;

do $$
begin
  -- Las 2 del cron (parte 2) y la del botón: la misma llamada.
  if pg_temp.pedidos('/procesar-pendientes') <> 3 then
    raise exception 'FALLA 3g: el botón no hizo la misma llamada que el cron';
  end if;
end;
$$;

-- Sin URL, el estado dice que no está configurado y el botón no llama.
update public.config_app set valor = '' where clave = 'vision_url';
set local role authenticated;
do $$
declare
  m constant uuid := '00000000-0000-4000-8000-000000000c03';
  e record;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  select * into e from public.estado_reconocimiento();
  if e.configurado then
    raise exception 'FALLA 3h: sin URL, el estado dice que está configurado';
  end if;
  if public.procesar_pendientes_vision() <> 'sin_configurar' then
    raise exception 'FALLA 3i: sin URL, el botón no dijo "sin_configurar"';
  end if;
end;
$$;
reset role;

rollback;
