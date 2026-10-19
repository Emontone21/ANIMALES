-- =============================================================================
-- Pruebas de la Fase 9, parte 1 (correcciones de la revisión integral).
-- Requiere las migraciones 0001 a 0013. Pegalo entero en el SQL Editor y tocá Run.
-- Bien: termina en "Success. No rows returned". Mal: ERROR con "FALLA n: ..." que dice qué.
-- Todo corre dentro de begin/rollback: no deja usuarios, fotos, casos ni mensajes,
-- y los pedidos al servicio de visión no salen (pg_net los manda al confirmar).
-- Nunca borra filas de storage.objects (Supabase no lo permite por SQL).
--
-- Personas: F (la familia de un perdido; bloqueó a X), X (publica un encontrado
-- parecido), Y (vio al perdido y lo sigue), R (resguarda el encontrado de X y
-- publica otros) y Z (no tiene nada que ver con los casos).
-- =============================================================================
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000901', 'prueba9-f@encontrados.test', '{"nombre_publico":"Prueba Familia"}'),
  ('00000000-0000-4000-8000-000000000902', 'prueba9-x@encontrados.test', '{"nombre_publico":"Prueba Bloqueada"}'),
  ('00000000-0000-4000-8000-000000000903', 'prueba9-y@encontrados.test', '{"nombre_publico":"Prueba Sigue"}'),
  ('00000000-0000-4000-8000-000000000904', 'prueba9-r@encontrados.test', '{"nombre_publico":"Prueba Resguarda"}'),
  ('00000000-0000-4000-8000-000000000905', 'prueba9-z@encontrados.test', '{"nombre_publico":"Prueba Nadie"}');

update public.perfiles
set terminos_version = public.version_terminos(), terminos_aceptados_en = now()
where id::text like '00000000-0000-4000-8000-0000000009%';

-- Fotos "subidas" a la carpeta de cada uno, cada una con su miniatura.
insert into storage.objects (bucket_id, name)
select 'fotos', u || '/t9-' || n || variante
from unnest(array[
  '00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000902',
  '00000000-0000-4000-8000-000000000903', '00000000-0000-4000-8000-000000000904',
  '00000000-0000-4000-8000-000000000905'
]) as u, generate_series(1, 6) as n, unnest(array['.jpg', '.miniatura.jpg']) as variante;

-- Durante la prueba hay un servicio de visión "configurado" (nada sale: rollback).
update public.config_app set valor = 'https://vision.encontrados.test/' where clave = 'vision_url';

-- -----------------------------------------------------------------------------
-- Parte A, como el sistema: casos, bloqueo, coincidencias y cola de visión.
-- -----------------------------------------------------------------------------
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000000901';
  x constant uuid := '00000000-0000-4000-8000-000000000902';
  y constant uuid := '00000000-0000-4000-8000-000000000903';
  r constant uuid := '00000000-0000-4000-8000-000000000904';
  v_emb extensions.vector := array_fill(0.05::real, array[384])::extensions.vector;
  p9 uuid; e9 uuid; e10 uuid; e11 uuid; e12 uuid;
  av_p9 uuid; av_y uuid; av_e9 uuid; av_e10 uuid; av_e11 uuid; av_e12 uuid; av_r uuid;
  v_lat double precision; v_lng double precision;
  v_pedidos int;
begin
  -- F publica un perdido; Y lo ve (y así lo sigue); F bloquea a X.
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  p9 := public.publicar_animal('perro', f || '/t9-1.jpg', -34.91, -56.16, now() - interval '1 day',
    'mediano', 'marrón', true, null, 'perdido', 'Toby', null);
  select id into av_p9 from public.avistamientos where animal_id = p9;
  perform set_config('request.jwt.claims', json_build_object('sub', y, 'role', 'authenticated')::text, true);
  av_y := public.registrar_avistamiento(p9, y || '/t9-1.jpg', -34.905, -56.155);
  insert into public.bloqueos (bloqueador_id, bloqueado_id) values (f, x);

  -- X publica un encontrado parecido y otro que ya cerró.
  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  e9 := public.publicar_animal('perro', x || '/t9-1.jpg', -34.905, -56.155, now() - interval '2 hours');
  e10 := public.publicar_animal('perro', x || '/t9-2.jpg', -34.905, -56.155, now() - interval '2 hours');
  perform public.cambiar_estado_animal(e10, 'reunido');
  select id into av_e9 from public.avistamientos where animal_id = e9;
  select id into av_e10 from public.avistamientos where animal_id = e10;

  -- El servicio procesa las fotos (mismo embedding: se parecen).
  perform public.guardar_embedding(av_p9, v_emb);
  perform public.guardar_embedding(av_e9, v_emb);

  -- 1. El aviso de una coincidencia lleva quién publicó el otro reporte: quien
  -- lo bloqueó no lo recibe; los demás, sí.
  if not exists (
    select 1 from public.coincidencias
    where p9 in (animal_origen, animal_candidato) and e9 in (animal_origen, animal_candidato)
  ) then
    raise exception 'FALLA 1: no se creó la coincidencia entre el perdido y el encontrado';
  end if;
  if exists (select 1 from public.notificaciones where usuario_id = f and tipo = 'coincidencia') then
    raise exception 'FALLA 1a: la familia recibió la coincidencia de alguien a quien bloqueó';
  end if;
  if not exists (
    select 1 from public.notificaciones
    where usuario_id = y and tipo = 'coincidencia' and actor_id = x
  ) then
    raise exception 'FALLA 1b: quien sigue el perdido no recibió la coincidencia (con X como actor)';
  end if;
  if not exists (
    select 1 from public.notificaciones
    where usuario_id = x and tipo = 'coincidencia' and actor_id = f
  ) then
    raise exception 'FALLA 1c: quien publicó el encontrado no recibió la coincidencia (con F como actor)';
  end if;

  -- 2. Coincidencias solo entre casos abiertos y visibles.
  if public.guardar_embedding(av_e10, v_emb) <> 0
     or exists (select 1 from public.coincidencias where e10 in (animal_origen, animal_candidato)) then
    raise exception 'FALLA 2a: un caso cerrado generó coincidencias';
  end if;
  if (select estado from public.cola_vision where avistamiento_id = av_e10) <> 'hecho' then
    raise exception 'FALLA 2b: la foto de un caso cerrado no salió de la cola';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', r, 'role', 'authenticated')::text, true);
  e11 := public.publicar_animal('perro', r || '/t9-1.jpg', -34.905, -56.155, now() - interval '1 hour');
  select id into av_e11 from public.avistamientos where animal_id = e11;
  update public.animales set oculto = true where id = e11;
  if public.guardar_embedding(av_e11, v_emb) <> 0
     or exists (select 1 from public.coincidencias where e11 in (animal_origen, animal_candidato)) then
    raise exception 'FALLA 2c: un caso oculto por moderación generó coincidencias';
  end if;
  e12 := public.publicar_animal('perro', r || '/t9-2.jpg', -34.905, -56.155, now() - interval '1 hour');
  select id into av_e12 from public.avistamientos where animal_id = e12;
  perform public.guardar_embedding(av_e12, v_emb);
  if exists (select 1 from public.coincidencias where e11 in (animal_origen, animal_candidato)) then
    raise exception 'FALLA 2d: se sugirió un caso oculto por moderación';
  end if;
  if not exists (select 1 from public.coincidencias where e12 in (animal_origen, animal_candidato)) then
    raise exception 'FALLA 2e: un caso abierto no generó coincidencias con los otros abiertos';
  end if;

  -- 3. El servicio recibe un aviso cada vez que algo queda pendiente.
  select count(*) into v_pedidos from net.http_request_queue
  where url = 'https://vision.encontrados.test/procesar';
  if v_pedidos <> 6 then
    raise exception 'FALLA 3a: se esperaban 6 avisos al servicio por 6 fotos nuevas y hubo %', v_pedidos;
  end if;
  -- Corregir la especie devuelve las fotos a la cola: avisa por la que ya estaba
  -- hecha (la de F), no por la que seguía pendiente (la de Y).
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  perform public.editar_reporte(p9, 'gato', 'mediano', 'marrón', true, null, 'Toby', null);
  if (select count(*) from net.http_request_queue
      where url = 'https://vision.encontrados.test/procesar'
        and body ->> 'avistamiento_id' = av_p9::text) <> 2 then
    raise exception 'FALLA 3b: la foto que volvió a la cola no avisó al servicio';
  end if;
  if (select count(*) from net.http_request_queue
      where body ->> 'avistamiento_id' = av_y::text) <> 1 then
    raise exception 'FALLA 3c: una foto que ya estaba pendiente avisó dos veces';
  end if;
  -- Un error no avisa.
  select count(*) into v_pedidos from net.http_request_queue
  where url = 'https://vision.encontrados.test/procesar';
  perform public.marcar_error_vision(av_y, 'prueba');
  if (select count(*) from net.http_request_queue
      where url = 'https://vision.encontrados.test/procesar') <> v_pedidos then
    raise exception 'FALLA 3d: un error de la cola avisó al servicio';
  end if;

  -- 4. R resguarda el encontrado de X y dice dónde está: queda redondeado.
  perform set_config('request.jwt.claims', json_build_object('sub', r, 'role', 'authenticated')::text, true);
  perform public.cambiar_estado_animal(e9, 'resguardado', 'Contacto de R', null,
    -34.901234, -56.165432, r || '/t9-3.jpg');
  select id, extensions.st_y(ubicacion::extensions.geometry), extensions.st_x(ubicacion::extensions.geometry)
  into av_r, v_lat, v_lng
  from public.avistamientos where animal_id = e9 and tipo = 'resguardado';
  if abs(v_lat - (-34.901)) > 1e-9 or abs(v_lng - (-56.165)) > 1e-9 then
    raise exception 'FALLA 4: la ubicación del resguardo quedó exacta (%, %)', v_lat, v_lng;
  end if;

  perform set_config('prueba.p9', p9::text, true);
  perform set_config('prueba.e9', e9::text, true);
  perform set_config('prueba.av_y', av_y::text, true);
  perform set_config('prueba.av_e12', av_e12::text, true);
  perform set_config('prueba.av_r', av_r::text, true);
end $$;

-- -----------------------------------------------------------------------------
-- Parte B, como el sistema: la cola espera cada vez más entre reintentos.
-- -----------------------------------------------------------------------------
do $$
declare
  av_y uuid := current_setting('prueba.av_y')::uuid;
  av_e12 uuid := current_setting('prueba.av_e12')::uuid;
  av_r uuid := current_setting('prueba.av_r')::uuid;
begin
  -- 5a. Lo pendiente se ve enseguida (la foto del resguardo).
  if not exists (select 1 from public.cola_vision_pendientes where avistamiento_id = av_r) then
    raise exception 'FALLA 5a: una foto pendiente no aparece en la cola';
  end if;
  -- 5b. Un error recién marcado espera (la de Y, 1 intento).
  if exists (select 1 from public.cola_vision_pendientes where avistamiento_id = av_y) then
    raise exception 'FALLA 5b: un error recién marcado se reintenta sin esperar';
  end if;
  -- 5c. Con 2 intentos espera 10 minutos: a los 11 vuelve.
  delete from public.cola_vision where avistamiento_id in (av_y, av_e12);
  insert into public.cola_vision (avistamiento_id, estado, intentos, created_at, updated_at)
  values (av_y, 'error', 2, now() - interval '1 hour', now() - interval '11 minutes');
  if not exists (select 1 from public.cola_vision_pendientes where avistamiento_id = av_y) then
    raise exception 'FALLA 5c: un error no se reintenta después de esperar';
  end if;
  -- 5d. Con 3 intentos espera 20: a los 11, todavía no. (Se vuelve a insertar
  -- porque un update pone updated_at en ahora.)
  delete from public.cola_vision where avistamiento_id = av_y;
  insert into public.cola_vision (avistamiento_id, estado, intentos, created_at, updated_at)
  values (av_y, 'error', 3, now() - interval '1 hour', now() - interval '11 minutes');
  if exists (select 1 from public.cola_vision_pendientes where avistamiento_id = av_y) then
    raise exception 'FALLA 5d: no esperó el doble después del tercer intento';
  end if;
  -- 5e. Con 8 intentos sale de la cola, aunque haya esperado.
  insert into public.cola_vision (avistamiento_id, estado, intentos, created_at, updated_at)
  values (av_e12, 'error', 8, now() - interval '2 days', now() - interval '1 day');
  if exists (select 1 from public.cola_vision_pendientes where avistamiento_id = av_e12) then
    raise exception 'FALLA 5e: se reintentó una foto con 8 intentos';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Parte C, como usuario común: con quién se puede abrir una conversación.
-- -----------------------------------------------------------------------------
set local role authenticated;

do $$
declare
  x constant uuid := '00000000-0000-4000-8000-000000000902';
  y constant uuid := '00000000-0000-4000-8000-000000000903';
  r constant uuid := '00000000-0000-4000-8000-000000000904';
  z constant uuid := '00000000-0000-4000-8000-000000000905';
  p9 uuid := current_setting('prueba.p9')::uuid;
  e9 uuid := current_setting('prueba.e9')::uuid;
  conv uuid;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', z, 'role', 'authenticated')::text, true);
  -- 6a. Z no le puede escribir a alguien que solo avisó que lo vio.
  begin
    perform public.abrir_conversacion(p9, y);
    raise exception 'FALLA 6a: se abrió una conversación con alguien que no publicó ni resguarda el caso';
  exception when insufficient_privilege then null;
  end;
  -- 6b y 6c. Sí a quien lo resguarda y a quien lo publicó.
  perform public.abrir_conversacion(e9, r);
  conv := public.abrir_conversacion(e9, x);

  -- 6d. Quien publicó le contesta a Z: la conversación ya existe.
  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  if public.abrir_conversacion(e9, z) is distinct from conv then
    raise exception 'FALLA 6d: quien publicó no pudo volver a la conversación que le abrieron';
  end if;
  -- 6e. Pero no abre una nueva con alguien ajeno al caso.
  begin
    perform public.abrir_conversacion(e9, y);
    raise exception 'FALLA 6e: quien publicó abrió una conversación con alguien ajeno al caso';
  exception when insufficient_privilege then null;
  end;

  -- 7a. Cada uno lista solo su carpeta de fotos.
  if (select count(*) from storage.objects where bucket_id = 'fotos') <> 12
     or exists (select 1 from storage.objects where bucket_id = 'fotos' and name not like x || '/%') then
    raise exception 'FALLA 7a: un usuario lista fotos que no son de su carpeta';
  end if;
end $$;

-- 7b. Sin cuenta no se lista nada (las fotos se ven igual por su URL pública).
set local role anon;
do $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  if exists (select 1 from storage.objects where bucket_id = 'fotos') then
    raise exception 'FALLA 7b: sin cuenta se puede listar el bucket de fotos';
  end if;
end $$;
reset role;

rollback;
