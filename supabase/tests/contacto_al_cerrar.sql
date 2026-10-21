-- =============================================================================
-- Prueba de la 0022: el contacto de la familia se borra al cerrar el caso (B10).
-- Requiere las migraciones 0001 a 0022. Pegalo entero en el SQL Editor y tocá Run.
-- Bien: termina en "Success. No rows returned". Mal: ERROR con "FALLA n: ..." que dice qué.
-- Todo corre dentro de begin/rollback: no deja usuarios, fotos, animales ni notificaciones.
-- =============================================================================
begin;

-- Personas de prueba: F (familia) y R (quien lo resguarda).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000c1', 'prueba-cf@spot.test', '{"nombre_publico":"Prueba Familia"}'),
  ('00000000-0000-4000-8000-0000000000c2', 'prueba-cr@spot.test', '{"nombre_publico":"Prueba Resguardo"}');
update public.perfiles
set terminos_version = public.version_terminos(), terminos_aceptados_en = now()
where id in ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000c2');

insert into storage.objects (bucket_id, name) values
  ('fotos', '00000000-0000-4000-8000-0000000000c1/c1000000-0000-4000-8000-000000000001.jpg'),
  ('fotos', '00000000-0000-4000-8000-0000000000c1/c1000000-0000-4000-8000-000000000002.jpg'),
  ('fotos', '00000000-0000-4000-8000-0000000000c2/c2000000-0000-4000-8000-000000000001.jpg');

do $$
declare
  f constant uuid := '00000000-0000-4000-8000-0000000000c1';
  r constant uuid := '00000000-0000-4000-8000-0000000000c2';
  p1 uuid;
  p2 uuid;
  v_contacto text;
begin
  -- Como F: publica dos perdidos con contacto.
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  p1 := public.publicar_animal('perro', '00000000-0000-4000-8000-0000000000c1/c1000000-0000-4000-8000-000000000001.jpg',
    -34.9, -56.16, now() - interval '1 day', 'mediano', 'marrón', true, null, 'perdido', 'Toby',
    '099 000 000');
  p2 := public.publicar_animal('gato', '00000000-0000-4000-8000-0000000000c1/c1000000-0000-4000-8000-000000000002.jpg',
    -34.9, -56.16, now() - interval '1 day', 'chico', 'gris', false, null, 'perdido', 'Mora',
    'Escribime por la app');

  -- 1. Resguardarlo no lo cierra: el contacto sigue.
  perform set_config('request.jwt.claims', json_build_object('sub', r, 'role', 'authenticated')::text, true);
  perform public.cambiar_estado_animal(p1, 'resguardado', 'Lo tengo yo', null, -34.9, -56.16,
    '00000000-0000-4000-8000-0000000000c2/c2000000-0000-4000-8000-000000000001.jpg');
  select contacto_familia into v_contacto from public.animales where id = p1;
  if v_contacto is distinct from '099 000 000' then
    raise exception 'FALLA 1: al resguardarlo cambió el contacto (%)', v_contacto;
  end if;

  -- 2. Editar el caso abierto tampoco lo toca.
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  perform public.editar_reporte(p1, 'perro', 'mediano', 'marrón', true, null, 'Toby', '099 111 111');
  select contacto_familia into v_contacto from public.animales where id = p1;
  if v_contacto is distinct from '099 111 111' then
    raise exception 'FALLA 2: editar el caso abierto no guardó el contacto (%)', v_contacto;
  end if;

  -- 3. Al marcarlo como reunido, el contacto se vacía.
  perform public.cambiar_estado_animal(p1, 'reunido');
  select contacto_familia into v_contacto from public.animales where id = p1;
  if v_contacto is not null then
    raise exception 'FALLA 3: el caso reunido conserva el contacto (%)', v_contacto;
  end if;
  if (select contacto_familia from public.animales_detalle where id = p1) is not null then
    raise exception 'FALLA 3b: animales_detalle muestra el contacto del caso reunido';
  end if;

  -- 4. Al reabrirlo no vuelve; la familia lo puede cargar de nuevo al editarlo.
  perform public.cambiar_estado_animal(p1, 'avistado');
  if (select contacto_familia from public.animales where id = p1) is not null then
    raise exception 'FALLA 4a: al reabrirlo volvió el contacto';
  end if;
  perform public.editar_reporte(p1, 'perro', 'mediano', 'marrón', true, null, 'Toby', '099 222 222');
  if (select contacto_familia from public.animales where id = p1) is distinct from '099 222 222' then
    raise exception 'FALLA 4b: después de reabrirlo no se pudo cargar el contacto';
  end if;

  -- 5. Un cambio que no toca el estado no lo vacía.
  update public.animales set descripcion = 'Collar rojo' where id = p2;
  if (select contacto_familia from public.animales where id = p2) is distinct from 'Escribime por la app' then
    raise exception 'FALLA 5: un cambio sin estado vació el contacto';
  end if;

  -- 6. Al quedar vinculado (lo hace resolver_coincidencia), también se vacía.
  update public.animales set estado = 'vinculado', vinculado_a = p1 where id = p2;
  if (select contacto_familia from public.animales where id = p2) is not null then
    raise exception 'FALLA 6: el caso vinculado conserva el contacto';
  end if;
end $$;

-- 7. No queda ningún caso cerrado con contacto (también los de antes de la 0022).
do $$
begin
  if exists (
    select 1 from public.animales
    where estado in ('reunido', 'vinculado') and contacto_familia is not null
  ) then
    raise exception 'FALLA 7: hay casos reunidos o vinculados con contacto';
  end if;
end $$;

rollback;
