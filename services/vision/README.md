# Servicio de visión

Microservicio Python (FastAPI) que calcula el embedding de cada foto de animal y dispara la búsqueda de coincidencias en Supabase. Corre gratis en un **Space de Hugging Face** (Docker, CPU básica).

## Modelos (licencias permisivas)

| Uso | Modelo | Licencia |
|---|---|---|
| Detectar y recortar al animal | `hustvl/yolos-tiny` | Apache 2.0 |
| Embedding (384 dimensiones) | `facebook/dinov2-small` | Apache 2.0 |

Si no detecta ningún animal usa la foto entera. YOLOv8 queda descartado por ser AGPL.

## Cómo funciona

1. Cada avistamiento con foto entra a `cola_vision` (trigger en Supabase). Cada vez que una fila queda pendiente (al entrar, o al volver a la cola porque se corrigió la especie del caso), si `config_app.vision_url` está seteada, Supabase llama a `POST /procesar` con el header `X-Vision-Secret` (migración 0013; la URL puede terminar o no en `/`).
2. El servicio descarga la foto del bucket público, recorta al animal, calcula el embedding y llama a la RPC `guardar_embedding`.
3. La RPC guarda el vector y, si el caso está abierto y visible, compara por similitud coseno contra los demás animales abiertos y visibles de la misma especie dentro del radio y la ventana de tiempo configurados, y crea filas en `coincidencias` (estado `pendiente`). Nunca sugiere un perdido con otro perdido, ni un encontrado visto solo antes de la pérdida (más de un día antes).
4. Si algo falla, el servicio llama a `marcar_error_vision` y la fila se reintenta con espera creciente: 5, 10, 20… minutos después de cada error, hasta 8 intentos (unas 10 horas). `cola_vision_pendientes` muestra solo lo que ya se puede reintentar.
5. Si el Space estaba dormido y el webhook se perdió, un bucle interno revisa la cola cada `INTERVALO_COLA_SEG` segundos y `POST /procesar-pendientes` la drena a mano.

Para volver a intentar las fotos que agotaron los intentos (por ejemplo, después de arreglar el Space), en el SQL Editor:

```sql
update cola_vision set estado = 'pendiente', intentos = 0, ultimo_error = null
where estado = 'error';
```

Cada fila que vuelve a pendiente avisa al servicio.

## Desplegar en Hugging Face Spaces

1. Creá un Space nuevo: tipo **Docker** (plantilla Blank), hardware **CPU basic** (gratis), visibilidad **pública**. Un Space privado exige un token de Hugging Face en cada pedido y el aviso de Supabase no lo manda; los endpoints igual están protegidos con `X-Vision-Secret`.
2. Subí el contenido de esta carpeta (`Dockerfile`, `requirements.txt`, `app/`). Podés hacerlo con git: el Space es un repo. **No subas este README**: el del Space trae la configuración (`sdk: docker`) y se pisaría.
3. En **Settings → Variables and secrets** cargá `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (secret: la clave `service_role` de **Project Settings → API Keys → Legacy API Keys**, que es un JWT; el servicio la manda como `Bearer`) y `VISION_SECRET` (secret, un string largo al azar).
4. Esperá el build (descarga los modelos; tarda unos minutos). Probá `https://<usuario>-<space>.hf.space/salud`.
5. En Supabase, SQL Editor:

   ```sql
   update config_app set valor = 'https://<usuario>-<space>.hf.space' where clave = 'vision_url';
   update config_app set valor = '<el mismo VISION_SECRET>' where clave = 'vision_secret';
   ```

Para procesar lo que ya estaba en la cola sin esperar el bucle interno:

```bash
curl -X POST https://<usuario>-<space>.hf.space/procesar-pendientes -H "X-Vision-Secret: <VISION_SECRET>"
```

El plan gratuito duerme el Space tras 48 h sin tráfico; el primer request lo despierta (tarda hasta un minuto). Las coincidencias de ese intervalo llegan cuando se procesa la cola.

## Ajustar el umbral

`config_app` guarda `umbral_similitud` (0.80 por defecto), `radio_coincidencia_m` (15 000) y `ventana_coincidencia_dias` (60). Las coincidencias confirmadas y rechazadas quedan en `coincidencias` con su `similitud`: con esa tabla se calibra el umbral.

```sql
select estado, round(avg(similitud)::numeric, 3) as promedio, count(*)
from coincidencias where estado <> 'pendiente' group by estado;
```

## Correr en otro lado

Cualquier host que corra Docker sirve. Variables en `.env.example`. Puerto 7860.
