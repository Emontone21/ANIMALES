# Ajuste del reconocimiento con IA · 2026-10-21

## 1. Resumen

Con las primeras fotos reales, el reconocimiento creó tres coincidencias falsas, con aviso a las familias. Se pidió:
- apagarlo ya;
- arreglar en la rama, sin tocar producción:
  - las coincidencias falsas;
  - la comparación (foto entera, qué pesa);
  - revisar la hora de "visto";
  - dejar lista la evaluación.

### Lo que se hizo en producción: solo apagarlo

- **`ia_activa = 'false'`** desde las 11:44:56 UTC del 21/10. Se comprobó de nuevo al cerrar este reporte: sigue en `false`.
- **Coincidencias de la IA:** quedan las 3 falsas, ya rechazadas. No hay ninguna pendiente.
- **La función** sigue en la versión 5 (commit `c76161a`). La última migración aplicada es la 0019.
- **Nada más.** No se aplicó la 0020, no se desplegó y no se prendió nada.

### Qué pasó (del diagnóstico)

- **Los casos:** "perro beagle" (`5c0f97c1-1e5f-4731-a4f4-12e70e1a3936`) y "perro marron" (`b86ce53c-086a-4f87-aaf0-e8791d2f22be`). Son dos encontrados del mismo beagle, publicados desde dos cuentas, a 385 m y con 10 minutos de diferencia.
- **Las coincidencias falsas:** la IA comparó el beagle con tres perros de demo y respondió "distinto" con 95, 95 y 98. Tomó el número como qué tan segura estaba de su veredicto. `guardar_comparacion_ia` (0018) miraba solo el número contra `umbral_ia` (70). Creó tres coincidencias con 6 avisos.
- **La que no llegó:** los dos beagles quedaron en 45, "posible". La IA veía la miniatura (un recorte cuadrado del centro de la foto) y le pesaron el collar, que se veía en una sola, y el ángulo.

### Lo que se arregló en la rama

| Pedido | Resultado |
| --- | --- |
| 1. Coincidencias falsas | **Hecho.** El campo se llama `probabilidad_mismo`: 0 es seguro que no es el mismo animal y 100, seguro que sí. Lo dicen el pedido y el esquema. La función rechaza, con reintento, "distinto" con 50 o más y "mismo" con menos de 50. La migración 0020 crea la coincidencia solo con veredicto "mismo" o "posible" y la probabilidad desde el umbral. Pruebas de Deno y SQL para cada caso. |
| 2. Mejor comparación | **Hecho.** La IA ve la foto entera a 640 px de lado mayor, sin recorte. La app sube una tercera variante, `.mediana.jpg`; la función la baja y, si no está, baja la original. Describir también usa la mediana: medido, cuesta unos 206 tokens más por imagen (ver "Costo"). El pedido dice qué pesa mucho y qué pesa poco. |
| 3. Hora de "visto" | **El código está bien;** no hay corrimiento por zona horaria. Se sumó una prueba que lo fija. Explicación abajo. |
| 4. Evaluación | **No se pudo correr acá:** la red no llega a Wikimedia Commons y la sesión no tiene clave de Anthropic (no se pidió). Quedan los pasos para Cloud Shell, antes y después del cambio 2 (sección 4). |

### Costo por foto

**Medido en producción**, con las llamadas de `llamadas_ia` (Claude Haiku 5.5: US$ 0,10 por millón de tokens de entrada y US$ 0,50 de salida):
- **Describir** con la miniatura de 320: 1.808 tokens de entrada. Con una foto de 640 × 480: 2.014. Son 206 tokens más por imagen, unos US$ 0,00002.
- **Una foto,** con la descripción y la comparación con 4 candidatos (6 imágenes):

  | | Con la miniatura | Con la mediana |
  | --- | --- | --- |
  | Describir | US$ 0,00036 | US$ 0,00038 |
  | Comparar con 4 candidatos | US$ 0,0010 a 0,0011 | unos US$ 0,0012 |
  | **Total por foto** | **unos US$ 0,0015** | **unos US$ 0,0016** |

**Con el script de evaluación** (`scripts/evaluar-ia.ts`), contra una API simulada que cobra las imágenes como la API (ancho × alto / 750): 5 perros, 5 fotos nuevas con 4 candidatos cada una.
- Con `--foto miniatura`, todas las imágenes salieron a 320 × 320: US$ 0,00105 por foto.
- Con `--foto mediana`, a 640 × 480: US$ 0,00124 por foto.
- Es la cota de arriba: por esa cuenta, la mediana sube 273 tokens por imagen, y en producción subió 206.

**Fotos de antes,** sin mediana (las dos del beagle incluidas): la función baja la original de 1280, unos 1.600 tokens por imagen. Una foto que se compara con 4 de esas cuesta unos US$ 0,0007 más, hasta que dejen de ser candidatas.

**¿Por qué describir con la mediana y no con la miniatura?** Cuesta US$ 0,00002 más por foto. A cambio:
- la descripción ve el animal entero: el collar, el cuerpo y el tamaño, que el recorte cuadrado suele cortar;
- la función baja una sola imagen por foto para las dos llamadas.

### La hora de "visto"

**El dato:** en los dos casos, `visto_en` quedó 3 h antes de `created_at`:

| | `visto_en` (UTC) | `created_at` (UTC) | Diferencia |
| --- | --- | --- | --- |
| Primero | 08:24:42,016 | 11:24:44,848 | 3 h y 2,8 s |
| Segundo | 08:35:06,102 | 11:35:10,649 | 3 h y 4,5 s |

Los segundos de más son la subida de la foto: los archivos están en Storage entre las dos horas. La hora se calculó en el dispositivo al tocar Publicar, y la foto se subió antes de llamar a la base.

**Por qué no es la zona horaria:**
- **La hora sale de `Date.now()`:** "¿Cuándo lo viste?" ofrece Recién (0 h), Hace 1 h, Hace 3 h, Hoy (8 h) y Ayer (24 h), y viene en Recién. `fechaDe` (`SelectorCuando.tsx`) resta las horas a `Date.now()`, en milisegundos desde 1970, que no dependen de la zona.
- **Viaja en UTC:** `toISOString()` la manda con `Z` (`p_visto_en` en `features/reportes/api.ts`).
- **Se guarda con zona:** el parámetro de la RPC y la columna son `timestamptz`. Ningún paso pasa por la hora local ni la escribe sin zona.
- **La prueba nueva** (`__tests__/fechas.test.ts`) corre `fechaDe` con el dispositivo en Montevideo, UTC y Tokio, y da la misma hora UTC. A las 8:24 de Montevideo, "Recién" llega como las 11:24 UTC.

**Lo que puede haber pasado:** una de dos, y los datos no alcanzan para saber cuál.
- Se eligió **"Hace 3 h"** en los dos casos.
- **El reloj del dispositivo estaba 3 h atrasado.** Pasa cuando tiene la zona en UTC y la hora puesta a mano con la de Montevideo. En ese dispositivo el caso dice "Recién"; en los demás, "hace 3 h".

Para saberlo, publicá una prueba con "Recién" desde el mismo dispositivo y mirá la diferencia (consulta en la sección 4).

## 2. Cambios

### Base

- **`supabase/migrations/20261021000020_probabilidad_mismo.sql`** (nueva): `guardar_comparacion_ia` es igual a la de la 0018, salvo dos cosas:
  - lee `probabilidad_mismo` en vez de `confianza`;
  - crea la coincidencia solo si el veredicto es "mismo" o "posible" y la probabilidad llega a `umbral_ia`.

  Además:
  - comenta las columnas `confianza` de `comparaciones_ia` y `coincidencias` (ahora guardan `probabilidad_mismo`);
  - no renombra columnas: la app y las vistas las usan;
  - una función vieja que mande `confianza` no guarda nada (`not_null_violation`).
- **`supabase/tests/reconocimiento_ia.sql`:**
  - la parte 3 usa `probabilidad_mismo`;
  - la parte 10, nueva, publica un perdido y seis encontrados cerca, y comprueba:
    - se crean "mismo" con 100 y "posible" con 70;
    - no se crean "distinto" con 95, "mismo" con 69 ni "posible" con 69;
    - quedan las 5 comparaciones;
    - la clave vieja `confianza` falla.
- **`supabase/tests/README.md`:** 0001 a 0020 y lo que cubre la parte 10.

### Función `reconocer`

- **`validar.ts`:**
  - el resultado de comparar es `probabilidad_mismo`, entero de 0 a 100;
  - nueva constante `PROBABILIDAD_MEDIA` (50);
  - una respuesta contradictoria no valida: "distinto" con 50 o más, o "mismo" con menos de 50. El motivo del rechazo es `C1 distinto con probabilidad_mismo 95`; queda en `detalle` y la cola reintenta;
  - "posible" acepta cualquier número.
- **`claude.ts`:**
  - el pedido de comparar dice qué es `probabilidad_mismo` y que no es qué tan segura está de su veredicto;
  - qué pesa mucho: el pelaje (colores, largo y textura), las manchas y dónde están, la forma de las orejas y la cara;
  - qué pesa poco: el collar (se pone y se saca), el fondo, la pose, la luz, el ángulo y lo que escribió cada persona;
  - el esquema tiene `probabilidad_mismo` y descripciones de cada campo.
- **`fotos.ts`:** de dónde baja cada foto (`urlsParaBajar`): del bucket, la mediana y después la original; una URL externa, tal cual. Es la copia de `rutaMediana` y de la URL pública de `src/lib/imagenes.ts`.
- **`procesar.ts`:**
  - `fotoParaClaude` prueba esas URL en orden y manda la primera que baja, dentro del pedido;
  - la misma imagen sirve para describir y para comparar;
  - los candidatos se bajan en paralelo;
  - sigue el tope de 20 MB por pedido.
- **`descargar.ts`:** solo el comentario. Ahora baja también las fotos del bucket.
- **Pruebas (`pruebas/`):**
  - `validar_test.ts`: los rangos, la contradicción en los dos sentidos, "posible" con cualquier número y la clave vieja;
  - `claude_test.ts`: los campos nuevos y que el pedido y el esquema expliquen `probabilidad_mismo`;
  - `procesar_test.ts`:
    - se baja primero la mediana;
    - si falta, la original;
    - sin ninguna de las dos, "foto no disponible";
    - una comparación contradictoria queda inválida, con su detalle, y no llega a la base;
  - `evaluar_test.ts`: la cuenta de coincidencias como la base y las medidas de la mediana.

### App

- **`src/lib/imagenes.ts`:** `LADO_MEDIANA` (640), `rutaMediana` y `medidasMediana`, que achica sin agrandar. El nombre de las variantes sigue armándose solo acá.
- **`src/lib/fotos.ts`:**
  - `subirFoto` arma la miniatura y la mediana en paralelo y sube los tres archivos juntos;
  - `conVariantes` suma la mediana, para borrarla con la foto.

  En la base no cambia nada: `raiz_foto` ya agrupa por la ruta hasta el primer punto.
- **`__tests__/imagenes.test.ts`:**
  - la ruta y las medidas de la mediana;
  - `conVariantes`;
  - que la copia de la función dé lo mismo;
  - `urlsParaBajar`.
- **`__tests__/fechas.test.ts`:** la prueba de la zona horaria.

### Script de evaluación

- **`scripts/evaluar-ia.ts`:**
  - cuenta una coincidencia como la 0020: veredicto distinto de "distinto" y probabilidad desde el umbral;
  - `--foto mediana|miniatura|original` reemplaza a `--lado`, para medir antes y después;
  - `mediana`, el valor por defecto, achica a 640 de lado mayor sin recortar;
  - `miniatura` recorta cuadrado a 320, como veía la función hasta hoy.

### Documentación

- `docs/DECISIONES.md`: entrada "Coincidencias solo con veredicto "mismo" o "posible", y la IA ve la foto entera", con lo que se descartó y por qué. Se descartaron:
  - las transformaciones de Storage, que no están en el plan;
  - achicar en la función, que no entra en los 2 s de CPU;
  - mandar la original, que cuesta 4 veces más.
- `docs/ARQUITECTURA.md`: publicar con tres archivos, la mediana, qué ve la IA al describir y al comparar, `probabilidad_mismo` y la regla del veredicto.
- `AGENTS.md`: la regla de fotos y miniaturas (la mediana), la de la función (la foto que baja, la respuesta contradictoria) y migraciones 0001–0020.
- `README.md`: migraciones 0001–0020 y 0017–0020 en "Servicio de reconocimiento".
- `docs/PRUEBAS-MANUALES.md`, flujo 26:
  - pide la 0018 a la 0020;
  - mira la `.mediana.jpg` en Storage;
  - consulta `comparaciones_ia`;
  - comprueba que ninguna coincidencia venga de un "distinto".

## 3. Verificaciones

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | Sin errores. |
| `npm run lint` | Sin errores. Hubo uno de Prettier en un import de `src/lib/fotos.ts` y se corrigió. |
| `npm run test` | 19 suites, 197 pruebas, todas pasan. |
| `npx expo export -p web` | Sin errores (`dist/`). Lo nuevo de `imagenes.ts` y `fotos.ts` entra en `__common`, donde ya estaban esos archivos: unas líneas. `expo-image-manipulator` se sigue cargando al subir, con `import()`. |
| `deno test --allow-env` (en `supabase/functions/reconocer`) | 66 pruebas, todas pasan. |
| `deno lint` y `deno fmt --check` (ídem) | Sin errores. |
| `deno check`, `deno lint` y `deno fmt --check` de `scripts/evaluar-ia.ts` | Sin errores. |

**Pruebas SQL,** en Postgres 16 local con las migraciones 0001 a 0020:
- Pasan las 9 (`fase5_permisos`, `fase6_perdidos`, `fase7_cuenta`, `fase8_casos`, `fase9_revision`, `fase9_parte2`, `errores`, `vision` y `reconocimiento_ia`), de a una. Se corrieron con el seed y en una base vacía.
- **Comprobación al revés,** para ver que la prueba falla cuando corresponde:
  - sin la 0020, `reconocimiento_ia.sql` falla, porque `confianza` llega null;
  - con la 0020 pero sin la condición del veredicto, falla en `FALLA 10a`, porque crea la coincidencia de "distinto" con 95.

**Script de evaluación,** de punta a punta contra una API simulada en local:
- con `--foto miniatura`, todas las imágenes salieron a 320 × 320;
- con `--foto mediana`, a 640 × 480;
- el costo se contó en los dos casos.

No mide la calidad: las respuestas eran inventadas.

**No se corrió nada en producción.** Las pruebas SQL de allá van con los pasos de abajo, después de la revisión.

## 4. Pasos manuales

Todo esto va **después de revisar el PR.** Hasta entonces el reconocimiento queda apagado. El orden importa:
- la función nueva con la 0018, o la vieja con la 0020, no guardan ninguna comparación: cada foto gastaría sus 8 intentos;
- por eso la 0020 y la función van juntas, con `ia_activa` en `false`.

### 1. Aplicar la 0020 (con el reconocimiento apagado)

Con la CLI, desde la raíz del repo, en la rama del PR o en `main` después del merge:

```bash
npx supabase db push
```

O en el SQL Editor:
1. Pegá el archivo `supabase/migrations/20261021000020_probabilidad_mismo.sql` entero y ejecutalo.
2. Registralo:
   ```sql
   insert into supabase_migrations.schema_migrations (version, name)
   values ('20261021000020', 'probabilidad_mismo');
   ```

Comprobación:

```sql
select count(*), max(version) from supabase_migrations.schema_migrations;
-- 20 y 20261021000020
```

### 2. Pruebas SQL en producción

Corré las 9 de `supabase/tests/`, de a una, como en los cierres anteriores. La que importa es `reconocimiento_ia.sql`. Ninguna deja datos.

### 3. Desplegar la función

Desde la raíz del repo, con el código del PR:

```bash
npx supabase functions deploy reconocer --project-ref bwqvuttuodwypwxckxgf --use-api --no-verify-jwt
```

La clave (`ANTHROPIC_API_KEY`), la URL y el secreto no cambian.

### 4. Merge y deploy de la app

- **Al mergear el PR,** Vercel despliega la app nueva, que sube la `.mediana.jpg`. Confirmá el deploy en **READY**.
- **Sin este paso** la función anda igual: baja la original, que cuesta más.
- **Una pestaña abierta antes del deploy** sube sin mediana hasta que se recarga.

### 5. Volver a comparar los dos beagles (opcional)

Si siguen publicados. Borra la comparación del par y la descripción del segundo caso, y lo vuelve a la cola:

```sql
delete from public.comparaciones_ia
where animal_a = least('5c0f97c1-1e5f-4731-a4f4-12e70e1a3936'::uuid, 'b86ce53c-086a-4f87-aaf0-e8791d2f22be'::uuid)
  and animal_b = greatest('5c0f97c1-1e5f-4731-a4f4-12e70e1a3936'::uuid, 'b86ce53c-086a-4f87-aaf0-e8791d2f22be'::uuid);

delete from public.descripciones_ia
where avistamiento_id in (
  select id from public.avistamientos where animal_id = 'b86ce53c-086a-4f87-aaf0-e8791d2f22be'
);

update public.cola_vision
set estado = 'pendiente', intentos = 0, ultimo_error = null, updated_at = now()
where avistamiento_id in (
  select id from public.avistamientos where animal_id = 'b86ce53c-086a-4f87-aaf0-e8791d2f22be'
);
```

Las dos fotos son de antes y no tienen mediana: la función baja las originales, también enteras. Los pares con los perros de demo ya están comparados y no se repiten.

### 6. Prender el reconocimiento

```sql
update public.config_app set valor = 'true', updated_at = now() where clave = 'ia_activa';
```

### 7. Mirar lo que pasa

Las llamadas, con su costo y sus avisos. Una contradicción aparece como `invalida`, con detalle `C1 distinto con probabilidad_mismo 95`:

```sql
select id, created_at, tipo, resultado, tokens_entrada, tokens_salida, costo_usd, detalle
from public.llamadas_ia order by id desc limit 20;
```

Las comparaciones:

```sql
select created_at, veredicto, confianza as probabilidad_mismo, motivo
from public.comparaciones_ia order by created_at desc limit 20;
```

Ninguna coincidencia nueva puede venir de un "distinto". Esta consulta tiene que dar 0 filas:

```sql
select c.id, c.confianza, x.veredicto
from public.coincidencias c
join public.comparaciones_ia x on x.animal_a = c.animal_origen and x.animal_b = c.animal_candidato
where c.origen = 'ia' and c.created_at > '2026-10-21 12:00+00' and x.veredicto = 'distinto';
```

La hora de "visto": después de publicar una prueba con "Recién", la diferencia tiene que ser de segundos.

```sql
select a.id, av.visto_en, av.created_at, av.created_at - av.visto_en as diferencia
from public.avistamientos av join public.animales a on a.id = av.animal_id
order by av.created_at desc limit 5;
```

Para apagarlo en cualquier momento:

```sql
update public.config_app set valor = 'false', updated_at = now() where clave = 'ia_activa';
```

### 8. Evaluación con fotos de Wikimedia Commons (en Cloud Shell)

Desde acá no se pudo: la red no llega a Commons. Corré "antes" y "después" con las mismas fotos:
- **Antes:** el script de `main`, con el pedido viejo y la miniatura recortada de 320. Cuenta coincidencias solo por el número, como la 0018.
- **Después:** el de esta rama, con `--foto mediana`.
- **El medio (opcional):** el de esta rama con `--foto miniatura`, para separar el efecto de la foto del del pedido.

**Bajar las fotos:** una carpeta por perro, de las categorías de Commons de perros conocidos con muchas fotos. Las categorías de abajo son ejemplos: revisalas en commons.wikimedia.org antes y cambiá las que no existan o tengan pocas fotos.

```bash
mkdir -p ~/commons && cd ~/commons
UA='encontrados-evaluar/1.0 (https://github.com/Emontone21/ANIMALES)'
for cat in 'Bo_(dog)' 'Sunny_(dog)' 'Major_(dog)' 'Commander_(dog)' 'Barney_(dog)' 'Buddy_(dog)'; do
  dir=$(printf '%s' "$cat" | tr -cd '[:alnum:]_'); mkdir -p "$dir"
  curl -sG -A "$UA" https://commons.wikimedia.org/w/api.php \
    -d action=query -d format=json -d generator=categorymembers -d gcmtype=file -d gcmlimit=30 \
    --data-urlencode "gcmtitle=Category:$cat" -d prop=imageinfo \
    --data-urlencode 'iiprop=url|mime' -d iiurlwidth=1280 \
  | jq -r '.query.pages[]?.imageinfo[0] | select(.mime == "image/jpeg") | .thumburl' \
  | head -8 | nl -w1 -s' ' | while read -r n url; do
      curl -s -A "$UA" -o "$dir/$n.jpg" "$url"; sleep 1
    done
done
ls ~/commons/*
```

Después mirá las fotos en el editor de Cloud Shell y borrá las que no sirven: otro perro, varios perros, estatuas, dibujos o el perro muy chico. Cada carpeta tiene que quedar con 3 fotos o más. Las fotos quedan en tu Cloud Shell: no se suben a ningún lado fuera de la API.

**Correr las evaluaciones:** la clave se pide con `read -rs`, que no la muestra ni la deja en el historial. Usá una clave propia para evaluar, que se pueda borrar después.

```bash
cd ~/ANIMALES && git fetch origin
which deno || npm install -g deno@2.9.6
read -rs ANTHROPIC_API_KEY && export ANTHROPIC_API_KEY

# Antes: main
git worktree add ~/antes origin/main
(cd ~/antes && deno run --config supabase/functions/reconocer/deno.json \
  --allow-read --allow-write="$HOME" --allow-env --allow-net=api.anthropic.com \
  scripts/evaluar-ia.ts ~/commons --especie perro --salida ~/antes.json | tee ~/antes.txt)

# Después: esta rama
git checkout claude/animales-repo-mxm2ja && git pull
for modo in miniatura mediana; do
  deno run --config supabase/functions/reconocer/deno.json \
    --allow-read --allow-write="$HOME" --allow-env --allow-net=api.anthropic.com \
    scripts/evaluar-ia.ts ~/commons --especie perro --foto $modo --salida ~/despues-$modo.json \
    | tee ~/despues-$modo.txt
done

unset ANTHROPIC_API_KEY
git worktree remove ~/antes
```

**Qué mirar:** la tabla por umbral (qué parte reconoce a su perro y cuántas coincidencias falsas por foto) y la línea de costo. Con 6 perros son unas 25 llamadas por corrida: menos de US$ 0,20 las tres juntas. Si la recomendación de "después" pide otro umbral:

```sql
update public.config_app set valor = '<umbral>', updated_at = now() where clave = 'umbral_ia';
```

## 5. Pendientes y riesgos

- **El orden del despliegue (sección 4, pasos 1 a 3).** La 0020 y la función nueva tienen que estar las dos antes de prender. Con una sola, cada comparación falla, se reintenta 8 veces y gasta llamadas del tope.
- **El umbral (70) sigue sin calibrar.** Falta la evaluación con fotos reales (paso 8). Con la regla nueva, solo "posible" y "mismo" desde 70 crean coincidencias. Igual, una "posible" con 70 o más llega como aviso a una familia, y siempre confirma una persona.
- **El modelo puede seguir equivocándose de número.** La función rechaza las contradicciones y la base no sugiere "distinto". Un "posible" con un número alto mal puesto todavía pasa.
- **Una contradicción se reintenta y se cobra:** cada intento cuesta como una comparación. Si se repite, la foto queda con error después de 8 intentos, y queda el detalle para revisar el pedido.
- **Fotos sin mediana:**
  - las subidas antes de este cambio (todas las de producción): la función baja la original de 1280, unos US$ 0,0007 más por foto que las tenga como candidatas;
  - las de demo, de otros sitios: tal cual.
- **Una variante más por foto:**
  - cada foto sube un archivo más, de unos 50 a 80 KB, y tarda un poco más con mala señal;
  - los avatares también llevan mediana, aunque la IA no los mira; se puede sacar después.
- **Las coincidencias falsas del 21/10** quedan rechazadas, y sus comparaciones ("distinto" con 95 y 98) quedan en `comparaciones_ia`. Esos pares no se vuelven a comparar.
- **La hora de "visto" depende del reloj del dispositivo.** No se cambió. Si se confirma que el reloj estaba mal, hay una forma de que no importe (no se hizo):
  - con "Recién", que la app no mande la hora y la base use `now()`;
  - con "hace X", que mande las horas en vez de la fecha.
- **No se probó contra la API real** con la mediana ni con el pedido nuevo. Las pruebas simulan la API; la evaluación (paso 8) y el paso 5 lo prueban.
- **El costo** sube unos US$ 0,0001 por foto, a unos US$ 0,0016. Con el tope de 300 llamadas por día, el máximo queda por debajo de US$ 0,30 por día.
