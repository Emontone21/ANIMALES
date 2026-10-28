# Panel de SPOT: la base para los datos (migración 0028) · 2026-10-28

## 1. Resumen

**Qué se pidió:** "resolvé todos los pendientes" del panel de administración. Las tarjetas de La app, Vercel y Supabase estaban en **Pendiente**: esperaban la migración de administradores y la integración con Vercel.

**Qué se hizo:** este reporte cubre lo que está fuera de `PANEL/`. Lo del panel (las funciones que leen los datos, las tarjetas y los umbrales) está en `PANEL/docs/reportes/2026-10-28-panel-datos.md`, en su propio commit.

- **Migración 0028** (`supabase/migrations/20261028000028_panel_admin.sql`):
  - la tabla `administradores`, con RLS y sin permisos para `anon` ni `authenticated`;
  - `es_admin()`;
  - `admin_resumen()`, que devuelve solo conteos, fechas agregadas y tamaños, y falla con 42501 para quien no esté en la tabla.

  Es la propuesta del panel (`PANEL/propuestas/migracion-admin.sql`), revisada contra el esquema actual. La propuesta se sacó del panel en su commit.
- **Pruebas SQL:** `supabase/tests/panel_admin.sql`.
- **Tipos:** `es_admin` y `admin_resumen` en `src/types/database.ts`.
- **Documentación:** `AGENTS.md`, `README.md` y `supabase/tests/README.md`.
- **En producción:**
  1. primero se validó dentro de una transacción con `rollback`;
  2. el primer intento de aplicarla lo frenó el control de permisos de la sesión;
  3. con la autorización del dueño, se aplicó y registró, se cargó su cuenta en `administradores` y se corrieron las 15 pruebas SQL.

  Todo en la sección 3.

## 2. Cambios

| Archivo | Por qué |
| --- | --- |
| `supabase/migrations/20261028000028_panel_admin.sql` | Nueva. La tabla `administradores`, `es_admin()` y `admin_resumen()`. Los datos de demo (`es_foto_de_demo`) no cuentan como casos, y los días son los de Montevideo. Las funciones son `security definer` con `search_path = ''`; solo `authenticated` las ejecuta, y `admin_resumen()` comprueba `es_admin()` antes de nada. |
| `supabase/tests/panel_admin.sql` | Nueva. Comprueba: <ul><li>sin cuenta, ni `es_admin()` ni el resumen;</li><li>una cuenta común recibe `false` y 42501;</li><li>nadie lee ni escribe `administradores` por la API;</li><li>el resumen tiene todas sus claves, 7 días que terminan hoy en Montevideo, y nada que no sea un número;</li><li>un caso nuevo suma, uno de demo no, y uno oculto suma en nuevos y en ocultos pero no en abiertos;</li><li>al borrar la cuenta se borra su fila.</li></ul> |
| `src/types/database.ts` | `es_admin` y `admin_resumen` en `Functions`, a mano con el mismo formato (se escribieron antes de aplicar la migración). La app no las usa. |
| `AGENTS.md` | Migraciones 0001–0028, `panel_admin.sql` en Estructura, la línea de `PANEL/` y la fase del panel. |
| `README.md`, `supabase/tests/README.md` | El rango de migraciones y la fila de `panel_admin.sql`. |

**Por qué estas decisiones:**
- **Por qué no se suma a `limpiar_cuenta`:** `administradores` no guarda contenido publicado. Al borrar la cuenta, su fila se va por `on delete cascade` desde `perfiles`.
- **Por qué Storage se mide sumando `storage.objects.metadata->size`:** el dueño de la función (`postgres`) tiene `BYPASSRLS` en este proyecto (lo comprobé en producción), así que la suma ve todos los archivos. No se borra ni se cambia nada de `storage.objects`.

## 3. Verificaciones

| Verificación | Resultado |
| --- | --- |
| `npm run typecheck` | Sin errores. |
| `npm run lint` | Sin errores (solo el aviso de siempre de synckit). |
| `npm run test` | 33 suites, 362 pruebas: todas pasan. |
| `npx expo export -p web` | Termina bien, con el mismo bloque `entry-d31c0e98….js` que antes: la app no cambió. |

**La migración en producción, sin dejar nada** (API de gestión de Supabase, todo dentro de `begin … rollback`):
- la migración y `panel_admin.sql` corrieron bien, sin filas ni errores;
- una transacción de control con un `raise` a propósito dio el error esperado, así que la consulta sí llegaba a ejecutarse;
- después, `to_regclass('public.administradores')` seguía en null y la última migración registrada seguía siendo `20261022000027`.

**La migración aplicada** (API de gestión, en una sola transacción):
- el archivo de la migración;
- su registro en `supabase_migrations.schema_migrations` (`20261028000028`, `panel_admin`);
- la cuenta del dueño en `administradores`, buscada por su email.

Comprobado después:

| Qué | Resultado |
| --- | --- |
| Última migración registrada | `20261028000028`, `panel_admin` |
| Filas en `administradores` | 1, y es el mismo id de `ADMIN_USER_IDS` en Vercel |
| `admin_resumen()` | `anon` no la ejecuta; `authenticated`, sí |
| `administradores` | `authenticated` no la lee y tiene RLS |

**Las 15 pruebas SQL en producción**, cada una dentro de su transacción con `rollback`:
- terminan sin error: `auditoria_2`, `avisos_push`, `contacto_al_cerrar`, `errores`, `fase5_permisos` a `fase9_revision`, `panel_admin`, `privacidad_reunidos`, `reconocimiento_ia`, `reencuentros` y `vision`;
- `fase7_cuenta` devuelve su fila de `set_config`, como siempre;
- después no quedó ningún usuario `@spot.test` y `administradores` sigue con 1 fila.

## 4. Pasos manuales

**Ya hechos en producción** (sección 3). Quedan como referencia, para otro proyecto o para sumar una cuenta. En el **SQL Editor** de Supabase, en este orden:

1. **Aplicar la migración.** Pegá el archivo `supabase/migrations/20261028000028_panel_admin.sql` entero, agregá al final esta línea y tocá Run:
   ```sql
   insert into supabase_migrations.schema_migrations (version, name)
   values ('20261028000028', 'panel_admin');
   ```
   (Con la CLI es lo mismo: `npx supabase db push`, que ya la registra.)
2. **Cargar la cuenta del panel** (la misma de `ADMIN_USER_IDS` en Vercel):
   ```sql
   insert into public.administradores (usuario_id)
   select id from auth.users where lower(email) = lower('<el email de la cuenta del panel>');

   select count(*) from public.administradores;  -- tiene que dar 1
   ```
3. **Correr la prueba.** Pegá `supabase/tests/panel_admin.sql` entero y tocá Run. Tiene que terminar en "Success. No rows returned", y no deja nada.
4. **Abrir el panel** y tocar **Actualizar**: las tarjetas de La app, Supabase y el servicio de visión pasan a mostrar números.

## 5. Pendientes y riesgos

- **Dos listas para lo mismo:**
  - `ADMIN_USER_IDS` en Vercel decide quién usa el panel;
  - `administradores` en la base decide quién lee los datos.

  Si se suma una cuenta en una, hay que sumarla en la otra. Si no, el panel muestra "Tu cuenta no está en la tabla administradores".
- **El resumen hace un `count(*)` por grupo en cada actualización.** Con el volumen del piloto es instantáneo. Si `animales` o `cola_vision` crecen mucho, convendría un índice por `created_at` o un resumen cacheado.
