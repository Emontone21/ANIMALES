# Privacidad de los casos reunidos · 2026-10-22

## 1. Resumen

**Qué se pidió:**
- Hoy cualquiera que arma `/animal/<id>` ve el mapa, la zona donde se perdió y el historial de un caso ya reunido. Una vez que el animal volvió, eso no le sirve al público y puede ayudar a ubicar la casa de la familia.
- El dueño eligió el segundo camino de los dos que dejó el reporte del muro: que el caso reunido no lo muestre a quien no participó, **aplicado en la base**.
- La regla:
  - quien no participó ve solo lo básico: la foto, el nombre si la familia lo mostró, la especie, "Volvió a casa" y, si existe, el link a su historia;
  - participaron: quien lo publicó, quienes avisaron que lo vieron, lo resguardaron o le escribieron, y moderación;
  - si el caso se reabre, vuelve a ser público.
- Además: revisar los casos vinculados, pruebas SQL con cinco miradas, el e2e y la vista previa del link.
- Partir de `main` actualizado. Nada en producción.

**Qué se hizo:**
- **La migración 0027** pone la regla en la base:
  - `ve_detalle_del_caso` entra en las políticas de lectura de `avistamientos`, `cambios_estado`, `contactos_resguardo` y `coincidencias`;
  - `animales_detalle` deja solo lo básico y suma `reservado`;
  - `animales_mapa` ya no trae esos casos;
  - el nombre y la descripción dejan de leerse directo de la tabla `animales`.
- **La app** muestra una pantalla corta para esos casos: `CasoBasico`, con "Leer cómo volvió".
- **La vista previa del link** lee lo mismo que un visitante sin cuenta.
- **Pruebas:**
  - una prueba SQL nueva con las cinco miradas y otras cinco personas;
  - siete pruebas de jest más;
  - un flujo nuevo en el e2e.
- **Producción:** no se tocó nada. La rama sale de `main` (`40ddae8`) más el reporte de cierre del PR #20, que sigue abierto.

## 2. Cambios

### Base

- **`supabase/migrations/20261022000027_privacidad_reunidos.sql`** (nueva):
  - **`participo_en_caso(principal, uid)`**, interna: si `uid` participó en el caso, en todo el árbol de reportes unidos. Cuentan:
    - publicar un reporte;
    - tener un avistamiento: lo vio, lo encontró o lo resguardó;
    - un cambio de estado;
    - un mensaje en una conversación del caso escrito **antes** del último pase a reunido.

    Si la familia (quien publicó el principal) bloqueó a esa persona, da `false`.
  - **`ve_detalle_del_caso(id)`**, para políticas y vistas (`anon` y `authenticated`):
    - da `true` salvo que el caso, o su principal si está vinculado, esté reunido;
    - en ese caso, solo para moderación o para quien participó.
  - **`vista_del_caso(id)`** (`security definer`) devuelve `completo`, el nombre y la descripción:
    - a quien no ve el detalle de un caso reunido, sin descripción;
    - el nombre, solo si la familia lo mostró en su historia y si no parece un contacto (`nombre_publicable`);
    - un caso oculto (para quien no lo publicó ni modera) no devuelve filas, como la política de `animales`.
  - **Políticas de lectura:** las de `avistamientos`, `cambios_estado`, `coincidencias` (los dos lados) y `contactos_resguardo` son las de la 0014 más `ve_detalle_del_caso`.
  - **Permisos de `animales`:** `revoke select` y `grant select` de todas las columnas menos `nombre` y `descripcion`. Ninguna política las lee con los permisos de quien consulta, y las RPC (`security definer`) siguen leyendo todo.
  - **Vistas**, con `create or replace`: mismas columnas en el mismo orden, y las nuevas al final.
    - `animales_detalle`: con `reservado`, deja en null el color, el tamaño, el collar, la descripción, quién publicó y su nombre, el contacto de la familia y la fecha del último aviso. El último punto, la cantidad de avisos y desde cuándo se perdió ya llegan vacíos por la política de `avistamientos`.
    - `animales_mapa`: suma `v.completo` al `where`.
    - `coincidencias_detalle` y `denuncias_detalle`: toman el nombre y la descripción de `vista_del_caso`.
- **`supabase/tests/privacidad_reunidos.sql`** (nueva). Además de las cinco miradas pedidas (sin cuenta, una cuenta que no participó, la vecina que avisó, la familia y una moderadora), suma a quien lo resguardó, a quien le escribió antes y a quien le escribió después de que volviera, a alguien que la familia bloqueó y a quien publicó un reporte unido. Prueba:
  - con el caso abierto, todos ven todo (también sin cuenta);
  - reunido:
    - quien no participó ve lo básico en `animales_detalle`, sin avistamientos, cambios, coincidencias, contactos ni mapa, también en el reporte unido;
    - quien participó y moderación ven exactamente lo que hay;
    - el contacto de un encontrado reunido, que antes veía cualquiera, deja de ser público;
  - los permisos por columna y de las funciones;
  - la historia sin el nombre;
  - un caso oculto por `vista_del_caso`;
  - la denuncia;
  - reabrir y volver a reunir.
- **`supabase/tests/fase8_casos.sql`:** leía la fila entera de `animales` como usuario común, y ahora eso da `permission denied`. Lee con `pg_temp.caso`, como dueña de la tabla. Lo que prueba no cambió.
- **`supabase/tests/README.md`:** la prueba nueva, el ajuste de `fase8_casos` y "0001 a 0027".

### App y vista previa

- **`src/components/reportes/CasoBasico.tsx`** (nuevo): lo básico (`docs/DISENO.md`, 7.2.1).
  - Volver, la foto (4:3, 380 de alto como máximo), el nombre o "Un perro", "Volvió a casa" y por qué no hay más.
  - "Leer cómo volvió", si hay historia y se ve. El link va en el mismo bloque aparte del muro.
- **`src/app/animal/[id]/index.tsx`:** con `reservado`, muestra `CasoBasico` en vez de `DetalleCaso`. El mapa en grande ya volvía al caso cuando no hay avistamientos, así que no cambió.
- **`src/features/reportes/permisos.ts`:** `soloLoBasico` y `tituloBasico`, reglas puras con su prueba.
- **`src/components/reencuentros/Reencuentros.tsx`:** `HistoriaEnElCaso` con `soloEnlace`, que muestra solo el botón a la historia.
- **`src/lib/compartir.ts`:** `datosParaCompartir` acepta el collar en null. De un caso reunido saca el color, el tamaño y el collar, así el texto de compartir y la vista previa dicen solo lo básico, aunque comparta alguien que participó.
- **`api/vista-previa.ts`:** lee `animales_detalle`, no la tabla: ve lo mismo que un visitante sin cuenta.
- **`src/i18n/es-UY.ts`:** `t.animal.reservado` (volvió y el aviso) y `t.reencuentros.enElCaso.leer`.
- **`src/types/database.ts`:** en `animales_detalle`, `reservado` y `tiene_collar` que puede ser null; las dos funciones nuevas; una nota en `animales`.
- **`src/app/animal/[id]/editar.tsx`:** el collar con `?? false`, por el tipo nuevo. Editar es solo de quien publicó, que siempre ve todo.

### Pruebas de la app

- **`__tests__/vista-previa.test.ts`:**
  - lee de `animales_detalle`;
  - un reunido como lo manda la base: con nombre y sin nombre;
  - un reunido sin color, tamaño ni collar aunque la base los mandara.
- **`__tests__/compartir.test.ts`:** lo que se comparte de un caso reunido.
- **`__tests__/permisos.test.ts`:** `soloLoBasico` y `tituloBasico`.
- **`__tests__/datos/casos.ts`:** `reservado: false` en el caso de ejemplo.
- **`e2e/flujos.spec.ts`**, flujo nuevo después del muro:
  - sin cuenta, `/animal/<id>` de Toby reunido muestra la foto, el nombre, "Volvió a casa" y el aviso, y nada del historial, la descripción, el color, las notas, los contactos ni los nombres de la familia o la vecina;
  - `/mapa` vuelve ahí;
  - "Leer cómo volvió" abre la historia;
  - la vecina y la familia ven el detalle completo.

### Documentación

- **`docs/DECISIONES.md`:** "Privacidad de los casos reunidos, en la base", y el pendiente del muro, resuelto.
- **`docs/ARQUITECTURA.md`:** el flujo, el modelo, las vistas, las funciones, la seguridad y las pruebas.
- **`docs/DISENO.md`:** 7.2.1, lo básico de un caso reunido.
- **`docs/PRUEBAS-MANUALES.md`:** el paso 33.
- **`AGENTS.md`:** la regla "Casos reunidos (0027)", la estructura y las fases. También marca hecho en producción el muro de reencuentros, que se cerró en el PR #19.
- **`README.md`:** la sección y la estructura.

### Los casos vinculados (punto 4 del pedido)

- **Un reporte unido a un caso reunido vale lo que su principal.** `ve_detalle_del_caso` sigue `vinculado_a` hasta el principal (`caso_principal`). Si el principal está reunido, del reporte unido quien no participó ve lo básico, y la app lo sigue mandando al principal, que también muestra lo básico.
- **Participar en cualquier reporte del árbol cuenta para todo el caso.** Por ejemplo, la vecina que publicó un encontrado que la familia unió al perdido ve todo el caso y su propio reporte.
- **Los avistamientos del reporte unido** pasan al principal al unirlo (`resolver_coincidencia`, desde siempre). Los cambios de estado del reporte unido (el "vinculado") se ven con la misma regla.
- **Las coincidencias:** una que quedó pendiente con un caso que después se reunió deja de verla quien no participó en ese caso. Ya no se crean coincidencias con casos cerrados: los candidatos son solo abiertos.
- Probado en `privacidad_reunidos.sql`, en las partes 4, 5 y 9.

## 3. Verificaciones

| Verificación | Resultado |
| --- | --- |
| `npm run typecheck` | Sin errores. |
| `npm run lint` | Sin errores ni avisos. |
| `npm run test` | 31 suites, **341 pruebas** (siete más). |
| `npx expo export -p web` | Bien. |
| Pruebas SQL | **14 de 14** en Postgres 16 local con 0001 a 0027 y el seed, de a una: las 13 de siempre más `privacidad_reunidos`. |
| La prueba nueva atrapa los errores | Se rompió la regla a propósito de ocho maneras, dentro de la transacción de la prueba, y la prueba falló en cada una (detalle abajo). Sin la 0027 falla en la 0a. |
| e2e con el build real y el Supabase simulado | Teléfono **21 de 21** y computadora **21 de 21**, con el flujo nuevo. Con el simulado sin la regla, el flujo nuevo falla. |
| Bloques web (gzip, contra `main`) | `__common` +0,09 KB (los textos). La ruta `/animal/[id]` +0,75 KB (`CasoBasico`). El resto, igual. |

**Las ocho maneras de romper la regla, y dónde falló la prueba:**

| Regla rota | Falla |
| --- | --- |
| Sin la regla en `avistamientos` | 4a1 |
| Sin el límite de tiempo de los mensajes | 5e |
| Sin el bloqueo | 5f |
| Sin el nombre oculto de la historia | 7a |
| Sin seguir al principal | 4a2 |
| Sin la regla en `contactos_resguardo` | 6a |
| Con la descripción legible en la tabla | 0a |
| Sin la regla en `coincidencias` | 4a1 |

**Cómo se probó:**
- **Pruebas SQL:** Postgres local con los mismos stubs de Supabase de siempre. Las 13 de antes siguen pasando con la 0027; solo `fase8_casos` necesitó el ajuste de la sección 2.
- **e2e:**
  - Se corrió contra el Supabase simulado del entorno, al que se le sumó la misma regla. Todavía no hay proyecto de pruebas.
  - Cada proyecto, por separado: correrlos juntos falla porque el primero borra las cuentas.
  - El build del e2e lleva una clave VAPID pública de mentira, generada al vuelo, como en las corridas anteriores.
- **A ojo:** capturas de la pantalla nueva en teléfono, claro y oscuro, y en computadora. Al verla en computadora, la foto se limitó a 380 de alto.

`deno test` no se corrió: no se tocaron las funciones `reconocer` ni `avisar`.

## 4. Pasos manuales

Nada se aplicó en producción. Cuando el dueño lo autorice, en este orden:

1. **Mergear el PR y esperar el deploy de Vercel en READY.**
   - **Hay que hacerlo antes de la migración.** La vista previa de hoy lee la tabla `animales` con la columna `nombre`: si la 0027 se aplica primero, hasta el deploy todas las vistas previas de casos salen genéricas.
   - La app nueva sin la 0027 funciona como siempre: `reservado` no llega y se muestra el detalle de siempre.
2. **Aplicar la 0027 y registrarla.**
   - En el SQL Editor: pegar `supabase/migrations/20261022000027_privacidad_reunidos.sql` entre `begin;` y `commit;`. Después:
     ```sql
     insert into supabase_migrations.schema_migrations (version, name)
     values ('20261022000027', 'privacidad_reunidos');
     ```
   - O, con el proyecto enlazado: `npx supabase db push`.
3. **Correr las pruebas SQL**, de a una, en el SQL Editor: `supabase/tests/privacidad_reunidos.sql` y las 13 de siempre. `fase8_casos.sql` cambió.
   - Bien: "Success. No rows returned".
   - Todas terminan en `rollback`.
4. **Comprobar** que sin cuenta no se lee la descripción de la tabla. Tiene que dar `false`:
   ```sql
   select has_column_privilege('anon', 'public.animales', 'descripcion', 'select');
   ```
5. **A mano:** el paso 33 de `docs/PRUEBAS-MANUALES.md`, con un caso de prueba reunido. Incluye pegar el link del caso en WhatsApp, que es la prueba de la vista previa con un bot de verdad.

No hay variables nuevas en Vercel, ni secretos, ni cambios en `config_app`.

## 5. Pendientes y riesgos

- **Lo que sigue legible en la tabla `animales`** de un caso reunido, para cualquiera con el id: la especie, el color, el tamaño, el collar, el estado, las fechas y quién publicó (con su nombre público en `perfiles`). Nada de eso es una ubicación. Cerrarlo pediría más permisos por columna, y las políticas que usan `creado_por` lo complican.
- **Conversaciones nuevas:** cualquiera con cuenta puede abrir una conversación con la familia de un caso reunido, como antes.
  - No le da datos del caso: escribir después de que volvió no cuenta como participar.
  - Si se quiere cortar, es un cambio chico en `abrir_conversacion`.
  - De paso: esos mensajes cuentan en la lista de a quién agradecer (`participantes_internos`), que no tiene límite de tiempo.
- **El nombre oculto y compartir:** si la familia contó la historia sin el nombre, quien participó lo sigue viendo. Si comparte el caso desde la app, el texto lleva el nombre. La vista previa del link no lo lleva, porque la arma el servidor sin cuenta.
- **El filtro "Reunido con su familia" del mapa** muestra solo los reunidos en los que participaste (moderación, todos). Para el resto está el muro.
- **Quien sigue un caso sin haber participado** pasa a ver lo básico cuando se reúne.
- **Alguien a quien la familia bloqueó** y que publicó un reporte unido al caso ve lo básico, y ese reporte deja de salir en sus "Mis reportes": la vista no le da `creado_por`. Es raro, pero queda anotado.
- **Rendimiento:** las políticas llaman a `ve_detalle_del_caso` por cada fila de `avistamientos` que se lee (el mapa lee el último aviso y la cantidad de cada caso). Para un caso que no está reunido son una o dos búsquedas por clave. Con el volumen de hoy no se nota; si el mapa crece mucho, conviene medirlo.
- **La política de privacidad** (`t.legal`) no menciona esta regla. No hace falta para aplicarla, porque muestra menos que antes. Si se cambia el texto, hay que subir la versión de los términos.
- **e2e contra un backend real:** sigue sin haber proyecto de pruebas. La primera corrida contra spot-pruebas es la que cuenta.
- **Tipos:** `src/types/database.ts` se actualizó a mano. Conviene regenerarlo cuando la 0027 esté aplicada y comparar.
