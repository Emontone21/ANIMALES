# Cierre del reconocimiento en Cloud Run

Rama `claude/animales-repo-mxm2ja`, PR #11 (commit de la tarea: `7f55eb5`; ajuste de la clave: `7c5691a`). Proyecto de Supabase `bwqvuttuodwypwxckxgf`. 20 de octubre de 2026.

## 1. Resumen

**Qué se pidió:** cerrar la tarea de reconocimiento, con el PR #11 revisado y aprobado con un ajuste.

0. **Ajuste:** Supabase depreca las claves legacy `anon` y `service_role` a fines de 2026. El servicio y `desplegar.sh` tienen que aceptar la clave secreta nueva (`sb_secret_…`) y preferirla, mandándola como indica Supabase. La legacy (`eyJ…`) sigue andando mientras exista. Con README, pruebas de pytest para las dos y un commit aparte.
1. Aplicar la 0017 en producción y registrarla: historial de 0001 a 0017 sin duplicados, y `vision-pendientes` y `vision-limpiar-historial` activos en `cron.job`.
2. Correr en la base real `vision.sql` y las otras siete pruebas SQL, de a una.

**Qué se hizo:**

- **El servicio prefiere la clave secreta nueva.** La toma de `SUPABASE_SECRET_KEY`; si no está, usa `SUPABASE_SERVICE_ROLE_KEY`. Los headers dependen de la clave, no de la variable:
  - **secreta:** solo en `apikey`, sin `Authorization`, como pide la documentación de Supabase;
  - **legacy:** en `apikey` y como `Authorization: Bearer`, como antes.
- **`desplegar.sh` pide la clave secreta** y dice dónde está. Si recibe la legacy, la acepta con un aviso de la deprecación; si recibe la publishable u otra cosa, se frena. La prueba de la clave antes de desplegar manda los mismos headers que el servicio.
- **7 pruebas nuevas de pytest** cubren las dos claves, incluso los pedidos reales que salen del servicio.
- **0017 aplicada y registrada en producción.**
  - El historial quedó de 0001 a 0017: 17 versiones, todas distintas.
  - `vision-pendientes` (cada 2 minutos) y `vision-limpiar-historial` (todos los días a las 4:23 UTC) están activos. El primero ya corrió con éxito.
  - Lo aplicado es idéntico a lo probado en local: los hashes de las cinco funciones coinciden.
- **Las 8 pruebas SQL pasan en producción**, de a una, sin dejar datos.
  - Tres copias de `vision.sql` alteradas a propósito fallan donde corresponde, incluso en el último chequeo.
  - Así, un error no habría pasado inadvertido, y la prueba corre entera por la API.

## 2. Cambios

| Dónde | Qué y por qué |
| --- | --- |
| Supabase, proyecto `bwqvuttuodwypwxckxgf` | Se aplicó `supabase/migrations/20261020000017_reconocimiento_cloud_run.sql`, sacada del commit `7f55eb5` del PR (es idéntica a la de la rama), en una sola petición a la Management API (una transacción). En la misma transacción se registró: `insert into supabase_migrations.schema_migrations (version, name) values ('20261020000017', 'reconocimiento_cloud_run')`. La migración habilita pg_cron (1.6.4, esquema `pg_catalog`) y crea los dos trabajos. |
| `services/vision/app/db.py` | `clave_desde_entorno` (prefiere `SUPABASE_SECRET_KEY`), `tipo_de_clave` y `headers_para`. La clave secreta va solo en `apikey`; la legacy, también como `Bearer`. Todos los pedidos llevan `User-Agent: encontrados-vision`: Supabase rechaza (401) una clave secreta si el pedido parece de un navegador. `TRANSPORTE` deja que las pruebas vean qué se manda. La foto se sigue bajando del bucket público sin clave. |
| `services/vision/tests/test_db.py` (nuevo) | Pruebas de las dos claves: <ul><li>cuál se prefiere;</li><li>cómo se reconoce cada tipo;</li><li>qué headers lleva cada una;</li><li>los pedidos reales a PostgREST, con `httpx.MockTransport`: la secreta sin `Authorization`, la legacy con `Bearer`, ninguna con un User-Agent de navegador;</li><li>la foto sin clave;</li><li>sin clave, el servicio no se da por configurado.</li></ul> |
| `services/vision/desplegar.sh` | El secreto pasa a llamarse `encontrados-supabase-secret-key` y llega al servicio como `SUPABASE_SECRET_KEY`. El script dice dónde están la URL (botón Connect) y la clave (Settings → API Keys → "Publishable and secret API keys" → Secret keys). Reconoce la clave por su prefijo. La comprobación con `curl` arma los headers según el tipo y los pasa por un descriptor (`-H @<(…)`), no en la línea de comandos. |
| `services/vision/README.md` | Paso 5.3: <ul><li>la URL, en el botón Connect;</li><li>la clave, en Settings → API Keys → "Publishable and secret API keys" → Secret keys, con una propia del servicio (por ejemplo `vision`);</li><li>la legacy anda mientras exista, con el aviso de la deprecación;</li><li>qué hacer si se filtra la clave.</li></ul> |
| `services/vision/.env.example` | `SUPABASE_SECRET_KEY` como la que se prefiere, y la legacy comentada. |
| `docs/DECISIONES.md` | Entrada nueva, "El servicio usa la clave secreta nueva de Supabase": dónde está, cómo se manda, el User-Agent y qué pasa con la legacy. La de Secret Manager habla de la clave secreta. |
| `docs/ARQUITECTURA.md` | La línea "Claves": una clave secreta, o la legacy mientras exista, solo en el servicio de visión. |
| `README.md` | La puesta en marcha ya no manda a copiar la `service_role`: la URL está en Connect y la clave secreta se crea en el paso del servicio de visión. Las migraciones van de 0001 a 0017. |
| `docs/reportes/2026-10-20-cierre-reconocimiento.md` | Este reporte. |

**Cómo manda Supabase cada clave.** No se pudo abrir supabase.com desde este entorno: la red no llega. Se leyó la misma documentación en su repositorio público, en `apps/docs/content/guides/getting-started/api-keys.mdx` del repo `supabase/supabase`. Dice tres cosas:
- Las claves publishable y secreta se mandan en el header `apikey`, no en `Authorization: Bearer`, porque no son JWT.
- Con una clave secreta, el pedido tiene el rol `service_role`, que salta la RLS.
- Una clave secreta en un pedido con User-Agent de navegador da 401.

## 3. Verificaciones

### Paso 0 · La clave secreta nueva

| Qué | Resultado |
| --- | --- |
| `npm run typecheck` | Sin errores. |
| `npm run lint` | Sin errores ni avisos. |
| `npm run test` | 18 suites, 184 pruebas, todas pasan. |
| `npx expo export -p web` | Exportado a `dist/` sin errores. |
| `pytest` en `services/vision` | 33 pruebas pasan: las 26 de antes y las 7 de `test_db.py`. |
| `bash -n` y `shellcheck` de `desplegar.sh` | Sin errores ni avisos. |

**`desplegar.sh` con un `gcloud` y un `curl` falsos.** El `curl` falso anota el nombre de cada header y el tipo de clave que lleva, nunca su valor. Los cuatro casos dieron lo esperado:

1. **Primera vez, clave secreta.**
   - La comprobación mandó solo `apikey` con la secreta.
   - El deploy lleva `--update-secrets SUPABASE_SECRET_KEY=encontrados-supabase-secret-key:latest,VISION_SECRET=encontrados-vision-secret:latest`.
   - Las variables comunes son `HILOS`, `TIEMPO_MAXIMO_COLA_SEG` y `SUPABASE_URL`.
2. **Servicio existente, cambiando a la legacy.**
   - El script avisa de la deprecación.
   - La comprobación mandó `apikey` y `Authorization: Bearer`.
   - Se destruyeron las versiones anteriores de los dos secretos.
3. **Una clave publishable.** El script se frena con salida 1, antes de guardar nada.
4. **Sin cambiar las claves.** El deploy no toca los secretos: no lleva `--update-secrets` ni `SUPABASE_URL`.

Las claves de prueba no aparecen en ninguna salida, en el registro de llamadas ni en los argumentos del deploy.

### Paso 1 · La 0017 en producción

**Antes** (solo lectura):
- El historial tenía 16 versiones, de 0001 a 0016, todas distintas.
- pg_cron no estaba instalada; la versión disponible era la 1.6.4. pg_net estaba en la 0.20.4.
- `vision_url` y `vision_secret` estaban vacías: el servicio todavía no está desplegado.
- `cola_vision` tenía 5 fotos pendientes.

**Después:**

| Qué | Resultado |
| --- | --- |
| `supabase_migrations.schema_migrations` | 17 filas y 17 versiones distintas, de `20261017000001` a `20261020000017` (`reconocimiento_cloud_run`). |
| pg_cron | 1.6.4, esquema `pg_catalog`. |
| `cron.job` | <ul><li>`vision-pendientes`: `*/2 * * * *`, `select public.despertar_vision()`, activo.</li><li>`vision-limpiar-historial`: `23 4 * * *`, borra las corridas de más de 7 días, activo.</li></ul>Los dos corren en la base `postgres`, con el usuario `postgres`. |
| Primera corrida | `vision-pendientes` corrió a las 16:02:00 UTC con estado `succeeded`. Hoy `despertar_vision()` devuelve `sin_configurar`: no llama a nadie hasta que se cargue `vision_url`. |
| Funciones | `llamar_vision`, `avisar_vision`, `despertar_vision`, `estado_reconocimiento` y `procesar_pendientes_vision` son `security definer`. El md5 de `pg_get_functiondef` de cada una coincide con el de la base local donde se probó la 0017. |
| Permisos | <ul><li>`estado_reconocimiento` y `procesar_pendientes_vision`: solo `authenticated` (y adentro, solo moderación).</li><li>`llamar_vision` y `despertar_vision`: ni `anon` ni `authenticated`.</li><li>Ninguna tiene `execute` para `public`.</li></ul> |

### Paso 2 · Pruebas SQL en producción

Se corrieron de a una, cada una en su propia petición a la Management API. Cada archivo corre dentro de `begin`/`rollback`.

| Prueba | Resultado |
| --- | --- |
| `vision.sql` | Pasa (sin filas, sin error). |
| `errores.sql` | Pasa. |
| `fase5_permisos.sql` | Pasa. |
| `fase6_perdidos.sql` | Pasa. |
| `fase7_cuenta.sql` | Pasa. Devuelve la fila `{"role":"anon"}` del `set_config` de su último paso, como siempre: no es un error. |
| `fase8_casos.sql` | Pasa. |
| `fase9_revision.sql` | Pasa. |
| `fase9_parte2.sql` | Pasa. |

**Que una falla se vea.** Se corrieron tres copias de `vision.sql` alteradas a propósito, y fallaron donde corresponde:
- con el trabajo esperado cada 3 minutos: `FALLA 1a`;
- esperando `enviado` sin URL en el primer chequeo de `despertar_vision`: `FALLA 2a`;
- esperando `enviado` en el último chequeo del archivo: `FALLA 3i`.

**Sin restos.** Se contaron las filas antes de la primera prueba y después de la última, y son iguales:

| Tabla | Filas |
| --- | --- |
| `auth.users` y `perfiles` | 4 cada una (1 moderadora) |
| `animales` | 4 |
| `avistamientos` | 5 |
| `cola_vision` | 5, todas pendientes |
| `notificaciones` | 3 |
| `conversaciones` | 1 |
| `mensajes` | 2 |
| `seguimientos` | 4 |
| `reportes_errores` | 1 |
| `cambios_estado`, `coincidencias`, `denuncias`, `bloqueos`, `contactos_resguardo`, `push_tokens` y `storage.objects` | 0 |
| `cron.job` | 2 |
| `net.http_request_queue` y `net._http_response` | 0 |

`config_app` tiene el mismo md5 de claves y valores antes y después, y el historial sigue en 17. Las pruebas no dejaron pedidos al servicio: pg_net descarta los de una transacción que se deshace.

## 4. Pasos manuales

Al desplegar el servicio (`services/vision/README.md`, paso 5):

1. Crear una clave secreta propia del servicio: Supabase → **Settings → API Keys → "Publishable and secret API keys"** → **Secret keys** → **Add new secret key**, con el nombre `vision`.
2. Pegarla en `desplegar.sh` cuando la pida. No pasa por el chat ni por el repo: queda en Secret Manager.
3. Pegar en Supabase → SQL Editor las dos líneas que imprime el script al final (`vision_url` y `vision_secret`).
   - Desde ese momento, el trabajo de cada 2 minutos procesa las 5 fotos que esperan en la cola.
   - Se puede comprobar en **Perfil → Panel de moderación → Reconocimiento**, o con este SQL:

     ```sql
     select j.jobname, d.status, d.start_time
     from cron.job_run_details d join cron.job j using (jobid)
     order by d.start_time desc limit 5;
     ```

En Supabase no queda nada por hacer antes de desplegar: la 0017 ya está aplicada. Merge del PR #11: queda para cuando lo decidas, no lo hice.

## 5. Pendientes y riesgos

- **Orden del despliegue:** la 0017 quedó aplicada antes del merge, y no rompe nada en el medio:
  - Sin `vision_url`, el trabajo de cada 2 minutos y el aviso de cada foto no llaman a nadie.
  - La versión de la app que está en producción no pide `estado_reconocimiento`.
- **Historial de pg_cron:** `vision-pendientes` anota unas 720 corridas por día; `vision-limpiar-historial` borra las de más de 7 días.
- **`avisar_vision` se puede "ejecutar" con `anon` y `authenticated`,** como antes de la 0017 (`create or replace` conserva los permisos), en producción y en local.
  - Es la función del trigger: Postgres no deja llamarla fuera de un trigger.
  - No es un riesgo, pero se puede revocar en una migración futura para que la lista de permisos quede limpia.

- **La app sigue con la clave `anon` legacy,** que Supabase también depreca a fines de 2026. Pasarla a la publishable (`sb_publishable_…`) es otra tarea:
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY` en Vercel;
  - `src/lib/env.ts`;
  - la vista previa del link (`api/vista-previa.ts`);
  - los `preconnect` no cambian.

  Queda anotado en `docs/DECISIONES.md`.
- **Las pruebas no tocan un Supabase de verdad con una clave secreta:** se comprobó qué headers salen, no la respuesta del servidor. La primera corrida de `desplegar.sh` lo prueba contra el proyecto real antes de desplegar (paso "La clave funciona…").
- **Prefijos:** el servicio reconoce la clave secreta por `sb_secret_`. Si Supabase cambiara el formato, una clave nueva se mandaría también como `Bearer`, como la legacy, y `desplegar.sh` la rechazaría con un mensaje claro.
