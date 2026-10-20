# Cierre de las mejoras

Rama `claude/animales-repo-mxm2ja`, PR #9 (commit aprobado: `d3f3f95`). Proyecto de Supabase `bwqvuttuodwypwxckxgf`. 20 de octubre de 2026.

## 1. Resumen

**Qué se pidió:** cerrar la tarea de mejoras (hoja plegable, instalar la app y reportar un error), con el commit `d3f3f95` ya revisado y aprobado:
1. Aplicar la 0015 sola y después la 0016 en producción, registrarlas y correr las comprobaciones del reporte de mejoras.
2. Correr en la base real `errores.sql` y las seis pruebas anteriores, sin errores y sin dejar datos.
3. Hacer moderadora la cuenta del dueño del proyecto.
4. Escribir este reporte y subirlo a la rama.
5. Mergear el PR con merge commit.
6. Confirmar el deploy de producción.

**Qué se hizo** (pasos 1 a 3; los pasos 5 y 6 van después de este commit):

- **0015 y 0016 aplicadas y registradas.** El historial quedó de 0001 a 0016, sin duplicados. Las comprobaciones de la sección 4, paso 1, de `docs/reportes/2026-10-20-mejoras.md` dan lo esperado. Lo aplicado es idéntico a lo probado en local: coinciden los hashes de las funciones, la vista y las políticas.
- **Las siete pruebas pasan en producción** sin dejar datos. Una copia alterada a propósito falla donde corresponde, así que un error no habría pasado inadvertido.
- **La cuenta del dueño es moderadora:** se actualizó una sola fila. El email no está en este reporte ni en ningún archivo.

## 2. Cambios

| Dónde | Qué |
| --- | --- |
| Supabase, proyecto `bwqvuttuodwypwxckxgf` | **0015:** `supabase/migrations/20261020000015_tipo_notificacion_error.sql`, sacada del commit `d3f3f95`, sola, en una petición a la Management API (una transacción) junto con su registro: `insert into supabase_migrations.schema_migrations (version, name) values ('20261020000015', 'tipo_notificacion_error')`. **0016:** `20261020000016_reportes_de_errores.sql`, en otra petición, con `('20261020000016', 'reportes_de_errores')`. |
| Supabase, `public.perfiles` | `es_moderador = true` en la cuenta del dueño, buscada por su email en `auth.users`. El `update` solo actuaba si había exactamente una coincidencia. |
| `docs/reportes/2026-10-20-cierre-mejoras.md` | Este reporte. |

No cambia código de la app ni de la base en este commit.

## 3. Verificaciones

### Paso 1 · La 0015 y la 0016 en producción

**Antes de aplicarlas:**
- 14 versiones (0001 a 0014), 14 distintas;
- `tipo_notificacion` sin `error`;
- sin la tabla `reportes_errores` y sin el bucket `capturas`.

**Respuesta al aplicar cada una:** `[]`, sin error. Después de la 0015, el historial tenía 15 versiones y el enum ya tenía `error`.

**Después de las dos:**

| Qué | Resultado |
| --- | --- |
| `schema_migrations` | 16 versiones, 16 distintas: de `20261017000001` a `20261020000016`. |
| `enum_range(null::public.tipo_notificacion)` | `{coincidencia,avistamiento,estado,mensaje,error}` |
| Bucket `capturas` | privado (`public = false`), 5 MB, solo `image/jpeg` |
| `config_app` | `errores_por_hora_cuenta=5`, `errores_por_hora_sin_cuenta=30` |
| Políticas de Storage `capturas:` | 3 (subir a la carpeta propia, leer las propias y moderación, borrar las propias) |
| `reportes_errores` | RLS activa. Una política: `reportes_errores: leen los moderadores (SELECT)`. Permisos: solo `SELECT` para `authenticated`; `anon`, ninguno. |
| RPC | `reportar_error`: `anon` y `authenticated`. `resolver_reporte_error` y `capturas_para_borrar`: solo `authenticated`. `es_captura_propia`: ninguno de los dos (interna). |
| `limpiar_cuenta` | Incluye los reportes de errores. |
| Igual a lo probado en local (md5 en producción y en Postgres local con 0001–0016) | Iguales: `reportar_error`, `resolver_reporte_error`, `capturas_para_borrar`, `es_captura_propia`, `limpiar_cuenta`, la vista `reportes_errores_detalle` y las 4 políticas. |

### Paso 2 · Pruebas SQL en producción

Se corrieron de a una, con el archivo tal como está en el commit `d3f3f95`, por la Management API. Antes de la primera y después de cada una se contaron las filas.

| Archivo | Resultado |
| --- | --- |
| `errores.sql` | `[]`, sin errores |
| `fase5_permisos.sql` | `[]`, sin errores |
| `fase6_perdidos.sql` | `[]`, sin errores |
| `fase7_cuenta.sql` | Sin errores. Devuelve `[{"set_config":"{\"role\":\"anon\"}"}]`, el resultado de su último `select`, como en los cierres anteriores. |
| `fase8_casos.sql` | `[]`, sin errores |
| `fase9_revision.sql` | `[]`, sin errores |
| `fase9_parte2.sql` | `[]`, sin errores |

`fase9_revision.sql` se volvió a correr una vez más, después, con el mismo resultado y los mismos conteos.

**Control.** Una copia de `errores.sql` que espera que alguien sin cuenta vea 1 captura (en vez de 0) falla con `FALLA 3c: sin cuenta se ven 0 capturas`. Eso confirma dos cosas:
- un error en una prueba se ve en la respuesta;
- en producción, alguien sin cuenta no ve las capturas.

**Sin datos de más.** Los conteos fueron los mismos después de aplicar las migraciones y después de cada prueba:
- usuarios 4, perfiles 4, moderadores 0 (antes del paso 3);
- animales 4, avistamientos 5, cambios de estado 0, coincidencias 0, contactos 0;
- notificaciones 2, conversaciones 1, mensajes 2, seguimientos 4, denuncias 0, bloqueos 0;
- cola de visión 5, reportes de errores 0, objetos de Storage 0, cola de pg_net 0;
- `config_app` sin cambios.

Al terminar no quedan cuentas `@encontrados.test` (0) ni transacciones colgadas (0).

### Paso 3 · Moderadora

- **Antes:** una sola cuenta con ese email en `auth.users`, con perfil y sin `es_moderador`.
- **El `update`:** `filas_actualizadas = 1`.
- **Después:** 1 moderador en `perfiles`, de 4 perfiles.

### La app (sin cambios desde `d3f3f95`)

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | Sin errores. |
| `npm run lint` | Sin errores (salida 0). |
| `npm run test` | 16 suites, 157 pruebas pasan. |
| `npx expo export -p web` | `Exported: dist`, sin errores. |

## 4. Pasos manuales

En Supabase no queda nada por hacer. Los pasos 5 y 6 del pedido (merge del PR #9 y comprobar el deploy) van después de este commit.

1. **Vercel:** que siga activada **Settings → Environment Variables → Automatically expose System Environment Variables**. Sin eso, la versión de los reportes dice la fecha del build en vez del commit.
2. **Si la red de quien hizo el deploy no llegó a `vercel.app`,** comprobar:
   ```bash
   curl -sI https://animales-blue.vercel.app/manifest.webmanifest | head -1   # 200
   curl -sI https://animales-blue.vercel.app/sw.js | head -1                  # 200
   curl -sI https://animales-blue.vercel.app/iconos/icono-512.png | head -1   # 200
   ```
3. **Recorrer a mano,** con el deploy del merge, los flujos 21 a 24 de `docs/PRUEBAS-MANUALES.md`:
   - 21: hoja plegable;
   - 22: instalar la app;
   - 23: reportar un error;
   - 24: borrar la cuenta.

   Con tu cuenta, que ya es moderadora, el flujo 23 se puede hacer completo: el aviso llega a tu Actividad y los reportes se ven en **Moderación → Errores**.

## 5. Pendientes y riesgos

- **Orden del despliegue:** las migraciones quedaron aplicadas antes del merge, que es el orden recomendado. Mientras el deploy no termine, la versión anterior de la app no usa nada de la 0015 ni de la 0016, así que nada se rompe en el medio.
- **Avisos a moderación:** desde ahora, cada reporte de error le llega a tu Actividad, también los de personas sin cuenta. Si llegaran demasiados, el tope sin cuenta se baja en `config_app` (`errores_por_hora_sin_cuenta`).
- **Siguen los pendientes de `docs/reportes/2026-10-20-mejoras.md`, sección 5.** Los principales:
  - la carga inicial creció un 0,9 % en `/`;
  - el ícono sigue siendo el de la plantilla de Expo;
  - no hay borrado automático de reportes ni de capturas;
  - el arrastre de la hoja no se probó en un iPhone real.
