"""Servicio de visión de Encontrados.

Recibe avisos de Supabase (pg_net), calcula el embedding de cada foto y llama a
la RPC `guardar_embedding`, que es la que busca coincidencias en la base.

Corre en Google Cloud Run, que solo da CPU mientras atiende un pedido y apaga
la instancia sin tráfico: todo el trabajo se hace dentro del pedido y se
responde al terminar. No hay tareas en segundo plano ni bucles internos: lo que
quede pendiente lo vuelve a pedir el trabajo de pg_cron de Supabase (cada 2
minutos, solo si hay fotos pendientes).

Endpoints:
  GET  /salud                -> estado y modelos cargados
  POST /procesar             -> {"avistamiento_id": "..."}: procesa esa foto
  POST /procesar-pendientes  -> vacía la cola con un tope de tiempo

Todos los POST exigen el header X-Vision-Secret.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from collections.abc import Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from app import db, vision

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("vision")

VISION_SECRET = os.environ.get("VISION_SECRET", "")
# Tope de /procesar-pendientes. Supabase espera la respuesta (pg_net) un poco
# más que esto más el arranque en frío: ver la migración 0017.
TIEMPO_MAXIMO_COLA_SEG = float(os.environ.get("TIEMPO_MAXIMO_COLA_SEG", "90"))


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    # Los modelos se cargan antes de aceptar pedidos: Cloud Run espera a que el
    # servicio escuche, así el primer pedido no los espera dentro del suyo.
    await asyncio.to_thread(vision.cargar_modelos)
    yield


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
async def procesar(pedido: PedidoProcesar, x_vision_secret: str | None = Header(default=None)):
    _verificar_secreto(x_vision_secret)
    return await _procesar_uno_seguro(pedido.avistamiento_id)


@app.post("/procesar-pendientes")
async def procesar_pendientes(x_vision_secret: str | None = Header(default=None)):
    _verificar_secreto(x_vision_secret)
    # Si el cron vuelve a llamar mientras una vuelta anterior sigue, no se
    # duplica el trabajo: esa vuelta ya se ocupa.
    if _vaciando.locked():
        return {"procesados": 0, "errores": 0, "quedan": await db.contar_pendientes(), "ocupado": True}
    async with _vaciando:
        return await vaciar_cola(TIEMPO_MAXIMO_COLA_SEG)


# --- Procesamiento -----------------------------------------------------------

# Los modelos no son thread-safe: la inferencia va de a una.
_inferencia = asyncio.Lock()
_vaciando = asyncio.Lock()
# Lo que se está procesando ahora: el aviso de una foto y el cron pueden pedir la misma.
_en_curso: set[str] = set()


async def _procesar_uno_seguro(avistamiento_id: str) -> dict:
    if avistamiento_id in _en_curso:
        return {"procesado": False, "motivo": "en_curso"}
    _en_curso.add(avistamiento_id)
    try:
        return await _procesar_uno(avistamiento_id)
    except Exception as e:  # noqa: BLE001 - se registra y la base lo reintenta más tarde
        log.exception("fallo procesando %s", avistamiento_id)
        await db.marcar_error(avistamiento_id, str(e))
        return {"procesado": False, "motivo": "error"}
    finally:
        _en_curso.discard(avistamiento_id)


async def _procesar_uno(avistamiento_id: str) -> dict:
    item = await db.obtener_pendiente(avistamiento_id)
    if item is None:
        log.info("avistamiento %s no está pendiente; se omite", avistamiento_id)
        return {"procesado": False, "motivo": "no_pendiente"}

    imagen = await db.descargar_foto(item["foto_path"])
    inicio = time.monotonic()
    async with _inferencia:
        resultado = await asyncio.to_thread(vision.procesar_imagen, imagen, item["especie"])
    segundos = time.monotonic() - inicio

    coincidencias = await db.guardar_embedding(avistamiento_id, resultado.embedding, resultado.bbox)
    log.info(
        "avistamiento %s procesado en %.2f s (recorte=%s, coincidencias=%s)",
        avistamiento_id,
        segundos,
        "sí" if resultado.bbox else "no",
        coincidencias,
    )
    return {"procesado": True, "coincidencias": coincidencias}


async def vaciar_cola(
    tope_seg: float, reloj: Callable[[], float] = time.monotonic
) -> dict:
    """Procesa la cola hasta vaciarla o hasta pasar el tope de tiempo.

    Una foto que falla queda con error y la base la reintenta más tarde (sale
    de la vista hasta entonces). Las que se intentaron en esta vuelta no se
    repiten, así una foto que siga apareciendo no la traba.
    """
    limite = reloj() + tope_seg
    procesados = errores = 0
    intentados: set[str] = set()
    while reloj() < limite:
        nuevos = [i for i in await db.listar_pendientes() if i["avistamiento_id"] not in intentados]
        if not nuevos:
            break
        for item in nuevos:
            if reloj() >= limite:
                break
            intentados.add(item["avistamiento_id"])
            resultado = await _procesar_uno_seguro(item["avistamiento_id"])
            if resultado["procesado"]:
                procesados += 1
            elif resultado["motivo"] == "error":
                errores += 1
    quedan = await db.contar_pendientes()
    log.info("cola: %s procesados, %s con error, quedan %s", procesados, errores, quedan)
    return {"procesados": procesados, "errores": errores, "quedan": quedan}
