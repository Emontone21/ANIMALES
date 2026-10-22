# Cierre de notificaciones en el celular e historias · 2026-10-22

## 1. Resumen

**El pedido:** cerrar el PR #18 (commits `f144038` y `1278bc3`, revisados y aprobados) siguiendo el orden de la sección 4 de `docs/reportes/2026-10-22-avisos-historias.md`, frenando si algo fallaba:
1. las claves VAPID, generadas en memoria, con la privada como secreto de la función;
2. la clave pública en Vercel (Production y Preview);
3. el deploy de la función `avisar`, sin `verify_jwt`;
4. la 0024 aplicada y registrada, y las 12 pruebas de `supabase/tests/` en producción, de a una, sin dejar datos;
5. la función conectada en `config_app`, con un secreto al azar;
6. el merge del PR con merge commit y el deploy de producción en READY;
7. este reporte.

**Lo que se hizo:** los siete pasos, sin fallas y sin forzar ningún deploy. También el paso 7 de la sección 4 del reporte, comprobado leyendo lo que sirve producción (abajo). Ninguna clave ni secreto está en este reporte ni en otro archivo; la clave pública se mostró solo en pantalla.

| Paso | Resultado |
| --- | --- |
| 1. Claves VAPID | Hecho (13:24:49 UTC). `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` cargadas como secretos de las funciones. Se generaron dos veces: ver abajo. |
| 2. Vercel | Hecho (13:25:07 UTC). `EXPO_PUBLIC_VAPID_PUBLIC_KEY` en Production y Preview, cifrada como las demás. |
| 3. Función `avisar` | Hecho (13:25:37 UTC). Versión 1, activa, `verify_jwt` apagado. Sin el secreto, o con uno que no tiene su forma, responde 401 `no_autorizado`. |
| 4. La 0024 y las pruebas SQL | Hecho. Aplicada y registrada (`20261022000024 avisos_al_celular`). Las 12 pruebas pasan en la base real, de a una, sin dejar datos. |
| 5. Conectarla | Hecho. `avisar_url` apunta a la función y `avisar_secret` tiene 32 bytes al azar, generados en la base. Un pedido de la base con ese secreto responde 200. |
| 6. Merge y deploy | Hecho. Merge commit **`163ac3f`** (13:28 UTC). El deploy automático, `dpl_A66R4HFhWfDTmTTYt6DmFAWDDiKP`, empezó a las 13:28:40 y quedó **READY** a las 13:30:37 UTC, con el alias `animales-blue.vercel.app`. No hizo falta forzar ninguno. |
| 7. Reporte | Este. |

### Paso 1. Las claves

- **Antes:** ningún secreto `VAPID_*`.
- **La carga:** un script de Node en línea genera el par P-256 con WebCrypto, comprueba que la privada firma y la pública verifica, y manda los dos secretos a `POST /v1/projects/bwqvuttuodwypwxckxgf/secrets` por la entrada estándar de `curl`. La privada nunca pasó por la línea de comandos, un archivo ni la pantalla.
- **Dos veces:** la primera carga anduvo (201), pero la línea con la clave pública se perdió. La respuesta de `curl` iba a `/dev/stderr`, y al abrirlo se pisó la salida donde estaba escrita. La API de secretos no devuelve valores, así que se generó un par nuevo que pisó los dos secretos (201). No pasó nada: todavía nada los usaba y la clave pública no estaba en Vercel. El primer par no quedó en ningún lado.
- **Después:** los dos secretos están, con la misma fecha. El resumen SHA-256 que muestra Supabase de `VAPID_PUBLIC_KEY` coincide con el de la clave que se cargó en Vercel.

### Paso 3. La función

- **El despliegue:** `npx supabase functions deploy avisar --project-ref bwqvuttuodwypwxckxgf --use-api --no-verify-jwt`, con el código de `1278bc3`, que en `supabase/functions/avisar` es igual a `163ac3f`. Subió los 8 archivos de la función (`deno.json`, `index.ts`, `servidor.ts`, `procesar.ts`, `push.ts`, `aviso.ts`, `textos.ts` y `base.ts`).
- **Después:** `ACTIVE`, versión 1, `verify_jwt: false`.
- **Dos pedidos desde la base, con `pg_net`:** sin `X-Avisar-Secret` y con `X-Avisar-Secret: no-es-un-secreto`. Los dos responden 401 `{"error":"no_autorizado"}`. En ese momento `config_app` todavía no tenía la 0024, así que la función no tenía con qué comparar.

### Paso 4. La 0024 y las pruebas

**Antes, solo lectura:**
- 23 versiones registradas; la última, `20261021000023`.
- Nada de la 0024: ni `suscripciones_push`, ni `avisos_push`, ni las claves de `config_app`, ni el trigger.
- `pg_net` 0.20.4 y `pgcrypto` 1.3, instalados.

**La migración:** el archivo entero, tal como está en `1278bc3`, en un solo pedido a la API de gestión, entre `begin` y `commit`, con su `insert` en `supabase_migrations.schema_migrations` (`'20261022000024', 'avisos_al_celular'`). Respondió sin error.

**Después:**
- 24 versiones distintas; la última, `20261022000024 avisos_al_celular`.
- `suscripciones_push` y `avisos_push`, con RLS.
- `config_app`: `avisos_push_por_hora` 6, `avisar_url` y `avisar_secret` vacíos.
- El trigger `notificaciones_aviso_push` y las 8 funciones:
  - `es_endpoint_push`;
  - `guardar_suscripcion_push`;
  - `config_avisar`;
  - `llamar_avisar`;
  - `encolar_aviso_push`;
  - `uuid_de`;
  - `preparar_avisos_push`;
  - `terminar_avisos_push`.
- **Quién puede ejecutarlas:**
  - `config_avisar`, `preparar_avisos_push` y `terminar_avisos_push`, solo `service_role`;
  - `guardar_suscripcion_push`, `authenticated` y `service_role`, nunca `anon`.

**Pruebas SQL**, de a una, en este orden. Todas terminan sin error:
`fase5_permisos`, `fase6_perdidos`, `fase7_cuenta`, `fase8_casos`, `fase9_revision`, `fase9_parte2`, `errores`, `vision`, `reconocimiento_ia`, `contacto_al_cerrar`, `auditoria_2` y `avisos_push`.
- `fase7_cuenta` devuelve la fila de un `select set_config(…)` que tiene en el medio, como en los cierres anteriores. Termina en su `rollback` como las demás.
- `avisos_push` se corrió antes del paso 5, como pide: su primer control exige `avisar_url` vacío. Adentro carga una URL y un secreto de mentira que el `rollback` deshace; `pg_net` no manda pedidos de una transacción que no termina en `commit`.

**Sin datos de más:** los conteos de todas las tablas de `public`, `storage.objects` y `auth.users`, antes de la 0024, después de la 0024 y después de las pruebas:

| Tabla | Antes | Después |
| --- | --- | --- |
| `animales` | 6 | 6 |
| `avistamientos` | 7 | 7 |
| `coincidencias` | 3 | 3 |
| `comparaciones_ia` | 9 | 9 |
| `descripciones_ia` | 7 | 7 |
| `llamadas_ia` | 27 | 27 |
| `cola_vision` | 7 | 7 |
| `notificaciones` | 9 | 9 |
| `seguimientos` | 6 | 6 |
| `conversaciones`, `mensajes` | 1, 2 | 1, 2 |
| `reportes_errores` | 1 | 1 |
| `perfiles`, `auth.users` | 4, 4 | 4, 4 |
| `storage.objects` | 4 | 4 |
| `config_app` | 16 | 19 (las tres claves nuevas) |
| `suscripciones_push`, `avisos_push` | no existían | 0, 0 |
| `bloqueos`, `cambios_estado`, `contactos_resguardo`, `denuncias`, `push_tokens` | 0 | 0 |

Los conteos después de las pruebas son idénticos a los de después de la 0024. No quedó ninguna cuenta `@spot.test`, `net.http_request_queue` quedó vacía y en `net._http_response` no hay respuestas nuevas de esos minutos.

### Paso 5. La conexión

- **El cambio:** los dos `update` de la sección 4, entre `begin` y `commit`. El secreto lo generó la base (`encode(extensions.gen_random_bytes(32), 'hex')`) y no se leyó: se comprobó que tiene la forma (64 caracteres hexadecimales) y que es distinto de `vision_secret`.
- **De punta a punta:** un `select public.llamar_avisar()`, que manda el secreto de `config_app`, respondió 200 con `{"avisos":0,"enviados":0,"vencidas":0,"errores":0}`. La función aceptó el secreto y no había nada para mandar.
- **Desde ahora:** cada notificación nueva de alguien con suscripciones entra a `avisos_push` y despierta a la función. Hoy no hay ninguna suscripción.

### Paso 6. El merge y el deploy

- **Antes:** el PR #18 abierto, `mergeable_state: clean`, head `1278bc3`, y la vista previa de Vercel en `success`.
- **El merge:** con merge commit, exigiendo ese head. Merge commit `163ac3f`, con padres `ecee935` (main) y `1278bc3`.
- **El deploy:** el automático del merge, `dpl_A66R4HFhWfDTmTTYt6DmFAWDDiKP`, con `githubCommitSha` `163ac3f`. Estuvo en BUILDING unos dos minutos y quedó READY con los alias `animales-blue.vercel.app`, `animales-busca-labur.vercel.app` y `animales-git-main-busca-labur.vercel.app`. No se forzó ninguno.

### Lo que sirve producción (paso 7 de la sección 4)

Desde este entorno `vercel.app` da 403 en un navegador, así que **no se vio la app dibujada**. Se leyeron los archivos que sirve producción:
- el `index.html`, con la herramienta de Vercel;
- los bloques de JavaScript, con `pg_net` desde la base: GET de archivos públicos del sitio, buscando con SQL sin mostrar el contenido.

Lo que se encontró:
- **`/perfil`** responde 200 con los encabezados de seguridad de siempre: CSP en modo reporte, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` y `Permissions-Policy`. Carga `entry-0f48dff0….js` y `__common-1b19bc00….js`.
- **La clave pública entró en el build:** el `__common` de producción la contiene. También tiene "Notificaciones en este celular" (el interruptor de Perfil) y "Compartir en historias" (el botón y el título de la hoja).
- **El código es el de `163ac3f`:**
  - los bloques aparte de esta función tienen en producción el mismo nombre que en el build local de `163ac3f`: `celular-7f41283d….js`, `AvisosCelular-4f9fa360….js` y `HojaHistoria-4bf794c9….js`. El nombre sale del contenido, así que el contenido es el mismo;
  - de los 22 bloques de rutas que lista el `entry`, 21 tienen el mismo nombre que en local;
  - el de Perfil cambia porque nombra al bloque de "Reportar un error", que lleva `EXPO_PUBLIC_COMMIT` y `EXPO_PUBLIC_FECHA_BUILD` (cambian en cada build). Comparados byte a byte, los dos `perfil-….js` difieren solo en ese nombre;
  - ese bloque de producción tiene el commit `163ac3f`.
- **`sw.js`** responde con el service worker nuevo, con `push` y `notificationclick`.

Lo que falta ver en un celular de verdad está en la sección 4: los pasos 30 y 31.

## 2. Cambios

| Archivo | Por qué |
| --- | --- |
| `docs/reportes/2026-10-22-cierre-avisos-historias.md` | Este reporte. No cambia código. |

**En producción:**
- los secretos `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` de las funciones de Supabase;
- `EXPO_PUBLIC_VAPID_PUBLIC_KEY` en Vercel, en Production y Preview;
- la función `avisar`, versión 1;
- la migración 0024, aplicada y registrada;
- `config_app.avisar_url` y `config_app.avisar_secret`;
- el merge del PR #18 (`163ac3f`) y su deploy de Vercel.

## 3. Verificaciones

Con el código de `main` (`163ac3f`):

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | Sin errores |
| `npm run lint` | Sin errores |
| `npm run test` | **306 pruebas pasan,** en 30 archivos |
| `npx expo export -p web` | Sin errores, 1164 módulos |
| Pruebas SQL en producción | Pasan las 12, de a una, sin dejar datos (paso 4) |
| Función `avisar` | 401 sin secreto o con uno mal formado; 200 con el de `config_app` |

`deno test`, `deno lint` y `deno fmt --check` de `supabase/functions/avisar` no se volvieron a correr: el código de la función es el de `1278bc3`, que ya pasaba (24 pruebas, sección 3 del reporte de la función).

## 4. Pasos manuales

Lo que queda para el dueño, en orden:

1. **Probar las notificaciones en celulares de verdad:** el paso 30 de `docs/PRUEBAS-MANUALES.md`.
   - Android, en Chrome y con la app instalada.
   - iPhone con iOS 16.4 o más, con la app instalada (en Safari sin instalar, Perfil tiene que decir que no se puede).
   - Desde los navegadores de WhatsApp e Instagram, que tienen que explicar que hay que abrir el link en el navegador.
   - El primer envío real a FCM, Apple o Mozilla es el que cuenta: no se pudo probar desde acá. Si no llega, mirá el resultado de cada aviso:
     ```sql
     select created_at, estado, motivo, grupo, terminado_en
     from public.avisos_push
     order by created_at desc
     limit 20;
     ```
2. **Probar "Compartir en historias":** el paso 31 de `docs/PRUEBAS-MANUALES.md`, en un caso con foto y en uno sin foto, en claro y en oscuro, hasta subirla a Instagram con el sticker de enlace.
3. **Si algo sale mal con los avisos,** esto apaga todo el envío; los avisos siguen en Actividad:
   ```sql
   update public.config_app set valor = '' where clave = 'avisar_url';
   ```
   Para volver a prenderlo, el primer `update` del paso 5 de la sección 4 del reporte de la función. El secreto no hace falta cambiarlo.
4. **Lo que seguía pendiente** de `docs/reportes/2026-10-22-cierre-auditoria-2.md`, sección 4:
   - probar los mails;
   - la CSP obligatoria;
   - las Redirect URLs al cerrar el piloto;
   - el captcha.

## 5. Pendientes y riesgos

- **El envío real no se probó:** las pruebas de la función simulan el servicio de push (descifran cada mensaje y verifican la firma VAPID), pero ningún aviso salió todavía hacia FCM, Apple o Mozilla. Lo confirma el paso 1 de arriba.
- **No se vio la app dibujada en producción,** solo los archivos que sirve. La pantalla se había visto en Chromium con el mismo código, contra el Supabase simulado (reporte de la función, capturas).
- **Las claves VAPID no se pueden leer:** Supabase guarda solo un resumen.
  - Si algún día hace falta otro par, se genera con el script de la sección 4. Se cambian los dos secretos y la variable de Vercel, y se vuelve a desplegar la web.
  - Las suscripciones que había dejan de andar y no se arreglan solas. El servicio de push las rechaza (403: el aviso queda en `error`, no `vencida`, y la suscripción no se borra). Perfil las sigue mostrando activas.
  - Ese día, borralas (`delete from public.suscripciones_push;`) y avisá que hay que apagar y volver a prender "Notificaciones en este celular": al prenderlo, la app se suscribe con la clave nueva.
  - Hoy no hay ninguna suscripción.
- **`npm run e2e` no se corrió contra un backend real:** sigue sin haber proyecto de pruebas, y no se puede correr contra producción.
- **El texto de privacidad** todavía no nombra a los servicios de push de los navegadores. Va con la próxima versión de los términos (sección 5 del reporte de la función).
- **Lo demás** sigue como en la sección 5 de `docs/reportes/2026-10-22-avisos-historias.md`:
  - iPhone, solo instalada y con iOS 16.4 o más;
  - sin pg_cron: lo pendiente lo toma el próximo aviso y, pasada una hora, se descarta;
  - un navegador compartido entre dos cuentas;
  - las fotos de demo cuando la CSP pase a obligatoria.
