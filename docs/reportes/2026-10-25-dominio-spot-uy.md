# La dirección del sitio pasa a spot-uy.vercel.app · 2026-10-25

## 1. Resumen

**Qué se pidió:**
- El sitio cambió de `animales-blue.vercel.app` a `spot-uy.vercel.app`. El dueño ya lo cambió en Vercel, con la vieja redirigiendo a la nueva, y actualizó la Site URL y las Redirect URLs de Supabase.
- Cambiar en el repo solo lo necesario.
- Anotar en `DECISIONES.md` que la dirección vieja tiene que redirigir para siempre.
- Dejar los pasos del cierre: la variable en Vercel, la redirección y Google Cloud.

**Qué se hizo:**
- **Doce apariciones en ocho archivos vigentes**, cambiadas por `spot-uy.vercel.app`:
  - el valor por defecto de los links (`src/lib/env.ts`);
  - el contacto de la función `avisar`;
  - `.env.example`, el README, la arquitectura, las decisiones, las pruebas manuales y el README de las plantillas de mail.
- **Lo que no se tocó:** los reportes viejos de `docs/reportes/` (son el registro de lo que se hizo en su momento).
- **Lo que no nombra el dominio:** la vista previa, el manifest, las plantillas de mail, los encabezados de seguridad (`vercel.json`) y las pruebas. No hubo que cambiarlos.
- **La decisión nueva en `DECISIONES.md`.**
- **Comprobado, solo lectura:**
  - la dirección vieja redirige conservando la ruta y los parámetros;
  - la nueva sirve la app con todos los encabezados;
  - en Supabase, la Site URL y las Redirect URLs ya tienen la nueva.

## 2. Cambios

| Archivo | Qué cambió |
| --- | --- |
| `src/lib/env.ts` | El sitio por defecto de los links (`ENV.siteUrl`), cuando no está `EXPO_PUBLIC_SITE_URL`. **Es el que usa producción hoy**, porque esa variable no existe en Vercel. |
| `supabase/functions/avisar/index.ts` | El contacto que la función le da al servicio de push cuando no está el secreto `VAPID_SUBJECT`. Rige recién en el próximo deploy de la función. |
| `.env.example` | El ejemplo y el valor por defecto de `EXPO_PUBLIC_SITE_URL`. |
| `README.md` | La variable y el `curl` de la vista previa. |
| `docs/ARQUITECTURA.md` | El sitio por defecto de los links. |
| `docs/DECISIONES.md` | El sitio por defecto (compartir) y la Site URL (plantillas). Además, la decisión nueva: "El sitio pasa a spot-uy.vercel.app; la dirección vieja redirige para siempre". |
| `docs/PRUEBAS-MANUALES.md` | La web donde se prueba y el link de confirmación. |
| `supabase/templates/README.md` | La Site URL de producción. |

**Revisado y sin cambios:**
- **`vercel.json`:** la CSP usa `'self'` y no nombra el dominio.
- **`public/manifest.webmanifest` y `public/index.html`:** usan rutas relativas.
- **Las plantillas de mail:** usan `{{ .SiteURL }}`, así que toman la nueva de Supabase.
- **`api/vista-previa.ts`:** usa `ENV.siteUrl`.
- **Las pruebas:** jest usa `https://spot.test` y el e2e, el sitio local que arma (`http://localhost:<puerto>`).
- **El build web:** sale con la dirección nueva y sin la vieja (se buscó en los bloques de `dist/`).

## 3. Verificaciones

| Verificación | Resultado |
| --- | --- |
| `npm run typecheck` | Sin errores. |
| `npm run lint` | Sin errores ni avisos. |
| `npm run test` | 31 suites, 341 pruebas. |
| `npx expo export -p web` | Bien. |
| `deno test --allow-env`, `deno lint` y `deno fmt --check` en `supabase/functions/avisar` | 25 pruebas; lint y formato sin observaciones. Deno 2.9.6, instalado desde npm porque este contenedor no lo tenía. |
| Redirección, con la herramienta de Vercel | `https://animales-blue.vercel.app/animal/<id>?origen=prueba` responde **307** a `https://spot-uy.vercel.app/animal/<id>?origen=prueba`: conserva la ruta y los parámetros. |
| Dirección nueva | `https://spot-uy.vercel.app/auth/confirmar?...` responde 200 con el `index.html` de la app, la CSP en modo reporte, `X-Frame-Options`, `nosniff`, `Referrer-Policy` y `Permissions-Policy`. |
| Dominios del proyecto en Vercel | `spot-uy.vercel.app`, y `animales-blue.vercel.app` con `redirect: spot-uy.vercel.app` y código 307. |
| Variables de Vercel (sin descifrar) | **No existe `EXPO_PUBLIC_SITE_URL`.** Están las de Supabase y la VAPID pública. |
| Supabase Auth (solo lectura) | Site URL `https://spot-uy.vercel.app`. Redirect URLs: `https://animales-blue.vercel.app/**`, `http://localhost:8081/**`, `spotmvd://**` y `https://spot-uy.vercel.app/**`. Google prendido; captcha apagado. |

## 4. Pasos manuales (el cierre)

1. **`EXPO_PUBLIC_SITE_URL` en Vercel.** En Project → Settings → Environment Variables, agregá `EXPO_PUBLIC_SITE_URL` = `https://spot-uy.vercel.app`, sin barra al final, para **Production** y **Preview**.
   - Hoy no existe. Los links salen del valor por defecto del código, que este PR cambia a la nueva.
   - La variable se lee al armar el build. Si la agregás antes de mergear, el deploy del merge ya la usa. Si la agregás después, hacé **Redeploy** del último deploy de producción.
   - En las previews también va la de producción: los links compartidos desde una preview llevan al sitio publicado.
   - Para comprobar: en el sitio publicado, compartí un caso y mirá que el link empiece con `https://spot-uy.vercel.app/animal/`.
2. **Que la vieja redirija conservando la ruta, para siempre.**
   - **Hoy redirige con 307 (temporal) y conserva la ruta y los parámetros.** Como el cambio es para siempre, conviene pasarla a **308 (permanente)**: Settings → Domains → `animales-blue.vercel.app` → Edit → redirect a `spot-uy.vercel.app` con 308. Así los navegadores y los bots de vista previa la recuerdan.
   - **Para confirmarlo,** esto tiene que dar 307 o 308 y un `location` con la misma ruta y los mismos parámetros en la dirección nueva:
     ```bash
     curl -sI "https://animales-blue.vercel.app/animal/<id>?prueba=1" | grep -iE '^(HTTP|location)'
     curl -sI "https://animales-blue.vercel.app/reencuentros/<id>" | grep -iE '^(HTTP|location)'
     ```
   - Pegá un link viejo de un caso en WhatsApp: tiene que mostrar la vista previa del caso.
   - **No borres `animales-blue.vercel.app` del proyecto** (ver `docs/DECISIONES.md`).
3. **Google Cloud,** el cliente OAuth del ingreso con Google:
   - **Credenciales** (APIs & Services → Credentials → el cliente "Web application"):
     - la **Authorized redirect URI** no cambia: sigue siendo `https://bwqvuttuodwypwxckxgf.supabase.co/auth/v1/callback`;
     - si en **Authorized JavaScript origins** está `https://animales-blue.vercel.app`, agregá `https://spot-uy.vercel.app`. La vieja se puede sacar más adelante: con la redirección, la app ya no corre ahí.
   - **Branding** (Google Auth Platform, la pantalla de consentimiento):
     - la página de inicio: `https://spot-uy.vercel.app`;
     - la política de privacidad: `https://spot-uy.vercel.app/legal/privacidad`;
     - los términos: `https://spot-uy.vercel.app/legal/terminos`;
     - en **Authorized domains**, sumá `spot-uy.vercel.app`.
   - **Si la app de Google ya está publicada o verificada,** cambiar el branding puede pedir verificarla de nuevo. En modo de prueba, no.
   - **Para probar:** en el sitio nuevo, **Ingresar → Continuar con Google** tiene que volver a `https://spot-uy.vercel.app` con la sesión abierta.
4. **Opcionales:**
   - **Función `avisar`:** si el secreto `VAPID_SUBJECT` tiene la dirección vieja, cambialo:
     ```bash
     npx supabase secrets set VAPID_SUBJECT=https://spot-uy.vercel.app --project-ref bwqvuttuodwypwxckxgf
     ```
     El valor por defecto nuevo del código entra en el próximo deploy de la función. No es urgente: es solo el contacto para el servicio de push, y la vieja redirige.
   - **Captcha:** si lo configurás (hoy está apagado), en Cloudflare Turnstile → el widget → **Hostname management** va `spot-uy.vercel.app`.
   - **Supabase:** la Redirect URL vieja (`https://animales-blue.vercel.app/**`) puede quedar; no molesta.

## 5. Pendientes y riesgos

- **Lo que depende del origen no viaja con la redirección.** La sesión, la app instalada y el permiso de notificaciones son de cada dirección. Quien usó la vieja:
  - vuelve a ingresar en la nueva;
  - si la había instalado, la instala de nuevo;
  - para las notificaciones, las activa de nuevo.
- **Notificaciones duplicadas.** Las suscripciones creadas desde la dirección vieja siguen en `suscripciones_push` y el navegador las puede seguir mostrando. Si esa persona las activa también en la nueva, le pueden llegar dos avisos iguales.
  - Como la app todavía no es pública, son pocas.
  - Si molesta, se pueden borrar las suscripciones de antes del cambio (`delete from suscripciones_push where created_at < '<fecha del cambio>';`). Cada uno las vuelve a activar.
  - No lo hice: cambia datos de producción.
- **Los mails que ya salieron** llevan a `https://animales-blue.vercel.app/auth/confirmar?...`. Con la redirección siguen andando mientras no venzan. Los nuevos ya salen con la Site URL nueva.
- **La rama:** este commit va en `claude/animales-repo-mxm2ja`, encima de la privacidad de los casos reunidos (PR #20, sin mergear). GitHub permite un solo PR abierto por rama, así que se suma a ese PR. El cambio de dirección no depende de la privacidad: si lo querés mergear antes, se puede pasar a una rama aparte desde `main`.
