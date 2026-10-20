# Servicio de visión

> **Alternativa sin desplegar.** Desde la migración 0018, el reconocimiento lo hace la API de Claude desde la Edge Function `supabase/functions/reconocer` (ver `docs/DECISIONES.md`, "El reconocimiento pasa a la API de Claude"). Este servicio queda en el repo como alternativa documentada, sin desplegar, y `guardar_embedding` está sin permiso para `service_role` (sus datos quedan). Para volver a usarlo:
> 1. En el SQL Editor: `grant execute on function public.guardar_embedding(uuid, extensions.vector, jsonb) to service_role;`
> 2. Desplegarlo con `desplegar.sh` (abajo) y poner su URL en `config_app.vision_url` en lugar de la de la función.
> 3. La función `reconocer` y este servicio no conviven: la cola, el aviso y el trabajo de cada 2 minutos llaman a una sola URL.

Microservicio Python (FastAPI) que calcula el embedding de cada foto de un animal y deja que Supabase busque coincidencias. Corre en **Google Cloud Run**, dentro de su capa gratuita: se enciende cuando Supabase le manda una foto y se apaga solo cuando no hay nada que hacer.

## Modelos (licencias permisivas)

| Uso | Modelo | Licencia |
|---|---|---|
| Detectar y recortar al animal | `hustvl/yolos-tiny` | Apache 2.0 |
| Embedding (384 dimensiones) | `facebook/dinov2-small` | Apache 2.0 |

Si no detecta ningún animal usa la foto entera. YOLOv8 queda descartado por ser AGPL. Los dos modelos se bajan al construir la imagen y quedan adentro: el servicio no depende de Hugging Face para arrancar.

## Cómo funciona

1. **Cada foto nueva entra a la cola.** Cada avistamiento con foto entra a `cola_vision`. Cuando una fila queda pendiente (al entrar, o al volver a la cola porque se corrigió la especie), Supabase llama a `POST /procesar` con el header `X-Vision-Secret`. Espera la respuesta hasta 60 s, porque el servicio puede estar apagado.
2. **El servicio la procesa dentro del pedido.** Baja la foto, recorta al animal, calcula el embedding, llama a la RPC `guardar_embedding` y recién entonces responde. Cloud Run solo da CPU mientras atiende un pedido, así que no hay tareas en segundo plano.
3. **La base busca coincidencias.** `guardar_embedding` guarda el vector y, si el caso está abierto y visible, lo compara con los demás animales abiertos y visibles de la misma especie, dentro del radio y la ventana de tiempo configurados. Crea filas en `coincidencias` (estado `pendiente`). Nunca sugiere un perdido con otro perdido.
4. **Si algo falla, se reintenta.** El servicio llama a `marcar_error_vision` y la fila se reintenta con espera creciente: 5, 10, 20… minutos, hasta 8 intentos (unas 10 horas).
5. **Un trabajo de pg_cron cubre lo que se pierde.** Cada 2 minutos, el trabajo `vision-pendientes` llama a `POST /procesar-pendientes` solo si hay fotos para procesar ahora. Así levanta los avisos perdidos y los reintentos, sin despertar al servicio cuando no hay nada. El servicio vacía la cola durante 90 s como máximo y responde cuántas procesó y cuántas quedan.
6. **Moderación lo controla.** **Moderación → Reconocimiento** dice si está configurado, cuántas fotos hay pendientes y con error, y cuándo se procesó la última foto y apareció la última coincidencia. **Procesar pendientes ahora** hace la misma llamada que el trabajo de pg_cron.

## Ponerlo en marcha desde cero

Se hace una sola vez y lleva unos 30 minutos. No hay que instalar nada en la computadora: todo pasa en el navegador.

### 1. Supabase: la migración 0017

En Supabase, **SQL Editor**, pegá y corré `supabase/migrations/20261020000017_reconocimiento_cloud_run.sql`. Activa pg_cron y crea el trabajo de cada 2 minutos. Si no hay servicio configurado, ese trabajo no hace nada.

### 2. Un proyecto de Google Cloud

1. Entrá a [console.cloud.google.com](https://console.cloud.google.com) con tu cuenta de Google.
2. Arriba, en el selector de proyectos, tocá **Proyecto nuevo**. Nombre: `encontrados`. Tocá **Crear**.
3. Anotá el **ID del proyecto** (por ejemplo, `encontrados-123456`): lo vas a usar en el paso 5.

### 3. Facturación

Cloud Run pide una cuenta de facturación aunque el uso quede dentro de la capa gratuita.

1. Menú (☰) → **Facturación**.
2. Si no tenés una cuenta de facturación, **Crear cuenta** y cargá una tarjeta. Si ya tenés una, **Vincular una cuenta de facturación** al proyecto `encontrados`.

### 4. Una alerta de presupuesto de US$1

Para enterarte por mail si algún día se pasa de la capa gratuita:

1. Menú (☰) → **Facturación** → **Presupuestos y alertas** → **Crear presupuesto**.
2. **Nombre:** `Encontrados`.
3. **Período:** mensual. En **Proyectos**, elegí `encontrados`. Tocá **Siguiente**.
4. **Tipo de presupuesto:** importe especificado, **US$1**. Tocá **Siguiente**.
5. Dejá los umbrales como vienen (50 %, 90 % y 100 %) y el aviso por mail a los administradores de facturación. Tocá **Terminar**.

La alerta avisa, pero no corta el servicio. Si llegara un mail, mirá **Facturación → Informes** y el panel **Moderación → Reconocimiento**.

### 5. Cloud Shell y el script

1. Arriba a la derecha en la consola, tocá el ícono de **Cloud Shell** (`>_`). Se abre una terminal abajo; es gratis.
2. Pegá esto, con el ID del paso 2:

   ```bash
   gcloud config set project <ID-del-proyecto>
   git clone https://github.com/Emontone21/ANIMALES.git
   cd ANIMALES/services/vision
   bash desplegar.sh
   ```

   Si el repositorio es privado, `git clone` pide usuario y contraseña: en la contraseña va un token de GitHub (**Settings → Developer settings → Personal access tokens**, con permiso de lectura). Otra opción es bajar el ZIP del repositorio desde GitHub y subirlo con el menú **⋮ → Subir** de Cloud Shell.
3. El script pide, sin mostrarlas mientras las escribís:
   - **SUPABASE_URL:** en Supabase, el botón **Connect** de arriba muestra la URL del proyecto. Es `https://<ref>.supabase.co`.
   - **Clave secreta:** en Supabase, **Settings → API Keys → "Publishable and secret API keys"**, sección **Secret keys**. Conviene una propia del servicio: **Add new secret key**, con un nombre como `vision`, y copiarla. Empieza con `sb_secret_`.

   Antes de seguir, el script comprueba que la clave funcione.

   La clave legacy `service_role` (pestaña **Legacy API Keys**, empieza con `eyJ`) también anda mientras Supabase la mantenga, pero la depreca a fines de 2026: el script avisa y conviene cambiarla por una secreta. Si alguna vez se filtra la secreta, se borra en la misma pantalla sin tocar las demás, y se vuelve a correr el script contestando **s**.
4. Después:
   - genera el secreto compartido (`VISION_SECRET`) al azar;
   - guarda las dos claves en Secret Manager;
   - activa las APIs que hacen falta;
   - construye la imagen y despliega el servicio. Tarda unos 10 minutos: instala torch y baja los modelos.
5. Al final prueba el servicio e imprime dos líneas de SQL con la dirección del servicio y el secreto. **Pegalas en Supabase → SQL Editor** y tocá **Run**. No las guardes en ningún archivo ni las mandes por chat: tienen el secreto.

### 6. Comprobar

- En la app: **Perfil → Panel de moderación → Reconocimiento** dice **Configurado**.
- Publicá una foto: en menos de un minuto, **Última foto procesada** dice la hora.
- Lo que ya estaba en la cola lo procesa el trabajo de cada 2 minutos, o **Procesar pendientes ahora**.

## Actualizar el servicio

Después de un cambio en `services/vision`, en Cloud Shell:

```bash
cd ANIMALES && git pull && cd services/vision && bash desplegar.sh
```

Contestá **N** cuando pregunte si querés cambiar las claves: solo se actualiza el código, y el SQL de Supabase no cambia. Si contestás **s**, pide las claves de nuevo, genera otro secreto y hay que volver a pegar el SQL.

## Qué despliega el script

| Qué | Cómo | Por qué |
|---|---|---|
| Región | `us-east5` (Columbus, Ohio) | Capa gratuita (Tier 1) y al lado de Supabase (`us-east-2`, Ohio). |
| CPU y memoria | 2 vCPU, 2 GiB | Medido: ver "Consumo". |
| Instancias | `min-instances 0`, `max-instances 1` | Se apaga sin tráfico y nunca hay dos a la vez. |
| Pedidos | `--concurrency 10`, `--timeout 300` | Las fotos que llegan juntas esperan su turno en la misma instancia. |
| CPU | `--cpu-throttling`, `--no-cpu-boost`, `gen1` | Se cobra solo mientras atiende; sin el refuerzo de CPU al arrancar, que se cobra aparte; la primera generación arranca más rápido. |
| Acceso | `--allow-unauthenticated` | Supabase no tiene cuenta de Google: los endpoints ya exigen `X-Vision-Secret`. |
| Claves | Secret Manager | Ver `docs/DECISIONES.md`, "Las claves del servicio, en Secret Manager". |
| Imágenes viejas | Política de limpieza del repositorio `cloud-run-source-deploy` | Se guardan las 2 últimas. |

## Consumo frente a la capa gratuita

Cloud Run cobra, redondeado a 0,1 s:
- el tiempo que tarda en arrancar;
- el tiempo de cada pedido;
- nada mientras está apagado.

Con 2 vCPU y 2 GiB, cada segundo cobrado son 2 vCPU-segundos y 2 GiB-segundos. La capa gratuita, por mes y por cuenta de facturación, trae 180 000 vCPU-segundos, 360 000 GiB-segundos y 2 millones de pedidos. Se agotan antes los vCPU: alcanzan para **90 000 segundos de servicio por mes** (25 horas).

**Lo medido** (2 núcleos, con los modelos de la misma arquitectura): de 3 a 5 s hasta tener los modelos cargados y de 0,5 a 1 s por foto. En Cloud Run la CPU es más lenta y hay que bajar la imagen. Para la estimación se cuentan **15 s por arranque** y **1 s por foto**.

**La estimación es pesimista:** cada vez que el servicio se apagó (unos 15 minutos sin fotos), el siguiente pedido paga un arranque. Fotos que llegan juntas comparten el arranque.

| Fotos por mes | Arranques (estimados) | Segundos cobrados | vCPU-segundos | De la capa gratuita | Costo |
|---|---|---|---|---|---|
| 100 | 100 (una por vez) | 1 600 | 3 200 | 2 % | US$0 |
| 1 000 | 600 | 10 000 | 20 000 | 11 % | US$0 |
| 5 000 | 1 500 | 27 500 | 55 000 | 31 % | US$0 |
| 20 000 | 3 000 | 65 000 | 130 000 | 72 % | US$0 |
| 50 000 | 3 000 | 95 000 | 190 000 | 106 % | unos US$0,24 |

Pasados los vCPU gratis, cada segundo de servicio cuesta unos US$0,000048: 2 vCPU a precio Tier 1, porque la memoria todavía entra en lo gratis. 10 000 segundos de más son unos US$0,48.

**Lo demás:**
- **Pedidos:** unos 2 por foto (el aviso y alguna vuelta del trabajo de cada 2 minutos), lejos de los 2 millones gratis.
- **Construir la imagen** (Cloud Build): unos 10 minutos por despliegue, de 2 500 minutos gratis por mes.
- **Guardar la imagen** (Artifact Registry): unos 400 MB comprimida y se guardan las 2 últimas. De los 0,5 GB gratis sobran unos 0,3 GB: **unos US$0,03 por mes**. Es lo único que se cobra con seguridad.
- **Secret Manager:** 2 secretos de las 6 versiones gratis. Cada arranque lee los dos, contra 10 000 lecturas gratis por mes.
- **El código subido** (Cloud Storage, `run-sources-…`): unos KB por despliegue, fracciones de centavo.
- **Tráfico:** a Supabase vuelven unos 8 KB por foto, adentro del GB gratis por mes en Norteamérica. Bajar las fotos no se cobra.

Para no pasarte: la alerta de presupuesto de US$1 (paso 4), y **Moderación → Reconocimiento** para ver cuánto se procesa.

## Si algo falla

- **Registros del servicio:** Cloud Shell, `gcloud run services logs read encontrados-vision --region us-east5`, o en la consola: **Cloud Run → encontrados-vision → Registros**.
- **Por qué falló una foto:** en Supabase, `cola_vision.ultimo_error`:
  ```sql
  select estado, intentos, ultimo_error, updated_at from cola_vision
  where estado = 'error' order by updated_at desc limit 10;
  ```
- **Un 401 en los registros:** el secreto de Supabase no coincide con el del servicio. Volvé a pegar el SQL que imprime el script.
- **Un 403 al probar `/salud`:** el proyecto está en una organización que no deja abrir servicios a todos. Corré:
  ```bash
  gcloud run services update encontrados-vision --region us-east5 --no-invoker-iam-check
  ```
- **Volver a la cola las fotos que agotaron los 8 intentos** (por ejemplo, después de arreglar algo), en el SQL Editor:
  ```sql
  update cola_vision set estado = 'pendiente', intentos = 0, ultimo_error = null
  where estado = 'error';
  ```
  Cada fila que vuelve a pendiente avisa al servicio.
- **El trabajo de cada 2 minutos:**
  ```sql
  select status, return_message, start_time from cron.job_run_details
  where jobid = (select jobid from cron.job where jobname = 'vision-pendientes')
  order by start_time desc limit 10;
  ```

## Ajustar el umbral

`config_app` guarda:
- `umbral_similitud` (0,80);
- `radio_coincidencia_m` (15 000);
- `ventana_coincidencia_dias` (60).

### Con fotos de animales conocidos: `evaluar.py`

`evaluar.py` toma una carpeta con una subcarpeta por animal, cada una con dos fotos o más:

```
fotos/
  firulais/  1.jpg 2.jpg 3.jpg
  manchita/  a.jpg b.jpg
```

Para cada umbral, calcula:
- cuántos pares del mismo animal detecta;
- cuántos pares falsos aparecen entre animales distintos de la misma especie;
- como la app, qué parte de las fotos encuentra a su animal y cuántas coincidencias falsas tendría cada foto con 20 animales cerca.

Al final recomienda un umbral: el que más encuentra con 0,2 coincidencias falsas por foto o menos.

Se puede correr en Cloud Shell, que llega a Hugging Face (5 GB de espacio alcanzan):

```bash
cd ANIMALES/services/vision
python3 -m venv ~/venv-vision && . ~/venv-vision/bin/activate
pip install -r requirements.txt pytest
python evaluar.py ~/fotos --especie perro --cache ~/perros.npz
```

La primera vez baja los modelos y calcula todos los embeddings. Con `--cache`, las siguientes corridas solo recalculan la tabla; se puede cambiar `--umbrales 0.6:0.95:0.025`, `--candidatos` o `--falsos-max`.

Conjuntos públicos con identidad y licencia CC BY 4.0, que permite usarlos para evaluar:

| Especie | Conjunto | Qué tiene | De dónde |
|---|---|---|---|
| Perros | MPDD (Multi-pose dog dataset) | 192 perros, unas 9 fotos de cuerpo entero por perro, en distintas posturas | [Mendeley Data](https://data.mendeley.com/datasets/v5j6m8dzhv/1) (30 MB) |
| Gatos | Cat Individual Images | 518 gatos, 13 536 fotos centradas en la cara | [Kaggle](https://www.kaggle.com/datasets/timost1234/cat-individuals) (11 GB) |

No subas esas fotos al repositorio: `.gitignore` ya deja afuera los `.npz`, pero las fotos van en otra carpeta.

### Con las coincidencias reales

Las coincidencias confirmadas y rechazadas quedan en `coincidencias`, con su `similitud`. Con el tiempo son la mejor medida:

```sql
select estado, round(avg(similitud)::numeric, 3) as promedio, count(*)
from coincidencias where estado <> 'pendiente' group by estado;
```

### Cambiar el umbral

```sql
update config_app set valor = '0.78', updated_at = now() where clave = 'umbral_similitud';
```

Rige para las fotos que se procesen desde ese momento.

## Probar y correr en local

Las pruebas no bajan los modelos: usan un modelo falso y una base en memoria.

```bash
cd services/vision
pip install -r requirements-pruebas.txt
pytest
```

Para correr el servicio entero hace falta `requirements.txt` (torch y transformers) y las variables de `.env.example`:

```bash
python -m app
```

Escucha en el puerto de `PORT`, o en el 7860 si no hay.
