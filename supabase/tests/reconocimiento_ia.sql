-- =============================================================================
-- Pruebas del reconocimiento con la API de Claude (0018).
-- Requiere las migraciones 0001 a 0018. Pegalo entero en el SQL Editor y tocá Run.
-- Bien: termina en "Success. No rows returned". Mal: ERROR con "FALLA n: ..." que dice qué.
-- Todo corre dentro de begin/rollback: no deja usuarios, fotos, casos, llamadas
-- ni cambios en config_app, y los pedidos a la función no salen (pg_net los
-- manda al confirmar). Nunca borra filas de storage.objects.
--
-- Personas: F publica perdidos; H encuentra animales; U tiene cuenta y nada
-- más; M es moderadora. Las llamadas a la API y lo que devuelve Claude se
-- simulan llamando a las RPC como lo hace la función (rol service_role).
-- Durante la prueba, las fotos que ya estaban en la cola se marcan como hechas
-- (se deshace al terminar).
-- =============================================================================
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000d01', 'prueba-ia-f@encontrados.test', '{"nombre_publico":"Prueba Familia"}'),
  ('00000000-0000-4000-8000-000000000d02', 'prueba-ia-h@encontrados.test', '{"nombre_publico":"Prueba Hallazgo"}'),
  ('00000000-0000-4000-8000-000000000d03', 'prueba-ia-u@encontrados.test', '{"nombre_publico":"Prueba Usuaria"}'),
  ('00000000-0000-4000-8000-000000000d04', 'prueba-ia-m@encontrados.test', '{"nombre_publico":"Prueba Modera"}');

update public.perfiles
set terminos_version = public.version_terminos(), terminos_aceptados_en = now()
where id::text like '00000000-0000-4000-8000-000000000d0%';
update public.perfiles set es_moderador = true where id = '00000000-0000-4000-8000-000000000d04';

insert into storage.objects (bucket_id, name) values
  ('fotos', '00000000-0000-4000-8000-000000000d01/ia-1.jpg'),
  ('fotos', '00000000-0000-4000-8000-000000000d02/ia-1.jpg');

update public.cola_vision set estado = 'hecho' where estado <> 'hecho';
update public.config_app set valor = '' where clave in ('vision_url', 'ia_pausa');
update public.config_app set valor = 'true' where clave = 'ia_activa';

-- Los casos de la prueba, por nombre.
create temp table casos (nombre text primary key, animal uuid, avistamiento uuid) on commit drop;
grant all on casos to public;

create function pg_temp.caso(p_nombre text) returns uuid language sql as $$
  select animal from casos where nombre = p_nombre
$$;
create function pg_temp.foto(p_nombre text) returns uuid language sql as $$
  select avistamiento from casos where nombre = p_nombre
$$;
create function pg_temp.pedidos(p_ruta text) returns integer language sql as $$
  select count(*)::integer from net.http_request_queue
  where url = 'https://reconocer.prueba.invalid' || p_ruta
$$;
-- Una descripción como la que devuelve Claude.
create function pg_temp.descripcion(
  p_color text, p_especie text default 'perro', p_hay boolean default true, p_tamanio text default 'no_se_ve'
) returns jsonb language sql as $$
  select jsonb_build_object(
    'hay_animal', p_hay, 'especie', p_especie, 'color_principal', p_color,
    'color_secundario', 'ninguno', 'patron', 'liso', 'tamanio', p_tamanio,
    'collar', 'no_se_ve', 'collar_color', null, 'raza_aproximada', 'mestizo',
    'rasgos', jsonb_build_array('orejas caídas'), 'calidad', 'buena'
  )
$$;

-- -----------------------------------------------------------------------------
-- 1. Permisos: las RPC de la función son solo del servicio; guardar_embedding
--    ya no la usa nadie desde la API.
-- -----------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.tomar_pendiente_ia(uuid)',
    'public.candidatos_ia(uuid)',
    'public.guardar_descripcion_ia(uuid, jsonb, text, integer, integer)',
    'public.guardar_comparacion_ia(uuid, jsonb, text)',
    'public.marcar_hecho_ia(uuid)',
    'public.soltar_pendiente_ia(uuid)',
    'public.iniciar_llamada_ia(text, uuid, text)',
    'public.terminar_llamada_ia(bigint, text, integer, integer, numeric, text)',
    'public.pausar_ia(text)',
    'public.config_reconocimiento()'
  ] loop
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then
      raise exception 'FALLA 1a: % se puede llamar desde la API', f;
    end if;
    if not has_function_privilege('service_role', f, 'execute') then
      raise exception 'FALLA 1b: la función no puede llamar a %', f;
    end if;
  end loop;
  foreach f in array array['public.candidatos_ia_todos(uuid)', 'public.estado_ia()', 'public.config_texto(text, text)'] loop
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then
      raise exception 'FALLA 1c: la interna % se puede llamar desde la API', f;
    end if;
  end loop;
  if has_function_privilege('service_role', 'public.guardar_embedding(uuid, extensions.vector, jsonb)', 'execute') then
    raise exception 'FALLA 1d: guardar_embedding se sigue pudiendo usar';
  end if;
  if has_function_privilege('anon', 'public.reactivar_reconocimiento()', 'execute') then
    raise exception 'FALLA 1e: alguien sin cuenta puede reactivar el reconocimiento';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Candidatos: misma especie, abiertos y visibles, cerca y en la ventana,
--    reglas de la Fase 6, sin pares ya comparados ni colores o tamaños
--    claramente incompatibles; del más cercano al más lejano.
-- -----------------------------------------------------------------------------
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000000d01';
  h constant uuid := '00000000-0000-4000-8000-000000000d02';
  foto_f constant text := '00000000-0000-4000-8000-000000000d01/ia-1.jpg';
  foto_h constant text := '00000000-0000-4000-8000-000000000d02/ia-1.jpg';
  -- Lugar donde se perdió P (Montevideo). 0,01° de latitud son unos 1,1 km.
  lat constant float := -34.910;
  lng constant float := -56.160;
  v_nombre text;
  v_animal uuid;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  insert into casos (nombre, animal) values
    ('P', public.publicar_animal('perro', foto_f, lat, lng, now() - interval '2 days',
      'chico', 'negro', false, null, 'perdido', 'Toby')),
    ('P2', public.publicar_animal('perro', foto_f, lat + 0.001, lng, now() - interval '1 day',
      null, null, false, null, 'perdido', 'Otro'));

  perform set_config('request.jwt.claims', json_build_object('sub', h, 'role', 'authenticated')::text, true);
  insert into casos (nombre, animal) values
    -- Candidatos: E2 más cerca que E1.
    ('E1', public.publicar_animal('perro', foto_h, lat + 0.009, lng, now() - interval '1 hour')),
    ('E2', public.publicar_animal('perro', foto_h, lat + 0.004, lng, now() - interval '2 hours')),
    -- Lejos (unos 20 km), otra especie, visto mucho antes de la pérdida.
    ('Elejos', public.publicar_animal('perro', foto_h, lat + 0.18, lng, now() - interval '1 hour')),
    ('Egato', public.publicar_animal('gato', foto_h, lat + 0.002, lng, now() - interval '1 hour')),
    ('Eantes', public.publicar_animal('perro', foto_h, lat + 0.002, lng, now() - interval '6 days')),
    -- Cerrado y oculto.
    ('Ecerrado', public.publicar_animal('perro', foto_h, lat + 0.002, lng, now() - interval '1 hour')),
    ('Eoculto', public.publicar_animal('perro', foto_h, lat + 0.002, lng, now() - interval '1 hour')),
    -- Blanco (P es negro), grande (P es chico), su foto sin animal.
    ('Eblanco', public.publicar_animal('perro', foto_h, lat + 0.002, lng, now() - interval '1 hour')),
    ('Egrande', public.publicar_animal('perro', foto_h, lat + 0.002, lng, now() - interval '1 hour', 'grande')),
    ('Esinanimal', public.publicar_animal('perro', foto_h, lat + 0.002, lng, now() - interval '1 hour')),
    -- Ya comparado con P y con coincidencia con P.
    ('Ecomparado', public.publicar_animal('perro', foto_h, lat + 0.002, lng, now() - interval '1 hour')),
    ('Ecoincidencia', public.publicar_animal('perro', foto_h, lat + 0.002, lng, now() - interval '1 hour')),
    -- Para la ventana entre dos encontrados: visto hace 70 días, cerca de E1.
    ('Eviejo', public.publicar_animal('perro', foto_h, lat + 0.009, lng + 0.001, now() - interval '70 days'));
  perform set_config('request.jwt.claims', '', true);

  update casos set avistamiento = (
    select av.id from public.avistamientos av where av.animal_id = casos.animal order by av.created_at limit 1
  );

  update public.animales set estado = 'reunido' where id = pg_temp.caso('Ecerrado');
  update public.animales set oculto = true where id = pg_temp.caso('Eoculto');
  -- La foto de Eviejo es de hace 70 días (más que la ventana de 60).
  update public.animales set created_at = now() - interval '70 days' where id = pg_temp.caso('Eviejo');

  set local role service_role;
  -- Lo que Claude vio en las fotos de algunos candidatos.
  perform public.guardar_descripcion_ia(pg_temp.foto('Eblanco'), pg_temp.descripcion('blanco'), 'prueba', 1, 1);
  perform public.guardar_descripcion_ia(pg_temp.foto('E1'), pg_temp.descripcion('marron'), 'prueba', 1, 1);
  perform public.guardar_descripcion_ia(pg_temp.foto('Esinanimal'), pg_temp.descripcion('no_se_ve', 'ninguno', false), 'prueba', 1, 1);
  reset role;

  insert into public.comparaciones_ia (animal_a, animal_b, confianza, veredicto, motivo, modelo)
  values (least(pg_temp.caso('P'), pg_temp.caso('Ecomparado')), greatest(pg_temp.caso('P'), pg_temp.caso('Ecomparado')),
    10, 'distinto', 'Otro hocico', 'prueba');
  insert into public.coincidencias (animal_origen, animal_candidato, similitud, origen)
  values (least(pg_temp.caso('P'), pg_temp.caso('Ecoincidencia')), greatest(pg_temp.caso('P'), pg_temp.caso('Ecoincidencia')),
    0.9, 'embedding');

  set local role service_role;
  -- La descripción de la foto de P: negro, se compara.
  if not public.guardar_descripcion_ia(pg_temp.foto('P'), pg_temp.descripcion('negro'), 'prueba', 1200, 250) then
    raise exception 'FALLA 2a: la foto de un perro, en un caso de perro abierto, no se compara';
  end if;

  if array(select animal_id from public.candidatos_ia(pg_temp.foto('P')))
     is distinct from array[pg_temp.caso('E2'), pg_temp.caso('E1')] then
    raise exception 'FALLA 2b: candidatos de P inesperados: %', (
      select string_agg(c.nombre, ', ' order by x.ord)
      from public.candidatos_ia(pg_temp.foto('P')) with ordinality x(animal_id, a, b, cc, d, e, g, hh, i, j, k, ord)
      join casos c on c.animal = x.animal_id
    );
  end if;

  -- El de cada candidato trae su foto y los datos del animal (sin personas).
  if (select foto_path from public.candidatos_ia(pg_temp.foto('P')) where animal_id = pg_temp.caso('E1')) <> foto_h
     or (select descripcion ->> 'color_principal' from public.candidatos_ia(pg_temp.foto('P'))
         where animal_id = pg_temp.caso('E1')) <> 'marron'
     or (select descripcion from public.candidatos_ia(pg_temp.foto('P')) where animal_id = pg_temp.caso('E2')) is not null then
    raise exception 'FALLA 2c: la foto o la descripción de los candidatos no son las esperadas';
  end if;
  reset role;

  -- max_candidatos acota.
  update public.config_app set valor = '1' where clave = 'max_candidatos';
  set local role service_role;
  if (select count(*) from public.candidatos_ia(pg_temp.foto('P'))) <> 1 then
    raise exception 'FALLA 2d: max_candidatos = 1 no acotó los candidatos';
  end if;
  reset role;
  update public.config_app set valor = '10' where clave = 'max_candidatos';

  -- Entre dos encontrados: E1 ve a P (perdido antes) y a E2, no a Eviejo (fuera de la ventana).
  set local role service_role;
  if not exists (select 1 from public.candidatos_ia(pg_temp.foto('E1')) where animal_id = pg_temp.caso('P'))
     or not exists (select 1 from public.candidatos_ia(pg_temp.foto('E1')) where animal_id = pg_temp.caso('E2')) then
    raise exception 'FALLA 2e: E1 no ve como candidatos al perdido P y al encontrado E2';
  end if;
  if exists (select 1 from public.candidatos_ia(pg_temp.foto('E1')) where animal_id = pg_temp.caso('Eviejo')) then
    raise exception 'FALLA 2f: un encontrado de hace 70 días es candidato (ventana de 60)';
  end if;
  -- P2 (perdido) nunca con P (perdido).
  if exists (select 1 from public.candidatos_ia(pg_temp.foto('P2')) where animal_id = pg_temp.caso('P')) then
    raise exception 'FALLA 2g: un perdido es candidato de otro perdido';
  end if;

  -- No se compara: sin animal, otra especie, caso cerrado.
  if public.guardar_descripcion_ia(pg_temp.foto('E2'), pg_temp.descripcion('no_se_ve', 'ninguno', false), 'prueba', 1, 1)
     or public.guardar_descripcion_ia(pg_temp.foto('E2'), pg_temp.descripcion('negro', 'gato'), 'prueba', 1, 1)
     or public.guardar_descripcion_ia(pg_temp.foto('Ecerrado'), pg_temp.descripcion('negro'), 'prueba', 1, 1) then
    raise exception 'FALLA 2h: se compara una foto sin animal, de otra especie o de un caso cerrado';
  end if;
  -- La foto de un caso cerrado no tiene candidatos.
  if exists (select 1 from public.candidatos_ia(pg_temp.foto('Ecerrado'))) then
    raise exception 'FALLA 2i: la foto de un caso cerrado tiene candidatos';
  end if;
  -- E2 vuelve a ser negro, para la parte 3.
  perform public.guardar_descripcion_ia(pg_temp.foto('E2'), pg_temp.descripcion('negro'), 'prueba', 1, 1);
  reset role;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Guardar la comparación: desde umbral_ia se crea la coincidencia (con
--    confianza, motivo y origen) y avisa a la familia; los pares quedan
--    comparados y lo que no era candidato se ignora.
-- -----------------------------------------------------------------------------
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000000d01';
  v_creadas integer;
  c record;
begin
  set local role service_role;
  v_creadas := public.guardar_comparacion_ia(
    pg_temp.foto('P'),
    jsonb_build_array(
      jsonb_build_object('animal_id', pg_temp.caso('E2'), 'confianza', 70, 'veredicto', 'posible',
        'motivo', 'Mismo collar rojo y mancha blanca en el pecho',
        'coinciden', jsonb_build_array('collar rojo', 'mancha blanca'), 'difieren', jsonb_build_array()),
      jsonb_build_object('animal_id', pg_temp.caso('E1'), 'confianza', 69, 'veredicto', 'distinto',
        'motivo', 'El hocico es más largo', 'coinciden', jsonb_build_array(), 'difieren', jsonb_build_array('hocico')),
      -- No es candidato de P (está a 20 km): se ignora.
      jsonb_build_object('animal_id', pg_temp.caso('Elejos'), 'confianza', 99, 'veredicto', 'mismo',
        'motivo', 'Igual', 'coinciden', jsonb_build_array(), 'difieren', jsonb_build_array())
    ),
    'prueba'
  );
  reset role;

  if v_creadas <> 1 then
    raise exception 'FALLA 3a: se esperaba 1 coincidencia nueva y hubo %', v_creadas;
  end if;
  select * into c from public.coincidencias
  where animal_origen = least(pg_temp.caso('P'), pg_temp.caso('E2'))
    and animal_candidato = greatest(pg_temp.caso('P'), pg_temp.caso('E2'));
  if c.id is null or c.origen <> 'ia' or c.confianza <> 70 or abs(c.similitud - 0.70) > 0.001
     or c.motivo <> 'Mismo collar rojo y mancha blanca en el pecho' or c.estado <> 'pendiente' then
    raise exception 'FALLA 3b: la coincidencia con confianza 70 (el umbral) no quedó bien: %', row_to_json(c);
  end if;
  if exists (select 1 from public.coincidencias where animal_origen = least(pg_temp.caso('P'), pg_temp.caso('E1'))
               and animal_candidato = greatest(pg_temp.caso('P'), pg_temp.caso('E1')))
     or exists (select 1 from public.coincidencias where animal_origen = least(pg_temp.caso('P'), pg_temp.caso('Elejos'))
               and animal_candidato = greatest(pg_temp.caso('P'), pg_temp.caso('Elejos'))) then
    raise exception 'FALLA 3c: hubo coincidencia por debajo del umbral o con un caso que no era candidato';
  end if;
  if (select count(*) from public.comparaciones_ia where avistamiento_id = pg_temp.foto('P')) <> 2 then
    raise exception 'FALLA 3d: se esperaban 2 comparaciones guardadas (E2 y E1)';
  end if;
  -- La familia recibe el aviso de siempre.
  if not exists (
    select 1 from public.notificaciones n
    where n.usuario_id = f and n.tipo = 'coincidencia' and n.datos ->> 'coincidencia_id' = c.id::text
  ) then
    raise exception 'FALLA 3e: la familia no recibió el aviso de la coincidencia';
  end if;
  -- La foto salió de la cola y quedó procesada.
  if (select estado from public.cola_vision where avistamiento_id = pg_temp.foto('P')) <> 'hecho'
     or (select procesado_en from public.avistamientos where id = pg_temp.foto('P')) is null then
    raise exception 'FALLA 3f: la foto comparada no salió de la cola';
  end if;
  -- Los pares ya comparados no se vuelven a comparar.
  set local role service_role;
  if exists (select 1 from public.candidatos_ia(pg_temp.foto('P'))) then
    raise exception 'FALLA 3g: P tiene candidatos que ya se compararon';
  end if;
  reset role;
end;
$$;

-- El motivo se ve en la tarjeta, como el resto de la coincidencia.
set local role authenticated;
do $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-4000-8000-000000000d03', 'role', 'authenticated')::text, true);
  if not exists (
    select 1 from public.coincidencias_detalle
    where origen = 'ia' and motivo = 'Mismo collar rojo y mancha blanca en el pecho' and confianza = 70
      and pg_temp.caso('P') in (animal_origen, animal_candidato)
  ) then
    raise exception 'FALLA 3h: coincidencias_detalle no muestra el motivo, la confianza y el origen';
  end if;
end;
$$;
reset role;

-- -----------------------------------------------------------------------------
-- 4. La descripción, las comparaciones y el uso los leen solo los moderadores.
-- -----------------------------------------------------------------------------
do $$
declare
  v_llamada bigint;
begin
  set local role service_role;
  v_llamada := public.iniciar_llamada_ia('describir', pg_temp.foto('P'), 'claude-haiku-5-5');
  perform public.terminar_llamada_ia(v_llamada, 'ok', 1200, 250, 0.000245, null);
  reset role;
end;
$$;

set local role authenticated;
do $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-4000-8000-000000000d03', 'role', 'authenticated')::text, true);
  if exists (select 1 from public.descripciones_ia) or exists (select 1 from public.comparaciones_ia)
     or exists (select 1 from public.llamadas_ia) then
    raise exception 'FALLA 4a: alguien que no modera lee las descripciones, las comparaciones o el uso';
  end if;
  begin
    insert into public.llamadas_ia (tipo, modelo) values ('describir', 'x');
    raise exception 'FALLA 4b: alguien que no modera anotó una llamada';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-4000-8000-000000000d04', 'role', 'authenticated')::text, true);
  if not exists (select 1 from public.descripciones_ia where avistamiento_id = pg_temp.foto('P'))
     or not exists (select 1 from public.comparaciones_ia where avistamiento_id = pg_temp.foto('P'))
     or not exists (select 1 from public.llamadas_ia where avistamiento_id = pg_temp.foto('P') and resultado = 'ok') then
    raise exception 'FALLA 4c: moderación no lee las descripciones, las comparaciones o el uso';
  end if;
  begin
    update public.config_app set valor = 'false' where clave = 'ia_activa';
    raise exception 'FALLA 4d: moderación tocó config_app desde la API';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

set local role anon;
do $$
begin
  begin
    perform 1 from public.llamadas_ia;
    raise exception 'FALLA 4e: alguien sin cuenta lee el uso de la API';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.descripciones_ia;
    raise exception 'FALLA 4f: alguien sin cuenta lee las descripciones';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- -----------------------------------------------------------------------------
-- 5. Topes: el día cuenta en hora de Montevideo; al llegar, no se llama a la
--    función ni a la API, y el estado lo muestra.
-- -----------------------------------------------------------------------------
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000000d01';
  v_hoy integer;
  v_id bigint;
  p uuid;
begin
  update public.config_app set valor = 'https://reconocer.prueba.invalid/' where clave = 'vision_url';
  update public.config_app set valor = 'secreto-de-prueba' where clave = 'vision_secret';

  -- Una llamada de ayer no cuenta.
  insert into public.llamadas_ia (tipo, modelo, resultado, created_at)
  values ('describir', 'prueba', 'ok', public.inicio_periodo_ia('day') - interval '1 minute');
  select count(*) into v_hoy from public.llamadas_ia where created_at >= public.inicio_periodo_ia('day');

  -- Queda una llamada antes del tope.
  update public.config_app set valor = (v_hoy + 1)::text where clave = 'ia_tope_diario';
  set local role service_role;
  v_id := public.iniciar_llamada_ia('comparar', null, 'claude-haiku-5-5');
  if v_id is null then
    raise exception 'FALLA 5a: con una llamada disponible, no se pudo reservar';
  end if;
  perform public.terminar_llamada_ia(v_id, 'limite', 900, 0, 0.00009, 'rate_limit_error');
  if public.iniciar_llamada_ia('comparar', null, 'claude-haiku-5-5') is not null then
    raise exception 'FALLA 5b: se reservó una llamada pasado el tope del día';
  end if;
  if public.config_reconocimiento() ->> 'estado' <> 'tope_diario' then
    raise exception 'FALLA 5c: la función no se entera de que llegó al tope';
  end if;
  reset role;

  -- Una foto nueva queda en la cola, sin aviso; el cron tampoco llama.
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  p := public.publicar_animal('perro', '00000000-0000-4000-8000-000000000d01/ia-1.jpg', -34.95, -56.10);
  perform set_config('request.jwt.claims', '', true);
  insert into casos (nombre, animal, avistamiento)
  values ('Ptope', p, (select id from public.avistamientos where animal_id = p));
  if pg_temp.pedidos('/procesar') <> 0 or public.despertar_vision() <> 'tope_diario'
     or pg_temp.pedidos('/procesar-pendientes') <> 0 then
    raise exception 'FALLA 5d: con el tope alcanzado se llamó a la función';
  end if;
  if (select estado from public.cola_vision where avistamiento_id = pg_temp.foto('Ptope')) <> 'pendiente' then
    raise exception 'FALLA 5e: la foto no quedó esperando en la cola';
  end if;

  -- Con lugar otra vez, el cron llama.
  update public.config_app set valor = '300' where clave = 'ia_tope_diario';
  if public.despertar_vision() <> 'enviado' or pg_temp.pedidos('/procesar-pendientes') <> 1 then
    raise exception 'FALLA 5f: con lugar en el tope, el cron no llamó';
  end if;
end;
$$;

set local role authenticated;
do $$
declare
  e record;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-4000-8000-000000000d04', 'role', 'authenticated')::text, true);
  select * into e from public.estado_reconocimiento();
  if e.llamadas_hoy < 2 or e.tope_diario <> 300 or e.errores_hoy < 1 or e.costo_mes < 0.000335
     or not e.configurado or not e.activa or e.pausa is not null then
    raise exception 'FALLA 5g: estado inesperado: %', row_to_json(e);
  end if;
end;
$$;
reset role;

-- -----------------------------------------------------------------------------
-- 6. El interruptor apaga todo: avisos, cron, botón, reservas y la función.
-- -----------------------------------------------------------------------------
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000000d01';
  v_antes integer := pg_temp.pedidos('/procesar') + pg_temp.pedidos('/procesar-pendientes');
begin
  update public.config_app set valor = 'false' where clave = 'ia_activa';
  if public.despertar_vision() <> 'apagado' then
    raise exception 'FALLA 6a: apagado, despertar_vision no dijo "apagado"';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  perform public.registrar_avistamiento(pg_temp.caso('P'), '00000000-0000-4000-8000-000000000d01/ia-1.jpg', -34.91, -56.16);
  perform set_config('request.jwt.claims', '', true);
  if pg_temp.pedidos('/procesar') + pg_temp.pedidos('/procesar-pendientes') <> v_antes then
    raise exception 'FALLA 6b: apagado, una foto nueva avisó a la función';
  end if;
  set local role service_role;
  if public.iniciar_llamada_ia('describir', null, 'claude-haiku-5-5') is not null
     or public.config_reconocimiento() ->> 'estado' <> 'apagado' then
    raise exception 'FALLA 6c: apagado, la función podría llamar a la API';
  end if;
  reset role;
end;
$$;

set local role authenticated;
do $$
declare
  e record;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-4000-8000-000000000d04', 'role', 'authenticated')::text, true);
  if public.procesar_pendientes_vision() <> 'apagado' then
    raise exception 'FALLA 6d: apagado, el botón no dijo "apagado"';
  end if;
  select * into e from public.estado_reconocimiento();
  if e.activa then
    raise exception 'FALLA 6e: el estado no dice que está apagado';
  end if;
end;
$$;
reset role;

update public.config_app set valor = 'true' where clave = 'ia_activa';

-- -----------------------------------------------------------------------------
-- 7. Sin crédito: se pausa hasta que un moderador reactiva.
-- -----------------------------------------------------------------------------
do $$
begin
  set local role service_role;
  perform public.pausar_ia('sin_credito');
  begin
    perform public.pausar_ia('cualquier cosa');
    raise exception 'FALLA 7a: se pausó con un motivo desconocido';
  exception when invalid_parameter_value then null;
  end;
  if public.iniciar_llamada_ia('describir', null, 'claude-haiku-5-5') is not null then
    raise exception 'FALLA 7b: pausado, se reservó una llamada';
  end if;
  reset role;
  if public.despertar_vision() <> 'pausado' then
    raise exception 'FALLA 7c: pausado, despertar_vision no dijo "pausado"';
  end if;
end;
$$;

set local role authenticated;
do $$
declare
  e record;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-4000-8000-000000000d03', 'role', 'authenticated')::text, true);
  begin
    perform public.reactivar_reconocimiento();
    raise exception 'FALLA 7d: alguien que no modera reactivó el reconocimiento';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-4000-8000-000000000d04', 'role', 'authenticated')::text, true);
  select * into e from public.estado_reconocimiento();
  if e.pausa is distinct from 'sin_credito' then
    raise exception 'FALLA 7e: el estado no muestra la pausa por falta de crédito';
  end if;
  -- Hay fotos en la cola (la de la parte 5 y la de la 6): reactiva y llama.
  if public.reactivar_reconocimiento() <> 'enviado' then
    raise exception 'FALLA 7f: al reactivar no se llamó a la función';
  end if;
  select * into e from public.estado_reconocimiento();
  if e.pausa is not null then
    raise exception 'FALLA 7g: después de reactivar sigue pausado';
  end if;
end;
$$;
reset role;

-- -----------------------------------------------------------------------------
-- 8. Tomar una foto: un solo pedido la toma; sin datos de personas; si la
--    función se corta, vuelve a la cola a los 10 minutos.
-- -----------------------------------------------------------------------------
do $$
declare
  v jsonb;
begin
  set local role service_role;
  v := public.tomar_pendiente_ia(pg_temp.foto('Ptope'));
  if v is null or v ->> 'foto_path' is null or v ->> 'especie' <> 'perro'
     or v ->> 'tipo_reporte' <> 'encontrado' or (v ->> 'caso_abierto')::boolean is not true then
    raise exception 'FALLA 8a: no se tomó la foto pendiente o faltan datos: %', v;
  end if;
  if v ?| array['creado_por', 'usuario_id', 'contacto_familia', 'nombre', 'descripcion_libre', 'ubicacion'] then
    raise exception 'FALLA 8b: lo que recibe la función trae datos de personas o la ubicación: %', v;
  end if;
  if public.tomar_pendiente_ia(pg_temp.foto('Ptope')) is not null then
    raise exception 'FALLA 8c: dos pedidos tomaron la misma foto';
  end if;
  reset role;
  if exists (select 1 from public.cola_vision_pendientes where avistamiento_id = pg_temp.foto('Ptope')) then
    raise exception 'FALLA 8d: una foto que se está procesando sigue en la cola';
  end if;

  -- La función se cortó hace 11 minutos.
  delete from public.cola_vision where avistamiento_id = pg_temp.foto('Ptope');
  insert into public.cola_vision (avistamiento_id, estado, created_at, updated_at)
  values (pg_temp.foto('Ptope'), 'procesando', now() - interval '1 hour', now() - interval '11 minutes');
  if not exists (select 1 from public.cola_vision_pendientes where avistamiento_id = pg_temp.foto('Ptope')) then
    raise exception 'FALLA 8e: una foto trabada en "procesando" no volvió a la cola';
  end if;
  set local role service_role;
  if public.tomar_pendiente_ia(pg_temp.foto('Ptope')) is null then
    raise exception 'FALLA 8f: no se pudo volver a tomar una foto trabada';
  end if;
  -- Si no pudo llamar (llegó al tope), la suelta: vuelve a esperar sin gastar un intento.
  perform public.soltar_pendiente_ia(pg_temp.foto('Ptope'));
  reset role;
  if (select estado::text || '/' || intentos from public.cola_vision
      where avistamiento_id = pg_temp.foto('Ptope')) <> 'pendiente/0' then
    raise exception 'FALLA 8i: la foto soltada no volvió a esperar sin gastar un intento';
  end if;
  set local role service_role;
  -- Una foto ya descripta trae su descripción (el reintento no la vuelve a
  -- describir); una sin describir, no.
  v := public.tomar_pendiente_ia(pg_temp.foto('E1'));
  if v -> 'descripcion' ->> 'color_principal' is distinct from 'marron' then
    raise exception 'FALLA 8g: una foto ya descripta no trae su descripción: %', v;
  end if;
  v := public.tomar_pendiente_ia(pg_temp.foto('P2'));
  if jsonb_typeof(v -> 'descripcion') <> 'null' then
    raise exception 'FALLA 8h: una foto sin describir trae descripción: %', v;
  end if;
  reset role;
end;
$$;

rollback;
