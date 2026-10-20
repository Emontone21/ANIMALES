"""Pruebas del servicio sin modelos reales ni Supabase: un modelo falso y una base en memoria."""

from __future__ import annotations

import os
import sys
from io import BytesIO
from pathlib import Path

import pytest
from PIL import Image

# Antes de importar el servicio: el secreto se lee al importar.
os.environ["VISION_SECRET"] = "secreto-de-prueba"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import db, main, vision  # noqa: E402

SECRETO = {"X-Vision-Secret": "secreto-de-prueba"}


class ModelosFalsos:
    """Detecta un perro en el centro y devuelve un embedding que depende de la imagen."""

    def __init__(self, detecciones: list[vision.Deteccion] | None = None, demora: float = 0.0):
        self.detecciones = detecciones
        self.demora = demora
        self.llamadas = 0

    def detectar(self, imagen):
        if self.detecciones is not None:
            return self.detecciones
        w, h = imagen.width, imagen.height
        return [vision.Deteccion("dog", 0.9, (w * 0.25, h * 0.25, w * 0.75, h * 0.75))]

    def embedding(self, imagen):
        import time

        if self.demora:
            time.sleep(self.demora)
        self.llamadas += 1
        r, g, b = imagen.resize((1, 1)).getpixel((0, 0))
        return [float(r + 1), float(g + 1), float(b + 1)] + [1.0] * (vision.DIMENSION - 3)


class BaseFalsa:
    """Lo mínimo de Supabase que usa el servicio, en memoria."""

    def __init__(self):
        self.pendientes: dict[str, dict] = {}
        self.guardados: dict[str, dict] = {}
        self.errores: dict[str, str] = {}
        self.fallar_descarga: set[str] = set()

    def agregar(self, avistamiento_id: str, especie: str = "perro"):
        self.pendientes[avistamiento_id] = {
            "avistamiento_id": avistamiento_id,
            "estado": "pendiente",
            "intentos": 0,
            "foto_path": f"u/{avistamiento_id}.jpg",
            "especie": especie,
        }

    async def listar_pendientes(self):
        return list(self.pendientes.values())[:50]

    async def contar_pendientes(self):
        return len(self.pendientes)

    async def obtener_pendiente(self, avistamiento_id):
        return self.pendientes.get(avistamiento_id)

    async def descargar_foto(self, foto_path):
        avistamiento_id = foto_path.split("/")[-1].removesuffix(".jpg")
        if avistamiento_id in self.fallar_descarga:
            raise RuntimeError("404 al bajar la foto")
        imagen = Image.new("RGB", (64, 48), (200, 120, 40))
        salida = BytesIO()
        imagen.save(salida, format="JPEG")
        return salida.getvalue()

    async def guardar_embedding(self, avistamiento_id, embedding, bbox):
        self.guardados[avistamiento_id] = {"embedding": embedding, "bbox": bbox}
        self.pendientes.pop(avistamiento_id, None)
        return 1

    async def marcar_error(self, avistamiento_id, error):
        # Como la base: queda con error y sale de la vista hasta el reintento.
        self.errores[avistamiento_id] = error
        self.pendientes.pop(avistamiento_id, None)


@pytest.fixture
def modelos():
    falsos = ModelosFalsos()
    vision.usar_modelos(falsos)
    yield falsos
    vision.usar_modelos(None)


@pytest.fixture
def base(monkeypatch):
    falsa = BaseFalsa()
    for nombre in (
        "listar_pendientes",
        "contar_pendientes",
        "obtener_pendiente",
        "descargar_foto",
        "guardar_embedding",
        "marcar_error",
    ):
        monkeypatch.setattr(db, nombre, getattr(falsa, nombre))
    monkeypatch.setattr(db, "configurada", lambda: True)
    return falsa


@pytest.fixture
def cliente(modelos, base):
    from fastapi.testclient import TestClient

    with TestClient(main.app) as c:
        yield c
