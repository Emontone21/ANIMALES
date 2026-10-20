#!/usr/bin/env bash
# =============================================================================
# Despliega (o actualiza) el servicio de visión de Encontrados en Google Cloud
# Run. Se corre en Cloud Shell, la terminal del navegador de Google Cloud: no
# hay que instalar nada. Paso a paso en services/vision/README.md.
#
#   git clone https://github.com/Emontone21/ANIMALES.git
#   cd ANIMALES/services/vision
#   bash desplegar.sh
#
# La primera vez pide la URL de Supabase y su clave secreta (sin
# mostrarlas), genera el secreto compartido y guarda las dos claves en Secret
# Manager. Las siguientes, pregunta si querés cambiarlas; si no, solo actualiza
# el código. Al final imprime el SQL para pegar en el SQL Editor de Supabase.
# Ninguna clave queda en el repo ni en el historial de la terminal.
# =============================================================================
set -euo pipefail

SERVICIO="${SERVICIO:-encontrados-vision}"
# us-east5 (Columbus, Ohio): capa gratuita (Tier 1) y al lado de Supabase, que
# está en us-east-2 (Ohio). Cada foto se baja de Supabase y vuelve como embedding.
REGION="${REGION:-us-east5}"
# Medido: 660 MB de pico con fotos como las de la app y 840 MB con fotos de
# 12 MP (docs/reportes/2026-10-20-reconocimiento.md). Con 2 vCPU, la capa
# gratuita se agota antes por CPU que por memoria: 2 GiB no achica lo gratis.
MEMORIA="${MEMORIA:-2Gi}"
CPU=2
# Lo más que puede durar un pedido: vaciar la cola tiene un tope de 90 s.
TIEMPO_PEDIDO=300
# Sin refuerzo de CPU al arrancar (--no-cpu-boost): viene prendido en los
# servicios nuevos y se cobra en cada arranque en frío, que acá son casi todos.
SECRETO_CLAVE=encontrados-supabase-secret-key
SECRETO_VISION=encontrados-vision-secret

cd "$(dirname "$0")"

titulo() { printf '\n\033[1m%s\033[0m\n' "$1"; }
falla() { printf '\n\033[31m%s\033[0m\n' "$1" >&2; exit 1; }

PROYECTO="$(gcloud config get-value project 2>/dev/null || true)"
[ -n "$PROYECTO" ] || falla "No hay un proyecto elegido. Corré: gcloud config set project <id-del-proyecto>"
NUMERO="$(gcloud projects describe "$PROYECTO" --format='value(projectNumber)')"
# La cuenta con la que corre el servicio y con la que se construye la imagen.
CUENTA="${NUMERO}-compute@developer.gserviceaccount.com"
echo "Proyecto: $PROYECTO · Región: $REGION · Servicio: $SERVICIO"

titulo "1. Activar las APIs (la primera vez tarda un minuto)"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com --quiet
# En los proyectos nuevos, la cuenta de Compute Engine construye la imagen y
# necesita este permiso (si ya lo tiene, no cambia nada).
gcloud projects add-iam-policy-binding "$PROYECTO" \
  --member="serviceAccount:$CUENTA" --role=roles/run.builder --condition=None --quiet >/dev/null

existe_secreto() { gcloud secrets describe "$1" >/dev/null 2>&1; }
existe_servicio() { gcloud run services describe "$SERVICIO" --region "$REGION" >/dev/null 2>&1; }

# Guarda una versión nueva del secreto y destruye las anteriores (la capa
# gratuita cubre 6 versiones activas). El valor entra por stdin: no queda en
# el historial ni en los argumentos de ningún proceso.
guardar_secreto() {
  local nombre="$1" valor="$2" anteriores
  if existe_secreto "$nombre"; then
    anteriores="$(gcloud secrets versions list "$nombre" --filter='state=ENABLED' --format='value(name)')"
    printf '%s' "$valor" | gcloud secrets versions add "$nombre" --data-file=- --quiet >/dev/null
    for v in $anteriores; do
      gcloud secrets versions destroy "$v" --secret="$nombre" --quiet >/dev/null
    done
  else
    printf '%s' "$valor" | gcloud secrets create "$nombre" --data-file=- \
      --replication-policy=automatic --quiet >/dev/null
  fi
  gcloud secrets add-iam-policy-binding "$nombre" --member="serviceAccount:$CUENTA" \
    --role=roles/secretmanager.secretAccessor --condition=None --quiet >/dev/null
}

titulo "2. Claves"
CAMBIAR=s
if existe_servicio && existe_secreto "$SECRETO_CLAVE" && existe_secreto "$SECRETO_VISION"; then
  read -r -p "El servicio ya existe. ¿Querés cambiar las claves? Si no, solo se actualiza el código. [s/N] " CAMBIAR
fi

VARIABLES="HILOS=$CPU,TIEMPO_MAXIMO_COLA_SEG=90"
OPCIONES_CLAVES=()
if [[ "$CAMBIAR" =~ ^[sS] ]]; then
  echo "En Supabase: la URL está en el botón Connect; la clave, en Settings → API Keys →"
  echo "\"Publishable and secret API keys\" → Secret keys (empieza con sb_secret_)."
  read -r -s -p "SUPABASE_URL (no se muestra): " SUPABASE_URL; echo
  SUPABASE_URL="${SUPABASE_URL%/}"
  [[ "$SUPABASE_URL" =~ ^https://[a-z0-9]+\.supabase\.co$ ]] \
    || falla "La URL tiene que ser como https://<ref>.supabase.co"
  read -r -s -p "Clave secreta de Supabase (no se muestra): " CLAVE; echo
  # La secreta nueva no es un JWT: va solo en el header apikey. La legacy
  # service_role (un JWT) anda mientras Supabase la mantenga y va también como Bearer.
  if [[ "$CLAVE" == sb_secret_* ]]; then
    HEADERS="$(printf 'apikey: %s' "$CLAVE")"
  elif [[ "$CLAVE" == eyJ* ]]; then
    echo "Es la clave legacy service_role: anda, pero Supabase la depreca a fines de 2026."
    echo "Conviene una secreta nueva (sb_secret_…) y volver a correr el script con ella."
    HEADERS="$(printf 'apikey: %s\nAuthorization: Bearer %s' "$CLAVE" "$CLAVE")"
  else
    falla "Tiene que ser una clave secreta (sb_secret_…) o la legacy service_role (eyJ…), no la publishable."
  fi

  # Antes de desplegar: que la clave sirva y que la base tenga la cola de visión.
  # Los headers van por un archivo temporal del proceso, no en la línea de comandos.
  CODIGO="$(curl -s -o /dev/null -w '%{http_code}' -H @<(printf '%s\n' "$HEADERS") \
    "$SUPABASE_URL/rest/v1/cola_vision_pendientes?select=avistamiento_id&limit=1" || true)"
  unset HEADERS
  case "$CODIGO" in
    200) echo "La clave funciona y la base tiene la cola de visión." ;;
    401|403) falla "Supabase rechazó la clave (HTTP $CODIGO). Revisá que sea una clave secreta del proyecto." ;;
    404) falla "La base no tiene la cola de visión (HTTP 404): faltan migraciones." ;;
    *) falla "No se pudo hablar con Supabase (HTTP $CODIGO). Revisá la URL." ;;
  esac

  echo "Generando el secreto compartido (VISION_SECRET)…"
  VISION_SECRET="$(openssl rand -hex 32 2>/dev/null || python3 -c 'import secrets; print(secrets.token_hex(32))')"
  guardar_secreto "$SECRETO_CLAVE" "$CLAVE"
  guardar_secreto "$SECRETO_VISION" "$VISION_SECRET"
  unset CLAVE VISION_SECRET
  VARIABLES="$VARIABLES,SUPABASE_URL=$SUPABASE_URL"
  OPCIONES_CLAVES=(
    --update-secrets "SUPABASE_SECRET_KEY=$SECRETO_CLAVE:latest,VISION_SECRET=$SECRETO_VISION:latest"
  )
  echo "Claves guardadas en Secret Manager."
else
  echo "Se mantienen las claves de antes."
fi

titulo "3. Construir y desplegar (unos 10 minutos: instala torch y baja los modelos)"
gcloud run deploy "$SERVICIO" \
  --source . \
  --region "$REGION" \
  --cpu "$CPU" \
  --memory "$MEMORIA" \
  --min-instances 0 \
  --max-instances 1 \
  --concurrency 10 \
  --timeout "$TIEMPO_PEDIDO" \
  --cpu-throttling \
  --no-cpu-boost \
  --execution-environment gen1 \
  --allow-unauthenticated \
  --update-env-vars "$VARIABLES" \
  "${OPCIONES_CLAVES[@]}" \
  --quiet

# Que las imágenes viejas no se acumulen: se guardan las 2 últimas.
POLITICA="$(mktemp)"
cat > "$POLITICA" <<'JSON'
[
  {"name": "guardar-las-ultimas", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": 2}},
  {"name": "borrar-el-resto", "action": {"type": "Delete"}, "condition": {"tagState": "any"}}
]
JSON
gcloud artifacts repositories set-cleanup-policies cloud-run-source-deploy \
  --location="$REGION" --policy="$POLITICA" --no-dry-run --quiet >/dev/null \
  || echo "(No se pudo poner la limpieza de imágenes viejas; no impide que el servicio ande.)"
rm -f "$POLITICA"

URL="$(gcloud run services describe "$SERVICIO" --region "$REGION" --format='value(status.url)')"

titulo "4. Probar el servicio (el primer pedido lo despierta: puede tardar ~30 s)"
CODIGO="$(curl -s -o /tmp/salud.json -w '%{http_code}' --max-time 120 "$URL/salud" || true)"
SALUD="$(cat /tmp/salud.json 2>/dev/null || true)"; rm -f /tmp/salud.json
echo "$URL/salud → HTTP $CODIGO ${SALUD}"
if [ "$CODIGO" = "403" ]; then
  echo "Google no dejó abrir el servicio a todos (política de la organización). Probá:"
  echo "  gcloud run services update $SERVICIO --region $REGION --no-invoker-iam-check"
elif [[ "$SALUD" != *'"modelos":true'* || "$SALUD" != *'"db":true'* ]]; then
  echo "Ojo: esperaba {\"ok\":true,\"modelos\":true,\"db\":true}. Mirá los registros:"
  echo "  gcloud run services logs read $SERVICIO --region $REGION"
fi

titulo "5. Conectar Supabase"
VISION_SECRET="$(gcloud secrets versions access latest --secret="$SECRETO_VISION")"
cat <<SQL
Pegá esto en Supabase → SQL Editor y tocá Run (si no cambiaste las claves, ya está
cargado y no hace falta). No lo guardes en ningún archivo: tiene el secreto.

update public.config_app set valor = '$URL', updated_at = now() where clave = 'vision_url';
update public.config_app set valor = '$VISION_SECRET', updated_at = now() where clave = 'vision_secret';

SQL
unset VISION_SECRET
echo "Listo. En la app: Perfil → Panel de moderación → Reconocimiento."
