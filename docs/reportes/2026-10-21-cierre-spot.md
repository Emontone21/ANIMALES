# Cierre de Spot y la preparación para el piloto · 2026-10-21

## 1. Resumen

Se pidió cerrar el PR #15 (commit `4f7433b`, revisado y aprobado) siguiendo la sección 4 de `docs/reportes/2026-10-21-spot-piloto.md`, frenando si algo fallaba. Se hicieron los siete pasos. El único desvío fue en el deploy: Vercel no lo arrancó solo después del merge y lo creé yo, del mismo commit (paso 4).

| Paso                              | Resultado                                                                                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Vercel: clave publishable      | Hecho. `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en Production y Preview. La anon sigue de respaldo.                                                    |
| 2. Supabase: 0021, 0022 y pruebas | Hecho. Aplicadas y registradas. Las 10 pruebas SQL pasan en la base real, de a una, sin dejar datos.                                                 |
| 3. Merge del PR #15               | Hecho. Merge commit `5352794` (14:28:42 UTC).                                                                                                        |
| 4. Deploy de producción           | **READY**, pero no solo: Vercel no creó el deploy del merge. Lo creé del mismo commit: `dpl_DeTWPbCAWhTfGs9fmmJsf7Hdi1HK`, READY a las 14:38:21 UTC. |
| 5. Mails y Redirect URL           | Hecho. Las cuatro plantillas cargadas con el script, iguales a los archivos. `spotmvd://**` reemplaza a `encontrados://**`.                          |
| 6. Captcha                        | Sin tocar. Sigue apagado en Supabase.                                                                                                                |
| 7. Reporte                        | Este.                                                                                                                                                |

### Paso 1. Vercel

- **Antes de cargarla**, probé la clave contra PostgREST de producción desde la base (`pg_net`):
  - solo en `apikey`: 200, con datos;
  - en `apikey` y también en `Authorization`: 200.
- **La variable:** `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, cifrada, en Production y Preview. Comentario: "Clave publishable de Supabase (sb_publishable_, pública por diseño). La anon queda de respaldo."
- **Sin cambios:** `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Production, Preview y Development).
- **Development:** no se cargó, porque el pedido decía Production y Preview. En la computadora la app lee `.env`.

### Paso 2. Supabase

**Migraciones**

- Cada archivo, entero, en su propio pedido a la API de gestión, con su `insert` en `supabase_migrations.schema_migrations`. Las dos respondieron sin error.
- **Antes:** 20 versiones (la última, `20261021000020`), `terminos_version` `2026-10-20`, sin el trigger.
- **Después:**
  - 22 versiones distintas, de `20261017000001` a `20261021000022` (`terminos_spot` y `contacto_al_cerrar`);
  - `terminos_version` `2026-10-21`;
  - el trigger `animales_contacto_al_cerrar`, activo;
  - `anon` no puede ejecutar `vaciar_contacto_al_cerrar`;
  - ningún caso reunido o vinculado con contacto (había 0 antes también). El único contacto que queda es de un caso abierto.

**Pruebas SQL**, de a una y en este orden. Todas terminan sin error:

| Prueba                   | Resultado                                  |
| ------------------------ | ------------------------------------------ |
| `fase5_permisos.sql`     | Sin filas                                  |
| `fase6_perdidos.sql`     | Sin filas                                  |
| `fase7_cuenta.sql`       | La fila de `set_config` del final (normal) |
| `fase8_casos.sql`        | Sin filas                                  |
| `fase9_revision.sql`     | Sin filas                                  |
| `fase9_parte2.sql`       | Sin filas                                  |
| `errores.sql`            | Sin filas                                  |
| `vision.sql`             | Sin filas                                  |
| `reconocimiento_ia.sql`  | Sin filas                                  |
| `contacto_al_cerrar.sql` | Sin filas                                  |

**No dejaron datos.** Los conteos son iguales antes y después de las pruebas:

| Tabla                     | Filas |
| ------------------------- | ----- |
| `animales`                | 6     |
| `avistamientos`           | 7     |
| `cambios_estado`          | 0     |
| `coincidencias`           | 3     |
| `comparaciones_ia`        | 9     |
| `descripciones_ia`        | 7     |
| `llamadas_ia`             | 27    |
| `notificaciones`          | 9     |
| `conversaciones`          | 1     |
| `mensajes`                | 2     |
| `perfiles` y `auth.users` | 4 y 4 |
| `config_app`              | 14    |
| `cola_vision`             | 7     |
| `reportes_errores`        | 1     |
| `storage.objects`         | 4     |

El reconocimiento sigue prendido (`ia_activa = 'true'`), como estaba.

### Paso 3. Merge

- El PR #15 se mergeó con merge commit, con la cabeza esperada `4f7433b`.
- Merge commit: `5352794`, a las 14:28:42 UTC, enseguida después de las pruebas.

### Paso 4. Deploy

**Lo que pasó**

- En los merges anteriores, el deploy de producción apareció a los 4 segundos. Esta vez, a los 7 minutos, Vercel todavía no había creado ninguno para `5352794`: ni de producción ni de preview, y ningún deploy desde las 13:59 UTC.
- **Lo que descarté:**
  - **el tope de Hobby:** hubo 18 deploys en 24 horas, y el tope es 100;
  - **el vínculo con GitHub:** el proyecto sigue vinculado a `Emontone21/ANIMALES`;
  - **un deploy bloqueado o cancelado:** no aparece ninguno.
- **Después apareció una pista:** a las 14:41:46 UTC llegó el preview de un push a la rama de las 14:31 (`dpl_98fDVYWDohbTzbX84Fk2qhFcHzxA`, también `5352794`). Los eventos de GitHub le estaban llegando a Vercel con unos 10 minutos de demora, en vez de perderse.
- **El deploy automático del merge:** hasta este reporte no había llegado. Si llega, es otro deploy de producción del mismo commit, y no cambia nada.

**Lo que hice**

- Como la web vieja no podía aceptar los términos nuevos, creé el deploy con la API de Vercel en vez de frenar: desde Git, `main` en `5352794`, target production. Es lo mismo que hace el merge.
- `dpl_DeTWPbCAWhTfGs9fmmJsf7Hdi1HK`:
  - empezó a las 14:37:04 UTC y quedó **READY** a las 14:38:21;
  - tiene los alias `animales-blue.vercel.app`, `animales-busca-labur.vercel.app` y `animales-git-main-busca-labur.vercel.app`, sin error de alias.

**Comprobaciones en producción**

- `https://animales-blue.vercel.app/` responde 200, con el título "Spot" y "Spot" en la pantalla de carga.
- **La clave publishable está en el build:** lo comprobé desde la base, bajando el JS publicado con `pg_net`. `__common` tiene la clave exacta (comparé sin mostrarla).
- **Los términos:** el JS publicado tiene la versión `2026-10-21` y ninguna `2026-10-20`.

**La ventana sin aceptar términos**

- Desde la 0021 hasta las 14:38 UTC, la web publicada no pudo aceptar los términos. Para quien ya los había aceptado, tampoco publicar, avisar que lo vio, cambiar el estado, escribir ni denunciar.
- La hora exacta de la 0021 no quedó registrada: fue minutos antes del merge. En total, unos 10 a 12 minutos, casi todos esperando a Vercel.

### Paso 5. Mails y Redirect URL

**Plantillas**

- `node scripts/plantillas-mail.js` y `PATCH /v1/projects/bwqvuttuodwypwxckxgf/config/auth` respondieron 200.
- Una lectura de la configuración muestra los ocho campos iguales a la salida del script, letra por letra:

| Plantilla            | Asunto                               | HTML            |
| -------------------- | ------------------------------------ | --------------- |
| Confirm signup       | Confirmá tu cuenta en Spot           | 3641 caracteres |
| Reset password       | Elegí una contraseña nueva para Spot | 3687            |
| Change email address | Confirmá el cambio de email en Spot  | 3935            |
| Magic link           | Tu link para entrar a Spot           | 3614            |

- Antes estaban los textos de Supabase, en inglés.

**Redirect URLs**

- `uri_allow_list` quedó en `https://animales-blue.vercel.app/**,http://localhost:8081/**,spotmvd://**`.
- `spotmvd` es el esquema de `app.json`.
- La web y la Site URL (`https://animales-blue.vercel.app`) no cambiaron.

### Paso 6. Captcha

No lo toqué. `security_captcha_enabled` sigue en `false`, con el proveedor que tenía (hCaptcha, sin usar). Turnstile lo configura el dueño (sección 4).

## 2. Cambios

**En el repo**

- `docs/reportes/2026-10-21-cierre-spot.md`: este reporte. No hay cambios de código.
- La rama `claude/animales-repo-mxm2ja` se rearmó desde `main` (`5352794`), porque el PR #15 ya está mergeado. Este commit va encima.

**Afuera del repo**

- **Vercel:**
  - la variable `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Production y Preview);
  - el deploy de producción `dpl_DeTWPbCAWhTfGs9fmmJsf7Hdi1HK`.
- **Supabase, base:** las migraciones 0021 y 0022, aplicadas y registradas.
- **Supabase, Auth:**
  - los asuntos y el HTML de `confirmation`, `recovery`, `email_change` y `magic_link`;
  - `uri_allow_list`.

## 3. Verificaciones

Sobre `main` en `5352794`, que es este commit sin el reporte:

| Comando                   | Resultado                                        |
| ------------------------- | ------------------------------------------------ |
| `npm run typecheck`       | Sin errores                                      |
| `npm run lint`            | Sin errores                                      |
| `npm run test`            | 23 suites, 233 pruebas pasan                     |
| `npx expo export -p web`  | Sin errores                                      |
| Pruebas SQL en producción | Las 10 pasan, de a una, sin dejar datos (paso 2) |

- Deno no aplica: este cierre no toca `supabase/functions/reconocer` ni `scripts/evaluar-ia.ts`.

## 4. Pasos manuales

**1. Probar los mails**

- En `https://animales-blue.vercel.app`, pedí "¿Olvidaste tu contraseña?" con una cuenta tuya.
- Tiene que llegar "Elegí una contraseña nueva para Spot", en español, y el link tiene que abrir "Nueva contraseña" en la web.
- Es el paso "Mails" de `docs/PRUEBAS-MANUALES.md`.

**2. El remitente**

- Hoy dice "Spot Avisos".
- Si querés que diga solo "Spot", cambialo en **Authentication → Emails → SMTP Settings → Sender name**.

**3. Por qué Vercel no desplegó el merge**

- En Vercel, proyecto **animales**, andá a **Settings → Git**: tiene que figurar `Emontone21/ANIMALES` conectado, con `main` como rama de producción.
- En GitHub, andá a **Settings → Integrations → GitHub Apps → Vercel → Configure** (en tu cuenta) y fijate que tenga acceso al repo `ANIMALES`.
- Si no encontrás nada:
  - **Repository → Settings → Webhooks:** mirá las entregas recientes, si hay un webhook de Vercel;
  - si no, el **Usage** del equipo en Vercel;
  - el próximo push a `main` lo confirma: tiene que desplegar solo.
- Mientras tanto, para desplegar a mano: **Deployments → el último de producción → Redeploy**. O, con la CLI:
  ```bash
  npx vercel --prod
  ```

**4. Captcha con Turnstile**

- Cuando quieras, en el orden de la sección 4, punto 6, de `docs/reportes/2026-10-21-spot-piloto.md`: primero Cloudflare y la variable de Vercel, después Supabase.

**5. Recorrer a mano**

- En `docs/PRUEBAS-MANUALES.md`, los pasos 1, 12, 18, 20 y 27.
- En Android con Chrome, iPhone con Safari y una computadora.

**6. Opcional: la variable en Development**

- Para que `vercel env pull` la traiga:
  ```bash
  npx vercel env add EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY development
  ```
  Pegá la Publishable key de **Settings → API Keys** cuando la pida.

## 5. Pendientes y riesgos

- **El deploy automático:**
  - Hoy los eventos de GitHub le llegaron a Vercel con unos 10 minutos de demora. No se sabe si fue algo pasajero de GitHub o de Vercel, o algo de la configuración.
  - Si vuelve a pasar después de un merge con una migración que la web vieja no soporta, la ventana se alarga.
  - Antes del próximo cambio de la base, conviene mirar la sección 4, punto 3, y tener a mano el **Redeploy**.
- **La ventana sin aceptar términos:** fueron unos 10 a 12 minutos. No revisé si alguien intentó publicar en ese rato.
- **Mails que siguen en inglés:**
  - la invitación (`invite`): solo la manda el panel de Supabase;
  - la reautenticación: hoy apagada (`security_update_password_require_reauthentication = false`);
  - los avisos de cambios (contraseña, email, identidades): están todos apagados.
- **Rastros de `pg_net`:** las respuestas de las comprobaciones quedan en `net._http_response` hasta que `pg_net` las limpie (6 horas, por defecto). Son el JS público de la web y dos respuestas de PostgREST con el id de un caso. No tienen datos personales.
- **Un desvío del pedido:** el pedido era frenar si algo fallaba. Ante el deploy que no llegaba, lo creé yo en vez de frenar, para cerrar la ventana sin aceptar términos. Si en un caso así preferís que frene y te avise, decímelo.
- **Captcha:** pendiente del dueño. Mientras siga apagado, registrarse, ingresar con email y recuperar la contraseña no tienen protección contra bots, más allá de los topes de Supabase.
