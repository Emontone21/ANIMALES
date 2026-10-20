# Reconocimiento en Cloud Run

Rama `claude/animales-repo-mxm2ja`, desde `main` en `9ffa55f`. 20 de octubre de 2026. No se aplicó nada en producción.

## 1. Resumen

**Qué se pidió:** poner en marcha el reconocimiento de coincidencias. El servicio de visión y todo el lado de la base ya existían, pero el servicio nunca corrió: Hugging Face ahora cobra los Spaces con Docker. El pedido fue pasarlo a Google Cloud Run, dentro de su capa gratuita, sin agregar funciones fuera de esto:
1. Adaptar el servicio a Cloud Run.
2. Despertarlo con un trabajo de pg_cron solo cuando hay fotos (B31).
3. Un script de despliegue para Cloud Shell.
4. Un script para evaluar umbrales.
5. Una sección "Reconocimiento" en moderación.

**Qué se hizo:**

- **El servicio trabaja dentro del pedido.** Ya no hay `BackgroundTasks` ni bucle interno.
  - `/procesar` procesa la foto y responde con el resultado.
  - `/procesar-pendientes` vacía la cola con un tope de 90 s y responde cuántas procesó, cuántas fallaron y cuántas quedan. Si ya hay una vuelta en curso, no la superpone.
  - La misma foto pedida dos veces a la vez se procesa una sola vez.
  - El puerto sale de `PORT` (7860 por defecto).
  - Los modelos se bajan en el build y se leen sin red al arrancar.
  - torch usa los 2 vCPU del servicio (`HILOS`) y se importa solo al cargar los modelos reales.
- **Migración 0017.**
  - **Una sola función llama al servicio** (`llamar_vision`). Las esperas suben de 5 s a 60 s (una foto) y a 150 s (vaciar la cola), por el arranque medido.
  - **pg_cron** cada 2 minutos llama a `/procesar-pendientes` solo si hay URL y `cola_vision_pendientes` tiene filas. Otro trabajo limpia su historial.
  - **Moderación:** `estado_reconocimiento` y `procesar_pendientes_vision`, las dos solo para moderadores.
  - **Resuelve B31.**
- **`desplegar.sh` para Cloud Shell.**
  - Pide la URL de Supabase y la clave `service_role` sin mostrarlas, comprueba que la clave sirva y genera `VISION_SECRET` al azar.
  - Guarda las claves en Secret Manager y despliega en `us-east5` con `gcloud run deploy --source`: 0 a 1 instancias, 2 vCPU, 2 GiB, `--timeout 300` y acceso público.
  - Limpia las imágenes viejas, prueba `/salud` e imprime el SQL para Supabase.
  - Se puede volver a correr: pregunta si cambiar las claves o solo actualizar el código.
- **`evaluar.py`.** Por umbral, calcula los pares del mismo animal que detecta, los pares falsos entre animales distintos y la vista "como la app". Recomienda un umbral. Está probado, pero **no se pudo correr con fotos reales**: desde este entorno no se llega a Hugging Face (modelos) ni a los conjuntos públicos (sección 5).
- **Moderación → Reconocimiento.**
  - **Qué muestra:** si está configurado, las fotos pendientes (y cuántas esperan un reintento), las fotos con error, cuándo se procesó la última foto y cuándo apareció la última coincidencia.
  - **Botón** "Procesar pendientes ahora".
  - **Sin la URL ni el secreto.**
  - Va en un bloque aparte.
- **Mediciones:**
  - **Arranque:** de 3 a 5 s hasta tener los modelos cargados.
  - **Tiempo por foto:** de 0,5 a 1 s.
  - **Memoria:** 660 MB de pico, y 840 MB con fotos de 12 MP.
  - Detalle en la sección 3.

**Solo lectura en producción:**
- **Extensiones:** pg_cron 1.6.4 está disponible y sin instalar; pg_net 0.20.4 está instalado.
- **Región del proyecto:** `us-east-2`.

## 2. Cambios

### Servicio (`services/vision`)

| Archivo | Por qué |
| --- | --- |
| `app/main.py` | **Trabajo dentro del pedido:** sin `BackgroundTasks` ni bucle. `/procesar` procesa y responde `{"procesado": …, "coincidencias" o "motivo": …}`. **Cola:** `/procesar-pendientes` llama a `vaciar_cola(tope)`: no repite una foto en la misma vuelta, devuelve `procesados`, `errores` y `quedan`, y si ya hay una vuelta en curso responde `ocupado`. **Sin repetir:** un conjunto `_en_curso` evita procesar dos veces la misma foto. La foto se baja fuera del candado de la inferencia. |
| `app/__main__.py` (nuevo) | `python -m app`: uvicorn con el puerto de `PORT` (7860 por defecto). |
| `app/vision.py` | **Carga perezosa:** los modelos son una clase (`ModelosHF`) que importa torch y transformers al cargarse; las pruebas ponen un modelo falso con `usar_modelos`. **Funciones puras:** `elegir_recorte` (el animal más grande de la especie, con 8 % de margen) y `normalizar`. **Configuración:** `MODELO_DETECTOR`, `MODELO_EMBEDDING` (carpetas locales para medir) y `HILOS` (2). |
| `app/db.py` | `contar_pendientes` (cuenta exacta de PostgREST) y `total_de_content_range`. |
| `Dockerfile` | Para Cloud Run: `HF_HOME=/opt/modelos`, modelos bajados en el build, `HF_HUB_OFFLINE=1` al correr, usuario sin privilegios y `CMD ["python", "-m", "app"]`. |
| `.gcloudignore` (nuevo) | Lo que `gcloud run deploy --source` no sube: pruebas, README, scripts y `.env`. |
| `.env.example` | Variables nuevas (`PORT`, `HILOS`, `TIEMPO_MAXIMO_COLA_SEG`), sin `INTERVALO_COLA_SEG`. |
| `desplegar.sh` (nuevo) | El despliegue desde Cloud Shell (sección 1). Pasa shellcheck. |
| `evaluar.py` (nuevo) | La evaluación de umbrales. |
| `requirements-pruebas.txt`, `pytest.ini`, `tests/` (nuevos) | 26 pruebas con un modelo falso y una base en memoria, sin torch. |
| `README.md` | **Pasos desde cero:** proyecto, facturación, alerta de US$1, Cloud Shell y el script. **Además:** qué despliega, consumo frente a la capa gratuita, qué hacer si falla, cómo evaluar y ajustar el umbral, y cómo probar. |

### Base

| Archivo | Por qué |
| --- | --- |
| `supabase/migrations/20261020000017_reconocimiento_cloud_run.sql` (nuevo) | **pg_cron:** `create extension if not exists pg_cron with schema pg_catalog`, como lo hace Supabase. **Llamadas al servicio:** `llamar_vision` (única, interna). `avisar_vision` usa 60 s. `despertar_vision` (interna) devuelve `sin_configurar`, `sin_pendientes` o `enviado` y espera 150 s. **Trabajos:** `vision-pendientes` (`*/2 * * * *`) y `vision-limpiar-historial` (borra las corridas de más de 7 días). **Moderación:** `estado_reconocimiento` y `procesar_pendientes_vision`, para `authenticated` con chequeo de moderador. |
| `supabase/tests/vision.sql` (nuevo) | **El trabajo:** existe y nadie de la API puede llamar a las funciones internas. **Cuándo llama:** solo con URL y pendientes, no con un error que espera su reintento ni con uno que agotó los intentos. **Esperas:** las del aviso y de vaciar la cola. **Moderación:** el estado y el botón son solo suyos, y el botón hace la misma llamada que el cron. |
| `supabase/tests/README.md` | `vision.sql` en la tabla; migraciones hasta 0017. |

### App

| Archivo | Por qué |
| --- | --- |
| `src/components/moderacion/ReconocimientoModeracion.tsx` (nuevo) | La sección: tarjeta con los datos, botón y resultado. Se actualiza cada 15 s mientras está a la vista (`useIsFocused`). |
| `src/features/reconocimiento/api.ts` (nuevo) | Las dos RPC con TanStack Query. Solo lo usa la sección (bloque aparte). |
| `src/features/reconocimiento/estado.ts` (nuevo) | Lógica pura: qué decir según el resultado del botón y cómo mostrar "cuándo". |
| `src/app/moderacion.tsx` | Chip "Reconocimiento" y la sección con `lazy`. |
| `src/i18n/es-UY.ts` | `t.reconocimiento`. |
| `src/types/database.ts`, `src/types/dominio.ts` | Las dos RPC, a mano (la 0017 no está aplicada), y `EstadoReconocimiento`. |
| `__tests__/reconocimiento.test.ts` (nuevo) | Resultado del botón, textos y fechas. |

### Documentos y repo

| Archivo | Por qué |
| --- | --- |
| `docs/DECISIONES.md` | **Entradas nuevas:** "El servicio de visión pasa a Cloud Run", "Un trabajo de pg_cron despierta al servicio solo si hay fotos", "Las claves del servicio, en Secret Manager" y "Umbral de similitud: 0,80 hasta medirlo con fotos reales". La entrada de Hugging Face remite a la nueva. |
| `docs/ARQUITECTURA.md` | Diagrama, el flujo de "Reconocer" (esperas, cron, tope, moderación), las RPC nuevas, dónde van las claves y el despliegue. |
| `docs/DISENO.md` | Ícono `refresh-outline` y la sección Reconocimiento en 7.8. |
| `docs/PRUEBAS-MANUALES.md` | Flujo 26, "Reconocimiento en Cloud Run". Duración total: unos 75 minutos. |
| `README.md`, `AGENTS.md` | Cloud Run en lugar de Hugging Face, la migración 0017, `vision.sql`, `pytest`. Reglas nuevas en AGENTS: trabajo dentro del pedido, toda llamada por `llamar_vision` y `pytest` si se toca el servicio. |
| `.gitignore` | `__pycache__` en cualquier carpeta del servicio y los `.npz` de `evaluar.py`. |

## 3. Verificaciones

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | Sin errores. |
| `npm run lint` | Sin errores (salida 0). |
| `npm run test` | 18 suites, **184 pruebas pasan** (180 de antes y 4 nuevas). |
| `npx expo export -p web` | `Exported: dist`, sin errores. |
| `pytest` en `services/vision` | **26 pruebas pasan.** Con `requirements-pruebas.txt` (sin torch) y con el entorno completo. |

**Pruebas SQL (Postgres 16 local, migraciones 0001–0017, con pg_cron 1.6.2 real y el stub de pg_net):**
- `vision.sql` pasa.
- Siguen pasando `errores.sql`, `fase5_permisos.sql`, `fase6_perdidos.sql`, `fase7_cuenta.sql`, `fase8_casos.sql`, `fase9_revision.sql` y `fase9_parte2.sql`.
- **Control:** con una `despertar_vision` alterada que llama aunque no haya pendientes, falla en `FALLA 2b`.
- **pg_cron corrió de verdad:** `vision-pendientes` cada 2 minutos, todas las corridas `succeeded`.

**`desplegar.sh`, con un `gcloud` y un `curl` falsos:**
- **Primera vez:** guarda la clave en Secret Manager sin mostrarla en la salida y saca la barra final de la URL. Despliega con `--update-secrets` y con las variables en un solo `--update-env-vars`, y al final imprime el SQL.
- **Segunda vez, sin cambiar claves:** despliega sin tocar los secretos.
- **Tercera vez, cambiando las claves:** agrega versiones nuevas y destruye las viejas.
- **No se pudo probar contra Google Cloud de verdad:** no hay cuenta en este entorno.

**Sección Reconocimiento en Chromium** (Supabase simulado, celular y computadora, claro y oscuro):
- muestra **Configurado**, 3 pendientes con "1 espera un nuevo intento", 2 con error con su ayuda, la hora de la última foto y "Todavía ninguna";
- no muestra la URL ni el secreto;
- el botón llama a `procesar_pendientes_vision` y muestra "Le avisamos al servicio…", y con la cola vacía, "No hay fotos pendientes.";
- sin errores.

**Peso de la web** (carga inicial de `/`):
- **Total:** 1 783 089 → 1 783 995 bytes, +906 (+346 con gzip).
- **Qué suma:** son los textos nuevos, que por regla van en `es-UY.ts` (`__common`). La sección y sus llamadas van en `ReconocimientoModeracion-….js`, que se baja al elegirla.

### Mediciones del servicio

**Cómo:**
- **Máquina:** 2 núcleos de esta máquina (`taskset -c 0,1`), Python 3.13, torch 2.5.1 y transformers 4.46.3.
- **Modelos:** Hugging Face no se puede bajar desde acá. Se midió con modelos de **la misma arquitectura y tamaño de entrada**, armados con la configuración de los scripts de conversión de transformers, y pesos al azar. Tienen los mismos parámetros que los reales: YOLOS tiny 6,5 M (26 MB), DINOv2 small 22,1 M (88 MB). El tiempo y la memoria dependen de la arquitectura, no del valor de los pesos.
- **Supabase:** simulado en la misma máquina, así que bajar la foto es casi instantáneo.

| Medida | Resultado |
| --- | --- |
| Arranque en frío: proceso nuevo hasta que `/salud` responde con los modelos cargados | 5,1 s, 3,2 s y 3,1 s (mediana 3,2 s); 2,7 s en otra corrida |
| Memoria con los modelos cargados | 469 MB |
| Primera foto (1280 × 960, como las de la app) | 0,87 s |
| Cola de 30 fotos de 1280 × 960 | 17,5 s: **0,58 s por foto** (inferencia 0,44 s de mediana, 0,66 s de máximo) |
| Memoria después de la cola | **660 MB** (pico 660 MB) |
| 100 fotos de 12 MP (4032 × 3024) | **Corta a los 90 s:** 87 procesadas en 90,7 s, quedan 13. 1,04 s por foto (inferencia 0,83 s de mediana, 1,57 s de máximo); **pico de 839 MB** |

**Qué se decidió con eso:**
- **Memoria: 2 GiB.** 1 GiB queda justo con fotos grandes. Con 2 vCPU la capa gratuita se agota antes por CPU que por memoria, así que 2 GiB no achica lo gratis.
- **Esperas de pg_net:** en Cloud Run se suma bajar la imagen (unos 400 MB comprimida, estimado) y la CPU es más lenta. Se cuentan hasta 30 s de arranque.
  - Un aviso: 60 s.
  - Vaciar la cola: 30 s de arranque, 90 s de tope y la última foto: 150 s.
  - El `--timeout` de Cloud Run, 300 s, queda por encima.
- **Consumo estimado** (README del servicio, con 15 s por arranque y 1 s por foto):
  - 1 000 fotos por mes usan el 11 % de los vCPU gratis.
  - 20 000 fotos por mes, el 72 %.
  - Lo único que se cobra seguro es guardar la imagen: unos US$0,03 por mes.

### Evaluación de umbrales

`evaluar.py` está probado:
- **Pruebas:** con embeddings armados a mano (pares, "como la app", tabla, recomendación y lectura de carpetas).
- **De punta a punta:** con los modelos de pesos al azar, sobre 18 fotos sintéticas. Calcula los embeddings con el código real del servicio, guarda el `.npz` y arma la tabla.

**Esa corrida encontró un caso mal resuelto:** cuando ningún umbral alcanza, recomendaba 1,00, que no encuentra nada. Ahora no recomienda un umbral que no encuentra ninguna foto (con su prueba).

**No se corrió con fotos reales.** Desde este entorno están bloqueados Hugging Face (los dos modelos), dl.fbaipublicfiles.com, Kaggle, Zenodo y Mendeley, y el zip de MPDD responde 403. Los números de esa corrida no dicen nada sobre la calidad: los pesos son al azar.

**Umbral recomendado: dejar 0,80** hasta correr `evaluar.py` con MPDD (perros, cuerpo entero, CC BY 4.0). Después usar el que recomiende, si encuentra el 70 % o más con 0,2 coincidencias falsas por foto o menos. Si con 0,80 encuentra mucho menos, bajarlo de a 0,02. Las razones y las limitaciones (pose, fondo, animales muy parecidos, fotos difíciles) están en `docs/DECISIONES.md`.

## 4. Pasos manuales

### Supabase

**1. Aplicar la 0017.** En el **SQL Editor**, pegá entero `supabase/migrations/20261020000017_reconocimiento_cloud_run.sql`, tocá **Run** y registrala:
```sql
insert into supabase_migrations.schema_migrations (version, name)
values ('20261020000017', 'reconocimiento_cloud_run');
```

**2. Comprobar:**
```sql
select jobname, schedule, active from cron.job order by jobid;
-- vision-pendientes | */2 * * * * | true
-- vision-limpiar-historial | 23 4 * * * | true
```

**3. Pruebas:** corré `supabase/tests/vision.sql` y, como siempre, las otras siete. Todas tienen que terminar en `Success. No rows returned`.

Hasta cargar la URL del servicio, el trabajo de cada 2 minutos no hace nada (`sin_configurar`).

### Google Cloud

Seguí `services/vision/README.md`, "Ponerlo en marcha desde cero":
1. Proyecto `encontrados`.
2. Facturación.
3. Alerta de presupuesto de US$1: **Facturación → Presupuestos y alertas → Crear presupuesto**.
4. Después de mergear el PR (el script está en `main`), en Cloud Shell:
   ```bash
   gcloud config set project <ID-del-proyecto>
   git clone https://github.com/Emontone21/ANIMALES.git
   cd ANIMALES/services/vision
   bash desplegar.sh
   ```
5. Pegá en el **SQL Editor** de Supabase las dos líneas que imprime al final (`vision_url` y `vision_secret`). No las guardes en ningún archivo.
6. En la app: **Moderación → Reconocimiento** tiene que decir **Configurado**. Las 5 fotos que ya están en la cola se procesan en los 2 minutos siguientes, o con **Procesar pendientes ahora**.

### Evaluar el umbral (recomendado)

En Cloud Shell, que sí llega a Hugging Face, con MPDD bajado de https://data.mendeley.com/datasets/v5j6m8dzhv/1 y descomprimido en `~/mpdd` (una carpeta por perro):

```bash
cd ANIMALES/services/vision
python3 -m venv ~/venv-vision && . ~/venv-vision/bin/activate
pip install -r requirements.txt
python evaluar.py ~/mpdd --especie perro --cache ~/mpdd.npz
```

Con el umbral que recomiende:
```sql
update config_app set valor = '<umbral>', updated_at = now() where clave = 'umbral_similitud';
```

### Vercel

Nada.

## 5. Pendientes y riesgos

- **Mediciones de este entorno, no de Cloud Run:**
  - El arranque en Cloud Run va a ser más largo: bajar la imagen y CPU más lenta. Las esperas (60 s y 150 s) dejan margen, pero conviene mirar en los registros del primer despliegue cuánto tarda de verdad.
  - Se midió con el torch de PyPI (versión para GPU usada en CPU); la imagen usa el de CPU, que debería ocupar menos memoria.
  - El tamaño de la imagen (unos 400 MB comprimida) es una estimación: no se pudo construir acá.
- **`desplegar.sh` solo se probó con un `gcloud` falso.** Los nombres de los comandos y flags salen de la documentación y de la ayuda de gcloud 570. Puntos a mirar en la primera corrida:
  - el permiso `roles/run.builder` en proyectos nuevos;
  - la política de limpieza del repositorio (si falla, avisa y sigue);
  - `--allow-unauthenticated` en una organización con restricciones (el script detecta el 403 y dice qué correr).
- **El umbral no se evaluó con fotos reales** (sección 3). Queda en 0,80.
- **Avisos que fallan siempre:** si el secreto no coincide (401) o el servicio falla entero, las fotos quedan pendientes y el trabajo lo llama cada 2 minutos. Mantiene la instancia despierta, pero solo se cobra el tiempo de cada pedido (milisegundos). Se nota en **Moderación → Reconocimiento**: las pendientes no bajan.
- **Un servicio que contesta en `vision_url` pero no es el de visión** (una URL equivocada) recibe un pedido cada 2 minutos mientras haya pendientes.
- **pg_cron en producción:** la 0017 lo habilita. Desactivarlo más adelante (`drop extension pg_cron`) borra los dos trabajos.
- **No se volvieron a correr las pruebas SQL en producción:** la 0017 no está aplicada. Van en el paso 3 de Supabase.
- **El repositorio en Cloud Shell:** si es privado, `git clone` pide un token de GitHub (README del servicio).
