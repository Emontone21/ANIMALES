"""Detección y embedding con modelos open source de licencia permisiva.

- Detector: YOLOS tiny (hustvl/yolos-tiny, Apache 2.0), clases COCO. Se usa
  para recortar al animal más grande de la foto (perro o gato).
- Embedding: DINOv2 small (facebook/dinov2-small, Apache 2.0). Token CLS
  normalizado, 384 dimensiones. Distingue mejor individuos que CLIP.

Si el detector no encuentra ningún animal, se usa la foto entera.

torch y transformers se importan recién al cargar los modelos reales: las
pruebas usan un modelo falso (`usar_modelos`) y no los necesitan.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from io import BytesIO
from typing import Protocol

import numpy as np
from PIL import Image, ImageOps

log = logging.getLogger("vision.modelos")

# Se pueden cambiar por una carpeta local (las mediciones usan copias locales).
MODELO_DETECTOR = os.environ.get("MODELO_DETECTOR", "hustvl/yolos-tiny")
MODELO_EMBEDDING = os.environ.get("MODELO_EMBEDDING", "facebook/dinov2-small")
DIMENSION = 384
UMBRAL_DETECCION = 0.5
# Los mismos núcleos que tiene el servicio (2 vCPU en Cloud Run). torch, si no,
# toma los de la máquina entera y se pisa.
HILOS = int(os.environ.get("HILOS", "2"))
# Etiquetas COCO que nos interesan por especie. "otro" acepta cualquier animal.
ETIQUETAS = {
    "perro": {"dog"},
    "gato": {"cat"},
    "otro": {"dog", "cat", "bird", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe"},
}
MARGEN_RECORTE = 0.08


@dataclass
class Resultado:
    embedding: list[float]
    bbox: dict | None


@dataclass
class Deteccion:
    etiqueta: str
    puntaje: float
    caja: tuple[float, float, float, float]  # x0, y0, x1, y1 en píxeles


class Modelos(Protocol):
    def detectar(self, imagen: Image.Image) -> list[Deteccion]: ...

    def embedding(self, imagen: Image.Image) -> list[float]: ...


class ModelosHF:
    """Los modelos reales. Cargar tarda unos segundos: se hace al arrancar el servicio."""

    def __init__(self) -> None:
        import torch
        from transformers import AutoImageProcessor, AutoModel, AutoModelForObjectDetection

        self._torch = torch
        torch.set_num_threads(max(1, HILOS))
        log.info("cargando %s", MODELO_DETECTOR)
        self._detector_proc = AutoImageProcessor.from_pretrained(MODELO_DETECTOR)
        self._detector = AutoModelForObjectDetection.from_pretrained(MODELO_DETECTOR).eval()
        log.info("cargando %s", MODELO_EMBEDDING)
        self._emb_proc = AutoImageProcessor.from_pretrained(MODELO_EMBEDDING)
        self._emb = AutoModel.from_pretrained(MODELO_EMBEDDING).eval()
        log.info("modelos listos")

    def detectar(self, imagen: Image.Image) -> list[Deteccion]:
        torch = self._torch
        with torch.inference_mode():
            entradas = self._detector_proc(images=imagen, return_tensors="pt")
            salidas = self._detector(**entradas)
            tamanio = torch.tensor([[imagen.height, imagen.width]])
            resultados = self._detector_proc.post_process_object_detection(
                salidas, threshold=UMBRAL_DETECCION, target_sizes=tamanio
            )[0]
        id2label = self._detector.config.id2label
        return [
            Deteccion(
                etiqueta=id2label[int(etiqueta)],
                puntaje=float(puntaje),
                caja=tuple(float(v) for v in caja),  # type: ignore[arg-type]
            )
            for puntaje, etiqueta, caja in zip(
                resultados["scores"], resultados["labels"], resultados["boxes"], strict=True
            )
        ]

    def embedding(self, imagen: Image.Image) -> list[float]:
        with self._torch.inference_mode():
            entradas = self._emb_proc(images=imagen, return_tensors="pt")
            salidas = self._emb(**entradas)
            return salidas.pooler_output[0].float().numpy().tolist()  # CLS con layernorm


_modelos: Modelos | None = None


def cargar_modelos() -> None:
    global _modelos
    if _modelos is None:
        _modelos = ModelosHF()


def usar_modelos(modelos: Modelos | None) -> None:
    """Reemplaza los modelos (las pruebas usan uno falso)."""
    global _modelos
    _modelos = modelos


def modelos_cargados() -> bool:
    return _modelos is not None


def abrir_imagen(datos: bytes) -> Image.Image:
    imagen = Image.open(BytesIO(datos))
    imagen = ImageOps.exif_transpose(imagen)  # respetar la rotación del celular
    return imagen.convert("RGB")


def elegir_recorte(
    detecciones: list[Deteccion], especie: str, ancho: int, alto: int
) -> dict | None:
    """El animal más grande de la especie, con un poco de margen: {x, y, ancho, alto, confianza}."""
    etiquetas_ok = ETIQUETAS.get(especie, ETIQUETAS["otro"])
    mejor: Deteccion | None = None
    mejor_area = -1.0
    for d in detecciones:
        if d.etiqueta not in etiquetas_ok or d.puntaje < UMBRAL_DETECCION:
            continue
        x0, y0, x1, y1 = d.caja
        area = max(0.0, x1 - x0) * max(0.0, y1 - y0)
        if area > mejor_area:
            mejor, mejor_area = d, area
    if mejor is None:
        return None

    # Un poco de margen alrededor del animal ayuda al embedding.
    x0, y0, x1, y1 = mejor.caja
    margen_x = (x1 - x0) * MARGEN_RECORTE
    margen_y = (y1 - y0) * MARGEN_RECORTE
    x0 = max(0.0, x0 - margen_x)
    y0 = max(0.0, y0 - margen_y)
    x1 = min(float(ancho), x1 + margen_x)
    y1 = min(float(alto), y1 + margen_y)
    return {
        "x": round(x0),
        "y": round(y0),
        "ancho": round(x1 - x0),
        "alto": round(y1 - y0),
        "confianza": round(mejor.puntaje, 3),
    }


def normalizar(vector: list[float]) -> list[float]:
    """Norma 1, como espera la similitud coseno de pgvector, con 6 decimales."""
    arreglo = np.asarray(vector, dtype=np.float32)
    if arreglo.shape != (DIMENSION,):
        raise ValueError(f"El embedding tiene {arreglo.shape} dimensiones y se esperaban {DIMENSION}")
    arreglo = arreglo / (np.linalg.norm(arreglo) + 1e-8)
    return [round(float(v), 6) for v in arreglo]


def procesar_imagen(datos: bytes, especie: str) -> Resultado:
    cargar_modelos()
    assert _modelos is not None
    imagen = abrir_imagen(datos)
    bbox = elegir_recorte(_modelos.detectar(imagen), especie, imagen.width, imagen.height)
    if bbox:
        recorte = imagen.crop((bbox["x"], bbox["y"], bbox["x"] + bbox["ancho"], bbox["y"] + bbox["alto"]))
    else:
        recorte = imagen
    return Resultado(embedding=normalizar(_modelos.embedding(recorte)), bbox=bbox)
