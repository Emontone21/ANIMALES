-- NO APLICAR. Propuesta para pasar a supabase/migrations/ en un prompt aparte, después de la Fase 5.
-- =============================================================================
-- Panel de SPOT · administradores y resumen (propuesta, sin probar en una base)
--
-- Nota: AGENTS.md ya marca como hechas las fases 1 a 9, y las migraciones
-- llegan a la 0027 (privacidad_reunidos). Esta propuesta usa solo tablas y
-- columnas de esas 27 migraciones. Ver PANEL/DISEÑO.md, "Decisiones abiertas".
--
-- Hay dos controles distintos (PANEL/DISEÑO.md, "Seguridad"):
--   1. ADMIN_USER_IDS, en Vercel: decide quién usa las funciones del panel.
--   2. public.administradores, en la base: decide quién lee los conteos con
--      admin_resumen(). Aunque alguien pasara el primer control, la base no le
--      da nada si no está en esta tabla. Las dos listas llevan las mismas cuentas.
--
-- El panel llama a admin_resumen() con el token de la sesión de quien entró
-- (POST /rest/v1/rpc/admin_resumen, la clave pública en `apikey`). Nunca con
-- la service_role ni la secret.
--
-- Al pasarla a supabase/migrations/:
--   - el archivo se llama AAAAMMDDhhmmss_panel_admin.sql;
--   - las pruebas van en supabase/tests/panel_admin.sql (ver el final);
--   - los tipos se suman en src/types/database.ts (Functions: es_admin y
--     admin_resumen).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Administradores: aparte de perfiles.es_moderador, porque moderar no es
-- administrar el proyecto.
--
-- RLS activado, sin políticas y sin permisos para anon ni authenticated:
-- nadie la lee ni la escribe por la API. Solo la leen es_admin() y
-- admin_resumen(), que corren como su dueño. Se asigna desde el editor SQL:
--
--   insert into public.administradores (usuario_id) values ('<uuid>');
--   delete from public.administradores where usuario_id = '<uuid>';
--
-- Al borrar la cuenta se borra su fila. No guarda contenido publicado, así que
-- no se suma a limpiar_cuenta.
-- ---------------------------------------------------------------------------
create table public.administradores (
  usuario_id uuid primary key references public.perfiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.administradores is
  'Cuentas que leen el resumen del Panel de SPOT. Se asignan solo desde el editor SQL.';

alter table public.administradores enable row level security;
revoke all on public.administradores from anon, authenticated;

-- ---------------------------------------------------------------------------
-- es_admin(): si quien llama está en administradores. Mismo estilo que
-- es_moderador() (0006).
-- ---------------------------------------------------------------------------
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.administradores where usuario_id = (select auth.uid())
  );
$$;

revoke all on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- admin_resumen(): los conteos de la tarjeta "La app" y el tamaño de la base y
-- de Storage. Solo números y fechas agregadas: nunca filas, nombres, emails,
-- mensajes, descripciones ni ubicaciones.
--
-- - Los datos de demo (fotos que son una URL, es_foto_de_demo, 0026) no
--   cuentan como casos, igual que en el contador de reencuentros.
-- - Los días son los de Montevideo.
-- ---------------------------------------------------------------------------
create or replace function public.admin_resumen()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ahora timestamptz := now();
  v_hoy timestamp := date_trunc('day', v_ahora at time zone 'America/Montevideo');
begin
  if not public.es_admin() then
    raise exception 'Solo administración puede ver el resumen' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'generado_en', v_ahora,

    'casos', jsonb_build_object(
      -- Reportes publicados (perdidos y encontrados), también los ocultos.
      'nuevos_24h', (
        select count(*) from public.animales a
        where a.created_at >= v_ahora - interval '24 hours'
          and not public.es_foto_de_demo(a.foto_principal_path)
      ),
      'nuevos_7d', (
        select count(*) from public.animales a
        where a.created_at >= v_ahora - interval '7 days'
          and not public.es_foto_de_demo(a.foto_principal_path)
      ),
      -- Para la gráfica de 7 barras: hoy y los 6 días anteriores.
      'por_dia', (
        select jsonb_agg(
          jsonb_build_object(
            'dia', to_char(d.dia, 'YYYY-MM-DD'),
            'casos', (
              select count(*) from public.animales a
              where a.created_at >= (d.dia at time zone 'America/Montevideo')
                and a.created_at < ((d.dia + interval '1 day') at time zone 'America/Montevideo')
                and not public.es_foto_de_demo(a.foto_principal_path)
            )
          )
          order by d.dia
        )
        from generate_series(v_hoy - interval '6 days', v_hoy, interval '1 day') as d (dia)
      ),
      'abiertos', (
        select count(*) from public.animales a
        where a.estado in ('avistado', 'resguardado')
          and not a.oculto
          and not public.es_foto_de_demo(a.foto_principal_path)
      ),
      'reunidos', (
        select count(*) from public.animales a
        where a.estado = 'reunido'
          and not public.es_foto_de_demo(a.foto_principal_path)
      ),
      -- Casos que pasaron a reunido en los últimos 30 días.
      'reunidos_30d', (
        select count(distinct c.animal_id) from public.cambios_estado c
        where c.estado_nuevo = 'reunido'
          and c.created_at >= v_ahora - interval '30 days'
      )
    ),

    'coincidencias', jsonb_build_object(
      'pendientes', (select count(*) from public.coincidencias where estado = 'pendiente'),
      'pendiente_desde', (
        select min(created_at) from public.coincidencias where estado = 'pendiente'
      )
    ),

    'moderacion', jsonb_build_object(
      'denuncias_pendientes', (select count(*) from public.denuncias where estado = 'pendiente'),
      'casos_ocultos', (select count(*) from public.animales where oculto),
      'historias_ocultas', (select count(*) from public.historias_reencuentro where oculta),
      'errores_sin_resolver', (
        select count(*) from public.reportes_errores where resuelto_en is null
      )
    ),

    -- Cuentas con perfil (cada alta crea su perfil).
    'usuarios', jsonb_build_object(
      'total', (select count(*) from public.perfiles),
      'nuevos_24h', (
        select count(*) from public.perfiles where created_at >= v_ahora - interval '24 hours'
      ),
      'nuevos_7d', (
        select count(*) from public.perfiles where created_at >= v_ahora - interval '7 days'
      )
      -- 'activos_7d': no hay de dónde sacarlo. La app no guarda la última visita,
      -- y auth.users.last_sign_in_at es solo el último ingreso con contraseña o Google.
    ),

    -- La cola de reconocimiento. "Esperando" es lo mismo que cuenta
    -- estado_reconocimiento() (0018): lo que todavía se va a procesar.
    'vision', jsonb_build_object(
      'esperando', (
        select count(*) from public.cola_vision
        where estado in ('pendiente', 'procesando') or (estado = 'error' and intentos < 8)
      ),
      'esperando_desde', (
        select min(created_at) from public.cola_vision
        where estado in ('pendiente', 'procesando') or (estado = 'error' and intentos < 8)
      ),
      -- "Fotos trabadas": esperan hace más de 30 minutos.
      'trabadas', (
        select count(*) from public.cola_vision
        where (estado in ('pendiente', 'procesando') or (estado = 'error' and intentos < 8))
          and created_at < v_ahora - interval '30 minutes'
      ),
      'sin_reintentos', (
        select count(*) from public.cola_vision where estado = 'error' and intentos >= 8
      ),
      'llamadas_ia_24h', (
        select count(*) from public.llamadas_ia where created_at >= v_ahora - interval '24 hours'
      ),
      'errores_ia_24h', (
        select count(*) from public.llamadas_ia
        where created_at >= v_ahora - interval '24 hours'
          and resultado not in ('ok', 'en_curso')
      )
    ),

    -- Tamaños en bytes. El panel los compara con el plan gratuito (500 MB de
    -- base y 1 GB de Storage). Lo que factura Supabase puede diferir un poco.
    'almacenamiento', jsonb_build_object(
      'base_bytes', pg_database_size(current_database()),
      'storage_bytes', (
        select coalesce(sum((o.metadata ->> 'size')::bigint), 0) from storage.objects o
      ),
      'storage_por_bucket', (
        select coalesce(jsonb_object_agg(b.bucket_id, b.bytes), '{}'::jsonb)
        from (
          select o.bucket_id, sum((o.metadata ->> 'size')::bigint) as bytes
          from storage.objects o
          group by o.bucket_id
        ) b
      )
    )
    -- 'proyecto_responde': no sale de la base. Si esta función contesta, la
    -- base responde; la función del panel lo marca como Falla si no contesta.
  );
end;
$$;

revoke all on function public.admin_resumen() from public, anon;
grant execute on function public.admin_resumen() to authenticated;

-- ---------------------------------------------------------------------------
-- Pruebas para supabase/tests/panel_admin.sql (en el prompt que la aplique):
--   - anon no puede ejecutar es_admin() ni admin_resumen();
--   - una cuenta authenticated que no está en administradores recibe el error
--     42501 de admin_resumen() y false de es_admin();
--   - authenticated no puede leer, insertar, cambiar ni borrar en
--     administradores;
--   - un administrador recibe un jsonb con las claves de arriba, y por_dia
--     tiene 7 elementos;
--   - un caso de demo (foto con URL) no suma en casos y uno oculto sí suma en
--     nuevos y en casos_ocultos;
--   - al borrar la cuenta de un administrador se borra su fila.
-- ---------------------------------------------------------------------------

-- El esquema va a cambiar en las Fases 5 a 7: esta propuesta se revisa contra
-- las migraciones de ese momento antes de aplicarla.
