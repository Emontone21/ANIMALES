-- =============================================================================
-- Pruebas de la Fase 8 (gestión de casos: editar y borrar un reporte propio).
-- Requiere las migraciones 0001 a 0012. Pegalo entero en el SQL Editor y tocá Run.
-- Bien: termina en "Success. No rows returned". Mal: ERROR con "FALLA n: ..." que dice qué.
-- Todo corre dentro de begin/rollback: no deja usuarios, fotos, casos ni mensajes.
-- Nunca borra filas de storage.objects (Supabase no lo permite por SQL).
--
-- Personas: P (publica un perdido, dos encontrados y borra), O (otra persona:
-- lo ve, lo resguarda, le escribe y lo denuncia), Q (su reporte se une al
-- perdido de P y tiene otro caso abierto) y W (sigue el caso de Q y aceptó
-- una versión vieja de los términos).
-- =============================================================================
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000801', 'prueba8-p@encontrados.test', '{"nombre_publico":"Prueba Publica"}'),
  ('00000000-0000-4000-8000-000000000802', 'prueba8-o@encontrados.test', '{"nombre_publico":"Prueba Otra"}'),
  ('00000000-0000-4000-8000-000000000803', 'prueba8-q@encontrados.test', '{"nombre_publico":"Prueba Une"}'),
  ('00000000-0000-4000-8000-000000000804', 'prueba8-w@encontrados.test', '{"nombre_publico":"Prueba Vieja"}');

update public.perfiles
set terminos_version = public.version_terminos(), terminos_aceptados_en = now()
where id::text like '00000000-0000-4000-8000-0000000008%';

-- Fotos "subidas" a la carpeta de cada uno, cada una con su miniatura al lado
-- (la convención de src/lib/imagenes.ts: <foto>.miniatura.jpg), con el nombre
-- que sube la app (<uid>/<uuid>.jpg, 0023): la foto n es …-8008-00000000000n.jpg.
insert into storage.objects (bucket_id, name)
select 'fotos', u || '/00000000-0000-4000-8008-' || lpad(n::text, 12, '0') || variante
from unnest(array[
  '00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000802',
  '00000000-0000-4000-8000-000000000803', '00000000-0000-4000-8000-000000000804'
]) as u, generate_series(1, 8) as n, unnest(array['.jpg', '.miniatura.jpg']) as variante;

-- -----------------------------------------------------------------------------
-- Parte A, como el sistema: casos de prueba (las RPC toman el usuario del JWT).
-- -----------------------------------------------------------------------------
do $$
declare
  p constant uuid := '00000000-0000-4000-8000-000000000801';
  o constant uuid := '00000000-0000-4000-8000-000000000802';
  q constant uuid := '00000000-0000-4000-8000-000000000803';
  w constant uuid := '00000000-0000-4000-8000-000000000804';
  p1 uuid; e1 uuid; e2 uuid; q1 uuid; q2 uuid; w1 uuid;
  k_union uuid; k_q2 uuid; k_e1 uuid; conv uuid;
begin
  -- P: un perdido con contacto, un encontrado abierto y uno que va a cerrar.
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  p1 := public.publicar_animal('perro', p || '/00000000-0000-4000-8008-000000000001.jpg', -34.91, -56.16, now() - interval '1 day',
    'mediano', 'marrón', true, 'Tiene una mancha blanca', 'perdido', 'Toby', 'Escribinos por la app');
  e1 := public.publicar_animal('perro', p || '/00000000-0000-4000-8008-000000000002.jpg', -34.90, -56.15, now() - interval '3 hours');
  e2 := public.publicar_animal('gato', p || '/00000000-0000-4000-8008-000000000003.jpg', -34.90, -56.15, now() - interval '3 hours');
  perform public.cambiar_estado_animal(e2, 'reunido');
  update public.perfiles set avatar_path = p || '/00000000-0000-4000-8008-000000000005.jpg' where id = p;

  -- Q: un encontrado que se va a unir al perdido de P y otro caso abierto.
  perform set_config('request.jwt.claims', json_build_object('sub', q, 'role', 'authenticated')::text, true);
  q1 := public.publicar_animal('perro', q || '/00000000-0000-4000-8008-000000000001.jpg', -34.90, -56.15, now() - interval '2 hours');
  q2 := public.publicar_animal('perro', q || '/00000000-0000-4000-8008-000000000002.jpg', -34.90, -56.15, now() - interval '2 hours');

  -- O lo ve (y así lo sigue), lo resguarda con foto y contacto, le escribe a la
  -- familia y lo denuncia.
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  perform public.registrar_avistamiento(p1, o || '/00000000-0000-4000-8008-000000000001.jpg', -34.90, -56.15);
  -- También vio a Q1 antes de que se uniera: Q recibe un aviso que lleva a Q1.
  perform public.registrar_avistamiento(q1, o || '/00000000-0000-4000-8008-000000000003.jpg', -34.90, -56.15);
  perform public.cambiar_estado_animal(p1, 'resguardado', 'Contacto de O', null, null, null, o || '/00000000-0000-4000-8008-000000000002.jpg');
  conv := public.abrir_conversacion(p1, p);
  insert into public.mensajes (conversacion_id, emisor_id, cuerpo) values (conv, o, 'Lo tengo yo');
  insert into public.denuncias (animal_id, usuario_id, motivo) values (p1, o, 'spam');

  -- La familia confirma que Q1 es Toby: Q1 se une a P1 y sus avistamientos pasan a P1.
  insert into public.coincidencias (animal_origen, animal_candidato, similitud)
  values (least(p1, q1), greatest(p1, q1), 0.95)
  returning id into k_union;
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  if public.resolver_coincidencia(k_union, true) is distinct from p1 then
    raise exception 'FALLA A1: el reporte de Q no se unió al perdido de P';
  end if;

  -- P lo vuelve a ver (avisa a O, que lo sigue) y aporta a Q2.
  perform public.registrar_avistamiento(p1, p || '/00000000-0000-4000-8008-000000000006.jpg', -34.90, -56.15);
  perform public.registrar_avistamiento(p1, p || '/00000000-0000-4000-8008-000000000007.jpg', -34.90, -56.15);
  perform public.registrar_avistamiento(q2, p || '/00000000-0000-4000-8008-000000000004.jpg', -34.90, -56.15);
  -- Otra foto: desde la 0023 una foto no se usa dos veces (auditoria_2.sql).
  perform public.registrar_avistamiento(q2, p || '/00000000-0000-4000-8008-000000000008.jpg', -34.90, -56.15);

  -- Coincidencias pendientes: P1 con Q2 y E1 con Q2. W sigue solo Q2: su aviso
  -- de la primera lleva a Q2, que no se borra, pero habla de una coincidencia que sí.
  insert into public.seguimientos (usuario_id, animal_id) values (w, q2);
  insert into public.coincidencias (animal_origen, animal_candidato, similitud)
  values (least(p1, q2), greatest(p1, q2), 0.90)
  returning id into k_q2;
  insert into public.coincidencias (animal_origen, animal_candidato, similitud)
  values (least(e1, q2), greatest(e1, q2), 0.88)
  returning id into k_e1;

  -- W: un encontrado, publicado antes de que cambiaran los términos.
  perform set_config('request.jwt.claims', json_build_object('sub', w, 'role', 'authenticated')::text, true);
  w1 := public.publicar_animal('perro', w || '/00000000-0000-4000-8008-000000000001.jpg', -34.90, -56.15);

  -- Lo que se tiene que borrar con P1 existe de verdad.
  if not exists (select 1 from public.notificaciones where usuario_id = o and datos ->> 'animal_id' = p1::text)
     or not exists (select 1 from public.notificaciones where usuario_id = p and datos ->> 'conversacion_id' = conv::text)
     or not exists (select 1 from public.notificaciones where usuario_id = q and datos ->> 'animal_id' = q1::text)
     or not exists (select 1 from public.notificaciones
                    where usuario_id = w and datos ->> 'animal_id' = q2::text and datos ->> 'coincidencia_id' = k_q2::text)
     or not exists (select 1 from public.notificaciones where datos ->> 'coincidencia_id' = k_e1::text) then
    raise exception 'FALLA A2: faltan los avisos de prueba';
  end if;

  perform set_config('prueba.p1', p1::text, true);
  perform set_config('prueba.e1', e1::text, true);
  perform set_config('prueba.e2', e2::text, true);
  perform set_config('prueba.q1', q1::text, true);
  perform set_config('prueba.q2', q2::text, true);
  perform set_config('prueba.w1', w1::text, true);
  perform set_config('prueba.k_union', k_union::text, true);
  perform set_config('prueba.k_q2', k_q2::text, true);
  perform set_config('prueba.k_e1', k_e1::text, true);
  perform set_config('prueba.conv', conv::text, true);
end $$;

-- Los términos cambiaron después de que W los aceptó.
update public.perfiles set terminos_version = '1999-01-01'
where id = '00000000-0000-4000-8000-000000000804';
-- El servicio de visión ya procesó las fotos de E1.
update public.cola_vision set estado = 'hecho', intentos = 1
where avistamiento_id in (
  select id from public.avistamientos where animal_id = current_setting('prueba.e1')::uuid
);

-- -----------------------------------------------------------------------------
-- Parte B, como usuario común: editar un reporte.
-- -----------------------------------------------------------------------------
set local role authenticated;

do $$
declare
  p constant uuid := '00000000-0000-4000-8000-000000000801';
  o constant uuid := '00000000-0000-4000-8000-000000000802';
  q constant uuid := '00000000-0000-4000-8000-000000000803';
  w constant uuid := '00000000-0000-4000-8000-000000000804';
  p1 uuid := current_setting('prueba.p1')::uuid;
  e1 uuid := current_setting('prueba.e1')::uuid;
  q1 uuid := current_setting('prueba.q1')::uuid;
  w1 uuid := current_setting('prueba.w1')::uuid;
  v_antes public.animales;
  v_despues public.animales;
  v_ubicaciones text;
begin
  select * into v_antes from public.animales where id = p1;
  select string_agg(extensions.st_astext(ubicacion::extensions.geometry), ',' order by id) into v_ubicaciones
  from public.avistamientos where animal_id = p1;

  -- 1. Quien publicó corrige los datos del perdido.
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  perform public.editar_reporte(p1, 'perro', 'grande', '  marrón y negro  ', false,
    'Tiene una mancha blanca en el pecho', '  Toby  ', '  ');
  select * into v_despues from public.animales where id = p1;
  if v_despues.tamanio is distinct from 'grande' or v_despues.color is distinct from 'marrón y negro'
     or v_despues.tiene_collar or v_despues.descripcion is distinct from 'Tiene una mancha blanca en el pecho'
     or v_despues.nombre is distinct from 'Toby' or v_despues.contacto_familia is not null then
    raise exception 'FALLA 1a: el reporte no quedó como se editó (%)', row_to_json(v_despues);
  end if;
  -- El tipo, la ubicación y las fotos no cambian.
  if v_despues.tipo_reporte is distinct from v_antes.tipo_reporte
     or v_despues.foto_principal_path is distinct from v_antes.foto_principal_path
     or v_despues.estado is distinct from v_antes.estado
     or v_despues.creado_por is distinct from v_antes.creado_por
     or (select string_agg(extensions.st_astext(ubicacion::extensions.geometry), ',' order by id)
         from public.avistamientos where animal_id = p1) is distinct from v_ubicaciones then
    raise exception 'FALLA 1b: editar cambió el tipo, la foto, el estado o la ubicación';
  end if;
  perform public.editar_reporte(p1, 'perro', 'grande', 'marrón y negro', false,
    'Tiene una mancha blanca en el pecho', 'Toby', 'Escribinos por la app');

  -- 2. Otra persona no edita el reporte, aunque lo tenga resguardado.
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  begin
    perform public.editar_reporte(p1, 'gato', null, null, false, 'Editado por otro', 'Otro');
    raise exception 'FALLA 2: otra persona editó un reporte ajeno';
  exception when insufficient_privilege then
    if sqlerrm not like 'Solo quien publicó%' then
      raise exception 'FALLA 2: error inesperado al editar un reporte ajeno: %', sqlerrm;
    end if;
  end;

  -- 3. Un encontrado no lleva nombre ni contacto de la familia.
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  begin
    perform public.editar_reporte(e1, 'perro', null, null, false, null, 'Firulais');
    raise exception 'FALLA 3a: un encontrado quedó con nombre';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.editar_reporte(e1, 'perro', null, null, false, null, null, 'Mi teléfono');
    raise exception 'FALLA 3b: un encontrado quedó con contacto de la familia';
  exception when invalid_parameter_value then null;
  end;

  -- 4. Un reporte unido a otro caso ya es parte de ese caso: no se edita.
  perform set_config('request.jwt.claims', json_build_object('sub', q, 'role', 'authenticated')::text, true);
  begin
    perform public.editar_reporte(q1, 'perro', null, 'negro');
    raise exception 'FALLA 4: se editó un reporte unido a otro caso';
  exception when invalid_parameter_value then null;
  end;

  -- 5. Corregir un reporte pide los términos vigentes.
  perform set_config('request.jwt.claims', json_build_object('sub', w, 'role', 'authenticated')::text, true);
  begin
    perform public.editar_reporte(w1, 'perro', null, 'negro');
    raise exception 'FALLA 5: se editó sin aceptar los términos vigentes';
  exception when insufficient_privilege then
    if sqlerrm not like '%términos%' then
      raise exception 'FALLA 5: error inesperado al editar sin términos: %', sqlerrm;
    end if;
  end;
end $$;

-- 6. Sin cuenta no se edita, no se borra ni se piden las fotos.
set local role anon;
do $$
declare
  p1 uuid := current_setting('prueba.p1')::uuid;
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    perform public.editar_reporte(p1, 'gato');
    raise exception 'FALLA 6a: alguien sin cuenta editó un reporte';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.borrar_reporte(p1);
    raise exception 'FALLA 6b: alguien sin cuenta borró un reporte';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.fotos_del_reporte(p1);
    raise exception 'FALLA 6c: alguien sin cuenta pidió las fotos de un reporte';
  exception when insufficient_privilege then null;
  end;
end $$;
set local role authenticated;

-- 7. Cambiar algo que no es la especie no toca las coincidencias ni la cola.
do $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-4000-8000-000000000801', 'role', 'authenticated')::text, true);
  perform public.editar_reporte(current_setting('prueba.e1')::uuid, 'perro', 'chico', 'blanco');
end $$;

-- La cola y los avisos se revisan como el sistema: la app no los lee.
reset role;
do $$
declare
  e1 uuid := current_setting('prueba.e1')::uuid;
begin
  if not exists (select 1 from public.coincidencias where id = current_setting('prueba.k_e1')::uuid)
     or exists (
       select 1 from public.cola_vision c join public.avistamientos av on av.id = c.avistamiento_id
       where av.animal_id = e1 and c.estado <> 'hecho'
     ) then
    raise exception 'FALLA 7: editar el color descartó coincidencias o volvió a encolar fotos';
  end if;
end $$;

-- 8. Cambiar la especie descarta las coincidencias pendientes (y sus avisos)
-- y vuelve a encolar las fotos para buscar con la especie corregida.
set local role authenticated;
do $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-4000-8000-000000000801', 'role', 'authenticated')::text, true);
  perform public.editar_reporte(current_setting('prueba.e1')::uuid, 'gato', 'chico', 'blanco');
end $$;

reset role;
do $$
declare
  e1 uuid := current_setting('prueba.e1')::uuid;
begin
  if (select especie from public.animales where id = e1) is distinct from 'gato' then
    raise exception 'FALLA 8a: la especie no cambió';
  end if;
  if exists (select 1 from public.coincidencias where id = current_setting('prueba.k_e1')::uuid) then
    raise exception 'FALLA 8b: quedó una coincidencia buscada con la especie anterior';
  end if;
  if exists (
       select 1 from public.cola_vision c join public.avistamientos av on av.id = c.avistamiento_id
       where av.animal_id = e1 and (c.estado <> 'pendiente' or c.intentos <> 0)
     ) or not exists (
       select 1 from public.cola_vision c join public.avistamientos av on av.id = c.avistamiento_id
       where av.animal_id = e1
     ) then
    raise exception 'FALLA 8c: las fotos no volvieron a la cola de reconocimiento';
  end if;
  if exists (select 1 from public.notificaciones where datos ->> 'coincidencia_id' = current_setting('prueba.k_e1')) then
    raise exception 'FALLA 8d: quedaron avisos de una coincidencia descartada';
  end if;
end $$;
set local role authenticated;

-- -----------------------------------------------------------------------------
-- Parte C, como usuario común: borrar un reporte.
-- -----------------------------------------------------------------------------
do $$
declare
  p constant uuid := '00000000-0000-4000-8000-000000000801';
  o constant uuid := '00000000-0000-4000-8000-000000000802';
  q constant uuid := '00000000-0000-4000-8000-000000000803';
  w constant uuid := '00000000-0000-4000-8000-000000000804';
  p1 uuid := current_setting('prueba.p1')::uuid;
  e2 uuid := current_setting('prueba.e2')::uuid;
  q1 uuid := current_setting('prueba.q1')::uuid;
  w1 uuid := current_setting('prueba.w1')::uuid;
  v_fotos text[];
begin
  -- 9. Las fotos que la app tiene que borrar con P1: las de P en el caso, con
  -- sus miniaturas. No las de O ni las de Q (que vinieron con su reporte), ni
  -- la foto de perfil de P, ni lo que P aportó a Q2.
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  select array_agg(x order by x) into v_fotos from public.fotos_del_reporte(p1) as x;
  if v_fotos is distinct from array[
    p || '/00000000-0000-4000-8008-000000000001.jpg', p || '/00000000-0000-4000-8008-000000000001.miniatura.jpg', p || '/00000000-0000-4000-8008-000000000006.jpg', p || '/00000000-0000-4000-8008-000000000006.miniatura.jpg',
    p || '/00000000-0000-4000-8008-000000000007.jpg', p || '/00000000-0000-4000-8008-000000000007.miniatura.jpg'
  ] then
    raise exception 'FALLA 9: fotos_del_reporte devolvió %', v_fotos;
  end if;

  -- 10. Nadie más pide las fotos ni borra el reporte.
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  begin
    perform public.fotos_del_reporte(p1);
    raise exception 'FALLA 10a: otra persona pidió las fotos de un reporte ajeno';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.borrar_reporte(p1);
    raise exception 'FALLA 10b: otra persona borró un reporte ajeno';
  exception when insufficient_privilege then null;
  end;
  -- Q no borra su reporte unido: ya es parte del caso de P.
  perform set_config('request.jwt.claims', json_build_object('sub', q, 'role', 'authenticated')::text, true);
  begin
    perform public.borrar_reporte(q1);
    raise exception 'FALLA 10c: se borró un reporte unido a otro caso';
  exception when invalid_parameter_value then null;
  end;

  -- 11. Nadie llama a las funciones internas.
  begin
    perform public.borrar_casos(array[p1]);
    raise exception 'FALLA 11a: un usuario pudo llamar a borrar_casos';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reporte_propio(p1);
    raise exception 'FALLA 11b: un usuario pudo llamar a reporte_propio';
  exception when insufficient_privilege then null;
  end;

  -- 12. P borra su perdido.
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  perform public.borrar_reporte(p1);
  -- 13. Un caso cerrado también se borra.
  perform public.borrar_reporte(e2);
  -- 14. Borrar no pide los términos: no publica nada.
  perform set_config('request.jwt.claims', json_build_object('sub', w, 'role', 'authenticated')::text, true);
  perform public.borrar_reporte(w1);
end $$;

-- Desde acá se revisa como el sistema, que ve todas las filas.
reset role;

do $$
declare
  p constant uuid := '00000000-0000-4000-8000-000000000801';
  o constant uuid := '00000000-0000-4000-8000-000000000802';
  q constant uuid := '00000000-0000-4000-8000-000000000803';
  p1 uuid := current_setting('prueba.p1')::uuid;
  e1 uuid := current_setting('prueba.e1')::uuid;
  e2 uuid := current_setting('prueba.e2')::uuid;
  q1 uuid := current_setting('prueba.q1')::uuid;
  q2 uuid := current_setting('prueba.q2')::uuid;
  w1 uuid := current_setting('prueba.w1')::uuid;
  conv uuid := current_setting('prueba.conv')::uuid;
begin
  -- 12a. Se fueron el caso y el reporte que se le había unido.
  if exists (select 1 from public.animales where id in (p1, q1, e2, w1)) then
    raise exception 'FALLA 12a: quedó el caso borrado o un reporte unido a él';
  end if;
  -- 12b. Con todo lo que tenían, también los avistamientos de otras personas.
  if exists (select 1 from public.avistamientos where animal_id in (p1, q1))
     or exists (select 1 from public.cambios_estado where animal_id in (p1, q1))
     or exists (select 1 from public.contactos_resguardo where animal_id in (p1, q1))
     or exists (select 1 from public.seguimientos where animal_id in (p1, q1))
     or exists (select 1 from public.denuncias where animal_id in (p1, q1))
     or exists (select 1 from public.coincidencias where p1 in (animal_origen, animal_candidato))
     or exists (select 1 from public.conversaciones where id = conv)
     or exists (select 1 from public.mensajes where conversacion_id = conv) then
    raise exception 'FALLA 12b: quedaron avistamientos, historial, contactos, seguimientos, denuncias, coincidencias o mensajes del caso';
  end if;
  if exists (
    select 1 from public.cola_vision c
    where not exists (select 1 from public.avistamientos av where av.id = c.avistamiento_id)
  ) then
    raise exception 'FALLA 12c: quedó la cola de reconocimiento de avistamientos borrados';
  end if;
  -- 12d. Ningún aviso lleva al caso, a su conversación ni a sus coincidencias.
  if exists (select 1 from public.notificaciones where datos ->> 'animal_id' in (p1::text, q1::text))
     or exists (select 1 from public.notificaciones where datos ->> 'conversacion_id' = conv::text)
     or exists (select 1 from public.notificaciones
                where datos ->> 'coincidencia_id' in (current_setting('prueba.k_union'), current_setting('prueba.k_q2'))) then
    raise exception 'FALLA 12d: quedaron avisos de un caso borrado';
  end if;
  -- 12e. Lo de afuera sigue: Q2 con lo que aportó P, E1 y la cuenta de O.
  if not exists (select 1 from public.animales where id = q2)
     or (select count(*) from public.avistamientos where animal_id = q2 and usuario_id = p) <> 2
     or not exists (select 1 from public.animales where id = e1)
     or not exists (select 1 from public.perfiles where id = o) then
    raise exception 'FALLA 12e: borrar un caso tocó otros casos o cuentas';
  end if;
  -- 12f. Storage no se tocó por SQL: las fotos las borra la app.
  if (select count(*) from storage.objects where name like '00000000-0000-4000-8000-0000000008%/00000000-0000-4000-8008-%') <> 64 then
    raise exception 'FALLA 12f: cambió storage.objects';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Parte D · borrar la cuenta con miniaturas.
-- -----------------------------------------------------------------------------
set local role authenticated;

do $$
declare
  p constant uuid := '00000000-0000-4000-8000-000000000801';
  v_fotos text[];
begin
  -- 15. Si P deja lo abierto, lo que queda publicado (E1 y lo que aportó a Q2)
  -- conserva su miniatura; el resto se va con su miniatura:
  -- lo de los casos borrados y la foto de perfil.
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  select array_agg(x order by x) into v_fotos from public.fotos_para_borrar(true) as x;
  if v_fotos is distinct from array[
    p || '/00000000-0000-4000-8008-000000000001.jpg', p || '/00000000-0000-4000-8008-000000000001.miniatura.jpg', p || '/00000000-0000-4000-8008-000000000003.jpg', p || '/00000000-0000-4000-8008-000000000003.miniatura.jpg',
    p || '/00000000-0000-4000-8008-000000000005.jpg', p || '/00000000-0000-4000-8008-000000000005.miniatura.jpg', p || '/00000000-0000-4000-8008-000000000006.jpg', p || '/00000000-0000-4000-8008-000000000006.miniatura.jpg',
    p || '/00000000-0000-4000-8008-000000000007.jpg', p || '/00000000-0000-4000-8008-000000000007.miniatura.jpg'
  ] then
    raise exception 'FALLA 15: fotos_para_borrar(true) devolvió %', v_fotos;
  end if;
  if (select count(*) from public.fotos_para_borrar(false)) <> 16 then
    raise exception 'FALLA 15b: fotos_para_borrar(false) no devolvió las 16 fotos de P';
  end if;
end $$;

rollback;
