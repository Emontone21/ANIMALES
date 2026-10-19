-- Fase 8: gestión de casos.
--   · editar_reporte: quien publicó corrige los datos del animal (no el tipo,
--     la ubicación ni las fotos).
--   · borrar_reporte: quien publicó borra el caso con los reportes unidos a
--     él. Es la misma lógica que limpiar_cuenta usa para un caso, que pasa a
--     una función compartida (borrar_casos).
--   · fotos_del_reporte: las fotos propias del caso, para que la app las borre
--     con la API de Storage antes de borrar el reporte (nunca por SQL).
--   · Miniaturas: la app sube cada foto con su miniatura al lado. Para la base,
--     una foto y sus variantes comparten la ruta hasta el primer punto
--     (raiz_foto). La convención del nombre vive en src/lib/imagenes.ts.

-- ---------------------------------------------------------------------------
-- 1. Variantes de una foto
-- ---------------------------------------------------------------------------

-- 'uid/abc.jpg' y 'uid/abc.miniatura.jpg' son la misma foto: 'uid/abc'.
create or replace function public.raiz_foto(p_ruta text)
returns text
language sql
immutable
set search_path = ''
as $$
  select split_part(p_ruta, '.', 1);
$$;

revoke all on function public.raiz_foto from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Un caso con los reportes unidos a él
-- ---------------------------------------------------------------------------

-- Los casos dados y, siguiendo vinculado_a hacia atrás, todo lo que se unió a
-- ellos (y lo que se unió a eso).
create or replace function public.arbol_de_casos(p_raices uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with recursive arbol as (
    select a.id from public.animales a where a.id = any (p_raices)
    union
    select a.id from public.animales a join arbol on a.vinculado_a = arbol.id
  )
  select id from arbol;
$$;

revoke all on function public.arbol_de_casos from public, anon, authenticated;

-- Borra los casos dados con los reportes unidos a ellos. Por cascada se van
-- sus avistamientos (y su cola de reconocimiento), historial, contactos de
-- resguardo, coincidencias, seguimientos, denuncias y conversaciones con sus
-- mensajes. Antes se borran los avisos que apuntaban a cualquiera de esas
-- cosas, que si no quedarían llevando a un caso que ya no existe.
-- Devuelve los ids borrados.
create or replace function public.borrar_casos(p_raices uuid[])
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_coincidencias text[];
  v_conversaciones text[];
begin
  select coalesce(array_agg(id), '{}') into v_ids from public.arbol_de_casos(p_raices) as id;
  if cardinality(v_ids) = 0 then
    return v_ids;
  end if;

  select coalesce(array_agg(k.id::text), '{}') into v_coincidencias
  from public.coincidencias k
  where k.animal_origen = any (v_ids) or k.animal_candidato = any (v_ids);

  select coalesce(array_agg(cv.id::text), '{}') into v_conversaciones
  from public.conversaciones cv
  where cv.animal_id = any (v_ids);

  delete from public.notificaciones n
  where n.datos ->> 'animal_id' = any (v_ids::text[])
     or n.datos ->> 'coincidencia_id' = any (v_coincidencias)
     or n.datos ->> 'conversacion_id' = any (v_conversaciones);

  delete from public.animales where id = any (v_ids);

  return v_ids;
end;
$$;

revoke all on function public.borrar_casos from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Borrar la cuenta: la misma regla de la 0011, con borrar_casos
-- ---------------------------------------------------------------------------
create or replace function public.limpiar_cuenta(p_uid uuid, p_conservar_abiertos boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conservar boolean := coalesce(p_conservar_abiertos, true);
  v_objetivo uuid[];
  v_afectados uuid[];
begin
  if p_uid is null then
    return;
  end if;

  -- Contactos: se borran siempre.
  delete from public.contactos_resguardo where usuario_id = p_uid;
  update public.animales set contacto_familia = null
  where creado_por = p_uid and contacto_familia is not null;

  -- Casos propios que se borran, con los reportes unidos a ellos: los
  -- perdidos siempre; los encontrados, si están cerrados o si no se conservan.
  select coalesce(array_agg(a.id), '{}') into v_objetivo
  from public.animales a
  where a.creado_por = p_uid
    and not (v_conservar and a.tipo_reporte = 'encontrado' and public.caso_abierto(a.id));

  perform public.borrar_casos(v_objetivo);

  -- Sus avistamientos en casos que no se conservan.
  with borrados as (
    delete from public.avistamientos av
    where av.usuario_id = p_uid and not (v_conservar and public.caso_abierto(av.animal_id))
    returning av.animal_id
  )
  select coalesce(array_agg(distinct animal_id), '{}') into v_afectados from borrados;

  update public.animales a
  set ultimo_avistamiento_en = (select max(visto_en) from public.avistamientos where animal_id = a.id)
  where a.id = any (v_afectados);

  -- Sus cambios de estado en casos que no se conservan.
  delete from public.cambios_estado c
  where c.usuario_id = p_uid and not (v_conservar and public.caso_abierto(c.animal_id));

  -- Lo que queda publicado, sin autor.
  update public.avistamientos set usuario_id = null where usuario_id = p_uid;
  update public.cambios_estado set usuario_id = null where usuario_id = p_uid;
  update public.animales set creado_por = null where creado_por = p_uid;
end;
$$;

revoke all on function public.limpiar_cuenta from public, anon, authenticated;

-- Igual que en la 0011, pero lo que queda publicado conserva también su
-- miniatura (cualquier variante de la foto).
create or replace function public.fotos_para_borrar(p_conservar_abiertos boolean default true)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'fotos'
    and (select auth.uid()) is not null
    and split_part(o.name, '/', 1) = (select auth.uid())::text
    and not (
      coalesce(p_conservar_abiertos, true)
      and (
        exists (
          select 1 from public.animales a
          where a.creado_por = (select auth.uid())
            and a.tipo_reporte = 'encontrado'
            and public.raiz_foto(a.foto_principal_path) = public.raiz_foto(o.name)
            and public.caso_abierto(a.id)
        )
        or exists (
          select 1 from public.avistamientos av
          where av.usuario_id = (select auth.uid())
            and public.raiz_foto(av.foto_path) = public.raiz_foto(o.name)
            and public.caso_abierto(av.animal_id)
            -- Lo que vio de su propio perdido se borra con el perdido.
            and not exists (
              select 1 from public.animales p
              where p.id = av.animal_id
                and p.creado_por = (select auth.uid())
                and p.tipo_reporte = 'perdido'
            )
        )
      )
    )
  order by o.name;
$$;

revoke all on function public.fotos_para_borrar from public, anon;
grant execute on function public.fotos_para_borrar to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Editar y borrar un reporte propio
-- ---------------------------------------------------------------------------

-- El reporte, bloqueado para cambiarlo, si quien llama es quien lo publicó.
-- Un caso sin autor (cuenta borrada) no lo edita ni lo borra nadie, y uno
-- unido a otro ya es parte de ese caso.
create or replace function public.reporte_propio(p_animal_id uuid)
returns public.animales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_animal public.animales;
begin
  if v_uid is null then
    raise exception 'Necesitás una cuenta para cambiar un reporte' using errcode = '42501';
  end if;
  select * into v_animal from public.animales where id = p_animal_id for update;
  if not found then
    raise exception 'No encontramos ese reporte' using errcode = 'P0002';
  end if;
  if v_animal.creado_por is distinct from v_uid then
    raise exception 'Solo quien publicó el reporte puede cambiarlo' using errcode = '42501';
  end if;
  if v_animal.estado = 'vinculado' then
    raise exception 'Este reporte ya es parte de otro caso' using errcode = '22023';
  end if;
  return v_animal;
end;
$$;

revoke all on function public.reporte_propio from public, anon, authenticated;

-- Cambia los datos del animal. El tipo, la ubicación y las fotos no se
-- editan. El nombre y el contacto de la familia son solo de los perdidos.
-- Si cambia la especie, las coincidencias pendientes (buscadas entre la
-- especie anterior) se descartan y sus fotos vuelven a la cola de
-- reconocimiento, que busca de nuevo con la especie corregida.
create or replace function public.editar_reporte(
  p_animal_id uuid,
  p_especie public.especie,
  p_tamanio public.tamanio default null,
  p_color text default null,
  p_tiene_collar boolean default false,
  p_descripcion text default null,
  p_nombre text default null,
  p_contacto_familia text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_animal public.animales := public.reporte_propio(p_animal_id);
  v_nombre text := nullif(trim(p_nombre), '');
  v_contacto text := nullif(trim(p_contacto_familia), '');
  v_pendientes text[];
begin
  -- Corregir un reporte publica texto nuevo: pide los términos, como publicar.
  perform public.exigir_terminos();
  if p_especie is null then
    raise exception 'Elegí la especie' using errcode = '22023';
  end if;
  if v_animal.tipo_reporte = 'encontrado' and (v_nombre is not null or v_contacto is not null) then
    raise exception 'Solo un animal perdido lleva nombre y contacto de la familia' using errcode = '22023';
  end if;
  if char_length(v_nombre) > 40 then
    raise exception 'El nombre puede tener hasta 40 caracteres' using errcode = '22023';
  end if;
  if char_length(v_contacto) > 200 then
    raise exception 'El contacto puede tener hasta 200 caracteres' using errcode = '22023';
  end if;

  update public.animales
  set especie = p_especie,
      tamanio = p_tamanio,
      color = nullif(trim(p_color), ''),
      tiene_collar = coalesce(p_tiene_collar, false),
      descripcion = nullif(trim(p_descripcion), ''),
      nombre = v_nombre,
      contacto_familia = v_contacto
  where id = p_animal_id;

  if p_especie is distinct from v_animal.especie then
    with descartadas as (
      delete from public.coincidencias k
      where k.estado = 'pendiente'
        and (k.animal_origen = p_animal_id or k.animal_candidato = p_animal_id)
      returning k.id
    )
    select coalesce(array_agg(id::text), '{}') into v_pendientes from descartadas;

    delete from public.notificaciones n where n.datos ->> 'coincidencia_id' = any (v_pendientes);

    insert into public.cola_vision (avistamiento_id)
    select av.id from public.avistamientos av
    where av.animal_id = p_animal_id and av.foto_path is not null
    on conflict (avistamiento_id) do update
      set estado = 'pendiente', intentos = 0, ultimo_error = null;
  end if;
end;
$$;

revoke all on function public.editar_reporte from public, anon;
grant execute on function public.editar_reporte to authenticated;

-- Las fotos de la carpeta de quien publicó que se van con el caso: las de sus
-- avistamientos (la primera incluida) en el caso y en los reportes unidos a
-- él, con sus variantes, salvo que algo fuera del caso use la misma foto.
-- Las de otras personas quedan en Storage, como al borrar una cuenta.
create or replace function public.fotos_del_reporte(p_animal_id uuid)
returns setof text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_creador uuid;
  v_estado public.estado_animal;
begin
  -- Las mismas reglas que reporte_propio, sin bloquear la fila (es una lectura).
  if v_uid is null then
    raise exception 'Necesitás una cuenta para cambiar un reporte' using errcode = '42501';
  end if;
  select creado_por, estado into v_creador, v_estado from public.animales where id = p_animal_id;
  if not found then
    raise exception 'No encontramos ese reporte' using errcode = 'P0002';
  end if;
  if v_creador is distinct from v_uid then
    raise exception 'Solo quien publicó el reporte puede cambiarlo' using errcode = '42501';
  end if;
  if v_estado = 'vinculado' then
    raise exception 'Este reporte ya es parte de otro caso' using errcode = '22023';
  end if;

  return query
  with arbol as (
    select id from public.arbol_de_casos(array[p_animal_id]) as id
  ), del_caso as (
    select public.raiz_foto(av.foto_path) as raiz
    from public.avistamientos av
    where av.animal_id in (select id from arbol) and av.foto_path is not null
    union
    select public.raiz_foto(a.foto_principal_path)
    from public.animales a
    where a.id in (select id from arbol)
  )
  select o.name
  from storage.objects o
  where o.bucket_id = 'fotos'
    and split_part(o.name, '/', 1) = v_uid::text
    and public.raiz_foto(o.name) in (select raiz from del_caso)
    and not exists (
      select 1 from public.avistamientos av
      where av.animal_id not in (select id from arbol)
        and public.raiz_foto(av.foto_path) = public.raiz_foto(o.name)
    )
    and not exists (
      select 1 from public.animales a
      where a.id not in (select id from arbol)
        and public.raiz_foto(a.foto_principal_path) = public.raiz_foto(o.name)
    )
    and not exists (
      select 1 from public.perfiles p
      where public.raiz_foto(p.avatar_path) = public.raiz_foto(o.name)
    )
  order by o.name;
end;
$$;

revoke all on function public.fotos_del_reporte from public, anon;
grant execute on function public.fotos_del_reporte to authenticated;

-- Borra un reporte propio y los reportes unidos a él, con todo lo que tienen,
-- también los avistamientos de otras personas. No pide los términos: borrar
-- no publica nada.
create or replace function public.borrar_reporte(p_animal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.reporte_propio(p_animal_id);
  perform public.borrar_casos(array[p_animal_id]);
end;
$$;

revoke all on function public.borrar_reporte from public, anon;
grant execute on function public.borrar_reporte to authenticated;
