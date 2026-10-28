-- =============================================================================
-- Pruebas del panel de administración (migración 0028): administradores,
-- es_admin() y admin_resumen().
-- Requiere las migraciones 0001 a 0028. Pegalo entero en el SQL Editor y tocá Run.
-- Bien: termina en "Success. No rows returned". Mal: ERROR con "FALLA n: ..." que dice qué.
-- Todo corre dentro de begin/rollback: no deja usuarios, casos ni administradores.
--
-- A: una cuenta en administradores. N: una cuenta común.
-- =============================================================================
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000002801', 'prueba-panel-a@spot.test', '{"nombre_publico":"Prueba Admin"}'),
  ('00000000-0000-4000-8000-000000002802', 'prueba-panel-n@spot.test', '{"nombre_publico":"Prueba Comun"}');
insert into public.administradores (usuario_id) values ('00000000-0000-4000-8000-000000002801');

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

-- Lo que hay ahora, para comparar después de agregar casos.
create temp table antes as select public.admin_resumen() as r from (select 1) x where false;
grant all on antes to authenticated;
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-000000002801');
end $$;
set local role authenticated;
insert into antes select public.admin_resumen();
reset role;

-- 1. Sin cuenta: ni es_admin ni el resumen.
set local role anon;
do $$
begin
  perform pg_temp.como(null);
  perform pg_temp.falla('select public.es_admin()', '42501', '1a');
  perform pg_temp.falla('select public.admin_resumen()', '42501', '1b');
end $$;

-- 2. Una cuenta común: es_admin es false y el resumen no se le da.
set local role authenticated;
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-000000002802');
  if public.es_admin() then
    raise exception 'FALLA 2a: una cuenta común es administradora';
  end if;
  perform pg_temp.falla('select public.admin_resumen()', '42501', '2b');
end $$;

-- 3. Nadie toca la tabla por la API, ni siquiera quien está en ella.
do $$
begin
  perform pg_temp.como('00000000-0000-4000-8000-000000002802');
  perform pg_temp.falla('select * from public.administradores', '42501', '3a');
  perform pg_temp.falla(
    'insert into public.administradores (usuario_id) values (''00000000-0000-4000-8000-000000002802'')',
    '42501', '3b');
  perform pg_temp.como('00000000-0000-4000-8000-000000002801');
  perform pg_temp.falla('select * from public.administradores', '42501', '3c');
  perform pg_temp.falla(
    'delete from public.administradores where usuario_id = ''00000000-0000-4000-8000-000000002801''',
    '42501', '3d');
end $$;

-- 4. Un administrador recibe el resumen con todas sus claves.
do $$
declare
  r jsonb;
  clave text;
begin
  perform pg_temp.como('00000000-0000-4000-8000-000000002801');
  if not public.es_admin() then
    raise exception 'FALLA 4a: el administrador no es administrador';
  end if;
  r := public.admin_resumen();
  foreach clave in array array['generado_en', 'casos', 'coincidencias', 'moderacion', 'usuarios', 'vision', 'almacenamiento'] loop
    if not r ? clave then
      raise exception 'FALLA 4b: falta la clave %', clave;
    end if;
  end loop;
  if jsonb_array_length(r -> 'casos' -> 'por_dia') <> 7 then
    raise exception 'FALLA 4c: por_dia no tiene 7 días';
  end if;
  if (r -> 'casos' -> 'por_dia' -> 6 ->> 'dia') <> to_char(now() at time zone 'America/Montevideo', 'YYYY-MM-DD') then
    raise exception 'FALLA 4d: el último día de por_dia no es hoy en Montevideo';
  end if;
  if (r -> 'almacenamiento' ->> 'base_bytes')::bigint <= 0 then
    raise exception 'FALLA 4e: la base no tiene tamaño';
  end if;
  if jsonb_typeof(r -> 'vision' -> 'ia_activa') <> 'boolean' then
    raise exception 'FALLA 4f: ia_activa no es booleano';
  end if;
  if r::text ~* '@|nombre_publico|descripcion' then
    raise exception 'FALLA 4g: el resumen trae algo que no es un número';
  end if;
end $$;

-- 5. Los conteos: un caso nuevo suma, uno de demo no, uno oculto suma en
-- nuevos y en ocultos; una cuenta nueva suma en usuarios.
reset role;
insert into public.animales (especie, foto_principal_path, creado_por) values
  ('perro', '00000000-0000-4000-8000-000000002802/' || gen_random_uuid() || '.jpg', '00000000-0000-4000-8000-000000002802'),
  ('gato', 'https://ejemplo.org/demo.jpg', '00000000-0000-4000-8000-000000002802');
insert into public.animales (especie, foto_principal_path, creado_por, oculto) values
  ('perro', '00000000-0000-4000-8000-000000002802/' || gen_random_uuid() || '.jpg', '00000000-0000-4000-8000-000000002802', true);

set local role authenticated;
do $$
declare
  a jsonb := (select r from antes);
  d jsonb;
begin
  perform pg_temp.como('00000000-0000-4000-8000-000000002801');
  d := public.admin_resumen();
  if (d -> 'casos' ->> 'nuevos_24h')::int - (a -> 'casos' ->> 'nuevos_24h')::int <> 2 then
    raise exception 'FALLA 5a: nuevos_24h no sumó 2 (el de demo no cuenta)';
  end if;
  if (d -> 'casos' ->> 'nuevos_7d')::int - (a -> 'casos' ->> 'nuevos_7d')::int <> 2 then
    raise exception 'FALLA 5b: nuevos_7d no sumó 2';
  end if;
  if (d -> 'casos' -> 'por_dia' -> 6 ->> 'casos')::int - (a -> 'casos' -> 'por_dia' -> 6 ->> 'casos')::int <> 2 then
    raise exception 'FALLA 5c: la barra de hoy no sumó 2';
  end if;
  if (d -> 'casos' ->> 'abiertos')::int - (a -> 'casos' ->> 'abiertos')::int <> 1 then
    raise exception 'FALLA 5d: abiertos no sumó 1 (el oculto no cuenta)';
  end if;
  if (d -> 'moderacion' ->> 'casos_ocultos')::int - (a -> 'moderacion' ->> 'casos_ocultos')::int <> 1 then
    raise exception 'FALLA 5e: casos_ocultos no sumó 1';
  end if;
end $$;

-- 6. Al borrar la cuenta del administrador se borra su fila.
reset role;
delete from auth.users where id = '00000000-0000-4000-8000-000000002801';
do $$
begin
  if exists (select 1 from public.administradores where usuario_id = '00000000-0000-4000-8000-000000002801') then
    raise exception 'FALLA 6a: quedó la fila de una cuenta borrada';
  end if;
end $$;

rollback;
