# Cierre de la auditoría integral 2 · 2026-10-22

## 1. Resumen

**El pedido:** cerrar el PR #17 (commits `4833637` y `6e335e3`, revisados y aprobados), todo en producción en este orden, frenando si algo fallaba:
1. el merge;
2. el deploy de Vercel;
3. comprobar `/auth/confirmar`;
4. la función `reconocer`;
5. la 0023 con las pruebas SQL;
6. las plantillas de mail;
7. este reporte.

El dueño indicó que no hay proyecto de pruebas, así que los pasos 1 y 2 de la sección 4 de `docs/reportes/2026-10-21-auditoria-2.md` (la 0023 y `npm run e2e` en spot-pruebas) no se hicieron.

**Lo que se hizo:** los siete pasos, sin fallas y sin forzar ningún deploy. El paso 3 se comprobó leyendo lo que sirve el dominio de producción, no viendo la página dibujada (abajo).

| Paso | Resultado |
| --- | --- |
| 1. Merge del PR #17 | Hecho. Merge commit `ecee935` (01:38:55 UTC). |
| 2. Deploy de producción | **READY.** El automático del merge, `dpl_AQBb5J4CQUW1UmBS84rpGTpvRRkh`, empezó a las 01:38:59 y quedó listo a las 01:40:08 UTC, con el alias `animales-blue.vercel.app`. No hizo falta forzar ninguno. |
| 3. `/auth/confirmar` | Hecho, leyendo el código que sirve producción con la herramienta de Vercel: desde este entorno `vercel.app` da 403. |
| 4. Función `reconocer` | Hecho. Versión 7, activa, con `verify_jwt` apagado (01:41:56 UTC). Sin el secreto, o con uno que no tiene su forma, responde 401 `no_autorizado`. |
| 5. La 0023 y las pruebas SQL | Hecho. Aplicada y registrada (01:42:30 UTC). Las 11 pruebas pasan en la base real, de a una, sin dejar datos. |
| 6. Plantillas de mail | Hecho (01:44:01 UTC). Las cuatro, iguales a los archivos. La Site URL sigue en `https://animales-blue.vercel.app`, sin barra al final. |
| 7. Reporte | Este. |

### Paso 3. `/auth/confirmar` en producción

- **`https://animales-blue.vercel.app/auth/confirmar`** responde 200 con el `index.html` de la app nueva. Trae los encabezados que suma el PR: `Content-Security-Policy-Report-Only`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` y `Permissions-Policy`. El código que carga es `entry-7cd6a11b….js`.
- **El bloque de la pantalla,** `/_expo/static/js/web/confirmar-ccb825ae572b1a66d113a25f46aff466.js`, está en producción con el mismo nombre que en el build local: su nombre sale de su código, así que el código es el mismo. Sin `token_hash` ni `type`, muestra `t.auth.confirmar.invalido` y el botón "Ir al mapa". En `es-UY.ts` de `ecee935`, ese texto es "Este link no sirve. Abrí el último que te mandamos por mail.".
- **No se vio la página dibujada:** el proxy de este entorno no deja abrir `vercel.app` en un navegador. Lo que dice la pantalla ya se había visto en Chromium con el mismo código, contra el Supabase simulado (caso 8 de los links, en el reporte de la auditoría).

### Paso 4. La función

- **Antes:** versión 6, activa, `verify_jwt` apagado.
- **El despliegue:** `npx supabase functions deploy reconocer --project-ref bwqvuttuodwypwxckxgf --use-api --no-verify-jwt`, con el código de `ecee935`, que en `supabase/functions/reconocer` es igual a `6e335e3`.
- **Después:** versión 7, activa, `verify_jwt` apagado.
- **Dos pedidos desde la base, con `pg_net`:** sin `X-Vision-Secret` y con `X-Vision-Secret: no-es-el-secreto`. Los dos responden 401 `{"error":"no_autorizado"}`; el segundo ya no consulta la base (S-B2). La clave, la URL y el secreto de la función no cambiaron. No se mandó ningún pedido con el secreto, así que no se procesó ninguna foto.

### Paso 5. La 0023 y las pruebas

**Antes, solo lectura:**
- 22 versiones registradas; la última, `20261021000022`.
- Ninguna foto repetida en `avistamientos` (el índice único nuevo no habría podido crearse).
- Ninguna foto con otro nombre que `<uid>/<uuid>.jpg`.
- Ningún motivo, rasgo, raza ni color de collar de la IA con teléfonos, links o emails, con los patrones de la 0023. Los `update` de la migración no tenían nada que tapar.

**La migración:** el archivo entero, tal como está en `ecee935`, en un solo pedido a la API de gestión, entre `begin` y `commit`, con su `insert` en `supabase_migrations.schema_migrations` (`'20261021000023', 'auditoria_2'`). Respondió sin error.

**Después:**
- 23 versiones distintas; la última, `20261021000023 auditoria_2`.
- `config_app`: `publicaciones_por_hora_cuenta` 10 y `avisos_por_hora_cuenta` 30.
- El índice `avistamientos_foto_unica_idx` (sin las URL de demo) y el trigger de la foto única, activo.
- Los tres checks: `coincidencias_motivo_sin_contacto`, `comparaciones_ia_sin_contacto` y `descripciones_ia_sin_contacto`.
- `es_foto_propia` exige el uuid; `publicar_animal` y `registrar_avistamiento` leen sus topes.
- `anon` y `authenticated` no pueden ejecutar `tiene_datos_de_contacto` ni `ocultar_datos_de_contacto`.
- `tiene_datos_de_contacto('llamá al 099 123 456')` da verdadero y con un texto sin contacto, falso.

**Pruebas SQL**, de a una, en este orden (01:43:04 a 01:43:27 UTC). Todas terminan sin error:
`auditoria_2`, `contacto_al_cerrar`, `errores`, `fase5_permisos`, `fase6_perdidos`, `fase7_cuenta`, `fase8_casos`, `fase9_parte2`, `fase9_revision`, `reconocimiento_ia` y `vision`.
- `fase7_cuenta` devuelve la fila de un `select set_config(…)` que tiene en el medio (línea 488): no es un error, y es lo mismo que devolvió en los cierres anteriores. Termina en su `rollback` como las demás.

**Sin datos de más:** los conteos de todas las tablas de `public`, `storage.objects` y `auth.users` antes de la 0023, después de la 0023 y después de las pruebas:

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
| `config_app` | 14 | 16 (los dos topes) |
| `bloqueos`, `cambios_estado`, `contactos_resguardo`, `denuncias`, `push_tokens` | 0 | 0 |

`net.http_request_queue` quedó vacía. En `net._http_response`, las únicas respuestas de esos minutos son las dos del paso 4.

### Paso 6. Las plantillas

- **Antes:** las cuatro con `{{ .ConfirmationURL }}`. La del enlace mágico, con el asunto "Tu link para entrar a Spot". Site URL `https://animales-blue.vercel.app`.
- **La carga:** `node scripts/plantillas-mail.js` (de `ecee935`) y un `PATCH` a `/v1/projects/bwqvuttuodwypwxckxgf/config/auth` con ese JSON (200). El JSON se borró después.
- **Después, leyendo la configuración de nuevo:**
  - los 4 asuntos y los 4 HTML, iguales a los archivos;
  - confirmación, recuperación y cambio de email: el link `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&amp;type=…` (`signup`, `recovery`, `email_change`), tres veces cada una (botón, link y texto), sin `ConfirmationURL`;
  - el enlace mágico, sin link, con el asunto "Entrá a Spot con tu contraseña";
  - la Site URL sigue en `https://animales-blue.vercel.app`, sin barra al final;
  - el captcha sigue apagado y las Redirect URLs no cambiaron.
- **Los mails que salieron antes de las 01:44 UTC** traen el link viejo: andan en el navegador que los pidió y vencen en una hora.

## 2. Cambios

| Archivo | Por qué |
| --- | --- |
| `docs/reportes/2026-10-22-cierre-auditoria-2.md` | Este reporte. No cambia código. |

**En producción:**
- el deploy de Vercel de `ecee935`;
- la función `reconocer`, versión 7;
- la migración 0023, aplicada y registrada;
- las cuatro plantillas de mail.

## 3. Verificaciones

Con el código de `main` (`ecee935`):

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | Sin errores |
| `npm run lint` | Sin errores |
| `npm run test` | **279 pruebas pasan,** en 26 archivos |
| `npx expo export -p web` | Sin errores, 1155 módulos |
| Pruebas SQL en producción | Pasan las 11, de a una, sin dejar datos (paso 5) |

## 4. Pasos manuales

Lo que queda para el dueño, en orden:

1. **Probar los mails de verdad,** que es lo único que no se pudo probar desde acá. Recorré los flujos 1, 20 y 29 de `docs/PRUEBAS-MANUALES.md` con una cuenta de prueba, desde el celular:
   - registrate desde el navegador de WhatsApp o Instagram y abrí el mail de confirmación en Gmail: tiene que decir "Tu cuenta está confirmada", sin sesión abierta;
   - pedí recuperar la contraseña y abrí el link en otro navegador: tiene que mostrar "Es para la cuenta x***@…" y **No es mi cuenta**;
   - el link empieza con `https://animales-blue.vercel.app/auth/confirmar?token_hash=`.
2. **La CSP:** si en unos días de uso la consola no muestra ningún `[Report Only] Refused to…`, pasala a obligatoria. En `vercel.json`, cambiá la clave `Content-Security-Policy-Report-Only` por `Content-Security-Policy` y sumá `; upgrade-insecure-requests` al final del valor.
3. **Al cierre del piloto o antes de abrir al público:** en Supabase, **Authentication → URL Configuration → Redirect URLs**, sacá `http://localhost:8081/**` y `spotmvd://**`. Tiene que quedar solo `https://animales-blue.vercel.app/**`.
4. **El captcha** sigue apagado hasta abrir al público. Ese día, los pasos de `docs/reportes/2026-10-21-spot-piloto.md` (paso 6).
5. **Opcional:** el email noreply de GitHub para los commits (`git config user.email`).

## 5. Pendientes y riesgos

- **Los mails nuevos no se probaron con un mail real:** el código de `/verify` se comparó con el de Supabase Auth y se probó contra un simulado. Si la primera confirmación o recuperación falla, volvé a cargar las plantillas anteriores desde el historial de git (`git show 407df6a:supabase/templates/<archivo>`). La app sigue entendiendo el link viejo en el navegador que lo pidió.
- **El paso 3 no vio la página dibujada,** solo el código que sirve producción. Lo confirma el paso 1 de arriba.
- **`npm run e2e` no se corrió contra ningún backend real:** no hay proyecto de pruebas. No se puede correr contra producción: crea y borra cuentas, y se niega a arrancar con la URL de producción.
- **La 0023 rige desde ahora:**
  - una cuenta que publique más de 10 casos o avise más de 30 veces en una hora recibe "Ya publicaste…" o "Ya avisaste…". Se ajusta en `config_app` sin código;
  - una foto que no tenga el nombre que sube la app se rechaza;
  - un `.jpg` que ya se usó en otro aviso, también.
- **Lo demás sigue como en `docs/reportes/2026-10-21-auditoria-2.md`, sección 5:**
  - hallazgos BAJA e INFO con propuesta;
  - la invitación de usuarios desde el panel;
  - App Links para la app nativa;
  - el rendimiento.
