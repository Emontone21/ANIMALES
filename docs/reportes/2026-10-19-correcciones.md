# Correcciones de la revisión externa · 2026-10-19

## 1. Resumen

**Qué se pidió.** Verificar contra el código y las migraciones los hallazgos de una revisión externa (S1–S4 de seguridad, B1–B6 de bugs), clasificar cada uno como CONFIRMADO, PARCIAL o NO SE REPRODUCE y corregir solo los confirmados o parciales. Además: crear `CLAUDE.md` con la regla de reportes, documentar, verificar y dejar todo en un solo commit sin push.

**Qué se hizo.**

- **Ya estaban corregidos antes de esta tarea:** S1–S4, B1–B4 y B6. Lo hizo el commit `e0c8227` de esta misma rama, con la migración `20261019000007_endurecer_rls.sql`. Esa migración ya está aplicada en el proyecto Supabase `bwqvuttuodwypwxckxgf` y registrada en su historial. B6 se corrigió en la configuración del proyecto de Vercel.
- **En esta tarea:**
  - Verifiqué los diez hallazgos reproduciéndolos en una base con 0001–0006, el estado que vio la revisión. Todos se reproducen: ocho como CONFIRMADO y dos como PARCIAL (S4 y B5).
  - Corregí B5.
  - Agregué un hallazgo nuevo del mismo tipo, X1, y lo corregí en una migración nueva.
  - Documenté B6 en el README y en DECISIONES.
- **Desvío de la consigna:** la migración nueva se llama `20261019000008_correcciones.sql`, no `20261019000007_correcciones.sql`. La versión `20261019000007` ya existe y está aplicada en producción. Un segundo archivo con la misma versión chocaría con `supabase db push`, que identifica cada migración por ese número.

## 2. Hallazgos

Las líneas de 0003–0006 son de las migraciones que vio la revisión, que no se editaron. "0007" es `supabase/migrations/20261019000007_endurecer_rls.sql`, ya commiteada en `e0c8227`. "0008" es la de esta tarea.

| ID | Clasificación | Verificación con evidencia | Qué se cambió | Archivos |
|---|---|---|---|---|
| S1 | CONFIRMADO | `20261017000003_rls_y_funciones.sql:18` crea la política "perfiles: editar el propio", que filtra por fila y no por columna. `20261017000006_notificaciones_mensajes_moderacion.sql:422` agrega `es_moderador` a esa misma tabla. **Reproducido:** un usuario común hace `update perfiles set es_moderador = true` y el cambio se aplica. | Se revoca el UPDATE de tabla y se concede solo `(nombre_publico, avatar_path)`. | 0007:22-23 |
| S2 | CONFIRMADO | 0003:72, política "cambios_estado: crear con cuenta" (solo exige `usuario_id = auth.uid()`). `src/app/animal/[id].tsx:77-82,113` muestra el `contacto_compartido` del último cambio a `resguardado`. 0006:199-228: el trigger avisa "¡Volvió con su familia!" ante cualquier insert con `estado_nuevo = 'reunido'`. **Reproducido:** un usuario común inserta un resguardo con contacto falso y un "reunido", y los dos se aceptan. | Sin INSERT, UPDATE ni DELETE para `anon` y `authenticated`. Se borra la política. | 0007:32, 0007:43 |
| S3 | CONFIRMADO | 0003:36 "animales: editar el propio" y 0006:510 "animales: moderadores editan" no limitan columnas. En `avistamientos`, 0003:52,56,61 permiten crear, editar y borrar lo propio. El chequeo de "caso cerrado" vive solo en la RPC (0004:177). **Reproducido:** quien publicó cambia `oculto` y `estado` a mano; otro usuario inserta un avistamiento en un caso reunido y mueve su avistamiento a otro animal (`animal_id`). | `animales` y `avistamientos` sin escritura directa; se borran sus políticas de escritura. `publicar_animal` y `registrar_avistamiento` pasan a `security definer` con `alter function`, sin tocar el cuerpo: conservan todas sus validaciones. Nueva RPC `moderar_animal` que valida `es_moderador()`, y el panel la usa. | 0007:30-31, 0007:36-42, 0007:54-62, 0007:66-85, `src/features/moderacion/api.ts:27` |
| S4 | PARCIAL | 0006:293-303, política "mensajes: marcar leídos": `using` exige ser participante y no emisor; `with check` solo exige `emisor_id <> auth.uid()`. **Reproducido:** quien recibe edita `cuerpo`. Es parcial porque solo puede editar los mensajes que recibió, no cualquiera. | UPDATE solo de `leido_en`. Lo mismo para `notificaciones` (`leida_en`) y `denuncias` (`estado`). | 0007:91-98 |
| B1 | CONFIRMADO | 0004:92-122 y 0006:468-499: `animales_detalle` usa `join lateral` obligatorio contra `avistamientos`. 0005, en `resolver_coincidencia`, mueve todos los avistamientos del secundario. `[id].tsx:35-38` redirige solo si la fila existe. **Reproducido:** el vinculado desaparece de la vista. | `left join lateral`, así que `lat`, `lng` y `ultimo_visto_en` pueden ser null. "Mis reportes" muestra "tocá para ver el caso principal" en vez de "0 avistamientos" y navega a `vinculado_a`. El detalle no necesitó cambios: la redirección ya estaba y ahora corre. | 0007:106-136, `src/app/(tabs)/perfil.tsx:96,111-114`, `src/i18n/es-UY.ts`, `src/types/database.ts:468-470` |
| B2 | CONFIRMADO | 0005:402 inserta `'avistado', 'vinculado'` fijo. **Además:** en 0005 la función nunca llegaba a esa línea, porque el `case` de 0005 (función en 0005:331) devuelve `text` y el UPDATE de `coincidencias.estado` fallaba siempre. **Reproducido:** `column "estado" is of type estado_coincidencia but expression is of type text`. Confirmar o rechazar coincidencias no funcionaba. | Lee el estado real del secundario con `for update` y castea el `case`. Quién puede confirmar no cambia. | 0007:172, 0007:223 |
| B3 | CONFIRMADO | `docs/DECISIONES.md:31` en `f4211f9` decía "se puede deshacer"; no existe esa función, y los avistamientos movidos no guardan de qué reporte venían. | Texto corregido. | `docs/DECISIONES.md` |
| B4 | CONFIRMADO | `package.json:62` en `f4211f9`: `--local`. | `--linked`. | `package.json` |
| B5 | PARCIAL | `src/features/seguimientos/api.ts:22` hace `upsert` (merge-duplicates, o sea `on conflict do update`). 0004:21-31 no tiene política de UPDATE. `registrar_avistamiento` y `cambiar_estado_animal` te hacen seguir el caso solos (0004:192 y 0004:287), y `useInvalidarAnimal` no refrescaba el botón Seguir. **Reproducido:** `new row violates row-level security policy (USING expression) for table "seguimientos"`. Es parcial porque solo falla cuando la UI está desactualizada; con la fila inexistente funciona. | `ignoreDuplicates: true` (`on conflict do nothing`). Avisar que lo viste o cambiar el estado invalida la consulta de seguimiento. | `src/features/seguimientos/api.ts:6-9,22-35`, `src/features/reportes/api.ts:3,196-209` |
| B6 | CONFIRMADO (configuración de Vercel, no el repo) | El log no vino en la consigna, que traía el marcador `<PEGÁ ACÁ EL LOG DE VERCEL>`. Según la metadata del deploy `dpl_4kBhwzaDTzVFHPP5QcVKko11v6zq` (commit `f4211f9`), el proyecto tenía preset **fastapi**, con `errorCode BUILD_UTILS_SPAWN_1` y `Command "uv pip install" exited with 1`. Vercel detectó el servicio de visión en Python (`services/vision/`). `vercel.json` ya tenía `"framework": null`, pero ganó el preset del proyecto. | Ya resuelto en el panel: preset **Other**, Node 22 y variables `EXPO_PUBLIC_*`. El deploy `dpl_6SdnAnfGstNhSnm3b3EL7cdowknk` quedó **READY** en `https://animales-blue.vercel.app`. En el repo: el README indica elegir **Other** al importar. | `README.md`, `docs/DECISIONES.md` |
| X1 (nuevo) | CONFIRMADO | Mismo tipo que S1–S4, pero en INSERT. 0006:281 "mensajes: enviar…" y 0004:82 "denuncias: crear" no limitan columnas. **Reproducido:** se puede mandar un mensaje con `leido_en` ya puesto (no cuenta como no leído) y crear una denuncia ya `descartada`, fuera de la cola de moderación. | INSERT solo de las columnas que manda la app. | `supabase/migrations/20261019000008_correcciones.sql` |

**Cómo se verificó.** En un Postgres 16 local con PostGIS, pgvector y stubs de los roles y esquemas de Supabase, armé dos bases con el seed: `previa` (0001–0006) y `nueva` (0001–0008). En las dos corrí cada ataque como usuario común o como creador; cada intento se deshacía al final.

| Intento | 0001–0006 | 0001–0008 |
|---|---|---|
| S1: hacerse moderador | PERMITIDO | denegado (`permission denied for table perfiles`) |
| S2: resguardo con contacto falso / "reunido" | PERMITIDO / PERMITIDO | denegado / denegado |
| S3: creador cambia `oculto` y `estado` | PERMITIDO | denegado |
| S3: avistar directo un caso cerrado / mover `animal_id` | PERMITIDO / PERMITIDO | denegado / denegado |
| S4: editar el cuerpo de un mensaje recibido | PERMITIDO | denegado |
| B1: vinculado visible en `animales_detalle` | no (desaparece) | sí (redirige) |
| B2: `estado_anterior` al vincular un resguardado | la función falla antes | `resguardado` |
| B5: seguir algo ya seguido, `do update` / `do nothing` | error de RLS / OK | error de RLS / OK (la app ahora usa `do nothing`) |
| X1: mensaje "ya leído" / denuncia ya descartada | PERMITIDO / PERMITIDO | denegado / denegado |
| Controles: mensaje normal, marcar leído, denuncia normal, `publicar_animal` | OK | OK |

## 3. Cambios

**En este commit:**

| Archivo | Por qué |
|---|---|
| `CLAUDE.md` | Paso 0: importa AGENTS.md y agrega la regla de reporte obligatorio. |
| `supabase/migrations/20261019000008_correcciones.sql` | X1: INSERT por columna en `mensajes` y `denuncias`. |
| `src/features/seguimientos/api.ts` | B5: `ignoreDuplicates: true` y se exporta `claveSeguimientos`. |
| `src/features/reportes/api.ts` | B5: invalidar el botón Seguir después de avisar que lo viste o de cambiar el estado. |
| `README.md` | B6: elegir el preset **Other** al importar en Vercel. Rango de migraciones 0001–0008. |
| `AGENTS.md` | Rango de migraciones 0001–0008. |
| `docs/ARQUITECTURA.md` | Seguridad: INSERT por columna en `mensajes` y `denuncias`. |
| `docs/DECISIONES.md` | Entradas nuevas: INSERT por columna, upsert que ignora duplicados, preset Other en Vercel. |
| `docs/reportes/2026-10-19-correcciones.md` | Este reporte. |

**Ya en `e0c8227` (misma rama), donde se corrigieron S1–S4 y B1–B4:**
- `supabase/migrations/20261019000007_endurecer_rls.sql`
- `src/features/moderacion/api.ts` (usa `moderar_animal`)
- `src/app/(tabs)/perfil.tsx`
- `src/i18n/es-UY.ts` (`perfil.verCasoPrincipal`)
- `src/types/database.ts`: `lat`, `lng` y `ultimo_visto_en` pueden ser null; agrega `moderar_animal`. La 0008 no cambia tipos, porque los permisos no aparecen en los tipos generados.
- `package.json` (`db:types --linked`)
- `docs/DECISIONES.md` (B3 y entrada de la 0007)
- `docs/ARQUITECTURA.md`, `README.md`, `AGENTS.md`

## 4. Verificaciones

| Comando | Resultado |
|---|---|
| `npm run typecheck` | OK, sin errores (exit 0) |
| `npm run lint` | OK, sin errores (exit 0) |
| `npx expo export -p web` | OK, `Exported: dist` (exit 0) |

Además:
- **Migraciones:** 0001–0008 se aplican sin errores sobre Postgres 16 con stubs de Supabase.
- **Pruebas:** las de la sección 2 y el script del SQL Editor de abajo dan lo esperado en las dos bases, y no dejan datos.
- **Producción:** la 0007 ya se había verificado en Supabase (`bwqvuttuodwypwxckxgf`, Postgres 17) al aplicarla.

### Pruebas para el SQL Editor de Supabase

Pegá el script entero en **SQL Editor** y tocá **Run**.
- **Bien:** termina en `Success. No rows returned`.
- **Mal:** aparece un `ERROR` que empieza con `FALLA n:` y dice qué protección no anda.

Corre todo dentro de `begin`/`rollback`: no deja usuarios, animales ni mensajes. Se validó así:
- Con 0001–0006 falla en la prueba 1, y quitando las anteriores, también en la 2 y en la 3.
- Con 0001–0008 pasa entera.

```sql
-- Pruebas de permisos como usuario común. Pegalo entero en el SQL Editor y tocá Run.
-- Bien: termina en "Success. No rows returned". Mal: ERROR con "FALLA: ..." que dice qué.
-- Todo corre dentro de begin/rollback: no deja usuarios, animales ni mensajes.
begin;

-- Datos de prueba, creados como postgres: A (usuario común), B (otro usuario),
-- un animal de A y un mensaje de B para A.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-0000000000a1', 'prueba-a@encontrados.test', '{"nombre_publico":"Prueba A"}'),
  ('00000000-0000-4000-8000-0000000000b2', 'prueba-b@encontrados.test', '{"nombre_publico":"Prueba B"}');
insert into public.animales (id, especie, foto_principal_path, creado_por)
values ('00000000-0000-4000-8000-0000000000c3', 'perro',
        '00000000-0000-4000-8000-0000000000a1/prueba.jpg', '00000000-0000-4000-8000-0000000000a1');
insert into public.conversaciones (id, animal_id, participante_a, participante_b)
values ('00000000-0000-4000-8000-0000000000e5', '00000000-0000-4000-8000-0000000000c3',
        '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b2');
insert into public.mensajes (id, conversacion_id, emisor_id, cuerpo)
values ('00000000-0000-4000-8000-0000000000d4', '00000000-0000-4000-8000-0000000000e5',
        '00000000-0000-4000-8000-0000000000b2', 'Hola, creo que es mi perro');

-- Desde acá, todo corre como A, igual que una llamada desde la app.
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';

do $$
declare
  v_animal uuid;
  v_filas int;
begin
  -- 1. No puede hacerse moderador.
  begin
    update public.perfiles set es_moderador = true where id = auth.uid();
    raise exception 'FALLA 1: un usuario común pudo ponerse es_moderador = true';
  exception when insufficient_privilege then null;
  end;

  -- 2. No puede insertar en cambios_estado (ni contacto falso ni "volvió con su familia").
  begin
    insert into public.cambios_estado (animal_id, usuario_id, estado_anterior, estado_nuevo, contacto_compartido)
    values ('00000000-0000-4000-8000-0000000000c3', auth.uid(), 'avistado', 'resguardado', 'Llamá al 099 000 000');
    raise exception 'FALLA 2: un usuario común pudo insertar en cambios_estado';
  exception when insufficient_privilege then null;
  end;

  -- 3. No puede editar el cuerpo de un mensaje ajeno...
  begin
    update public.mensajes set cuerpo = 'texto cambiado' where id = '00000000-0000-4000-8000-0000000000d4';
    raise exception 'FALLA 3: un usuario común pudo editar un mensaje ajeno';
  exception when insufficient_privilege then null;
  end;

  -- ...pero sí marcarlo como leído.
  update public.mensajes set leido_en = now() where id = '00000000-0000-4000-8000-0000000000d4';
  get diagnostics v_filas = row_count;
  if v_filas <> 1 then
    raise exception 'FALLA 4: no pudo marcar como leído un mensaje recibido';
  end if;

  -- 5. publicar_animal sigue funcionando.
  v_animal := public.publicar_animal('gato', auth.uid()::text || '/prueba2.jpg', -34.9, -56.16);
  if v_animal is null then
    raise exception 'FALLA 5: publicar_animal no devolvió el id';
  end if;
end $$;

rollback;
```

## 5. Pasos manuales

**Supabase** (proyecto `bwqvuttuodwypwxckxgf`): aplicar la 0008. La 0007 ya está aplicada y registrada. Elegí una de las dos formas:

- **CLI**, desde la raíz del repo. Solo aplica la 0008, porque 0001–0007 ya figuran en el historial:
  ```bash
  npx supabase login
  npx supabase link --project-ref bwqvuttuodwypwxckxgf
  npx supabase db push
  ```
- **SQL Editor:** pegá y ejecutá el contenido de `supabase/migrations/20261019000008_correcciones.sql`. Después registrala en el historial, para que un `db push` futuro no la repita:
  ```sql
  insert into supabase_migrations.schema_migrations (version, name)
  values ('20261019000008', 'correcciones');
  ```

Después corré el script de la sección 4. Tiene que terminar en `Success. No rows returned`.

**GitHub y Vercel:**
1. Pushear la rama y mergearla a `main`. Producción hoy sirve `main` en `f4211f9`, que todavía oculta publicaciones con el UPDATE directo: con la 0007 aplicada, ese botón del panel de moderación falla hasta el merge.
   ```bash
   git push -u origin claude/animales-repo-mxm2ja
   ```
   Después abrí un PR a `main` y mergealo. Vercel despliega solo.
2. Nada más que hacer en el panel: el preset ya está en **Other**, con Node 22 y las variables `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` cargadas. Si alguna vez se recrea el proyecto, elegí **Framework Preset: Other** al importar.

**Supabase Auth:** ya están cargadas la Site URL (`https://animales-blue.vercel.app`) y las Redirect URLs. Antes de abrir la web al público:
- Borrá la cuenta demo: su contraseña `demo1234` está en el repo.
  ```sql
  delete from auth.users where email = 'demo@encontrados.uy';
  ```
  Ojo: esto también borra los tres animales de demo, por el `on delete cascade` de `perfiles` y `animales`.
- Configurá un SMTP propio en **Authentication → Emails → SMTP Settings**. El servidor gratuito manda 2 mails por hora.

## 6. Pendientes y riesgos

**Fuera de alcance**, a propósito, según la consigna:
- Quién puede marcar un caso como reunido. Hoy cualquier usuario con cuenta, por `cambiar_estado_animal`. Va en la Fase 6.
- Quién confirma coincidencias. Hoy cualquier usuario con cuenta, por `resolver_coincidencia`. Va en la Fase 6.
- Tres denuncias de cuentas nuevas alcanzan para ocultar una publicación (`ocultar_por_denuncias`). Va en la Fase 7.

**Encontrados y no corregidos**, porque no son chicos o no son del mismo alcance:
- **`push_tokens` en un dispositivo compartido** (solo app nativa). El token queda a nombre del usuario anterior al cerrar sesión: `borrarPushToken` no se llama en ningún lado. Cuando entra otro usuario, el upsert choca con la política de UPDATE y falla en silencio. El usuario anterior sigue recibiendo sus notificaciones en ese teléfono, incluido el inicio de sus mensajes. Corrección sugerida: borrar el token al cerrar sesión, o una RPC `registrar_push_token` `security definer` que reasigne el token.
- **`publicar_animal` y `registrar_avistamiento` aceptan cualquier `p_foto_path`**, incluida una URL externa: `urlFoto` usa tal cual las que empiezan con `https`. Permite mostrar imágenes que no pasaron por Storage. Corrección sugerida: exigir que empiece con `<auth.uid()>/`.

**Riesgos:**
- B6 se diagnosticó con la metadata del deploy, no con el log completo. El log no vino en la consigna, y el conector de Vercel no tiene permiso para leer logs del equipo `busca-labur`. Para leerlos, hay que reconectarlo autorizando ese equipo en https://claude.ai/customize/connectors.
- Las pruebas locales corrieron sobre Postgres 16 con stubs de Supabase; producción usa Postgres 17. La 0007 ya se probó en producción. La 0008 solo usa `revoke` y `grant` por columna, que no cambian entre versiones.
- El script del SQL Editor inserta usuarios de prueba en `auth.users` dentro de la transacción, y el `rollback` los descarta. Si tu proyecto tuviera triggers propios sobre `auth.users`, también se ejecutarían, pero se deshacen igual.
