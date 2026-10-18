"""Servicio de visión de Encontrados.

Recibe avisos de Supabase (webhook por pg_net) o consulta la cola de
avistamientos pendientes, calcula el embedding de cada foto y llama a la RPC
`guardar_embedding`, que es la que busca coincidencias en la base.

Endpoints:
  GET  /salud                -> estado y modelos cargados
  POST /procesar             -> {"avistamiento_id": "..."}  (webhook)
  POST /procesar-pendientes  -> procesa toda la cola (cron o manual)

Todos los POST exigen el header X-Vision-Secret.
"""

from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from pydantic import BaseModel

from app import db, vision

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("vision")

VISION_SECRET = os.environ.get("VISION_SECRET", "")
INTERVALO_COLA_SEG = int(os.environ.get("INTERVALO_COLA_SEG", "300"))


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    # Cargar modelos al arrancar para que el primer request no espere.
    await asyncio.to_thread(vision.cargar_modelos)
    tarea = asyncio.create_task(_bucle_cola())
    yield
    tarea.cancel()


app = FastAPI(title="Encontrados · visión", lifespan=ciclo_de_vida)


class PedidoProcesar(BaseModel):
    avistamiento_id: str


def _verificar_secreto(secreto: str | None) -> None:
    if not VISION_SECRET:
        raise HTTPException(500, "VISION_SECRET no configurado en el servicio")
    if secreto != VISION_SECRET:
        raise HTTPException(401, "Secreto inválido")


@app.get("/salud")
async def salud():
    return {"ok": True, "modelos": vision.modelos_cargados(), "db": db.configurada()}


@app.post("/procesar")
async def procesar(
    pedido: PedidoProcesar,
    tareas: BackgroundTasks,
    x_vision_secret: str | None = Header(default=None),
):
    _verificar_secreto(x_vision_secret)
    tareas.add_task(_procesar_uno_seguro, pedido.avistamiento_id)
    return {"aceptado": True}


@app.post("/procesar-pendientes")
async def procesar_pendientes(x_vision_secret: str | None = Header(default=None)):
    _verificar_secreto(x_vision_secret)
    procesados = await _drenar_cola()
    return {"procesados": procesados}


# --- Procesamiento -----------------------------------------------------------

_lock = asyncio.Lock()


async def _procesar_uno_seguro(avistamiento_id: str) -> bool:
    try:
        return await _procesar_uno(avistamiento_id)
    except Exception as e:  # noqa: BLE001 - registramos y seguimos
        log.exception("fallo procesando %s", avistamiento_id)
        await db.marcar_error(avistamiento_id, str(e))
        return False


async def _procesar_uno(avistamiento_id: str) -> bool:
    item = await db.obtener_pendiente(avistamiento_id)
    if item is None:
        log.info("avistamiento %s no está pendiente; se omite", avistamiento_id)
        return False

    async with _lock:  # los modelos no son thread-safe; de a uno
        imagen = await db.descargar_foto(item["foto_path"])
        resultado = await asyncio.to_thread(vision.procesar_imagen, imagen, item["especie"])

    coincidencias = await db.guardar_embedding(
        avistamiento_id, resultado.embedding, resultado.bbox
    )
    log.info(
        "avistamiento %s procesado (recorte=%s, coincidencias=%s)",
        avistamiento_id,
        "sí" if resultado.bbox else "no",
        coincidencias,
    )
    return True


async def _drenar_cola() -> int:
    procesados = 0
    for item in await db.listar_pendientes():
        if await _procesar_uno_seguro(item["avistamiento_id"]):
            procesados += 1
    return procesados


async def _bucle_cola() -> None:
    """Revisa la cola cada tanto por si algún webhook se perdió mientras dormíamos."""
    while True:
        try:
            if db.configurada():
                n = await _drenar_cola()
                if n:
                    log.info("cola: %s avistamientos procesados", n)
        except Exception:  # noqa: BLE001
            log.exception("fallo en el bucle de la cola")
        await asyncio.sleep(INTERVALO_COLA_SEG)
