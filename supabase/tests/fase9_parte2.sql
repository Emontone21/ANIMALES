-- =============================================================================
-- Pruebas de la Fase 9, parte 2: casos ocultos y conversaciones con quien lo vio.
-- Requiere las migraciones 0001 a 0014. Pegalo entero en el SQL Editor y tocá Run.
-- Bien: termina en "Success. No rows returned". Mal: ERROR con "FALLA n: ..." que dice qué.
-- Todo corre dentro de begin/rollback: no deja usuarios, fotos, casos ni mensajes.
-- Nunca borra filas de storage.objects (Supabase no lo permite por SQL).
--
-- Personas:
--   · F publica un perdido (P) y bloquea a B.
--   · X publica un encontrado (E) que se une a P.
--   · V, B y D vieron a P; D después borra su cuenta. W vio a E antes de la unión.
--   · Z no tiene nada que ver con P; resguarda el caso oculto.
--   · Q publica un perdido (H) que se oculta por moderación.
--   · M es moderador.
-- =============================================================================
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000a01', 'prueba10-f@encontrados.test', '{"nombre_publico":"Prueba Familia"}'),
  ('00000000-0000-4000-8000-000000000a02', 'prueba10-x@encontrados.test', '{"nombre_publico":"Prueba Encuentra"}'),
  ('00000000-0000-4000-8000-000000000a03', 'prueba10-v@encontrados.test', '{"nombre_publico":"Prueba Vecina"}'),
  ('00000000-0000-4000-8000-000000000a04', 'prueba10-w@encontrados.test', '{"nombre_publico":"Prueba Vio"}'),
  ('00000000-0000-4000-8000-000000000a05', 'prueba10-b@encontrados.test', '{"nombre_publico":"Prueba Bloqueada"}'),
  ('00000000-0000-4000-8000-000000000a06', 'prueba10-d@encontrados.test', '{"nombre_publico":"Prueba Borra"}'),
  ('00000000-0000-4000-8000-000000000a07', 'prueba10-z@encontrados.test', '{"nombre_publico":"Prueba Tercera"}'),
  ('00000000-0000-4000-8000-000000000a08', 'prueba10-q@encontrados.test', '{"nombre_publico":"Prueba Oculto"}'),
  ('00000000-0000-4000-8000-000000000a09', 'prueba10-m@encontrados.test', '{"nombre_publico":"Prueba Modera"}');

update public.perfiles
set terminos_version = public.version_terminos(), terminos_aceptados_en = now()
where id::text like '00000000-0000-4000-8000-000000000a%';
update public.perfiles set es_moderador = true where id = '00000000-0000-4000-8000-000000000a09';

insert into storage.objects (bucket_id, name)
select 'fotos', u || '/00000000-0000-4000-8010-' || lpad(n::text, 12, '0') || variante
from unnest(array[
  '00000000-0000-4000-8000-000000000a01', '00000000-0000-4000-8000-000000000a02',
  '00000000-0000-4000-8000-000000000a03', '00000000-0000-4000-8000-000000000a04',
  '00000000-0000-4000-8000-000000000a05', '00000000-0000-4000-8000-000000000a06',
  '00000000-0000-4000-8000-000000000a07', '00000000-0000-4000-8000-000000000a08'
]) as u, generate_series(1, 3) as n, unnest(array['.jpg', '.miniatura.jpg']) as variante;

-- -----------------------------------------------------------------------------
-- Parte A, como el sistema: casos, avistamientos, unión, bloqueo, cuenta
-- borrada y el caso que se oculta.
-- -----------------------------------------------------------------------------
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000000a01';
  x constant uuid := '00000000-0000-4000-8000-000000000a02';
  v constant uuid := '00000000-0000-4000-8000-000000000a03';
  w constant uuid := '00000000-0000-4000-8000-000000000a04';
  b constant uuid := '00000000-0000-4000-8000-000000000a05';
  d constant uuid := '00000000-0000-4000-8000-000000000a06';
  z constant uuid := '00000000-0000-4000-8000-000000000a07';
  q constant uuid := '00000000-0000-4000-8000-000000000a08';
  m constant uuid := '00000000-0000-4000-8000-000000000a09';
  p uuid; e uuid; h uuid; k uuid; k_pe uuid; conv uuid;
begin
  -- F publica a P; V, B y D lo ven.
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  p := public.publicar_animal('perro', f || '/00000000-0000-4000-8010-000000000001.jpg', -34.91, -56.16, now() - interval '1 day',
    'mediano', 'marrón', true, null, 'perdido', 'Toby', 'Contacto de F');
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  perform public.registrar_avistamiento(p, v || '/00000000-0000-4000-8010-000000000001.jpg', -34.905, -56.155);
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.registrar_avistamiento(p, b || '/00000000-0000-4000-8010-000000000001.jpg', -34.905, -56.155);
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  perform public.registrar_avistamiento(p, d || '/00000000-0000-4000-8010-000000000001.jpg', -34.905, -56.155);

  -- X publica a E, W lo ve, y F confirma que es Toby: E se une a P y los
  -- avistamientos de E (el de X y el de W) pasan a P.
  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  e := public.publicar_animal('perro', x || '/00000000-0000-4000-8010-000000000001.jpg', -34.90, -56.15, now() - interval '3 hours');
  perform set_config('request.jwt.claims', json_build_object('sub', w, 'role', 'authenticated')::text, true);
  perform public.registrar_avistamiento(e, w || '/00000000-0000-4000-8010-000000000001.jpg', -34.90, -56.15);
  insert into public.coincidencias (animal_origen, animal_candidato, similitud, distancia_m, horas_diferencia)
  values (least(p, e), greatest(p, e), 0.9, 500, 20)
  returning id into k_pe;
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  perform public.resolver_coincidencia(k_pe, true);

  -- F bloquea a B. D borra su cuenta: su avistamiento queda sin autor.
  insert into public.bloqueos (bloqueador_id, bloqueado_id) values (f, b);
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  perform public.borrar_mi_cuenta(true);

  -- Q publica a H con contacto; V lo ve; Z lo resguarda con foto y contacto y le
  -- escribe a Q. W publica un encontrado parecido (K) y el sistema sugiere el par.
  perform set_config('request.jwt.claims', json_build_object('sub', q, 'role', 'authenticated')::text, true);
  h := public.publicar_animal('gato', q || '/00000000-0000-4000-8010-000000000001.jpg', -34.88, -56.18, now() - interval '1 day',
    null, 'gris', false, null, 'perdido', 'Michi', 'Contacto de Q');
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  perform public.registrar_avistamiento(h, v || '/00000000-0000-4000-8010-000000000002.jpg', -34.88, -56.18);
  insert into public.denuncias (animal_id, usuario_id, motivo) values (h, v, 'spam');
  perform set_config('request.jwt.claims', json_build_object('sub', z, 'role', 'authenticated')::text, true);
  perform public.cambiar_estado_animal(h, 'resguardado', 'Contacto de Z', null, null, null, z || '/00000000-0000-4000-8010-000000000001.jpg');
  conv := public.abrir_conversacion(h, q);
  insert into public.mensajes (conversacion_id, emisor_id, cuerpo) values (conv, z, 'Lo tengo yo');
  perform set_config('request.jwt.claims', json_build_object('sub', w, 'role', 'authenticated')::text, true);
  k := public.publicar_animal('gato', w || '/00000000-0000-4000-8010-000000000002.jpg', -34.88, -56.18, now() - interval '2 hours');
  insert into public.coincidencias (animal_origen, animal_candidato, similitud, distancia_m, horas_diferencia)
  values (least(h, k), greatest(h, k), 0.9, 100, 20);

  -- M oculta a H.
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  perform public.moderar_animal(h, true);

  perform set_config('prueba.p', p::text, true);
  perform set_config('prueba.e', e::text, true);
  perform set_config('prueba.h', h::text, true);
  perform set_config('prueba.k', k::text, true);
  perform set_config('prueba.conv', conv::text, true);
end $$;

-- Lo que ve cada persona de H, en una tabla temporal para comparar (la llena
-- quien consulta, con su rol y su RLS).
create temporary table visto (quien text, que text, cuantos int) on commit drop;
grant all on visto to anon, authenticated;

create or replace function pg_temp.mirar(p_quien text) returns void language plpgsql as $$
declare
  h uuid := current_setting('prueba.h')::uuid;
  k uuid := current_setting('prueba.k')::uuid;
begin
  insert into visto values
    (p_quien, 'animales', (select count(*) from public.animales where id = h)),
    (p_quien, 'contacto_familia', (select count(*) from public.animales where id = h and contacto_familia is not null)),
    (p_quien, 'animales_detalle', (select count(*) from public.animales_detalle where id = h)),
    (p_quien, 'avistamientos', (select count(*) from public.avistamientos where animal_id = h)),
    (p_quien, 'avistamientos_detalle', (select count(*) from public.avistamientos_detalle where animal_id = h)),
    (p_quien, 'cambios_estado', (select count(*) from public.cambios_estado where animal_id = h)),
    (p_quien, 'cambios_estado_detalle', (select count(*) from public.cambios_estado_detalle where animal_id = h)),
    (p_quien, 'coincidencias', (select count(*) from public.coincidencias where h in (animal_origen, animal_candidato))),
    (p_quien, 'coincidencias_detalle', (select count(*) from public.coincidencias_detalle where h in (animal_origen, animal_candidato))),
    (p_quien, 'contactos', (select count(*) from public.contactos_resguardo where animal_id = h)),
    (p_quien, 'denuncias_detalle', (select count(*) from public.denuncias_detalle where animal_id = h)),
    (p_quien, 'otro_caso', (select count(*) from public.animales where id = k));
end $$;
grant execute on function pg_temp.mirar(text) to anon, authenticated;

create or replace function pg_temp.esperado(p_quien text, p_que text, p_cuantos int, p_falla text)
returns void language plpgsql as $$
declare
  v int := (select cuantos from visto where quien = p_quien and que = p_que);
begin
  if v is distinct from p_cuantos then
    raise exception 'FALLA %: % ve % de % (se esperaba %)', p_falla, p_quien, v, p_que, p_cuantos;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Parte B: qué ve cada uno del caso oculto.
-- -----------------------------------------------------------------------------
set local role anon;
do $$ begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform pg_temp.mirar('sin cuenta');
end $$;
reset role;

set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000000a03', 'role', 'authenticated')::text, true);
  perform pg_temp.mirar('otra cuenta');
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000000a04', 'role', 'authenticated')::text, true);
  perform pg_temp.mirar('el otro lado');
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000000a08', 'role', 'authenticated')::text, true);
  perform pg_temp.mirar('quien publico');
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000000a09', 'role', 'authenticated')::text, true);
  perform pg_temp.mirar('moderacion');
end $$;
reset role;

do $$
declare
  que text;
begin
  -- 1. Sin cuenta y con otra cuenta (también quien lo vio, V): nada del caso,
  -- y el otro caso del par se sigue viendo.
  foreach que in array array['animales', 'contacto_familia', 'animales_detalle', 'avistamientos',
    'avistamientos_detalle', 'cambios_estado', 'cambios_estado_detalle', 'coincidencias',
    'coincidencias_detalle', 'contactos'] loop
    perform pg_temp.esperado('sin cuenta', que, 0, '1a');
    perform pg_temp.esperado('otra cuenta', que, 0, '1b');
  end loop;
  perform pg_temp.esperado('sin cuenta', 'otro_caso', 1, '1c');
  perform pg_temp.esperado('otra cuenta', 'otro_caso', 1, '1c');

  -- 2. Quien publicó el otro lado de la coincidencia no la ve.
  perform pg_temp.esperado('el otro lado', 'coincidencias', 0, '2a');
  perform pg_temp.esperado('el otro lado', 'coincidencias_detalle', 0, '2b');
  perform pg_temp.esperado('el otro lado', 'otro_caso', 1, '2c');

  -- 3. Quien lo publicó lo ve todo, con su contacto y el de quien lo resguarda.
  perform pg_temp.esperado('quien publico', 'animales', 1, '3a');
  perform pg_temp.esperado('quien publico', 'contacto_familia', 1, '3b');
  perform pg_temp.esperado('quien publico', 'animales_detalle', 1, '3c');
  perform pg_temp.esperado('quien publico', 'avistamientos', 3, '3d');
  perform pg_temp.esperado('quien publico', 'avistamientos_detalle', 3, '3d');
  perform pg_temp.esperado('quien publico', 'cambios_estado', 1, '3e');
  perform pg_temp.esperado('quien publico', 'coincidencias_detalle', 1, '3f');
  perform pg_temp.esperado('quien publico', 'contactos', 1, '3g');

  -- 4. Moderación ve el caso, sus avistamientos y su coincidencia; el contacto
  -- de resguardo de un perdido sigue siendo solo de la familia y de quien lo tiene.
  perform pg_temp.esperado('moderacion', 'animales', 1, '4a');
  perform pg_temp.esperado('moderacion', 'animales_detalle', 1, '4b');
  perform pg_temp.esperado('moderacion', 'avistamientos', 3, '4c');
  perform pg_temp.esperado('moderacion', 'cambios_estado', 1, '4d');
  perform pg_temp.esperado('moderacion', 'coincidencias_detalle', 1, '4e');
  perform pg_temp.esperado('moderacion', 'contactos', 0, '4f');
  -- 4g. Y el panel de moderación lo sigue listando con su denuncia; quien
  -- denunció ya no ve el caso a través de su denuncia.
  perform pg_temp.esperado('moderacion', 'denuncias_detalle', 1, '4g');
  perform pg_temp.esperado('otra cuenta', 'denuncias_detalle', 0, '4h');
end $$;

-- -----------------------------------------------------------------------------
-- Parte C: conversaciones sobre el caso oculto.
-- -----------------------------------------------------------------------------
set local role authenticated;
do $$
declare
  v constant uuid := '00000000-0000-4000-8000-000000000a03';
  z constant uuid := '00000000-0000-4000-8000-000000000a07';
  q constant uuid := '00000000-0000-4000-8000-000000000a08';
  h uuid := current_setting('prueba.h')::uuid;
  conv uuid := current_setting('prueba.conv')::uuid;
  fila public.conversaciones_detalle;
begin
  -- 5a. Nadie abre una conversación nueva sobre un caso oculto, ni quien lo publicó.
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  begin
    perform public.abrir_conversacion(h, q);
    raise exception 'FALLA 5a: se abrió una conversación nueva sobre un caso oculto';
  exception when no_data_found then null;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', q, 'role', 'authenticated')::text, true);
  begin
    perform public.abrir_conversacion(h, v);
    raise exception 'FALLA 5b: quien publicó abrió una conversación nueva sobre su caso oculto';
  exception when no_data_found then null;
  end;

  -- 5c. La que ya existía sigue para Z: se lee y se retoma, sin los datos del caso.
  perform set_config('request.jwt.claims', json_build_object('sub', z, 'role', 'authenticated')::text, true);
  select * into fila from public.conversaciones_detalle where id = conv;
  if fila.id is null or fila.animal_disponible or fila.animal_foto_path is not null
     or fila.animal_especie is not null or fila.ultimo_mensaje is distinct from 'Lo tengo yo' then
    raise exception 'FALLA 5c: la conversación sobre el caso oculto no quedó legible sin sus datos';
  end if;
  if (select count(*) from public.mensajes_detalle where conversacion_id = conv) <> 1 then
    raise exception 'FALLA 5d: no se leen los mensajes de la conversación sobre el caso oculto';
  end if;
  if public.abrir_conversacion(h, q) is distinct from conv then
    raise exception 'FALLA 5e: no se pudo retomar la conversación sobre el caso oculto';
  end if;
end $$;
reset role;

-- -----------------------------------------------------------------------------
-- Parte D, como usuario común: a quién le escribe quien publicó.
-- -----------------------------------------------------------------------------
set local role authenticated;
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000000a01';
  x constant uuid := '00000000-0000-4000-8000-000000000a02';
  v constant uuid := '00000000-0000-4000-8000-000000000a03';
  w constant uuid := '00000000-0000-4000-8000-000000000a04';
  b constant uuid := '00000000-0000-4000-8000-000000000a05';
  d constant uuid := '00000000-0000-4000-8000-000000000a06';
  z constant uuid := '00000000-0000-4000-8000-000000000a07';
  p uuid := current_setting('prueba.p')::uuid;
  e uuid := current_setting('prueba.e')::uuid;
  conv uuid;
begin
  -- 6a. La familia le escribe a quien lo vio.
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  begin
    conv := public.abrir_conversacion(p, v);
  exception when others then
    raise exception 'FALLA 6a: la familia no pudo escribirle a quien lo vio (%)', sqlerrm;
  end;
  -- 6b. También a quien vio el reporte que se unió al caso (W vio a E).
  begin
    perform public.abrir_conversacion(p, w);
  exception when others then
    raise exception 'FALLA 6b: la familia no pudo escribirle a quien vio el reporte unido (%)', sqlerrm;
  end;
  -- 6c. No a quien bloqueó.
  begin
    perform public.abrir_conversacion(p, b);
    raise exception 'FALLA 6c: se abrió una conversación con alguien bloqueado';
  exception when insufficient_privilege then null;
  end;
  -- 6d. No a una cuenta borrada (su avistamiento quedó sin autor).
  begin
    perform public.abrir_conversacion(p, d);
    raise exception 'FALLA 6d: se abrió una conversación con una cuenta borrada';
  exception when no_data_found then null;
  end;
  if not exists (select 1 from public.avistamientos where animal_id = p and usuario_id is null) then
    raise exception 'FALLA 6e: el avistamiento de la cuenta borrada no quedó sin autor';
  end if;

  -- 6f. Quien publicó el reporte unido (X publicó a E) también le escribe a
  -- quien lo vio, desde el caso o desde su reporte.
  perform set_config('request.jwt.claims', json_build_object('sub', x, 'role', 'authenticated')::text, true);
  begin
    perform public.abrir_conversacion(p, v);
    perform public.abrir_conversacion(e, w);
  exception when others then
    raise exception 'FALLA 6f: quien publicó el reporte unido no pudo escribirle a quien lo vio (%)', sqlerrm;
  end;

  -- 6g. Un tercero no le escribe a quien lo vio.
  perform set_config('request.jwt.claims', json_build_object('sub', z, 'role', 'authenticated')::text, true);
  begin
    perform public.abrir_conversacion(p, v);
    raise exception 'FALLA 6g: un tercero le escribió a quien lo vio';
  exception when insufficient_privilege then null;
  end;
  -- 6h. Quien lo vio tampoco le escribe a otra persona que lo vio.
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  begin
    perform public.abrir_conversacion(p, w);
    raise exception 'FALLA 6h: quien lo vio le escribió a otra persona que lo vio';
  exception when insufficient_privilege then null;
  end;
  -- 6i. Pero sí le contesta a la familia: es la misma conversación.
  if public.abrir_conversacion(p, f) is distinct from conv then
    raise exception 'FALLA 6i: quien lo vio no retomó la conversación con la familia';
  end if;
end $$;
reset role;

-- -----------------------------------------------------------------------------
-- Parte E: moderación vuelve a mostrar el caso y todo vuelve.
-- -----------------------------------------------------------------------------
do $$ begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000000a09', 'role', 'authenticated')::text, true);
  perform public.moderar_animal(current_setting('prueba.h')::uuid, false);
  delete from visto;
end $$;

set local role anon;
do $$ begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform pg_temp.mirar('sin cuenta');
end $$;
reset role;

set local role authenticated;
do $$
declare
  h uuid := current_setting('prueba.h')::uuid;
  v constant uuid := '00000000-0000-4000-8000-000000000a03';
  q constant uuid := '00000000-0000-4000-8000-000000000a08';
  z constant uuid := '00000000-0000-4000-8000-000000000a07';
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-000000000a04', 'role', 'authenticated')::text, true);
  perform pg_temp.mirar('el otro lado');
  perform set_config('request.jwt.claims', json_build_object('sub', z, 'role', 'authenticated')::text, true);
  if not (select animal_disponible from public.conversaciones_detalle where id = current_setting('prueba.conv')::uuid) then
    raise exception 'FALLA 7d: la conversación no recuperó los datos del caso';
  end if;
  -- 7e. Y se pueden abrir conversaciones nuevas (V le escribe a la familia, Q).
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  begin
    perform public.abrir_conversacion(h, q);
  exception when others then
    raise exception 'FALLA 7e: al volver a mostrarlo no se pudo abrir una conversación (%)', sqlerrm;
  end;
end $$;
reset role;

do $$ begin
  perform pg_temp.esperado('sin cuenta', 'animales', 1, '7a');
  perform pg_temp.esperado('sin cuenta', 'contacto_familia', 1, '7a');
  perform pg_temp.esperado('sin cuenta', 'avistamientos', 3, '7b');
  perform pg_temp.esperado('sin cuenta', 'cambios_estado', 1, '7b');
  perform pg_temp.esperado('sin cuenta', 'coincidencias_detalle', 1, '7c');
  -- El contacto de resguardo de un perdido sigue siendo privado, como antes.
  perform pg_temp.esperado('sin cuenta', 'contactos', 0, '7c');
  perform pg_temp.esperado('el otro lado', 'coincidencias', 1, '7c');
end $$;

rollback;
