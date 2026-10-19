# Cierre de la Fase 5 · 2026-10-19

## 1. Resumen

**Qué se pidió.** Cerrar la Fase 5 en este orden:
1. Aplicar la migración 0008 en Supabase y registrarla en el historial.
2. Correr en la base real el script de pruebas de permisos.
3. Cambiar la contraseña pública de la cuenta demo por una aleatoria.
4. Escribir este reporte.
5. Abrir y mergear el PR contra `main`.
6. Confirmar el deploy de producción en Vercel.

El código de la rama (`e0c8227`, `2b6eea6` y `fa41849`) ya estaba revisado y aprobado.

**Qué se hizo** (pasos 1 a 3, sobre el proyecto Supabase `bwqvuttuodwypwxckxgf`):
- **Paso 1:** la 0008 quedó aplicada y registrada. El historial queda de 0001 a 0008, sin duplicados.
- **Paso 2:** el script corrió sin errores y no dejó datos.
- **Paso 3:** la cuenta demo tiene una contraseña nueva, aleatoria y fuerte. La cuenta y sus animales siguen intactos.

Los pasos 5 y 6 se hacen después de este commit, y su resultado se informa en el mensaje final de la sesión.

## 2. Cambios

**En el repo:**

| Archivo | Por qué |
|---|---|
| `docs/reportes/2026-10-19-cierre-fase-5.md` | Este reporte. No hay cambios de código. |

**En Supabase**, proyecto `bwqvuttuodwypwxckxgf`:

**Paso 1 · migración 0008.**
- Se ejecutó `supabase/migrations/20261019000008_correcciones.sql`, idéntico al commiteado. En el mismo pedido se insertó su fila en `supabase_migrations.schema_migrations`, con versión `20261019000008` y nombre `correcciones`. El pedido es atómico: si fallaba algo, no quedaba nada aplicado.
- **Antes:**
  - historial de `20261017000001` a `20261019000007`, 7 filas;
  - `authenticated` podía insertar `mensajes.leido_en` y `denuncias.estado`.
- **Después:**
  - historial de `20261017000001_base` a `20261019000008_correcciones`, con 8 filas y 8 versiones distintas;
  - `authenticated` ya no puede insertar `mensajes.leido_en` ni `denuncias.estado`, pero sigue pudiendo insertar `mensajes.cuerpo` y `denuncias.motivo`;
  - `anon` no puede insertar en `mensajes`.

**Paso 2 · script de pruebas.**
- Es el script de la sección 4 de `2026-10-19-correcciones.md`, extraído del reporte y comparado byte a byte con el que se había validado en local.
- Corrió sobre la base real y terminó sin errores. Comprobó que un usuario común:
  1. no puede hacerse moderador;
  2. no puede insertar en `cambios_estado`;
  3. no puede editar el cuerpo de un mensaje ajeno;
  4. sí puede marcar como leído un mensaje recibido;
  5. puede publicar con `publicar_animal`.
- Que haya pasado demuestra que la simulación corrió de verdad como `authenticated`: como `postgres`, la prueba 1 habría fallado.
- No dejó datos. Conteos antes y después:

  | | usuarios | perfiles | moderadores | animales | avistamientos | cambios_estado | conversaciones | mensajes | notificaciones | seguimientos | cola_vision | usuarios de prueba |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|
  | Antes | 1 | 1 | 0 | 3 | 4 | 0 | 0 | 0 | 0 | 3 | 4 | 0 |
  | Después | 1 | 1 | 0 | 3 | 4 | 0 | 0 | 0 | 0 | 3 | 4 | 0 |

**Paso 3 · cuenta demo** (`demo@encontrados.uy`).
- **Antes de cambiarla:** nadie había entrado nunca (`last_sign_in_at` vacío, 0 sesiones y 0 refresh tokens activos), así que no hubo sesiones que cerrar.
- **El cambio:**
  - contraseña de 24 caracteres generada con `secrets` de Python, con mayúsculas, minúsculas, dígitos y `-_.~`;
  - aplicada con `extensions.crypt(<contraseña>, extensions.gen_salt('bf'))` sobre `auth.users.encrypted_password`;
  - se actualizó exactamente una fila, con hash bcrypt (`$2a$`).
- **Verificación en la base:** el hash coincide con la contraseña nueva y ya no coincide con `demo1234`.
- **No se borró** la cuenta, su perfil ni sus 3 animales.
- **Dónde quedó la contraseña:** se generó en memoria y no está en ningún archivo, commit ni en este reporte. El dueño la recibió en el mensaje final de la sesión.

## 3. Verificaciones

| Comando | Resultado |
|---|---|
| `npm run typecheck` | OK (exit 0) |
| `npm run lint` | OK (exit 0) |
| `npx expo export -p web` | OK, `Exported: dist` (exit 0) |

**Sin verificar:** el login real de la cuenta demo contra Supabase Auth (`/auth/v1/token`). La red de esta sesión bloquea `*.supabase.co` (403 del proxy). La contraseña se verificó solo contra el hash en la base.

## 4. Pasos manuales

1. **Probar el login de la cuenta demo** en https://animales-blue.vercel.app, con `demo@encontrados.uy` y la contraseña nueva.
2. **Si la web va a estar abierta al público:** configurar un SMTP propio en **Authentication → Emails → SMTP Settings**. El servidor gratuito de Supabase manda 2 mails por hora.
3. **Opcional:** revocar el token de la cuenta vieja de Supabase en `supabase.com/dashboard/account/tokens`, si no se usa más.
4. **Si la contraseña de la demo se filtra otra vez,** se cambia así:
   ```sql
   update auth.users
   set encrypted_password = extensions.crypt('<nueva contraseña>', extensions.gen_salt('bf')),
       updated_at = now()
   where email = 'demo@encontrados.uy';
   ```

## 5. Pendientes y riesgos

- **`supabase/seed.sql` todavía dice `demo1234`.** Ya no vale en producción, pero si alguien vuelve a correr el seed sobre una base nueva, esa base queda con la contraseña pública. Conviene que el seed reciba la contraseña por parámetro o que documente cambiarla después de cargarlo.
- **Fuera de alcance:**
  - Fase 6: quién marca un caso como reunido y quién confirma coincidencias.
  - Fase 7: 3 denuncias de cuentas nuevas alcanzan para ocultar una publicación.
- **Encontrados, sin corregir:**
  - tokens de push que quedan a nombre del usuario anterior en un teléfono compartido (solo afecta a la app nativa);
  - `publicar_animal` acepta una URL externa como foto.
