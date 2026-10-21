# Cierre del reconocimiento con IA · 2026-10-20 y 21

## 1. Resumen

El reconocimiento con la API de Claude se cerró en tres rondas. Las dos primeras frenaron en la prueba real, por la clave y por el largo de las respuestas. En la tercera todo anduvo, pero la coincidencia de Toby no llegó al umbral, y se decidió dejarlo así hasta probar con fotos reales.

### Primera ronda: el PR #12 (20 de octubre)

| Paso | Resultado |
| --- | --- |
| 0. Textos | Hecho (commit `5d3b155`). La app dice "inteligencia artificial" o "IA". Solo la política de privacidad nombra a Anthropic, como proveedor. |
| 1. Migración 0018 | Hecho. Aplicada y registrada, de 0001 a 0018. |
| 2. Pruebas SQL | Hecho. Pasan las 9, de a una, sin dejar datos. `reconocimiento_ia.sql` falló la primera vez por la prueba, no por la base; se arregló (commit `953bcdd`) y pasó. |
| 3. Función | Hecho. `reconocer` está desplegada con `verify_jwt` apagado. El secreto se generó al azar en la base y se cargó con la URL. Un pedido sin secreto recibe 401. |
| 4. Prueba real | **Falló.** Ninguna foto se procesó. Las de placedog.net, con `invalid_request_error`; las de cataas.com, como "foto no disponible". La causa no se supo: solo quedaba el tipo de error. |
| 6. Merge | Hecho. PR #12 mergeado con merge commit: `0800117`. |
| 7. Deploy | Hecho. `dpl_DP7bfAz3CL4yremT9kysNXHegjAe` en **READY**. |

Para la falla se armó el PR #13, primer commit (`8872184`):
- las fotos de otros sitios las baja la función;
- se sacó la comprobación HEAD;
- el texto del error de la API queda en `llamadas_ia.detalle` (migración 0019).

### Segunda ronda: el PR #13 (21 de octubre)

| Paso | Resultado |
| --- | --- |
| 1. Migración 0019 | Hecho. Aplicada y registrada: el historial tiene 19 versiones distintas, de 0001 a 0019. `detalle` acepta hasta 300 caracteres. |
| 2. Pruebas SQL | Hecho. Pasan las 9, de a una. Los conteos, la cola y la configuración quedaron iguales antes y después. |
| 3. Función | Hecho. Desplegada con el código del PR, con `verify_jwt` apagado. Versión 2, y versión 4 después del cambio de clave. |
| 4. Cola | Hecho. Las 5 fotos volvieron a pendiente y se prendió el reconocimiento. |
| 5. Prueba real | **Falló, dos veces, por cosas distintas.** Ver abajo. El reconocimiento quedó apagado. |
| 6 a 8. Reporte, merge y deploy | Sin hacer: se frenó en el paso 5. |

**Primer intento (00:15 UTC): la clave**
- Las 5 llamadas fallaron con este detalle (ahora sí guardado):
  ```
  invalid_request_error: This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header with the ID of the workspace to use. Add the header, or use an API key that is scoped to a workspace. (req_011CgERF77vr4jgLKeJjhXC7)
  ```
- Casi seguro, es la misma causa de la falla del 20, y no el `image/jpg` de placedog.net: era el mismo tipo de error, igual de rápido y con 0 tokens.
- Esta vez las fotos de cataas.com llegaron a la API: la descarga anduvo.
- El dueño cambió `ANTHROPIC_API_KEY` por una clave del workspace EMontone, y se volvió a desplegar la función.

**Segundo intento (00:44 UTC): el largo**
- La API anduvo. Se crearon 4 descripciones (los 2 gatos, el perro negro y Toby) y 1 comparación, la del perro negro contra Parque Rodó: 4 de confianza, "distinto".
- Dos respuestas se rechazaron, y volvieron a rechazarse en el reintento de los 5 minutos:
  - **Parque Rodó, describir:** detalle `rasgos` (más de 8, o alguno de más de 80 caracteres).
  - **Toby, comparar contra Parque Rodó:** detalle `motivo` (más de 140 caracteres).
- No hubo coincidencia, así que no hay motivo de Toby.
- Se apagó el reconocimiento (00:52 UTC) para que no siguiera en bucle.

### Segundo commit del PR #13 (`c76161a`): recortar en vez de rechazar

- **Recorte:** si lo único mal es el largo, se recorta:
  - el motivo, a 140 en el último espacio, con "…";
  - los rasgos, los primeros 8 y cada uno a 80.
- **Avisos:** lo recortado queda en `detalle` ("C1 motivo: 163 > 140"), y la llamada queda `ok`.
- **Lo demás** se sigue rechazando como hasta ahora.
- **Al modelo** se le piden motivos de hasta 110 caracteres y rasgos de hasta 60.

**Para revisar:** `coinciden` y `difieren` de la comparación se recortan igual que los rasgos. Son listas de rasgos con los mismos topes, y si no se recortaran podrían frenar la comparación por la misma razón.

### Tercera ronda: el commit `c76161a` (21 de octubre)

| Paso | Resultado |
| --- | --- |
| 1. Función | Hecho. Desplegada con `c76161a`: versión 5, activa, `verify_jwt` apagado. Un pedido sin secreto recibe 401. |
| 2. Cola | Hecho. Parque Rodó y Toby volvieron a pendiente y se prendió el reconocimiento (01:08 UTC). |
| 3. Prueba real | La función respondió `{"procesados":2,"errores":0,"quedan":0}`. Las 5 fotos de demo quedaron procesadas, sin errores ni recortes. **No se creó la coincidencia** de Toby con Parque Rodó: la IA les dio 60, y el umbral es 70. |
| 4. Reconocimiento | Se apagó para frenar y consultar. Después, con la decisión del dueño, quedó **prendido** (`ia_activa = 'true'`). |
| 5. Reporte | Este. |
| 6. Merge y deploy | El PR #13 se mergea con merge commit después de este commit, y se confirma el deploy de Vercel. |

**Descripción de Parque Rodó** (la que faltaba):
- perro negro y dorado, tricolor, chico, collar no se ve;
- raza "chihuahua o mestizo pequeño", calidad buena;
- 7 rasgos, entre ellos "cachorro muy pequeño dentro de una taza blanca", "mancha blanca en la frente" y "patas delanteras blancas".

**Comparación de Parque Rodó con Toby:**
- Confianza 60, veredicto "posible".
- Motivo, de 123 caracteres: "Las fotos son idénticas (misma taza y misma pose), pero los datos declarados no coinciden: tamaño, color y collar. Revisar."
- Coinciden: "Foto idéntica: misma taza con lunares rojos", "Patrón tricolor negro, dorado y blanco", "Mancha blanca en la frente", "Patas delanteras blancas", "Orejas grandes, una algo caída" y "Hocico y cejas dorado-crema".
- Difieren: "Tamaño declarado mediano; se ve chico", "Color declarado marrón con pecho blanco; se ve negro y dorado", "Collar declarado; no se ve collar en la foto" y "Foto posiblemente reutilizada de internet".

**Por qué no llegó al umbral:**
- Los dos casos de demo están declarados igual ("marrón con pecho blanco", mediano, con collar), pero su foto, la misma, muestra un cachorro negro y dorado, chico y sin collar. La IA bajó la confianza por esa contradicción y avisó que la foto podía estar sacada de internet.
- Con 60, `guardar_comparacion_ia` guardó el par en `comparaciones_ia` y no creó la coincidencia.
- La foto de Toby salió de la cola sin llamar a la API: ese par ya estaba comparado.

**Decisión del dueño:**
- Aceptar el resultado: el par de demo no es una prueba realista, porque tiene la foto idéntica y datos que la contradicen.
- No cambiar `umbral_ia` (70) ni el pedido hasta tener datos de fotos reales.
- Dejar el reconocimiento prendido y probar con el flujo 26.

**Avisos de recorte:** ninguno. Las respuestas entraron en los topes: el motivo tiene 123 caracteres y las listas, 7, 6 y 4 rasgos.

## 2. Cambios

### Del cierre del PR #12 (ya en main)

- `src/i18n/es-UY.ts`, `__tests__/reconocimiento.test.ts`, `docs/DISENO.md`, `AGENTS.md`, `docs/PRUEBAS-MANUALES.md`: los textos con "IA" y la prueba que falla si la marca aparece fuera de la privacidad. No hizo falta subir la versión de los términos: la `2026-10-20` todavía no la había aceptado nadie.
- `supabase/tests/reconocimiento_ia.sql` (2b y 3g): miran solo los casos de la prueba. En producción, el perro de Parque Rodó queda a 918 m del perdido de la prueba.

### Del primer commit del PR #13 (`8872184`)

**Migración**
- `supabase/migrations/20261020000019_detalle_llamadas_ia.sql`: `llamadas_ia.detalle` hasta 300 caracteres (la restricción y `terminar_llamada_ia`).

**Función `reconocer`**
- `descargar.ts`:
  - baja las fotos de otros sitios: tipo por los bytes (JPEG, PNG, WebP o GIF), hasta 5 MB y 10 s;
  - `procesar.ts` manda hasta 20 MB de fotos bajadas por pedido.
- `procesar.ts` y `fotos.ts`: sin HEAD; las fotos del bucket van con la URL de la miniatura.
- `claude.ts`: `clasificarError` devuelve `codigo` (para la cola) y `detalle`: tipo, texto e id del pedido, limpios con `limpiarDetalle`.

**Pruebas**
- Deno: `descargar_test.ts`, `procesar_test.ts`, `claude_test.ts`.
- Jest: `__tests__/imagenes.test.ts`.
- SQL: parte 9 de `reconocimiento_ia.sql`. Además, `vision.sql` y `fase9_revision.sql` prenden el reconocimiento dentro de la transacción.

**Docs:** ARQUITECTURA, DECISIONES, PRUEBAS-MANUALES, README, AGENTS y `supabase/tests/README.md`.

### Del segundo commit del PR #13 (`c76161a`)

**Función `reconocer`**
- `validar.ts`:
  - `recortar` corta en el último espacio antes del tope, con "…" incluido y sin la puntuación que queda colgando; sin espacios, justo en el tope.
  - `largo` cuenta caracteres como `char_length` de Postgres: un emoji es uno y no se parte.
  - `OBJETIVOS`: 110 para el motivo y 60 para cada rasgo.
  - `validarDescripcion` y `validarComparacion` devuelven `avisos`: el motivo largo y las listas de rasgos, `coinciden` y `difieren` se recortan.
  - Un elemento que no es texto, o vacío, sigue sin valer, aunque esté después del octavo.
  - `collar_color` y `raza_aproximada` largos siguen sin valer, y ahora el detalle dice cuánto ("collar_color: 45 > 40").
- `claude.ts`:
  - el pedido de describir y el de comparar piden motivos de hasta 110 caracteres y rasgos cortos de hasta 60, igual que las descripciones de las herramientas;
  - `Respuesta` lleva `avisos`.
- `procesar.ts`: una llamada que salió bien guarda sus avisos en `detalle`, limpios, y queda `ok`. Una inválida guarda su motivo, también limpio.

**Pruebas de Deno**
- `pruebas/validar_test.ts`:
  - `recortar` (espacio, puntuación, sin espacios, emoji);
  - el motivo largo;
  - más de 8 rasgos y uno de más de 80;
  - `coinciden` y `difieren`;
  - lo inseguro, rechazado aunque también haya algo para recortar;
  - los casos anteriores, ajustados.
- `pruebas/procesar_test.ts`: una descripción con 10 rasgos y una comparación con un motivo largo terminan bien, recortadas, con los avisos en `detalle`, sin errores en la cola y con la coincidencia creada.
- `pruebas/claude_test.ts`: el pedido dice 110 y 60.

**Docs**
- `docs/ARQUITECTURA.md`: "Reconocer" y `llamadas_ia`.
- `docs/DECISIONES.md`: entrada nueva, "Los largos se recortan en vez de rechazar la respuesta".
- `AGENTS.md` y `docs/PRUEBAS-MANUALES.md` (flujo 26).
- Este reporte.

### De este commit

- Solo este reporte, con la tercera ronda. No cambia código, así que las verificaciones de abajo siguen valiendo para `c76161a`.

## 3. Verificaciones

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | Sin errores |
| `npm run lint` | Sin errores |
| `npm run test` | 19 suites, 194 pruebas pasan |
| `npx expo export -p web` | Sin errores |
| `deno test --allow-env` (en `supabase/functions/reconocer`) | 58 pasan (51 de antes y 7 nuevas) |
| `deno lint`, `deno fmt --check`, `deno check` (también `scripts/evaluar-ia.ts`) | Sin errores |

**Las pruebas nuevas detectan las fallas.** Con el código roto a propósito, falla la prueba que corresponde en cada caso:
- rechazar el motivo largo, como antes;
- no quedarse con los primeros 8;
- aceptar elementos que no son texto;
- no guardar el aviso;
- pedir 140 en vez de 110.

**Pruebas SQL:** este commit no toca la base. En la segunda ronda pasaron las 9 en producción, sobre 0001–0019.

**Uso medido en producción** (segunda ronda, segundo intento, `claude-haiku-5-5`, fotos de demo de 640 × 480 bajadas por la función):

| Llamada | Cuántas | Entrada | Salida | Costo |
| --- | --- | --- | --- | --- |
| Describir | 6 (4 bien, 2 rechazadas) | 2.014 tokens | 379 a 855 | US$ 0,00039 a 0,00063 |
| Comparar con un candidato | 3 (1 bien, 2 rechazadas) | 2.564 a 2.588 | 466 a 1.006 | US$ 0,00049 a 0,00076 |
| **Total** | 9 | 19.824 | 5.645 | **US$ 0,0048** |

**Uso medido en la tercera ronda:**

| Llamada | Entrada | Salida | Costo |
| --- | --- | --- | --- |
| Describir Parque Rodó | 2.078 tokens | 558 | US$ 0,000487 |
| Comparar Parque Rodó con Toby | 2.868 | 895 | US$ 0,000734 |
| **Total de la ronda** | 4.946 | 1.453 | **US$ 0,0012** |

**Desde el principio:** 19 llamadas, 24.770 tokens de entrada y 7.098 de salida, US$ 0,0060.

**Costo por foto medido:** unos US$ 0,0005 sin candidatos y unos US$ 0,001 a 0,0012 con un candidato (describir más comparar).
- Es más de lo estimado (1.300 tokens por descripción), porque las fotos de demo miden 640 × 480 y una miniatura del bucket, 320 × 320.
- Las respuestas rechazadas también se cobran: este arreglo las evita.
- Las llamadas que fallaron por la clave no se cobraron.

## 4. Pasos manuales

No queda nada por aplicar: la 0019 está aplicada, la función desplegada con `c76161a` y el reconocimiento prendido.

1. **Probar con fotos reales** (flujo 26 de `docs/PRUEBAS-MANUALES.md`): un perdido y un encontrado del mismo perro, con dos fotos distintas y subidas desde la app. Así se prueba también el envío por URL desde el bucket, y quedan datos para decidir el umbral y el pedido.
2. **Mirar el uso y los avisos**:
   ```sql
   select id, created_at, tipo, resultado, tokens_entrada, tokens_salida, costo_usd, detalle
   from llamadas_ia order by id desc limit 20;
   select c.confianza, c.veredicto, c.motivo from comparaciones_ia c order by c.created_at desc limit 20;
   ```
   Las llamadas `ok` con `detalle` son las que se recortaron. Las comparaciones guardan también las que no llegaron al umbral: sirven para calibrarlo.
3. **Para apagarlo** en cualquier momento:
   ```sql
   update public.config_app set valor = 'false', updated_at = now() where clave = 'ia_activa';
   ```
   El tope de 300 llamadas por día (`ia_tope_diario`) y la pausa sin crédito siguen activos.

## 5. Pendientes y riesgos

- **No hubo coincidencia entre Toby y Parque Rodó** (confianza 60, umbral 70). Por decisión del dueño, el umbral y el pedido se ajustan cuando haya datos de fotos reales.
- **El par ya está comparado,** así que no se vuelve a comparar solo. Para repetirlo habría que borrar su fila de `comparaciones_ia` y volver a la cola una de las dos fotos.
- **Mandar fotos del bucket por URL a la API no está probado en producción:** el bucket está vacío, porque todas las fotos son de demo. Lo prueba el paso 1 de arriba.
- **El reconocimiento queda prendido:** cada foto nueva gasta entre US$ 0,0005 y 0,0012, con un tope de 300 llamadas por día (unos US$ 0,30 por día como máximo, con estos tamaños).
- **Un motivo recortado puede quedar a medias** ("…"). Los avisos de `detalle` dicen cuántos y cuánto. Si se repiten, conviene bajar el objetivo a menos de 110 o revisar el pedido.
- **Las fotos de demo no coinciden con sus datos:** placedog.net da para "perro negro, grande" un cachorro dorado, y para Toby, "marrón con pecho blanco, mediano, con collar", un cachorro negro y dorado sin collar. Por eso no sirven para calibrar.
- **Uso hasta ahora:** 19 llamadas registradas desde el 20. Costaron US$ 0,0060 en total:
  - 8 fallaron por la clave, sin costo;
  - 4 se rechazaron por largo y se cobraron (US$ 0,0025);
  - 7 salieron bien (US$ 0,0036).
- **La URL y el secreto de la función** están en `config_app`, y no en este reporte ni en ningún archivo.
