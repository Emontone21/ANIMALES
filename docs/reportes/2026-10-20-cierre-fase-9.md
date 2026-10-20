# Cierre de la Fase 9

Rama `claude/animales-repo-mxm2ja`, PR #7 (commit de la parte 2: `2e57c3d`). Proyecto de Supabase `bwqvuttuodwypwxckxgf`. 20 de octubre de 2026.

## 1. Resumen

**Qué se pidió:** cerrar la parte 2 de la Fase 9, con el PR #7 ya revisado y aprobado.

1. Aplicar la 0014 en producción y registrarla.
2. Correr en la base real las 6 pruebas SQL.
3. Escribir este reporte y subirlo a la rama.
4. Mergear el PR #7 con merge commit.
5. Confirmar el deploy de producción y la caché.

**Qué se hizo** (pasos 1 y 2, el resto va después de este commit):

- **0014 aplicada y registrada.** El historial quedó de 0001 a 0014, sin duplicados, con las cinco políticas de lectura de la sección 4 de `docs/reportes/2026-10-19-revision-2.md`. Lo aplicado es idéntico a lo probado en local: los hashes de la función, la vista y las políticas coinciden.
- **Las 6 pruebas pasan en producción** sin dejar datos. Una copia alterada a propósito falla donde corresponde, así que un error no habría pasado inadvertido.
- **Hoy no hay casos ocultos en producción** (0 casos, 0 conversaciones sobre ellos): nadie deja de ver nada con la 0014.

## 2. Cambios

| Dónde | Qué |
| --- | --- |
| Supabase, proyecto `bwqvuttuodwypwxckxgf` | Se aplicó `supabase/migrations/20261019000014_ocultos_y_conversaciones.sql`, sacada del commit `2e57c3d` del PR, en una sola petición a la Management API (una transacción). En la misma transacción se registró: `insert into supabase_migrations.schema_migrations (version, name) values ('20261019000014', 'ocultos_y_conversaciones')`. |
| `docs/reportes/2026-10-20-cierre-fase-9.md` | Este reporte. |

No cambia código de la app ni de la base en este commit.

## 3. Verificaciones

### Paso 1 · La 0014 en producción

**Antes de aplicarla:**
- 13 versiones (0001 a 0013), 13 distintas.
- Lectura pública en `animales`, `avistamientos`, `cambios_estado` y `coincidencias`.
- `conversaciones_detalle` sin `animal_disponible`.

**Respuesta al aplicar:** `[]`, sin error.

**Después:**

| Qué | Resultado |
| --- | --- |
| `schema_migrations` | 14 versiones, 14 distintas: de `20261017000001 base` a `20261019000014 ocultos_y_conversaciones`. |
| Políticas de lectura (una por tabla) | `animales: lectura si no esta oculto`, `avistamientos: lectura si se ve el caso`, `cambios_estado: lectura si se ve el caso`, `coincidencias: lectura si se ven los dos casos`, `contactos_resguardo: lectura segun el caso`. No quedó ninguna "lectura publica". |
| `conversaciones_detalle` | Tiene `animal_disponible` y sigue con `security_invoker=true`. |
| `abrir_conversacion` | `security definer`. La pueden ejecutar `authenticated`, `postgres` y `service_role`; `anon`, no. |
| Igual a lo probado en local (md5 en producción y en Postgres local con 0001–0014) | `abrir_conversacion`: `98bc8bd69c3480242a44058ff126068c` en las dos. `conversaciones_detalle`: `76470edbdda652304acca7c18bafc311` en las dos. Las 5 políticas, iguales una por una. |

### Paso 2 · Pruebas SQL en producción

Se corrieron de a una, con el archivo tal como está en el commit `2e57c3d`, por la Management API. Después de cada una se contaron las filas.

| Archivo | Resultado |
| --- | --- |
| `fase9_parte2.sql` | `[]`, sin errores |
| `fase5_permisos.sql` | `[]`, sin errores |
| `fase6_perdidos.sql` | `[]`, sin errores |
| `fase7_cuenta.sql` | Sin errores. Devuelve `[{"set_config":"{\"role\":\"anon\"}"}]`, el resultado de su último `select`, como en la parte 1. |
| `fase8_casos.sql` | `[]`, sin errores |
| `fase9_revision.sql` | `[]`, sin errores (con el arreglo de `bytea`) |

**Control.** Una copia de `fase9_parte2.sql` que espera que alguien sin cuenta vea 1 caso oculto (en vez de 0) falla con `FALLA 1a: sin cuenta ve 0 de animales (se esperaba 1)`. Eso confirma dos cosas:
- un error en una prueba se ve en la respuesta;
- en producción, alguien sin cuenta no ve el caso oculto.

**Sin datos de más.** Los conteos fueron los mismos antes de aplicar la 0014, después y después de cada prueba:
- usuarios 2, perfiles 2, animales 4, avistamientos 5;
- cambios de estado 0, contactos 0, coincidencias 0;
- notificaciones 2, seguimientos 4, denuncias 0, bloqueos 0;
- conversaciones 1, mensajes 2, cola de visión 5;
- objetos de Storage 0, cola de pg_net 0;
- cuentas `@encontrados.test` 0, transacciones colgadas 0.

### La app (sin cambios desde `2e57c3d`)

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | Sin errores. |
| `npm run lint` | Sin errores (salida 0). |
| `npm run test` | 10 suites, 116 pruebas pasan. |
| `npx expo export -p web` | `Exported: dist`, sin errores. |

## 4. Pasos manuales

En Supabase y en Vercel no queda nada por hacer. Los pasos 4 y 5 del pedido (merge del PR #7 y comprobar el deploy y la caché) van después de este commit.

1. **Recorrer a mano, con el deploy del merge,** los flujos 9 (Escribirle a quien lo vio), 10 (Atrás con una hoja abierta, sobre todo en Android con Chrome) y 15 (Una publicación oculta) de `docs/PRUEBAS-MANUALES.md`.
2. **Si la red de quien hizo el deploy no llegó a `vercel.app`,** comprobar la caché con los `curl` de la sección 4 de `docs/reportes/2026-10-19-revision-2.md`:
   - `/` no tiene que decir `immutable`;
   - un archivo de `/_expo/static/js/web/` tiene que decir `public, max-age=31536000, immutable`.

## 5. Pendientes y riesgos

- **Orden del despliegue:** la 0014 quedó aplicada antes del merge, que era el orden recomendado. Mientras el deploy no termine, la versión anterior de la app no muestra "Escribirle" y no pide `animal_disponible`, así que nada se rompe en el medio.
- **Atrás en web** depende de cómo Expo Router usa el historial. Al actualizar Expo o Expo Router, volver a recorrer el flujo 10 (`AGENTS.md`, "Hojas y Atrás").
- **Siguen pendientes de la parte 2:**
  - el hallazgo de accesibilidad: react-native-web ignora `accessibilityState` en chips, pestañas, casillas y tarjetas;
  - M19, M20 y las BAJA fuera de la lista.

  Ver `docs/reportes/2026-10-19-revision-2.md`, sección 5.
