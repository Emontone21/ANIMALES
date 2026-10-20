-- Fase 9, parte 2 (docs/reportes/2026-10-19-revision-2.md).
--   · Un caso oculto por moderación deja de verse: el caso, sus avistamientos,
--     su historial, sus coincidencias y los contactos de resguardo solo los
--     ven quien lo publicó y los moderadores. Antes solo salía del mapa; por
--     su link y por la API se veía completo, con el contacto de la familia.
--     Volver a mostrarlo (moderar_animal con false) restaura todo: es la
--     misma marca.
--   · Las conversaciones sobre un caso oculto siguen para sus participantes,
--     sin los datos del caso (conversaciones_detalle con left join).
--   · abrir_conversacion: quien publicó un reporte del caso puede escribirle
--     a quien avisó que lo vio; no se abren conversaciones nuevas sobre un
--     caso oculto.
-- Pruebas: supabase/tests/fase9_parte2.sql.

-- ---------------------------------------------------------------------------
-- 1. Quién ve un caso
-- ---------------------------------------------------------------------------

-- Un caso oculto lo ven solo quien lo publicó y los moderadores. auth.uid() y
-- es_moderador() van en un select para que se evalúen una vez por consulta.
drop policy if exists "animales: lectura publica" on public.animales;
drop policy if exists "animales: lectura si no esta oculto" on public.animales;
create policy "animales: lectura si no esta oculto"
  on public.animales for select
  using (
    not oculto
    or creado_por = (select auth.uid())
    or (select public.es_moderador())
  );

-- Lo que cuelga de un caso se ve si se ve el caso. La subconsulta pasa por la
-- política de animales de quien consulta, así que aplica la misma regla.
drop policy if exists "avistamientos: lectura publica" on public.avistamientos;
drop policy if exists "avistamientos: lectura si se ve el caso" on public.avistamientos;
create policy "avistamientos: lectura si se ve el caso"
  on public.avistamientos for select
  using (exists (select 1 from public.animales a where a.id = avistamientos.animal_id));

drop policy if exists "cambios_estado: lectura publica" on public.cambios_estado;
drop policy if exists "cambios_estado: lectura si se ve el caso" on public.cambios_estado;
create policy "cambios_estado: lectura si se ve el caso"
  on public.cambios_estado for select
  using (exists (select 1 from public.animales a where a.id = cambios_estado.animal_id));

-- Una coincidencia se ve si se ven los dos lados: con uno oculto, solo la ven
-- quien lo publicó y los moderadores.
drop policy if exists "coincidencias: lectura publica" on public.coincidencias;
drop policy if exists "coincidencias: lectura si se ven los dos casos" on public.coincidencias;
create policy "coincidencias: lectura si se ven los dos casos"
  on public.coincidencias for select
  using (
    exists (select 1 from public.animales a where a.id = coincidencias.animal_origen)
    and exists (select 1 from public.animales a where a.id = coincidencias.animal_candidato)
  );

-- El contacto de resguardo, como en la 0011 y además si se ve el caso. El
-- contacto de la familia es una columna de animales: sigue a la fila.
drop policy if exists "contactos_resguardo: lectura segun el caso" on public.contactos_resguardo;
create policy "contactos_resguardo: lectura segun el caso"
  on public.contactos_resguardo for select
  using (
    public.puede_ver_contacto_resguardo(animal_id, usuario_id)
    and exists (select 1 from public.animales a where a.id = contactos_resguardo.animal_id)
  );

-- ---------------------------------------------------------------------------
-- 2. Conversaciones sobre un caso que no se ve
-- ---------------------------------------------------------------------------

-- Igual que en la 0011, con left join a animales: la conversación sigue para
-- sus participantes aunque el caso esté oculto, sin sus datos.
-- animal_disponible dice si quien consulta puede ver el caso.
create or replace view public.conversaciones_detalle
with (security_invoker = true)
as
select
  c.id,
  c.animal_id,
  a.foto_principal_path as animal_foto_path,
  a.especie as animal_especie,
  case when c.participante_a = (select auth.uid()) then c.participante_b else c.participante_a end as otro_id,
  p.nombre_publico as otro_nombre,
  u.cuerpo as ultimo_mensaje,
  u.created_at as ultimo_mensaje_en,
  (
    select count(*) from public.mensajes m
    where m.conversacion_id = c.id and m.emisor_id <> (select auth.uid()) and m.leido_en is null
  ) as no_leidos,
  c.updated_at,
  public.hay_bloqueo_con(p.id) as bloqueada,
  exists (
    select 1 from public.bloqueos b
    where b.bloqueador_id = (select auth.uid()) and b.bloqueado_id = p.id
  ) as bloqueaste,
  a.id is not null as animal_disponible
from public.conversaciones c
left join public.animales a on a.id = c.animal_id
join public.perfiles p
  on p.id = case when c.participante_a = (select auth.uid()) then c.participante_b else c.participante_a end
left join lateral (
  select cuerpo, created_at from public.mensajes
  where conversacion_id = c.id
  order by created_at desc
  limit 1
) u on true;

-- ---------------------------------------------------------------------------
-- 3. Con quién se puede abrir una conversación
-- ---------------------------------------------------------------------------

-- Igual que en la 0013, y además:
--   · quien publicó un reporte del caso (el principal o uno unido a él) le
--     puede escribir a quien avisó que lo vio en cualquier reporte del caso;
--   · no se abre una conversación nueva sobre un caso oculto.
-- El caso es todo el árbol de reportes unidos, desde el principal. Una
-- conversación que ya existe se puede retomar.
create or replace function public.abrir_conversacion(p_animal_id uuid, p_otro_usuario uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_oculto boolean;
  v_arbol uuid[];
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
  select oculto into v_oculto from public.animales where id = p_animal_id;
  if not found then
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

  if v_id is null then
    if v_oculto then
      raise exception 'Esta publicación no está disponible.' using errcode = 'P0002';
    end if;

    v_arbol := array(select public.arbol_de_casos(array[public.caso_principal(p_animal_id)]));

    if not (
      -- La otra persona publicó un reporte del caso o lo resguardó (0013).
      exists (
        select 1 from public.animales a
        where a.id = any (v_arbol) and a.creado_por = p_otro_usuario
      )
      or exists (
        select 1 from public.cambios_estado c
        where c.animal_id = any (v_arbol)
          and c.estado_nuevo = 'resguardado'
          and c.usuario_id = p_otro_usuario
      )
      -- Quien publicó un reporte del caso le escribe a quien avisó que lo vio.
      or (
        exists (
          select 1 from public.animales a
          where a.id = any (v_arbol) and a.creado_por = v_uid
        )
        and exists (
          select 1 from public.avistamientos av
          where av.animal_id = any (v_arbol) and av.usuario_id = p_otro_usuario
        )
      )
    ) then
      raise exception 'Solo podés escribirle a quien publicó el caso, a quien lo resguarda o, si lo publicaste vos, a quien lo vio'
        using errcode = '42501';
    end if;
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
