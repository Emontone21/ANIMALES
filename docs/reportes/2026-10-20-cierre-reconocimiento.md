# Cierre del reconocimiento en Cloud Run

Rama `claude/animales-repo-mxm2ja`, PR #11 (commit de la tarea: `7f55eb5`). Proyecto de Supabase `bwqvuttuodwypwxckxgf`. 20 de octubre de 2026.

## 1. Resumen

**Qué se pidió:** cerrar la tarea de reconocimiento, con el PR #11 revisado y aprobado con un ajuste.

0. **Ajuste:** Supabase depreca las claves legacy `anon` y `service_role` a fines de 2026. El servicio y `desplegar.sh` tienen que aceptar la clave secreta nueva (`sb_secret_…`) y preferirla, mandándola como indica Supabase. La legacy (`eyJ…`) sigue andando mientras exista. Con README, pruebas de pytest para las dos y un commit aparte.
1. Aplicar la 0017 en producción y registrarla: historial de 0001 a 0017 sin duplicados, y `vision-pendientes` y `vision-limpiar-historial` activos en `cron.job`.
2. Correr en la base real `vision.sql` y las otras siete pruebas SQL, de a una.

**Qué se hizo** (paso 0; los pasos 1 y 2 van después de este commit):

- **El servicio prefiere la clave secreta nueva.** La toma de `SUPABASE_SECRET_KEY`; si no está, usa `SUPABASE_SERVICE_ROLE_KEY`. Los headers dependen de la clave, no de la variable:
  - **secreta:** solo en `apikey`, sin `Authorization`, como pide la documentación de Supabase;
  - **legacy:** en `apikey` y como `Authorization: Bearer`, como antes.
- **`desplegar.sh` pide la clave secreta** y dice dónde está. Si recibe la legacy, la acepta con un aviso de la deprecación; si recibe la publishable u otra cosa, se frena. La prueba de la clave antes de desplegar manda los mismos headers que el servicio.
- **7 pruebas nuevas de pytest** cubren las dos claves, incluso los pedidos reales que salen del servicio.

## 2. Cambios

| Archivo | Qué y por qué |
| --- | --- |
| `services/vision/app/db.py` | `clave_desde_entorno` (prefiere `SUPABASE_SECRET_KEY`), `tipo_de_clave` y `headers_para`. La clave secreta va solo en `apikey`; la legacy, también como `Bearer`. Todos los pedidos llevan `User-Agent: encontrados-vision`: Supabase rechaza (401) una clave secreta si el pedido parece de un navegador. `TRANSPORTE` deja que las pruebas vean qué se manda. La foto se sigue bajando del bucket público sin clave. |
| `services/vision/tests/test_db.py` (nuevo) | Pruebas de las dos claves: <ul><li>cuál se prefiere;</li><li>cómo se reconoce cada tipo;</li><li>qué headers lleva cada una;</li><li>los pedidos reales a PostgREST, con `httpx.MockTransport`: la secreta sin `Authorization`, la legacy con `Bearer`, ninguna con un User-Agent de navegador;</li><li>la foto sin clave;</li><li>sin clave, el servicio no se da por configurado.</li></ul> |
| `services/vision/desplegar.sh` | El secreto pasa a llamarse `encontrados-supabase-secret-key` y llega al servicio como `SUPABASE_SECRET_KEY`. El script dice dónde están la URL (botón Connect) y la clave (Settings → API Keys → "Publishable and secret API keys" → Secret keys). Reconoce la clave por su prefijo. La comprobación con `curl` arma los headers según el tipo y los pasa por un descriptor (`-H @<(…)`), no en la línea de comandos. |
| `services/vision/README.md` | Paso 5.3: <ul><li>la URL, en el botón Connect;</li><li>la clave, en Settings → API Keys → "Publishable and secret API keys" → Secret keys, con una propia del servicio (por ejemplo `vision`);</li><li>la legacy anda mientras exista, con el aviso de la deprecación;</li><li>qué hacer si se filtra la clave.</li></ul> |
| `services/vision/.env.example` | `SUPABASE_SECRET_KEY` como la que se prefiere, y la legacy comentada. |
| `docs/DECISIONES.md` | Entrada nueva, "El servicio usa la clave secreta nueva de Supabase": dónde está, cómo se manda, el User-Agent y qué pasa con la legacy. La de Secret Manager habla de la clave secreta. |
| `docs/ARQUITECTURA.md` | La línea "Claves": una clave secreta, o la legacy mientras exista, solo en el servicio de visión. |
| `README.md` | La puesta en marcha ya no manda a copiar la `service_role`: la URL está en Connect y la clave secreta se crea en el paso del servicio de visión. Las migraciones van de 0001 a 0017. |
| `docs/reportes/2026-10-20-cierre-reconocimiento.md` | Este reporte. |

**Cómo manda Supabase cada clave.** No se pudo abrir supabase.com desde este entorno: la red no llega. Se leyó la misma documentación en su repositorio público, en `apps/docs/content/guides/getting-started/api-keys.mdx` del repo `supabase/supabase`. Dice tres cosas:
- Las claves publishable y secreta se mandan en el header `apikey`, no en `Authorization: Bearer`, porque no son JWT.
- Con una clave secreta, el pedido tiene el rol `service_role`, que salta la RLS.
- Una clave secreta en un pedido con User-Agent de navegador da 401.

## 3. Verificaciones

### Paso 0 · La clave secreta nueva

| Qué | Resultado |
| --- | --- |
| `npm run typecheck` | Sin errores. |
| `npm run lint` | Sin errores ni avisos. |
| `npm run test` | 18 suites, 184 pruebas, todas pasan. |
| `npx expo export -p web` | Exportado a `dist/` sin errores. |
| `pytest` en `services/vision` | 33 pruebas pasan: las 26 de antes y las 7 de `test_db.py`. |
| `bash -n` y `shellcheck` de `desplegar.sh` | Sin errores ni avisos. |

**`desplegar.sh` con un `gcloud` y un `curl` falsos.** El `curl` falso anota el nombre de cada header y el tipo de clave que lleva, nunca su valor. Los cuatro casos dieron lo esperado:

1. **Primera vez, clave secreta.**
   - La comprobación mandó solo `apikey` con la secreta.
   - El deploy lleva `--update-secrets SUPABASE_SECRET_KEY=encontrados-supabase-secret-key:latest,VISION_SECRET=encontrados-vision-secret:latest`.
   - Las variables comunes son `HILOS`, `TIEMPO_MAXIMO_COLA_SEG` y `SUPABASE_URL`.
2. **Servicio existente, cambiando a la legacy.**
   - El script avisa de la deprecación.
   - La comprobación mandó `apikey` y `Authorization: Bearer`.
   - Se destruyeron las versiones anteriores de los dos secretos.
3. **Una clave publishable.** El script se frena con salida 1, antes de guardar nada.
4. **Sin cambiar las claves.** El deploy no toca los secretos: no lleva `--update-secrets` ni `SUPABASE_URL`.

Las claves de prueba no aparecen en ninguna salida, en el registro de llamadas ni en los argumentos del deploy.

## 4. Pasos manuales

Al desplegar el servicio (`services/vision/README.md`, paso 5):

1. Crear una clave secreta propia del servicio: Supabase → **Settings → API Keys → "Publishable and secret API keys"** → **Secret keys** → **Add new secret key**, con el nombre `vision`.
2. Pegarla en `desplegar.sh` cuando la pida. No pasa por el chat ni por el repo: queda en Secret Manager.

El servicio todavía no está desplegado, así que no hay nada que migrar.

## 5. Pendientes y riesgos

- **La app sigue con la clave `anon` legacy,** que Supabase también depreca a fines de 2026. Pasarla a la publishable (`sb_publishable_…`) es otra tarea:
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY` en Vercel;
  - `src/lib/env.ts`;
  - la vista previa del link (`api/vista-previa.ts`);
  - los `preconnect` no cambian.

  Queda anotado en `docs/DECISIONES.md`.
- **Las pruebas no tocan un Supabase de verdad con una clave secreta:** se comprobó qué headers salen, no la respuesta del servidor. La primera corrida de `desplegar.sh` lo prueba contra el proyecto real antes de desplegar (paso "La clave funciona…").
- **Prefijos:** el servicio reconoce la clave secreta por `sb_secret_`. Si Supabase cambiara el formato, una clave nueva se mandaría también como `Bearer`, como la legacy, y `desplegar.sh` la rechazaría con un mensaje claro.
