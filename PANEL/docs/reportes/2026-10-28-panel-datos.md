# Panel de SPOT: datos de la app, Supabase, el reconocimiento y Vercel · 2026-10-28

## 1. Resumen

**Qué se pidió:** "resolvé todos los pendientes". Las tarjetas de La app, Vercel y Supabase estaban en **Pendiente**.

**Qué se hizo:** las dos integraciones del plan (`DISEÑO.md`, sección 9):

| Integración | De dónde salen los datos | Tarjetas |
| --- | --- | --- |
| Datos internos | `admin_resumen()` (migración 0028), con el token de quien entró | Las seis de La app, Supabase y el servicio de visión |
| Vercel | La API de Vercel, con `VERCEL_API_TOKEN` | El último deploy de producción de la app y el vencimiento del token |

Cada tarjeta muestra sus números, con los umbrales de Atención y Falla de la sección 3.4. Si algo sale de esos umbrales, aparece en "Necesita atención" con su motivo y su botón.

**El servicio de visión** ahora es la función `reconocer`, mirada desde la base. Así quedó resuelta la decisión 1. Se sacaron `LINK_VISION_URL` y la parte "Servicio de visión" de la configuración.

**Qué falta para verlo en producción:**
1. aplicar la migración 0028 en Supabase y cargar la cuenta en `administradores`;
2. desplegar el panel (merge del PR).

El control de permisos de la sesión frenó el cambio en la base de producción. Los pasos están en la sección 4. Mientras tanto, el panel ya desplegado sigue como estaba. Con este código y sin la migración:
- Vercel y el token muestran datos;
- La app y Supabase dicen "Falta aplicar en Supabase la migración 0028".

## 2. Cambios

**Funciones (`api/`):**

| Archivo | Qué cambió |
| --- | --- |
| `api/_fuentes.js` | Nuevo. Lee las dos fuentes y se queda solo con lo que usa el panel: números, fechas en ISO, el estado del deploy, el commit corto y el `inspectorUrl` si es de vercel.com. Cada error vuelve como un código propio (`motivo`), nunca con el mensaje del servicio. <ul><li>**`leerResumen`:** `POST /rest/v1/rpc/admin_resumen`, con el token de la sesión y la clave pública, 5 s de tope y sin redirecciones. Distingue sin la migración (404/PGRST202), cuenta que no está en `administradores` (42501) y Supabase que no responde.</li><li>**`leerVercel`:** `GET /v5/user/tokens/current` y `GET /v7/deployments`, filtrando por `state` para dejar afuera los CANCELED del Ignored Build Step.</li></ul> |
| `api/_tarjetas.js` | Nuevo. Los umbrales (`UMBRALES`, `LIMITES`) y el estado final de cada tarjeta con datos: Pendiente si falta la migración, y Falla sin números si la fuente no responde. |
| `api/_catalogo.js` | Las partes y tarjetas con `fuente` (`resumen` o `vercel`) en lugar de `prompt`. Sin la parte `vision`, `LINK_VISION_URL` ni `migracion`. Cada ítem lleva siempre `motivo` y `datos`. |
| `api/estado.js` | Lee las dos fuentes a la vez (a Vercel, solo si está su token; los deploys, solo con equipo y proyecto) y arma el estado con `conDatos`. |
| `api/_comun.js`, `api/config.js` | Sin `LINK_VISION_URL` ni `urlDeVision`. |

**Página:**

| Archivo | Qué cambió |
| --- | --- |
| `js/datos.js` | `normalizarDatos` valida cada campo de `datos` (enteros ≥ 0, fechas, estados del deploy, commit de 7 caracteres, links solo de vercel.com, 7 días). Un campo con otra forma deja la tarjeta como "No llegó su estado". También: la lista de `MOTIVOS` y la regla nueva de avisos (lo que avisa una parte no se repite en sus tarjetas). |
| `js/vistaDeDatos.js` | Nuevo. El número grande, las líneas de detalle, la gráfica de 7 barras (con `role="img"` y los valores en `aria-label`), las barras de uso, el dato corto de las filas del celular y el vencimiento del token. |
| `js/formato.js` | Nuevo. Números, tamaños (kB, MB y GB decimales) y fechas en es-UY, en la hora de Montevideo. |
| `js/tiempo.js` | "hace N días" y `diasHasta`. |
| `js/componentes.js` | `lineasDeFalta` muestra el motivo, y "Para el link, falta…" también en tarjetas con datos. |
| `js/inicio.js` | Tarjetas con datos (borde continuo), "Ver log en Vercel" como botón primario si falló un deploy, y el botón de cada aviso según de dónde viene. |
| `js/catalogo.js`, `js/enlaces.js` | Sin la parte `vision` ni el link al Space. El servicio de visión lleva a las Edge Functions de Supabase. |
| `i18n/es-UY.js` | `t.motivos` (26 motivos), `t.datos`, "Ver log en Vercel", "hace N días" y las descripciones nuevas. Sin los prompts ya hechos. |
| `estilos.css` | `.datos`, `.dato`, `.dato__etiqueta`, `.dato__linea`, `.dato__estado`, `.uso__bloque`, `.uso__texto` y `.lista__detalle--dato`, solo con las variables de color que ya había. |

**Pruebas y documentación:**

| Archivo | Qué cambió |
| --- | --- |
| `pruebas/api.test.mjs` | Supabase y Vercel falsos. Prueban: <ul><li>el pedido del resumen con el token de la sesión;</li><li>los umbrales de cada tarjeta;</li><li>sin la migración, sin permiso o con Supabase caído;</li><li>los deploys (bien, con error, trabado, ninguno) y los errores de Vercel;</li><li>el token (por vencer, vencido, sin vencimiento, inválido o solo);</li><li>que no salga nada de más.</li></ul> |
| `pruebas/datos.test.mjs` | `normalizarDatos`, la regla de avisos y el formato de números y fechas. |
| `pruebas/catalogo.test.mjs` | Todo motivo que puede mandar el servidor lo conoce la página y tiene su texto. |
| `DISEÑO.md` | Secciones 1, 2, 3.3, 3.4, 4.6, 5, 6.1 a 6.3, 7.2, 9 y 10: las fuentes, los endpoints confirmados, los umbrales, la decisión 1 resuelta y sin `LINK_VISION_URL`. |
| `.env.example` | Sin `LINK_VISION_URL` ni `HF_TOKEN`. Para qué se usa `VERCEL_API_TOKEN`. |
| `propuestas/migracion-admin.sql` | Borrado: pasó a `supabase/migrations/20261028000028_panel_admin.sql` (commit aparte, fuera de `PANEL/`). |
| `docs/reportes/2026-10-28-panel-datos.md` y su carpeta | Este reporte y 5 capturas. |

**Lo confirmado de las APIs:**
- **Vercel, deploys:** `/v7/deployments` es la versión de la documentación actual. La lista trae `readyState`, `createdAt`, `inspectorUrl` y `meta.githubCommitSha`: lo vi en los deploys reales de `animales`, con la herramienta de Vercel de la sesión.
- **Vercel, token:** `expiresAt` viene en milisegundos (documentación de "get auth token metadata").
- **Supabase:** no hace falta `/auth/v1/health`. Si `admin_resumen()` responde, el proyecto responde.

## 3. Verificaciones

**Panel:**

| Verificación | Antes | Después |
| --- | --- | --- |
| `npm run verificar` | 671 comprobaciones bien | 740 bien, 0 problemas |
| `npm run probar` | 22 pruebas | 35 pruebas, todas pasan |
| Navegador (Chromium con Playwright) | — | 68 de 68 bien |

**Cómo se probó en el navegador:**
- el servidor local imita Vercel (archivos, encabezados y `api/`);
- supabase-js es el del paquete de npm, con el hash SRI de verdad;
- Supabase Auth, `admin_resumen()` y la API de Vercel son falsos.

**Escenarios:**
- **Todo bien:** en computadora y celular, claro y oscuro.
- **Con avisos:** deploy con error, token a 6 días de vencer, fotos sin reintentos, una denuncia, Storage en el 87 % y errores de la IA. Da "2 fallas · 4 avisos", en orden, con "Ver log en Vercel".
- **Sin la migración:** tarjetas en Pendiente, sin números y sin el mensaje en inglés.
- **Supabase caído y token de Vercel inválido:** un aviso por parte, no uno por tarjeta.
- **Cuenta que no está en `administradores`.**

**En todos:**
- sin violaciones de CSP (las alturas de las barras van por CSSOM);
- sin errores en la consola;
- sin pedidos a otros sitios;
- sin scroll horizontal;
- todo lo tocable de 44 px o más en el celular;
- el token de Vercel no aparece en la página.

**Raíz:**

| Verificación | Antes (`main`) | Después |
| --- | --- | --- |
| `npm run typecheck` | Sin errores | Sin errores |
| `npm run lint` | Sin errores | Sin errores |
| `npm run test` | 33 suites, 362 pruebas | 33 suites, 362 pruebas |
| `npx expo export -p web` | Bien, `entry-d31c0e98….js` | Bien, el mismo bloque |

## 4. Pasos manuales

1. **Supabase:** aplicar la migración 0028, cargar la cuenta del panel en `administradores` y correr `supabase/tests/panel_admin.sql`. Los pasos exactos, con el SQL, están en `docs/reportes/2026-10-28-panel-datos.md` (el de la raíz), sección 4. Si me lo autorizás, lo hago yo.
2. **GitHub:** mergear el PR de la rama `claude/animales-repo-mxm2ja`. El proyecto `panel` de Vercel despliega solo. El de la app también construye, porque cambian archivos fuera de `PANEL/` (la migración, los tipos y la documentación), pero sale el mismo bundle.
3. **Vercel, proyecto `panel`:** no hay que cambiar variables. `LINK_VISION_URL` ya no se usa, y no estaba cargada.
4. **Probar:** entrá al panel y tocá **Actualizar**.
   - Las tarjetas de La app, Supabase, el servicio de visión, Vercel y el token tienen que mostrar números o fechas.
   - Si "Datos de la app" dice "Tu cuenta no está en la tabla administradores", falta el paso 1.

## 5. Cambios necesarios fuera de `PANEL/`

Hechos en el commit anterior de la misma rama, con las reglas de la raíz y su reporte `docs/reportes/2026-10-28-panel-datos.md`:
- `supabase/migrations/20261028000028_panel_admin.sql`;
- `supabase/tests/panel_admin.sql`;
- `src/types/database.ts`;
- `AGENTS.md`, `README.md` y `supabase/tests/README.md`.

## 6. Librerías y fuentes

Sin cambios: supabase-js 2.117.3 con el mismo SRI, y las mismas fuentes IBM Plex (`docs/reportes/2026-10-28-panel-diseno.md`, sección 6). `Intl` es del navegador y de Node.

## 7. Pendientes y riesgos

- **La migración 0028 no está aplicada** (sección 4.1): hasta entonces, La app y Supabase quedan en Pendiente.
- **El token de Vercel puede hacer más que leer:** Vercel no tiene tokens de solo lectura (sección 6.2). Va solo en el header, solo en la función, y nunca vuelve al navegador.
- **Rutas del dashboard de Supabase todavía a confirmar:**
  - `/functions` del servicio de visión y de "Fotos trabadas";
  - `/editor` de La app.
- **Umbrales:** son la propuesta inicial (decisión 6). Se cambian en `api/_tarjetas.js`, con sus pruebas.
- **"Casos nuevos" en Atención:** pasa con 0 casos en 7 días. En un piloto con poco uso puede aparecer sin que nada esté roto.
- **Siguen esperando:**
  - Facebook, Instagram y LinkedIn: credenciales y la aprobación de LinkedIn;
  - Alertas: el canal (decisión 9).
