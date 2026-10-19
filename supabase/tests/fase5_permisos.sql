-- =============================================================================
-- Pruebas de la Fase 5 (permisos como usuario común).
-- Requiere las migraciones 0001 a 0011. Pegalo entero en el SQL Editor y tocá Run.
-- Bien: termina en "Success. No rows returned". Mal: ERROR con "FALLA n: ..." que dice qué.
-- Todo corre dentro de begin/rollback: no deja usuarios, fotos, animales ni mensajes.
-- Adaptado a la 0010 (la foto tiene que estar subida a la carpeta del usuario) y
-- a la 0011 (para publicar hay que tener aceptados los términos).
-- =============================================================================
begin;

-- Datos de prueba, creados como postgres: A (usuario común), B (otro usuario),
-- un animal de A y un mensaje de B para A.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000a1', 'prueba-a@encontrados.test', '{"nombre_publico":"Prueba A"}'),
  ('00000000-0000-4000-8000-0000000000b2', 'prueba-b@encontrados.test', '{"nombre_publico":"Prueba B"}');
insert into public.animales (id, especie, foto_principal_path, creado_por)
values ('00000000-0000-4000-8000-0000000000c3', 'perro',
        '00000000-0000-4000-8000-0000000000a1/prueba.jpg', '00000000-0000-4000-8000-0000000000a1');
insert into public.conversaciones (id, animal_id, participante_a, participante_b)
values ('00000000-0000-4000-8000-0000000000e5', '00000000-0000-4000-8000-0000000000c3',
        '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b2');
insert into public.mensajes (id, conversacion_id, emisor_id, cuerpo)
values ('00000000-0000-4000-8000-0000000000d4', '00000000-0000-4000-8000-0000000000e5',
        '00000000-0000-4000-8000-0000000000b2', 'Hola, creo que es mi perro');

-- A aceptó los términos y subió desde la app la foto con la que va a publicar.
update public.perfiles
set terminos_version = public.version_terminos(), terminos_aceptados_en = now()
where id = '00000000-0000-4000-8000-0000000000a1';
insert into storage.objects (bucket_id, name)
values ('fotos', '00000000-0000-4000-8000-0000000000a1/prueba2.jpg');

-- Desde acá, todo corre como A, igual que una llamada desde la app.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

do $$
declare
  v_animal uuid;
  v_filas int;
begin
  -- 1. No puede hacerse moderador.
  begin
    update public.perfiles set es_moderador = true where id = auth.uid();
    raise exception 'FALLA 1: un usuario común pudo ponerse es_moderador = true';
  exception when insufficient_privilege then null;
  end;

  -- 2. No puede insertar en cambios_estado ("volvió con su familia") ni cargar un
  -- contacto falso (desde la 0011 el contacto vive en contactos_resguardo).
  begin
    insert into public.cambios_estado (animal_id, usuario_id, estado_anterior, estado_nuevo)
    values ('00000000-0000-4000-8000-0000000000c3', auth.uid(), 'avistado', 'resguardado');
    raise exception 'FALLA 2a: un usuario común pudo insertar en cambios_estado';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.contactos_resguardo (cambio_id, animal_id, usuario_id, contacto)
    values (gen_random_uuid(), '00000000-0000-4000-8000-0000000000c3', auth.uid(), 'Llamá al 099 000 000');
    raise exception 'FALLA 2b: un usuario común pudo cargar un contacto de resguardo';
  exception when insufficient_privilege then null;
  end;

  -- 3. No puede editar el cuerpo de un mensaje ajeno...
  begin
    update public.mensajes set cuerpo = 'texto cambiado' where id = '00000000-0000-4000-8000-0000000000d4';
    raise exception 'FALLA 3: un usuario común pudo editar un mensaje ajeno';
  exception when insufficient_privilege then null;
  end;

  -- ...pero sí marcarlo como leído.
  update public.mensajes set leido_en = now() where id = '00000000-0000-4000-8000-0000000000d4';
  get diagnostics v_filas = row_count;
  if v_filas <> 1 then
    raise exception 'FALLA 4: no pudo marcar como leído un mensaje recibido';
  end if;

  -- 5. publicar_animal sigue funcionando.
  v_animal := public.publicar_animal('gato', auth.uid()::text || '/prueba2.jpg', -34.9, -56.16);
  if v_animal is null then
    raise exception 'FALLA 5: publicar_animal no devolvió el id';
  end if;
end $$;

rollback;
