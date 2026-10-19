# Cierre de la Fase 7 · 2026-10-19

## 1. Resumen

**Qué se pidió.** Cerrar la Fase 7, con el código de la rama `claude/animales-repo-mxm2ja` (`0708d9b`) ya revisado y aprobado con un ajuste, en este orden:
0. Ajuste: al borrar la cuenta, los perdidos propios se borran siempre, aunque la persona elija conservar lo abierto. Corregirlo en la 0011, en la pantalla de borrar la cuenta y en `supabase/tests/fase7_cuenta.sql`, con las tres verificaciones y un commit aparte.
1. Aplicar la 0011 corregida en Supabase y registrarla en el historial, que tiene que quedar de 0001 a 0011 sin duplicados.
2. Correr en la base real, de a uno, `fase5_permisos.sql`, `fase6_perdidos.sql` y `fase7_cuenta.sql`, sin errores y sin dejar datos.
3. Auth: largo mínimo de contraseña en 8 y la plantilla "Reset Password" de la sección 4 de `2026-10-19-cuenta.md`.
4. Escribir este reporte, commitearlo y subir la rama.
5. Abrir el PR contra `main` si no existe y mergearlo con merge commit (autorizado).
6. Confirmar que el deploy de producción del merge quede en READY.

**Qué se hizo:**
- **Paso 0:** ajuste hecho en `cf590f0`. Un perdido propio se borra siempre, con sus fotos, avistamientos y contactos; los encontrados abiertos y lo aportado a casos de otros siguen la elección. La pantalla lo avisa antes de confirmar. Las tres verificaciones y las pruebas SQL en local, en verde.
- **Paso 1:** 0011 aplicada y registrada. Historial de `20261017000001_base` a `20261019000011_cuenta_y_proteccion`: 11 filas, 11 versiones distintas.
- **Paso 2:** los tres scripts terminaron sin errores y sin dejar datos.
- **Paso 3, a medias:**
  - **Largo mínimo:** quedó en 8.
  - **Plantilla:** Supabase rechazó el cambio por la API. Con el plan gratis y el mail por defecto no deja tocar las plantillas; hace falta un SMTP propio (ver sección 4).

Los pasos 5 y 6 se hacen después de este commit. Su resultado va en el mensaje final de la sesión.

## 2. Cambios

### En el repo

**Paso 0**, commit `cf590f0` ("fix: al borrar la cuenta, los perdidos propios se borran siempre"):

| Archivo | Por qué |
|---|---|
| `supabase/migrations/20261019000011_cuenta_y_proteccion.sql` | `limpiar_cuenta` borra siempre los perdidos propios. Con "Dejarlo publicado" solo quedan los encontrados abiertos, sin autor. `fotos_para_borrar(true)` suma las fotos de los perdidos y de lo que la persona vio de su propio perdido. Comentarios al día. |
| `src/app/cuenta/borrar.tsx` | Separa perdidos y encontrados abiertos. Si hay perdidos, avisa en "Se borra siempre" que se van a borrar aunque elija dejar publicado lo demás. La cantidad de la pregunta cuenta solo encontrados. |
| `src/i18n/es-UY.ts` | Línea nueva en `seBorraLista` y `perdidosAviso(n)`. La pregunta, la cantidad y "Borrarlo" hablan de encontrados. La política de privacidad dice que los perdidos se borran siempre. |
| `supabase/tests/fase7_cuenta.sql` | B conserva lo abierto y su perdido igual se borra, con avistamientos y contactos (24b). El contacto de R en el encontrado de B sigue (24d). Desde el panel se borra el perdido de D y queda su encontrado (28a). Nunca queda un perdido sin autor (28b). Se sacaron las pruebas de perdidos anónimos, que ya no pueden existir. |
| `src/features/coincidencias/api.ts` | Comentario de `perdidoDelPar`: un perdido sin familia ya no debería existir. |
| `docs/DECISIONES.md`, `docs/ARQUITECTURA.md`, `README.md`, `AGENTS.md` | La regla nueva: lo único que puede quedar sin autor son encontrados y aportes a casos de otros. |

**Este commit:**

| Archivo | Por qué |
|---|---|
| `docs/reportes/2026-10-19-cierre-fase-7.md` | Este reporte. |

### En Supabase

Proyecto `bwqvuttuodwypwxckxgf`. Cada paso fue un pedido a la API de administración. Un pedido con varias sentencias es atómico: si algo fallaba, no quedaba nada aplicado. Corrieron como `postgres`, igual que el SQL Editor.

**Paso 1 · migración 0011.**
- **Antes:**
  - historial de `20261017000001_base` a `20261019000010_reportes_perdidos`: 10 filas, 10 versiones distintas;
  - no existían `bloqueos`, `contactos_resguardo` ni `perfiles.terminos_version`;
  - `cambios_estado` todavía tenía `contacto_compartido` y `animales.creado_por` era `not null`.
- **Aplicación:** un solo pedido con el archivo tal como está en `cf590f0`, comparado byte a byte con el de la rama, y al final:
  ```sql
  insert into supabase_migrations.schema_migrations (version, name)
  values ('20261019000011', 'cuenta_y_proteccion');
  ```
  Respondió sin errores.
- **Comprobado después:**
  - `config_app.terminos_version` = `2026-10-19`;
  - `bloqueos` y `contactos_resguardo` existen, las dos con RLS;
  - `cambios_estado` ya no tiene `contacto_compartido`;
  - `animales.creado_por` acepta nulos, con `on delete set null`, y `vinculado_a` es `on delete cascade`;
  - `anon` lee `perfiles.nombre_publico` pero no `terminos_version`;
  - `authenticated` ejecuta `borrar_mi_cuenta` pero no `limpiar_cuenta`, y `anon` no ejecuta ninguna;
  - `cambiar_estado_animal` y `notificar` existen una sola vez, con `p_foto_path` y `p_actor`;
  - `limpiar_cuenta` tiene la regla del paso 0;
  - `perfiles` tiene los triggers `perfiles_al_borrar`, `perfiles_updated_at` y `perfiles_validar`;
  - los 4 animales siguen con autor.
- **Historial final:** 11 filas y 11 versiones distintas, de `20261017000001_base` a `20261019000011_cuenta_y_proteccion`, sin duplicados.

**Paso 2 · pruebas.**
- Los tres archivos se compararon byte a byte con `cf590f0` y se corrieron de a uno, cada uno en su propio pedido. Los tres terminaron sin errores.
- **Control:** la API devuelve lo mismo cuando un script pasa y cuando no corre. Para descartarlo, corrí una copia de cada uno con una expectativa cambiada a propósito. Las tres fallaron donde debían:

  | Copia de | Error |
  |---|---|
  | `fase5_permisos.sql` | `FALLA 4: no pudo marcar como leído un mensaje recibido` |
  | `fase6_perdidos.sql` | `FALLA 14b: el moderador no pudo rechazar` |
  | `fase7_cuenta.sql` | `FALLA 30: un tercero cerró un encontrado anónimo` |

  La prueba 30 es la anteúltima del script de la Fase 7. Que llegue hasta ahí prueba que todas las anteriores, borrado de cuentas incluido, pasaron en producción.
- **No dejaron datos.** Conteos iguales antes, entre script y script, y después de los controles:

  | usuarios | perfiles | animales | avistamientos | cambios_estado | contactos_resguardo | coincidencias | notificaciones | seguimientos | denuncias | bloqueos | conversaciones | mensajes | cola_vision | storage.objects | pedidos pg_net |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
  | 1 | 1 | 4 | 5 | 0 | 0 | 0 | 0 | 4 | 0 | 0 | 0 | 0 | 5 | 0 | 0 |

  Además: 0 usuarios `@encontrados.test` y ninguna transacción abierta (`idle in transaction`).

**Paso 3 · Auth** (`/v1/projects/bwqvuttuodwypwxckxgf/config/auth`).
- **Primer pedido**, con los tres cambios juntos: largo mínimo, asunto y cuerpo de la plantilla. Supabase lo rechazó entero (HTTP 400):
  > Email template modification is not available for free tier projects using the default email provider. Please upgrade your plan or configure a custom SMTP provider.

  No cambió nada.
- **Segundo pedido**, solo `password_min_length: 8`: HTTP 200.

| Ajuste | Antes | Después |
|---|---|---|
| Largo mínimo de contraseña | 6 | **8** |
| Asunto de "Reset Password" | `Reset your password` | `Reset your password` (sin cambiar) |
| Cuerpo de "Reset Password" | plantilla de Supabase, en inglés | sin cambiar |
| Vencimiento del link (`mailer_otp_exp`) | 3600 s | 3600 s |
| SMTP propio | no | no |

## 3. Verificaciones

Corridas en el paso 0, sobre `cf590f0`, y otra vez con este reporte agregado. Las dos veces, el mismo resultado:

| Comando | Resultado |
|---|---|
| `npm run typecheck` | OK (exit 0) |
| `npm run lint` | OK (exit 0) |
| `npx expo export -p web` | OK, `Exported: dist` (exit 0) |

**Pruebas SQL en local**, en Postgres 16 con 0001 a 0011 y el seed, sobre una base nueva: pasaron `fase5_permisos.sql`, `fase6_perdidos.sql` y `fase7_cuenta.sql`.

**Mutaciones:** rompí la 0011 de 16 formas, una por vez. Las 16 las detectó una prueba. Las dos nuevas son de la regla del paso 0:
- conservar los perdidos al borrar la cuenta → `FALLA 24b`;
- no borrar sus fotos → `FALLA 20a`.

**Pantalla:** en una captura de la web a 390 px, con datos simulados de una cuenta que tiene un perdido abierto, se ve el aviso rojo en "Se borra siempre".

**Sin verificar desde esta sesión:**
- la web publicada: la red bloquea `*.vercel.app`;
- el mail de recuperación: la red bloquea `*.supabase.co`, y con el SMTP por defecto solo llega a direcciones del equipo del proyecto.

## 4. Pasos manuales

### Supabase (proyecto `bwqvuttuodwypwxckxgf`)

1. **SMTP propio** (Authentication → Emails → SMTP Settings). Ya estaba pendiente y ahora es requisito para la plantilla: con el SMTP por defecto, Supabase no deja editar plantillas, tampoco desde el panel. Además:
   - según Supabase, sin SMTP propio los mails solo llegan a direcciones del equipo del proyecto;
   - salen 2 por hora para todo el proyecto.

   Cargá host, puerto, usuario, contraseña y remitente de tu proveedor (por ejemplo Resend, Brevo o Postmark), y tocá Save.
2. **Plantilla "Reset Password"**, con el SMTP ya guardado (Authentication → Emails → Templates → Reset Password):
   - **Subject:** `Elegí una contraseña nueva para Encontrados`
   - **Body:**
     ```html
     <h2>Recuperar tu contraseña</h2>
     <p>Pediste elegir una contraseña nueva para tu cuenta de Encontrados.</p>
     <p><a href="{{ .ConfirmationURL }}">Elegir una contraseña nueva</a></p>
     <p>El link sirve una sola vez y vence en una hora. Si no lo pediste, ignorá este mail: tu contraseña sigue igual.</p>
     ```
   Si preferís que lo haga yo por la API, avisame cuando el SMTP esté guardado.
3. **Probar la recuperación** en la web publicada, con un email que reciba mails, cuando el deploy del merge esté en READY. Seguí la Fase 7 de "Cómo probar cada fase" en el README. Hasta que cambies la plantilla, el mail llega en inglés ("Reset your password"), pero el link funciona igual: vuelve a `/auth/nueva-contrasena`.

### Vercel y GitHub

Nada nuevo. Al mergear el PR, Vercel despliega solo.

### Textos legales

Sigue igual que en `2026-10-19-cuenta.md`, sección 4: revisar `t.legal` con quien corresponda, completar lo que está entre corchetes y, con la versión final, sacar el aviso de borrador y subir la versión. **Los textos no son asesoramiento legal.**

## 5. Pendientes y riesgos

- **Ventana de despliegue.** La 0011 está aplicada y el merge todavía no. Hasta que el deploy del merge esté en READY, la app publicada (ver `2026-10-19-cuenta.md`, sección 5):
  - falla en el Perfil, que lee `perfiles` con `select *`;
  - no puede publicar, avisar, escribir ni denunciar: la base pide aceptar los términos y esa app no tiene cómo.

  Por eso el merge va enseguida de este commit.
- **Plantilla sin cambiar.** El mail de recuperación sale en inglés hasta que hagas los pasos 1 y 2 de la sección 4. Funciona, pero no dice "Encontrados" ni "una hora".
- **Contraseñas viejas de menos de 8.** El mínimo nuevo vale al crear una cuenta o cambiar la contraseña. Quien ya tenía una más corta sigue entrando con ella. Hoy hay una sola cuenta, la demo.
- **La cuenta demo no aceptó los términos** (`terminos_version` nulo). La primera vez que publique, avise o denuncie después del merge, la app le va a pedir aceptarlos. Es lo esperado.
- **Perdidos que se borran con la cuenta.** Si una familia borra su cuenta con el perdido todavía abierto, se pierde también lo que otros vieron de ese animal. Es la regla pedida: sin familia nadie puede cerrar el caso ni confirmar coincidencias. La pantalla lo avisa antes de confirmar.
- **Seguimos de antes:**
  - términos y privacidad en borrador;
  - servicio de visión sin configurar: 5 fotos esperando en `cola_vision`;
  - confirmar en Vercel que `EXPO_PUBLIC_MAP_STYLE_URL` no apunte a Liberty;
  - tokens de push que quedan a nombre del usuario anterior en un teléfono compartido (solo app nativa).
