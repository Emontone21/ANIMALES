-- =============================================================================
-- 0010 · Fase 6 (2 de 2): reportes de animales perdidos
-- Además de quien encuentra un animal, ahora publica la familia que lo perdió.
-- Los dos tipos conviven en animales, así reutilizan mapa, avistamientos,
-- seguimientos, mensajería y coincidencias.
--   · animales: tipo_reporte, nombre y contacto_familia.
--   · publicar_animal: recibe el tipo; en los perdidos redondea la ubicación.
--   · publicar_animal y registrar_avistamiento: solo fotos subidas por el
--     usuario a su carpeta del bucket "fotos".
--   · cambiar_estado_animal: quién puede cerrar y reabrir según el tipo.
--   · guardar_embedding: no sugiere perdido con perdido ni encontrados vistos
--     por última vez más de un día antes de la pérdida. Además corrige el
--     operador de pgvector, que no se encontraba (la función nunca anduvo).
--   · resolver_coincidencia: quién decide y cuál queda como principal.
--   · Notificación a la familia con el nombre del animal.
--   · animales_mapa, animales_detalle y coincidencias_detalle exponen lo nuevo.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Modelo
-- ---------------------------------------------------------------------------

-- Independiente de estado: un perdido también pasa por avistado, resguardado,
-- reunido o vinculado.
create type public.tipo_reporte as enum ('perdido', 'encontrado');

alter table public.animales
  add column tipo_reporte public.tipo_reporte not null default 'encontrado',
  add column nombre text check (char_length(nombre) between 1 and 40),
  add column contacto_familia text check (char_length(contacto_familia) <= 200),
  -- El contacto es el dato que la familia decide mostrar: solo en perdidos.
  add constraint contacto_familia_solo_perdidos
    check (contacto_familia is null or tipo_reporte = 'perdido');

comment on column public.animales.tipo_reporte is 'perdido: lo publica su familia · encontrado: lo publica quien lo encontró. No cambia después de publicar.';
comment on column public.animales.nombre is 'Nombre del animal, si la familia lo cuenta.';
comment on column public.animales.contacto_familia is 'Lo único que la familia decide mostrar para que la contacten. Nunca se pide email ni teléfono.';

create index animales_tipo_reporte_idx on public.animales (tipo_reporte);

-- ---------------------------------------------------------------------------
-- Fotos: solo las que el usuario subió a su carpeta del bucket "fotos".
-- Antes las RPC aceptaban cualquier texto, incluida una URL externa que la
-- app mostraba tal cual. Interna: la usan las RPC security definer.
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
      and split_part(p_path, '/', 1) = p_uid::text
      and exists (
        select 1 from storage.objects o
        where o.bucket_id = 'fotos' and o.name = p_path
      ),
    false
  );
$$;

revoke all on function public.es_foto_propia from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: publicar un animal perdido o encontrado (animal + primer avistamiento).
-- Se agrega p_tipo a publicar_animal en vez de crear otra función: las dos
-- comparten validaciones y la app llama siempre a la misma. Los parámetros
-- nuevos tienen default, así que una app vieja que todavía no se actualizó
-- sigue publicando encontrados igual (ver docs/DECISIONES.md).
-- ---------------------------------------------------------------------------
drop function public.publicar_animal(
  public.especie, text, double precision, double precision, timestamptz,
  public.tamanio, text, boolean, text
);

create function public.publicar_animal(
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
  v_animal_id uuid;
begin
  if v_uid is null then
    raise exception 'Necesitás una cuenta para publicar' using errcode = '42501';
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

revoke all on function public.publicar_animal from public, anon;
grant execute on function public.publicar_animal to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: "Lo vi". Igual que antes, más la validación de la foto.
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
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Necesitás una cuenta para avisar que lo viste' using errcode = '42501';
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

revoke all on function public.registrar_avistamiento from public, anon;
grant execute on function public.registrar_avistamiento to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: cambiar el estado de un caso. Las transiciones no cambian:
--   avistado    -> resguardado | reunido
--   resguardado -> reunido | avistado   (se volvió a escapar)
--   reunido     -> avistado             (reabrir)
-- Quién puede hacerlas, sí:
--   · cualquiera con cuenta: resguardarlo (lo tiene a salvo).
--   · perdido: solo quien lo publicó (la familia) lo marca como reunido o lo
--     reabre, también cuando "se volvió a escapar".
--   · encontrado: lo marca como reunido quien lo publicó o quien lo tiene
--     resguardado; "se volvió a escapar" sigue abierto a cualquiera y reabrir
--     un caso cerrado, solo quien lo publicó.
-- ---------------------------------------------------------------------------
create or replace function public.cambiar_estado_animal(
  p_animal_id uuid,
  p_estado_nuevo public.estado_animal,
  p_contacto_compartido text default null,
  p_nota text default null,
  p_lat double precision default null,
  p_lng double precision default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_actual public.estado_animal;
  v_creador uuid;
  v_tipo public.tipo_reporte;
  v_resguarda uuid;
  v_ubicacion extensions.geography;
begin
  if v_uid is null then
    raise exception 'Necesitás una cuenta para cambiar el estado' using errcode = '42501';
  end if;
  if p_estado_nuevo = 'vinculado' then
    raise exception 'Para vincular reportes usá las coincidencias' using errcode = '22023';
  end if;

  select estado, creado_por, tipo_reporte into v_actual, v_creador, v_tipo
  from public.animales
  where id = p_animal_id
  for update;

  if v_actual is null then
    raise exception 'No encontramos este reporte' using errcode = 'P0002';
  end if;
  if v_actual = 'vinculado' then
    raise exception 'Este reporte está vinculado a otro' using errcode = '22023';
  end if;
  if v_actual = p_estado_nuevo then
    raise exception 'El animal ya está en ese estado' using errcode = '22023';
  end if;
  if not (
    (v_actual = 'avistado' and p_estado_nuevo in ('resguardado', 'reunido'))
    or (v_actual = 'resguardado' and p_estado_nuevo in ('reunido', 'avistado'))
    or (v_actual = 'reunido' and p_estado_nuevo = 'avistado')
  ) then
    raise exception 'Ese cambio de estado no está permitido' using errcode = '22023';
  end if;

  -- Quien lo tiene resguardado: el último que lo pasó a resguardado.
  if v_actual = 'resguardado' then
    select usuario_id into v_resguarda
    from public.cambios_estado
    where animal_id = p_animal_id and estado_nuevo = 'resguardado'
    order by created_at desc
    limit 1;
  end if;

  if p_estado_nuevo = 'reunido' then
    if v_tipo = 'perdido' and v_uid <> v_creador then
      raise exception 'Solo su familia puede marcarlo como reunido' using errcode = '42501';
    end if;
    if v_tipo = 'encontrado' and v_uid <> v_creador and v_uid is distinct from v_resguarda then
      raise exception 'Solo quien lo publicó o quien lo tiene resguardado puede marcarlo como reunido'
        using errcode = '42501';
    end if;
  end if;

  if p_estado_nuevo = 'avistado' then
    if v_tipo = 'perdido' and v_uid <> v_creador then
      raise exception 'Solo su familia puede reabrir el caso' using errcode = '42501';
    end if;
    if v_actual = 'reunido' and v_uid <> v_creador then
      raise exception 'Solo quien publicó puede reabrir el caso' using errcode = '42501';
    end if;
  end if;

  update public.animales set estado = p_estado_nuevo where id = p_animal_id;

  insert into public.cambios_estado (animal_id, usuario_id, estado_anterior, estado_nuevo, contacto_compartido, nota)
  values (
    p_animal_id, v_uid, v_actual, p_estado_nuevo,
    nullif(trim(p_contacto_compartido), ''), nullif(trim(p_nota), '')
  );

  -- Resguardarlo cuenta como un avistamiento (sin foto obligatoria).
  if p_estado_nuevo = 'resguardado' then
    if p_lat is not null and p_lng is not null then
      v_ubicacion := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;
    else
      select ubicacion into v_ubicacion
      from public.avistamientos
      where animal_id = p_animal_id
      order by visto_en desc
      limit 1;
    end if;

    insert into public.avistamientos (animal_id, usuario_id, tipo, foto_path, ubicacion, visto_en, nota)
    values (p_animal_id, v_uid, 'resguardado', null, v_ubicacion, now(), nullif(trim(p_nota), ''));
  end if;

  insert into public.seguimientos (usuario_id, animal_id)
  values (v_uid, p_animal_id)
  on conflict do nothing;
end;
$$;

revoke all on function public.cambiar_estado_animal from public, anon;
grant execute on function public.cambiar_estado_animal to authenticated;

-- ---------------------------------------------------------------------------
-- RPC (servicio): guardar el embedding y buscar coincidencias.
-- Igual que antes (misma especie, abiertos, dentro del radio y la ventana),
-- con dos reglas nuevas:
--   · nunca se sugiere un perdido con otro perdido: son dos familias;
--   · entre un perdido y un encontrado, el encontrado tiene que tener algún
--     avistamiento desde un día antes de la pérdida. Si todos son anteriores,
--     ese animal ya andaba suelto antes de que este se perdiera.
-- La fecha de la pérdida es la del avistamiento 'perdido' (si faltara, la
-- fecha de publicación).
-- Corrige además un error de la 0005: con search_path = '' el operador <=> de
-- pgvector (que vive en el esquema extensions) no se encontraba y la función
-- fallaba siempre con "operator does not exist". Ahora va calificado.
-- ---------------------------------------------------------------------------
create or replace function public.guardar_embedding(
  p_avistamiento_id uuid,
  p_embedding extensions.vector(384),
  p_bbox jsonb default null
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_animal uuid;
  v_especie public.especie;
  v_tipo public.tipo_reporte;
  v_perdido_desde timestamptz;
  v_ultimo_visto timestamptz;
  v_ubicacion extensions.geography;
  v_visto_en timestamptz;
  v_umbral real;
  v_radio_m real;
  v_dias real;
  v_insertadas int := 0;
  r record;
begin
  update public.avistamientos
  set embedding = p_embedding,
      bbox_recorte = p_bbox,
      procesado_en = now(),
      error_procesamiento = null
  where id = p_avistamiento_id
  returning animal_id, ubicacion, visto_en into v_animal, v_ubicacion, v_visto_en;

  if v_animal is null then
    raise exception 'Avistamiento inexistente' using errcode = 'P0002';
  end if;

  select especie, tipo_reporte into v_especie, v_tipo from public.animales where id = v_animal;

  -- De este animal: cuándo se perdió (si es perdido) y cuándo lo vieron por última vez.
  select coalesce(
    (select min(visto_en) from public.avistamientos where animal_id = v_animal and tipo = 'perdido'),
    (select created_at from public.animales where id = v_animal)
  ) into v_perdido_desde;
  select max(visto_en) into v_ultimo_visto from public.avistamientos where animal_id = v_animal;

  select valor::real into v_umbral from public.config_app where clave = 'umbral_similitud';
  select valor::real into v_radio_m from public.config_app where clave = 'radio_coincidencia_m';
  select valor::real into v_dias from public.config_app where clave = 'ventana_coincidencia_dias';
  v_umbral := coalesce(v_umbral, 0.80);
  v_radio_m := coalesce(v_radio_m, 15000);
  v_dias := coalesce(v_dias, 60);

  for r in
    select
      otro.animal_id,
      otro.id as avistamiento_id,
      otro.similitud,
      otro.distancia_m,
      otro.horas
    from (
      select distinct on (av.animal_id)
        av.animal_id,
        av.id,
        (1 - (av.embedding operator(extensions.<=>) p_embedding))::real as similitud,
        extensions.st_distance(av.ubicacion, v_ubicacion)::real as distancia_m,
        (abs(extract(epoch from (av.visto_en - v_visto_en))) / 3600)::real as horas
      from public.avistamientos av
      join public.animales a on a.id = av.animal_id
      where av.animal_id <> v_animal
        and av.embedding is not null
        and a.especie = v_especie
        and a.estado in ('avistado', 'resguardado')
        and extensions.st_dwithin(av.ubicacion, v_ubicacion, v_radio_m)
        and abs(extract(epoch from (av.visto_en - v_visto_en))) <= v_dias * 86400
        and (
          -- Dos encontrados: como hasta ahora.
          (v_tipo = 'encontrado' and a.tipo_reporte = 'encontrado')
          -- Este es perdido y el otro encontrado: el encontrado se vio desde un día antes de la pérdida.
          or (
            v_tipo = 'perdido' and a.tipo_reporte = 'encontrado'
            and (select max(x.visto_en) from public.avistamientos x where x.animal_id = a.id)
              >= v_perdido_desde - interval '1 day'
          )
          -- Este es encontrado y el otro perdido: lo mismo, con la pérdida del otro.
          or (
            v_tipo = 'encontrado' and a.tipo_reporte = 'perdido'
            and v_ultimo_visto >= coalesce(
              (select min(x.visto_en) from public.avistamientos x where x.animal_id = a.id and x.tipo = 'perdido'),
              a.created_at
            ) - interval '1 day'
          )
          -- Perdido con perdido: nunca.
        )
      order by av.animal_id, (av.embedding operator(extensions.<=>) p_embedding)
    ) otro
    where otro.similitud >= v_umbral
    order by otro.similitud desc
    limit 10
  loop
    insert into public.coincidencias (
      animal_origen, animal_candidato, avistamiento_origen, avistamiento_candidato,
      similitud, distancia_m, horas_diferencia
    )
    values (
      least(v_animal, r.animal_id),
      greatest(v_animal, r.animal_id),
      case when v_animal < r.animal_id then p_avistamiento_id else r.avistamiento_id end,
      case when v_animal < r.animal_id then r.avistamiento_id else p_avistamiento_id end,
      r.similitud, r.distancia_m, r.horas
    )
    on conflict (animal_origen, animal_candidato) do update
      set similitud = greatest(public.coincidencias.similitud, excluded.similitud),
          distancia_m = least(public.coincidencias.distancia_m, excluded.distancia_m),
          horas_diferencia = least(public.coincidencias.horas_diferencia, excluded.horas_diferencia)
      where public.coincidencias.estado = 'pendiente';
    v_insertadas := v_insertadas + 1;
  end loop;

  update public.cola_vision
  set estado = 'hecho', ultimo_error = null
  where avistamiento_id = p_avistamiento_id;

  return v_insertadas;
end;
$$;

revoke all on function public.guardar_embedding from public, anon, authenticated;
grant execute on function public.guardar_embedding to service_role;

-- ---------------------------------------------------------------------------
-- RPC (usuarios): confirmar o rechazar una coincidencia.
-- Quién decide:
--   · si el par incluye un perdido (nunca hay dos), solo su familia;
--   · entre dos encontrados, quien publicó cualquiera de los dos o un moderador.
-- Al confirmar, el perdido queda siempre como principal; entre dos
-- encontrados, el más viejo, como hasta ahora. Si el secundario estaba
-- resguardado y el principal no, el principal pasa a resguardado con el mismo
-- contacto, así la familia ve enseguida quién lo tiene.
-- ---------------------------------------------------------------------------
create or replace function public.resolver_coincidencia(p_id uuid, p_confirmada boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_c public.coincidencias%rowtype;
  v_origen public.animales%rowtype;
  v_candidato public.animales%rowtype;
  v_perdido uuid;
  v_familia uuid;
  v_principal uuid;
  v_secundario uuid;
  v_estado_principal public.estado_animal;
  v_estado_secundario public.estado_animal;
  v_creador_secundario uuid;
  v_resguarda uuid;
  v_contacto text;
begin
  if v_uid is null then
    raise exception 'Necesitás una cuenta para confirmar coincidencias' using errcode = '42501';
  end if;

  select * into v_c from public.coincidencias where id = p_id for update;
  if v_c.id is null then
    raise exception 'Coincidencia inexistente' using errcode = 'P0002';
  end if;
  if v_c.estado <> 'pendiente' then
    raise exception 'Esta coincidencia ya fue resuelta' using errcode = '22023';
  end if;

  select * into v_origen from public.animales where id = v_c.animal_origen;
  select * into v_candidato from public.animales where id = v_c.animal_candidato;

  if v_origen.tipo_reporte = 'perdido' then
    v_perdido := v_origen.id;
    v_familia := v_origen.creado_por;
  elsif v_candidato.tipo_reporte = 'perdido' then
    v_perdido := v_candidato.id;
    v_familia := v_candidato.creado_por;
  end if;

  if v_perdido is not null then
    if v_uid <> v_familia then
      raise exception 'Solo la familia del animal perdido puede confirmar o rechazar esta coincidencia'
        using errcode = '42501';
    end if;
  elsif v_uid not in (v_origen.creado_por, v_candidato.creado_por) and not public.es_moderador() then
    raise exception 'Solo quien publicó alguno de los dos reportes o un moderador puede confirmar o rechazar esta coincidencia'
      using errcode = '42501';
  end if;

  update public.coincidencias
  set estado = (case when p_confirmada then 'confirmada' else 'rechazada' end)::public.estado_coincidencia,
      resuelta_por = v_uid,
      resuelta_en = now()
  where id = p_id;

  if not p_confirmada then
    return null;
  end if;

  -- El perdido es siempre el principal; entre dos encontrados, el más viejo.
  if v_perdido is not null then
    v_principal := v_perdido;
    v_secundario := case when v_perdido = v_origen.id then v_candidato.id else v_origen.id end;
  elsif v_origen.created_at <= v_candidato.created_at then
    v_principal := v_origen.id;
    v_secundario := v_candidato.id;
  else
    v_principal := v_candidato.id;
    v_secundario := v_origen.id;
  end if;

  select estado, creado_por into v_estado_secundario, v_creador_secundario
  from public.animales
  where id = v_secundario
  for update;

  select estado into v_estado_principal
  from public.animales
  where id = v_principal
  for update;

  -- Si el secundario ya estaba vinculado a otro, no se puede re-vincular.
  if v_estado_secundario = 'vinculado' then
    raise exception 'Ese reporte ya está vinculado a otro' using errcode = '22023';
  end if;

  update public.avistamientos set animal_id = v_principal where animal_id = v_secundario;

  update public.animales
  set estado = 'vinculado', vinculado_a = v_principal
  where id = v_secundario;

  update public.animales
  set ultimo_avistamiento_en = (
    select max(visto_en) from public.avistamientos where animal_id = v_principal
  )
  where id = v_principal;

  -- Quien lo tenía resguardado lo sigue teniendo: el principal pasa a
  -- resguardado con el mismo contacto.
  if v_estado_secundario = 'resguardado' and v_estado_principal = 'avistado' then
    select usuario_id, contacto_compartido into v_resguarda, v_contacto
    from public.cambios_estado
    where animal_id = v_secundario and estado_nuevo = 'resguardado'
    order by created_at desc
    limit 1;

    update public.animales set estado = 'resguardado' where id = v_principal;

    insert into public.cambios_estado (animal_id, usuario_id, estado_anterior, estado_nuevo, contacto_compartido, nota)
    values (v_principal, coalesce(v_resguarda, v_creador_secundario), 'avistado', 'resguardado', v_contacto, null);
  end if;

  -- Quien seguía el secundario pasa a seguir el principal.
  insert into public.seguimientos (usuario_id, animal_id)
  select usuario_id, v_principal from public.seguimientos where animal_id = v_secundario
  on conflict do nothing;

  -- Las demás coincidencias pendientes del secundario pierden sentido.
  update public.coincidencias
  set estado = 'rechazada', resuelta_por = v_uid, resuelta_en = now()
  where estado = 'pendiente'
    and (animal_origen = v_secundario or animal_candidato = v_secundario);

  insert into public.cambios_estado (animal_id, usuario_id, estado_anterior, estado_nuevo, nota)
  values (v_secundario, v_uid, v_estado_secundario, 'vinculado', null);

  return v_principal;
end;
$$;

revoke all on function public.resolver_coincidencia from public, anon;
grant execute on function public.resolver_coincidencia to authenticated;

-- ---------------------------------------------------------------------------
-- Notificaciones
-- ---------------------------------------------------------------------------

-- Nueva coincidencia. Si el par incluye un perdido, su familia recibe un aviso
-- propio con el nombre ("Encontraron un animal parecido a Toby"). El resto de
-- los interesados de cada animal recibe el aviso general, apuntando al animal
-- que le interesa. Cada persona recibe un solo aviso.
create or replace function public.notificar_coincidencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_animal uuid;
  v_perdido uuid;
  v_familia uuid;
  v_nombre text;
  v_creadores uuid[];
  v_avisados uuid[] := '{}';
begin
  select id, creado_por, nombre into v_perdido, v_familia, v_nombre
  from public.animales
  where id in (new.animal_origen, new.animal_candidato) and tipo_reporte = 'perdido'
  limit 1;

  select array_agg(creado_por) into v_creadores
  from public.animales
  where id in (new.animal_origen, new.animal_candidato);

  if v_perdido is not null then
    perform public.notificar(
      v_familia,
      'coincidencia',
      case
        when v_nombre is not null then 'Encontraron un animal parecido a ' || v_nombre
        else 'Encontraron un animal parecido al tuyo'
      end,
      'Mirá las fotos y decidí si es o no. Solo vos podés confirmarlo.',
      jsonb_build_object('animal_id', v_perdido, 'coincidencia_id', new.id)
    );
    v_avisados := array[v_familia];
  end if;

  foreach v_animal in array array[new.animal_origen, new.animal_candidato] loop
    for v_uid in select interesados_en from public.interesados_en(v_animal) loop
      if v_uid = any (v_avisados) then
        continue;
      end if;
      perform public.notificar(
        v_uid,
        'coincidencia',
        'Posible coincidencia',
        case
          when v_perdido is not null then
            'Un reporte que seguís podría ser un animal perdido. Su familia va a confirmar si es o no.'
          when v_uid = any (v_creadores) then
            'Encontramos un reporte que podría ser el mismo animal. Entrá y confirmá si es o no.'
          else
            'Encontramos un reporte que podría ser el mismo animal. Quien lo publicó va a confirmar si es o no.'
        end,
        jsonb_build_object('animal_id', v_animal, 'coincidencia_id', new.id)
      );
      v_avisados := v_avisados || v_uid;
    end loop;
  end loop;
  return new;
end;
$$;

-- Alguien lo vio o lo resguardó: avisar a los interesados menos a quien lo
-- hizo. Si el animal tiene nombre, el aviso lo usa ("Ana vio a Toby").
create or replace function public.notificar_avistamiento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_nombre text;
  v_animal text;
begin
  -- El primer avistamiento es la publicación: no hay a quién avisar.
  if new.tipo in ('encontrado', 'perdido') then
    return new;
  end if;
  select nombre_publico into v_nombre from public.perfiles where id = new.usuario_id;
  select coalesce('a ' || nombre, 'al ' || especie::text) into v_animal
  from public.animales where id = new.animal_id;

  for v_uid in select interesados_en from public.interesados_en(new.animal_id) loop
    if v_uid = new.usuario_id then
      continue;
    end if;
    perform public.notificar(
      v_uid,
      'avistamiento',
      case when new.tipo = 'resguardado' then 'Lo resguardaron' else 'Lo vieron de nuevo' end,
      case
        when new.tipo = 'resguardado' then v_nombre || ' tiene ' || v_animal || ' a salvo.'
        else v_nombre || ' vio ' || v_animal || ' en otro lugar.'
      end,
      jsonb_build_object('animal_id', new.animal_id)
    );
  end loop;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vistas: las columnas nuevas van al final (create or replace no permite
-- cambiar el orden de las existentes).
-- ---------------------------------------------------------------------------
create or replace view public.animales_mapa
with (security_invoker = true)
as
select
  a.id,
  a.especie,
  a.tamanio,
  a.color,
  a.tiene_collar,
  a.descripcion,
  a.estado,
  a.foto_principal_path,
  a.creado_por,
  a.created_at,
  a.ultimo_avistamiento_en,
  extensions.st_y(u.ubicacion::extensions.geometry) as lat,
  extensions.st_x(u.ubicacion::extensions.geometry) as lng,
  u.visto_en as ultimo_visto_en,
  (select count(*) from public.avistamientos av where av.animal_id = a.id) as cantidad_avistamientos,
  a.tipo_reporte,
  a.nombre,
  a.contacto_familia
from public.animales a
join lateral (
  select ubicacion, visto_en
  from public.avistamientos
  where animal_id = a.id
  order by visto_en desc
  limit 1
) u on true
where a.estado <> 'vinculado' and a.oculto = false;

-- perdido_desde: cuándo se perdió, para "Perdido desde el sábado 17".
create or replace view public.animales_detalle
with (security_invoker = true)
as
select
  a.id,
  a.especie,
  a.tamanio,
  a.color,
  a.tiene_collar,
  a.descripcion,
  a.estado,
  a.vinculado_a,
  a.foto_principal_path,
  a.creado_por,
  p.nombre_publico as creador_nombre,
  a.created_at,
  a.ultimo_avistamiento_en,
  extensions.st_y(u.ubicacion::extensions.geometry) as lat,
  extensions.st_x(u.ubicacion::extensions.geometry) as lng,
  u.visto_en as ultimo_visto_en,
  (select count(*) from public.avistamientos av where av.animal_id = a.id) as cantidad_avistamientos,
  a.oculto,
  a.tipo_reporte,
  a.nombre,
  a.contacto_familia,
  (
    select min(av.visto_en) from public.avistamientos av
    where av.animal_id = a.id and av.tipo = 'perdido'
  ) as perdido_desde
from public.animales a
join public.perfiles p on p.id = a.creado_por
left join lateral (
  select ubicacion, visto_en
  from public.avistamientos
  where animal_id = a.id
  order by visto_en desc
  limit 1
) u on true;

-- La app necesita el tipo, el nombre y quién publicó cada lado para mostrar
-- el resumen y saber quién puede confirmar.
create or replace view public.coincidencias_detalle
with (security_invoker = true)
as
select
  c.id,
  c.animal_origen,
  c.animal_candidato,
  c.similitud,
  c.distancia_m,
  c.horas_diferencia,
  c.estado,
  c.resuelta_por,
  c.resuelta_en,
  c.created_at,
  ao.foto_principal_path as origen_foto_path,
  ao.especie as origen_especie,
  ao.estado as origen_estado,
  ao.descripcion as origen_descripcion,
  ac.foto_principal_path as candidato_foto_path,
  ac.especie as candidato_especie,
  ac.estado as candidato_estado,
  ac.descripcion as candidato_descripcion,
  ao.tipo_reporte as origen_tipo_reporte,
  ao.nombre as origen_nombre,
  ao.creado_por as origen_creado_por,
  ac.tipo_reporte as candidato_tipo_reporte,
  ac.nombre as candidato_nombre,
  ac.creado_por as candidato_creado_por
from public.coincidencias c
join public.animales ao on ao.id = c.animal_origen
join public.animales ac on ac.id = c.animal_candidato;
