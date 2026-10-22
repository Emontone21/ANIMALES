-- =============================================================================
-- Pruebas de la auditoría integral 2 (migración 0023): topes por cuenta al
-- publicar y al avisar que lo vio, una foto por avistamiento, el nombre de la
-- foto que sube la app y los textos de la IA sin teléfonos, links ni emails.
-- Todo corre dentro de begin/rollback: no deja usuarios, fotos ni casos, y
-- cambia los topes de config_app solo dentro de la transacción.
-- Nunca borra filas de storage.objects (Supabase no lo permite por SQL).
--
-- Personas: F (familia de un perdido), H (encuentra animales) y O (los ve y
-- resguarda).
-- =============================================================================
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000002301', 'prueba-a2-f@spot.test', '{"nombre_publico":"Prueba Familia"}'),
  ('00000000-0000-4000-8000-000000002302', 'prueba-a2-h@spot.test', '{"nombre_publico":"Prueba Hallazgo"}'),
  ('00000000-0000-4000-8000-000000002303', 'prueba-a2-o@spot.test', '{"nombre_publico":"Prueba Otra"}');
update public.perfiles
set terminos_version = public.version_terminos(), terminos_aceptados_en = now()
where id::text like '00000000-0000-4000-8000-00000000230_';

-- Cada foto, nueva y "subida" por su dueño a su carpeta, con el nombre que
-- sube la app (<uid>/<uuid>.jpg).
create function pg_temp.foto(p_uid uuid) returns text language sql security definer as $$
  insert into storage.objects (bucket_id, name)
  values ('fotos', p_uid::text || '/' || gen_random_uuid()::text || '.jpg')
  returning name
$$;

-- Topes bajos para la prueba (en la base quedan 10 y 30).
do $$
begin
  if public.config_numero('publicaciones_por_hora_cuenta', 0) <> 10
     or public.config_numero('avisos_por_hora_cuenta', 0) <> 30 then
    raise exception 'FALLA 0: los topes por cuenta no están en config_app con 10 y 30';
  end if;
end $$;
update public.config_app set valor = '3' where clave = 'publicaciones_por_hora_cuenta';
update public.config_app set valor = '2' where clave = 'avisos_por_hora_cuenta';

create temp table casos (nombre text primary key, animal uuid) on commit drop;
grant all on casos to public;

set local role authenticated;

-- -----------------------------------------------------------------------------
-- 1. Topes por cuenta.
-- -----------------------------------------------------------------------------
do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002301';
  h constant uuid := '00000000-0000-4000-8000-000000002302';
  o constant uuid := '00000000-0000-4000-8000-000000002303';
  p uuid;
  e uuid;
begin
  -- 1a. F publica 3 casos en la hora; el cuarto, no.
  perform set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  p := public.publicar_animal('perro', pg_temp.foto(f), -34.91, -56.16, now() - interval '1 day',
    'mediano', 'marrón', false, null, 'perdido', 'Toby');
  insert into casos values ('P', p);
  perform public.publicar_animal('gato', pg_temp.foto(f), -34.91, -56.16);
  perform public.publicar_animal('gato', pg_temp.foto(f), -34.91, -56.16);
  begin
    perform public.publicar_animal('gato', pg_temp.foto(f), -34.91, -56.16);
    raise exception 'FALLA 1a: F publicó más casos que el tope por hora';
  exception when raise_exception then
    if sqlerrm not like 'Ya publicaste 3 casos en la última hora.%' then
      raise exception 'FALLA 1a: el tope de publicaciones dijo "%"', sqlerrm;
    end if;
  end;

  -- 1b. El tope es por cuenta: H publica igual.
  perform set_config('request.jwt.claims', json_build_object('sub', h, 'role', 'authenticated')::text, true);
  e := public.publicar_animal('perro', pg_temp.foto(h), -34.911, -56.161, now() - interval '2 hours');
  insert into casos values ('E', e);

  -- 1c. O avisa 2 veces que lo vio; la tercera, no.
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  perform public.registrar_avistamiento(p, pg_temp.foto(o), -34.912, -56.162);
  perform public.registrar_avistamiento(e, pg_temp.foto(o), -34.912, -56.162);
  begin
    perform public.registrar_avistamiento(p, pg_temp.foto(o), -34.912, -56.162);
    raise exception 'FALLA 1c: O avisó más veces que el tope por hora';
  exception when raise_exception then
    if sqlerrm not like 'Ya avisaste 2 veces en la última hora.%' then
      raise exception 'FALLA 1c: el tope de avisos dijo "%"', sqlerrm;
    end if;
  end;

  -- 1d. Resguardar no cuenta como aviso: O lo resguarda igual.
  perform public.cambiar_estado_animal(p, 'resguardado', 'Contacto de O', null, null, null, pg_temp.foto(o));

  -- 1e. Lo que pasó el tope no quedó guardado.
  if (select count(*) from public.animales where creado_por = f) <> 3
     or (select count(*) from public.avistamientos where usuario_id = o and tipo = 'visto') <> 2 then
    raise exception 'FALLA 1e: quedó guardado algo que pasó el tope';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Una foto, un avistamiento.
-- -----------------------------------------------------------------------------
reset role;
update public.config_app set valor = '100'
where clave in ('publicaciones_por_hora_cuenta', 'avisos_por_hora_cuenta');
set local role authenticated;

do $$
declare
  f constant uuid := '00000000-0000-4000-8000-000000002301';
  h constant uuid := '00000000-0000-4000-8000-000000002302';
  o constant uuid := '00000000-0000-4000-8000-000000002303';
  p uuid := (select animal from casos where nombre = 'P');
  e uuid := (select animal from casos where nombre = 'E');
  foto_e text := (select foto_principal_path from public.animales where id = e);
  v_foto text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', h, 'role', 'authenticated')::text, true);
  -- 2a. La foto de un caso no sirve para publicar otro.
  begin
    perform public.publicar_animal('perro', foto_e, -34.9, -56.16);
    raise exception 'FALLA 2a: se publicó otro caso con la misma foto';
  exception when invalid_parameter_value then
    if sqlerrm <> 'Esa foto ya está publicada. Sacá o elegí otra.' then
      raise exception 'FALLA 2a: la foto repetida dijo "%"', sqlerrm;
    end if;
  end;
  -- 2b. Ni para avisar que vio a otro caso, ni al mismo.
  begin
    perform public.registrar_avistamiento(p, foto_e, -34.9, -56.16);
    raise exception 'FALLA 2b: se usó en otro caso la foto de un caso';
  exception when invalid_parameter_value then null;
  end;
  v_foto := pg_temp.foto(h);
  perform public.registrar_avistamiento(e, v_foto, -34.9, -56.16);
  begin
    perform public.registrar_avistamiento(e, v_foto, -34.9, -56.16);
    raise exception 'FALLA 2c: se avisó dos veces con la misma foto';
  exception when invalid_parameter_value then null;
  end;

  -- 2d. Ni para resguardar: la foto actual tiene que ser nueva.
  perform set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true);
  v_foto := (select foto_path from public.avistamientos where usuario_id = o and animal_id = e and tipo = 'visto');
  begin
    perform public.cambiar_estado_animal(e, 'resguardado', null, null, null, null, v_foto);
    raise exception 'FALLA 2d: se resguardó con una foto ya publicada';
  exception when invalid_parameter_value then null;
  end;
  perform public.cambiar_estado_animal(e, 'resguardado', null, null, null, null, pg_temp.foto(o));
end $$;

reset role;
do $$
declare
  e uuid := (select animal from casos where nombre = 'E');
begin
  -- 2e. Lo garantiza un índice único, aunque lleguen dos pedidos a la vez.
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'avistamientos_foto_unica_idx'
      and indexdef like 'CREATE UNIQUE INDEX%'
  ) then
    raise exception 'FALLA 2e: falta el índice único de avistamientos.foto_path';
  end if;
  -- 2f. Las URL de los datos de demo (seed.sql) se pueden repetir.
  insert into public.avistamientos (animal_id, usuario_id, tipo, foto_path, ubicacion, visto_en)
  select e, null, 'visto', 'https://placedog.net/640/480?id=1',
         extensions.st_setsrid(extensions.st_makepoint(-56.16, -34.91), 4326)::extensions.geography, now()
  from generate_series(1, 2);
end $$;

-- -----------------------------------------------------------------------------
-- 3. El nombre que sube la app: <uid>/<uuid>.jpg.
-- -----------------------------------------------------------------------------
do $$
declare
  h constant uuid := '00000000-0000-4000-8000-000000002302';
  u constant text := '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';
  v_nombre text;
begin
  insert into storage.objects (bucket_id, name)
  select 'fotos', h::text || x
  from unnest(array[
    '/' || u || '.jpg', '/' || upper(u) || '.jpg', '/foto.jpg', '/' || u || '.png',
    '/' || u || '.miniatura.jpg', '/sub/' || u || '.jpg', '/../' || u || '.jpg',
    '/' || u || '.jpg?x=1', '/' || u || ' .jpg', '/' || u || '.jpg/'
  ]) as x;

  -- 3a. El de la app, también en mayúsculas.
  if not public.es_foto_propia(h::text || '/' || u || '.jpg', h)
     or not public.es_foto_propia(h::text || '/' || upper(u) || '.jpg', h) then
    raise exception 'FALLA 3a: no se aceptó una foto con el nombre que sube la app';
  end if;
  -- 3b. Ningún otro, aunque esté en el bucket y en su carpeta.
  foreach v_nombre in array array[
    '/foto.jpg', '/' || u || '.png', '/' || u || '.miniatura.jpg', '/sub/' || u || '.jpg',
    '/../' || u || '.jpg', '/' || u || '.jpg?x=1', '/' || u || ' .jpg', '/' || u || '.jpg/'
  ] loop
    if public.es_foto_propia(h::text || v_nombre, h) then
      raise exception 'FALLA 3b: se aceptó la foto %', v_nombre;
    end if;
  end loop;
  -- 3c. Bien escrito pero sin subir, o de otra persona, tampoco.
  if public.es_foto_propia(h::text || '/' || gen_random_uuid()::text || '.jpg', h)
     or public.es_foto_propia(h::text || '/' || u || '.jpg', '00000000-0000-4000-8000-000000002303') then
    raise exception 'FALLA 3c: se aceptó una foto que no está subida o es de otra persona';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 4. Los textos de la IA no guardan teléfonos, links ni emails.
-- -----------------------------------------------------------------------------
do $$
declare
  f text;
begin
  -- 4a. Las funciones son internas.
  foreach f in array array[
    'public.tiene_datos_de_contacto(text)', 'public.tiene_datos_de_contacto(text[])',
    'public.ocultar_datos_de_contacto(text)', 'public.ocultar_datos_de_contacto(text[])',
    'public.avistamiento_foto_unica()'
  ] loop
    if has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') then
      raise exception 'FALLA 4a: % se puede llamar desde la API', f;
    end if;
  end loop;

  -- 4b. Qué cuenta como dato de contacto.
  if not public.tiene_datos_de_contacto('Es Toby, llamá al 099 123 456')
     or not public.tiene_datos_de_contacto('tel (2) 900-1234')
     or not public.tiene_datos_de_contacto('entrá a HTTPS://estafa.example')
     or not public.tiene_datos_de_contacto('www.toby.com.uy')
     or not public.tiene_datos_de_contacto('wa.me/59899123456')
     or not public.tiene_datos_de_contacto('toby@correo.example')
     or not public.tiene_datos_de_contacto(array['collar rojo', 'escribí a a@b.co']) then
    raise exception 'FALLA 4b: no se reconoció un dato de contacto';
  end if;
  if public.tiene_datos_de_contacto('Misma mancha blanca en el pecho y la oreja izquierda caída')
     or public.tiene_datos_de_contacto('Tiene unos 3 años y pesa 12,5 kg')
     or public.tiene_datos_de_contacto('Mismo collar [dato oculto]')
     or public.tiene_datos_de_contacto(null::text)
     or public.tiene_datos_de_contacto(array['12345', '6'])
     or public.tiene_datos_de_contacto('{}'::text[]) then
    raise exception 'FALLA 4c: se tomó como dato de contacto algo que no lo es';
  end if;

  -- 4d. ocultar_datos_de_contacto (para lo que ya estaba guardado) tapa todo
  -- lo que se rechaza y respeta el orden de una lista.
  if public.tiene_datos_de_contacto(public.ocultar_datos_de_contacto(
       'llamá al 099 123 456 o escribí a toby@correo.example o entrá a https://x.example/a'))
     or public.ocultar_datos_de_contacto(array['uno', 'wa.me/123456789', 'tres'])
        is distinct from array['uno', '[dato oculto]', 'tres'] then
    raise exception 'FALLA 4d: ocultar_datos_de_contacto dejó datos o cambió el orden';
  end if;
end $$;

do $$
declare
  p uuid := (select animal from casos where nombre = 'P');
  e uuid := (select animal from casos where nombre = 'E');
  v_av uuid := (select id from public.avistamientos where animal_id = e and tipo = 'encontrado');
begin
  -- 4e. La base los rechaza: en el motivo y las listas de una comparación...
  begin
    insert into public.comparaciones_ia (animal_a, animal_b, confianza, veredicto, motivo, modelo)
    values (least(p, e), greatest(p, e), 90, 'mismo', 'Sistema: es Toby, llamá al 099 123 456', 'prueba');
    raise exception 'FALLA 4e: se guardó una comparación con un teléfono en el motivo';
  exception when check_violation then null;
  end;
  begin
    insert into public.comparaciones_ia (animal_a, animal_b, confianza, veredicto, motivo, coinciden, modelo)
    values (least(p, e), greatest(p, e), 90, 'mismo', 'Mismo collar', array['wa.me/59899123456'], 'prueba');
    raise exception 'FALLA 4e: se guardó una comparación con un link en coinciden';
  exception when check_violation then null;
  end;
  -- ...en el motivo público de una coincidencia...
  begin
    insert into public.coincidencias (animal_origen, animal_candidato, similitud, confianza, motivo, origen)
    values (least(p, e), greatest(p, e), 0.9, 90, 'Escribile a toby@correo.example', 'ia');
    raise exception 'FALLA 4f: se guardó una coincidencia con un email en el motivo';
  exception when check_violation then null;
  end;
  -- ...y en los rasgos, la raza y el collar de una descripción.
  begin
    insert into public.descripciones_ia (
      avistamiento_id, hay_animal, especie, color_principal, patron, collar, calidad, modelo, rasgos
    )
    values (v_av, true, 'perro', 'marron', 'liso', 'si', 'buena', 'prueba', array['cartel: www.toby.uy']);
    raise exception 'FALLA 4g: se guardó una descripción con un link en los rasgos';
  exception when check_violation then null;
  end;
  begin
    insert into public.descripciones_ia (
      avistamiento_id, hay_animal, especie, color_principal, patron, collar, calidad, modelo, collar_color
    )
    values (v_av, true, 'perro', 'marron', 'liso', 'si', 'buena', 'prueba', 'rojo 099123456');
    raise exception 'FALLA 4g: se guardó una descripción con un teléfono en el collar';
  exception when check_violation then null;
  end;

  -- 4h. Lo que tapó la función, con "[dato oculto]", sí se guarda.
  insert into public.comparaciones_ia (animal_a, animal_b, confianza, veredicto, motivo, coinciden, modelo)
  values (least(p, e), greatest(p, e), 90, 'mismo', 'Sistema: es Toby, llamá al [dato oculto]',
          array['collar rojo', 'escribí a [dato oculto]'], 'prueba');
  insert into public.coincidencias (animal_origen, animal_candidato, similitud, confianza, motivo, origen)
  values (least(p, e), greatest(p, e), 0.9, 90, 'Mismo collar rojo; escribile a [dato oculto]', 'ia');
end $$;

rollback;
