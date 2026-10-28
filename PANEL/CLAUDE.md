# PANEL/CLAUDE.md · Panel de SPOT

Reglas para toda tarea dentro del panel de administración. El diseño completo está en `DISEÑO.md`: leelo antes de tocar nada. En las tareas del panel, estas reglas mandan sobre las de la raíz (`/CLAUDE.md` y `/AGENTS.md`) en tres cosas: dónde va el reporte, el commit y el push.

## Límite de carpeta

- Solo se crean, editan o borran archivos dentro de `PANEL/`. Fuera de `PANEL/` no se toca nada, sin excepciones: ni `src/`, ni `supabase/`, ni `docs/`, ni el `package.json` o los lockfiles de la raíz, ni `.gitignore`, `tsconfig.json`, ESLint, Metro, Expo o el `vercel.json` de la raíz, ni el `CLAUDE.md` o el `AGENTS.md` de la raíz.
- Nada importa código de fuera de `PANEL/` (ninguna ruta `../` que salga de la carpeta). Si hace falta algo de la app, se copia dentro de `PANEL/` y se anota de dónde salió, como `fuentes/ORIGEN.md`.
- Fuera de `PANEL/` solo se lee lo que el pedido autorice. Si no dice nada: `AGENTS.md`, el `CLAUDE.md` de la raíz, `supabase/migrations/*.sql` y `src/types/database.ts`.
- Si algo solo se resuelve cambiando un archivo de fuera, no se cambia: se escribe en el reporte el cambio exacto que haría falta.
- La base no se toca desde el panel: nada de migraciones ni SQL. Lo que el panel necesite de la base va como propuesta en `propuestas/`, y se aplica en un pedido aparte con las reglas de la raíz.
- Antes del commit, `git status` muestra cambios solo dentro de `PANEL/`.

## Stack

- **La página:** `index.html`, `estilos.css`, `js/` e `i18n/`, con HTML, CSS y JavaScript sin framework y sin paso de build. Módulos ES del navegador.
- **Única librería del navegador:** `@supabase/supabase-js`, solo para el ingreso y la sesión, desde jsDelivr, con versión exacta y hash SRI. Para cambiar de versión, cambiá a la vez `index.html`, la CSP de `vercel.json` y `DISEÑO.md` (sección 5).
- **Las funciones:** `api/*.js`, con el runtime de Node de Vercel, `export function GET(request)` con Request y Response estándar, sin dependencias y con `fetch`.
  - Lo compartido va en `api/_*.js`: Vercel no publica como función un archivo de `api/` que empieza con `_`.
- **Dependencias:** ninguna, ni en la raíz ni en `PANEL/`. `package.json` es mínimo: `"type": "module"` y los scripts de verificación.
- **Fuentes:** IBM Plex Sans y Mono en woff2, en `fuentes/`, con su licencia (SIL OFL 1.1) y `ORIGEN.md`.
- **Licencias:** solo permisivas (MIT, Apache 2.0, BSD; para fuentes, SIL OFL 1.1). Nada AGPL.
- **Nada local:** sin Docker. El panel se prueba con `node --test` y en el navegador.

## Seguridad (detalle en `DISEÑO.md`, sección 5)

**La página:**
- El HTML y el JavaScript de la página son públicos: no llevan secretos, datos ni valores reales de configuración. Todo lo sensible sale de `api/`, después de validar la sesión.
- Todo dato de una API se inserta con `textContent`. Nunca `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval` ni `new Function`.
- Los links se validan antes de ponerlos en un `href`: solo `https:` y los dominios esperados.

**Las funciones:**
- Cada función de `api/` valida el token contra Supabase Auth (`/auth/v1/user`, la clave pública solo en `apikey`) y compara el id con `ADMIN_USER_IDS`: 401 si la sesión no sirve, 403 si la cuenta no está.
  - Única excepción: `api/config` sin sesión, que da solo lo que la app ya publica (la URL y la clave pública de Supabase) y los nombres de las variables que faltan para entrar.
- **Nunca la clave `service_role` ni la secret (`sb_secret_…`) de Supabase,** ni ahora ni como plan. La base se lee con el token de quien entró, y decide la base (`administradores`, `admin_resumen()`).
- Las variables se leen una por una, por su nombre. Nunca por patrón (`Object.keys(process.env)`, `...process.env`).
- De un secreto se dice solo si está, si falta o si no sirve: nunca su valor.
- Nunca se devuelve el mensaje de error de otro servicio.
- **Los secretos** viven solo en las variables del proyecto del panel en Vercel (Sensitive, solo Production). Toda variable nueva se suma a `.env.example` (sin valor, con para qué sirve y si es secreta), a `api/_comun.js` (su validación) y a `DISEÑO.md`.

**Lo que se muestra:**
- Solo conteos, estados y tendencias. Ni nombres, ni emails, ni mensajes, ni ubicaciones, ni descripciones, ni el texto de las publicaciones de las redes.
- El panel no se indexa: `robots.txt`, la meta `noindex` y el header `X-Robots-Tag`.
- **Encabezados de `vercel.json`:** si sumás un origen (otro CDN, otra API desde el navegador), actualizá la CSP. Lo normal es que la API se llame desde la función, no desde el navegador.

**Datos reales:**
- Sin conectarse con credenciales a Supabase, Vercel, Meta, LinkedIn ni Hugging Face, salvo que el pedido lo autorice.
- Sin leer archivos `.env` de ningún lado.
- Sin usar `supabase/seed.sql`.

## Diseño

- Todo lo visual sigue `DISEÑO.md`, sección 4: colores, tipografía, formas, componentes y pantallas.
- **Colores:** ningún color se escribe fuera de las variables de `:root` en `estilos.css`, con su versión oscura en `prefers-color-scheme: dark`. Única excepción: `favicon.svg`.
- **Estados:** siempre con color, ícono y texto. Una tarjeta sin datos no muestra números, ni ceros, ni gráficas vacías.
- **Textos:** todo texto visible sale de `i18n/es-UY.js`, en español rioplatense con voseo ("entrá", "revisá"), nunca "tú". Las únicas excepciones son el `<title>` y el aviso sin JavaScript de `index.html`, que dicen lo mismo que `t.documento.titulo` y `t.general.sinJavascript`.
- **Íconos:** SVG de trazo del sprite de `index.html`, siempre `aria-hidden`. Nada de emojis.
- **Tamaños:** todo lo que se toca mide 44 px o más. Funciona en la computadora y en el celular (hasta 760 px).

## Verificaciones

Antes de empezar y al terminar, y todo va al reporte.

**En `PANEL/`:**
- `npm run verificar` (`node herramientas/verificar.mjs`). Revisa:
  - `node --check` de cada archivo JavaScript;
  - los colores contra `DISEÑO.md`;
  - que no haya secretos ni valores reales;
  - los textos de `index.html`;
  - el hash de cada fuente;
  - que no haya `innerHTML` ni importaciones de fuera.
- `npm run probar` (`node --test pruebas/*.test.mjs`): las funciones con un Supabase Auth falso y la lógica de la página. Toda regla nueva suma su prueba.
- **En el navegador:** las pantallas que se tocaron, en computadora y celular, claro y oscuro, sin errores ni violaciones de CSP en la consola.

**En la raíz:** `npm run typecheck`, `npm run lint` y `npx expo export -p web`. Si faltan dependencias, `npm ci`, nunca `npm install`. Si alguna pasaba antes y falla por algo de `PANEL/`, no se arregla fuera de la carpeta: se escribe en el reporte el cambio exacto que haría falta.

**Archivos sueltos:** si un comando deja archivos fuera de `PANEL/` que git no ignora, no van al commit y se anotan en el reporte.

## Reporte, commit y push

- **El reporte** va en `PANEL/docs/reportes/AAAA-MM-DD-<tema>.md`, no en `docs/reportes/` de la raíz, en el mismo commit. Lleva estas secciones:
  - resumen;
  - cambios por archivo;
  - verificaciones del panel y de la raíz, antes y después;
  - pasos manuales exactos (Vercel, Supabase, cada red);
  - cambios necesarios fuera de `PANEL/`, con su contenido exacto;
  - librerías y fuentes, con versión, hash y licencia;
  - pendientes y riesgos.

  Terminá mostrando su ruta.
- **Un solo commit** por tarea, solo con archivos de `PANEL/`.
- **Sin push** ni PR, salvo que el pedido lo diga.
