# Cierre del muro de reencuentros · 2026-10-22

## 1. Resumen

**Qué se pidió:**
1. Antes del merge, un cambio chico en el PR #19: sacar "Ver el caso" del muro y de `/reencuentros/<id>` para quien no es la familia ni moderación, con su prueba y el e2e.
2. Después, con autorización del dueño, los pasos de la sección 4 de `docs/reportes/2026-10-22-reencuentros.md`, frenando si algo fallaba:
   1. desplegar la función `avisar`;
   2. aplicar la 0025, después la 0026, y registrarlas;
   3. correr las 13 pruebas SQL de a una;
   4. mergear el PR #19 con merge commit y esperar el deploy de producción en READY.

**Qué se hizo:** todo, en ese orden y sin ninguna falla. No hizo falta forzar ningún deploy. Ningún secreto ni clave quedó en este reporte ni en otro archivo.

| Paso | Resultado |
| --- | --- |
| 0. "Ver el caso" | Commit **`e64cca4`** en el PR. Reporte: `docs/reportes/2026-10-22-reencuentros-ver-el-caso.md`. |
| 1. Función `avisar` | Desplegada: **versión 2**, `ACTIVE`, `verify_jwt` apagado. Con el secreto de la base responde 200; sin él, 401. |
| 2. 0025 y 0026 | Aplicadas, cada una en su transacción, y registradas: **26 versiones**, la última `20261022000026 reencuentros`. |
| 3. Pruebas SQL | **13 de 13** sin errores, de a una, sin dejar datos. |
| 4. Merge y deploy | Merge commit **`40ddae8`**. Deploy `dpl_FDx9gmdGGkVsyLdXhQyUEiYVfpZw`: **READY** a las 16:42:20 UTC, con el alias `animales-blue.vercel.app`. |

## 2. Cambios

En este commit, solo este reporte. Lo demás ya está en `main`:
- **El cambio de "Ver el caso"** (`e64cca4`): la regla `opcionesDeHistoria`. La app pregunta por la fila de `historias_reencuentro`, que su RLS da solo a la familia y a moderación. Suma una prueba de jest, la FALLA 4h de `reencuentros.sql` y el e2e. Detalle en su reporte.
- **En producción, fuera del repo:**
  - la función `avisar`, versión 2;
  - las migraciones 0025 y 0026 y sus registros en `supabase_migrations.schema_migrations`;
  - el deploy de Vercel del merge.

### Paso 1. La función `avisar`

- **El deploy:** `npx supabase functions deploy avisar --project-ref bwqvuttuodwypwxckxgf --use-api --no-verify-jwt`, con el código de `e64cca4`. En `supabase/functions/avisar` es igual a `57cba68`. Subió los 8 archivos de la función.
  - La CLI pide `SUPABASE_ACCESS_TOKEN` aunque el proxy ponga el token real, así que se le pasó un valor de relleno, como en el cierre anterior.
- **Antes:** versión 1. **Después:** versión 2, `ACTIVE`, `verify_jwt: false`.
- **Dos pedidos desde la base, con `pg_net`:**
  - con `select public.llamar_avisar()`, que manda el secreto de `config_app`: 200 `{"avisos":0,"enviados":0,"vencidas":0,"errores":0}`;
  - sin `X-Avisar-Secret`: 401 `{"error":"no_autorizado"}`.

### Paso 2. Las migraciones

**Antes, solo lectura:**
- 24 versiones; la última, `20261022000024 avisos_al_celular`.
- Nada de la 0025 ni de la 0026.
- Ninguna cuenta de prueba.
- La cola de `pg_net` vacía.

**La 0025:** el archivo entero, en un solo pedido a la API de gestión, entre `begin` y `commit`, con su registro (`'20261022000025', 'tipo_notificacion_agradecimiento'`). El tipo `tipo_notificacion` ya tiene `agradecimiento`.

**La 0026:** igual, en otro pedido, con su registro (`'20261022000026', 'reencuentros'`). El archivo es el mismo del PR: no cambió con `e64cca4`.

**Después:**
- **Versiones:** 26; las últimas, `20261022000026 reencuentros` y `20261022000025 tipo_notificacion_agradecimiento`.
- **RLS** activa en `historias_reencuentro` y `agradecimientos`, con sus políticas ("la familia y moderación" y "la familia y quien lo recibe"). En `denuncias`, la política "denuncias: crear" nueva y la unicidad `(animal_id, usuario_id, historia)`.
- **Quién puede ejecutar cada función:**
  - `anon` y `authenticated`: `contador_reencuentros`, `muro_reencuentros` e `historia_reencuentro`;
  - solo `authenticated`: `guardar_historia_reencuentro`, `fotos_de_la_historia`, `borrar_historia_reencuentro`, `participantes_del_caso`, `agradecer`, `familias_que_ayude`, `moderar_historia` y `hay_historia`;
  - nadie (son internas): `es_foto_de_demo`, `nombre_publicable`, `datos_del_reencuentro`, `caso_de_la_familia`, `foto_en_uso`, `archivos_de_foto` y `participantes_internos`.
- **Contador y muro:** `contador_reencuentros()` da 0 y el muro está vacío, también como `anon`. Hoy no hay ningún caso reunido en producción.

### Paso 3. Las pruebas SQL

De a una, cada una en un pedido a la API de gestión. Después de cada una se miró que no quedaran cuentas de prueba (`@spot.test` o `@encontrados.test`) ni pedidos en la cola de `pg_net`.

| # | Prueba | Resultado | Después |
| --- | --- | --- | --- |
| 1 | `fase5_permisos` | Sin errores | 0 cuentas de prueba, cola vacía |
| 2 | `fase6_perdidos` | Sin errores | 0, vacía |
| 3 | `fase7_cuenta` | Sin errores (devuelve la fila de un `set_config` que tiene en el medio, como siempre) | 0, vacía |
| 4 | `fase8_casos` | Sin errores | 0, vacía |
| 5 | `fase9_revision` | Sin errores | 0, vacía |
| 6 | `fase9_parte2` | Sin errores | 0, vacía |
| 7 | `errores` | Sin errores | 0, vacía |
| 8 | `vision` | Sin errores | 0, vacía |
| 9 | `reconocimiento_ia` | Sin errores | 0, vacía |
| 10 | `contacto_al_cerrar` | Sin errores | 0, vacía |
| 11 | `auditoria_2` | Sin errores | 0, vacía |
| 12 | `avisos_push` | Sin errores. Corrió con la función ya conectada: desde el PR #19 su primer control no exige `avisar_url` vacía. | 0, vacía |
| 13 | `reencuentros` | Sin errores | 0, vacía |

**Sin datos de más:**
- **Conteos:** los de las 25 tablas de `public` más `storage.objects` y `auth.users`, después de las pruebas, son idénticos a los de después de las migraciones. Esos, a su vez, son los de antes más las dos tablas nuevas, vacías. Por ejemplo: `animales` 6, `avistamientos` 7, `notificaciones` 9, `perfiles` y `auth.users` 4, `storage.objects` 4, `config_app` 19.
- **`config_app` intacta:**
  - `avisar_url` y `vision_url` siguen apuntando a las funciones del proyecto;
  - `avisar_secret` tiene su forma (64 hexadecimales);
  - los topes son los de siempre (10 publicaciones y 30 avisos por hora y cuenta, 6 avisos al celular por hora);
  - ninguna fila se actualizó en esos minutos.
- **`pg_net`:** ningún pedido nuevo después de los dos del paso 1, y la cola vacía. Las pruebas cargan URL y secretos de mentira dentro de su transacción y terminan en `rollback`, así que `pg_net` no manda nada.

### Paso 4. El merge y el deploy

- **Antes del merge:**
  - el deploy de preview del último commit del PR (`e64cca4`) estaba READY;
  - el único check del PR (los comentarios de Vercel) estaba en verde;
  - se actualizó la descripción del PR con el tercer commit y lo hecho en producción.
- **El merge:** con merge commit, fijando el commit esperado (`e64cca4`). Resultado: **`40ddae8`** en `main`.
- **El deploy:** el automático del merge, `dpl_FDx9gmdGGkVsyLdXhQyUEiYVfpZw`, con `githubCommitSha` `40ddae8`. Empezó a las 16:41:01 UTC y quedó **READY** a las 16:42:20 UTC, con los alias `animales-blue.vercel.app`, `animales-busca-labur.vercel.app` y `animales-git-main-busca-labur.vercel.app`.
- **En producción:**
  - `/reencuentros` responde 200 con el build nuevo;
  - `/api/vista-previa?historia=<id>` de una historia que no existe devuelve las etiquetas genéricas del muro ("Reencuentros en Spot", "Animales que volvieron a casa en Montevideo, contados por sus familias.") y el `og:url` de la historia.
  - El proxy de este entorno no deja salir a `vercel.app` con `curl`, así que se leyó con la herramienta de Vercel, que no deja elegir el user-agent. Por eso la reescritura para bots de `vercel.json` no se probó desde acá.

## 3. Verificaciones

| Verificación | Resultado |
| --- | --- |
| `npm run typecheck`, `npm run lint`, `npx expo export -p web` | Sin errores, con `e64cca4` (sección 3 de su reporte). Este commit solo suma este archivo. |
| `npm run test` | 31 suites, 334 pruebas. |
| e2e contra el build real y el Supabase simulado | Teléfono 20 de 20, computadora 20 de 20, con `e64cca4`. |
| Pruebas SQL en producción | 13 de 13, de a una, sin dejar datos (paso 3). |
| Función `avisar` en producción | 200 con el secreto, 401 sin él (paso 1). |
| Tipos de la base | Se generaron desde producción a un archivo aparte (`supabase gen types`), sin tocar `src/types/database.ts`. Las tablas, columnas, argumentos y resultados de todo lo nuevo coinciden con los escritos a mano. El archivo generado no reemplaza tal cual al del repo: con él, `tsc` marca 192 errores en casi toda la app. Dos motivos, que ya existían antes: en las vistas, toda columna sale como posible `null`, y los argumentos con default salen opcionales sin `null`. Por eso `database.ts` queda como está. |

`deno test`, `deno lint` y `deno fmt --check` de `supabase/functions/avisar` no se volvieron a correr: el código desplegado es el de `57cba68`, que ya pasaba (25 pruebas).

## 4. Pasos manuales

Lo que queda para el dueño:
1. **Probar en celulares de verdad:** el paso 32 de `docs/PRUEBAS-MANUALES.md`, con un perdido de prueba que se reúna.
   - Ahí se ve el agradecimiento llegar al celular, la imagen "VOLVIÓ A CASA" en Instagram y la vista previa del link de una historia pegado en WhatsApp. Esa es la prueba de la reescritura para bots que no se pudo hacer desde acá.
   - Al terminar, borrar esa historia y ese caso si no tienen que quedar en el muro.
2. **Nada más que configurar:** no hay variables nuevas en Vercel, secretos nuevos en la función ni cambios en `config_app`.

## 5. Pendientes y riesgos

- **El id de la historia es el del caso** (detalle en `docs/reportes/2026-10-22-reencuentros-ver-el-caso.md`). Sin el botón, el caso de una historia sigue abierto a quien arme `/animal/<id>` a mano, con su mapa, la zona y el historial. Para cerrarlo hace falta una de dos:
  - un id propio de la historia, con una migración nueva;
  - o que el detalle de un caso reunido no muestre la zona ni el historial a quien no participó.
- **El texto de privacidad** (`t.legal`) no menciona el muro, las historias ni los agradecimientos. Cambiarlo pide subir la versión de los términos, y todos vuelven a aceptar.
- **e2e contra un backend real:** sigue sin haber proyecto de pruebas. Se corrió contra un Supabase simulado; la primera corrida contra spot-pruebas es la que cuenta.
- **El muro está vacío** hasta que alguna familia cuente su historia. Mientras haya menos de 5 reunidos, el contador dice "Los primeros reencuentros de Spot".
