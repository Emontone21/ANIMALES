# Cierre del reconocimiento con IA · 2026-10-20

## 1. Resumen

**Qué se pidió:** cerrar el reconocimiento con la API de Claude (PR #12), en orden y frenando si algo fallaba:
- 0, ajustar los textos de la app;
- 1, aplicar la 0018 en producción;
- 2, correr las pruebas SQL;
- 3, desplegar la función y conectarla;
- 4, una prueba real de punta a punta;
- 5 a 7, el reporte, el merge y el deploy.

**Qué se hizo:** la prueba real (paso 4) falló, y se frenó ahí. El dueño autorizó dos cosas:
- mergear y desplegar para destrabar la web;
- un arreglo, en este PR, sin volver a desplegar la función hasta revisarlo.

| Paso | Resultado |
| --- | --- |
| 0. Textos | Hecho (commit `5d3b155`, ya en main). La app dice "inteligencia artificial" o "IA". Solo la política de privacidad nombra a Anthropic, como proveedor. |
| 1. Migración 0018 | Hecho. Aplicada y registrada: el historial tiene 18 versiones distintas, de 0001 a 0018. |
| 2. Pruebas SQL | Hecho. Pasan las 9, de a una, sin dejar datos. `reconocimiento_ia.sql` falló la primera vez por la prueba, no por la base; se arregló (commit `953bcdd`) y pasó. |
| 3. Función | Hecho. `reconocer` está desplegada (versión 1, activa, `verify_jwt` apagado) y `ANTHROPIC_API_KEY` existe. El secreto se generó al azar en la base y se cargó con la URL. Un pedido sin secreto, o con uno equivocado, recibe 401. |
| 4. Prueba real | **Falló.** Ninguna de las 5 fotos se procesó: 3 llamadas rechazadas y 2 fotos "no disponibles". No hay motivo para Toby ni costo medido. El reconocimiento quedó apagado (`ia_activa = 'false'`). |
| 5. Reporte | Este. |
| 6. Merge | Hecho. PR #12 mergeado con merge commit: `0800117`. |
| 7. Deploy | Hecho. `dpl_DP7bfAz3CL4yremT9kysNXHegjAe` en **READY**, en `animales-blue.vercel.app`. |

**El arreglo** (este PR, sin aplicar ni desplegar):
- **Fotos de otros sitios:** las baja la función y las manda dentro del pedido, con el tipo que dicen sus bytes, hasta 5 MB y 10 s.
- **Comprobación HEAD:** sale.
- **Fotos del bucket:** siguen yendo por URL.
- **Errores:** el texto del error de la API queda en `llamadas_ia.detalle`, limpio y de hasta 300 caracteres (migración 0019).

## 2. Cambios

### Del cierre, ya en main (PR #12)

- `src/i18n/es-UY.ts`: Moderación → Reconocimiento y los mensajes de pausa, costo y errores dicen "inteligencia artificial", "IA" y "el servicio de IA". La política de privacidad nombra a Anthropic, sin "Claude". No hizo falta subir la versión de los términos: la `2026-10-20` todavía no la había aceptado nadie.
- `__tests__/reconocimiento.test.ts`: recorre `es-UY.ts` y falla si "Claude" o "Anthropic" aparecen fuera de la política de privacidad.
- `docs/DISENO.md`, `AGENTS.md`, `docs/PRUEBAS-MANUALES.md`: la regla de textos y los textos nuevos.
- `supabase/tests/reconocimiento_ia.sql` (2b y 3g): miran solo los casos de la prueba. En producción, el perro encontrado de Parque Rodó queda a 918 m del perdido de la prueba y es un candidato válido.

### De este PR

**Migración**
- `supabase/migrations/20261020000019_detalle_llamadas_ia.sql` (nueva): `llamadas_ia.detalle` sube de 200 a 300 caracteres (la restricción y `terminar_llamada_ia`).

**Función `reconocer`**
- `descargar.ts` (nuevo): `bajarFoto`, `tipoPorBytes` y `aBase64`.
  - Una sola cuenta de tiempo para conectar y leer, de 10 s.
  - Tope de 5 MB: por lo que declara el sitio y mientras lee.
  - Tipo por la firma: JPEG, PNG, WebP o GIF. Cualquier otra cosa devuelve null y la foto queda como "foto no disponible".
- `procesar.ts`:
  - `bajar` reemplaza a `existe` (HEAD).
  - Las fotos del bucket van con la URL de su miniatura. Las de otros sitios se bajan; las de los candidatos, en paralelo.
  - Hasta 20 MB de fotos bajadas por pedido (la API acepta 32 MB); los candidatos que no entran quedan afuera.
  - La cola guarda el código del error; la llamada, el detalle.
- `claude.ts`:
  - `clasificarError` devuelve `codigo` y `detalle`. El detalle es el tipo, el texto de la API y el id del pedido.
  - `limpiarDetalle` saca claves (`sk-ant-…`, `sb_secret_…`, JWT, `Bearer`), URLs, emails, UUID y números de 8 dígitos o más (teléfonos), y corta a 300.
- `fotos.ts`: `urlDeMiniatura` reemplaza a `urlsCandidatas`.
- `index.ts`: usa `bajarFoto()`.

**Pruebas de Deno**
- `pruebas/descargar_test.ts` (nuevo):
  - las cuatro firmas, más un WAV, un GIF a medias y un archivo vacío;
  - base64 por partes;
  - un sitio que dice `image/jpg` o miente el tipo;
  - un 404, una página HTML y un error de red;
  - más de 5 MB declarados o leídos, y justo 5 MB;
  - un sitio que no responde y otro que manda de a poco.
- `pruebas/procesar_test.ts`:
  - una foto de otro sitio va dentro del pedido, y un candidato que no se pudo bajar queda afuera;
  - el tope de 20 MB por pedido;
  - el texto del error queda limpio y cortado en la llamada, y en la cola solo el código;
  - una foto de otro sitio que no se pudo bajar no llama a la API.
- `pruebas/claude_test.ts`: los cinco tipos de error con su texto e id, y lo que saca `limpiarDetalle`.
- `pruebas/ayudas.ts`: `bajar` falso, errores de la API con texto e id, e `imagenesDe`.

**Pruebas de la app**
- `__tests__/imagenes.test.ts`: la copia de la función da la misma miniatura que `imagenes.ts`, y para una URL externa no devuelve ninguna.

**Pruebas SQL**
- `reconocimiento_ia.sql`: parte 9, el detalle de una llamada guarda 300 caracteres y la tabla no acepta 301.
- `vision.sql` y `fase9_revision.sql`: prenden `ia_activa` y sacan `ia_pausa` dentro de la transacción. Con el reconocimiento apagado (así está producción ahora) fallaban, porque la base no avisaba a la función.
- `supabase/tests/README.md`: lo mismo, y el rango 0001 a 0019.

**Docs**
- `docs/ARQUITECTURA.md` ("Reconocer", `llamadas_ia`, seguridad, pruebas).
- `docs/DECISIONES.md` (entrada nueva: "Las fotos de otros sitios las baja la función").
- `docs/PRUEBAS-MANUALES.md` (flujo 26).
- `README.md` y `AGENTS.md`: migraciones hasta la 0019, y la regla de las fotos y del texto de los errores.

## 3. Verificaciones

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | Sin errores |
| `npm run lint` | Sin errores |
| `npm run test` | 19 suites, 194 pruebas pasan |
| `npx expo export -p web` | Sin errores |
| `deno test --allow-env` (en `supabase/functions/reconocer`) | 51 pasan (42 de antes y 9 nuevas) |
| `deno lint`, `deno fmt --check`, `deno check` (y `scripts/evaluar-ia.ts`) | Sin errores |

**Las pruebas nuevas detectan las fallas.** Con el código roto a propósito, falla la prueba que corresponde en cada caso:
- sin mirar `content-length`;
- sin tope al leer;
- sin tope de tiempo;
- con el tipo del sitio en vez del de los bytes;
- sin borrar las URLs del detalle;
- sin el tope de 20 MB.

**Pruebas SQL en local** (Postgres 16 con 0001–0019):
- Pasan las 9, con y sin los datos de ejemplo.
- Con el reconocimiento apagado y pausado, también pasan, y la configuración queda como estaba.
- Sin la 0019, la parte 9 falla con "el detalle no guarda 300 caracteres: 200".

**En producción, sin cambiar nada:**
- La 0019 se aplica sin errores dentro de `begin … rollback`; la restricción sigue en 200.
- Las 9 pruebas SQL del cierre pasaron sobre 0001–0018, y los conteos quedaron iguales antes y después.

**Lo que falló en el paso 4.** `despertar_vision()` devolvió `enviado`, y la función respondió `200 {"procesados":0,"errores":5,"quedan":0}`.
- **Las 3 fotos de placedog.net** (Parque Rodó, el negro y Toby):
  - Al describirlas, la API respondió `invalid_request_error` en unos 100 ms, con 0 tokens y costo 0.
  - No hay texto del error: la función guardaba solo el tipo, y eso es lo que arregla la 0019.
  - Desde la base, placedog.net responde 200 con `content-type: image/jpg`, que no es un tipo válido. Es la causa más probable, aunque no está confirmada.
- **Las 2 fotos de cataas.com** (el gato): "foto no disponible". La comprobación HEAD falló, pero un GET normal devuelve la imagen como `image/jpeg`.

**Desde las 18:40 hasta las 18:59 UTC** (unos 20 minutos):
- la base ya exigía los términos 2026-10-20 y la web publicada todavía usaba los 2026-10-19;
- la base rechazaba publicar, avisar, escribir y denunciar.

Terminó con el deploy de las 18:59:50 UTC.

## 4. Pasos manuales

Cuando el PR esté revisado y aprobado, en este orden. Se pueden hacer desde una sesión con acceso a Supabase o desde el SQL Editor.

1. **Aplicar la 0019 y registrarla.** El orden con la función no importa: sin la 0019, `terminar_llamada_ia` corta a 200 sin fallar. Pegá en el SQL Editor el contenido de `supabase/migrations/20261020000019_detalle_llamadas_ia.sql` y, al final:
   ```sql
   insert into supabase_migrations.schema_migrations (version, name) values ('20261020000019', 'detalle_llamadas_ia');
   ```
2. **Volver a desplegar la función**, desde la raíz del repo, en main:
   ```bash
   npx supabase functions deploy reconocer --project-ref bwqvuttuodwypwxckxgf --use-api --no-verify-jwt
   ```
3. **Correr en producción**, de a uno, `supabase/tests/fase9_revision.sql`, `vision.sql` y `reconocimiento_ia.sql`, que cambiaron. Las demás no cambiaron. Las tres andan con el reconocimiento apagado.
4. **Volver las 5 fotos a la cola, prender el reconocimiento y procesarlas:**
   ```sql
   update public.cola_vision set estado = 'pendiente', intentos = 0, ultimo_error = null, updated_at = now()
   where estado = 'error';
   update public.config_app set valor = 'true', updated_at = now() where clave = 'ia_activa';
   select public.despertar_vision();
   ```
5. **Mirar el resultado** (un minuto después):
   ```sql
   select tipo, resultado, tokens_entrada, tokens_salida, costo_usd, detalle from llamadas_ia order by id;
   select avistamiento_id, especie, color_principal, collar, calidad from descripciones_ia;
   select animal_origen, animal_candidato, confianza, motivo, origen from coincidencias;
   ```
   - **Esperado:** las 5 descripciones.
   - **Esperado:** una coincidencia entre Toby (`b0000000-0000-4000-8000-000000000004`) y el perro de Parque Rodó (`b0000000-0000-4000-8000-000000000001`), que tienen la misma foto, con su motivo.
   - **Esperado:** las llamadas con tokens y costo. Con eso se completa el motivo de Toby y el costo por foto medido.
6. **Si algo falla:**
   - El texto del error ahora queda en `llamadas_ia.detalle`.
   - Para cortar los reintentos:
     ```sql
     update public.config_app set valor = 'false', updated_at = now() where clave = 'ia_activa';
     ```
   - Si es falta de crédito, la función pausa sola y en Moderación aparece **Reactivar**.

## 5. Pendientes y riesgos

- **No hay motivo para Toby ni costo por foto medido.** Llegan con el paso 4 de arriba. Hasta ahora: 3 llamadas, 0 tokens, US$ 0. Esas 3 llamadas cuentan para el tope de hoy (300).
- **La causa del rechazo de placedog.net no está confirmada.** Lo más probable es el `image/jpg`. El arreglo manda el tipo de los bytes; si igual falla, el texto del error va a estar en `detalle`.
- **Bajar fotos en el entorno real de Supabase no está probado:** las pruebas usan un `fetch` falso. El primer intento del paso 4 lo confirma.
- **Mandar fotos del bucket por URL a la API no está probado en producción:** el bucket está vacío, porque todas las fotos son de demo. Conviene el flujo 26 de `docs/PRUEBAS-MANUALES.md` con una foto subida desde la app.
- **Sin la comprobación HEAD, una URL del bucket que no sirva hace fallar la llamada.** Se reintenta hasta 8 veces y queda en error, con el porqué en `detalle`. Si es la foto de un candidato, falla la comparación de esa foto. Es poco probable: toda foto se sube con su miniatura y se borra solo con su caso.
- **`ia_activa` queda en `false`** hasta que se apruebe el arreglo. Mientras tanto, ninguna foto se analiza y Moderación muestra "Apagado".
- **La URL y el secreto de la función** están en `config_app`, y no en este reporte ni en ningún archivo.
