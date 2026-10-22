-- =============================================================================
-- 0026 · Muro de reencuentros: los finales felices y el agradecimiento
-- 1. historias_reencuentro: la familia de un perdido que volvió a casa cuenta
--    cómo volvió (una por caso): una frase de hasta 280 caracteres, una foto
--    opcional (si no hay, la del caso) y si se muestra el nombre. Los
--    teléfonos, links y emails de la frase se tapan (ocultar_datos_de_contacto,
--    como los textos de la IA) y la base los rechaza como última barrera. Solo
--    la familia la publica, la edita o la borra; borrar la cuenta la borra. Se
--    lee por RPC, que devuelven solo lo público.
-- 2. agradecimientos: la familia le agradece a quien participó en su caso
--    (avisó que lo vio, lo resguardó o le escribió), con un mensaje opcional.
--    Le llega a cada uno a Actividad (y al celular). No son públicos: los ven
--    solo la familia y quien lo recibe. "Ayudaste a reunir a N familias" cuenta
--    solo lo que una familia agradeció.
-- 3. El muro: contador_reencuentros (todos los casos reunidos, sin ocultos ni
--    datos de demo) y muro_reencuentros / historia_reencuentro, públicas y sin
--    cuenta. Sin ubicación ni datos de nadie.
-- 4. Moderación: las historias se denuncian y se ocultan con el sistema de
--    siempre (denuncias.historia, moderar_historia; a las 3 denuncias de cuentas
--    con antigüedad se ocultan solas).
-- 5. Ajustes: el aviso de un agradecimiento no se agrupa con los del caso
--    (preparar_avisos_push), y las fotos de la historia se borran con el caso
--    (fotos_del_reporte) y con la cuenta (limpiar_cuenta).
-- Prueba: supabase/tests/reencuentros.sql. Ver docs/DECISIONES.md, "Muro de
-- reencuentros".
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Historias
-- ---------------------------------------------------------------------------

create table public.historias_reencuentro (
  animal_id uuid primary key references public.animales (id) on delete cascade,
  familia_id uuid not null references public.perfiles (id) on delete cascade,
  -- Ruta en el bucket "fotos" (carpeta de la familia). Null: la foto del caso.
  foto_path text,
  frase text not null check (char_length(frase) between 1 and 280),
  mostrar_nombre boolean not null default true,
  -- Oculta por moderación: no sale en el muro ni en su link.
  oculta boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint historias_reencuentro_sin_contacto check (not public.tiene_datos_de_contacto(frase))
);

comment on table public.historias_reencuentro is
  'Cómo volvió a casa un perdido, contado por su familia. Se lee por RPC (muro_reencuentros, historia_reencuentro).';

alter table public.historias_reencuentro enable row level security;

-- La familia ve la suya (también oculta) y moderación todas. El resto, por las RPC.
create policy "historias_reencuentro: la familia y moderación"
  on public.historias_reencuentro for select to authenticated
  using (familia_id = (select auth.uid()) or public.es_moderador());

-- anon lee sin filas (no tiene política): denuncias_detalle la une y se sigue
-- pudiendo consultar sin cuenta, vacía, como antes.
revoke all on public.historias_reencuentro from anon, authenticated;
grant select on public.historias_reencuentro to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Agradecimientos
-- ---------------------------------------------------------------------------

create table public.agradecimientos (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animales (id) on delete cascade,
  familia_id uuid not null references public.perfiles (id) on delete cascade,
  -- Quien ayudó.
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  mensaje text check (char_length(mensaje) between 1 and 280),
  created_at timestamptz not null default now(),
  unique (animal_id, usuario_id),
  constraint agradecimientos_a_otra_persona check (usuario_id <> familia_id),
  constraint agradecimientos_sin_contacto check (not public.tiene_datos_de_contacto(mensaje))
);

create index agradecimientos_usuario_idx on public.agradecimientos (usuario_id);

comment on table public.agradecimientos is
  'Una familia le agradece a quien ayudó en su caso. Solo los ven la familia y quien lo recibe.';

alter table public.agradecimientos enable row level security;

-- Quien lo recibe, solo si ve el caso (un caso oculto lo ven solo quien lo
-- publicó y moderación: la política de animales lo decide).
create policy "agradecimientos: la familia y quien lo recibe"
  on public.agradecimientos for select to authenticated
  using (
    familia_id = (select auth.uid())
    or (
      usuario_id = (select auth.uid())
      and exists (select 1 from public.animales a where a.id = agradecimientos.animal_id)
    )
  );

revoke all on public.agradecimientos from anon, authenticated;
grant select on public.agradecimientos to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Reglas compartidas
-- ---------------------------------------------------------------------------

-- Datos de demo: cargados por SQL, con una URL de otro sitio como foto. La app
-- nunca guarda una URL (las RPC exigen una foto del bucket).
create or replace function public.es_foto_de_demo(p_ruta text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_ruta ~ '^https?://', false);
$$;

-- El nombre del animal, para mostrarlo en público: sin datos de contacto.
create or replace function public.nombre_publicable(p_nombre text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when nullif(btrim(p_nombre), '') is null or public.tiene_datos_de_contacto(p_nombre) then null
    else btrim(p_nombre)
  end;
$$;

-- Cuándo volvió (el último pase a reunido) y cuántos días estuvo perdido,
-- contando días de Montevideo: 0 es "el mismo día".
create or replace function public.datos_del_reencuentro(p_animal_id uuid)
returns table (reunido_en timestamptz, dias integer)
language sql
stable
security definer
set search_path = ''
as $$
  with r as (
    select
      coalesce(
        (select max(c.created_at) from public.cambios_estado c
         where c.animal_id = a.id and c.estado_nuevo = 'reunido'),
        a.created_at
      ) as reunido_en,
      coalesce(
        (select min(av.visto_en) from public.avistamientos av
         where av.animal_id = a.id and av.tipo = 'perdido'),
        a.created_at
      ) as perdido_desde
    from public.animales a
    where a.id = p_animal_id
  )
  select
    r.reunido_en,
    greatest(
      ((r.reunido_en at time zone 'America/Montevideo')::date
        - (r.perdido_desde at time zone 'America/Montevideo')::date),
      0
    )::integer
  from r;
$$;

-- El caso de la familia que quien llama puede contar o agradecer: un perdido
-- suyo, reunido y visible. Si no, el error que corresponde.
create or replace function public.caso_de_la_familia(p_animal_id uuid)
returns public.animales
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_caso public.animales;
begin
  if v_uid is null then
    raise exception 'Necesitás una cuenta para hacer esto' using errcode = '42501';
  end if;
  select * into v_caso from public.animales where id = p_animal_id;
  if not found then
    raise exception 'No encontramos este reporte' using errcode = 'P0002';
  end if;
  if v_caso.tipo_reporte is distinct from 'perdido' or v_caso.creado_por is distinct from v_uid then
    raise exception 'Esto lo hace la familia del animal' using errcode = '42501';
  end if;
  if v_caso.oculto then
    raise exception 'Esta publicación fue ocultada por moderación' using errcode = '22023';
  end if;
  if v_caso.estado is distinct from 'reunido' then
    raise exception 'Primero marcá el caso como reunido' using errcode = '22023';
  end if;
  return v_caso;
end;
$$;

-- Una foto (por su raíz) que ya usa otra cosa: un caso, un avistamiento, un
-- avatar u otra historia. Así borrar una historia nunca se lleva una foto ajena.
create or replace function public.foto_en_uso(p_ruta text, p_salvo_historia uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.avistamientos av where public.raiz_foto(av.foto_path) = public.raiz_foto(p_ruta)
    )
    or exists (
      select 1 from public.animales a where public.raiz_foto(a.foto_principal_path) = public.raiz_foto(p_ruta)
    )
    or exists (
      select 1 from public.perfiles p where public.raiz_foto(p.avatar_path) = public.raiz_foto(p_ruta)
    )
    or exists (
      select 1 from public.historias_reencuentro h
      where public.raiz_foto(h.foto_path) = public.raiz_foto(p_ruta)
        and h.animal_id is distinct from p_salvo_historia
    );
$$;

-- Los archivos de una foto de la historia (la original y sus variantes) de la
-- carpeta de quien llama que nada más usa: los borra la app con la API de Storage.
create or replace function public.archivos_de_foto(p_ruta text, p_uid uuid, p_salvo_historia uuid)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where p_ruta is not null
    and o.bucket_id = 'fotos'
    and split_part(o.name, '/', 1) = p_uid::text
    and public.raiz_foto(o.name) = public.raiz_foto(p_ruta)
    and not public.foto_en_uso(p_ruta, p_salvo_historia)
  order by o.name;
$$;

revoke all on function public.es_foto_de_demo(text) from public, anon, authenticated;
revoke all on function public.nombre_publicable(text) from public, anon, authenticated;
revoke all on function public.datos_del_reencuentro(uuid) from public, anon, authenticated;
revoke all on function public.caso_de_la_familia(uuid) from public, anon, authenticated;
revoke all on function public.foto_en_uso(text, uuid) from public, anon, authenticated;
revoke all on function public.archivos_de_foto(text, uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Contar la historia
-- ---------------------------------------------------------------------------

-- Crea o cambia la historia. p_foto_path: la foto que queda (la actual, una
-- nueva subida desde la app o null para usar la del caso). Devuelve los
-- archivos de la foto anterior si cambió, para que la app los borre.
create or replace function public.guardar_historia_reencuentro(
  p_animal_id uuid,
  p_frase text,
  p_mostrar_nombre boolean default true,
  p_foto_path text default null
)
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_caso public.animales;
  v_frase text := nullif(btrim(p_frase), '');
  v_foto text := nullif(btrim(p_foto_path), '');
  v_anterior text;
begin
  v_caso := public.caso_de_la_familia(p_animal_id);
  perform public.exigir_terminos();

  if v_frase is null then
    raise exception 'Contá en una frase cómo volvió' using errcode = '22023';
  end if;
  if char_length(v_frase) > 280 then
    raise exception 'La historia puede tener hasta 280 caracteres' using errcode = '22023';
  end if;
  -- Los teléfonos, links y emails no se publican.
  v_frase := left(public.ocultar_datos_de_contacto(v_frase), 280);

  select foto_path into v_anterior
  from public.historias_reencuentro
  where animal_id = p_animal_id
  for update;

  if v_foto is not null and v_foto is distinct from v_anterior then
    if not public.es_foto_propia(v_foto, v_uid) then
      raise exception 'La foto tiene que estar subida desde la app' using errcode = '22023';
    end if;
    if public.foto_en_uso(v_foto, p_animal_id) then
      raise exception 'Esa foto ya está publicada' using errcode = '22023';
    end if;
  end if;

  insert into public.historias_reencuentro (animal_id, familia_id, foto_path, frase, mostrar_nombre)
  values (p_animal_id, v_uid, v_foto, v_frase, coalesce(p_mostrar_nombre, true))
  on conflict (animal_id) do update
  set foto_path = excluded.foto_path,
      frase = excluded.frase,
      mostrar_nombre = excluded.mostrar_nombre,
      updated_at = now();

  if v_anterior is not null and v_anterior is distinct from v_foto then
    return query select * from public.archivos_de_foto(v_anterior, v_uid, null);
  end if;
end;
$$;

-- Los archivos de la foto de la historia propia, para borrarlos antes de
-- borrar la historia (primero Storage, después la base, como un reporte).
create or replace function public.fotos_de_la_historia(p_animal_id uuid)
returns setof text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_foto text;
begin
  if v_uid is null then
    raise exception 'Necesitás una cuenta para hacer esto' using errcode = '42501';
  end if;
  select foto_path into v_foto
  from public.historias_reencuentro
  where animal_id = p_animal_id and familia_id = v_uid;
  if not found then
    raise exception 'No encontramos la historia' using errcode = 'P0002';
  end if;
  return query select * from public.archivos_de_foto(v_foto, v_uid, p_animal_id);
end;
$$;

-- La familia la borra cuando quiera (también con el caso reabierto u oculto).
create or replace function public.borrar_historia_reencuentro(p_animal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Necesitás una cuenta para hacer esto' using errcode = '42501';
  end if;
  delete from public.historias_reencuentro where animal_id = p_animal_id and familia_id = v_uid;
  if not found then
    raise exception 'No encontramos la historia' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.guardar_historia_reencuentro(uuid, text, boolean, text) from public, anon;
revoke all on function public.fotos_de_la_historia(uuid) from public, anon;
revoke all on function public.borrar_historia_reencuentro(uuid) from public, anon;
grant execute on function public.guardar_historia_reencuentro(uuid, text, boolean, text) to authenticated;
grant execute on function public.fotos_de_la_historia(uuid) to authenticated;
grant execute on function public.borrar_historia_reencuentro(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Agradecer
-- ---------------------------------------------------------------------------

-- Quiénes participaron en el caso (todo el árbol de reportes unidos): avisaron
-- que lo vieron (o lo encontraron), lo resguardaron o le escribieron a la
-- familia. Nunca la familia, una cuenta borrada ni alguien con un bloqueo
-- con ella, en cualquier sentido.
create or replace function public.participantes_internos(p_animal_id uuid, p_familia uuid)
returns table (usuario uuid, lo_vio boolean, lo_resguardo boolean, le_escribio boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with arbol as (
    select x.id from public.arbol_de_casos(array[p_animal_id]) as x (id)
  ), vieron as (
    select distinct av.usuario_id as u
    from public.avistamientos av
    where av.animal_id in (select arbol.id from arbol)
      and av.tipo in ('visto', 'encontrado')
      and av.usuario_id is not null
  ), resguardaron as (
    select distinct c.usuario_id as u
    from public.cambios_estado c
    where c.animal_id in (select arbol.id from arbol)
      and c.estado_nuevo = 'resguardado'
      and c.usuario_id is not null
  ), escribieron as (
    select distinct m.emisor_id as u
    from public.conversaciones cv
    join public.mensajes m on m.conversacion_id = cv.id
    where cv.animal_id in (select arbol.id from arbol)
      and p_familia in (cv.participante_a, cv.participante_b)
  ), todos as (
    select vieron.u from vieron
    union select resguardaron.u from resguardaron
    union select escribieron.u from escribieron
  )
  select
    todos.u,
    todos.u in (select vieron.u from vieron),
    todos.u in (select resguardaron.u from resguardaron),
    todos.u in (select escribieron.u from escribieron)
  from todos
  where todos.u is distinct from p_familia
    and not exists (
      select 1 from public.bloqueos b
      where (b.bloqueador_id = p_familia and b.bloqueado_id = todos.u)
         or (b.bloqueador_id = todos.u and b.bloqueado_id = p_familia)
    );
$$;

revoke all on function public.participantes_internos(uuid, uuid) from public, anon, authenticated;

-- La lista que ve la familia, con el nombre público y si ya le agradeció.
create or replace function public.participantes_del_caso(p_animal_id uuid)
returns table (
  usuario_id uuid,
  nombre_publico text,
  avatar_path text,
  lo_vio boolean,
  lo_resguardo boolean,
  le_escribio boolean,
  agradecido boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_caso public.animales;
begin
  v_caso := public.caso_de_la_familia(p_animal_id);
  return query
  select
    p.id,
    p.nombre_publico,
    p.avatar_path,
    x.lo_vio,
    x.lo_resguardo,
    x.le_escribio,
    exists (
      select 1 from public.agradecimientos g
      where g.animal_id = p_animal_id and g.usuario_id = p.id
    )
  from public.participantes_internos(p_animal_id, v_caso.creado_por) x
  join public.perfiles p on p.id = x.usuario
  order by p.nombre_publico, p.id;
end;
$$;

-- Le agradece a cada uno de p_usuarios (que tienen que haber participado) y le
-- avisa. A quien ya le agradeció no le vuelve a llegar. Devuelve cuántos nuevos.
create or replace function public.agradecer(
  p_animal_id uuid,
  p_usuarios uuid[],
  p_mensaje text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_caso public.animales;
  v_mensaje text := nullif(btrim(p_mensaje), '');
  v_de text;
  v_usuario uuid;
  v_nuevos integer := 0;
begin
  v_caso := public.caso_de_la_familia(p_animal_id);
  perform public.exigir_terminos();

  if coalesce(cardinality(p_usuarios), 0) = 0 then
    raise exception 'Elegí a quién agradecerle' using errcode = '22023';
  end if;
  if cardinality(p_usuarios) > 50 then
    raise exception 'Son demasiadas personas para una sola vez' using errcode = '22023';
  end if;
  if char_length(v_mensaje) > 280 then
    raise exception 'El mensaje puede tener hasta 280 caracteres' using errcode = '22023';
  end if;
  v_mensaje := left(public.ocultar_datos_de_contacto(v_mensaje), 280);

  if exists (
    select 1 from unnest(p_usuarios) as e (u)
    where e.u is null
       or not exists (
         select 1 from public.participantes_internos(p_animal_id, v_uid) x where x.usuario = e.u
       )
  ) then
    raise exception 'Solo podés agradecerle a quien participó en el caso' using errcode = '22023';
  end if;

  -- "La familia de Toby te agradeció" / "La familia del perro te agradeció".
  v_de := coalesce(
    'de ' || public.nombre_publicable(v_caso.nombre),
    case v_caso.especie when 'perro' then 'del perro' when 'gato' then 'del gato' else 'del animal' end
  );

  for v_usuario in select distinct e.u from unnest(p_usuarios) as e (u) loop
    insert into public.agradecimientos (animal_id, familia_id, usuario_id, mensaje)
    values (p_animal_id, v_uid, v_usuario, v_mensaje)
    on conflict (animal_id, usuario_id) do nothing;
    if found then
      v_nuevos := v_nuevos + 1;
      perform public.notificar(
        v_usuario,
        'agradecimiento',
        'La familia ' || v_de || ' te agradeció',
        coalesce(v_mensaje, 'Gracias por ayudar a que volviera a casa.'),
        jsonb_build_object('animal_id', p_animal_id),
        v_uid
      );
    end if;
  end loop;

  return v_nuevos;
end;
$$;

-- "Ayudaste a reunir a N familias": los casos visibles en los que una familia
-- le agradeció a quien llama.
create or replace function public.familias_que_ayude()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct g.animal_id)::integer
  from public.agradecimientos g
  join public.animales a on a.id = g.animal_id
  where g.usuario_id = (select auth.uid()) and not a.oculto;
$$;

revoke all on function public.participantes_del_caso(uuid) from public, anon;
revoke all on function public.agradecer(uuid, uuid[], text) from public, anon;
revoke all on function public.familias_que_ayude() from public, anon;
grant execute on function public.participantes_del_caso(uuid) to authenticated;
grant execute on function public.agradecer(uuid, uuid[], text) to authenticated;
grant execute on function public.familias_que_ayude() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. El muro (público, sin cuenta)
-- ---------------------------------------------------------------------------

-- Todos los casos reunidos, sin ocultos ni datos de demo. Los unidos a otro no
-- cuentan aparte: su caso principal es el que se reunió.
create or replace function public.contador_reencuentros()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.animales a
  where a.estado = 'reunido'
    and not a.oculto
    and not public.es_foto_de_demo(a.foto_principal_path);
$$;

-- Lo único de una historia que se muestra: el caso (para el link), el nombre si
-- la familia quiso, la especie, la foto, la frase, cuántos días y cuándo
-- volvió. Nada de quién publicó, contactos, la descripción ni dónde.
create or replace function public.muro_reencuentros(
  p_limite integer default 20,
  p_antes timestamptz default null
)
returns table (
  animal_id uuid,
  nombre text,
  especie public.especie,
  foto_path text,
  frase text,
  dias integer,
  reunido_en timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    case when h.mostrar_nombre then public.nombre_publicable(a.nombre) end,
    a.especie,
    coalesce(h.foto_path, a.foto_principal_path),
    h.frase,
    d.dias,
    d.reunido_en
  from public.historias_reencuentro h
  join public.animales a on a.id = h.animal_id
  cross join lateral public.datos_del_reencuentro(a.id) d
  where not h.oculta
    and not a.oculto
    and a.estado = 'reunido'
    and not public.es_foto_de_demo(a.foto_principal_path)
    and (p_antes is null or d.reunido_en < p_antes)
  order by d.reunido_en desc, a.id
  limit least(greatest(coalesce(p_limite, 20), 1), 50);
$$;

-- Una historia, para su link (/reencuentros/<id>) y la vista previa. La familia
-- y moderación la ven también oculta, con la marca.
create or replace function public.historia_reencuentro(p_animal_id uuid)
returns table (
  animal_id uuid,
  nombre text,
  especie public.especie,
  foto_path text,
  frase text,
  dias integer,
  reunido_en timestamptz,
  oculta boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    case when h.mostrar_nombre then public.nombre_publicable(a.nombre) end,
    a.especie,
    coalesce(h.foto_path, a.foto_principal_path),
    h.frase,
    d.dias,
    d.reunido_en,
    h.oculta or a.oculto
  from public.historias_reencuentro h
  join public.animales a on a.id = h.animal_id
  cross join lateral public.datos_del_reencuentro(a.id) d
  where h.animal_id = p_animal_id
    and a.estado = 'reunido'
    and not public.es_foto_de_demo(a.foto_principal_path)
    and (
      (not h.oculta and not a.oculto)
      or h.familia_id = (select auth.uid())
      or public.es_moderador()
    );
$$;

revoke all on function public.contador_reencuentros() from public;
revoke all on function public.muro_reencuentros(integer, timestamptz) from public;
revoke all on function public.historia_reencuentro(uuid) from public;
grant execute on function public.contador_reencuentros() to anon, authenticated;
grant execute on function public.muro_reencuentros(integer, timestamptz) to anon, authenticated;
grant execute on function public.historia_reencuentro(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Moderación: denunciar y ocultar historias
-- ---------------------------------------------------------------------------

-- Una denuncia es del caso o de su historia: cada persona, una de cada una.
alter table public.denuncias add column historia boolean not null default false;
alter table public.denuncias drop constraint denuncias_animal_id_usuario_id_key;
alter table public.denuncias
  add constraint denuncias_animal_usuario_historia_key unique (animal_id, usuario_id, historia);

revoke insert on public.denuncias from anon, authenticated;
grant insert (animal_id, avistamiento_id, usuario_id, motivo, detalle, historia)
  on public.denuncias to authenticated;

-- Si existe la historia (también oculta): la política no ve las ajenas.
create or replace function public.hay_historia(p_animal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.historias_reencuentro h where h.animal_id = p_animal_id);
$$;

revoke all on function public.hay_historia(uuid) from public, anon;
grant execute on function public.hay_historia(uuid) to authenticated;

drop policy "denuncias: crear" on public.denuncias;
create policy "denuncias: crear"
  on public.denuncias for insert to authenticated
  with check (
    (select auth.uid()) = usuario_id
    and public.acepto_terminos()
    and (not historia or public.hay_historia(animal_id))
  );

-- Como en la 0011, por separado para el caso y para su historia: tres
-- denuncias de cuentas que tenían al menos 7 días ocultan lo denunciado.
create or replace function public.ocultar_por_denuncias()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(distinct d.usuario_id)
    from public.denuncias d
    join public.perfiles p on p.id = d.usuario_id
    where d.animal_id = new.animal_id
      and d.historia = new.historia
      and p.created_at <= d.created_at - interval '7 days'
  ) >= 3 then
    if new.historia then
      update public.historias_reencuentro set oculta = true
      where animal_id = new.animal_id and oculta = false;
    else
      update public.animales set oculto = true where id = new.animal_id and oculto = false;
    end if;
  end if;
  return new;
end;
$$;

-- Lo mismo que la 0011, con la historia al final (create or replace solo deja sumar columnas).
create or replace view public.denuncias_detalle
with (security_invoker = true)
as
select
  d.id,
  d.animal_id,
  d.avistamiento_id,
  d.usuario_id,
  p.nombre_publico as denunciante_nombre,
  d.motivo,
  d.detalle,
  d.estado,
  d.created_at,
  a.foto_principal_path as animal_foto_path,
  a.especie as animal_especie,
  a.descripcion as animal_descripcion,
  a.oculto as animal_oculto,
  a.estado as animal_estado,
  p.created_at > d.created_at - interval '7 days' as cuenta_nueva,
  d.historia,
  h.frase as historia_frase,
  h.foto_path as historia_foto_path,
  coalesce(h.oculta, false) as historia_oculta
from public.denuncias d
join public.perfiles p on p.id = d.usuario_id
join public.animales a on a.id = d.animal_id
left join public.historias_reencuentro h on d.historia and h.animal_id = d.animal_id;

create or replace function public.moderar_historia(p_animal_id uuid, p_oculta boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_moderador() then
    raise exception 'Solo moderadores pueden ocultar o mostrar publicaciones' using errcode = '42501';
  end if;
  update public.historias_reencuentro set oculta = p_oculta where animal_id = p_animal_id;
  if not found then
    raise exception 'No encontramos la historia' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.moderar_historia(uuid, boolean) from public, anon;
grant execute on function public.moderar_historia(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Ajustes de lo que ya existía
-- ---------------------------------------------------------------------------

-- Igual que en la 0024, salvo el grupo: un agradecimiento no se agrupa con los
-- avisos del caso. Si no, a quien seguía el caso le llegaba "¡Volvió con su
-- familia!" y el agradecimiento de unos minutos después no salía.
create or replace function public.preparar_avisos_push(p_limite integer default 50)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tope integer := greatest(public.config_numero('avisos_push_por_hora', 6)::int, 0);
  r record;
  v_animal uuid;
  v_conversacion uuid;
  v_coincidencia uuid;
  v_reporte uuid;
  v_caso record;
  v_motivo text;
  v_grupo text;
  v_suscripciones jsonb;
  v_salida jsonb := '[]'::jsonb;
begin
  update public.avisos_push
  set estado = 'omitido', motivo = 'vencido', terminado_en = now()
  where estado = 'pendiente' and created_at < now() - interval '1 hour';
  update public.avisos_push
  set estado = 'error', motivo = 'sin_respuesta', terminado_en = now()
  where estado = 'enviando' and tomado_en < now() - interval '5 minutes';
  delete from public.avisos_push where created_at < now() - interval '2 days';

  for r in
    select a.id, a.usuario_id, n.tipo, n.datos, n.actor_id, n.leida_en
    from public.avisos_push a
    join public.notificaciones n on n.id = a.notificacion_id
    where a.estado = 'pendiente'
    order by a.id
    limit greatest(coalesce(p_limite, 50), 1)
    for update of a skip locked
  loop
    v_motivo := null;
    v_conversacion := public.uuid_de(r.datos ->> 'conversacion_id');
    v_coincidencia := public.uuid_de(r.datos ->> 'coincidencia_id');
    v_reporte := public.uuid_de(r.datos ->> 'reporte_error_id');
    v_animal := coalesce(
      public.uuid_de(r.datos ->> 'animal_id'),
      (select c.animal_id from public.conversaciones c where c.id = v_conversacion)
    );
    select a.nombre, a.especie, a.oculto, a.creado_por, a.tipo_reporte into v_caso
    from public.animales a where a.id = v_animal;

    v_grupo := case
      when v_conversacion is not null then 'conversacion:' || v_conversacion
      when r.tipo = 'agradecimiento' and v_animal is not null then 'agradecimiento:' || v_animal
      when v_animal is not null then 'caso:' || v_animal
      when v_reporte is not null then 'error:' || v_reporte
      else 'general'
    end;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth
    ) order by s.actualizada_en desc), '[]'::jsonb)
    into v_suscripciones
    from public.suscripciones_push s where s.usuario_id = r.usuario_id;

    if r.leida_en is not null then
      v_motivo := 'leida';
    elsif r.actor_id is not null and exists (
      select 1 from public.bloqueos b
      where b.bloqueador_id = r.usuario_id and b.bloqueado_id = r.actor_id
    ) then
      v_motivo := 'bloqueo';
    elsif coalesce(v_caso.oculto, false) or exists (
      select 1 from public.coincidencias co
      join public.animales x on x.id in (co.animal_origen, co.animal_candidato)
      where co.id = v_coincidencia and x.oculto
    ) then
      v_motivo := 'oculto';
    elsif jsonb_array_length(v_suscripciones) = 0 then
      v_motivo := 'sin_suscripciones';
    elsif exists (
      select 1 from public.avisos_push p
      where p.usuario_id = r.usuario_id and p.grupo = v_grupo
        and p.estado in ('enviando', 'enviado') and p.tomado_en > now() - interval '5 minutes'
    ) then
      v_motivo := 'agrupado';
    elsif (
      select count(*) from public.avisos_push p
      where p.usuario_id = r.usuario_id
        and p.estado in ('enviando', 'enviado') and p.tomado_en > now() - interval '1 hour'
    ) >= v_tope then
      v_motivo := 'tope';
    end if;

    if v_motivo is not null then
      update public.avisos_push
      set estado = 'omitido', motivo = v_motivo, grupo = v_grupo, terminado_en = now()
      where id = r.id;
      continue;
    end if;

    update public.avisos_push
    set estado = 'enviando', grupo = v_grupo, tomado_en = now()
    where id = r.id;

    v_salida := v_salida || jsonb_build_object(
      'aviso_id', r.id,
      'tipo', r.tipo,
      'evento', r.datos ->> 'evento',
      'animal_id', v_animal,
      'conversacion_id', v_conversacion,
      'reporte_error_id', v_reporte,
      'moderacion', coalesce((r.datos ->> 'moderacion')::boolean, false),
      'nombre', v_caso.nombre,
      'especie', v_caso.especie,
      -- La familia de un perdido, en sus coincidencias: "Encontraron un animal parecido a…".
      'para_familia', coalesce(r.tipo = 'coincidencia' and v_caso.tipo_reporte = 'perdido'
        and v_caso.creado_por = r.usuario_id, false),
      'suscripciones', v_suscripciones
    );
  end loop;

  return v_salida;
end;
$$;

-- Igual que en la 0012, con la foto de la historia: se borra con el caso.
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
    union
    select public.raiz_foto(h.foto_path)
    from public.historias_reencuentro h
    where h.animal_id in (select id from arbol) and h.foto_path is not null
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
      select 1 from public.historias_reencuentro h
      where h.animal_id not in (select id from arbol)
        and public.raiz_foto(h.foto_path) = public.raiz_foto(o.name)
    )
    and not exists (
      select 1 from public.perfiles p
      where public.raiz_foto(p.avatar_path) = public.raiz_foto(o.name)
    )
  order by o.name;
end;
$$;

-- Igual que en la 0016, con lo nuevo al principio: las historias de la familia
-- y los agradecimientos (dados y recibidos) se borran con la cuenta. Sus perdidos
-- ya se borraban siempre (y con ellos sus historias); esto lo deja explícito.
-- Las fotos de las historias las devuelve fotos_para_borrar: no quedan publicadas.
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

  -- Historias y agradecimientos: se borran siempre.
  delete from public.historias_reencuentro where familia_id = p_uid;
  delete from public.agradecimientos where familia_id = p_uid or usuario_id = p_uid;

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

  -- Sus reportes de errores: sin autor y sin captura.
  update public.reportes_errores set usuario_id = null, captura_path = null
  where usuario_id = p_uid;
end;
$$;
