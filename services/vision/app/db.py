"""Acceso a Supabase desde el servicio, con una clave que salta la RLS.

Se usa la API REST (PostgREST) y Storage directamente con httpx, sin SDK,
para mantener la imagen chica. La clave nunca sale de las variables de entorno.

Clave: la secreta nueva (sb_secret_…, SUPABASE_SECRET_KEY), que es la que se
prefiere, o mientras exista la legacy service_role (eyJ…,
SUPABASE_SERVICE_ROLE_KEY), que Supabase depreca a fines de 2026. La nueva no
es un JWT: va solo en el header apikey (docs de Supabase, "API keys", Known
limitations). La legacy va también como Authorization: Bearer.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from typing import Any, Literal

import httpx

PREFIJO_SECRETA = "sb_secret_"
PREFIJO_LEGACY = "eyJ"  # un JWT
# Supabase rechaza la clave secreta si el pedido parece de un navegador (User-Agent).
AGENTE = "encontrados-vision"

TipoClave = Literal["secreta", "legacy", "desconocida"]


def clave_desde_entorno(entorno: Mapping[str, str]) -> str:
    """La clave secreta nueva si está; si no, la legacy service_role."""
    return (entorno.get("SUPABASE_SECRET_KEY") or entorno.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()


def tipo_de_clave(clave: str) -> TipoClave:
    if clave.startswith(PREFIJO_SECRETA):
        return "secreta"
    if clave.startswith(PREFIJO_LEGACY):
        return "legacy"
    return "desconocida"


def headers_para(clave: str) -> dict[str, str]:
    """Los headers de PostgREST y Storage según el tipo de clave."""
    headers = {"apikey": clave, "Content-Type": "application/json", "User-Agent": AGENTE}
    # Solo la legacy es un JWT: la nueva en Authorization fallaría donde se verifica como JWT.
    if tipo_de_clave(clave) != "secreta":
        headers["Authorization"] = f"Bearer {clave}"
    return headers


SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
CLAVE = clave_desde_entorno(os.environ)
BUCKET = "fotos"
TIMEOUT = httpx.Timeout(30.0)
# Las pruebas ponen un transporte falso para ver qué se manda.
TRANSPORTE: httpx.AsyncBaseTransport | None = None


def configurada() -> bool:
    return bool(SUPABASE_URL and CLAVE)


def _cliente() -> httpx.AsyncClient:
    if not configurada():
        raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_SECRET_KEY")
    return httpx.AsyncClient(
        base_url=SUPABASE_URL, headers=headers_para(CLAVE), timeout=TIMEOUT, transport=TRANSPORTE
    )


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
    async with httpx.AsyncClient(
        timeout=TIMEOUT, follow_redirects=True, headers={"User-Agent": AGENTE}, transport=TRANSPORTE
    ) as c:
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
