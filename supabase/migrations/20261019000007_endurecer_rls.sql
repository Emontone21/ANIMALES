-- =============================================================================
-- 0007 · Endurecer permisos de escritura
-- Las políticas de UPDATE de 0003–0006 filtran filas pero no columnas, y
-- animales, avistamientos y cambios_estado aceptaban escrituras directas que
-- salteaban las validaciones de las RPC. Desde acá:
--   · perfiles: cada usuario edita solo nombre_publico y avatar_path.
--   · animales, avistamientos, cambios_estado: sin escritura directa desde la
--     API; todo pasa por RPC security definer.
--   · moderación: moderar_animal reemplaza el UPDATE directo de animales.oculto.
--   · mensajes, notificaciones, denuncias: UPDATE solo de la columna que la
--     app cambia.
-- Además corrige animales_detalle (los reportes vinculados desaparecían) y el
-- estado_anterior que guardaba resolver_coincidencia.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- perfiles: nadie puede cambiarse es_moderador (se sigue asignando por SQL).
-- La política "perfiles: editar el propio" sigue limitando la fila.
-- Revocar a nivel tabla también revoca los permisos por columna, por eso el
-- grant va después.
-- ---------------------------------------------------------------------------
revoke update on public.perfiles from anon, authenticated;
grant update (nombre_publico, avatar_path) on public.perfiles to authenticated;

-- ---------------------------------------------------------------------------
-- animales, avistamientos, cambios_estado: solo lectura desde la API.
-- Las escrituras pasan por publicar_animal, registrar_avistamiento,
-- cambiar_estado_animal, resolver_coincidencia y moderar_animal.
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.animales from anon, authenticated;
revoke insert, update, delete on public.avistamientos from anon, authenticated;
revoke insert, update, delete on public.cambios_estado from anon, authenticated;

-- Sin permisos estas políticas no tienen efecto; se borran para que el esquema
-- muestre lo que de verdad se permite. Queda solo la lectura pública.
drop policy "animales: publicar con cuenta" on public.animales;
drop policy "animales: editar el propio" on public.animales;
drop policy "animales: borrar el propio" on public.animales;
drop policy "animales: moderadores editan" on public.animales;
drop policy "avistamientos: crear con cuenta" on public.avistamientos;
drop policy "avistamientos: editar el propio" on public.avistamientos;
drop policy "avistamientos: borrar el propio" on public.avistamientos;
drop policy "cambios_estado: crear con cuenta" on public.cambios_estado;

-- publicar_animal y registrar_avistamiento eran security invoker y dependían
-- de las políticas de INSERT que se acaban de borrar. Pasan a security definer
-- sin tocar el cuerpo, así que conservan todas sus validaciones (cuenta, foto,
-- ubicación, caso abierto). creado_por y usuario_id salen de auth.uid(), nunca
-- de un parámetro, y las dos ya fijaban search_path = ''.
-- Efecto secundario: el trigger actualizar_ultimo_avistamiento ahora corre con
-- el dueño de la función. Antes, cuando el avistamiento era de alguien que no
-- había publicado el caso, la política de UPDATE de animales dejaba sin efecto
-- la actualización de ultimo_avistamiento_en.
alter function public.publicar_animal(
  public.especie, text, double precision, double precision, timestamptz,
  public.tamanio, text, boolean, text
) security definer;

alter function public.registrar_avistamiento(
  uuid, text, double precision, double precision, timestamptz, text
) security definer;

-- ---------------------------------------------------------------------------
-- Moderación: ocultar o mostrar una publicación desde el panel.
-- ---------------------------------------------------------------------------
create or replace function public.moderar_animal(p_animal_id uuid, p_oculto boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_moderador() then
    raise exception 'Solo moderadores pueden ocultar o mostrar publicaciones' using errcode = '42501';
  end if;

  update public.animales set oculto = p_oculto where id = p_animal_id;
  if not found then
    raise exception 'No encontramos este reporte' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.moderar_animal from public, anon;
grant execute on function public.moderar_animal to authenticated;

-- ---------------------------------------------------------------------------
-- UPDATE por columna donde la app escribe directo. Las políticas existentes
-- siguen limitando qué filas.
-- ---------------------------------------------------------------------------
revoke update on public.mensajes from anon, authenticated;
grant update (leido_en) on public.mensajes to authenticated;

revoke update on public.notificaciones from anon, authenticated;
grant update (leida_en) on public.notificaciones to authenticated;

revoke update on public.denuncias from anon, authenticated;
grant update (estado) on public.denuncias to authenticated;

-- ---------------------------------------------------------------------------
-- animales_detalle: un reporte vinculado se queda sin avistamientos (pasan al
-- principal). Con el join obligatorio desaparecía de la vista y la app no
-- podía redirigir al caso principal. Con left join aparece con lat, lng y
-- ultimo_visto_en en null. Mismas columnas y en el mismo orden.
-- ---------------------------------------------------------------------------
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
  a.oculto
from public.animales a
join public.perfiles p on p.id = a.creado_por
left join lateral (
  select ubicacion, visto_en
  from public.avistamientos
  where animal_id = a.id
  order by visto_en desc
  limit 1
) u on true;

-- ---------------------------------------------------------------------------
-- resolver_coincidencia: el historial guardaba estado_anterior = 'avistado'
-- aunque el secundario estuviera resguardado o reunido. Ahora guarda el estado
-- real, leído con for update para que dos confirmaciones simultáneas no lo
-- vinculen dos veces. Además el case sin cast devolvía text y el UPDATE de
-- coincidencias.estado fallaba siempre (ni confirmar ni rechazar andaban).
-- Quién puede confirmar no cambia.
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
  v_principal uuid;
  v_secundario uuid;
  v_estado_secundario public.estado_animal;
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

  update public.coincidencias
  set estado = (case when p_confirmada then 'confirmada' else 'rechazada' end)::public.estado_coincidencia,
      resuelta_por = v_uid,
      resuelta_en = now()
  where id = p_id;

  if not p_confirmada then
    return null;
  end if;

  -- El caso más viejo es el principal.
  select
    case when a1.created_at <= a2.created_at then a1.id else a2.id end,
    case when a1.created_at <= a2.created_at then a2.id else a1.id end
  into v_principal, v_secundario
  from public.animales a1, public.animales a2
  where a1.id = v_c.animal_origen and a2.id = v_c.animal_candidato;

  select estado into v_estado_secundario
  from public.animales
  where id = v_secundario
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
