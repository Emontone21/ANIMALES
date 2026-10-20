-- =============================================================================
-- 0018 · Reconocimiento con la API de Claude
-- Reemplaza al servicio de embeddings (services/vision, que queda sin
-- desplegar). La Edge Function supabase/functions/reconocer atiende /procesar
-- y /procesar-pendientes en config_app.vision_url, con el mismo contrato:
-- 1. Claude describe cada foto nueva (descripciones_ia).
-- 2. La base elige pocos candidatos (candidatos_ia): misma especie, abiertos y
--    visibles, cerca y en la ventana, con las reglas de la Fase 6.
-- 3. Claude compara la foto con los candidatos y explica por qué se parecen
--    (comparaciones_ia); desde config_app.umbral_ia se crea la coincidencia.
-- Topes en config_app (interruptor, pausa por falta de crédito y llamadas por
-- día) y registro de cada llamada (llamadas_ia). La familia sigue confirmando.
-- Ver docs/DECISIONES.md, "El reconocimiento pasa a la API de Claude".
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Configuración
-- ---------------------------------------------------------------------------

insert into public.config_app (clave, valor) values
  -- Interruptor general: 'false' apaga los avisos, el trabajo de cada
  -- 2 minutos y la función.
  ('ia_activa', 'true'),
  -- '' o 'sin_credito': la función la pone al quedarse sin crédito y un
  -- moderador la saca con "Reactivar" (reactivar_reconocimiento).
  ('ia_pausa', ''),
  ('ia_modelo', 'claude-haiku-5-5'),
  ('max_candidatos', '10'),
  -- Confianza (0 a 100) desde la que una comparación crea la coincidencia.
  ('umbral_ia', '70'),
  -- Llamadas a la API por día (hora de Montevideo). Al llegar, las fotos
  -- esperan al día siguiente.
  ('ia_tope_diario', '300')
on conflict (clave) do nothing;

-- La política de privacidad dice que las fotos las analiza Anthropic: todos
-- vuelven a aceptar (VERSION_TERMINOS en src/features/legal/terminos.ts).
update public.config_app set valor = '2026-10-20', updated_at = now()
where clave = 'terminos_version';

create or replace function public.config_texto(p_clave text, p_defecto text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select valor from public.config_app where clave = p_clave), p_defecto)
$$;

revoke all on function public.config_texto from public, anon, authenticated;

-- Un número de config_app, o el de defecto si falta o no es un número.
create or replace function public.config_numero(p_clave text, p_defecto numeric)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when v ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' then v::numeric
    else p_defecto
  end
  from (select public.config_texto(p_clave, '') as v) c
$$;

revoke all on function public.config_numero from public, anon, authenticated;

-- El día y el mes se cuentan en hora de Montevideo.
create or replace function public.inicio_periodo_ia(p_periodo text)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select date_trunc(p_periodo, now() at time zone 'America/Montevideo') at time zone 'America/Montevideo'
$$;

revoke all on function public.inicio_periodo_ia from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Lo que guarda el reconocimiento (solo lo leen los moderadores)
-- ---------------------------------------------------------------------------

-- Colores que puede devolver la descripción (src y la función usan los mismos).
create domain public.color_ia as text
  check (value in ('negro', 'blanco', 'gris', 'marron', 'dorado', 'naranja', 'otro', 'no_se_ve'));

-- Lo que Claude ve en cada foto. Una por avistamiento: si falla la
-- comparación, el reintento no vuelve a describirla.
create table public.descripciones_ia (
  avistamiento_id uuid primary key references public.avistamientos (id) on delete cascade,
  hay_animal boolean not null,
  -- null si no hay animal.
  especie public.especie,
  color_principal public.color_ia not null,
  -- null si es de un solo color.
  color_secundario public.color_ia,
  patron text not null
    check (patron in ('liso', 'bicolor', 'manchas', 'atigrado', 'tricolor', 'otro', 'no_se_ve')),
  -- null si no se puede estimar.
  tamanio public.tamanio,
  collar text not null check (collar in ('si', 'no', 'no_se_ve')),
  collar_color text check (char_length(collar_color) <= 40),
  raza_aproximada text check (char_length(raza_aproximada) <= 60),
  rasgos text[] not null default '{}' check (cardinality(rasgos) <= 8),
  calidad text not null check (calidad in ('buena', 'regular', 'mala')),
  modelo text not null check (char_length(modelo) <= 80),
  tokens_entrada integer not null default 0,
  tokens_salida integer not null default 0,
  created_at timestamptz not null default now()
);

-- Cada par de casos se compara una sola vez (el par va ordenado).
create table public.comparaciones_ia (
  id uuid primary key default gen_random_uuid(),
  animal_a uuid not null references public.animales (id) on delete cascade,
  animal_b uuid not null references public.animales (id) on delete cascade,
  -- La foto que se comparó (la del caso que la trajo).
  avistamiento_id uuid references public.avistamientos (id) on delete set null,
  confianza smallint not null check (confianza between 0 and 100),
  veredicto text not null check (veredicto in ('mismo', 'posible', 'distinto')),
  motivo text not null check (char_length(motivo) between 1 and 140),
  coinciden text[] not null default '{}',
  difieren text[] not null default '{}',
  modelo text not null check (char_length(modelo) <= 80),
  created_at timestamptz not null default now(),
  check (animal_a < animal_b),
  unique (animal_a, animal_b)
);

create index comparaciones_ia_b_idx on public.comparaciones_ia (animal_b);

-- Cada llamada a la API: tokens, costo estimado, modelo y resultado. Queda
-- aunque se borre la foto, para el costo del mes.
create table public.llamadas_ia (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('describir', 'comparar')),
  avistamiento_id uuid references public.avistamientos (id) on delete set null,
  modelo text not null check (char_length(modelo) <= 80),
  -- en_curso: reservada y sin terminar; ok; invalida (no cumplió el esquema,
  -- o se cortó o se negó); limite (429); sobrecarga (529); sin_credito (402);
  -- error (cualquier otro).
  resultado text not null default 'en_curso'
    check (resultado in ('en_curso', 'ok', 'invalida', 'limite', 'sobrecarga', 'sin_credito', 'error')),
  -- El tipo de error de la API o qué no validó; nunca datos de personas.
  detalle text check (char_length(detalle) <= 200),
  tokens_entrada integer not null default 0,
  tokens_salida integer not null default 0,
  -- En dólares, con los precios de la función. null si el modelo no tiene precio.
  costo_usd numeric(12, 6),
  created_at timestamptz not null default now(),
  terminada_en timestamptz
);

create index llamadas_ia_fecha_idx on public.llamadas_ia (created_at desc);

alter table public.descripciones_ia enable row level security;
alter table public.comparaciones_ia enable row level security;
alter table public.llamadas_ia enable row level security;

revoke all on public.descripciones_ia from anon, authenticated;
revoke all on public.comparaciones_ia from anon, authenticated;
revoke all on public.llamadas_ia from anon, authenticated;
grant select on public.descripciones_ia to authenticated;
grant select on public.comparaciones_ia to authenticated;
grant select on public.llamadas_ia to authenticated;

create policy "descripciones_ia: lectura de moderacion"
  on public.descripciones_ia for select to authenticated
  using (public.es_moderador());
create policy "comparaciones_ia: lectura de moderacion"
  on public.comparaciones_ia for select to authenticated
  using (public.es_moderador());
create policy "llamadas_ia: lectura de moderacion"
  on public.llamadas_ia for select to authenticated
  using (public.es_moderador());

-- ---------------------------------------------------------------------------
-- 3. Coincidencias: confianza, motivo y origen
-- ---------------------------------------------------------------------------

-- similitud sigue siendo obligatoria: en las de la IA es confianza / 100.
alter table public.coincidencias
  add column confianza smallint check (confianza between 0 and 100),
  add column motivo text check (char_length(motivo) between 1 and 140),
  add column origen text not null default 'embedding' check (origen in ('embedding', 'ia'));

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
  ac.creado_por as candidato_creado_por,
  c.confianza,
  c.motivo,
  c.origen
from public.coincidencias c
join public.animales ao on ao.id = c.animal_origen
join public.animales ac on ac.id = c.animal_candidato;

-- ---------------------------------------------------------------------------
-- 4. Topes: interruptor, pausa y llamadas por día
-- ---------------------------------------------------------------------------

-- 'disponible', 'apagado', 'pausado' o 'tope_diario'.
create or replace function public.estado_ia()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.config_texto('ia_activa', 'true') <> 'true' then 'apagado'
    when public.config_texto('ia_pausa', '') <> '' then 'pausado'
    when (select count(*) from public.llamadas_ia
          where created_at >= public.inicio_periodo_ia('day'))
         >= public.config_numero('ia_tope_diario', 300) then 'tope_diario'
    else 'disponible'
  end
$$;

revoke all on function public.estado_ia from public, anon, authenticated;

-- Reserva una llamada si se puede hacer ahora (devuelve su id) o devuelve
-- null. El candado hace que dos fotos a la vez no pasen el tope.
create or replace function public.iniciar_llamada_ia(p_tipo text, p_avistamiento_id uuid, p_modelo text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtext('llamadas_ia'));
  if public.estado_ia() <> 'disponible' then
    return null;
  end if;
  insert into public.llamadas_ia (tipo, avistamiento_id, modelo)
  values (p_tipo, p_avistamiento_id, left(p_modelo, 80))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.iniciar_llamada_ia from public, anon, authenticated;
grant execute on function public.iniciar_llamada_ia to service_role;

create or replace function public.terminar_llamada_ia(
  p_id bigint,
  p_resultado text,
  p_tokens_entrada integer,
  p_tokens_salida integer,
  p_costo_usd numeric,
  p_detalle text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.llamadas_ia
  set resultado = p_resultado,
      tokens_entrada = greatest(coalesce(p_tokens_entrada, 0), 0),
      tokens_salida = greatest(coalesce(p_tokens_salida, 0), 0),
      costo_usd = p_costo_usd,
      detalle = left(p_detalle, 200),
      terminada_en = now()
  where id = p_id;
end;
$$;

revoke all on function public.terminar_llamada_ia from public, anon, authenticated;
grant execute on function public.terminar_llamada_ia to service_role;

-- Sin crédito: nada llama hasta que un moderador reactive.
create or replace function public.pausar_ia(p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_motivo is distinct from 'sin_credito' then
    raise exception 'Motivo de pausa desconocido' using errcode = '22023';
  end if;
  update public.config_app set valor = p_motivo, updated_at = now() where clave = 'ia_pausa';
end;
$$;

revoke all on function public.pausar_ia from public, anon, authenticated;
grant execute on function public.pausar_ia to service_role;

-- ---------------------------------------------------------------------------
-- 5. Llamar a la función solo si se puede
-- ---------------------------------------------------------------------------

-- Igual que en la 0017, sin llamar si el reconocimiento está apagado,
-- pausado o llegó al tope del día (ni el aviso de cada foto ni el cron).
create or replace function public.llamar_vision(p_ruta text, p_cuerpo jsonb, p_espera_ms integer)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select valor into v_url from public.config_app where clave = 'vision_url';
  select valor into v_secret from public.config_app where clave = 'vision_secret';
  if coalesce(v_url, '') = '' or public.estado_ia() <> 'disponible' then
    return null;
  end if;

  return net.http_post(
    url := rtrim(v_url, '/') || p_ruta,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Vision-Secret', coalesce(v_secret, '')
    ),
    body := p_cuerpo,
    timeout_milliseconds := p_espera_ms
  );
end;
$$;

revoke all on function public.llamar_vision from public, anon, authenticated;

-- Devuelve además 'apagado', 'pausado' o 'tope_diario' sin llamar.
create or replace function public.despertar_vision()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
begin
  if not exists (select 1 from public.config_app where clave = 'vision_url' and valor <> '') then
    return 'sin_configurar';
  end if;
  v_estado := public.estado_ia();
  if v_estado <> 'disponible' then
    return v_estado;
  end if;
  if not exists (select 1 from public.cola_vision_pendientes) then
    return 'sin_pendientes';
  end if;
  perform public.llamar_vision('/procesar-pendientes', '{}'::jsonb, 150000);
  return 'enviado';
end;
$$;

revoke all on function public.despertar_vision from public, anon, authenticated;

-- Las que se están procesando hace más de 10 minutos (la función se cortó)
-- vuelven a la cola. Lo demás, igual que en la 0013.
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
    or (c.estado = 'procesando' and c.updated_at <= now() - interval '10 minutes')
  )
order by c.created_at;

revoke all on public.cola_vision_pendientes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. La función: tomar una foto, describirla, elegir candidatos, guardar
-- ---------------------------------------------------------------------------

-- La descripción guardada de una foto, con las claves de la herramienta.
create or replace function public.descripcion_ia_json(p_avistamiento_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'hay_animal', d.hay_animal,
    'especie', coalesce(d.especie::text, 'ninguno'),
    'color_principal', d.color_principal::text,
    'color_secundario', coalesce(d.color_secundario::text, 'ninguno'),
    'patron', d.patron,
    'tamanio', coalesce(d.tamanio::text, 'no_se_ve'),
    'collar', d.collar,
    'collar_color', d.collar_color,
    'raza_aproximada', d.raza_aproximada,
    'rasgos', to_jsonb(d.rasgos),
    'calidad', d.calidad
  )
  from public.descripciones_ia d
  where d.avistamiento_id = p_avistamiento_id
$$;

revoke all on function public.descripcion_ia_json from public, anon, authenticated;

-- Toma una foto de la cola (la marca 'procesando') y devuelve lo que la
-- función necesita, o null si no está para procesar (ya la tomó otro pedido,
-- espera su reintento, agotó los intentos o no existe). Nunca devuelve datos
-- de personas: solo la foto y los datos del animal.
create or replace function public.tomar_pendiente_ia(p_avistamiento_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  update public.cola_vision c
  set estado = 'procesando'
  where c.avistamiento_id = p_avistamiento_id
    and c.intentos < 8
    and (
      c.estado = 'pendiente'
      or (
        c.estado = 'error'
        and c.updated_at <= now() - interval '5 minutes' * power(2, greatest(c.intentos - 1, 0))
      )
      or (c.estado = 'procesando' and c.updated_at <= now() - interval '10 minutes')
    );
  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'avistamiento_id', av.id,
    'animal_id', a.id,
    'foto_path', av.foto_path,
    'especie', a.especie,
    'tipo_reporte', a.tipo_reporte,
    'caso_abierto', a.estado in ('avistado', 'resguardado') and not a.oculto,
    'descripcion', public.descripcion_ia_json(av.id)
  )
  into v
  from public.avistamientos av
  join public.animales a on a.id = av.animal_id
  where av.id = p_avistamiento_id;
  return v;
end;
$$;

revoke all on function public.tomar_pendiente_ia from public, anon, authenticated;
grant execute on function public.tomar_pendiente_ia to service_role;

-- Listo sin comparar (o después de comparar): sale de la cola.
create or replace function public.marcar_hecho_ia(p_avistamiento_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.cola_vision
  set estado = 'hecho', ultimo_error = null
  where avistamiento_id = p_avistamiento_id;
  update public.avistamientos
  set procesado_en = now(), error_procesamiento = null
  where id = p_avistamiento_id;
end;
$$;

revoke all on function public.marcar_hecho_ia from public, anon, authenticated;
grant execute on function public.marcar_hecho_ia to service_role;

-- La función la tomó pero no pudo llamar a la API (justo llegó al tope o se
-- pausó): vuelve a esperar sin gastar un intento. El aviso que dispara volver
-- a 'pendiente' no sale, porque llamar_vision no llama en ese estado.
create or replace function public.soltar_pendiente_ia(p_avistamiento_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.cola_vision
  set estado = 'pendiente'
  where avistamiento_id = p_avistamiento_id and estado = 'procesando';
end;
$$;

revoke all on function public.soltar_pendiente_ia from public, anon, authenticated;
grant execute on function public.soltar_pendiente_ia to service_role;

-- Guarda la descripción (ya validada por la función; los checks de la tabla
-- validan de nuevo) y dice si la foto se compara: hay un animal, de la especie
-- del caso, y el caso está abierto y visible.
create or replace function public.guardar_descripcion_ia(
  p_avistamiento_id uuid,
  p_descripcion jsonb,
  p_modelo text,
  p_tokens_entrada integer,
  p_tokens_salida integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secundario text := p_descripcion ->> 'color_secundario';
  v_tamanio text := p_descripcion ->> 'tamanio';
  v_especie text := p_descripcion ->> 'especie';
begin
  insert into public.descripciones_ia (
    avistamiento_id, hay_animal, especie, color_principal, color_secundario, patron,
    tamanio, collar, collar_color, raza_aproximada, rasgos, calidad,
    modelo, tokens_entrada, tokens_salida
  )
  values (
    p_avistamiento_id,
    (p_descripcion ->> 'hay_animal')::boolean,
    case when v_especie = 'ninguno' then null else v_especie::public.especie end,
    p_descripcion ->> 'color_principal',
    case when v_secundario = 'ninguno' then null else v_secundario end,
    p_descripcion ->> 'patron',
    case when v_tamanio = 'no_se_ve' then null else v_tamanio::public.tamanio end,
    p_descripcion ->> 'collar',
    nullif(p_descripcion ->> 'collar_color', ''),
    nullif(p_descripcion ->> 'raza_aproximada', ''),
    coalesce(
      (select array_agg(x) from jsonb_array_elements_text(p_descripcion -> 'rasgos') x),
      '{}'
    ),
    p_descripcion ->> 'calidad',
    left(p_modelo, 80),
    greatest(coalesce(p_tokens_entrada, 0), 0),
    greatest(coalesce(p_tokens_salida, 0), 0)
  )
  on conflict (avistamiento_id) do update set
    hay_animal = excluded.hay_animal,
    especie = excluded.especie,
    color_principal = excluded.color_principal,
    color_secundario = excluded.color_secundario,
    patron = excluded.patron,
    tamanio = excluded.tamanio,
    collar = excluded.collar,
    collar_color = excluded.collar_color,
    raza_aproximada = excluded.raza_aproximada,
    rasgos = excluded.rasgos,
    calidad = excluded.calidad,
    modelo = excluded.modelo,
    tokens_entrada = excluded.tokens_entrada,
    tokens_salida = excluded.tokens_salida,
    created_at = now();

  return exists (
    select 1
    from public.descripciones_ia d
    join public.avistamientos av on av.id = d.avistamiento_id
    join public.animales a on a.id = av.animal_id
    where d.avistamiento_id = p_avistamiento_id
      and d.hay_animal
      and d.especie = a.especie
      and a.estado in ('avistado', 'resguardado')
      and not a.oculto
  );
end;
$$;

revoke all on function public.guardar_descripcion_ia from public, anon, authenticated;
grant execute on function public.guardar_descripcion_ia to service_role;

-- Colores "claramente incompatibles": se ordenan de claro a oscuro y se
-- descarta el par solo si ningún color de un lado queda a menos de 3 pasos de
-- alguno del otro (negro con blanco, dorado o naranja; blanco con marrón).
-- Sin colores conocidos de un lado, no se descarta: la luz y el ángulo engañan.
create or replace function public.tono_color_ia(p_color text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_color
    when 'blanco' then 0
    when 'dorado' then 1
    when 'naranja' then 1
    when 'gris' then 2
    when 'marron' then 3
    when 'negro' then 4
  end
$$;

create or replace function public.colores_compatibles_ia(
  p_a_principal text,
  p_a_secundario text,
  p_b_principal text,
  p_b_secundario text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (
      select min(abs(x - y)) < 3
      from unnest(array[public.tono_color_ia(p_a_principal), public.tono_color_ia(p_a_secundario)]) x,
           unnest(array[public.tono_color_ia(p_b_principal), public.tono_color_ia(p_b_secundario)]) y
      where x is not null and y is not null
    ),
    true
  )
$$;

-- Tamaños "claramente incompatibles": chico con grande.
create or replace function public.tamanios_compatibles_ia(p_a public.tamanio, p_b public.tamanio)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select not coalesce(
    (p_a = 'chico' and p_b = 'grande') or (p_a = 'grande' and p_b = 'chico'),
    false
  )
$$;

revoke all on function public.tono_color_ia from public, anon, authenticated;
revoke all on function public.colores_compatibles_ia from public, anon, authenticated;
revoke all on function public.tamanios_compatibles_ia from public, anon, authenticated;

-- Todos los casos con los que se puede comparar la foto, del más cercano al
-- más lejano. Las reglas de guardar_embedding (0013): misma especie, abiertos
-- y visibles, a menos de radio_coincidencia_m, con un avistamiento dentro de
-- ventana_coincidencia_dias, perdido con encontrado o encontrado con
-- encontrado (nunca perdido con perdido ni un encontrado visto por última vez
-- más de un día antes de la pérdida). Además: sin los pares ya comparados ni
-- los que ya tienen coincidencia, sin los que tienen colores o tamaños
-- claramente incompatibles y sin los que en su foto no se ve un animal.
-- Vacío si el caso de la foto está cerrado, unido a otro u oculto.
create or replace function public.candidatos_ia_todos(p_avistamiento_id uuid)
returns table (
  animal_id uuid,
  avistamiento_cercano uuid,
  tipo_reporte public.tipo_reporte,
  especie public.especie,
  tamanio public.tamanio,
  color text,
  tiene_collar boolean,
  foto_path text,
  distancia_m real,
  horas real,
  descripcion jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_animal uuid;
  v_ubicacion extensions.geography;
  v_visto_en timestamptz;
  v_especie public.especie;
  v_tipo public.tipo_reporte;
  v_tamanio public.tamanio;
  v_perdido_desde timestamptz;
  v_ultimo_visto timestamptz;
  v_radio_m real := public.config_numero('radio_coincidencia_m', 15000);
  v_dias real := public.config_numero('ventana_coincidencia_dias', 60);
  d public.descripciones_ia;
begin
  select av.animal_id, av.ubicacion, av.visto_en
  into v_animal, v_ubicacion, v_visto_en
  from public.avistamientos av
  where av.id = p_avistamiento_id;

  select a.especie, a.tipo_reporte, a.tamanio
  into v_especie, v_tipo, v_tamanio
  from public.animales a
  where a.id = v_animal and a.estado in ('avistado', 'resguardado') and not a.oculto;
  if not found then
    return;
  end if;

  select * into d from public.descripciones_ia x where x.avistamiento_id = p_avistamiento_id;

  select coalesce(
    (select min(x.visto_en) from public.avistamientos x where x.animal_id = v_animal and x.tipo = 'perdido'),
    (select a.created_at from public.animales a where a.id = v_animal)
  ) into v_perdido_desde;
  select max(x.visto_en) into v_ultimo_visto from public.avistamientos x where x.animal_id = v_animal;

  return query
  with cercanos as (
    select distinct on (av.animal_id)
      av.animal_id,
      av.id as avistamiento_id,
      extensions.st_distance(av.ubicacion, v_ubicacion)::real as distancia_m,
      (abs(extract(epoch from (av.visto_en - v_visto_en))) / 3600)::real as horas
    from public.avistamientos av
    join public.animales a on a.id = av.animal_id
    where av.animal_id <> v_animal
      and a.especie = v_especie
      and a.estado in ('avistado', 'resguardado')
      and not a.oculto
      and extensions.st_dwithin(av.ubicacion, v_ubicacion, v_radio_m)
      and abs(extract(epoch from (av.visto_en - v_visto_en))) <= v_dias * 86400
      and (
        (v_tipo = 'encontrado' and a.tipo_reporte = 'encontrado')
        or (
          v_tipo = 'perdido' and a.tipo_reporte = 'encontrado'
          and (select max(x.visto_en) from public.avistamientos x where x.animal_id = a.id)
            >= v_perdido_desde - interval '1 day'
        )
        or (
          v_tipo = 'encontrado' and a.tipo_reporte = 'perdido'
          and v_ultimo_visto >= coalesce(
            (select min(x.visto_en) from public.avistamientos x where x.animal_id = a.id and x.tipo = 'perdido'),
            a.created_at
          ) - interval '1 day'
        )
      )
    order by av.animal_id, extensions.st_distance(av.ubicacion, v_ubicacion)
  )
  select
    c.animal_id,
    c.avistamiento_id,
    a.tipo_reporte,
    a.especie,
    a.tamanio,
    a.color,
    a.tiene_collar,
    a.foto_principal_path,
    c.distancia_m,
    c.horas,
    case when dc.avistamiento_id is null then null
         else public.descripcion_ia_json(dc.avistamiento_id) end
  from cercanos c
  join public.animales a on a.id = c.animal_id
  -- La descripción de su foto principal, si se describió.
  left join lateral (
    select dd.*
    from public.avistamientos ap
    join public.descripciones_ia dd on dd.avistamiento_id = ap.id
    where ap.animal_id = a.id and ap.foto_path = a.foto_principal_path
    order by ap.visto_en
    limit 1
  ) dc on true
  where not exists (
      select 1 from public.comparaciones_ia x
      where x.animal_a = least(v_animal, c.animal_id) and x.animal_b = greatest(v_animal, c.animal_id)
    )
    and not exists (
      select 1 from public.coincidencias x
      where x.animal_origen = least(v_animal, c.animal_id)
        and x.animal_candidato = greatest(v_animal, c.animal_id)
    )
    and coalesce(dc.hay_animal, true)
    and public.colores_compatibles_ia(
      d.color_principal, d.color_secundario, dc.color_principal, dc.color_secundario
    )
    and public.tamanios_compatibles_ia(coalesce(v_tamanio, d.tamanio), coalesce(a.tamanio, dc.tamanio))
  order by c.distancia_m, c.animal_id;
end;
$$;

revoke all on function public.candidatos_ia_todos from public, anon, authenticated;

-- Los primeros max_candidatos (10 por defecto, nunca más de 20 fotos por llamada).
create or replace function public.candidatos_ia(p_avistamiento_id uuid)
returns table (
  animal_id uuid,
  avistamiento_cercano uuid,
  tipo_reporte public.tipo_reporte,
  especie public.especie,
  tamanio public.tamanio,
  color text,
  tiene_collar boolean,
  foto_path text,
  distancia_m real,
  horas real,
  descripcion jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select *
  from public.candidatos_ia_todos(p_avistamiento_id)
  limit greatest(0, least(20, public.config_numero('max_candidatos', 10)))::integer
$$;

revoke all on function public.candidatos_ia from public, anon, authenticated;
grant execute on function public.candidatos_ia to service_role;

-- Guarda lo que devolvió la comparación: [{animal_id, confianza, veredicto,
-- motivo, coinciden, difieren}]. Solo acepta casos que siguen siendo
-- candidatos de la foto (cualquier otro se ignora). Desde umbral_ia crea la
-- coincidencia, con origen 'ia', que avisa como siempre (notificar_coincidencia).
-- Saca la foto de la cola. Devuelve cuántas coincidencias creó.
create or replace function public.guardar_comparacion_ia(
  p_avistamiento_id uuid,
  p_resultados jsonb,
  p_modelo text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_animal uuid;
  v_umbral numeric := public.config_numero('umbral_ia', 70);
  v_creadas integer := 0;
  r jsonb;
  v_otro uuid;
  v_confianza smallint;
  c record;
begin
  select av.animal_id into v_animal from public.avistamientos av where av.id = p_avistamiento_id;
  if v_animal is null then
    raise exception 'Avistamiento inexistente' using errcode = 'P0002';
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_resultados, '[]'::jsonb)) loop
    v_otro := (r ->> 'animal_id')::uuid;
    select * into c from public.candidatos_ia_todos(p_avistamiento_id) x where x.animal_id = v_otro;
    if not found then
      continue;
    end if;
    v_confianza := (r ->> 'confianza')::smallint;

    insert into public.comparaciones_ia (
      animal_a, animal_b, avistamiento_id, confianza, veredicto, motivo, coinciden, difieren, modelo
    )
    values (
      least(v_animal, v_otro),
      greatest(v_animal, v_otro),
      p_avistamiento_id,
      v_confianza,
      r ->> 'veredicto',
      r ->> 'motivo',
      coalesce((select array_agg(x) from jsonb_array_elements_text(r -> 'coinciden') x), '{}'),
      coalesce((select array_agg(x) from jsonb_array_elements_text(r -> 'difieren') x), '{}'),
      left(p_modelo, 80)
    )
    on conflict (animal_a, animal_b) do nothing;

    if v_confianza >= v_umbral then
      insert into public.coincidencias (
        animal_origen, animal_candidato, avistamiento_origen, avistamiento_candidato,
        similitud, distancia_m, horas_diferencia, confianza, motivo, origen
      )
      values (
        least(v_animal, v_otro),
        greatest(v_animal, v_otro),
        case when v_animal < v_otro then p_avistamiento_id else c.avistamiento_cercano end,
        case when v_animal < v_otro then c.avistamiento_cercano else p_avistamiento_id end,
        v_confianza / 100.0,
        c.distancia_m,
        c.horas,
        v_confianza,
        r ->> 'motivo',
        'ia'
      )
      on conflict (animal_origen, animal_candidato) do nothing;
      if found then
        v_creadas := v_creadas + 1;
      end if;
    end if;
  end loop;

  perform public.marcar_hecho_ia(p_avistamiento_id);
  return v_creadas;
end;
$$;

revoke all on function public.guardar_comparacion_ia from public, anon, authenticated;
grant execute on function public.guardar_comparacion_ia to service_role;

-- Lo que la función lee al recibir un pedido: el secreto para validarlo, el
-- modelo y si puede llamar.
create or replace function public.config_reconocimiento()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'secreto', public.config_texto('vision_secret', ''),
    'modelo', public.config_texto('ia_modelo', 'claude-haiku-5-5'),
    'estado', public.estado_ia()
  )
$$;

revoke all on function public.config_reconocimiento from public, anon, authenticated;
grant execute on function public.config_reconocimiento to service_role;

-- ---------------------------------------------------------------------------
-- 7. El servicio de embeddings queda desactivado
-- ---------------------------------------------------------------------------

-- Sus datos (avistamientos.embedding y las coincidencias con origen
-- 'embedding') quedan. Para volver a usarlo: grant execute ... to service_role.
revoke execute on function public.guardar_embedding(uuid, extensions.vector, jsonb) from service_role;

-- ---------------------------------------------------------------------------
-- 8. Moderación: estado, llamadas, costo y reactivar
-- ---------------------------------------------------------------------------

drop function if exists public.estado_reconocimiento();

create function public.estado_reconocimiento()
returns table (
  configurado boolean,
  activa boolean,
  -- null o 'sin_credito'.
  pausa text,
  pendientes integer,
  reintentando integer,
  con_error integer,
  ultima_procesada timestamptz,
  ultima_coincidencia timestamptz,
  llamadas_hoy integer,
  tope_diario integer,
  errores_hoy integer,
  costo_mes numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_moderador() then
    raise exception 'Solo moderación puede ver el reconocimiento' using errcode = '42501';
  end if;

  return query
  select
    exists (select 1 from public.config_app where clave = 'vision_url' and valor <> '')
      and exists (select 1 from public.config_app where clave = 'vision_secret' and valor <> ''),
    public.config_texto('ia_activa', 'true') = 'true',
    nullif(public.config_texto('ia_pausa', ''), ''),
    (select count(*)::integer from public.cola_vision
      where estado in ('pendiente', 'procesando') or (estado = 'error' and intentos < 8)),
    (select count(*)::integer from public.cola_vision where estado = 'error' and intentos < 8),
    (select count(*)::integer from public.cola_vision where estado = 'error' and intentos >= 8),
    (select max(procesado_en) from public.avistamientos),
    (select max(created_at) from public.coincidencias),
    (select count(*)::integer from public.llamadas_ia
      where created_at >= public.inicio_periodo_ia('day')),
    public.config_numero('ia_tope_diario', 300)::integer,
    (select count(*)::integer from public.llamadas_ia
      where created_at >= public.inicio_periodo_ia('day')
        and resultado not in ('ok', 'en_curso')),
    (select coalesce(sum(costo_usd), 0) from public.llamadas_ia
      where created_at >= public.inicio_periodo_ia('month'));
end;
$$;

revoke all on function public.estado_reconocimiento from public, anon;
grant execute on function public.estado_reconocimiento to authenticated;

-- Saca la pausa por falta de crédito y despierta a la función. Devuelve lo
-- mismo que "Procesar pendientes ahora".
create or replace function public.reactivar_reconocimiento()
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_moderador() then
    raise exception 'Solo moderación puede reactivar el reconocimiento' using errcode = '42501';
  end if;
  update public.config_app set valor = '', updated_at = now() where clave = 'ia_pausa';
  return public.despertar_vision();
end;
$$;

revoke all on function public.reactivar_reconocimiento from public, anon;
grant execute on function public.reactivar_reconocimiento to authenticated;
