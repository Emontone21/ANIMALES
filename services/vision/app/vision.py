"""Detección y embedding con modelos open source de licencia permisiva.

- Detector: YOLOS tiny (hustvl/yolos-tiny, Apache 2.0), clases COCO. Se usa
  para recortar al animal más grande de la foto (perro o gato).
- Embedding: DINOv2 small (facebook/dinov2-small, Apache 2.0). Token CLS
  normalizado, 384 dimensiones. Distingue mejor individuos que CLIP.

Si el detector no encuentra ningún animal, se usa la foto entera.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from io import BytesIO

import numpy as np
import torch
from PIL import Image, ImageOps
from transformers import AutoImageProcessor, AutoModel, AutoModelForObjectDetection

log = logging.getLogger("vision.modelos")

MODELO_DETECTOR = "hustvl/yolos-tiny"
MODELO_EMBEDDING = "facebook/dinov2-small"
DIMENSION = 384
UMBRAL_DETECCION = 0.5
# Etiquetas COCO que nos interesan por especie. "otro" acepta cualquier animal.
ETIQUETAS = {
    "perro": {"dog"},
    "gato": {"cat"},
    "otro": {"dog", "cat", "bird", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe"},
}
MARGEN_RECORTE = 0.08

_detector_proc = None
_detector = None
_emb_proc = None
_emb = None


@dataclass
class Resultado:
    embedding: list[float]
    bbox: dict | None


def cargar_modelos() -> None:
    global _detector_proc, _detector, _emb_proc, _emb
    if _emb is not None:
        return
    torch.set_num_threads(max(1, torch.get_num_threads()))
    log.info("cargando %s", MODELO_DETECTOR)
    _detector_proc = AutoImageProcessor.from_pretrained(MODELO_DETECTOR)
    _detector = AutoModelForObjectDetection.from_pretrained(MODELO_DETECTOR).eval()
    log.info("cargando %s", MODELO_EMBEDDING)
    _emb_proc = AutoImageProcessor.from_pretrained(MODELO_EMBEDDING)
    _emb = AutoModel.from_pretrained(MODELO_EMBEDDING).eval()
    log.info("modelos listos")


def modelos_cargados() -> bool:
    return _emb is not None


def abrir_imagen(datos: bytes) -> Image.Image:
    imagen = Image.open(BytesIO(datos))
    imagen = ImageOps.exif_transpose(imagen)  # respetar la rotación del celular
    return imagen.convert("RGB")


@torch.inference_mode()
def detectar(imagen: Image.Image, especie: str) -> dict | None:
    """Devuelve el recorte del animal más grande como {x, y, ancho, alto, confianza}."""
    assert _detector is not None and _detector_proc is not None
    entradas = _detector_proc(images=imagen, return_tensors="pt")
    salidas = _detector(**entradas)
    tamanio = torch.tensor([[imagen.height, imagen.width]])
    resultados = _detector_proc.post_process_object_detection(
        salidas, threshold=UMBRAL_DETECCION, target_sizes=tamanio
    )[0]

    etiquetas_ok = ETIQUETAS.get(especie, ETIQUETAS["otro"])
    id2label = _detector.config.id2label
    mejor = None
    for puntaje, etiqueta, caja in zip(
        resultados["scores"], resultados["labels"], resultados["boxes"], strict=True
    ):
        nombre = id2label[int(etiqueta)]
        if nombre not in etiquetas_ok:
            continue
        x0, y0, x1, y1 = (float(v) for v in caja)
        area = max(0.0, x1 - x0) * max(0.0, y1 - y0)
        if mejor is None or area > mejor["area"]:
            mejor = {"x0": x0, "y0": y0, "x1": x1, "y1": y1, "area": area, "conf": float(puntaje)}

    if mejor is None:
        return None

    # Un poco de margen alrededor del animal ayuda al embedding.
    ancho = mejor["x1"] - mejor["x0"]
    alto = mejor["y1"] - mejor["y0"]
    x0 = max(0.0, mejor["x0"] - ancho * MARGEN_RECORTE)
    y0 = max(0.0, mejor["y0"] - alto * MARGEN_RECORTE)
    x1 = min(float(imagen.width), mejor["x1"] + ancho * MARGEN_RECORTE)
    y1 = min(float(imagen.height), mejor["y1"] + alto * MARGEN_RECORTE)
    return {
        "x": round(x0),
        "y": round(y0),
        "ancho": round(x1 - x0),
        "alto": round(y1 - y0),
        "confianza": round(mejor["conf"], 3),
    }


@torch.inference_mode()
def embedding(imagen: Image.Image) -> list[float]:
    assert _emb is not None and _emb_proc is not None
    entradas = _emb_proc(images=imagen, return_tensors="pt")
    salidas = _emb(**entradas)
    vector = salidas.pooler_output[0].float().numpy()  # CLS con layernorm
    vector = vector / (np.linalg.norm(vector) + 1e-8)
    assert vector.shape[0] == DIMENSION
    return [round(float(v), 6) for v in vector]


def procesar_imagen(datos: bytes, especie: str) -> Resultado:
    cargar_modelos()
    imagen = abrir_imagen(datos)
    bbox = detectar(imagen, especie)
    if bbox:
        recorte = imagen.crop((bbox["x"], bbox["y"], bbox["x"] + bbox["ancho"], bbox["y"] + bbox["alto"]))
    else:
        recorte = imagen
    return Resultado(embedding=embedding(recorte), bbox=bbox)
