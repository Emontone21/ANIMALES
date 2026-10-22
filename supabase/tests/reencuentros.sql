-- =============================================================================
-- Pruebas del muro de reencuentros (migraciones 0025 y 0026): contar la
-- historia, agradecer, el muro y su contador, denunciar y ocultar historias, y
-- lo que pasa al borrar una historia, un reporte o la cuenta.
-- Requiere las migraciones 0001 a 0026. Pegalo entero en el SQL Editor y tocá Run.
-- Bien: termina en "Success. No rows returned". Mal: ERROR con "FALLA n: ..." que dice qué.
-- Todo corre dentro de begin/rollback: no deja usuarios, fotos, casos, historias,
-- agradecimientos ni avisos, y cambia config_app solo dentro de la transacción.
--
-- Personas: F (familia de Toby), V (lo vio), R (lo resguardó), E (le escribió),
-- B (lo vio, pero F lo bloqueó), X (no participó), M (moderadora) y N1 a N3
-- (cuentas con antigüedad que denuncian).
-- =============================================================================
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000002601', 'prueba-reen-f@spot.test', '{"nombre_publico":"Prueba Familia"}'),
  ('00000000-0000-4000-8000-000000002602', 'prueba-reen-v@spot.test', '{"nombre_publico":"Prueba Vio"}'),
  ('00000000-0000-4000-8000-000000002603', 'prueba-reen-r@spot.test', '{"nombre_publico":"Prueba Resguardo"}'),
  ('00000000-0000-4000-8000-000000002604', 'prueba-reen-e@spot.test', '{"nombre_publico":"Prueba Escribe"}'),
  ('00000000-0000-4000-8000-000000002605', 'prueba-reen-b@spot.test', '{"nombre_publico":"Prueba Bloqueada"}'),
  ('00000000-0000-4000-8000-000000002606', 'prueba-reen-x@spot.test', '{"nombre_publico":"Prueba Otra"}'),
  ('00000000-0000-4000-8000-000000002607', 'prueba-reen-m@spot.test', '{"nombre_publico":"Prueba Moderadora"}'),
  ('00000000-0000-4000-8000-000000002608', 'prueba-reen-n1@spot.test', '{"nombre_publico":"Prueba N1"}'),
  ('00000000-0000-4000-8000-000000002609', 'prueba-reen-n2@spot.test', '{"nombre_publico":"Prueba N2"}'),
  ('00000000-0000-4000-8000-000000002610', 'prueba-reen-n3@spot.test', '{"nombre_publico":"Prueba N3"}');
update public.perfiles
set terminos_version = public.version_terminos(), terminos_aceptados_en = now()
where id::text like '00000000-0000-4000-8000-0000000026__';
update public.perfiles set es_moderador = true where id = '00000000-0000-4000-8000-000000002607';
-- Las que denuncian, con más de 7 días: sus denuncias cuentan para ocultar solas.
update public.perfiles set created_at = now() - interval '30 days'
where id in ('00000000-0000-4000-8000-000000002608', '00000000-0000-4000-8000-000000002609',
             '00000000-0000-4000-8000-000000002610');

-- Para la prueba: topes altos y la función avisar "configurada" (nadie la atiende).
update public.config_app set valor = '100'
where clave in ('publicaciones_por_hora_cuenta', 'avisos_por_hora_cuenta');
update public.config_app set valor = 'https://ejemplo.supabase.co/functions/v1/avisar' where clave = 'avisar_url';
update public.config_app set valor = repeat('cd', 32) where clave = 'avisar_secret';

-- Una foto subida desde la app, con su miniatura y su mediana.
create function pg_temp.foto(p_uid uuid) returns text language plpgsql security definer as $$
declare
  v_raiz text := p_uid::text || '/' || gen_random_uuid()::text;
begin
  insert into storage.objects (bucket_id, name) values
    ('fotos', v_raiz || '.jpg'), ('fotos', v_raiz || '.miniatura.jpg'), ('fotos', v_raiz || '.mediana.jpg');
  return v_raiz || '.jpg';
end;
$$;

-- Actuar como alguien (null: sin cuenta).
create function pg_temp.como(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then '' else json_build_object('sub', p_uid, 'role', 'authenticated')::text end,
    true);
end;
$$;

-- Corre p_sql y exige que falle con p_estado (el SQLSTATE).
create function pg_temp.falla(p_sql text, p_estado text, p_falla text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_estado then
      return;
    end if;
    raise exception 'FALLA %: esperaba el error % y fue % (%)', p_falla, p_estado, sqlstate, sqlerrm;
  end;
  raise exception 'FALLA %: no dio error', p_falla;
end;
$$;

create temp table casos (nombre text primary key, animal uuid) on commit drop;
grant all on casos to public;
create temp table fotos (nombre text primary key, ruta text) on commit drop;
grant all on fotos to public;

insert into fotos values
  ('toby', pg_temp.foto('00000000-0000-4000-8000-000000002601')),
  ('mora', pg_temp.foto('00000000-0000-4000-8000-000000002601')),
  ('reencuentro', pg_temp.foto('00000000-0000-4000-8000-000000002601')),
  ('reencuentro2', pg_temp.foto('00000000-0000-4000-8000-000000002601')),
  ('vio', pg_temp.foto('00000000-0000-4000-8000-000000002602')),
  ('resguardo', pg_temp.foto('00000000-0000-4000-8000-000000002603')),
  ('bloqueada', pg_temp.foto('00000000-0000-4000-8000-000000002605')),
  ('otra', pg_temp.foto('00000000-0000-4000-8000-000000002606')),
  ('ajena', pg_temp.foto('00000000-0000-4000-8000-000000002606'));

-- El contador antes de empezar (lo que haya en la base).
create temp table antes (contador integer) on commit drop;
grant all on antes to public;
insert into antes select public.contador_reencuentros();

set local role authenticated;

-- -----------------------------------------------------------------------------
-- 0. El caso: F publica a Toby (perdido hace 3 días), V lo ve, R lo resguarda,
--    E le escribe a F, B lo ve y F la bloquea. X publica un encontrado.
-- -----------------------------------------------------------------------------
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002601';
  v constant uuid := '00000000-0000-4000-8000-000000002602';
  r constant uuid := '00000000-0000-4000-8000-000000002603';
  e constant uuid := '00000000-0000-4000-8000-000000002604';
  b constant uuid := '00000000-0000-4000-8000-000000002605';
  x constant uuid := '00000000-0000-4000-8000-000000002606';
  toby uuid;
  mora uuid;
  encontrado uuid;
  conv uuid;
begin
  perform pg_temp.como(f);
  toby := public.publicar_animal('perro', (select ruta from fotos where nombre = 'toby'),
    -34.9, -56.16, now() - interval '3 days', 'mediano', 'marrón', true,
    'Se escapó por la calle Rivera', 'perdido', 'Toby', '099 000 000');
  mora := public.publicar_animal('gato', (select ruta from fotos where nombre = 'mora'),
    -34.9, -56.16, now() - interval '1 day', 'chico', 'gris', false, null, 'perdido', 'Mora', null);
  insert into casos values ('toby', toby), ('mora', mora);

  perform pg_temp.como(v);
  perform public.registrar_avistamiento(toby, (select ruta from fotos where nombre = 'vio'),
    -34.91, -56.17, now() - interval '2 days', 'Iba por la rambla');
  -- V activa las notificaciones del celular (para el punto 9).
  perform public.guardar_suscripcion_push('https://fcm.googleapis.com/fcm/send/prueba-reen-v',
    'B' || repeat('v', 86), repeat('v', 22));

  perform pg_temp.como(b);
  perform public.registrar_avistamiento(toby, (select ruta from fotos where nombre = 'bloqueada'),
    -34.91, -56.17, now() - interval '2 days', null);

  perform pg_temp.como(r);
  perform public.cambiar_estado_animal(toby, 'resguardado', 'Lo tengo yo', null, -34.9, -56.16,
    (select ruta from fotos where nombre = 'resguardo'));

  perform pg_temp.como(e);
  conv := public.abrir_conversacion(toby, f);
  insert into public.mensajes (conversacion_id, emisor_id, cuerpo) values (conv, e, 'Creo que lo vi en el parque');

  perform pg_temp.como(f);
  insert into public.bloqueos (bloqueador_id, bloqueado_id) values (f, b);

  perform pg_temp.como(x);
  encontrado := public.publicar_animal('perro', (select ruta from fotos where nombre = 'otra'),
    -34.9, -56.16, now() - interval '1 day', 'grande', 'negro', false, null, 'encontrado', null, null);
  insert into casos values ('encontrado', encontrado);
end $$;

-- -----------------------------------------------------------------------------
-- 1. Permisos: nada se escribe directo; contar y agradecer, solo con cuenta;
--    el muro y el contador, también sin cuenta.
-- -----------------------------------------------------------------------------
do $$
begin
  if has_table_privilege('authenticated', 'public.historias_reencuentro', 'insert')
     or has_table_privilege('authenticated', 'public.historias_reencuentro', 'update')
     or has_table_privilege('authenticated', 'public.historias_reencuentro', 'delete')
     or has_table_privilege('authenticated', 'public.agradecimientos', 'insert')
     or has_table_privilege('authenticated', 'public.agradecimientos', 'update')
     or has_table_privilege('authenticated', 'public.agradecimientos', 'delete') then
    raise exception 'FALLA 1a: las historias o los agradecimientos se escriben sin las RPC';
  end if;
  if has_table_privilege('anon', 'public.agradecimientos', 'select') then
    raise exception 'FALLA 1b: los agradecimientos se leen sin cuenta';
  end if;
  if has_function_privilege('anon', 'public.guardar_historia_reencuentro(uuid, text, boolean, text)', 'execute')
     or has_function_privilege('anon', 'public.agradecer(uuid, uuid[], text)', 'execute')
     or has_function_privilege('anon', 'public.participantes_del_caso(uuid)', 'execute')
     or has_function_privilege('anon', 'public.moderar_historia(uuid, boolean)', 'execute') then
    raise exception 'FALLA 1c: anon puede contar, agradecer, ver participantes o moderar';
  end if;
  if not has_function_privilege('anon', 'public.muro_reencuentros(integer, timestamptz)', 'execute')
     or not has_function_privilege('anon', 'public.contador_reencuentros()', 'execute')
     or not has_function_privilege('anon', 'public.historia_reencuentro(uuid)', 'execute') then
    raise exception 'FALLA 1d: el muro no se puede leer sin cuenta';
  end if;
  if has_function_privilege('authenticated', 'public.participantes_internos(uuid, uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.caso_de_la_familia(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.archivos_de_foto(text, uuid, uuid)', 'execute') then
    raise exception 'FALLA 1e: las funciones internas se pueden llamar desde la API';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Solo la familia cuenta la historia, y solo con el caso reunido.
-- -----------------------------------------------------------------------------
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002601';
  r constant uuid := '00000000-0000-4000-8000-000000002603';
  x constant uuid := '00000000-0000-4000-8000-000000002606';
  toby uuid := (select animal from casos where nombre = 'toby');
  encontrado uuid := (select animal from casos where nombre = 'encontrado');
begin
  -- Abierto todavía: ni la familia.
  perform pg_temp.como(f);
  perform pg_temp.falla(format('select public.guardar_historia_reencuentro(%L, %L)', toby, 'Volvió'),
    '22023', '2a');

  perform public.cambiar_estado_animal(toby, 'reunido');

  -- Nadie más: ni quien lo resguardó, ni otra persona.
  perform pg_temp.como(r);
  perform pg_temp.falla(format('select public.guardar_historia_reencuentro(%L, %L)', toby, 'Volvió'),
    '42501', '2b');
  perform pg_temp.como(x);
  perform pg_temp.falla(format('select public.guardar_historia_reencuentro(%L, %L)', toby, 'Volvió'),
    '42501', '2c');

  -- Un encontrado no tiene familia en Spot: ni quien lo publicó cuenta su historia.
  perform public.cambiar_estado_animal(encontrado, 'reunido');
  perform pg_temp.falla(format('select public.guardar_historia_reencuentro(%L, %L)', encontrado, 'Volvió'),
    '42501', '2d');

  -- La familia sí. Sin frase no hay historia; más de 280, tampoco.
  perform pg_temp.como(f);
  perform pg_temp.falla(format('select public.guardar_historia_reencuentro(%L, %L)', toby, '   '),
    '22023', '2e');
  perform pg_temp.falla(format('select public.guardar_historia_reencuentro(%L, %L)', toby, repeat('a', 281)),
    '22023', '2f');
  perform public.guardar_historia_reencuentro(toby,
    'Lo encontró una vecina a dos cuadras. Gracias a todos los que avisaron.', true, null);
  if (select count(*) from public.historias_reencuentro where animal_id = toby and familia_id = f) <> 1 then
    raise exception 'FALLA 2g: la historia no quedó guardada';
  end if;

  -- Fotos: una ajena o una ya publicada no; una nueva de la familia, sí.
  perform pg_temp.falla(format('select public.guardar_historia_reencuentro(%L, %L, true, %L)', toby, 'Volvió',
    (select ruta from fotos where nombre = 'ajena')), '22023', '2h');
  perform pg_temp.falla(format('select public.guardar_historia_reencuentro(%L, %L, true, %L)', toby, 'Volvió',
    (select ruta from fotos where nombre = 'toby')), '22023', '2i');
  perform public.guardar_historia_reencuentro(toby, 'Volvió a casa feliz.', true,
    (select ruta from fotos where nombre = 'reencuentro'));
  if (select foto_path from public.historias_reencuentro where animal_id = toby)
     is distinct from (select ruta from fotos where nombre = 'reencuentro') then
    raise exception 'FALLA 2j: no guardó la foto del reencuentro';
  end if;

  -- Cambiar la foto devuelve la anterior con sus variantes, para borrarlas.
  if (
    select count(*) from public.guardar_historia_reencuentro(toby, 'Volvió a casa feliz.', true,
      (select ruta from fotos where nombre = 'reencuentro2'))
  ) <> 3 then
    raise exception 'FALLA 2k: al cambiar la foto no devolvió los tres archivos de la anterior';
  end if;
  -- Dejarla igual no devuelve nada.
  if exists (
    select 1 from public.guardar_historia_reencuentro(toby, 'Volvió a casa feliz.', true,
      (select ruta from fotos where nombre = 'reencuentro2'))
  ) then
    raise exception 'FALLA 2l: sin cambiar la foto devolvió archivos para borrar';
  end if;

  -- Otra persona no la edita ni la borra.
  perform pg_temp.como(x);
  perform pg_temp.falla(format('select public.guardar_historia_reencuentro(%L, %L)', toby, 'Mentira'),
    '42501', '2m');
  perform pg_temp.falla(format('select public.borrar_historia_reencuentro(%L)', toby), 'P0002', '2n');
  perform pg_temp.falla(format('select public.fotos_de_la_historia(%L)', toby), 'P0002', '2o');
  perform pg_temp.como(f);
  if (select frase from public.historias_reencuentro where animal_id = toby) <> 'Volvió a casa feliz.' then
    raise exception 'FALLA 2p: otra persona cambió la historia';
  end if;

  -- RLS: la historia la lee directo solo la familia (y moderación).
  perform pg_temp.como(x);
  if exists (select 1 from public.historias_reencuentro where animal_id = toby) then
    raise exception 'FALLA 2q: otra persona lee la tabla de historias';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Los teléfonos, links y emails se tapan, en la historia y en el agradecimiento.
-- -----------------------------------------------------------------------------
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002601';
  toby uuid := (select animal from casos where nombre = 'toby');
  v_frase text;
begin
  perform pg_temp.como(f);
  perform public.guardar_historia_reencuentro(toby,
    'Volvió! Escribime al 099 123 456, a toby@correo.com o por https://wa.me/59899123456', true,
    (select ruta from fotos where nombre = 'reencuentro2'));
  select frase into v_frase from public.historias_reencuentro where animal_id = toby;
  if v_frase ~ '[0-9]|@|https?://|wa\.me' or v_frase not like '%[dato oculto]%' then
    raise exception 'FALLA 3a: la frase guardó datos de contacto (%)', v_frase;
  end if;
  -- La base los rechaza aunque alguien los quiera guardar sin la RPC.
  reset role;
  begin
    update public.historias_reencuentro set frase = 'Llamame al 099 123 456' where animal_id = toby;
    raise exception 'FALLA 3b: la tabla aceptó un teléfono en la frase';
  exception when check_violation then
    null;
  end;
  set local role authenticated;
  perform pg_temp.como(f);
  perform public.guardar_historia_reencuentro(toby,
    'Lo encontró una vecina a dos cuadras. Gracias a todos los que avisaron.', true,
    (select ruta from fotos where nombre = 'reencuentro2'));
end $$;

-- -----------------------------------------------------------------------------
-- 4. El muro, sin cuenta: solo lo público, nunca datos de nadie.
-- -----------------------------------------------------------------------------
reset role;
do $$ begin perform pg_temp.como(null); end $$;
set local role anon;
do $$
declare
  toby uuid := (select animal from casos where nombre = 'toby');
  v_fila jsonb;
  v_claves text[];
begin
  select to_jsonb(m) into v_fila from public.muro_reencuentros() m where m.animal_id = toby;
  if v_fila is null then
    raise exception 'FALLA 4a: la historia no está en el muro';
  end if;
  select array_agg(k order by k) into v_claves from jsonb_object_keys(v_fila) k;
  if v_claves <> array['animal_id', 'dias', 'especie', 'foto_path', 'frase', 'nombre', 'reunido_en'] then
    raise exception 'FALLA 4b: el muro devuelve otras columnas: %', v_claves;
  end if;
  -- La foto lleva la carpeta de quien la subió, como todas las fotos públicas
  -- de la app; se compara entera en 4d. El resto, sin nada de nadie.
  if (v_fila - 'foto_path')::text ~ '099|Rivera|Prueba|00000000-0000-4000-8000-0000000026' then
    raise exception 'FALLA 4c: el muro lleva datos privados: %', v_fila;
  end if;
  if v_fila ->> 'nombre' <> 'Toby' or (v_fila ->> 'dias')::int <> 3
     or v_fila ->> 'foto_path' <> (select ruta from fotos where nombre = 'reencuentro2') then
    raise exception 'FALLA 4d: el muro no muestra el nombre, los 3 días o la foto del reencuentro: %', v_fila;
  end if;

  select to_jsonb(h) into v_fila from public.historia_reencuentro(toby) h;
  select array_agg(k order by k) into v_claves from jsonb_object_keys(v_fila) k;
  if v_claves <> array['animal_id', 'dias', 'especie', 'foto_path', 'frase', 'nombre', 'oculta', 'reunido_en']
     or (v_fila ->> 'oculta')::boolean then
    raise exception 'FALLA 4e: la historia sola devuelve otras columnas: %', v_fila;
  end if;

  -- La tabla, sin cuenta, no devuelve nada.
  if exists (select 1 from public.historias_reencuentro) then
    raise exception 'FALLA 4f: anon lee la tabla de historias';
  end if;
end $$;

-- Sin el nombre, si la familia lo pide; sin foto propia, la del caso.
reset role;
set local role authenticated;
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002601';
  toby uuid := (select animal from casos where nombre = 'toby');
  v_fila record;
begin
  perform pg_temp.como(f);
  perform public.guardar_historia_reencuentro(toby, 'Volvió.', false, null);
  select * into v_fila from public.muro_reencuentros() m where m.animal_id = toby;
  if v_fila.nombre is not null or v_fila.foto_path is distinct from (select ruta from fotos where nombre = 'toby') then
    raise exception 'FALLA 4g: sin nombre ni foto propia, el muro no usa la especie y la foto del caso';
  end if;
  perform public.guardar_historia_reencuentro(toby,
    'Lo encontró una vecina a dos cuadras. Gracias a todos los que avisaron.', true,
    (select ruta from fotos where nombre = 'reencuentro2'));
end $$;

-- "Ver el caso" desde el muro: la app lo ofrece solo si la tabla le devuelve
-- la fila de la historia, y eso pasa solo con la familia y moderación.
do $$
declare
  toby uuid := (select animal from casos where nombre = 'toby');
  v_quien uuid;
begin
  foreach v_quien in array array['00000000-0000-4000-8000-000000002601',
                                 '00000000-0000-4000-8000-000000002607']::uuid[] loop
    perform pg_temp.como(v_quien);
    if not exists (select 1 from public.historias_reencuentro where animal_id = toby) then
      raise exception 'FALLA 4h: % (familia o moderadora) no lee la historia en la tabla', v_quien;
    end if;
  end loop;
  -- Quien ayudó (lo vio, lo resguardó, le escribió) y una cuenta cualquiera: no.
  foreach v_quien in array array['00000000-0000-4000-8000-000000002602',
                                 '00000000-0000-4000-8000-000000002603',
                                 '00000000-0000-4000-8000-000000002604',
                                 '00000000-0000-4000-8000-000000002606']::uuid[] loop
    perform pg_temp.como(v_quien);
    if exists (select 1 from public.historias_reencuentro where animal_id = toby) then
      raise exception 'FALLA 4h: % lee la historia en la tabla (vería "Ver el caso")', v_quien;
    end if;
  end loop;
  perform pg_temp.como('00000000-0000-4000-8000-000000002601');
end $$;

-- -----------------------------------------------------------------------------
-- 5. El contador: todos los reunidos, sin ocultos ni datos de demo.
-- -----------------------------------------------------------------------------
reset role;
do $$
declare
  c0 integer := (select contador from antes);
  toby uuid := (select animal from casos where nombre = 'toby');
  mora uuid := (select animal from casos where nombre = 'mora');
  demo uuid := gen_random_uuid();
begin
  -- Toby (perdido) y el encontrado de X se reunieron: los dos cuentan.
  if public.contador_reencuentros() <> c0 + 2 then
    raise exception 'FALLA 5a: el contador no suma los dos reunidos (% en vez de %)',
      public.contador_reencuentros(), c0 + 2;
  end if;
  -- Un dato de demo (foto de otro sitio, cargado por SQL) reunido, con historia: no cuenta ni sale.
  insert into public.animales (id, especie, foto_principal_path, estado, tipo_reporte, nombre, creado_por)
  values (demo, 'perro', 'https://placedog.net/640/480?id=99', 'reunido', 'perdido', 'Demo',
          '00000000-0000-4000-8000-000000002601');
  insert into public.historias_reencuentro (animal_id, familia_id, frase)
  values (demo, '00000000-0000-4000-8000-000000002601', 'Historia de demo');
  if public.contador_reencuentros() <> c0 + 2 then
    raise exception 'FALLA 5b: el contador cuenta los datos de demo';
  end if;
  if exists (select 1 from public.muro_reencuentros(50) m where m.animal_id = demo)
     or exists (select 1 from public.historia_reencuentro(demo)) then
    raise exception 'FALLA 5c: el muro muestra datos de demo';
  end if;
  -- Un caso oculto por moderación no cuenta ni sale en el muro.
  update public.animales set oculto = true where id = toby;
  if public.contador_reencuentros() <> c0 + 1
     or exists (select 1 from public.muro_reencuentros(50) m where m.animal_id = toby) then
    raise exception 'FALLA 5d: un caso oculto cuenta o sale en el muro';
  end if;
  update public.animales set oculto = false where id = toby;
  -- Un caso abierto no cuenta.
  if exists (select 1 from public.muro_reencuentros(50) m where m.animal_id = mora) then
    raise exception 'FALLA 5e: un caso abierto sale en el muro';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 6. Agradecer: solo la familia, solo a quien participó, y solo eso cuenta.
-- -----------------------------------------------------------------------------
set local role authenticated;
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002601';
  v constant uuid := '00000000-0000-4000-8000-000000002602';
  r constant uuid := '00000000-0000-4000-8000-000000002603';
  e constant uuid := '00000000-0000-4000-8000-000000002604';
  b constant uuid := '00000000-0000-4000-8000-000000002605';
  x constant uuid := '00000000-0000-4000-8000-000000002606';
  toby uuid := (select animal from casos where nombre = 'toby');
  v_lista text;
  n integer;
  v_aviso record;
begin
  -- Quiénes participaron: V lo vio, R lo resguardó, E le escribió. Ni B (bloqueada), ni X, ni F.
  perform pg_temp.como(f);
  select string_agg(
    nombre_publico || ':' || lo_vio::text || '/' || lo_resguardo::text || '/' || le_escribio::text,
    ', ' order by nombre_publico)
  into v_lista
  from public.participantes_del_caso(toby);
  if v_lista is distinct from
     'Prueba Escribe:false/false/true, Prueba Resguardo:false/true/false, Prueba Vio:true/false/false' then
    raise exception 'FALLA 6a: participantes inesperados: %', v_lista;
  end if;

  -- Nadie más ve la lista.
  perform pg_temp.como(x);
  perform pg_temp.falla(format('select * from public.participantes_del_caso(%L)', toby), '42501', '6b');
  perform pg_temp.como(v);
  perform pg_temp.falla(format('select * from public.participantes_del_caso(%L)', toby), '42501', '6c');

  -- Ni agradece: solo la familia.
  perform pg_temp.como(r);
  perform pg_temp.falla(format('select public.agradecer(%L, array[%L]::uuid[])', toby, v), '42501', '6d');

  -- La familia, solo a quien participó (ni a X ni a B, bloqueada).
  perform pg_temp.como(f);
  perform pg_temp.falla(format('select public.agradecer(%L, array[%L]::uuid[])', toby, x), '22023', '6e');
  perform pg_temp.falla(format('select public.agradecer(%L, array[%L]::uuid[])', toby, b), '22023', '6f');
  perform pg_temp.falla(format('select public.agradecer(%L, array[]::uuid[])', toby), '22023', '6g');

  n := public.agradecer(toby, array[v, e],
    'Gracias por avisar! Si querés, llamame al 099 765 432 o escribime a familia@correo.com');
  if n <> 2 then
    raise exception 'FALLA 6h: agradeció a % en vez de 2', n;
  end if;
  -- A quien ya le agradeció no le vuelve a llegar.
  if public.agradecer(toby, array[v], null) <> 0 then
    raise exception 'FALLA 6i: agradeció dos veces a la misma persona';
  end if;

  -- Le llega a cada uno a Actividad, con el texto de la familia y los contactos tapados.
  reset role;
  if (select count(*) from public.notificaciones where usuario_id = v and tipo = 'agradecimiento') <> 1
     or (select count(*) from public.notificaciones where usuario_id = e and tipo = 'agradecimiento') <> 1
     or exists (select 1 from public.notificaciones where usuario_id in (r, b, x) and tipo = 'agradecimiento') then
    raise exception 'FALLA 6j: los avisos de agradecimiento no llegaron a quien correspondía';
  end if;
  select titulo, cuerpo, datos, actor_id into v_aviso
  from public.notificaciones where usuario_id = v and tipo = 'agradecimiento';
  if v_aviso.titulo <> 'La familia de Toby te agradeció'
     or v_aviso.cuerpo ~ '099|correo' or v_aviso.cuerpo not like '%[dato oculto]%'
     or v_aviso.datos ->> 'animal_id' <> toby::text or v_aviso.actor_id <> f then
    raise exception 'FALLA 6k: el aviso de agradecimiento no es el esperado: % · %', v_aviso.titulo, v_aviso.cuerpo;
  end if;
  if exists (select 1 from public.agradecimientos where public.tiene_datos_de_contacto(mensaje)) then
    raise exception 'FALLA 6l: un agradecimiento guardó datos de contacto';
  end if;
  begin
    insert into public.agradecimientos (animal_id, familia_id, usuario_id, mensaje)
    values (toby, f, r, 'Escribime a otra@correo.com');
    raise exception 'FALLA 6m: la tabla aceptó un email en el agradecimiento';
  exception when check_violation then
    null;
  end;
  set local role authenticated;

  -- Los ven solo la familia y quien lo recibe.
  perform pg_temp.como(f);
  if (select count(*) from public.agradecimientos where animal_id = toby) <> 2 then
    raise exception 'FALLA 6n: la familia no ve sus dos agradecimientos';
  end if;
  perform pg_temp.como(v);
  if (select count(*) from public.agradecimientos) <> 1 then
    raise exception 'FALLA 6o: quien lo recibió no ve el suyo, o ve otros';
  end if;
  perform pg_temp.como(x);
  if exists (select 1 from public.agradecimientos) then
    raise exception 'FALLA 6p: otra persona ve agradecimientos';
  end if;

  -- "Ayudaste a reunir a N familias": solo lo que una familia agradeció.
  perform pg_temp.como(v);
  if public.familias_que_ayude() <> 1 then
    raise exception 'FALLA 6q: a quien le agradecieron no le cuenta';
  end if;
  perform pg_temp.como(r);
  if public.familias_que_ayude() <> 0 then
    raise exception 'FALLA 6r: cuenta a quien participó pero nadie le agradeció';
  end if;
  perform pg_temp.como(e);
  perform pg_temp.falla(
    format('insert into public.agradecimientos (animal_id, familia_id, usuario_id) values (%L, %L, %L)', toby, f, e),
    '42501', '6s');

  -- Con el caso oculto, quien lo recibió deja de verlo y no le cuenta.
  reset role;
  update public.animales set oculto = true where id = toby;
  set local role authenticated;
  perform pg_temp.como(v);
  if exists (select 1 from public.agradecimientos) or public.familias_que_ayude() <> 0 then
    raise exception 'FALLA 6t: con el caso oculto, quien lo recibió todavía lo ve o le cuenta';
  end if;
  reset role;
  update public.animales set oculto = false where id = toby;
  set local role authenticated;
end $$;

-- -----------------------------------------------------------------------------
-- 7. Denunciar y ocultar historias, con el sistema de siempre.
-- -----------------------------------------------------------------------------
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002601';
  x constant uuid := '00000000-0000-4000-8000-000000002606';
  m constant uuid := '00000000-0000-4000-8000-000000002607';
  toby uuid := (select animal from casos where nombre = 'toby');
  mora uuid := (select animal from casos where nombre = 'mora');
  n uuid;
begin
  -- No se denuncia la historia de un caso que no la tiene.
  perform pg_temp.como(x);
  perform pg_temp.falla(format(
    'insert into public.denuncias (animal_id, usuario_id, motivo, historia) values (%L, %L, %L, true)',
    mora, x, 'spam'), '42501', '7a');
  -- La misma persona puede denunciar el caso y su historia.
  insert into public.denuncias (animal_id, usuario_id, motivo) values (toby, x, 'spam');
  insert into public.denuncias (animal_id, usuario_id, motivo, historia) values (toby, x, 'spam', true);

  -- Tres cuentas con antigüedad la ocultan sola; el caso sigue visible.
  for n in select unnest(array['00000000-0000-4000-8000-000000002608', '00000000-0000-4000-8000-000000002609',
                               '00000000-0000-4000-8000-000000002610']::uuid[]) loop
    perform pg_temp.como(n);
    insert into public.denuncias (animal_id, usuario_id, motivo, historia)
    values (toby, n, 'contenido_inapropiado', true);
  end loop;
  reset role;
  if not (select oculta from public.historias_reencuentro where animal_id = toby)
     or (select oculto from public.animales where id = toby) then
    raise exception 'FALLA 7b: tres denuncias no ocultaron la historia, o ocultaron el caso';
  end if;
  set local role authenticated;

  -- Oculta: no sale en el muro; la familia y moderación la siguen viendo, con la marca.
  perform pg_temp.como(x);
  if exists (select 1 from public.muro_reencuentros(50) m where m.animal_id = toby)
     or exists (select 1 from public.historia_reencuentro(toby)) then
    raise exception 'FALLA 7c: una historia oculta sigue en el muro o en su link';
  end if;
  perform pg_temp.como(f);
  if not coalesce((select h.oculta from public.historia_reencuentro(toby) h), false) then
    raise exception 'FALLA 7d: la familia no ve su historia oculta con la marca';
  end if;

  -- Solo moderación la muestra u oculta.
  perform pg_temp.como(x);
  perform pg_temp.falla(format('select public.moderar_historia(%L, false)', toby), '42501', '7e');
  perform pg_temp.como(m);
  if (select count(*) from public.denuncias_detalle where animal_id = toby and historia and historia_frase is not null) <> 4 then
    raise exception 'FALLA 7f: moderación no ve las denuncias de la historia con su frase';
  end if;
  perform public.moderar_historia(toby, false);
  if not exists (select 1 from public.muro_reencuentros(50) m where m.animal_id = toby) then
    raise exception 'FALLA 7g: al mostrarla no volvió al muro';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 8. El aviso al celular del agradecimiento no se agrupa con el de "volvió".
-- -----------------------------------------------------------------------------
reset role;
-- V sigue el caso (lo vio): le llegaron "lo resguardaron", "volvió" y el
-- agradecimiento. Los dos primeros son del caso (el segundo se agrupa con el
-- primero, como siempre); el agradecimiento sale igual, con su propio grupo.
do $$
declare
  v constant uuid := '00000000-0000-4000-8000-000000002602';
  toby uuid := (select animal from casos where nombre = 'toby');
  v_salida jsonb;
begin
  v_salida := public.preparar_avisos_push(50);
  if not exists (select 1 from jsonb_array_elements(v_salida) a where a ->> 'tipo' = 'agradecimiento')
     or not exists (
       select 1 from public.avisos_push
       where usuario_id = v and estado = 'enviando' and grupo = 'caso:' || toby
     )
     or not exists (
       select 1 from public.avisos_push
       where usuario_id = v and estado = 'enviando' and grupo = 'agradecimiento:' || toby
     ) then
    raise exception 'FALLA 8a: el agradecimiento no salió aparte de los avisos del caso: %',
      (select string_agg(estado || '/' || coalesce(motivo, '-') || '/' || coalesce(grupo, '-'), ', ')
       from public.avisos_push where usuario_id = v);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 9. Borrar: la historia (con su foto), el reporte (con la foto de la historia)
--    y la cuenta (con la historia y los agradecimientos).
-- -----------------------------------------------------------------------------
set local role authenticated;
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002601';
  toby uuid := (select animal from casos where nombre = 'toby');
  v_raiz text := split_part((select ruta from fotos where nombre = 'reencuentro2'), '.', 1);
begin
  perform pg_temp.como(f);
  -- Borrar el reporte incluye la foto de la historia.
  if (select count(*) from public.fotos_del_reporte(toby) x where x like v_raiz || '%') <> 3 then
    raise exception 'FALLA 9a: fotos_del_reporte no incluye la foto de la historia';
  end if;
  -- La historia sola: primero sus fotos, después la historia.
  if (select count(*) from public.fotos_de_la_historia(toby)) <> 3 then
    raise exception 'FALLA 9b: fotos_de_la_historia no devuelve los tres archivos';
  end if;
  perform public.borrar_historia_reencuentro(toby);
  if exists (select 1 from public.historias_reencuentro where animal_id = toby) then
    raise exception 'FALLA 9c: la historia no se borró';
  end if;
  perform public.guardar_historia_reencuentro(toby, 'Volvió a casa.', true, null);
end $$;

-- Borrar la cuenta de la familia se lleva la historia y los agradecimientos.
reset role;
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002601';
  v constant uuid := '00000000-0000-4000-8000-000000002602';
begin
  if not exists (select 1 from public.historias_reencuentro where familia_id = f) then
    raise exception 'FALLA 9d: no había historia para borrar';
  end if;
  delete from auth.users where id = f;
  if exists (select 1 from public.historias_reencuentro where familia_id = f)
     or exists (select 1 from public.agradecimientos where familia_id = f) then
    raise exception 'FALLA 9e: al borrar la cuenta quedaron su historia o sus agradecimientos';
  end if;
  if exists (select 1 from public.notificaciones where usuario_id = v and tipo = 'agradecimiento') then
    raise exception 'FALLA 9f: al borrar la cuenta de la familia quedó su aviso de agradecimiento';
  end if;
end $$;

rollback;
