-- =============================================================================
-- Pruebas de "Reportar un error" (0015 y 0016).
-- Requiere las migraciones 0001 a 0016. Pegalo entero en el SQL Editor y tocá Run.
-- Bien: termina en "Success. No rows returned". Mal: ERROR con "FALLA n: ..." que dice qué.
-- Todo corre dentro de begin/rollback: no deja usuarios, reportes, avisos ni capturas.
-- Nunca borra filas de storage.objects (Supabase no lo permite por SQL).
--
-- Personas:
--   · A y B tienen cuenta. A sube una captura.
--   · M y N son moderadores. N bloqueó a A.
--   · D manda un reporte con captura y después borra su cuenta.
--   · Las personas sin cuenta usan el rol anon.
-- =============================================================================
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000e01', 'prueba-err-a@encontrados.test', '{"nombre_publico":"Prueba Reporta"}'),
  ('00000000-0000-4000-8000-000000000e02', 'prueba-err-b@encontrados.test', '{"nombre_publico":"Prueba Otra"}'),
  ('00000000-0000-4000-8000-000000000e03', 'prueba-err-m@encontrados.test', '{"nombre_publico":"Prueba Modera"}'),
  ('00000000-0000-4000-8000-000000000e04', 'prueba-err-n@encontrados.test', '{"nombre_publico":"Prueba Modera Dos"}'),
  ('00000000-0000-4000-8000-000000000e05', 'prueba-err-d@encontrados.test', '{"nombre_publico":"Prueba Borra"}');

update public.perfiles set es_moderador = true
where id in ('00000000-0000-4000-8000-000000000e03', '00000000-0000-4000-8000-000000000e04');
insert into public.bloqueos (bloqueador_id, bloqueado_id)
values ('00000000-0000-4000-8000-000000000e04', '00000000-0000-4000-8000-000000000e01');

-- Capturas subidas (en Supabase, por la API de Storage) y una foto del bucket público.
insert into storage.objects (bucket_id, name) values
  ('capturas', '00000000-0000-4000-8000-000000000e01/err-1.jpg'),
  ('capturas', '00000000-0000-4000-8000-000000000e01/err-huerfana.jpg'),
  ('capturas', '00000000-0000-4000-8000-000000000e05/err-1.jpg'),
  ('fotos', '00000000-0000-4000-8000-000000000e01/err-foto.jpg');

-- Que ningún reporte anterior a la prueba cuente para los topes de la última hora.
update public.reportes_errores set created_at = created_at - interval '1 hour'
where created_at > now() - interval '1 hour';

-- -----------------------------------------------------------------------------
-- 1. Qué se valida al mandar un reporte con cuenta.
-- -----------------------------------------------------------------------------
set local role authenticated;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000e01';
  d constant uuid := '00000000-0000-4000-8000-000000000e05';
  r uuid;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  begin
    perform public.reportar_error('   corto   ');
    raise exception 'FALLA 1a: se aceptó un "qué pasó" de menos de 10 caracteres';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.reportar_error(repeat('x', 1001));
    raise exception 'FALLA 1b: se aceptó un "qué pasó" de más de 1000 caracteres';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.reportar_error('No carga el mapa', repeat('x', 1001));
    raise exception 'FALLA 1c: se aceptó un "qué estabas haciendo" de más de 1000 caracteres';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.reportar_error('No carga el mapa', null, 'mi@correo.com');
    raise exception 'FALLA 1d: se guardó un contacto en un reporte con cuenta';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.reportar_error('No carga el mapa', null, null, a || '/no-existe.jpg');
    raise exception 'FALLA 1e: se aceptó una captura que no existe';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reportar_error('No carga el mapa', null, null, d || '/err-1.jpg');
    raise exception 'FALLA 1f: se aceptó la captura de otra persona';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reportar_error('No carga el mapa', null, null, a || '/err-foto.jpg');
    raise exception 'FALLA 1g: se aceptó una foto del bucket público como captura';
  exception when insufficient_privilege then null;
  end;

  -- Con todo bien: se guarda limpio, y lo que suma la app se recorta en vez de fallar.
  r := public.reportar_error(
    '  No carga el mapa en Perfil  ', '  Volvía de un caso  ', null, a || '/err-1.jpg',
    '/animal/123', repeat('n', 600), '390×844 @3x', 'otra', 'abc1234');
  perform set_config('pruebas.reporte_a', r::text, true);
end $$;
reset role;

-- Se mira como sistema: quien lo mandó no lo puede leer (punto 7).
do $$
declare
  fila public.reportes_errores;
begin
  select * into fila from public.reportes_errores where id = current_setting('pruebas.reporte_a')::uuid;
  if fila.que_paso <> 'No carga el mapa en Perfil' or fila.que_hacias <> 'Volvía de un caso' then
    raise exception 'FALLA 1h: los textos no se guardaron sin espacios de más';
  end if;
  if fila.usuario_id is distinct from '00000000-0000-4000-8000-000000000e01' or fila.sin_cuenta
     or fila.captura_path <> '00000000-0000-4000-8000-000000000e01/err-1.jpg' then
    raise exception 'FALLA 1i: no quedó como reporte de A con su captura';
  end if;
  if char_length(fila.navegador) <> 500 or fila.plataforma is not null
     or fila.pantalla_anterior <> '/animal/123' or fila.version_app <> 'abc1234' then
    raise exception 'FALLA 1j: los datos de la app no se guardaron recortados';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Sin cuenta: contacto opcional, nunca captura.
-- -----------------------------------------------------------------------------
set local role anon;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000e01';
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    perform public.reportar_error('No puedo ingresar', null, null, a || '/err-huerfana.jpg');
    raise exception 'FALLA 2a: sin cuenta se mandó una captura';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reportar_error('No puedo ingresar', null, repeat('c', 201));
    raise exception 'FALLA 2b: se aceptó un contacto de más de 200 caracteres';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;

-- -----------------------------------------------------------------------------
-- 3. Una persona sin cuenta no ve nada: ni la tabla, ni la vista, ni las capturas.
-- -----------------------------------------------------------------------------
set local role anon;
do $$
declare
  n int;
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    perform count(*) from public.reportes_errores;
    raise exception 'FALLA 3a: sin cuenta se leyó la tabla de reportes';
  exception when insufficient_privilege then null;
  end;
  begin
    perform count(*) from public.reportes_errores_detalle;
    raise exception 'FALLA 3b: sin cuenta se leyó la vista de reportes';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from storage.objects where bucket_id = 'capturas';
  if n <> 0 then
    raise exception 'FALLA 3c: sin cuenta se ven % capturas', n;
  end if;
  begin
    perform public.resolver_reporte_error(gen_random_uuid());
    raise exception 'FALLA 3d: sin cuenta se pudo llamar a resolver';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.reportes_errores (sin_cuenta, que_paso) values (true, 'Lo escribo a mano');
    raise exception 'FALLA 3e: sin cuenta se insertó un reporte a mano';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('capturas', 'anon/err.jpg');
    raise exception 'FALLA 3f: sin cuenta se subió una captura';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- -----------------------------------------------------------------------------
-- 4. Límite por cuenta: 5 por hora. A ya mandó 1 (punto 1).
-- -----------------------------------------------------------------------------
set local role authenticated;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000e01';
  b constant uuid := '00000000-0000-4000-8000-000000000e02';
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  for i in 2..5 loop
    perform public.reportar_error('Reporte de prueba número ' || i);
  end loop;
  begin
    perform public.reportar_error('Reporte de prueba número 6');
    raise exception 'FALLA 4a: se aceptó el sexto reporte de la hora';
  exception when raise_exception then
    if sqlerrm not like '%5 reportes en la última hora%' then raise; end if;
  end;
  -- Otra cuenta no se ve afectada.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.reportar_error('A B le pasa otra cosa');
end $$;
reset role;

-- Una hora después, A puede volver a mandar.
update public.reportes_errores set created_at = now() - interval '61 minutes'
where usuario_id = '00000000-0000-4000-8000-000000000e01';
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000000e01', 'role', 'authenticated')::text, true);
  perform public.reportar_error('Pasó una hora y vuelvo a reportar');
exception when raise_exception then
  raise exception 'FALLA 4b: los reportes de hace más de una hora siguen contando';
end $$;
reset role;

-- -----------------------------------------------------------------------------
-- 5. D manda un reporte con captura y borra su cuenta: el reporte queda sin
-- autor y sin captura, y no cuenta como "sin cuenta" para el tope.
-- -----------------------------------------------------------------------------
set local role authenticated;
do $$
declare
  d constant uuid := '00000000-0000-4000-8000-000000000e05';
  r uuid;
  capturas text[];
begin
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  r := public.reportar_error('No anda el botón de compartir', null, null, d || '/err-1.jpg');
  perform set_config('pruebas.reporte_d', r::text, true);
  -- Lo que la app borra con la API de Storage antes de borrar la cuenta.
  select array_agg(c) into capturas from public.capturas_para_borrar() c;
  if capturas is distinct from array[d || '/err-1.jpg'] then
    raise exception 'FALLA 5a: capturas_para_borrar devolvió %', capturas;
  end if;
  perform public.borrar_mi_cuenta();
end $$;
reset role;

do $$
declare
  fila public.reportes_errores;
begin
  select * into fila from public.reportes_errores where id = current_setting('pruebas.reporte_d')::uuid;
  if not found then
    raise exception 'FALLA 5b: el reporte se borró con la cuenta';
  end if;
  if fila.usuario_id is not null or fila.captura_path is not null then
    raise exception 'FALLA 5c: el reporte quedó con autor o con la ruta de la captura';
  end if;
  if fila.sin_cuenta then
    raise exception 'FALLA 5d: el reporte de una cuenta borrada pasó a contar como sin cuenta';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 6. Tope global sin cuenta (acá, 3 por hora). El reporte de D no cuenta.
-- -----------------------------------------------------------------------------
update public.config_app set valor = '3' where clave = 'errores_por_hora_sin_cuenta';
set local role anon;
do $$
declare
  r uuid;
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  r := public.reportar_error('  No puedo registrarme  ', null, '  099 000 000  ', null,
    '/auth/registrarse', 'Mozilla/5.0 (iPhone)', '375×667', 'web', '2026-10-20');
  perform set_config('pruebas.reporte_anon', r::text, true);
  perform public.reportar_error('Segundo reporte sin cuenta');
  perform public.reportar_error('Tercer reporte sin cuenta');
  begin
    perform public.reportar_error('Cuarto reporte sin cuenta');
    raise exception 'FALLA 6a: se pasó el tope de reportes sin cuenta';
  exception when raise_exception then
    if sqlerrm not like '%sin cuenta en la última hora%' then raise; end if;
  end;
end $$;
reset role;

-- Con cuenta se sigue pudiendo, aunque se llenó el tope de los anónimos.
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000000e02', 'role', 'authenticated')::text, true);
  perform public.reportar_error('Con cuenta sigo pudiendo');
exception when raise_exception then
  raise exception 'FALLA 6b: el tope sin cuenta frenó a una persona con cuenta';
end $$;
reset role;

do $$
declare
  fila public.reportes_errores;
begin
  select * into fila from public.reportes_errores where id = current_setting('pruebas.reporte_anon')::uuid;
  if fila.usuario_id is not null or not fila.sin_cuenta or fila.contacto <> '099 000 000'
     or fila.plataforma <> 'web' or fila.que_paso <> 'No puedo registrarme' then
    raise exception 'FALLA 6c: el reporte sin cuenta no se guardó como se esperaba';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 7. Quién lee: solo moderación. Tampoco quien lo mandó, ni a mano.
-- -----------------------------------------------------------------------------
do $$ begin
  perform set_config('pruebas.total', (select count(*) from public.reportes_errores)::text, true);
end $$;
set local role authenticated;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000e01';
  b constant uuid := '00000000-0000-4000-8000-000000000e02';
  m constant uuid := '00000000-0000-4000-8000-000000000e03';
  n int;
  total int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.reportes_errores;
  if n <> 0 then raise exception 'FALLA 7a: quien reportó ve % reportes', n; end if;
  select count(*) into n from public.reportes_errores_detalle;
  if n <> 0 then raise exception 'FALLA 7b: quien reportó ve % reportes en la vista', n; end if;
  begin
    insert into public.reportes_errores (usuario_id, sin_cuenta, que_paso) values (a, false, 'Lo escribo a mano');
    raise exception 'FALLA 7c: se insertó un reporte sin pasar por reportar_error';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.reportes_errores_detalle;
  if n <> 0 then raise exception 'FALLA 7d: otra cuenta ve % reportes', n; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  select count(*) into n from public.reportes_errores_detalle where usuario_nombre = 'Prueba Reporta';
  if n <> 6 then raise exception 'FALLA 7e: moderación ve % reportes de A con su nombre (se esperaban 6)', n; end if;
  select count(*) into total from public.reportes_errores_detalle;
  if total <> current_setting('pruebas.total')::int then
    raise exception 'FALLA 7f: moderación ve % de % reportes', total, current_setting('pruebas.total');
  end if;
  begin
    update public.reportes_errores set resuelto_en = now() where usuario_id = a;
    raise exception 'FALLA 7g: moderación resolvió a mano, sin la RPC';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- -----------------------------------------------------------------------------
-- 8. Capturas: las ve quien la subió y moderación; nadie más. Nadie sube a una
-- carpeta ajena. El bucket es privado. (Acá no se sube nada como usuario: en
-- Supabase las subidas pasan por la API de Storage.)
-- -----------------------------------------------------------------------------
do $$ begin
  if (select public from storage.buckets where id = 'capturas') is distinct from false then
    raise exception 'FALLA 8a: el bucket de capturas no es privado';
  end if;
end $$;

set local role authenticated;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000e01';
  b constant uuid := '00000000-0000-4000-8000-000000000e02';
  m constant uuid := '00000000-0000-4000-8000-000000000e03';
  n int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from storage.objects where bucket_id = 'capturas';
  if n <> 2 then raise exception 'FALLA 8b: A ve % capturas (se esperaban sus 2)', n; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from storage.objects where bucket_id = 'capturas';
  if n <> 0 then raise exception 'FALLA 8c: otra cuenta ve % capturas', n; end if;
  begin
    insert into storage.objects (bucket_id, name) values ('capturas', a || '/de-b.jpg');
    raise exception 'FALLA 8d: se subió una captura a la carpeta de otra persona';
  exception when insufficient_privilege then null;
  end;

  -- Las de A y la de D, que borró su cuenta (en Supabase la borra la app, con la API).
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  select count(*) into n from storage.objects where bucket_id = 'capturas';
  if n < 3 then raise exception 'FALLA 8e: moderación ve % capturas (se esperaban todas)', n; end if;
end $$;
reset role;

-- -----------------------------------------------------------------------------
-- 9. Avisos a moderación: cada reporte nuevo le llega a cada moderador, menos
-- a quien bloqueó a quien lo mandó (N bloqueó a A).
-- -----------------------------------------------------------------------------
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000e01';
  m constant uuid := '00000000-0000-4000-8000-000000000e03';
  nn constant uuid := '00000000-0000-4000-8000-000000000e04';
  n int;
begin
  select count(*) into n from public.notificaciones
  where usuario_id = m and tipo = 'error' and (datos ->> 'moderacion')::boolean
    and datos ? 'reporte_error_id';
  -- 6 de A, 2 de B y 3 sin cuenta. El de D se borró con su cuenta, como todo
  -- aviso que causó alguien que borra la cuenta.
  if n <> 11 then raise exception 'FALLA 9a: M recibió % avisos de reportes (se esperaban 11)', n; end if;
  select count(*) into n from public.notificaciones where usuario_id = nn and tipo = 'error' and actor_id = a;
  if n <> 0 then raise exception 'FALLA 9b: N recibió % avisos de A, a quien bloqueó', n; end if;
  select count(*) into n from public.notificaciones
  where usuario_id = nn and tipo = 'error' and actor_id = '00000000-0000-4000-8000-000000000e02';
  if n <> 2 then raise exception 'FALLA 9c: N recibió % avisos de B (se esperaban 2)', n; end if;
  select count(*) into n from public.notificaciones where usuario_id = a and tipo = 'error';
  if n <> 0 then raise exception 'FALLA 9d: quien reportó recibió un aviso de su propio reporte'; end if;
end $$;

-- Un moderador que reporta no se avisa a sí mismo; al otro moderador, sí.
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000000e03', 'role', 'authenticated')::text, true);
  perform public.reportar_error('Un moderador también reporta');
end $$;
reset role;
do $$
declare
  r uuid := (select id from public.reportes_errores where que_paso = 'Un moderador también reporta');
begin
  if exists (select 1 from public.notificaciones where usuario_id = '00000000-0000-4000-8000-000000000e03' and datos ->> 'reporte_error_id' = r::text) then
    raise exception 'FALLA 9e: el moderador recibió el aviso de su propio reporte';
  end if;
  if not exists (select 1 from public.notificaciones where usuario_id = '00000000-0000-4000-8000-000000000e04' and datos ->> 'reporte_error_id' = r::text) then
    raise exception 'FALLA 9f: el otro moderador no recibió el aviso';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 10. Quién resuelve: solo moderación, una vez, y quien reportó con su cuenta
-- recibe un aviso (aunque haya bloqueado a quien resolvió).
-- -----------------------------------------------------------------------------
insert into public.bloqueos (bloqueador_id, bloqueado_id)
values ('00000000-0000-4000-8000-000000000e01', '00000000-0000-4000-8000-000000000e03');
set local role authenticated;
do $$
declare
  a constant uuid := '00000000-0000-4000-8000-000000000e01';
  m constant uuid := '00000000-0000-4000-8000-000000000e03';
  r uuid;
  r_anon uuid := current_setting('pruebas.reporte_anon')::uuid;
  fila public.reportes_errores;
  aviso public.notificaciones;
begin
  -- A no puede leer su reporte, pero lo resuelve moderación: se busca como sistema.
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  select id into r from public.reportes_errores where que_paso = 'No carga el mapa en Perfil';

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  begin
    perform public.resolver_reporte_error(r, 'Me lo resuelvo yo');
    raise exception 'FALLA 10a: quien no es moderador resolvió un reporte';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  begin
    perform public.resolver_reporte_error(r, repeat('x', 1001));
    raise exception 'FALLA 10b: se aceptó una nota de más de 1000 caracteres';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.resolver_reporte_error(gen_random_uuid());
    raise exception 'FALLA 10c: se resolvió un reporte que no existe';
  exception when no_data_found then null;
  end;
  perform public.resolver_reporte_error(r, '  Ya anda: era la conexión  ');
  select * into fila from public.reportes_errores where id = r;
  if fila.resuelto_en is null or fila.resuelto_por is distinct from m
     or fila.nota_resolucion <> 'Ya anda: era la conexión' then
    raise exception 'FALLA 10d: el reporte no quedó resuelto con la nota';
  end if;
  begin
    perform public.resolver_reporte_error(r);
    raise exception 'FALLA 10e: se resolvió dos veces el mismo reporte';
  exception when invalid_parameter_value then null;
  end;
  -- Un reporte sin cuenta se resuelve sin avisarle a nadie.
  perform public.resolver_reporte_error(r_anon);

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select * into aviso from public.notificaciones
  where usuario_id = a and tipo = 'error' and datos ->> 'reporte_error_id' = r::text;
  if not found or aviso.cuerpo <> 'Ya anda: era la conexión' or aviso.actor_id is not null
     or aviso.datos ? 'moderacion' then
    raise exception 'FALLA 10f: quien reportó no recibió el aviso de que se resolvió, con la nota';
  end if;
end $$;
reset role;

rollback;
