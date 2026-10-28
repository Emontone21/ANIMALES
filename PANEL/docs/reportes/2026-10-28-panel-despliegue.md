# Panel de SPOT: despliegue en Vercel · 2026-10-28

## 1. Resumen

**Qué se pidió:** hacer todo lo posible desde la sesión para que el panel funcione: subirlo, mergearlo, configurar el proyecto de Vercel y desplegarlo.

**Qué se hizo:**
- **Código:**
  - se subió la rama y se abrió el PR [Emontone21/ANIMALES#23](https://github.com/Emontone21/ANIMALES/pull/23);
  - con la vista previa en READY, se mergeó con merge commit (`72e224e`).
- **Captcha:** está apagado en Supabase Auth (lectura de la configuración por la API de gestión). El ingreso con contraseña del panel no lo necesita.
- **Proyecto de la app (`animales`):** se le puso el Ignored Build Step de `DISEÑO.md`, sección 7.3. El deploy del merge del panel se canceló solo ("returned exit code 0"), así que la app quedó en el mismo deploy de antes.
- **Proyecto del panel:**
  - la conexión de Vercel de la sesión no tenía permiso para crear proyectos (403), así que lo creó el dueño, con el nombre `panel`;
  - el dueño amplió el permiso de la conexión, y después se corrigieron sus ajustes:
    - Root Directory `PANEL` (venía con otra carpeta y el primer deploy falló);
    - preset Other, sin build y el Ignored Build Step;
  - se cargaron las seis variables de ingreso y links, solo en Production, con `ADMIN_USER_IDS` como Sensitive;
  - se lanzó el deploy de producción, que quedó **READY** en 6 segundos.
- **Comprobado en el sitio publicado:**
  - `/api/config` da la configuración y no le falta ninguna variable;
  - `/api/estado` responde 401 sin sesión;
  - todos los encabezados de seguridad están;
  - lo que `.vercelignore` deja afuera da 404.

## 2. Cambios

**En el repo**, solo `PANEL/`:
- `DISEÑO.md`:
  - sección 5: `.vercelignore` se aplica también en los deploys desde Git; antes estaba a confirmar y ahora está comprobado;
  - sección 7.1: un aviso sobre el Root Directory que propone Vercel al importar.
- `docs/reportes/2026-10-28-panel-despliegue.md`: este reporte.

**Fuera del repo:**

| Dónde | Qué |
| --- | --- |
| GitHub | PR #23 mergeado con merge commit, `72e224e` en `main`. |
| Vercel, proyecto `animales` | `commandForIgnoringBuildStep`: `[ -n "$VERCEL_GIT_PREVIOUS_SHA" ] && [ "$VERCEL_GIT_PREVIOUS_SHA" != "$VERCEL_GIT_COMMIT_SHA" ] && git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . ':(exclude)PANEL'`. |
| Vercel, proyecto `panel` | Root Directory `PANEL`, Framework Other, Build Command vacío, sin archivos de fuera del Root Directory y el Ignored Build Step `[ -n "$VERCEL_GIT_PREVIOUS_SHA" ] && [ "$VERCEL_GIT_PREVIOUS_SHA" != "$VERCEL_GIT_COMMIT_SHA" ] && git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- .`. |
| Vercel, variables de `panel` (Production) | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `ADMIN_USER_IDS` (Sensitive), `LINK_APP_URL`, `LINK_VERCEL_TEAM` y `LINK_VERCEL_PROJECT`, cada una con un comentario. |
| Vercel, deploy de `panel` | De producción, desde `main` (`72e224e`): READY. |

**De dónde salió cada valor:**
- **La clave pública:** la API de gestión de Supabase, filtrando solo la de tipo `publishable` (las demás no se imprimieron).
- **El id de `ADMIN_USER_IDS`:** se buscó por el email que dio el dueño. Es el de su cuenta y no se escribe acá.

## 3. Verificaciones

**Raíz y panel**, sobre `main` `72e224e` más este cambio de documentación. Antes del cambio eran los mismos resultados del reporte de diseño.

| Verificación | Resultado |
| --- | --- |
| `npm run typecheck` | Sin errores. |
| `npm run lint` | Sin errores. |
| `npm run test` | 33 suites y 362 pruebas, todas pasan. |
| `npx expo export -p web` | Termina bien, con el mismo bloque `entry-d31c0e98….js` que antes. |
| `node herramientas/verificar.mjs` | 671 comprobaciones bien, 0 problemas (incluye este reporte: sin valores reales). |
| `node --test pruebas/*.test.mjs` | 22 pruebas, todas pasan. |

**En producción** (con la herramienta de Vercel; desde la sesión no se llega a `vercel.app`):

| Pedido | Resultado |
| --- | --- |
| `/` | 200, la página del panel. |
| `/api/config` sin sesión | 200: URL y clave pública de Supabase, sin variables faltantes ni inválidas. Con `cache-control: no-store` y `vary: Authorization`. |
| `/api/estado` sin sesión | 401. |
| `/DISEÑO.md`, `/CLAUDE.md`, `/propuestas/migracion-admin.sql`, `/.env.example` | 404. |
| `/api/_comun` | 404: no es una función. |
| `/robots.txt` | 200, `Disallow: /`. |
| `/fuentes/IBMPlexSans-Regular-Latin1.woff2` | 200, `font/woff2`, 20 984 bytes. |
| Encabezados en todas | CSP, `X-Robots-Tag`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `nosniff`, COOP, `Permissions-Policy` y HSTS (de Vercel). |

**Deploys:**
- **`animales`, merge del panel:** cancelado por el Ignored Build Step. La app sigue en el deploy anterior.
- **`panel`, primer intento** (creado desde el dashboard): ERROR. Usó otra carpeta como Root Directory, corrió `npx expo export` y no encontró `package.json`.
- **`panel`, después de corregir los ajustes:** READY.
- **`panel`, redeploy para aplicar `VERCEL_API_TOKEN`** (la cargó el dueño): primero se **canceló**. El Ignored Build Step comparaba el commit consigo mismo, veía un diff vacío y salía con 0.
  - Se corrigió el comando en los dos proyectos: ahora solo compara si el commit cambió (`"$VERCEL_GIT_PREVIOUS_SHA" != "$VERCEL_GIT_COMMIT_SHA"`).
  - Se repitió el redeploy: **READY**, con la variable nueva.

## 4. Pasos manuales

1. **Contraseña para la cuenta de administración.** La cuenta elegida entra solo con Google y no tiene contraseña, y el panel pide email y contraseña.
   - En la app, **Ingresar → "¿Olvidaste tu contraseña?"** con ese email; abrí el mail y elegí una.
   - Se puede seguir entrando a la app con Google.
2. **Entrar al panel** con la dirección de producción del proyecto `panel` (la que muestra Vercel en el proyecto). Comprobá:
   - que se vea el ingreso;
   - que la consola del navegador no tenga errores, sobre todo ninguno de "integrity" del archivo de jsDelivr;
   - que al entrar aparezca el Inicio, con las tarjetas en Pendiente o Sin configurar;
   - que con otra cuenta aparezca "Acceso denegado".
3. **Opcional:** cargar `LINK_FACEBOOK_URL`, `LINK_INSTAGRAM_URL` y `LINK_LINKEDIN_URL` en el proyecto `panel` (Production) y hacer Redeploy, para que funcionen los links de Redes.

## 5. Cambios necesarios fuera de `PANEL/`

Ninguno en el repo. Los de Vercel y GitHub ya están hechos (sección 2).

## 6. Librerías y fuentes

Sin cambios: supabase-js 2.117.3 con el mismo SRI y las mismas fuentes IBM Plex (`docs/reportes/2026-10-28-panel-diseno.md`, sección 6).

## 7. Pendientes y riesgos

- **SRI con jsDelivr:** no se pudo comprobar desde la sesión, porque no llega a jsDelivr ni a `vercel.app`. Lo confirma el paso 4.2: si el navegador rechazara el archivo, el ingreso diría "No se pudo cargar lo necesario para entrar".
- **Las vistas previas de `panel`** usan la protección de Vercel del equipo y no tienen variables, así que no se puede entrar. Es lo previsto.
- **El nombre del proyecto** quedó `panel`, como lo creó el dueño, y la dirección es la que asignó Vercel.
- **La conexión de Vercel de Claude** necesita acceso a los dos proyectos para los prompts siguientes (por ejemplo, para leer los deploys de `animales`).
- **Lo de siempre del panel:** las decisiones abiertas de `DISEÑO.md`, sección 10, y la migración de administradores, que se aplica en el prompt "Datos internos".
