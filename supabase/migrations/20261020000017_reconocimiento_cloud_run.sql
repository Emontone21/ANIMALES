-- =============================================================================
-- 0017 · Reconocimiento en Cloud Run
-- El servicio de visión pasa de un Space de Hugging Face a Google Cloud Run,
-- que solo da CPU mientras atiende un pedido y apaga la instancia sin tráfico:
-- 1. Los avisos esperan lo que tarda en despertar (arranque en frío).
-- 2. Un trabajo de pg_cron, cada 2 minutos, lo llama solo si hay fotos
--    pendientes: cubre los reintentos y los avisos perdidos (B31). Reemplaza
--    el bucle interno del servicio.
-- 3. Moderación ve el estado del reconocimiento y puede procesar ya.
-- Ver docs/DECISIONES.md, "El servicio de visión pasa a Cloud Run".
-- =============================================================================

-- Como lo habilita Supabase (Database → Extensions → pg_cron).
create extension if not exists pg_cron with schema pg_catalog;

-- ---------------------------------------------------------------------------
-- 1. Una sola función llama al servicio
-- ---------------------------------------------------------------------------

-- Cuánto espera pg_net la respuesta (ms). El servicio trabaja dentro del
-- pedido y responde al terminar, y Cloud Run puede estar apagado. Medido con
-- 2 núcleos (docs/reportes/2026-10-20-reconocimiento.md): de 3 a 5 s hasta
-- tener los modelos cargados, y de 0,5 a 1,6 s por foto. Cloud Run suma bajar
-- la imagen (~1 GB) y núcleos más lentos: se cuentan hasta 30 s de arranque.
-- - Una foto (60 s): el arranque, esperar a las que llegaron antes (de a una)
--   y procesar la propia.
-- - Vaciar la cola (150 s): el arranque, el tope del servicio
--   (TIEMPO_MAXIMO_COLA_SEG, 90 s) y la última foto empezada.
-- Si se corta antes, la foto no se pierde: sigue pendiente y la levanta el
-- trabajo de cada 2 minutos.
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
  if coalesce(v_url, '') = '' then
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

-- El aviso de cada foto que queda pendiente (el trigger de la 0013), ahora con
-- la espera nueva.
create or replace function public.avisar_vision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.estado is not distinct from new.estado then
    return new;
  end if;

  perform public.llamar_vision(
    '/procesar',
    jsonb_build_object('avistamiento_id', new.avistamiento_id),
    60000
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Despertarlo solo cuando hace falta (B31)
-- ---------------------------------------------------------------------------

-- Llama a /procesar-pendientes si hay algo que procesar ahora: fotos
-- pendientes cuyo aviso se perdió y errores que ya cumplieron su espera
-- (cola_vision_pendientes). Si no hay nada, no despierta al servicio.
create or replace function public.despertar_vision()
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.config_app where clave = 'vision_url' and valor <> '') then
    return 'sin_configurar';
  end if;
  if not exists (select 1 from public.cola_vision_pendientes) then
    return 'sin_pendientes';
  end if;
  perform public.llamar_vision('/procesar-pendientes', '{}'::jsonb, 150000);
  return 'enviado';
end;
$$;

revoke all on function public.despertar_vision from public, anon, authenticated;

-- Cada 2 minutos. Con el mismo nombre, cron.schedule actualiza el trabajo.
do $$
begin
  perform cron.schedule('vision-pendientes', '*/2 * * * *', 'select public.despertar_vision()');
  -- pg_cron anota cada corrida (720 por día): se guarda una semana.
  perform cron.schedule(
    'vision-limpiar-historial',
    '23 4 * * *',
    $q$delete from cron.job_run_details where end_time < now() - interval '7 days'$q$
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Moderación: estado y "Procesar pendientes ahora"
-- ---------------------------------------------------------------------------

-- Sin la URL ni el secreto: solo si están cargados.
create or replace function public.estado_reconocimiento()
returns table (
  configurado boolean,
  pendientes integer,
  reintentando integer,
  con_error integer,
  ultima_procesada timestamptz,
  ultima_coincidencia timestamptz
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
    -- Lo que se va a procesar: pendientes y errores con intentos por delante.
    (select count(*)::integer from public.cola_vision
      where estado = 'pendiente' or (estado = 'error' and intentos < 8)),
    (select count(*)::integer from public.cola_vision where estado = 'error' and intentos < 8),
    -- Agotaron los 8 intentos: necesitan que alguien las vuelva a la cola.
    (select count(*)::integer from public.cola_vision where estado = 'error' and intentos >= 8),
    (select max(procesado_en) from public.avistamientos),
    (select max(created_at) from public.coincidencias);
end;
$$;

revoke all on function public.estado_reconocimiento from public, anon;
grant execute on function public.estado_reconocimiento to authenticated;

-- La misma llamada que el trabajo de cada 2 minutos, sin esperarlo.
create or replace function public.procesar_pendientes_vision()
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_moderador() then
    raise exception 'Solo moderación puede procesar las fotos pendientes' using errcode = '42501';
  end if;
  return public.despertar_vision();
end;
$$;

revoke all on function public.procesar_pendientes_vision from public, anon;
grant execute on function public.procesar_pendientes_vision to authenticated;
