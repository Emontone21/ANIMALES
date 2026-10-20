"""Recorte, normalización y procesamiento de una foto con el modelo falso."""

from __future__ import annotations

from io import BytesIO

import numpy as np
import pytest
from PIL import Image

from app import db, vision
from app.vision import Deteccion


def test_elige_el_animal_mas_grande_de_la_especie_con_margen():
    detecciones = [
        Deteccion("dog", 0.9, (10, 10, 30, 30)),  # chico
        Deteccion("dog", 0.8, (100, 50, 300, 250)),  # el más grande
        Deteccion("cat", 0.99, (0, 0, 400, 300)),  # otra especie
        Deteccion("dog", 0.3, (0, 0, 400, 300)),  # poca confianza
    ]
    recorte = vision.elegir_recorte(detecciones, "perro", 400, 300)
    # 8 % de margen de cada lado: 16 px en los dos ejes.
    assert recorte == {"x": 84, "y": 34, "ancho": 232, "alto": 232, "confianza": 0.8}


def test_el_margen_no_se_sale_de_la_foto():
    recorte = vision.elegir_recorte([Deteccion("cat", 0.9, (0, 0, 100, 80))], "gato", 100, 80)
    assert recorte == {"x": 0, "y": 0, "ancho": 100, "alto": 80, "confianza": 0.9}


def test_sin_animal_de_la_especie_no_hay_recorte():
    assert vision.elegir_recorte([Deteccion("cat", 0.9, (0, 0, 10, 10))], "perro", 50, 50) is None
    assert vision.elegir_recorte([], "perro", 50, 50) is None
    # "otro" acepta cualquier animal de la lista.
    assert vision.elegir_recorte([Deteccion("horse", 0.9, (0, 0, 10, 10))], "otro", 50, 50)


def test_normalizar_deja_norma_1_y_controla_la_dimension():
    vector = vision.normalizar([3.0, 4.0] + [0.0] * 382)
    assert vector[:2] == [0.6, 0.8]
    assert np.isclose(np.linalg.norm(vector), 1.0, atol=1e-5)
    with pytest.raises(ValueError):
        vision.normalizar([1.0] * 10)


def _jpeg(color, tamanio=(80, 60)):
    salida = BytesIO()
    Image.new("RGB", tamanio, color).save(salida, format="JPEG")
    return salida.getvalue()


def test_procesar_imagen_recorta_y_normaliza(modelos):
    resultado = vision.procesar_imagen(_jpeg((10, 200, 30)), "perro")
    # La mitad central de 80 × 60 (40 × 30), con 8 % de margen de cada lado.
    assert resultado.bbox == {"x": 17, "y": 13, "ancho": 46, "alto": 35, "confianza": 0.9}
    assert len(resultado.embedding) == vision.DIMENSION
    assert np.isclose(np.linalg.norm(resultado.embedding), 1.0, atol=1e-5)


def test_sin_deteccion_usa_la_foto_entera(modelos):
    modelos.detecciones = []
    resultado = vision.procesar_imagen(_jpeg((10, 200, 30)), "gato")
    assert resultado.bbox is None


def test_respeta_la_rotacion_del_celular():
    imagen = Image.new("RGB", (80, 40), (0, 0, 0))
    exif = imagen.getexif()
    exif[0x0112] = 6  # rotada 90°
    salida = BytesIO()
    imagen.save(salida, format="JPEG", exif=exif)
    abierta = vision.abrir_imagen(salida.getvalue())
    assert (abierta.width, abierta.height) == (40, 80)


def test_total_de_content_range():
    assert db.total_de_content_range("0-0/12") == 12
    assert db.total_de_content_range("*/0") == 0
    assert db.total_de_content_range("") == 0
