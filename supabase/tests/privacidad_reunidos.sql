-- =============================================================================
-- Pruebas de la privacidad de los casos reunidos (migración 0027): quien no
-- participó en un caso reunido ve solo lo básico (la foto, el nombre si la
-- familia lo mostró, la especie y que volvió), también en los reportes unidos
-- a él; quien participó y moderación siguen viendo todo; si se reabre, vuelve
-- a verse todo.
-- Requiere las migraciones 0001 a 0027. Pegalo entero en el SQL Editor y tocá Run.
-- Bien: termina en "Success. No rows returned". Mal: ERROR con "FALLA n: ..." que dice qué.
-- Todo corre dentro de begin/rollback: no deja usuarios, fotos, casos, mensajes,
-- historias ni avisos, y cambia config_app solo dentro de la transacción.
--
-- Las cinco miradas: sin cuenta, X (una cuenta que no participó), V (la vecina
-- que avisó que lo vio), F (la familia de Toby) y M (moderadora). Además:
-- R (lo resguardó), E (le escribió a F antes de que volviera), T (le escribió
-- después), B (avisó que lo vio, pero F la bloqueó) y Q (publicó un encontrado
-- que se unió al caso de Toby).
-- =============================================================================
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000002701', 'prueba-priv-f@spot.test', '{"nombre_publico":"Prueba Familia"}'),
  ('00000000-0000-4000-8000-000000002702', 'prueba-priv-v@spot.test', '{"nombre_publico":"Prueba Vecina"}'),
  ('00000000-0000-4000-8000-000000002703', 'prueba-priv-r@spot.test', '{"nombre_publico":"Prueba Resguardo"}'),
  ('00000000-0000-4000-8000-000000002704', 'prueba-priv-e@spot.test', '{"nombre_publico":"Prueba Antes"}'),
  ('00000000-0000-4000-8000-000000002705', 'prueba-priv-t@spot.test', '{"nombre_publico":"Prueba Despues"}'),
  ('00000000-0000-4000-8000-000000002706', 'prueba-priv-b@spot.test', '{"nombre_publico":"Prueba Bloqueada"}'),
  ('00000000-0000-4000-8000-000000002707', 'prueba-priv-q@spot.test', '{"nombre_publico":"Prueba Unida"}'),
  ('00000000-0000-4000-8000-000000002708', 'prueba-priv-x@spot.test', '{"nombre_publico":"Prueba Otra"}'),
  ('00000000-0000-4000-8000-000000002709', 'prueba-priv-m@spot.test', '{"nombre_publico":"Prueba Moderadora"}');
update public.perfiles
set terminos_version = public.version_terminos(), terminos_aceptados_en = now()
where id::text like '00000000-0000-4000-8000-0000000027__';
update public.perfiles set es_moderador = true where id = '00000000-0000-4000-8000-000000002709';

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

-- Lo que hay de verdad, como dueña de las tablas (sin políticas).
create function pg_temp.real(p_caso uuid)
returns table (descripcion text, nombre text, color text, avistamientos bigint, cambios bigint, coincidencias bigint)
language sql security definer as $$
  select a.descripcion, a.nombre, a.color,
    (select count(*) from public.avistamientos av where av.animal_id = a.id),
    (select count(*) from public.cambios_estado c where c.animal_id = a.id),
    (select count(*) from public.coincidencias c where a.id in (c.animal_origen, c.animal_candidato))
  from public.animales a
  where a.id = p_caso;
$$;

-- Lo que ve p_uid del caso, con los permisos del rol actual. p_todo: si tiene
-- que ver todo (lo mismo que hay) o solo lo básico.
create function pg_temp.mira(p_falla text, p_uid uuid, p_caso uuid, p_todo boolean)
returns void language plpgsql as $$
declare
  r record;
  d record;
  v_av bigint;
  v_av_d bigint;
  v_ce bigint;
  v_ce_d bigint;
  v_co bigint;
  v_co_d bigint;
  v_cr bigint;
  v_mapa boolean;
  v_visto jsonb;
begin
  select * into r from pg_temp.real(p_caso);
  perform pg_temp.como(p_uid);
  select * into d from public.animales_detalle where id = p_caso;
  if not found then
    raise exception 'FALLA %: no ve ni lo básico del caso', p_falla;
  end if;
  select count(*) into v_av from public.avistamientos where animal_id = p_caso;
  select count(*) into v_av_d from public.avistamientos_detalle where animal_id = p_caso;
  select count(*) into v_ce from public.cambios_estado where animal_id = p_caso;
  select count(*) into v_ce_d from public.cambios_estado_detalle where animal_id = p_caso;
  select count(*) into v_co from public.coincidencias where p_caso in (animal_origen, animal_candidato);
  select count(*) into v_co_d from public.coincidencias_detalle where p_caso in (animal_origen, animal_candidato);
  select count(*) into v_cr from public.contactos_resguardo where animal_id = p_caso;
  v_mapa := exists (select 1 from public.animales_mapa where id = p_caso);
  v_visto := jsonb_build_object('detalle', to_jsonb(d), 'avistamientos', v_av, 'avistamientos_detalle', v_av_d,
    'cambios', v_ce, 'cambios_detalle', v_ce_d, 'coincidencias', v_co, 'coincidencias_detalle', v_co_d,
    'contactos', v_cr, 'mapa', v_mapa);

  if p_todo then
    if d.reservado
       or d.descripcion is distinct from r.descripcion
       or d.nombre is distinct from r.nombre
       or d.color is distinct from r.color
       or d.tiene_collar is null
       or d.creado_por is null
       or (r.avistamientos > 0 and (d.lat is null or d.ultimo_visto_en is null))
       or d.cantidad_avistamientos <> r.avistamientos
       or v_av <> r.avistamientos or v_av_d <> r.avistamientos
       or v_ce <> r.cambios or v_ce_d <> r.cambios
       or v_co <> r.coincidencias or v_co_d <> r.coincidencias
       or (d.estado <> 'vinculado' and not v_mapa) then
      raise exception 'FALLA %: no ve todo el caso (%)', p_falla, v_visto;
    end if;
  else
    if not d.reservado
       or d.descripcion is not null or d.color is not null or d.tamanio is not null
       or d.tiene_collar is not null or d.creado_por is not null or d.creador_nombre is not null
       or d.contacto_familia is not null or d.ultimo_avistamiento_en is not null
       or d.lat is not null or d.lng is not null or d.ultimo_visto_en is not null
       or d.cantidad_avistamientos <> 0 or d.perdido_desde is not null
       or v_av + v_av_d + v_ce + v_ce_d + v_co + v_co_d + v_cr > 0
       or v_mapa then
      raise exception 'FALLA %: ve más que lo básico (%)', p_falla, v_visto;
    end if;
    -- Lo básico sí: la foto, la especie y el estado.
    if d.foto_principal_path is null or d.especie is null or d.estado is null then
      raise exception 'FALLA %: no ve lo básico (%)', p_falla, v_visto;
    end if;
  end if;
end;
$$;

create temp table casos (nombre text primary key, animal uuid) on commit drop;
grant all on casos to public;
create temp table fotos (nombre text primary key, ruta text) on commit drop;
grant all on fotos to public;

insert into fotos values
  ('toby', pg_temp.foto('00000000-0000-4000-8000-000000002701')),
  ('mora', pg_temp.foto('00000000-0000-4000-8000-000000002701')),
  ('vio', pg_temp.foto('00000000-0000-4000-8000-000000002702')),
  ('lola', pg_temp.foto('00000000-0000-4000-8000-000000002702')),
  ('resguardo', pg_temp.foto('00000000-0000-4000-8000-000000002703')),
  ('bloqueada', pg_temp.foto('00000000-0000-4000-8000-000000002706')),
  ('unida', pg_temp.foto('00000000-0000-4000-8000-000000002707')),
  ('otra', pg_temp.foto('00000000-0000-4000-8000-000000002708'));

-- -----------------------------------------------------------------------------
-- 0. Permisos: el nombre y la descripción no se leen de la tabla; la regla se
--    usa desde las políticas y las vistas, y participo_en_caso es interna.
-- -----------------------------------------------------------------------------
do $$
begin
  if has_column_privilege('anon', 'public.animales', 'descripcion', 'select')
     or has_column_privilege('authenticated', 'public.animales', 'descripcion', 'select')
     or has_column_privilege('anon', 'public.animales', 'nombre', 'select')
     or has_column_privilege('authenticated', 'public.animales', 'nombre', 'select') then
    raise exception 'FALLA 0a: el nombre o la descripción se leen directo de animales';
  end if;
  if not has_column_privilege('anon', 'public.animales', 'especie', 'select')
     or not has_column_privilege('authenticated', 'public.animales', 'foto_principal_path', 'select') then
    raise exception 'FALLA 0b: no se leen las columnas de siempre de animales';
  end if;
  if has_function_privilege('anon', 'public.participo_en_caso(uuid, uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.participo_en_caso(uuid, uuid)', 'execute') then
    raise exception 'FALLA 0c: participo_en_caso se puede llamar desde la API';
  end if;
  if not has_function_privilege('anon', 'public.ve_detalle_del_caso(uuid)', 'execute')
     or not has_function_privilege('anon', 'public.vista_del_caso(uuid)', 'execute') then
    raise exception 'FALLA 0d: las vistas no se pueden leer sin cuenta';
  end if;
end $$;

set local role authenticated;

-- -----------------------------------------------------------------------------
-- 1. El caso: F publica a Toby; V avisa que lo vio; Q publica un encontrado que
--    F une a Toby; R lo resguarda con su contacto; E le escribe a F; B avisa y
--    F la bloquea. V publica a Lola (encontrado) y R la resguarda con un
--    contacto que, entre encontrados, ve cualquiera. X publica un encontrado
--    con una coincidencia pendiente con Toby.
-- -----------------------------------------------------------------------------
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002701';
  v constant uuid := '00000000-0000-4000-8000-000000002702';
  r constant uuid := '00000000-0000-4000-8000-000000002703';
  e constant uuid := '00000000-0000-4000-8000-000000002704';
  b constant uuid := '00000000-0000-4000-8000-000000002706';
  q constant uuid := '00000000-0000-4000-8000-000000002707';
  x constant uuid := '00000000-0000-4000-8000-000000002708';
  toby uuid;
  mora uuid;
  lola uuid;
  unida uuid;
  otra uuid;
  conv uuid;
begin
  perform pg_temp.como(f);
  toby := public.publicar_animal('perro', (select ruta from fotos where nombre = 'toby'),
    -34.9, -56.16, now() - interval '3 days', 'mediano', 'marrón', true,
    'Se escapó de casa, en la calle Rivera', 'perdido', 'Toby', '099 000 000');
  mora := public.publicar_animal('gato', (select ruta from fotos where nombre = 'mora'),
    -34.9, -56.16, now() - interval '1 day', 'chico', 'gris', false, 'Muy mimosa', 'perdido', 'Mora', null);

  perform pg_temp.como(v);
  perform public.registrar_avistamiento(toby, (select ruta from fotos where nombre = 'vio'),
    -34.91, -56.17, now() - interval '2 days', 'Iba por la rambla');
  lola := public.publicar_animal('perro', (select ruta from fotos where nombre = 'lola'),
    -34.88, -56.15, now() - interval '2 days', 'chico', 'blanca', false,
    'Apareció en la puerta de mi casa', 'encontrado', null, null);

  perform pg_temp.como(q);
  unida := public.publicar_animal('perro', (select ruta from fotos where nombre = 'unida'),
    -34.92, -56.18, now() - interval '1 day', 'mediano', 'marrón', true,
    'Lo vi atado en la feria', 'encontrado', null, null);

  perform pg_temp.como(x);
  otra := public.publicar_animal('perro', (select ruta from fotos where nombre = 'otra'),
    -34.95, -56.2, now() - interval '1 day', 'grande', 'negro', false, null, 'encontrado', null, null);

  insert into casos values ('toby', toby), ('mora', mora), ('lola', lola), ('unida', unida), ('otra', otra);
end $$;

-- Las coincidencias las crea el reconocimiento (como dueña de la tabla).
reset role;
-- El par va ordenado (animal_origen < animal_candidato).
insert into public.coincidencias (animal_origen, animal_candidato, similitud, origen)
select least(u.animal, t.animal), greatest(u.animal, t.animal), 0.9, 'ia'
from casos u, casos t where u.nombre = 'unida' and t.nombre = 'toby';
set local role authenticated;

do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002701';
  r constant uuid := '00000000-0000-4000-8000-000000002703';
  e constant uuid := '00000000-0000-4000-8000-000000002704';
  b constant uuid := '00000000-0000-4000-8000-000000002706';
  toby uuid := (select animal from casos where nombre = 'toby');
  lola uuid := (select animal from casos where nombre = 'lola');
  unida uuid := (select animal from casos where nombre = 'unida');
  conv uuid;
begin
  -- F une el encontrado de Q a Toby.
  perform pg_temp.como(f);
  perform public.resolver_coincidencia(
    (select c.id from public.coincidencias c where unida in (c.animal_origen, c.animal_candidato)),
    true);
  if (select estado from public.animales where id = unida) is distinct from 'vinculado' then
    raise exception 'FALLA 1a: el encontrado de Q no quedó unido a Toby';
  end if;

  perform pg_temp.como(r);
  perform public.cambiar_estado_animal(toby, 'resguardado', 'Lo tengo yo', null, -34.9, -56.16,
    (select ruta from fotos where nombre = 'resguardo'));
  perform public.cambiar_estado_animal(lola, 'resguardado', 'Lola está conmigo', null, null, null, null);

  perform pg_temp.como(e);
  conv := public.abrir_conversacion(toby, f);
  insert into public.mensajes (conversacion_id, emisor_id, cuerpo) values (conv, e, 'Creo que lo vi en el parque');

  perform pg_temp.como(b);
  perform public.registrar_avistamiento(toby, (select ruta from fotos where nombre = 'bloqueada'),
    -34.91, -56.17, now() - interval '2 days', null);
  perform pg_temp.como(f);
  insert into public.bloqueos (bloqueador_id, bloqueado_id) values (f, b);
end $$;

-- -----------------------------------------------------------------------------
-- 2. Abiertos, todos ven todo (también sin cuenta).
-- -----------------------------------------------------------------------------
do $$
declare
  x constant uuid := '00000000-0000-4000-8000-000000002708';
  toby uuid := (select animal from casos where nombre = 'toby');
  lola uuid := (select animal from casos where nombre = 'lola');
begin
  perform pg_temp.mira('2a', x, toby, true);
  perform pg_temp.mira('2b', x, lola, true);
  -- Entre encontrados, el contacto de quien lo resguarda lo ve cualquiera.
  if (select count(*) from public.contactos_resguardo where animal_id = lola) <> 1 then
    raise exception 'FALLA 2c: el contacto de Lola no se ve con el caso abierto';
  end if;
end $$;

set local role anon;
do $$
begin
  perform pg_temp.mira('2d', null, (select animal from casos where nombre = 'toby'), true);
end $$;
set local role authenticated;

-- -----------------------------------------------------------------------------
-- 3. Vuelven a casa: F marca a Toby como reunido y R, a Lola. Después, T le
--    escribe a F, y X tiene otra coincidencia pendiente con Toby (de antes).
-- -----------------------------------------------------------------------------
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002701';
  r constant uuid := '00000000-0000-4000-8000-000000002703';
  t constant uuid := '00000000-0000-4000-8000-000000002705';
  toby uuid := (select animal from casos where nombre = 'toby');
  lola uuid := (select animal from casos where nombre = 'lola');
  conv uuid;
begin
  perform pg_temp.como(f);
  perform public.cambiar_estado_animal(toby, 'reunido');
  perform pg_temp.como(r);
  perform public.cambiar_estado_animal(lola, 'reunido');

  -- Escribirle a la familia de un caso reunido sigue pudiéndose, pero no abre el resto.
  perform pg_temp.como(t);
  conv := public.abrir_conversacion(toby, f);
  insert into public.mensajes (conversacion_id, emisor_id, cuerpo) values (conv, t, '¡Qué bueno que volvió!');
end $$;

-- Dentro de la prueba todo pasa en el mismo instante (now()): lo que pasó
-- antes de que volviera va un rato antes. Y la coincidencia de X, de cuando
-- Toby estaba perdido.
reset role;
update public.cambios_estado set created_at = now() - interval '1 hour'
where animal_id in (select animal from casos where nombre in ('toby', 'lola')) and estado_nuevo = 'reunido';
update public.mensajes set created_at = now() - interval '2 hours'
where emisor_id = '00000000-0000-4000-8000-000000002704';
insert into public.coincidencias (animal_origen, animal_candidato, similitud, origen)
select least(o.animal, t.animal), greatest(o.animal, t.animal), 0.8, 'ia'
from casos o, casos t where o.nombre = 'otra' and t.nombre = 'toby';
set local role authenticated;

-- -----------------------------------------------------------------------------
-- 4. Las cinco miradas sobre Toby reunido (y su reporte unido).
-- -----------------------------------------------------------------------------

-- 4a. Sin cuenta: lo básico, del caso y del reporte unido.
set local role anon;
do $$
declare
  toby uuid := (select animal from casos where nombre = 'toby');
  unida uuid := (select animal from casos where nombre = 'unida');
  d record;
begin
  perform pg_temp.mira('4a1', null, toby, false);
  perform pg_temp.mira('4a2', null, unida, false);
  select * into d from public.animales_detalle where id = toby;
  if d.nombre is distinct from 'Toby' or d.especie <> 'perro' or d.estado <> 'reunido' then
    raise exception 'FALLA 4a3: sin cuenta no ve el nombre, la especie o que volvió (%)', to_jsonb(d);
  end if;
  -- El reporte unido sigue apuntando al caso (la app redirige ahí).
  if (select vinculado_a from public.animales_detalle where id = unida) is distinct from toby then
    raise exception 'FALLA 4a4: el reporte unido no lleva al caso';
  end if;
  -- Tampoco por la tabla ni por las funciones.
  perform pg_temp.falla(format('select descripcion from public.animales where id = %L', toby), '42501', '4a5');
  perform pg_temp.falla(format('select nombre from public.animales where id = %L', toby), '42501', '4a6');
  perform pg_temp.falla(format('select * from public.animales where id = %L', toby), '42501', '4a7');
  if (select descripcion from public.vista_del_caso(toby)) is not null
     or (select completo from public.vista_del_caso(toby))
     or public.ve_detalle_del_caso(toby) or public.ve_detalle_del_caso(unida) then
    raise exception 'FALLA 4a8: las funciones le dan el detalle sin cuenta';
  end if;
  if not public.ve_detalle_del_caso((select animal from casos where nombre = 'otra')) then
    raise exception 'FALLA 4a9: un caso abierto no se ve entero sin cuenta';
  end if;
end $$;
set local role authenticated;

-- 4b. X, una cuenta que no participó: lo básico, aunque tenga una coincidencia
--     pendiente con Toby (deja de verla) y aunque lo denuncie.
do $$
declare
  x constant uuid := '00000000-0000-4000-8000-000000002708';
  toby uuid := (select animal from casos where nombre = 'toby');
  unida uuid := (select animal from casos where nombre = 'unida');
  otra uuid := (select animal from casos where nombre = 'otra');
begin
  perform pg_temp.mira('4b1', x, toby, false);
  perform pg_temp.mira('4b2', x, unida, false);
  if (select nombre from public.animales_detalle where id = toby) is distinct from 'Toby' then
    raise exception 'FALLA 4b3: X no ve el nombre de Toby';
  end if;
  if exists (select 1 from public.coincidencias where otra in (animal_origen, animal_candidato)) then
    raise exception 'FALLA 4b4: X ve su coincidencia con Toby reunido';
  end if;
  perform pg_temp.falla(format('select descripcion from public.animales where id = %L', toby), '42501', '4b5');
  insert into public.denuncias (animal_id, usuario_id, motivo) values (toby, x, 'otro');
  if (select animal_descripcion from public.denuncias_detalle where animal_id = toby and usuario_id = x) is not null then
    raise exception 'FALLA 4b6: X ve la descripción de Toby en su denuncia';
  end if;
end $$;

-- 4c. V, la vecina que avisó: todo, del caso y del reporte unido.
do $$
declare
  v constant uuid := '00000000-0000-4000-8000-000000002702';
begin
  perform pg_temp.mira('4c1', v, (select animal from casos where nombre = 'toby'), true);
  perform pg_temp.mira('4c2', v, (select animal from casos where nombre = 'unida'), true);
  -- El contacto de quien lo resguarda, en un perdido, sigue siendo solo de la familia y de R.
  if exists (select 1 from public.contactos_resguardo where animal_id = (select animal from casos where nombre = 'toby')) then
    raise exception 'FALLA 4c3: V ve el contacto de quien resguardó a Toby';
  end if;
end $$;

-- 4d. F, la familia: todo, con el contacto de R.
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002701';
  toby uuid := (select animal from casos where nombre = 'toby');
begin
  perform pg_temp.mira('4d1', f, toby, true);
  perform pg_temp.mira('4d2', f, (select animal from casos where nombre = 'unida'), true);
  if (select count(*) from public.contactos_resguardo where animal_id = toby) <> 1
     or (select contacto_compartido from public.cambios_estado_detalle
         where animal_id = toby and estado_nuevo = 'resguardado') is distinct from 'Lo tengo yo' then
    raise exception 'FALLA 4d3: F no ve el contacto de quien resguardó a Toby';
  end if;
end $$;

-- 4e. M, moderadora: todo, también la descripción en la denuncia de X.
do $$
declare
  m constant uuid := '00000000-0000-4000-8000-000000002709';
  toby uuid := (select animal from casos where nombre = 'toby');
begin
  perform pg_temp.mira('4e1', m, toby, true);
  perform pg_temp.mira('4e2', m, (select animal from casos where nombre = 'unida'), true);
  if (select animal_descripcion from public.denuncias_detalle where animal_id = toby)
     is distinct from 'Se escapó de casa, en la calle Rivera' then
    raise exception 'FALLA 4e3: M no ve la descripción en la denuncia';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Los demás que participaron, y los que no.
-- -----------------------------------------------------------------------------
do $$
declare
  r constant uuid := '00000000-0000-4000-8000-000000002703';
  e constant uuid := '00000000-0000-4000-8000-000000002704';
  t constant uuid := '00000000-0000-4000-8000-000000002705';
  b constant uuid := '00000000-0000-4000-8000-000000002706';
  q constant uuid := '00000000-0000-4000-8000-000000002707';
  toby uuid := (select animal from casos where nombre = 'toby');
  unida uuid := (select animal from casos where nombre = 'unida');
begin
  -- R lo resguardó, E le escribió antes de que volviera y Q publicó el reporte unido.
  perform pg_temp.mira('5a', r, toby, true);
  perform pg_temp.mira('5b', e, toby, true);
  perform pg_temp.mira('5c', q, toby, true);
  perform pg_temp.mira('5d', q, unida, true);
  -- T le escribió después: no participó.
  perform pg_temp.mira('5e', t, toby, false);
  -- B avisó que lo vio, pero F la bloqueó.
  perform pg_temp.mira('5f', b, toby, false);
end $$;

-- -----------------------------------------------------------------------------
-- 6. Lola (encontrado), reunida: su contacto, que con el caso abierto veía
--    cualquiera, ahora solo lo ven quienes participaron y moderación.
-- -----------------------------------------------------------------------------
do $$
declare
  v constant uuid := '00000000-0000-4000-8000-000000002702';
  r constant uuid := '00000000-0000-4000-8000-000000002703';
  x constant uuid := '00000000-0000-4000-8000-000000002708';
  m constant uuid := '00000000-0000-4000-8000-000000002709';
  lola uuid := (select animal from casos where nombre = 'lola');
  u uuid;
begin
  perform pg_temp.mira('6a', x, lola, false);
  perform pg_temp.mira('6b', v, lola, true);
  perform pg_temp.mira('6c', r, lola, true);
  perform pg_temp.mira('6d', m, lola, true);
  foreach u in array array[v, r, m] loop
    perform pg_temp.como(u);
    if (select count(*) from public.contactos_resguardo where animal_id = lola) <> 1 then
      raise exception 'FALLA 6e: % no ve el contacto de Lola', u;
    end if;
  end loop;
end $$;

set local role anon;
do $$
begin
  perform pg_temp.mira('6f', null, (select animal from casos where nombre = 'lola'), false);
end $$;
set local role authenticated;

-- -----------------------------------------------------------------------------
-- 7. La historia sin el nombre: quien no participó deja de verlo; la familia,
--    la vecina y moderación lo siguen viendo.
-- -----------------------------------------------------------------------------
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002701';
  v constant uuid := '00000000-0000-4000-8000-000000002702';
  x constant uuid := '00000000-0000-4000-8000-000000002708';
  m constant uuid := '00000000-0000-4000-8000-000000002709';
  toby uuid := (select animal from casos where nombre = 'toby');
  u uuid;
begin
  perform pg_temp.como(f);
  perform public.guardar_historia_reencuentro(toby, 'Volvió solo a la puerta', false, null);
  perform pg_temp.como(x);
  if (select nombre from public.animales_detalle where id = toby) is not null
     or (select nombre from public.vista_del_caso(toby)) is not null then
    raise exception 'FALLA 7a: X ve el nombre que la familia no quiso mostrar';
  end if;
  foreach u in array array[f, v, m] loop
    perform pg_temp.como(u);
    if (select nombre from public.animales_detalle where id = toby) is distinct from 'Toby' then
      raise exception 'FALLA 7b: % no ve el nombre de Toby', u;
    end if;
  end loop;
end $$;

set local role anon;
do $$
declare
  toby uuid := (select animal from casos where nombre = 'toby');
begin
  perform pg_temp.como(null);
  if (select nombre from public.animales_detalle where id = toby) is not null then
    raise exception 'FALLA 7c: sin cuenta se ve el nombre que la familia no quiso mostrar';
  end if;
  -- La historia sigue en su link, como la contó la familia.
  if (select frase from public.historia_reencuentro(toby)) is distinct from 'Volvió solo a la puerta' then
    raise exception 'FALLA 7d: la historia no se ve sin cuenta';
  end if;
end $$;
set local role authenticated;

-- -----------------------------------------------------------------------------
-- 8. Un caso oculto por moderación no da nada por vista_del_caso.
-- -----------------------------------------------------------------------------
reset role;
update public.animales set oculto = true where id = (select animal from casos where nombre = 'mora');
set local role authenticated;
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002701';
  x constant uuid := '00000000-0000-4000-8000-000000002708';
  mora uuid := (select animal from casos where nombre = 'mora');
begin
  perform pg_temp.como(x);
  if exists (select 1 from public.vista_del_caso(mora)) then
    raise exception 'FALLA 8a: vista_del_caso da un caso oculto';
  end if;
  perform pg_temp.como(f);
  if (select descripcion from public.vista_del_caso(mora)) is distinct from 'Muy mimosa' then
    raise exception 'FALLA 8b: quien lo publicó no ve su caso oculto';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 9. F reabre a Toby: vuelve a verse todo, también sin cuenta. Y al reunirse
--    de nuevo, vuelve a ser solo lo básico.
-- -----------------------------------------------------------------------------
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002701';
  x constant uuid := '00000000-0000-4000-8000-000000002708';
  toby uuid := (select animal from casos where nombre = 'toby');
  unida uuid := (select animal from casos where nombre = 'unida');
  otra uuid := (select animal from casos where nombre = 'otra');
begin
  perform pg_temp.como(f);
  perform public.cambiar_estado_animal(toby, 'avistado');
  perform pg_temp.mira('9a', x, toby, true);
  perform pg_temp.mira('9b', x, unida, true);
  if not exists (select 1 from public.coincidencias where otra in (animal_origen, animal_candidato)) then
    raise exception 'FALLA 9c: X no vuelve a ver su coincidencia con Toby';
  end if;
end $$;

set local role anon;
do $$
begin
  perform pg_temp.mira('9d', null, (select animal from casos where nombre = 'toby'), true);
end $$;
set local role authenticated;

do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002701';
  x constant uuid := '00000000-0000-4000-8000-000000002708';
  toby uuid := (select animal from casos where nombre = 'toby');
begin
  perform pg_temp.como(f);
  perform public.cambiar_estado_animal(toby, 'reunido');
  perform pg_temp.mira('9e', x, toby, false);
  perform pg_temp.mira('9f', f, toby, true);
end $$;

rollback;
