# Reconocimiento con la API de Claude

Rama `claude/animales-repo-mxm2ja`, desde `main` en `71e2b23`. 20 de octubre de 2026. No se aplicó nada en producción: la 0018, la función y su configuración van en el cierre (sección 4).

## 1. Resumen

**Qué se pidió:** reemplazar el plan de Cloud Run por la API de Claude.
- Claude describe cada foto nueva, la compara con pocos candidatos que elige la base y explica por qué se parecen. La familia sigue confirmando o rechazando.
- El servicio de Python (`services/vision`) queda en el repo, sin desplegar, como alternativa documentada.
- Sin funciones fuera de esto.

**Qué se hizo:**

- **Edge Function `supabase/functions/reconocer`** (TypeScript para Deno). Atiende `/procesar` y `/procesar-pendientes` con el mismo contrato que el servicio anterior.
  - Tiene `verify_jwt = false` y la protege `X-Vision-Secret`, que compara con `config_app.vision_secret` leído de la base.
  - Escribe con la clave secreta que Supabase pone en su entorno (`SUPABASE_SECRET_KEYS`, o la legacy).
  - Llama a la API con `ANTHROPIC_API_KEY`, un secreto de la función. Ninguna clave en el repo.
  - Reutiliza la cola, los reintentos, el aviso al subir una foto, el trabajo de pg_cron y la sección de moderación.
- **Paso 1, describir:** una llamada por foto con la miniatura de 320 por URL.
  - Responde con una herramienta con esquema JSON estricto: si hay un animal y cuál, color principal y secundario, patrón, tamaño, collar y su color, raza aproximada, rasgos y calidad.
  - Se valida y se guarda en `descripciones_ia`, con modelo, tokens y fecha. Un reintento no la vuelve a describir.
  - Sin animal, o de otra especie que la del caso, no se compara.
- **Paso 2, candidatos en SQL** (`candidatos_ia`), hasta `max_candidatos` (10):
  - misma especie, casos abiertos y visibles, a menos de 15 km y dentro de 60 días;
  - las reglas de la Fase 6;
  - sin colores o tamaños claramente incompatibles;
  - sin los pares ya comparados;
  - del más cercano al más lejano.
- **Paso 3, comparar:** una sola llamada con la foto nueva, la de cada candidato y sus descripciones.
  - Por candidato vuelve: confianza de 0 a 100, veredicto (mismo, posible o distinto), motivo de hasta 140 caracteres en rioplatense, y rasgos que coinciden y que difieren.
  - Desde `umbral_ia` (70) se crea la coincidencia, con confianza, motivo y `origen = 'ia'`. Avisa como siempre.
- **"Posibles coincidencias"** muestra el motivo en vez del porcentaje. Las coincidencias viejas, sin motivo, siguen con el porcentaje.
- **Seguridad, costo y privacidad:**
  - El prompt de sistema le pide a Claude que ignore cualquier instrucción que aparezca en una foto o en los datos. Cada respuesta se valida.
  - A Anthropic van solo las fotos y los datos del animal.
  - Topes: interruptor (`ia_activa`) y 300 llamadas por día.
  - Cada llamada queda registrada con tokens, costo estimado, modelo y resultado.
  - Errores 429 y 529: los reintenta la cola. Sin crédito, se pausa hasta que un moderador toca **Reactivar**.
  - Moderación ve las llamadas de hoy, el costo del mes y los errores.
  - Se actualizó la política de privacidad y la versión de los términos.
  - `guardar_embedding` ya no se usa (sin permiso), pero sus datos quedan.
- **Evaluación:** `scripts/evaluar-ia.ts` usa el mismo formato de carpetas que `evaluar.py` y el mismo código que la función.
  - Mide qué parte de las fotos reconoce a su animal y cuántas confusiones hay por foto, para cada umbral, con su costo.
  - Antes de mandar las fotos, las achica como la miniatura de la app.

## 2. Cambios

### Base

| Archivo | Qué y por qué |
| --- | --- |
| `supabase/migrations/20261020000018_reconocimiento_ia.sql` (nuevo) | Ver el detalle abajo. |
| `supabase/tests/reconocimiento_ia.sql` (nuevo) | 8 partes, ver la sección 3. |
| `supabase/tests/README.md` | La prueba nueva en la tabla; migraciones hasta 0018. |
| `supabase/config.toml` | `[functions.reconocer] verify_jwt = false`. |

**Qué hace la 0018:**
- **`config_app`:** `ia_activa`, `ia_pausa`, `ia_modelo` (`claude-haiku-5-5`), `max_candidatos` (10), `umbral_ia` (70), `ia_tope_diario` (300) y `terminos_version` (`2026-10-20`).
- **Tablas, con RLS de lectura solo para moderadores:**
  - `descripciones_ia`;
  - `comparaciones_ia`, un par de casos ordenado y único;
  - `llamadas_ia`.
- **`coincidencias`:** `confianza`, `motivo` y `origen`; la vista `coincidencias_detalle` los expone.
- **Topes:** `estado_ia`, e `iniciar_llamada_ia` con un candado para que dos fotos a la vez no pasen el tope.
- **`llamar_vision` y `despertar_vision`:** no llaman si el reconocimiento está apagado, pausado o llegó al tope.
- **Cola:** `cola_vision_pendientes` también devuelve las fotos trabadas en `procesando` por más de 10 minutos.
- **RPC de la función, solo `service_role`:** `tomar_pendiente_ia`, `soltar_pendiente_ia`, `marcar_hecho_ia`, `guardar_descripcion_ia`, `candidatos_ia`, `guardar_comparacion_ia`, `terminar_llamada_ia`, `pausar_ia` y `config_reconocimiento`.
- **Compatibilidad:** `colores_compatibles_ia` y `tamanios_compatibles_ia`.
- **`guardar_embedding`:** sin permiso para `service_role`.
- **`estado_reconocimiento`:** suma activa, pausa, llamadas de hoy, tope, errores de hoy y costo del mes.
- **`reactivar_reconocimiento`:** solo moderación.

### Función y evaluación

| Archivo | Qué y por qué |
| --- | --- |
| `supabase/functions/reconocer/index.ts` (nuevo) | Arma las dependencias con el entorno y sirve el manejador. Tope de 90 s por vuelta. |
| `…/servidor.ts` (nuevo) | Rutas, método y UUID. Compara el secreto en tiempo constante. Sin `ANTHROPIC_API_KEY` responde 503 sin tocar la cola. |
| `…/procesar.ts` (nuevo) | El trabajo de cada foto y la vuelta de la cola. Ver el detalle abajo. |
| `…/claude.ts` (nuevo) | Las dos llamadas. Ver el detalle abajo. |
| `…/validar.ts` (nuevo) | Valida las dos respuestas: claves exactas, enumerados, largos, rangos y un resultado por candidato. |
| `…/base.ts` (nuevo) | PostgREST con `fetch`. La clave secreta va solo en `apikey`; la legacy, también como `Bearer`. User-Agent propio. Los errores no copian el cuerpo de la respuesta. |
| `…/fotos.ts` (nuevo) | Copia de la convención de miniaturas de `src/lib/imagenes.ts`: la función no puede importar de `src/`. |
| `…/deno.json` (nuevo) | El SDK de Anthropic `0.131.0`, `@std/assert` y `jimp` (este último, solo para el script). Formato. |
| `…/pruebas/*_test.ts` (nuevo) | 42 pruebas con la API simulada y una base en memoria. |
| `scripts/evaluar-ia.ts` (nuevo) | La evaluación con la API real (sección 4). |

**Qué hace `procesar.ts`:**
- toma la foto y elige la URL de la miniatura (o, si no existe, la original);
- reserva y registra cada llamada;
- marca el error para que la cola reintente, y pausa si no hay crédito;
- suelta la foto, sin gastar un intento, si justo llegó al tope.

**Qué hace `claude.ts`:**
- **Mensajes:** prompts en español, con la regla de ignorar lo escrito en fotos y datos. Las imágenes van por URL o en base64 (el script).
- **Herramientas:** `strict` y con `tool_choice: auto`, porque Opus 5.5 y Sonnet 5.5 no aceptan forzarla y el modelo es configurable.
- **Esfuerzo:** `low` para describir y `medium` para comparar.
- **Lo demás:** precios para el costo estimado, y los errores se clasifican por su clase y su tipo en el SDK, nunca por el texto.

### App

| Archivo | Qué y por qué |
| --- | --- |
| `src/components/reportes/Coincidencias.tsx` | El motivo en `cuerpoFuerte` y debajo, en `secundario`, quién, dónde y cuándo. Sin motivo, la oración con el porcentaje. |
| `src/features/coincidencias/resumen.ts` (nuevo) | La lógica pura de ese texto. |
| `src/components/moderacion/ReconocimientoModeracion.tsx` | Estado (configurado, sin configurar, apagado o pausado), llamadas de hoy contra el tope, costo del mes, errores de hoy y los últimos 5 de la semana, y **Reactivar** cuando está pausado. "Procesar pendientes ahora" se apaga si no anda. |
| `src/features/reconocimiento/api.ts`, `estado.ts` | `listarErroresIa` (lee `llamadas_ia`: la RLS deja solo a moderación), `reactivarReconocimiento` y los resultados nuevos. Lógica pura del estado, la etiqueta y la fila de error. |
| `src/i18n/es-UY.ts` | Textos de moderación y `coincidencias.quienYDonde`. Política de privacidad: las fotos las analiza Anthropic y qué se le manda; Anthropic reemplaza a Hugging Face en "Con quién compartimos datos". |
| `src/features/legal/terminos.ts` | `VERSION_TERMINOS = '2026-10-20'`, porque cambió el texto. |
| `src/types/database.ts`, `dominio.ts` | A mano, porque la 0018 no está aplicada: columnas de `coincidencias` y de la vista, `llamadas_ia`, `estado_reconocimiento` y `reactivar_reconocimiento`. |
| `__tests__/coincidencias.test.ts` (nuevo), `reconocimiento.test.ts`, `imagenes.test.ts` | El texto de cada coincidencia, el estado de moderación, el costo, la fila de error y que la copia de la función dé lo mismo que `imagenes.ts`. |
| `tsconfig.json`, `eslint.config.js` | Dejan afuera el código de Deno: la función y el script. |

### Documentos

| Archivo | Qué y por qué |
| --- | --- |
| `docs/DECISIONES.md` | Entrada nueva: "El reconocimiento pasa a la API de Claude", con el porqué y cada decisión. Nota en las de Cloud Run y el umbral de similitud. |
| `docs/ARQUITECTURA.md` | Diagrama, piezas, el flujo "Reconocer", modelo de datos, RPC, seguridad, despliegue y pruebas. |
| `docs/DISENO.md` | 6.10 con el motivo; 7.8 con los datos y el botón nuevos; ícono `play-outline`; textos nuevos. |
| `docs/PRUEBAS-MANUALES.md` | El flujo 16 muestra el motivo. El 26 pasa a ser "Reconocimiento con la API de Claude": interruptor, pausa y Reactivar, foto sin animal y costo. |
| `README.md`, `AGENTS.md`, `services/vision/README.md` | La función en lugar de Cloud Run: pasos de despliegue, pruebas, estructura y reglas. El servicio de Python queda como alternativa sin desplegar, con cómo volver a usarlo. |
| `docs/reportes/2026-10-20-reconocimiento-ia.md` | Este reporte. |

## 3. Verificaciones

| Qué | Resultado |
| --- | --- |
| `npm run typecheck` | Sin errores. |
| `npm run lint` | Sin errores. |
| `npm run test` | 19 suites, **193 pruebas pasan**: 184 de antes y 9 nuevas. |
| `npx expo export -p web` | `Exported: dist`, sin errores. |
| `deno test --allow-env` en `supabase/functions/reconocer` | **42 pruebas pasan**, con Deno 2.9.6 (ver abajo). |
| `deno check`, `deno lint`, `deno fmt --check` | Sin errores, en la función y en `scripts/evaluar-ia.ts`. |
| `pytest` en `services/vision` | 33 pasan. Solo cambió su README. |

**Qué cubren las pruebas de Deno.** La API de Claude se simula con un `fetch` falso que usa el SDK de verdad, y la base con una en memoria:
- **El pedido:** foto por URL, herramienta estricta con `tool_choice: auto`, esfuerzo, y la regla de ignorar lo escrito.
- **Qué viaja:** solo tipo, tamaño, color (limpio) y collar del caso.
- **Respuestas inválidas:** sin herramienta, cortada, negada o con un campo fuera del esquema.
- **Errores:** 402 (registra, marca error y pausa), 429 y 529 (marcan error, sin pausar) y otros.
- **Costo:** la estimación por modelo.
- **El flujo completo de una foto:** la mapea de cada etiqueta al caso; usa la original si no hay miniatura; deja afuera los candidatos sin foto; no compara sin animal o con otra especie; reusa la descripción; sale de la cola si no hay candidatos o el caso está cerrado.
- **Topes:** apagado, pausado y tope del día; soltar la foto si justo llega al tope.
- **El servidor:** secreto, rutas, UUID, falta de clave y la vuelta de la cola con su tope de tiempo.
- **Las claves de Supabase:** la secreta nueva y la legacy, y los headers de cada una.
- **La evaluación:** sus cálculos.

**Pruebas SQL**, en Postgres 16 local con las migraciones 0001 a 0018, pg_cron real y el stub de pg_net:
- `reconocimiento_ia.sql` pasa, y siguen pasando `vision.sql`, `errores.sql` y `fase5` a `fase9_parte2`.
- **Qué cubre `reconocimiento_ia.sql`:**
  1. **Permisos:** las RPC son solo de la función, y `guardar_embedding` quedó sin permiso.
  2. **Candidatos:** orden por distancia; `max_candidatos`; quedan afuera el lejano, el de otra especie, el visto antes de la pérdida, el cerrado, el oculto, el blanco con un negro, el grande con un chico, el que no tiene animal en su foto, el ya comparado, el que ya tiene coincidencia, el que está fuera de la ventana y perdido con perdido.
  3. **Comparación:** con confianza 70 (el umbral) crea la coincidencia con motivo, confianza y origen, y avisa a la familia. Con 69 no. Lo que no era candidato se ignora. Los pares quedan comparados.
  4. **Lectura:** solo moderación lee las descripciones, las comparaciones y el uso; nadie más escribe.
  5. **Tope del día:** cuenta en hora de Montevideo; al llegar, no hay aviso ni cron.
  6. **Interruptor:** apaga todo.
  7. **Sin crédito:** pausa y Reactivar.
  8. **Tomar una foto:** una sola vez; sin datos de personas; las trabadas vuelven a la cola; soltarla no gasta un intento.
- **Controles:** copias de la prueba alteradas a propósito y funciones de la migración alteradas dentro de la transacción. Fallan donde corresponde:
  - colores siempre compatibles: `FALLA 2b`, aparece Eblanco;
  - tamaños siempre compatibles: `FALLA 2b`, aparece Egrande;
  - sin tope diario: `FALLA 5b`;
  - con `guardar_embedding` habilitada: `FALLA 1d`;
  - con `anon` leyendo el uso: `FALLA 4e`;
  - con la confianza del par en 69 en vez de 70: `FALLA 3a`;
  - con el orden de los candidatos al revés: `FALLA 2b`;
  - con el interruptor sin apagar: `FALLA 6a`;
  - sin la pausa: `FALLA 7b`.

**En Chromium**, con Supabase simulado, en celular claro, oscuro y computadora:
- **Moderación → Reconocimiento:**
  - dice que es Claude;
  - muestra "Configurado", "12 de 300", "US$ 0,04", "2 hoy" y las dos llamadas que fallaron ("Hoy a las … · Comparar · Sin crédito");
  - sin URL ni secreto;
  - el botón llama a la función.
- **Pausado:**
  - dice "Pausado: sin crédito", con la ayuda;
  - "Procesar pendientes ahora" está apagado;
  - **Reactivar** llama a `reactivar_reconocimiento` y vuelve a "Configurado".
- **Posibles coincidencias:**
  - la de la IA muestra "Mismo collar rojo y mancha blanca en el pecho." y debajo "Un perro encontrado a 1,2 km. Con 3 h de diferencia.", sin porcentaje;
  - la vieja sigue con "se parece en un 81 %".
- **Sin errores de la app.** Lo único que falló fue el mini mapa, que no llega a OpenFreeMap desde este entorno.

**`scripts/evaluar-ia.ts` de punta a punta**, contra una API simulada en local (`ANTHROPIC_BASE_URL`) con 5 animales sintéticos:
- achica las fotos a JPEG de 320 en base64;
- describe 10 fotos (cada una una vez) y compara 5;
- arma la tabla por umbral, la recomendación y el costo, y escribe el JSON.

Sin la clave, avisa y sale.

**Peso de la web** (JS de la carga inicial de `/`):
- **Total:** 1 783 995 → 1 785 773 bytes, +1 778 (+695 con gzip). Son los textos nuevos, que por regla van en `es-UY.ts`.
- **La sección Reconocimiento:** pasa de 6,5 KB a 11,5 KB, en su bloque aparte.

**Lo que no se pudo probar acá:**
- La API real: no hay clave en este entorno.
- La función en el entorno de Supabase: se probó con Deno 2.9.6, y Supabase usa Deno 2.

### Tokens y costo por foto (estimación)

Con Claude Haiku 5.5 (US$0,10 por millón de tokens de entrada y US$0,50 de salida, con pedidos de hasta 100 000 tokens). Cómo se calcularon los tokens:
- **Texto:** el largo de los prompts y de los esquemas, a unos 3,5 caracteres por token.
- **Herramientas:** unos 350 tokens fijos por usarlas.
- **Imágenes:** ancho × alto / 750, unos 137 tokens por miniatura de 320 × 320.
- **Salida:** la llamada a la herramienta más el razonamiento, que con esfuerzo `low` o `medium` es corto.

| Llamada | Entrada | Salida | Costo |
| --- | --- | --- | --- |
| Describir una foto | ~1 300 (prompt ~220, herramienta ~600, uso de herramientas ~350, imagen ~137) | ~300 | ~US$0,00028 |
| Comparar con 10 candidatos | ~4 100 (prompt ~450, herramienta ~300, ~350, 11 imágenes ~1 500, datos y descripciones ~1 400) | ~1 200 | ~US$0,0010 |
| Comparar con 3 candidatos | ~2 000 | ~500 | ~US$0,00045 |

- **Por foto:** unos US$0,0013 con 10 candidatos; US$0,0007 con 3; US$0,0003 si no hay candidatos o no se ve un animal.
- **Por mes:** 1 000 fotos con 5 candidatos de promedio, alrededor de US$1.
- **El peor caso con el tope:** 300 llamadas por día (unas 150 fotos), alrededor de US$0,20 por día, unos US$6 por mes.
- **Son estimaciones.** El número real va a estar en `llamadas_ia` y en **Moderación → Reconocimiento** desde la primera foto, y `evaluar-ia.ts` lo mide con fotos reales.

## 4. Pasos manuales (en el cierre)

### Supabase

**1. Aplicar la 0018, antes de mergear.** La app nueva pide los campos nuevos de `estado_reconocimiento` y acepta la versión `2026-10-20` de los términos.

En el **SQL Editor**, pegá entero `supabase/migrations/20261020000018_reconocimiento_ia.sql`, tocá **Run** y registrala:

```sql
insert into supabase_migrations.schema_migrations (version, name)
values ('20261020000018', 'reconocimiento_ia');
```

Mientras no se despliegue la app nueva, quien tenga la vieja abierta y no haya aceptado los términos ve "Los términos cambiaron. Recargá la app para ver la versión nueva.". Después del deploy, todos aceptan la versión nueva antes de publicar, avisar, escribir o denunciar.

**2. Pruebas:** corré `supabase/tests/reconocimiento_ia.sql` y las otras ocho (`vision.sql`, `errores.sql` y las de las fases). Todas tienen que terminar en `Success. No rows returned`.

**3. Clave de Anthropic.** Ya está cargada como secreto de la función. Si hay que cambiarla: Supabase → **Edge Functions → Secrets** → `ANTHROPIC_API_KEY`. Conviene poner un límite de gasto mensual en la consola de Anthropic.

**4. Desplegar la función,** desde la raíz del repo, en una terminal con Node (Cloud Shell sirve). No hace falta Docker:

```bash
npx supabase login
npx supabase link --project-ref bwqvuttuodwypwxckxgf
npx supabase functions deploy reconocer --use-api --no-verify-jwt
```

**5. Conectarla,** en el SQL Editor. El secreto lo genera la base y nadie lo ve: la función lo lee de la base.

```sql
update config_app set valor = 'https://bwqvuttuodwypwxckxgf.supabase.co/functions/v1/reconocer', updated_at = now()
where clave = 'vision_url';
update config_app set valor = encode(extensions.gen_random_bytes(32), 'hex'), updated_at = now()
where clave = 'vision_secret';
```

`extensions.gen_random_bytes` existe en el proyecto: lo comprobé con una consulta de solo lectura.

**6. Comprobar:**
- **Moderación → Reconocimiento** dice **Configurado**.
- Las 5 fotos que esperan en la cola se procesan en los 2 minutos siguientes, o con **Procesar pendientes ahora**. Hoy son fotos de demo, que pueden no tener una imagen real: en ese caso quedan "con error" después de sus reintentos.
- Lo que gastó cada llamada:

```sql
select created_at, tipo, resultado, tokens_entrada, tokens_salida, costo_usd, detalle
from llamadas_ia order by created_at desc limit 10;
```

- Los registros de la función: **Edge Functions → reconocer → Logs**.

**Apagar en cualquier momento:** `update config_app set valor = 'false' where clave = 'ia_activa';`.

### Evaluar (recomendado, en Cloud Shell)

Con fotos de animales conocidos, por ejemplo MPDD (perros, CC BY 4.0), en `~/mpdd`, una carpeta por perro:

```bash
cd ANIMALES && git pull
npm install -g deno@2.9.6
read -rs ANTHROPIC_API_KEY && export ANTHROPIC_API_KEY
deno run --config supabase/functions/reconocer/deno.json \
  --allow-read --allow-write=. --allow-env --allow-net=api.anthropic.com \
  scripts/evaluar-ia.ts ~/mpdd --especie perro --max-animales 30 --salida resultados.json
unset ANTHROPIC_API_KEY
```

`read -rs` pide la clave sin mostrarla y sin que quede en el historial. Pegala y tocá Enter. Usá una clave propia para evaluar, que se puede borrar después.

Con 30 animales y 10 candidatos son unas 90 llamadas: menos de US$0,10. Con el umbral que recomiende:

```sql
update config_app set valor = '<umbral>', updated_at = now() where clave = 'umbral_ia';
```

### Vercel

Nada aparte del deploy del merge, que sale solo después de aplicar la 0018.

## 5. Pendientes y riesgos

- **No se probó contra la API real ni en el entorno de Supabase.** Las pruebas simulan la API con el SDK real, y la función se probó con Deno 2.9.6 en local. Puntos a mirar en el primer despliegue:
  - que Anthropic baje las miniaturas por URL del bucket público;
  - los tiempos: pg_net espera 60 s por foto y 150 s por vuelta;
  - el costo real frente a la estimación.
- **El umbral (70) no se calibró:** falta correr `evaluar-ia.ts` con fotos reales. Una coincidencia falsa le llega como aviso a una familia.
- **El modelo no es determinista:** la misma foto puede dar otra confianza. Cada par de casos se compara una sola vez: una foto mejor del mismo caso no repite la comparación con ese otro caso.
- **El motivo lo escribe el modelo** y lo ven las familias:
  - se valida el largo (hasta 140);
  - las instrucciones piden no incluir personas ni contactos;
  - el resto no se puede garantizar. Moderación ve cada comparación en `comparaciones_ia`.
- **Prompt injection:** una foto con texto puede intentar torcer la respuesta. Lo acotan las instrucciones, el esquema estricto con validación y que siempre confirma una persona.
- **El tope cuenta las llamadas intentadas,** también las fallidas. Una caída larga de la API consume el tope del día con reintentos (cada foto tiene hasta 8, con espera creciente).
- **Una llamada que se corta a la mitad** (la función se cae) queda `en_curso` en `llamadas_ia` y cuenta para el tope de ese día.
- **Fotos de demo con URL externa:** se mandan tal cual; si no existen, la foto queda con error.
- **La copia de la convención de miniaturas** en la función depende de `__tests__/imagenes.test.ts`: si cambia `imagenes.ts`, la prueba avisa.
- **Política de privacidad (borrador):** conviene revisar los términos de uso de datos de la API de Anthropic y mencionarlos en la versión final.
- **La clave `anon` legacy de la app** sigue pendiente de pasar a la publishable (`docs/DECISIONES.md`).
- **`services/vision/desplegar.sh` sigue en el repo.** Si alguien lo corre y pone su URL en `vision_url`, falla al guardar porque `guardar_embedding` está sin permiso. El README del servicio dice cómo volver a usarlo.
