-- =============================================================================
-- Pruebas de la Fase 7 (cuenta y protección de usuarios).
-- Requiere las migraciones 0001 a 0011. Pegalo entero en el SQL Editor y tocá Run.
-- Bien: termina en "Success. No rows returned". Mal: ERROR con "FALLA n: ..." que dice qué.
-- Todo corre dentro de begin/rollback: no deja usuarios, fotos, casos ni mensajes.
-- Nunca borra filas de storage.objects (Supabase no lo permite por SQL).
--
-- Personas: F (familia), H (encontró), R (resguarda), V (vecino), N (entró con
-- Google, sin términos), W (aceptó una versión vieja), B (borra su cuenta y deja
-- lo abierto, menos su perdido, que se borra siempre), K (borra todo), D (la borran desde el panel), M (moderador),
-- tres cuentas nuevas y tres de más de 7 días para las denuncias.
-- =============================================================================
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000701', 'prueba7-f@encontrados.test',
    jsonb_build_object('nombre_publico', 'Prueba Familia', 'terminos_version', public.version_terminos())),
  ('00000000-0000-4000-8000-000000000702', 'prueba7-h@encontrados.test', '{"nombre_publico":"Prueba Hallazgo"}'),
  ('00000000-0000-4000-8000-000000000703', 'prueba7-r@encontrados.test', '{"nombre_publico":"Prueba Resguardo"}'),
  ('00000000-0000-4000-8000-000000000704', 'prueba7-v@encontrados.test', '{"nombre_publico":"Prueba Vecino"}'),
  ('00000000-0000-4000-8000-000000000705', 'prueba7-n@encontrados.test', '{"full_name":"Prueba Google"}'),
  ('00000000-0000-4000-8000-000000000706', 'prueba7-w@encontrados.test',
    '{"nombre_publico":"Prueba Vieja","terminos_version":"1999-01-01"}'),
  ('00000000-0000-4000-8000-000000000707', 'prueba7-b@encontrados.test', '{"nombre_publico":"Prueba Borra"}'),
  ('00000000-0000-4000-8000-000000000708', 'prueba7-k@encontrados.test', '{"nombre_publico":"Prueba Borra Todo"}'),
  ('00000000-0000-4000-8000-000000000709', 'prueba7-d@encontrados.test', '{"nombre_publico":"Prueba Panel"}'),
  ('00000000-0000-4000-8000-000000000710', 'prueba7-m@encontrados.test', '{"nombre_publico":"Prueba Moderador"}'),
  ('00000000-0000-4000-8000-000000000711', 'prueba7-n1@encontrados.test', '{"nombre_publico":"Prueba Nueva 1"}'),
  ('00000000-0000-4000-8000-000000000712', 'prueba7-n2@encontrados.test', '{"nombre_publico":"Prueba Nueva 2"}'),
  ('00000000-0000-4000-8000-000000000713', 'prueba7-n3@encontrados.test', '{"nombre_publico":"Prueba Nueva 3"}'),
  ('00000000-0000-4000-8000-000000000714', 'prueba7-a1@encontrados.test', '{"nombre_publico":"Prueba Antigua 1"}'),
  ('00000000-0000-4000-8000-000000000715', 'prueba7-a2@encontrados.test', '{"nombre_publico":"Prueba Antigua 2"}'),
  ('00000000-0000-4000-8000-000000000716', 'prueba7-a3@encontrados.test', '{"nombre_publico":"Prueba Antigua 3"}');

-- Aceptan los términos todos menos N y W (F los aceptó al registrarse).
update public.perfiles
set terminos_version = public.version_terminos(), terminos_aceptados_en = now()
where id::text like '00000000-0000-4000-8000-0000000007%'
  and id not in ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000705',
                 '00000000-0000-4000-8000-000000000706');
update public.perfiles set es_moderador = true where id = '00000000-0000-4000-8000-000000000710';
-- Las tres "antiguas" tienen cuenta desde hace 8 días.
update public.perfiles set created_at = now() - interval '8 days'
where id in ('00000000-0000-4000-8000-000000000714', '00000000-0000-4000-8000-000000000715',
             '00000000-0000-4000-8000-000000000716');

-- Fotos "subidas" por cada uno a su carpeta del bucket fotos.
insert into storage.objects (bucket_id, name)
select 'fotos', u || '/t7-' || n || '.jpg'
from unnest(array[
  '00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000702',
  '00000000-0000-4000-8000-000000000703', '00000000-0000-4000-8000-000000000704',
  '00000000-0000-4000-8000-000000000705', '00000000-0000-4000-8000-000000000707',
  '00000000-0000-4000-8000-000000000708', '00000000-0000-4000-8000-000000000709'
]) as u, generate_series(1, 8) as n;

-- -----------------------------------------------------------------------------
-- Parte A, como el sistema: casos de prueba (las RPC toman el usuario del JWT).
-- -----------------------------------------------------------------------------
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000000701';
  h constant uuid := '00000000-0000-4000-8000-000000000702';
  r constant uuid := '00000000-0000-4000-8000-000000000703';
  v constant uuid := '00000000-0000-4000-8000-000000000704';
  b constant uuid := '00000000-0000-4000-8000-000000000707';
  k constant uuid := '00000000-0000-4000-8000-000000000708';
  d constant uuid := '00000000-0000-4000-8000-000000000709';
  p1 uuid; p2 uuid; e7 uuid; e8 uuid; hd uuid;
  ho uuid; hc uuid; he uuid; hr uuid; hx uuid;
  b1 uuid; b2 uuid; b3 uuid; b4 uuid; k1 uuid; d1 uuid; d2 uuid; d3 uuid;
  conv uuid; coinc uuid;
begin
  -- F: dos perros perdidos.
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  p1 := public.publicar_animal('perro', f || '/t7-1.jpg', -34.91, -56.16, now() - interval '1 day',
    null, null, false, null, 'perdido', 'Toby', 'Escribinos por la app');
  p2 := public.publicar_animal('perro', f || '/t7-2.jpg', -34.91, -56.16, now() - interval '1 day',
    null, null, false, null, 'perdido', 'Luna');

  -- H: encontrados para las demás pruebas.
  perform set_config('request.jwt.claims', json_build_object('sub', h, 'role', 'authenticated')::text, true);
  ho := public.publicar_animal('perro', h || '/t7-1.jpg', -34.90, -56.15, now() - interval '5 hours');
  hc := public.publicar_animal('perro', h || '/t7-2.jpg', -34.90, -56.15, now() - interval '5 hours');
  he := public.publicar_animal('perro', h || '/t7-3.jpg', -34.90, -56.15, now() - interval '5 hours');
  hr := public.publicar_animal('perro', h || '/t7-4.jpg', -34.90, -56.15, now() - interval '5 hours');
  hx := public.publicar_animal('perro', h || '/t7-5.jpg', -34.90, -56.15, now() - interval '5 hours');
  e7 := public.publicar_animal('gato', h || '/t7-6.jpg', -34.90, -56.15, now() - interval '5 hours');
  e8 := public.publicar_animal('perro', h || '/t7-7.jpg', -34.90, -56.15, now() - interval '5 hours');
  hd := public.publicar_animal('gato', h || '/t7-8.jpg', -34.90, -56.15, now() - interval '5 hours');
  -- HE es más viejo que el reporte de B que se le va a unir.
  update public.animales set created_at = now() - interval '2 days' where id = he;

  -- B: abierto encontrado, abierto perdido con contacto, uno que se cierra y uno que se une a HE.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  b1 := public.publicar_animal('perro', b || '/t7-1.jpg', -34.90, -56.15, now() - interval '3 hours');
  b2 := public.publicar_animal('gato', b || '/t7-2.jpg', -34.90, -56.15, now() - interval '3 hours',
    null, null, false, null, 'perdido', 'Michi', 'Contacto de B');
  b3 := public.publicar_animal('perro', b || '/t7-3.jpg', -34.90, -56.15, now() - interval '3 hours');
  b4 := public.publicar_animal('perro', b || '/t7-4.jpg', -34.90, -56.15, now() - interval '3 hours');
  -- B aporta a casos de H: un avistamiento en uno abierto, otro en uno que se va a
  -- cerrar, y resguarda HR dejando su contacto.
  perform public.registrar_avistamiento(ho, b || '/t7-5.jpg', -34.90, -56.15);
  perform public.registrar_avistamiento(hc, b || '/t7-6.jpg', -34.90, -56.15);
  perform public.cambiar_estado_animal(hr, 'resguardado', 'Contacto de B');
  update public.perfiles set avatar_path = b || '/t7-7.jpg' where id = b;
  -- t7-8.jpg de B queda subida sin usar (una publicación que falló).

  -- V aporta fotos a casos de B.
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  perform public.registrar_avistamiento(b1, v || '/t7-1.jpg', -34.90, -56.15);
  perform public.registrar_avistamiento(b3, v || '/t7-2.jpg', -34.90, -56.15);
  -- V le escribe a H por HO (antes de cualquier bloqueo).
  conv := public.abrir_conversacion(ho, h);
  insert into public.mensajes (conversacion_id, emisor_id, cuerpo) values (conv, v, 'Lo vi en la plaza');

  -- R resguarda el perdido de B, con foto y contacto, y el encontrado de B, con contacto.
  perform set_config('request.jwt.claims', json_build_object('sub', r, 'role', 'authenticated')::text, true);
  perform public.cambiar_estado_animal(b2, 'resguardado', 'Contacto de R', null, null, null, r || '/t7-1.jpg');
  perform public.cambiar_estado_animal(b1, 'resguardado', 'Contacto de R en B1');

  -- B cierra B3 y le escribe a H; H cierra HC.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.cambiar_estado_animal(b3, 'reunido');
  conv := public.abrir_conversacion(ho, h);
  insert into public.mensajes (conversacion_id, emisor_id, cuerpo) values (conv, b, 'Creo que es el mío');
  perform set_config('request.jwt.claims', json_build_object('sub', h, 'role', 'authenticated')::text, true);
  perform public.cambiar_estado_animal(hc, 'reunido');

  -- B4 se une a HE (lo confirma H): el avistamiento de B pasa a HE.
  insert into public.coincidencias (animal_origen, animal_candidato, similitud)
  values (least(he, b4), greatest(he, b4), 0.95)
  returning id into coinc;
  if public.resolver_coincidencia(coinc, true) is distinct from he then
    raise exception 'FALLA A1: el reporte de B no se unió a HE';
  end if;
  -- HX, de H, está unido a B3 (cerrado): se tiene que borrar con B3.
  update public.animales set estado = 'vinculado', vinculado_a = b3 where id = hx;

  -- Lo demás que tiene B: sigue casos, bloqueó a V, denunció HD.
  insert into public.bloqueos (bloqueador_id, bloqueado_id) values (b, v);
  insert into public.denuncias (animal_id, usuario_id, motivo) values (hd, b, 'spam');

  -- K: un caso abierto con una foto de V, un avistamiento en HO y resguarda HE.
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  k1 := public.publicar_animal('perro', k || '/t7-1.jpg', -34.90, -56.15, now() - interval '2 hours');
  perform public.registrar_avistamiento(ho, k || '/t7-2.jpg', -34.90, -56.15, now() - interval '1 minute');
  perform public.cambiar_estado_animal(he, 'resguardado', 'Contacto de K');
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  perform public.registrar_avistamiento(k1, v || '/t7-3.jpg', -34.90, -56.15);

  -- D: un encontrado abierto, uno cerrado y un perdido abierto.
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  d1 := public.publicar_animal('perro', d || '/t7-1.jpg', -34.90, -56.15);
  d2 := public.publicar_animal('perro', d || '/t7-2.jpg', -34.90, -56.15);
  perform public.cambiar_estado_animal(d2, 'reunido');
  d3 := public.publicar_animal('perro', d || '/t7-3.jpg', -34.90, -56.15, now() - interval '1 day',
    null, null, false, null, 'perdido', 'Bobby');

  -- H recibió el aviso del mensaje de B (se tiene que borrar con su cuenta).
  if not exists (select 1 from public.notificaciones where usuario_id = h and actor_id = b and tipo = 'mensaje') then
    raise exception 'FALLA A2: el aviso del mensaje no guarda quién lo causó';
  end if;

  perform set_config('prueba.p1', p1::text, true);
  perform set_config('prueba.p2', p2::text, true);
  perform set_config('prueba.e7', e7::text, true);
  perform set_config('prueba.e8', e8::text, true);
  perform set_config('prueba.hd', hd::text, true);
  perform set_config('prueba.ho', ho::text, true);
  perform set_config('prueba.hc', hc::text, true);
  perform set_config('prueba.he', he::text, true);
  perform set_config('prueba.hr', hr::text, true);
  perform set_config('prueba.hx', hx::text, true);
  perform set_config('prueba.b1', b1::text, true);
  perform set_config('prueba.b2', b2::text, true);
  perform set_config('prueba.b3', b3::text, true);
  perform set_config('prueba.b4', b4::text, true);
  perform set_config('prueba.k1', k1::text, true);
  perform set_config('prueba.d1', d1::text, true);
  perform set_config('prueba.d2', d2::text, true);
  perform set_config('prueba.d3', d3::text, true);
end $$;

-- -----------------------------------------------------------------------------
-- Parte B, como usuario común: términos, perfil, bloqueos y resguardos.
-- -----------------------------------------------------------------------------
set local role authenticated;

do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000000701';
  h constant uuid := '00000000-0000-4000-8000-000000000702';
  r constant uuid := '00000000-0000-4000-8000-000000000703';
  v constant uuid := '00000000-0000-4000-8000-000000000704';
  n constant uuid := '00000000-0000-4000-8000-000000000705';
  w constant uuid := '00000000-0000-4000-8000-000000000706';
  p1 uuid := current_setting('prueba.p1')::uuid;
  p2 uuid := current_setting('prueba.p2')::uuid;
  e7 uuid := current_setting('prueba.e7')::uuid;
  e8 uuid := current_setting('prueba.e8')::uuid;
  ho uuid := current_setting('prueba.ho')::uuid;
  v_conv uuid;
  v_texto text;
  v_n int;
  v_version text;
begin
  -- 1. Al registrarse con email queda guardada la versión aceptada; con Google
  -- o con una versión que no es la vigente, no.
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  select version into v_version from public.mis_terminos();
  if v_version is null or (select aceptados_en from public.mis_terminos()) is null then
    raise exception 'FALLA 1a: el registro con la casilla no guardó la versión aceptada';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', n, 'role', 'authenticated')::text, true);
  if (select version from public.mis_terminos()) is not null then
    raise exception 'FALLA 1b: una cuenta de Google quedó con los términos aceptados';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', w, 'role', 'authenticated')::text, true);
  if (select version from public.mis_terminos()) is not null then
    raise exception 'FALLA 1c: se aceptó una versión que no es la vigente';
  end if;

  -- 2. Sin aceptar los términos no se publica, no se escribe y no se denuncia.
  perform set_config('request.jwt.claims', json_build_object('sub', n, 'role', 'authenticated')::text, true);
  begin
    perform public.publicar_animal('perro', n || '/t7-1.jpg', -34.9, -56.16);
    raise exception 'FALLA 2a: se publicó sin aceptar los términos';
  exception when insufficient_privilege then
    if sqlerrm not like '%términos%' then raise; end if;
  end;
  begin
    perform public.registrar_avistamiento(ho, n || '/t7-2.jpg', -34.9, -56.16);
    raise exception 'FALLA 2b: se avisó que lo vio sin aceptar los términos';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.abrir_conversacion(ho, h);
    raise exception 'FALLA 2c: se abrió una conversación sin aceptar los términos';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.denuncias (animal_id, usuario_id, motivo) values (ho, n, 'spam');
    raise exception 'FALLA 2d: se denunció sin aceptar los términos';
  exception when insufficient_privilege then null;
  end;

  -- 3. Aceptar una versión que no es la vigente falla; la vigente, sí.
  begin
    perform public.aceptar_terminos('1999-01-01');
    raise exception 'FALLA 3a: se aceptó una versión que no es la vigente';
  exception when invalid_parameter_value then null;
  end;
  perform public.aceptar_terminos(v_version);
  if (select version from public.mis_terminos()) is distinct from v_version then
    raise exception 'FALLA 3b: aceptar_terminos no guardó la versión';
  end if;
  perform public.publicar_animal('perro', n || '/t7-1.jpg', -34.9, -56.16);

  -- 4. Nadie lee los datos de términos de otros por la API, ni se los cambia a mano.
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  begin
    select terminos_version into v_texto from public.perfiles where id = f;
    raise exception 'FALLA 4a: se pudo leer terminos_version de otra persona';
  exception when insufficient_privilege then null;
  end;
  select nombre_publico into v_texto from public.perfiles where id = f;
  if v_texto is distinct from 'Prueba Familia' then
    raise exception 'FALLA 4b: el nombre público dejó de leerse';
  end if;
  begin
    update public.perfiles set terminos_version = '2099-01-01' where id = v;
    raise exception 'FALLA 4c: se pudo cambiar terminos_version a mano';
  exception when insufficient_privilege then null;
  end;

  -- 5. Editar el perfil: el nombre se guarda sin espacios de más y tiene de 2 a 40.
  update public.perfiles set nombre_publico = '  Vecina Ana  ' where id = v;
  if (select nombre_publico from public.perfiles where id = v) <> 'Vecina Ana' then
    raise exception 'FALLA 5a: el nombre no se guardó sin espacios';
  end if;
  begin
    update public.perfiles set nombre_publico = ' A ' where id = v;
    raise exception 'FALLA 5b: se guardó un nombre de un solo carácter';
  exception when check_violation then null;
  end;

  -- 6. La foto de perfil solo puede ser una foto propia subida a la app.
  begin
    update public.perfiles set avatar_path = 'https://example.com/yo.jpg' where id = v;
    raise exception 'FALLA 6a: se guardó una URL externa como foto de perfil';
  exception when invalid_parameter_value then null;
  end;
  begin
    update public.perfiles set avatar_path = h || '/t7-1.jpg' where id = v;
    raise exception 'FALLA 6b: se guardó la foto de otra persona como foto de perfil';
  exception when invalid_parameter_value then null;
  end;
  update public.perfiles set avatar_path = v || '/t7-4.jpg' where id = v;
  update public.perfiles set avatar_path = null where id = v;

  -- 7. Bloquear: H bloquea a V. V no ve el bloqueo de H ni lo puede borrar, y no
  -- puede bloquear en nombre de otro.
  perform set_config('request.jwt.claims', json_build_object('sub', h, 'role', 'authenticated')::text, true);
  insert into public.bloqueos (bloqueador_id, bloqueado_id) values (h, v);
  if (select count(*) from public.bloqueos_detalle where bloqueado_id = v) <> 1 then
    raise exception 'FALLA 7a: quien bloquea no ve su bloqueo';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  if exists (select 1 from public.bloqueos where bloqueador_id = h) then
    raise exception 'FALLA 7b: quien está bloqueado ve el bloqueo de otro';
  end if;
  delete from public.bloqueos where bloqueador_id = h;
  get diagnostics v_n = row_count;
  if v_n <> 0 then
    raise exception 'FALLA 7c: quien está bloqueado borró el bloqueo';
  end if;
  begin
    insert into public.bloqueos (bloqueador_id, bloqueado_id) values (h, r);
    raise exception 'FALLA 7d: se creó un bloqueo en nombre de otro';
  exception when insufficient_privilege then null;
  end;

  -- 8. Quien está bloqueado no abre conversaciones ni manda mensajes; quien
  -- bloquea, tampoco, hasta desbloquear.
  begin
    perform public.abrir_conversacion(ho, h);
    raise exception 'FALLA 8a: quien está bloqueado abrió una conversación';
  exception when insufficient_privilege then null;
  end;
  select id into v_conv from public.conversaciones_detalle where otro_id = h;
  if v_conv is null then
    raise exception 'FALLA 8b: quien está bloqueado dejó de ver la conversación';
  end if;
  begin
    insert into public.mensajes (conversacion_id, emisor_id, cuerpo) values (v_conv, v, 'Hola de nuevo');
    raise exception 'FALLA 8c: quien está bloqueado mandó un mensaje';
  exception when insufficient_privilege then null;
  end;
  if not (select bloqueada and not bloqueaste from public.conversaciones_detalle where id = v_conv) then
    raise exception 'FALLA 8d: la conversación no muestra el bloqueo a quien está bloqueado';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', h, 'role', 'authenticated')::text, true);
  begin
    insert into public.mensajes (conversacion_id, emisor_id, cuerpo) values (v_conv, h, 'Hola');
    raise exception 'FALLA 8e: quien bloqueó mandó un mensaje sin desbloquear';
  exception when insufficient_privilege then null;
  end;
  if not (select bloqueada and bloqueaste from public.conversaciones_detalle where id = v_conv) then
    raise exception 'FALLA 8f: la conversación no le muestra a quien bloqueó que bloqueó';
  end if;

  -- 9. Quien bloquea no recibe avisos de esa persona; los demás, sí.
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  perform public.registrar_avistamiento(ho, v || '/t7-5.jpg', -34.9, -56.16);
  perform set_config('request.jwt.claims', json_build_object('sub', h, 'role', 'authenticated')::text, true);
  if exists (
    select 1 from public.notificaciones where usuario_id = h and actor_id = v and tipo = 'avistamiento'
  ) then
    raise exception 'FALLA 9a: quien bloqueó recibió un aviso de la persona bloqueada';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000000708', 'role', 'authenticated')::text, true);
  if not exists (select 1 from public.notificaciones where actor_id = v and tipo = 'avistamiento') then
    raise exception 'FALLA 9b: quien no bloqueó dejó de recibir el aviso';
  end if;

  -- 10. Al desbloquear, se puede volver a escribir.
  perform set_config('request.jwt.claims', json_build_object('sub', h, 'role', 'authenticated')::text, true);
  delete from public.bloqueos where bloqueador_id = h and bloqueado_id = v;
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  insert into public.mensajes (conversacion_id, emisor_id, cuerpo) values (v_conv, v, 'Gracias');

  -- 11. Resguardar un perdido pide una foto actual subida desde la app.
  perform set_config('request.jwt.claims', json_build_object('sub', r, 'role', 'authenticated')::text, true);
  begin
    perform public.cambiar_estado_animal(p1, 'resguardado', 'Contacto de R');
    raise exception 'FALLA 11a: se resguardó un perdido sin foto';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.cambiar_estado_animal(p1, 'resguardado', 'Contacto de R', null, null, null, v || '/t7-6.jpg');
    raise exception 'FALLA 11b: se resguardó un perdido con la foto de otra persona';
  exception when invalid_parameter_value then null;
  end;
  perform public.cambiar_estado_animal(p1, 'resguardado', 'Contacto de R', 'Está bien', null, null, r || '/t7-2.jpg');
  if not exists (
    select 1 from public.avistamientos_detalle
    where animal_id = p1 and tipo = 'resguardado' and foto_path = r || '/t7-2.jpg'
  ) then
    raise exception 'FALLA 11c: la foto del resguardo no quedó como avistamiento';
  end if;

  -- 12. En un perdido, el contacto de quien lo resguarda lo ven solo la familia y esa persona.
  if (select contacto_compartido from public.cambios_estado_detalle
      where animal_id = p1 and estado_nuevo = 'resguardado') is distinct from 'Contacto de R' then
    raise exception 'FALLA 12a: quien resguarda no ve su propio contacto';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  if (select contacto_compartido from public.cambios_estado_detalle
      where animal_id = p1 and estado_nuevo = 'resguardado') is distinct from 'Contacto de R' then
    raise exception 'FALLA 12b: la familia no ve el contacto de quien lo resguarda';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  if (select contacto_compartido from public.cambios_estado_detalle
      where animal_id = p1 and estado_nuevo = 'resguardado') is not null
     or exists (select 1 from public.contactos_resguardo where animal_id = p1) then
    raise exception 'FALLA 12c: un tercero ve el contacto de quien resguarda un perdido';
  end if;
  begin
    execute 'select contacto_compartido from public.cambios_estado limit 1';
    raise exception 'FALLA 12d: cambios_estado todavía expone contacto_compartido';
  exception when undefined_column then null;
  end;

  -- 13. En un encontrado el contacto sigue siendo público.
  perform set_config('request.jwt.claims', json_build_object('sub', r, 'role', 'authenticated')::text, true);
  perform public.cambiar_estado_animal(e7, 'resguardado', 'Contacto de R en E7');
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  if (select contacto_compartido from public.cambios_estado_detalle
      where animal_id = e7 and estado_nuevo = 'resguardado') is distinct from 'Contacto de R en E7' then
    raise exception 'FALLA 13: el contacto de un encontrado dejó de ser público';
  end if;

  -- 14. Un encontrado resguardado vuelve a avistado solo por quien lo resguarda o quien lo publicó.
  begin
    perform public.cambiar_estado_animal(e7, 'avistado');
    raise exception 'FALLA 14a: un tercero dijo que se volvió a escapar un encontrado resguardado';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', r, 'role', 'authenticated')::text, true);
  perform public.cambiar_estado_animal(e7, 'avistado');
  perform public.cambiar_estado_animal(e7, 'resguardado');
  perform set_config('request.jwt.claims', json_build_object('sub', h, 'role', 'authenticated')::text, true);
  perform public.cambiar_estado_animal(e7, 'avistado');

  -- 15. Un encontrado unido a un perdido: su contacto pasa a ser solo para la
  -- familia, quien lo resguarda y quien lo publicó.
  perform set_config('request.jwt.claims', json_build_object('sub', r, 'role', 'authenticated')::text, true);
  perform public.cambiar_estado_animal(e8, 'resguardado', 'Contacto de R en E8');
end $$;

-- La coincidencia entre E8 y el perdido P2 la crea el sistema.
reset role;
insert into public.coincidencias (animal_origen, animal_candidato, similitud)
select least(current_setting('prueba.p2')::uuid, current_setting('prueba.e8')::uuid),
       greatest(current_setting('prueba.p2')::uuid, current_setting('prueba.e8')::uuid), 0.93;
set local role authenticated;

do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000000701';
  h constant uuid := '00000000-0000-4000-8000-000000000702';
  r constant uuid := '00000000-0000-4000-8000-000000000703';
  v constant uuid := '00000000-0000-4000-8000-000000000704';
  p2 uuid := current_setting('prueba.p2')::uuid;
  e8 uuid := current_setting('prueba.e8')::uuid;
  v_coinc uuid;
begin
  select id into v_coinc from public.coincidencias
  where animal_origen = least(p2, e8) and animal_candidato = greatest(p2, e8);
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  perform public.resolver_coincidencia(v_coinc, true);
  -- La familia ve el contacto que heredó su perdido.
  if (select contacto_compartido from public.cambios_estado_detalle
      where animal_id = p2 and estado_nuevo = 'resguardado') is distinct from 'Contacto de R en E8' then
    raise exception 'FALLA 15a: la familia no ve el contacto heredado';
  end if;
  -- Un tercero no ve ni el heredado ni el del encontrado unido.
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  if exists (
    select 1 from public.cambios_estado_detalle
    where animal_id in (p2, e8) and contacto_compartido is not null
  ) then
    raise exception 'FALLA 15b: un tercero ve el contacto de un encontrado unido a un perdido';
  end if;
  -- Quien lo publicó sí.
  perform set_config('request.jwt.claims', json_build_object('sub', h, 'role', 'authenticated')::text, true);
  if not exists (
    select 1 from public.cambios_estado_detalle where animal_id = e8 and contacto_compartido is not null
  ) then
    raise exception 'FALLA 15c: quien publicó el encontrado dejó de ver su contacto';
  end if;
end $$;

-- 16. Sin cuenta no se ve el contacto de un perdido; el de un encontrado, sí.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  if exists (
    select 1 from public.cambios_estado_detalle
    where animal_id = current_setting('prueba.p1')::uuid and contacto_compartido is not null
  ) then
    raise exception 'FALLA 16a: sin cuenta se ve el contacto de quien resguarda un perdido';
  end if;
  if not exists (
    select 1 from public.cambios_estado_detalle
    where animal_id = current_setting('prueba.e7')::uuid and contacto_compartido is not null
  ) then
    raise exception 'FALLA 16b: sin cuenta dejó de verse el contacto de un encontrado';
  end if;
  begin
    perform public.borrar_mi_cuenta(true);
    raise exception 'FALLA 16c: sin cuenta se pudo llamar a borrar_mi_cuenta';
  exception when insufficient_privilege then null;
  end;
end $$;
set local role authenticated;

-- -----------------------------------------------------------------------------
-- Parte C · denuncias: para ocultar solo cuentan las de cuentas de 7 días o más.
-- -----------------------------------------------------------------------------
do $$
declare
  hd uuid := current_setting('prueba.hd')::uuid;
  v_uid uuid;
  v_i int := 0;
begin
  -- 17. Tres cuentas nuevas no alcanzan (B ya había denunciado, también es nueva).
  foreach v_uid in array array[
    '00000000-0000-4000-8000-000000000711', '00000000-0000-4000-8000-000000000712',
    '00000000-0000-4000-8000-000000000713'
  ]::uuid[] loop
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
    insert into public.denuncias (animal_id, usuario_id, motivo) values (hd, v_uid, 'informacion_falsa');
  end loop;
  if (select oculto from public.animales where id = hd) then
    raise exception 'FALLA 17: tres cuentas nuevas ocultaron una publicación';
  end if;

  -- 18. Con tres cuentas de más de 7 días, se oculta (y no antes).
  foreach v_uid in array array[
    '00000000-0000-4000-8000-000000000714', '00000000-0000-4000-8000-000000000715',
    '00000000-0000-4000-8000-000000000716'
  ]::uuid[] loop
    v_i := v_i + 1;
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
    insert into public.denuncias (animal_id, usuario_id, motivo) values (hd, v_uid, 'spam');
    if v_i < 3 and (select oculto from public.animales where id = hd) then
      raise exception 'FALLA 18a: se ocultó con % denuncias de cuentas antiguas', v_i;
    end if;
  end loop;
  if not (select oculto from public.animales where id = hd) then
    raise exception 'FALLA 18b: tres cuentas antiguas no ocultaron la publicación';
  end if;

  -- 19. Los moderadores siguen viendo todas, con las de cuentas nuevas marcadas.
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000000710', 'role', 'authenticated')::text, true);
  if (select count(*) from public.denuncias_detalle where animal_id = hd) <> 7
     or (select count(*) from public.denuncias_detalle where animal_id = hd and cuenta_nueva) <> 4 then
    raise exception 'FALLA 19: el moderador no ve todas las denuncias con su marca de cuenta nueva';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Parte D · borrar la cuenta.
-- -----------------------------------------------------------------------------
do $$
declare
  b constant uuid := '00000000-0000-4000-8000-000000000707';
  k constant uuid := '00000000-0000-4000-8000-000000000708';
  v_fotos text[];
begin
  -- 20. Fotos a borrar si B deja lo abierto: la de su perdido (se borra igual),
  -- la de su caso cerrado, la de su avistamiento en un caso cerrado, su foto de
  -- perfil y la que quedó sin usar.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select array_agg(x order by x) into v_fotos from public.fotos_para_borrar(true) as x;
  if v_fotos is distinct from array[
    b || '/t7-2.jpg', b || '/t7-3.jpg', b || '/t7-6.jpg', b || '/t7-7.jpg', b || '/t7-8.jpg'
  ] then
    raise exception 'FALLA 20a: fotos_para_borrar(true) devolvió %', v_fotos;
  end if;
  -- Si borra todo, son todas las de su carpeta.
  if (select count(*) from public.fotos_para_borrar(false)) <> 8 then
    raise exception 'FALLA 20b: fotos_para_borrar(false) no devolvió las 8 fotos de B';
  end if;

  -- 21. Nadie puede llamar a la limpieza interna ni borrar otra cuenta.
  begin
    perform public.limpiar_cuenta(k, false);
    raise exception 'FALLA 21: un usuario pudo llamar a limpiar_cuenta';
  exception when insufficient_privilege then null;
  end;

  -- B borra su cuenta dejando lo abierto; K la borra con todo.
  perform public.borrar_mi_cuenta(true);
  perform set_config('request.jwt.claims', json_build_object('sub', k, 'role', 'authenticated')::text, true);
  perform public.borrar_mi_cuenta(false);
end $$;

-- Desde acá se revisa como el sistema, que ve todas las filas.
reset role;

do $$
declare
  b constant uuid := '00000000-0000-4000-8000-000000000707';
  k constant uuid := '00000000-0000-4000-8000-000000000708';
  d constant uuid := '00000000-0000-4000-8000-000000000709';
  h constant uuid := '00000000-0000-4000-8000-000000000702';
  r constant uuid := '00000000-0000-4000-8000-000000000703';
  ho uuid := current_setting('prueba.ho')::uuid;
  hc uuid := current_setting('prueba.hc')::uuid;
  he uuid := current_setting('prueba.he')::uuid;
  hr uuid := current_setting('prueba.hr')::uuid;
  hx uuid := current_setting('prueba.hx')::uuid;
  b1 uuid := current_setting('prueba.b1')::uuid;
  b2 uuid := current_setting('prueba.b2')::uuid;
  b3 uuid := current_setting('prueba.b3')::uuid;
  b4 uuid := current_setting('prueba.b4')::uuid;
  k1 uuid := current_setting('prueba.k1')::uuid;
  d1 uuid := current_setting('prueba.d1')::uuid;
  d2 uuid := current_setting('prueba.d2')::uuid;
  d3 uuid := current_setting('prueba.d3')::uuid;
  v_quien uuid;
begin
  -- 22. La cuenta y el perfil ya no existen.
  if exists (select 1 from auth.users where id in (b, k))
     or exists (select 1 from public.perfiles where id in (b, k)) then
    raise exception 'FALLA 22: la cuenta o el perfil siguen existiendo';
  end if;

  -- 23. Ninguna fila queda a nombre de B o de K.
  foreach v_quien in array array[b, k] loop
    if exists (select 1 from public.animales where creado_por = v_quien)
       or exists (select 1 from public.avistamientos where usuario_id = v_quien)
       or exists (select 1 from public.cambios_estado where usuario_id = v_quien)
       or exists (select 1 from public.contactos_resguardo where usuario_id = v_quien)
       or exists (select 1 from public.seguimientos where usuario_id = v_quien)
       or exists (select 1 from public.denuncias where usuario_id = v_quien)
       or exists (select 1 from public.notificaciones where usuario_id = v_quien or actor_id = v_quien)
       or exists (select 1 from public.push_tokens where usuario_id = v_quien)
       or exists (select 1 from public.conversaciones where v_quien in (participante_a, participante_b))
       or exists (select 1 from public.mensajes where emisor_id = v_quien)
       or exists (select 1 from public.bloqueos where v_quien in (bloqueador_id, bloqueado_id))
       or exists (select 1 from public.coincidencias where resuelta_por = v_quien) then
      raise exception 'FALLA 23: quedaron datos a nombre de %', v_quien;
    end if;
  end loop;

  -- 24. B dejó lo abierto: su encontrado abierto sigue, sin autor.
  if not exists (select 1 from public.animales where id = b1 and creado_por is null) then
    raise exception 'FALLA 24a: el encontrado abierto de B no quedó publicado sin autor';
  end if;
  -- Su perdido abierto se borró igual, con su contacto_familia y lo que tenía
  -- adentro: sin familia nadie lo podría cerrar ni confirmar.
  if exists (select 1 from public.animales where id = b2)
     or exists (select 1 from public.avistamientos where animal_id = b2)
     or exists (select 1 from public.contactos_resguardo where animal_id = b2) then
    raise exception 'FALLA 24b: el perdido de B no se borró aunque eligió dejar lo abierto';
  end if;
  if not exists (select 1 from public.animales_detalle where id = b1 and creador_nombre is null)
     or not exists (select 1 from public.animales_mapa where id = b1) then
    raise exception 'FALLA 24c: el caso anónimo no se ve en el detalle o en el mapa';
  end if;
  -- El contacto de R en el encontrado de B es de R: sigue.
  if not exists (select 1 from public.contactos_resguardo where animal_id = b1 and usuario_id = r) then
    raise exception 'FALLA 24d: se borró el contacto de otra persona';
  end if;
  -- Su reporte unido a un caso abierto sigue, sin autor.
  if not exists (select 1 from public.animales where id = b4 and creado_por is null and vinculado_a = he) then
    raise exception 'FALLA 24e: el reporte de B unido a un caso abierto no quedó sin autor';
  end if;
  -- Su avistamiento en un caso abierto de otro sigue, sin autor.
  if not exists (
    select 1 from public.avistamientos
    where animal_id = ho and foto_path = b || '/t7-5.jpg' and usuario_id is null
  ) then
    raise exception 'FALLA 24f: el avistamiento de B en un caso abierto no quedó sin autor';
  end if;
  -- Su resguardo de HR sigue en el historial, sin autor y sin su contacto.
  if not exists (
    select 1 from public.cambios_estado
    where animal_id = hr and estado_nuevo = 'resguardado' and usuario_id is null
  ) or exists (select 1 from public.contactos_resguardo where animal_id = hr) then
    raise exception 'FALLA 24g: el resguardo de B no quedó sin autor o su contacto no se borró';
  end if;

  -- 25. Lo cerrado de B se borró: su caso cerrado, el reporte de otro unido a él
  -- y su avistamiento en un caso cerrado de otro.
  if exists (select 1 from public.animales where id in (b3, hx)) then
    raise exception 'FALLA 25a: el caso cerrado de B o el reporte unido a él siguen';
  end if;
  if exists (select 1 from public.avistamientos where foto_path = b || '/t7-6.jpg') then
    raise exception 'FALLA 25b: el avistamiento de B en un caso cerrado sigue';
  end if;
  if (select ultimo_avistamiento_en from public.animales where id = hc)
     is distinct from (select max(visto_en) from public.avistamientos where animal_id = hc) then
    raise exception 'FALLA 25c: no se recalculó el último avistamiento del caso cerrado';
  end if;

  -- 26. K borró todo: su caso abierto (con la foto de V), su avistamiento y su resguardo.
  if exists (select 1 from public.animales where id = k1) then
    raise exception 'FALLA 26a: el caso abierto de K sigue';
  end if;
  if exists (select 1 from public.avistamientos where foto_path like k || '/%') then
    raise exception 'FALLA 26b: quedó un avistamiento de K';
  end if;
  if exists (select 1 from public.cambios_estado where animal_id = he and estado_nuevo = 'resguardado') then
    raise exception 'FALLA 26c: el resguardo de K sigue';
  end if;
  if (select ultimo_avistamiento_en from public.animales where id = ho)
     is distinct from (select max(visto_en) from public.avistamientos where animal_id = ho) then
    raise exception 'FALLA 26d: no se recalculó el último avistamiento de HO';
  end if;

  -- 27. Las fotos no se borran por SQL: las borra la app con la API de Storage.
  if (select count(*) from storage.objects where name like b || '/%') <> 8
     or (select count(*) from storage.objects where name like k || '/%') <> 8 then
    raise exception 'FALLA 27: se borraron filas de storage.objects por SQL';
  end if;

  -- 28. Borrar desde el panel aplica la opción por defecto: deja el encontrado
  -- abierto y borra el cerrado y el perdido.
  delete from auth.users where id = d;
  if not exists (select 1 from public.animales where id = d1 and creado_por is null)
     or exists (select 1 from public.animales where id in (d2, d3)) then
    raise exception 'FALLA 28a: borrar desde el panel no dejó lo abierto o no borró lo cerrado y el perdido';
  end if;
  -- No queda ningún perdido sin familia.
  if exists (select 1 from public.animales where tipo_reporte = 'perdido' and creado_por is null) then
    raise exception 'FALLA 28b: quedó un perdido sin familia';
  end if;

  -- Coincidencia con un caso anónimo, para la parte E.
  insert into public.coincidencias (animal_origen, animal_candidato, similitud)
  values (least(b1, ho), greatest(b1, ho), 0.9);
end $$;

-- -----------------------------------------------------------------------------
-- Parte E · casos anónimos: nadie pasa por encima de las reglas.
-- -----------------------------------------------------------------------------
set local role authenticated;

do $$
declare
  h constant uuid := '00000000-0000-4000-8000-000000000702';
  v constant uuid := '00000000-0000-4000-8000-000000000704';
  ho uuid := current_setting('prueba.ho')::uuid;
  b1 uuid := current_setting('prueba.b1')::uuid;
  k_enc uuid;
begin
  select id into k_enc from public.coincidencias where animal_origen = least(b1, ho) and animal_candidato = greatest(b1, ho);

  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  -- 29. Se puede avisar que lo vieron (sin autor no hay a quién avisar, y no falla).
  perform public.registrar_avistamiento(b1, v || '/t7-7.jpg', -34.9, -56.16);
  -- 30. Un tercero no cierra un caso anónimo.
  begin
    perform public.cambiar_estado_animal(b1, 'reunido');
    raise exception 'FALLA 30: un tercero cerró un encontrado anónimo';
  exception when insufficient_privilege then null;
  end;
  -- 31. Ni confirma una coincidencia con un caso anónimo.
  begin
    perform public.resolver_coincidencia(k_enc, false);
    raise exception 'FALLA 31: un tercero resolvió una coincidencia con un encontrado anónimo';
  exception when insufficient_privilege then null;
  end;
  -- Quien publicó el otro sí.
  perform set_config('request.jwt.claims', json_build_object('sub', h, 'role', 'authenticated')::text, true);
  perform public.resolver_coincidencia(k_enc, false);
end $$;

rollback;
