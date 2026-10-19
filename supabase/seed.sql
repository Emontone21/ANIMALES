-- =============================================================================
-- Datos de demo: se cargan una vez en el SQL Editor (ver README, paso 1.4).
-- Crea una usuaria demo, tres animales encontrados y uno perdido en Montevideo.
--   email: demo@encontrados.uy · contraseña: demo1234
-- Las fotos de demo apuntan a servicios públicos de imágenes de prueba;
-- las fotos reales viven en el bucket "fotos".
-- =============================================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'demo@encontrados.uy',
  extensions.crypt('demo1234', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"nombre_publico":"Demo Montevideo"}',
  now(),
  now(),
  '', '', '', ''
)
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
values (
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  '{"sub":"a0000000-0000-4000-8000-000000000001","email":"demo@encontrados.uy"}',
  'email',
  now(), now(), now()
)
on conflict (provider_id, provider) do nothing;

-- El trigger on_auth_user_created ya creó el perfil. Animales de ejemplo:

-- Perro en Parque Rodó
insert into public.animales (id, especie, tamanio, color, tiene_collar, descripcion, foto_principal_path, creado_por)
values (
  'b0000000-0000-4000-8000-000000000001', 'perro', 'mediano', 'marrón con pecho blanco', true,
  'Muy manso, se acercó solo. Tenía collar rojo sin chapita.',
  'https://placedog.net/640/480?id=12', 'a0000000-0000-4000-8000-000000000001'
);
insert into public.avistamientos (animal_id, usuario_id, tipo, foto_path, ubicacion, visto_en)
values (
  'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'encontrado',
  'https://placedog.net/640/480?id=12',
  extensions.st_setsrid(extensions.st_makepoint(-56.1680, -34.9150), 4326)::extensions.geography,
  now() - interval '3 hours'
);

-- Gato en Pocitos, visto dos veces
insert into public.animales (id, especie, tamanio, color, tiene_collar, descripcion, foto_principal_path, creado_por)
values (
  'b0000000-0000-4000-8000-000000000002', 'gato', 'chico', 'gris atigrado', false,
  'Anda por la azotea de un edificio en Benito Blanco. Parece de casa.',
  'https://cataas.com/cat?width=640&height=480&id=1', 'a0000000-0000-4000-8000-000000000001'
);
insert into public.avistamientos (animal_id, usuario_id, tipo, foto_path, ubicacion, visto_en, nota)
values
  (
    'b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'encontrado',
    'https://cataas.com/cat?width=640&height=480&id=1',
    extensions.st_setsrid(extensions.st_makepoint(-56.1510, -34.9120), 4326)::extensions.geography,
    now() - interval '2 days', null
  ),
  (
    'b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'visto',
    'https://cataas.com/cat?width=640&height=480&id=2',
    extensions.st_setsrid(extensions.st_makepoint(-56.1495, -34.9105), 4326)::extensions.geography,
    now() - interval '1 day', 'Lo vi otra vez, ahora en la vereda de enfrente.'
  );

-- Perro resguardado en el Cerro
insert into public.animales (id, especie, tamanio, color, tiene_collar, descripcion, estado, foto_principal_path, creado_por)
values (
  'b0000000-0000-4000-8000-000000000003', 'perro', 'grande', 'negro', false,
  'Lo tengo en casa hasta que aparezca la familia.', 'resguardado',
  'https://placedog.net/640/480?id=31', 'a0000000-0000-4000-8000-000000000001'
);
insert into public.avistamientos (animal_id, usuario_id, tipo, foto_path, ubicacion, visto_en)
values (
  'b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'encontrado',
  'https://placedog.net/640/480?id=31',
  extensions.st_setsrid(extensions.st_makepoint(-56.2560, -34.8880), 4326)::extensions.geography,
  now() - interval '6 days'
);

-- Perro perdido a unos 300 m del perro encontrado en Parque Rodó: sirve para
-- probar el mapa (anillo y halo naranja) y, con el servicio de visión andando,
-- una posible coincidencia. Como en publicar_animal, la ubicación de un perdido
-- se guarda redondeada a 3 decimales (unos 100 m).
insert into public.animales (
  id, especie, tamanio, color, tiene_collar, descripcion, foto_principal_path, creado_por,
  tipo_reporte, nombre, contacto_familia
)
values (
  'b0000000-0000-4000-8000-000000000004', 'perro', 'mediano', 'marrón con pecho blanco', true,
  'Collar rojo. Es miedoso con las motos y responde a su nombre.',
  'https://placedog.net/640/480?id=12', 'a0000000-0000-4000-8000-000000000001',
  'perdido', 'Toby', 'Escribinos por la app'
);
insert into public.avistamientos (animal_id, usuario_id, tipo, foto_path, ubicacion, visto_en, nota)
values (
  'b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'perdido',
  'https://placedog.net/640/480?id=12',
  extensions.st_setsrid(extensions.st_makepoint(-56.166, -34.913), 4326)::extensions.geography,
  now() - interval '1 day', 'Se escapó cuando abrimos el portón.'
);
