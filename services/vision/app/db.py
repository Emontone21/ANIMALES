"""Acceso a Supabase desde el servicio, con la clave service_role.

Se usa la API REST (PostgREST) y Storage directamente con httpx, sin SDK,
para mantener la imagen chica. La clave nunca sale de las variables de entorno.
"""

from __future__ import annotations

import os
from typing import Any

import httpx

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BUCKET = "fotos"
TIMEOUT = httpx.Timeout(30.0)


def configurada() -> bool:
    return bool(SUPABASE_URL and SERVICE_ROLE_KEY)


def _headers() -> dict[str, str]:
    return {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


def _cliente() -> httpx.AsyncClient:
    if not configurada():
        raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY")
    return httpx.AsyncClient(base_url=SUPABASE_URL, headers=_headers(), timeout=TIMEOUT)


async def listar_pendientes() -> list[dict[str, Any]]:
    async with _cliente() as c:
        r = await c.get("/rest/v1/cola_vision_pendientes", params={"select": "*", "limit": "50"})
        r.raise_for_status()
        return r.json()


async def contar_pendientes() -> int:
    """Cuántas fotos de la cola se pueden procesar ahora (sin las que esperan un reintento)."""
    async with _cliente() as c:
        r = await c.get(
            "/rest/v1/cola_vision_pendientes",
            params={"select": "avistamiento_id", "limit": "1"},
            headers={"Prefer": "count=exact"},
        )
        r.raise_for_status()
        return total_de_content_range(r.headers.get("content-range", ""))


def total_de_content_range(valor: str) -> int:
    """PostgREST responde "0-0/12" (o "*/0" si no hay filas): el total va después de la barra."""
    total = valor.rpartition("/")[2]
    return int(total) if total.isdigit() else 0


async def obtener_pendiente(avistamiento_id: str) -> dict[str, Any] | None:
    async with _cliente() as c:
        r = await c.get(
            "/rest/v1/cola_vision_pendientes",
            params={"select": "*", "avistamiento_id": f"eq.{avistamiento_id}"},
        )
        r.raise_for_status()
        filas = r.json()
        return filas[0] if filas else None


def url_foto(foto_path: str) -> str:
    if foto_path.startswith("http://") or foto_path.startswith("https://"):
        return foto_path
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{foto_path}"


async def descargar_foto(foto_path: str) -> bytes:
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as c:
        r = await c.get(url_foto(foto_path))
        r.raise_for_status()
        return r.content


async def guardar_embedding(avistamiento_id: str, embedding: list[float], bbox: dict | None) -> int:
    async with _cliente() as c:
        r = await c.post(
            "/rest/v1/rpc/guardar_embedding",
            json={"p_avistamiento_id": avistamiento_id, "p_embedding": embedding, "p_bbox": bbox},
        )
        r.raise_for_status()
        return int(r.json())


async def marcar_error(avistamiento_id: str, error: str) -> None:
    if not configurada():
        return
    async with _cliente() as c:
        await c.post(
            "/rest/v1/rpc/marcar_error_vision",
            json={"p_avistamiento_id": avistamiento_id, "p_error": error},
        )
