# Plantillas de mail de Supabase Auth

Estos archivos son la fuente de verdad de los mails que manda Supabase Auth con el SMTP propio (Gmail, remitente "Spot"). Si cambiás un texto, cambialo acá y volvé a cargarlas.

| Archivo | Plantilla de Supabase | Asunto | Cuándo se manda |
| --- | --- | --- | --- |
| `confirmacion.html` | Confirm signup (`confirmation`) | Confirmá tu cuenta en Spot | Al crear una cuenta con email. |
| `recuperacion.html` | Reset password (`recovery`) | Elegí una contraseña nueva para Spot | En "¿Olvidaste tu contraseña?". |
| `cambio_email.html` | Change email address (`email_change`) | Confirmá el cambio de email en Spot | Al cambiar el email de una cuenta. Llega a las dos direcciones: el cambio pide confirmar desde las dos (Secure email change, activado). La app todavía no ofrece cambiar el email. |
| `enlace_magico.html` | Magic link (`magic_link`) | Tu link para entrar a Spot | La app no lo usa. Lo manda el botón "Send magic link" del panel de Supabase. |

- **El asunto** está en el `<title>` de cada archivo y en `supabase/config.toml` (`[auth.email.template.*]`). `__tests__/marca.test.ts` comprueba que sean iguales.
- **El formato** sirve para Gmail y el celular: tablas, estilos en línea y nada externo (ni imágenes ni fuentes). Los colores son de la paleta clara de `src/constants/tema.ts`, y la prueba también lo comprueba.
- **Variables de Supabase:** `{{ .ConfirmationURL }}` (el link, que vence en una hora: `mailer_otp_exp`), y en el cambio de email, `{{ .Email }}` y `{{ .NewEmail }}`.
- **Sin el nombre público:** los mails no dicen el nombre que la persona puso al registrarse. Cualquiera puede crear una cuenta con el email de otro y un "nombre" con un link, y así lo mandaríamos nosotros.

## Cargarlas en el proyecto

Con la API de gestión, desde la raíz del repo (el token es uno personal de supabase.com → Account → Access Tokens; no lo guardes en ningún archivo):

```bash
node scripts/plantillas-mail.js > /tmp/plantillas.json
read -rs SUPABASE_ACCESS_TOKEN && export SUPABASE_ACCESS_TOKEN
curl -sS -X PATCH "https://api.supabase.com/v1/projects/bwqvuttuodwypwxckxgf/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/plantillas.json > /dev/null && echo cargadas
unset SUPABASE_ACCESS_TOKEN
```

O a mano: en Supabase, **Authentication → Emails → Templates**, cada plantilla con su asunto y el HTML entero del archivo.

## Verlas

Abrí el archivo en el navegador: se ve como llega, con `{{ .ConfirmationURL }}` en lugar del link. Para probar el envío real, pedí "¿Olvidaste tu contraseña?" con una cuenta tuya (`docs/PRUEBAS-MANUALES.md`, "Mails").
