-- =============================================================================
-- 0023 · Auditoría integral 2: topes por cuenta, fotos y textos de la IA
-- 1. Topes por cuenta, configurables en config_app: publicaciones_por_hora_cuenta
--    (10) y avisos_por_hora_cuenta (30, los "lo vi"). Con un candado por
--    cuenta, como reportar_error: dos pedidos a la vez no pasan los dos.
--    Antes, una cuenta con una sola foto podía mandar cientos de avisos y
--    agotar el tope diario de la IA de todos (auditoría 2, S-M4).
-- 2. Una foto se usa en un solo avistamiento (la foto de un caso es la de su
--    primer avistamiento): no se acepta otra vez, ni en otro caso ni en el
--    mismo. Lo revisa un trigger, con su mensaje, y lo garantiza un índice
--    único aunque lleguen dos pedidos a la vez. Las URL de los datos de demo
--    no cuentan (S-M4).
-- 3. es_foto_propia exige el nombre que sube la app, <uid>/<uuid>.jpg: antes
--    aceptaba cualquier nombre dentro de la carpeta, también con "..", "?" o
--    espacios, que el navegador normaliza hacia otras rutas (S-B6).
-- 4. Los textos de la IA no guardan teléfonos, links ni emails: la función
--    reconocer los tapa con "[dato oculto]" (validar.ts) y la base los
--    rechaza como última barrera, con patrones que son una parte de lo que
--    tapa la función (__tests__/datosOcultos.test.ts los compara) (S-M3).
-- Prueba: supabase/tests/auditoria_2.sql. Ver docs/DECISIONES.md, "Topes por
-- cuenta y una foto por aviso", y docs/reportes/2026-10-21-auditoria-2.md.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Topes por cuenta (config_app no se lee desde la API).
-- ---------------------------------------------------------------------------
insert into public.config_app (clave, valor) values
  ('publicaciones_por_hora_cuenta', '10'),
  ('avisos_por_hora_cuenta', '30')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Una foto, un avistamiento.
-- ---------------------------------------------------------------------------
create or replace function public.avistamiento_foto_unica()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.foto_path is not null
     and new.foto_path !~ '^https?://'
     and exists (select 1 from public.avistamientos av where av.foto_path = new.foto_path)
  then
    raise exception 'Esa foto ya está publicada. Sacá o elegí otra.' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.avistamiento_foto_unica from public, anon, authenticated;

create trigger avistamientos_foto_unica
  before insert on public.avistamientos
  for each row
  execute function public.avistamiento_foto_unica();

create unique index avistamientos_foto_unica_idx
  on public.avistamientos (foto_path)
  where foto_path is not null and foto_path !~ '^https?://';

-- ---------------------------------------------------------------------------
-- 3. El nombre que sube la app (src/lib/fotos.ts): <uid>/<uuid>.jpg.
-- ---------------------------------------------------------------------------
create or replace function public.es_foto_propia(p_path text, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_uid is not null
      and p_path ~ (
        '^' || p_uid::text
        || '/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.jpg$'
      )
      and exists (
        select 1 from storage.objects o
        where o.bucket_id = 'fotos' and o.name = p_path
      ),
    false
  );
$$;

revoke all on function public.es_foto_propia from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. RPC con tope: publicar (igual que en 0011, más el tope).
-- ---------------------------------------------------------------------------
create or replace function public.publicar_animal(
  p_especie public.especie,
  p_foto_path text,
  p_lat double precision,
  p_lng double precision,
  p_visto_en timestamptz default now(),
  p_tamanio public.tamanio default null,
  p_color text default null,
  p_tiene_collar boolean default false,
  p_descripcion text default null,
  p_tipo public.tipo_reporte default 'encontrado',
  p_nombre text default null,
  p_contacto_familia text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_tipo public.tipo_reporte := coalesce(p_tipo, 'encontrado');
  v_nombre text := nullif(trim(p_nombre), '');
  v_contacto text := nullif(trim(p_contacto_familia), '');
  v_lat double precision := p_lat;
  v_lng double precision := p_lng;
  v_limite int;
  v_recientes int;
  v_animal_id uuid;
begin
  if v_uid is null then
    raise exception 'Necesitás una cuenta para publicar' using errcode = '42501';
  end if;
  perform public.exigir_terminos();

  -- Tope por hora. El candado hace que dos publicaciones al mismo tiempo de
  -- la misma cuenta no pasen las dos.
  perform pg_advisory_xact_lock(hashtextextended('publicar_animal:' || v_uid::text, 0));
  v_limite := public.config_numero('publicaciones_por_hora_cuenta', 10)::int;
  select count(*) into v_recientes from public.animales
  where creado_por = v_uid and created_at > now() - interval '1 hour';
  if v_recientes >= v_limite then
    raise exception 'Ya publicaste % casos en la última hora. Probá de nuevo más tarde.', v_limite
      using errcode = 'P0001';
  end if;

  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'Ubicación inválida' using errcode = '22023';
  end if;
  if p_foto_path is null or p_foto_path = '' then
    raise exception 'La foto es obligatoria' using errcode = '22023';
  end if;
  if not public.es_foto_propia(p_foto_path, v_uid) then
    raise exception 'La foto tiene que estar subida desde la app' using errcode = '22023';
  end if;
  if char_length(v_nombre) > 40 then
    raise exception 'El nombre puede tener hasta 40 caracteres' using errcode = '22023';
  end if;
  if char_length(v_contacto) > 200 then
    raise exception 'El contacto puede tener hasta 200 caracteres' using errcode = '22023';
  end if;

  if v_tipo = 'perdido' then
    -- Donde lo vieron por última vez suele ser la casa de la familia: se
    -- guarda redondeado a 3 decimales (unos 100 m).
    v_lat := round(p_lat::numeric, 3)::double precision;
    v_lng := round(p_lng::numeric, 3)::double precision;
  else
    -- Quien encuentra no conoce el contacto de la familia.
    v_contacto := null;
  end if;

  insert into public.animales (
    especie, tamanio, color, tiene_collar, descripcion, foto_principal_path, creado_por,
    tipo_reporte, nombre, contacto_familia
  )
  values (
    p_especie, p_tamanio, nullif(trim(p_color), ''), coalesce(p_tiene_collar, false),
    nullif(trim(p_descripcion), ''), p_foto_path, v_uid,
    v_tipo, v_nombre, v_contacto
  )
  returning id into v_animal_id;

  -- El trigger avistamientos_foto_unica rechaza una foto ya publicada.
  insert into public.avistamientos (animal_id, usuario_id, tipo, foto_path, ubicacion, visto_en)
  values (
    v_animal_id,
    v_uid,
    case when v_tipo = 'perdido' then 'perdido' else 'encontrado' end::public.tipo_avistamiento,
    p_foto_path,
    extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography,
    coalesce(p_visto_en, now())
  );

  return v_animal_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. RPC con tope: avisar que lo vio (igual que en 0011, más el tope).
-- ---------------------------------------------------------------------------
create or replace function public.registrar_avistamiento(
  p_animal_id uuid,
  p_foto_path text,
  p_lat double precision,
  p_lng double precision,
  p_visto_en timestamptz default now(),
  p_nota text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_estado public.estado_animal;
  v_limite int;
  v_recientes int;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Necesitás una cuenta para avisar que lo viste' using errcode = '42501';
  end if;
  perform public.exigir_terminos();

  -- Tope por hora, con candado por cuenta (como al publicar).
  perform pg_advisory_xact_lock(hashtextextended('registrar_avistamiento:' || v_uid::text, 0));
  v_limite := public.config_numero('avisos_por_hora_cuenta', 30)::int;
  select count(*) into v_recientes from public.avistamientos
  where usuario_id = v_uid and tipo = 'visto' and created_at > now() - interval '1 hour';
  if v_recientes >= v_limite then
    raise exception 'Ya avisaste % veces en la última hora. Probá de nuevo más tarde.', v_limite
      using errcode = 'P0001';
  end if;

  if p_foto_path is null or p_foto_path = '' then
    raise exception 'La foto es obligatoria' using errcode = '22023';
  end if;
  if not public.es_foto_propia(p_foto_path, v_uid) then
    raise exception 'La foto tiene que estar subida desde la app' using errcode = '22023';
  end if;
  if p_lat is null or p_lng is null or p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    raise exception 'Ubicación inválida' using errcode = '22023';
  end if;

  select estado into v_estado from public.animales where id = p_animal_id;
  if v_estado is null then
    raise exception 'No encontramos este reporte' using errcode = 'P0002';
  end if;
  if v_estado not in ('avistado', 'resguardado') then
    raise exception 'Este caso ya está cerrado' using errcode = '22023';
  end if;

  -- El trigger avistamientos_foto_unica rechaza una foto ya publicada.
  insert into public.avistamientos (animal_id, usuario_id, tipo, foto_path, ubicacion, visto_en, nota)
  values (
    p_animal_id,
    v_uid,
    'visto',
    p_foto_path,
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
    coalesce(p_visto_en, now()),
    nullif(trim(p_nota), '')
  )
  returning id into v_id;

  insert into public.seguimientos (usuario_id, animal_id)
  values (v_uid, p_animal_id)
  on conflict do nothing;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Textos de la IA sin teléfonos, links ni emails.
-- Los patrones son PATRONES_DE_LA_BASE de supabase/functions/reconocer/validar.ts.
-- ---------------------------------------------------------------------------
create or replace function public.tiene_datos_de_contacto(p_texto text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    p_texto ~ '[0-9]([ .()-]*[0-9]){5,}'
      or p_texto ~* '(https?://|www\.|wa\.me)'
      or p_texto ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z0-9]',
    false
  );
$$;

-- Una lista, con un separador que no une un dato entre dos elementos.
create or replace function public.tiene_datos_de_contacto(p_textos text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public.tiene_datos_de_contacto(array_to_string(p_textos, ' | '));
$$;

-- Para lo que ya estaba guardado: tapa lo mismo que rechaza.
create or replace function public.ocultar_datos_de_contacto(p_texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    regexp_replace(
      regexp_replace(p_texto, '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+', '[dato oculto]', 'g'),
      '(https?://|www\.|wa\.me)\S*', '[dato oculto]', 'gi'
    ),
    '[0-9]([ .()-]*[0-9]){5,}', '[dato oculto]', 'g'
  );
$$;

create or replace function public.ocultar_datos_de_contacto(p_textos text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    array(
      select public.ocultar_datos_de_contacto(x)
      from unnest(p_textos) with ordinality as t (x, n)
      order by n
    ),
    '{}'
  );
$$;

revoke all on function public.tiene_datos_de_contacto(text) from public, anon, authenticated;
revoke all on function public.tiene_datos_de_contacto(text[]) from public, anon, authenticated;
revoke all on function public.ocultar_datos_de_contacto(text) from public, anon, authenticated;
revoke all on function public.ocultar_datos_de_contacto(text[]) from public, anon, authenticated;

-- Lo que ya estaba guardado (no debería haber nada), recortado a los topes.
update public.coincidencias
set motivo = left(public.ocultar_datos_de_contacto(motivo), 140)
where public.tiene_datos_de_contacto(motivo);

update public.comparaciones_ia
set motivo = left(public.ocultar_datos_de_contacto(motivo), 140),
    coinciden = public.ocultar_datos_de_contacto(coinciden),
    difieren = public.ocultar_datos_de_contacto(difieren)
where public.tiene_datos_de_contacto(motivo)
   or public.tiene_datos_de_contacto(coinciden)
   or public.tiene_datos_de_contacto(difieren);

update public.descripciones_ia
set rasgos = public.ocultar_datos_de_contacto(rasgos),
    raza_aproximada = left(public.ocultar_datos_de_contacto(raza_aproximada), 60),
    collar_color = left(public.ocultar_datos_de_contacto(collar_color), 40)
where public.tiene_datos_de_contacto(rasgos)
   or public.tiene_datos_de_contacto(raza_aproximada)
   or public.tiene_datos_de_contacto(collar_color);

alter table public.coincidencias
  add constraint coincidencias_motivo_sin_contacto
  check (not public.tiene_datos_de_contacto(motivo));

alter table public.comparaciones_ia
  add constraint comparaciones_ia_sin_contacto
  check (not (
    public.tiene_datos_de_contacto(motivo)
    or public.tiene_datos_de_contacto(coinciden)
    or public.tiene_datos_de_contacto(difieren)
  ));

alter table public.descripciones_ia
  add constraint descripciones_ia_sin_contacto
  check (not (
    public.tiene_datos_de_contacto(rasgos)
    or public.tiene_datos_de_contacto(raza_aproximada)
    or public.tiene_datos_de_contacto(collar_color)
  ));
