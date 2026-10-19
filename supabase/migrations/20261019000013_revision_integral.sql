-- Fase 9, parte 1: correcciones de la revisión integral (docs/reportes/2026-10-19-revision.md).
--   · notificar_coincidencia pasa quién causó el aviso: quien bloqueó a la
--     persona que publicó el otro reporte deja de recibir sus coincidencias,
--     como con el resto de los avisos.
--   · abrir_conversacion solo abre conversaciones con quien publicó el caso
--     (o un reporte unido a él) o con quien lo resguardó, como ofrece la app.
--     Antes cualquiera con cuenta podía escribirle a cualquier usuario.
--   · cambiar_estado_animal guarda redondeado a unos 100 m el "¿Dónde está
--     ahora?" de un resguardo, que suele ser la casa de quien lo tiene.
--   · Storage: el bucket "fotos" sigue público para ver las fotos por su URL,
--     pero ya no se puede listar entero; cada usuario lista solo su carpeta.
--   · Servicio de visión: el aviso sale de la cola, así también llega cuando
--     una foto vuelve a pendiente (al corregir la especie); los errores se
--     reintentan con espera creciente; y no se buscan coincidencias para un
--     caso cerrado u oculto, ni se sugiere uno oculto.
-- Pruebas: supabase/tests/fase9_revision.sql.

-- ---------------------------------------------------------------------------
-- 1. Avisos de coincidencias con el actor
-- ---------------------------------------------------------------------------

-- El actor de cada aviso es quien publicó el otro reporte del par (null si
-- quedó sin autor). Lo demás, igual que en la 0010.
create or replace function public.notificar_coincidencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_animal uuid;
  v_otro uuid;
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

  if v_perdido is not null and v_familia is not null then
    perform public.notificar(
      v_familia,
      'coincidencia',
      case
        when v_nombre is not null then 'Encontraron un animal parecido a ' || v_nombre
        else 'Encontraron un animal parecido al tuyo'
      end,
      'Mirá las fotos y decidí si es o no. Solo vos podés confirmarlo.',
      jsonb_build_object('animal_id', v_perdido, 'coincidencia_id', new.id),
      (select a.creado_por from public.animales a
       where a.id = case when v_perdido = new.animal_origen then new.animal_candidato
                         else new.animal_origen end)
    );
    v_avisados := array[v_familia];
  end if;

  foreach v_animal in array array[new.animal_origen, new.animal_candidato] loop
    v_otro := case when v_animal = new.animal_origen then new.animal_candidato
                   else new.animal_origen end;
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
        jsonb_build_object('animal_id', v_animal, 'coincidencia_id', new.id),
        (select a.creado_por from public.animales a where a.id = v_otro)
      );
      v_avisados := v_avisados || v_uid;
    end loop;
  end loop;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Con quién se puede abrir una conversación
-- ---------------------------------------------------------------------------

-- Igual que en la 0011, y además: la otra persona publicó el caso (o un
-- reporte unido a él) o lo resguardó. Una conversación que ya existe se puede
-- seguir abriendo, así quien publicó le contesta a quien le escribió primero.
create or replace function public.abrir_conversacion(p_animal_id uuid, p_otro_usuario uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Necesitás una cuenta para enviar mensajes' using errcode = '42501';
  end if;
  perform public.exigir_terminos();
  if p_otro_usuario is null or p_otro_usuario = v_uid then
    raise exception 'No podés escribirte a vos' using errcode = '22023';
  end if;
  if not exists (select 1 from public.perfiles where id = p_otro_usuario) then
    raise exception 'Ese usuario no existe' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.animales where id = p_animal_id) then
    raise exception 'No encontramos este reporte' using errcode = 'P0002';
  end if;
  if public.hay_bloqueo_con(p_otro_usuario) then
    raise exception 'No podés escribirle a esta persona' using errcode = '42501';
  end if;

  select c.id into v_id
  from public.conversaciones c
  where c.animal_id = p_animal_id
    and c.participante_a = least(v_uid, p_otro_usuario)
    and c.participante_b = greatest(v_uid, p_otro_usuario);

  if v_id is null and not exists (
    select 1
    from public.arbol_de_casos(array[p_animal_id]) as caso(id)
    where exists (
        select 1 from public.animales a where a.id = caso.id and a.creado_por = p_otro_usuario
      )
      or exists (
        select 1 from public.cambios_estado c
        where c.animal_id = caso.id
          and c.estado_nuevo = 'resguardado'
          and c.usuario_id = p_otro_usuario
      )
  ) then
    raise exception 'Solo podés escribirle a quien publicó el caso o a quien lo resguarda'
      using errcode = '42501';
  end if;

  insert into public.conversaciones (animal_id, participante_a, participante_b)
  values (p_animal_id, least(v_uid, p_otro_usuario), greatest(v_uid, p_otro_usuario))
  on conflict (animal_id, participante_a, participante_b) do update set updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.abrir_conversacion from public, anon;
grant execute on function public.abrir_conversacion to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Ubicación de un resguardo, redondeada
-- ---------------------------------------------------------------------------

-- Igual que en la 0011, salvo que el punto que deja quien lo resguarda se
-- guarda con 3 decimales (unos 100 m), como el de un perdido: ese avistamiento
-- lo ve cualquiera y el lugar suele ser su casa.
create or replace function public.cambiar_estado_animal(
  p_animal_id uuid,
  p_estado_nuevo public.estado_animal,
  p_contacto_compartido text default null,
  p_nota text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_foto_path text default null
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
  v_foto text := nullif(trim(p_foto_path), '');
  v_contacto text := nullif(trim(p_contacto_compartido), '');
  v_cambio uuid;
begin
  if v_uid is null then
    raise exception 'Necesitás una cuenta para cambiar el estado' using errcode = '42501';
  end if;
  perform public.exigir_terminos();
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

  if p_estado_nuevo = 'resguardado' then
    if v_tipo = 'perdido' and v_foto is null then
      raise exception 'Para avisar que lo tenés, sacale una foto actual' using errcode = '22023';
    end if;
    if v_foto is not null and not public.es_foto_propia(v_foto, v_uid) then
      raise exception 'La foto tiene que estar subida desde la app' using errcode = '22023';
    end if;
    if char_length(v_contacto) > 200 then
      raise exception 'El contacto puede tener hasta 200 caracteres' using errcode = '22023';
    end if;
    if p_lat is not null and p_lng is not null
       and (p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180) then
      raise exception 'Ubicación inválida' using errcode = '22023';
    end if;
  end if;

  if p_estado_nuevo = 'reunido' then
    if v_tipo = 'perdido' and v_uid is distinct from v_creador then
      raise exception 'Solo su familia puede marcarlo como reunido' using errcode = '42501';
    end if;
    if v_tipo = 'encontrado' and v_uid is distinct from v_creador and v_uid is distinct from v_resguarda then
      raise exception 'Solo quien lo publicó o quien lo tiene resguardado puede marcarlo como reunido'
        using errcode = '42501';
    end if;
  end if;

  if p_estado_nuevo = 'avistado' then
    if v_tipo = 'perdido' and v_uid is distinct from v_creador then
      raise exception 'Solo su familia puede reabrir el caso' using errcode = '42501';
    end if;
    if v_actual = 'reunido' and v_uid is distinct from v_creador then
      raise exception 'Solo quien publicó puede reabrir el caso' using errcode = '42501';
    end if;
    if v_actual = 'resguardado' and v_uid is distinct from v_creador and v_uid is distinct from v_resguarda then
      raise exception 'Solo quien lo publicó o quien lo tiene resguardado puede decir que se volvió a escapar'
        using errcode = '42501';
    end if;
  end if;

  update public.animales set estado = p_estado_nuevo where id = p_animal_id;

  insert into public.cambios_estado (animal_id, usuario_id, estado_anterior, estado_nuevo, nota)
  values (p_animal_id, v_uid, v_actual, p_estado_nuevo, nullif(trim(p_nota), ''))
  returning id into v_cambio;

  if p_estado_nuevo = 'resguardado' then
    if v_contacto is not null then
      insert into public.contactos_resguardo (cambio_id, animal_id, usuario_id, contacto)
      values (v_cambio, p_animal_id, v_uid, v_contacto);
    end if;

    -- Resguardarlo cuenta como un avistamiento. Con foto, entra a la cola de
    -- reconocimiento (trigger avistamientos_encolar). El punto nuevo va
    -- redondeado; si no hay, se repite el último, que ya es público.
    if p_lat is not null and p_lng is not null then
      v_ubicacion := extensions.st_setsrid(
        extensions.st_makepoint(
          round(p_lng::numeric, 3)::double precision,
          round(p_lat::numeric, 3)::double precision
        ),
        4326
      )::extensions.geography;
    else
      select ubicacion into v_ubicacion
      from public.avistamientos
      where animal_id = p_animal_id
      order by visto_en desc
      limit 1;
    end if;

    insert into public.avistamientos (animal_id, usuario_id, tipo, foto_path, ubicacion, visto_en, nota)
    values (p_animal_id, v_uid, 'resguardado', v_foto, v_ubicacion, now(), nullif(trim(p_nota), ''));
  end if;

  insert into public.seguimientos (usuario_id, animal_id)
  values (v_uid, p_animal_id)
  on conflict do nothing;
end;
$$;

revoke all on function public.cambiar_estado_animal from public, anon;
grant execute on function public.cambiar_estado_animal to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Storage: el bucket no se lista entero
-- ---------------------------------------------------------------------------

-- Las fotos se ven por su URL pública (/object/public/...), que en un bucket
-- público no pasa por esta política. La política de lectura solo sirve para
-- listar y para la API autenticada: con lectura para todos, cualquiera podía
-- listar las carpetas de todos los usuarios, también fotos de casos ocultos
-- por moderación o de publicaciones que no llegaron a hacerse. Ahora cada
-- usuario lee (y lista) solo su carpeta, lo que Storage necesita para subir y
-- borrar lo propio.
drop policy if exists "fotos: lectura publica" on storage.objects;
drop policy if exists "fotos: leer las propias" on storage.objects;
create policy "fotos: leer las propias"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- 5. Servicio de visión: aviso cada vez que algo queda pendiente
-- ---------------------------------------------------------------------------

-- Antes el aviso salía solo al insertar un avistamiento, así que las fotos que
-- editar_reporte devuelve a la cola (cambio de especie) esperaban al bucle del
-- servicio, o a que otro avistamiento lo despertara. Ahora sale de la cola:
-- al entrar una fila y cada vez que una vuelve a pendiente. La URL tolera una
-- barra al final.
create or replace function public.avisar_vision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if tg_op = 'UPDATE' and old.estado is not distinct from new.estado then
    return new;
  end if;

  select valor into v_url from public.config_app where clave = 'vision_url';
  select valor into v_secret from public.config_app where clave = 'vision_secret';

  if coalesce(v_url, '') <> '' then
    perform net.http_post(
      url := rtrim(v_url, '/') || '/procesar',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Vision-Secret', coalesce(v_secret, '')
      ),
      body := jsonb_build_object('avistamiento_id', new.avistamiento_id),
      timeout_milliseconds := 5000
    );
  end if;

  return new;
end;
$$;

drop trigger if exists cola_vision_avisar on public.cola_vision;
create trigger cola_vision_avisar
  after insert or update of estado on public.cola_vision
  for each row
  when (new.estado = 'pendiente')
  execute function public.avisar_vision();

-- Encolar ya no avisa: lo hace la cola.
create or replace function public.encolar_avistamiento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.foto_path is null then
    return new;
  end if;

  insert into public.cola_vision (avistamiento_id)
  values (new.id)
  on conflict (avistamiento_id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Reintentos con espera creciente
-- ---------------------------------------------------------------------------

-- Antes un error se reintentaba cada vez que pasaba el bucle (cada 5 minutos)
-- y a los 5 intentos la foto salía de la cola: una caída de media hora del
-- Space o de Storage dejaba fotos sin reconocer para siempre. Ahora, después
-- de cada error se espera el doble (5, 10, 20… minutos) y hay hasta 8 intentos:
-- unas 10 horas en total. Las pendientes se ven enseguida, como antes.
create or replace view public.cola_vision_pendientes as
select
  c.avistamiento_id,
  c.estado,
  c.intentos,
  av.foto_path,
  a.especie
from public.cola_vision c
join public.avistamientos av on av.id = c.avistamiento_id
join public.animales a on a.id = av.animal_id
where c.intentos < 8
  and (
    c.estado = 'pendiente'
    or (
      c.estado = 'error'
      and c.updated_at <= now() - interval '5 minutes' * power(2, greatest(c.intentos - 1, 0))
    )
  )
order by c.created_at;

revoke all on public.cola_vision_pendientes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Coincidencias solo entre casos abiertos y visibles
-- ---------------------------------------------------------------------------

-- Igual que en la 0010, y además: si el caso de la foto está cerrado, unido a
-- otro u oculto por moderación, se guarda el embedding pero no se buscan
-- coincidencias; y nunca se sugiere un caso oculto. Antes un caso cerrado
-- (por ejemplo, al corregir su especie) o una publicación oculta podían
-- generar coincidencias y avisos a otras familias.
create or replace function public.guardar_embedding(
  p_avistamiento_id uuid,
  p_embedding extensions.vector(384),
  p_bbox jsonb default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_animal uuid;
  v_especie public.especie;
  v_tipo public.tipo_reporte;
  v_estado public.estado_animal;
  v_oculto boolean;
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

  select especie, tipo_reporte, estado, oculto into v_especie, v_tipo, v_estado, v_oculto
  from public.animales where id = v_animal;

  if v_estado not in ('avistado', 'resguardado') or v_oculto then
    update public.cola_vision
    set estado = 'hecho', ultimo_error = null
    where avistamiento_id = p_avistamiento_id;
    return 0;
  end if;

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
        and not a.oculto
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
