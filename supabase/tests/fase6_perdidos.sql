-- =============================================================================
-- Pruebas de la Fase 6 (perdidos).
-- Requiere las migraciones 0001 a 0011. Pegalo entero en el SQL Editor y tocá Run.
-- Bien: termina en "Success. No rows returned". Mal: ERROR con "FALLA n: ..." que dice qué.
-- Todo corre dentro de begin/rollback: no deja usuarios, fotos, animales ni notificaciones.
-- Adaptado a la 0011: las personas de prueba aceptaron los términos, resguardar
-- un perdido pide una foto y el contacto de quien resguarda vive en
-- contactos_resguardo (se lee por cambios_estado_detalle).
-- =============================================================================
begin;

-- Personas de prueba: F (familia), O (otra familia y vecino), H (quien encontró),
-- R (quien resguarda) y M (moderador).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000f1', 'prueba-f@encontrados.test', '{"nombre_publico":"Prueba Familia"}'),
  ('00000000-0000-4000-8000-0000000000f2', 'prueba-o@encontrados.test', '{"nombre_publico":"Prueba Otro"}'),
  ('00000000-0000-4000-8000-0000000000f3', 'prueba-h@encontrados.test', '{"nombre_publico":"Prueba Hallazgo"}'),
  ('00000000-0000-4000-8000-0000000000f4', 'prueba-r@encontrados.test', '{"nombre_publico":"Prueba Resguardo"}'),
  ('00000000-0000-4000-8000-0000000000f5', 'prueba-m@encontrados.test', '{"nombre_publico":"Prueba Moderador"}');
update public.perfiles set es_moderador = true where id = '00000000-0000-4000-8000-0000000000f5';
update public.perfiles
set terminos_version = public.version_terminos(), terminos_aceptados_en = now()
where id::text like '00000000-0000-4000-8000-0000000000f_';

-- Fotos "subidas" por cada uno a su carpeta del bucket fotos.
insert into storage.objects (bucket_id, name) values
  ('fotos', '00000000-0000-4000-8000-0000000000f1/prueba-1.jpg'),
  ('fotos', '00000000-0000-4000-8000-0000000000f2/prueba-2.jpg'),
  ('fotos', '00000000-0000-4000-8000-0000000000f3/prueba-3.jpg'),
  ('fotos', '00000000-0000-4000-8000-0000000000f4/prueba-4.jpg');

-- Parte A, como el sistema: publicar, validar fotos, redondear la ubicación y
-- sugerir coincidencias con guardar_embedding (lo que hace el servicio de visión).
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-0000000000f1';
  o constant uuid := '00000000-0000-4000-8000-0000000000f2';
  h constant uuid := '00000000-0000-4000-8000-0000000000f3';
  r constant uuid := '00000000-0000-4000-8000-0000000000f4';
  foto_f constant text := '00000000-0000-4000-8000-0000000000f1/prueba-1.jpg';
  foto_o constant text := '00000000-0000-4000-8000-0000000000f2/prueba-2.jpg';
  foto_h constant text := '00000000-0000-4000-8000-0000000000f3/prueba-3.jpg';
  foto_r constant text := '00000000-0000-4000-8000-0000000000f4/prueba-4.jpg';
  v_emb extensions.vector := array_fill(0.05::real, array[384])::extensions.vector;
  p1 uuid; p2 uuid; ev uuid; eb uuid; en uuid; g1 uuid; g2 uuid; g3 uuid; p3 uuid; e7 uuid; e8 uuid;
  v_lat double precision;
  v_lng double precision;
  v_n int;
  v_av uuid;
begin
  -- Como F: publica a Toby, perdido hace 2 días, con una ubicación precisa.
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  p1 := public.publicar_animal('perro', foto_f, -34.91512, -56.16789, now() - interval '2 days',
    'mediano', 'marrón', true, 'Collar rojo', 'perdido', 'Toby', 'Escribinos por la app');

  -- 1. En un perdido la ubicación se guarda redondeada a 3 decimales.
  select lat, lng into v_lat, v_lng from public.avistamientos_detalle where animal_id = p1;
  if round(v_lat::numeric, 6) <> -34.915 or round(v_lng::numeric, 6) <> -56.168 then
    raise exception 'FALLA 1: la ubicación del perdido no se redondeó (% , %)', v_lat, v_lng;
  end if;
  if (select tipo::text from public.avistamientos where animal_id = p1) <> 'perdido' then
    raise exception 'FALLA 1b: el primer avistamiento de un perdido no es de tipo perdido';
  end if;
  if (select tipo_reporte::text || nombre || contacto_familia from public.animales_detalle where id = p1)
     <> 'perdidoTobyEscribinos por la app' then
    raise exception 'FALLA 1c: animales_detalle no expone tipo_reporte, nombre o contacto_familia';
  end if;

  -- 2. Las RPC solo aceptan fotos subidas por el usuario a su carpeta.
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  begin
    perform public.publicar_animal('perro', foto_f, -34.9, -56.16);
    raise exception 'FALLA 2a: se pudo publicar con la foto de otra persona';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.publicar_animal('perro', 'https://example.com/perro.jpg', -34.9, -56.16);
    raise exception 'FALLA 2b: se pudo publicar con una URL externa';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.publicar_animal('perro', o::text || '/no-subida.jpg', -34.9, -56.16);
    raise exception 'FALLA 2c: se pudo publicar con una foto que no está en el bucket';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.registrar_avistamiento(p1, 'https://example.com/perro.jpg', -34.9, -56.16);
    raise exception 'FALLA 2d: se pudo avisar que lo vio con una URL externa';
  exception when invalid_parameter_value then null;
  end;

  -- O también perdió un perro, hace 1 día y sin nombre.
  p2 := public.publicar_animal('perro', foto_o, -34.913, -56.166, now() - interval '1 day',
    null, null, false, null, 'perdido');

  -- Como H: tres perros encontrados. EV visto hace 5 días (3 días antes de que se perdiera Toby),
  -- EB hace 60 horas (12 horas antes) y EN hace una hora.
  perform set_config('request.jwt.claims', json_build_object('sub', h, 'role', 'authenticated')::text, true);
  ev := public.publicar_animal('perro', foto_h, -34.9160, -56.1690, now() - interval '5 days');
  eb := public.publicar_animal('perro', foto_h, -34.9140, -56.1670, now() - interval '60 hours');
  en := public.publicar_animal('perro', foto_h, -34.9155, -56.1685, now() - interval '1 hour');
  g1 := public.publicar_animal('gato', foto_h, -34.9120, -56.1510, now() - interval '3 hours');
  e7 := public.publicar_animal('otro', foto_h, -34.8800, -56.2500, now() - interval '3 hours');
  e8 := public.publicar_animal('otro', foto_h, -34.8800, -56.2500, now() - interval '3 hours');

  -- 3. Quien encuentra no puede cargar un contacto de familia.
  if (select contacto_familia from public.animales where id = en) is not null then
    raise exception 'FALLA 3: un encontrado guardó contacto_familia';
  end if;

  -- Como R: dos gatos encontrados cerca del de H.
  perform set_config('request.jwt.claims', json_build_object('sub', r, 'role', 'authenticated')::text, true);
  g2 := public.publicar_animal('gato', foto_r, -34.9121, -56.1511, now() - interval '2 hours');
  g3 := public.publicar_animal('gato', foto_r, -34.9122, -56.1512, now() - interval '1 hour');

  -- Como F: Luna, perdida, para las pruebas de cierre.
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  p3 := public.publicar_animal('otro', foto_f, -34.8800, -56.2500, now() - interval '1 day',
    null, null, false, null, 'perdido', 'Luna');

  -- Para probar quién queda como principal: EN y G2 son los reportes más viejos.
  update public.animales set created_at = now() - interval '10 days' where id = en;
  update public.animales set created_at = now() - interval '3 days' where id = g2;

  -- El servicio de visión procesa las fotos (mismo embedding: todas se parecen al 100 %).
  foreach v_av in array array(
    select av.id from public.avistamientos av
    where av.animal_id in (p1, p2, ev, eb, en, g1, g2, g3)
    order by av.created_at, av.visto_en
  ) loop
    perform public.guardar_embedding(v_av, v_emb);
  end loop;

  -- 4. Nunca se sugiere perdido con perdido.
  if exists (select 1 from public.coincidencias where animal_origen = least(p1, p2) and animal_candidato = greatest(p1, p2)) then
    raise exception 'FALLA 4: se sugirió un perdido con otro perdido';
  end if;
  -- 5. Un encontrado visto solo más de 1 día antes de la pérdida no se sugiere.
  if exists (select 1 from public.coincidencias where animal_origen = least(p1, ev) and animal_candidato = greatest(p1, ev))
     or exists (select 1 from public.coincidencias where animal_origen = least(p2, ev) and animal_candidato = greatest(p2, ev))
     or exists (select 1 from public.coincidencias where animal_origen = least(p2, eb) and animal_candidato = greatest(p2, eb)) then
    raise exception 'FALLA 5: se sugirió un encontrado visto más de 1 día antes de la pérdida';
  end if;
  -- 6. Sí se sugieren: dentro del día de tolerancia, después de la pérdida y entre encontrados.
  select count(*) into v_n from public.coincidencias
  where (animal_origen, animal_candidato) in (
    (least(p1, eb), greatest(p1, eb)), (least(p1, en), greatest(p1, en)),
    (least(p2, en), greatest(p2, en)), (least(ev, en), greatest(ev, en)),
    (least(g1, g2), greatest(g1, g2)), (least(g2, g3), greatest(g2, g3))
  );
  if v_n <> 6 then
    raise exception 'FALLA 6: faltan coincidencias esperadas (hay % de 6)', v_n;
  end if;

  -- 7. La familia recibe el aviso con el nombre; sin nombre, "al tuyo".
  if not exists (
    select 1 from public.notificaciones
    where usuario_id = f and titulo = 'Encontraron un animal parecido a Toby'
  ) then
    raise exception 'FALLA 7a: la familia de Toby no recibió el aviso con su nombre';
  end if;
  if not exists (
    select 1 from public.notificaciones
    where usuario_id = o and titulo = 'Encontraron un animal parecido al tuyo'
  ) then
    raise exception 'FALLA 7b: la familia sin nombre no recibió su aviso';
  end if;

  -- Ids para las partes B y C, que corren como usuario común.
  perform set_config('prueba.p1', p1::text, true);
  perform set_config('prueba.eb', eb::text, true);
  perform set_config('prueba.en', en::text, true);
  perform set_config('prueba.g1', g1::text, true);
  perform set_config('prueba.g2', g2::text, true);
  perform set_config('prueba.g3', g3::text, true);
  perform set_config('prueba.p3', p3::text, true);
  perform set_config('prueba.e7', e7::text, true);
  perform set_config('prueba.e8', e8::text, true);
end $$;

-- Desde acá, todo corre como usuario común (authenticated), igual que desde la app.
set local role authenticated;

do $$
declare
  f constant uuid := '00000000-0000-4000-8000-0000000000f1';
  o constant uuid := '00000000-0000-4000-8000-0000000000f2';
  h constant uuid := '00000000-0000-4000-8000-0000000000f3';
  r constant uuid := '00000000-0000-4000-8000-0000000000f4';
  m constant uuid := '00000000-0000-4000-8000-0000000000f5';
  p1 uuid := current_setting('prueba.p1')::uuid;
  en uuid := current_setting('prueba.en')::uuid;
  g1 uuid := current_setting('prueba.g1')::uuid;
  g2 uuid := current_setting('prueba.g2')::uuid;
  g3 uuid := current_setting('prueba.g3')::uuid;
  p3 uuid := current_setting('prueba.p3')::uuid;
  e7 uuid := current_setting('prueba.e7')::uuid;
  e8 uuid := current_setting('prueba.e8')::uuid;
  k_toby uuid;
  k_gatos uuid;
  k_otro uuid;
  v_principal uuid;
begin
  select id into k_toby from public.coincidencias
  where animal_origen = least(p1, en) and animal_candidato = greatest(p1, en);
  select id into k_gatos from public.coincidencias
  where animal_origen = least(g1, g2) and animal_candidato = greatest(g1, g2);
  select id into k_otro from public.coincidencias
  where animal_origen = least(g2, g3) and animal_candidato = greatest(g2, g3);

  -- Parte B · coincidencias con un perdido: solo decide su familia.
  -- 8. Quien encontró el otro animal no puede confirmar.
  perform set_config('request.jwt.claims', json_build_object('sub', h, 'role', 'authenticated')::text, true);
  begin
    perform public.resolver_coincidencia(k_toby, true);
    raise exception 'FALLA 8: quien encontró pudo confirmar una coincidencia con un perdido';
  exception when insufficient_privilege then null;
  end;
  -- 9. Un moderador tampoco.
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  begin
    perform public.resolver_coincidencia(k_toby, true);
    raise exception 'FALLA 9: un moderador pudo confirmar una coincidencia con un perdido';
  exception when insufficient_privilege then null;
  end;
  -- 10. Ni un tercero puede rechazarla.
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  begin
    perform public.resolver_coincidencia(k_toby, false);
    raise exception 'FALLA 10: un tercero pudo rechazar una coincidencia con un perdido';
  exception when insufficient_privilege then null;
  end;

  -- R tiene a salvo al perro encontrado (cualquiera puede resguardarlo).
  perform set_config('request.jwt.claims', json_build_object('sub', r, 'role', 'authenticated')::text, true);
  perform public.cambiar_estado_animal(en, 'resguardado', 'Contacto de prueba', null);

  -- 11. La familia confirma: Toby queda como principal aunque el encontrado sea más viejo,
  -- y pasa a resguardado con el contacto de quien lo tiene.
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  v_principal := public.resolver_coincidencia(k_toby, true);
  if v_principal is distinct from p1 then
    raise exception 'FALLA 11a: el principal no es el perdido';
  end if;
  if (select vinculado_a from public.animales where id = en) is distinct from p1 then
    raise exception 'FALLA 11b: el encontrado no quedó vinculado al perdido';
  end if;
  if (select estado::text from public.animales where id = p1) <> 'resguardado'
     or not exists (
       select 1 from public.cambios_estado_detalle
       where animal_id = p1 and estado_nuevo = 'resguardado' and usuario_id = r
         and contacto_compartido = 'Contacto de prueba'
     ) then
    raise exception 'FALLA 11c: el perdido no pasó a resguardado con el contacto de quien lo tiene';
  end if;

  -- Parte B · coincidencias entre encontrados: quien publicó cualquiera de los dos o un moderador.
  -- 12. Un tercero no puede confirmar.
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  begin
    perform public.resolver_coincidencia(k_gatos, true);
    raise exception 'FALLA 12: un tercero pudo confirmar una coincidencia entre encontrados';
  exception when insufficient_privilege then null;
  end;
  -- 13. Quien publicó uno de los dos confirma; queda como principal el más viejo.
  perform set_config('request.jwt.claims', json_build_object('sub', h, 'role', 'authenticated')::text, true);
  v_principal := public.resolver_coincidencia(k_gatos, true);
  if v_principal is distinct from g2 then
    raise exception 'FALLA 13: entre encontrados el principal no es el más viejo';
  end if;
  -- 14. Un tercero no puede rechazar; un moderador sí.
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  begin
    perform public.resolver_coincidencia(k_otro, false);
    raise exception 'FALLA 14a: un tercero pudo rechazar una coincidencia entre encontrados';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  perform public.resolver_coincidencia(k_otro, false);
  if (select estado::text from public.coincidencias where id = k_otro) <> 'rechazada' then
    raise exception 'FALLA 14b: el moderador no pudo rechazar';
  end if;

  -- Parte C · cerrar un perdido: solo su familia lo marca como reunido o lo reabre.
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  -- 15. Un tercero no puede marcarlo como reunido.
  begin
    perform public.cambiar_estado_animal(p3, 'reunido');
    raise exception 'FALLA 15: un tercero marcó como reunido un perdido';
  exception when insufficient_privilege then null;
  end;
  -- 16. Pero sí puede avisar que lo tiene resguardado (con una foto actual, desde la 0011).
  perform public.cambiar_estado_animal(p3, 'resguardado', 'Lo tengo en casa', null, null, null,
    '00000000-0000-4000-8000-0000000000f2/prueba-2.jpg');
  -- 17. Ni siquiera quien lo resguarda puede decir que se volvió a escapar o que volvió a casa.
  begin
    perform public.cambiar_estado_animal(p3, 'avistado');
    raise exception 'FALLA 17a: un tercero reabrió un perdido';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.cambiar_estado_animal(p3, 'reunido');
    raise exception 'FALLA 17b: quien lo resguarda marcó como reunido un perdido';
  exception when insufficient_privilege then null;
  end;
  -- 18. La familia sí lo marca como reunido, y solo ella lo reabre.
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  perform public.cambiar_estado_animal(p3, 'reunido');
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  begin
    perform public.cambiar_estado_animal(p3, 'avistado');
    raise exception 'FALLA 18a: un tercero reabrió un perdido reunido';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  perform public.cambiar_estado_animal(p3, 'avistado');

  -- Parte C · cerrar un encontrado: quien lo publicó o quien lo tiene resguardado.
  -- 19. Un tercero no puede marcarlo como reunido.
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  begin
    perform public.cambiar_estado_animal(e7, 'reunido');
    raise exception 'FALLA 19: un tercero marcó como reunido un encontrado';
  exception when insufficient_privilege then null;
  end;
  -- 20. R lo resguarda; un tercero sigue sin poder cerrarlo, R sí.
  perform set_config('request.jwt.claims', json_build_object('sub', r, 'role', 'authenticated')::text, true);
  perform public.cambiar_estado_animal(e7, 'resguardado');
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  begin
    perform public.cambiar_estado_animal(e7, 'reunido');
    raise exception 'FALLA 20a: un tercero marcó como reunido un encontrado resguardado';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', r, 'role', 'authenticated')::text, true);
  perform public.cambiar_estado_animal(e7, 'reunido');
  -- 21. Quien lo publicó también puede cerrarlo.
  perform set_config('request.jwt.claims', json_build_object('sub', h, 'role', 'authenticated')::text, true);
  perform public.cambiar_estado_animal(e8, 'reunido');
end $$;

rollback;
