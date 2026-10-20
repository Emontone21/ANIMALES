"""evaluar.py con embeddings armados a mano (sin modelos)."""

from __future__ import annotations

import numpy as np

import evaluar


def _unitarios(*vectores):
    m = np.asarray(vectores, dtype=np.float64)
    return m / np.linalg.norm(m, axis=1, keepdims=True)


# Tres animales con dos fotos cada uno. Las fotos de un mismo animal se parecen
# (0,96) y "toby" se parece bastante a "rocco" (0,80): animales muy parecidos.
EMB = _unitarios(
    [1, 0, 0, 0], [0.96, 0.28, 0, 0],  # rocco
    [0.8, 0, 0.6, 0], [0.768, 0, 0.6, 0.224],  # toby
    [0, 0, 0, 1], [0, 0.28, 0, 0.96],  # luna
)
ANIMALES = ["rocco", "rocco", "toby", "toby", "luna", "luna"]


def test_pares_del_mismo_animal_y_de_distintos():
    mismo, distintos = evaluar.pares(evaluar.similitudes(EMB), ANIMALES)
    assert mismo.size == 3  # un par por animal
    assert distintos.size == 12  # 15 pares en total
    assert np.all(mismo > 0.9)


def test_cada_foto_contra_la_mejor_de_cada_animal():
    propio, otros = evaluar.mejores_por_animal(evaluar.similitudes(EMB), ANIMALES)
    assert np.allclose(propio, [0.96, 0.96, propio[2], propio[3], 0.96, 0.96], atol=0.01)
    # Columnas en orden alfabético: luna, rocco, toby. La propia queda vacía.
    assert np.isnan(otros[0, 1]) and np.isnan(otros[4, 0])
    assert otros[0, 2] > 0.75  # rocco se parece a toby


def test_tabla_y_recomendacion():
    filas = evaluar.tabla(evaluar.similitudes(EMB), ANIMALES, [0.5, 0.7, 0.9], candidatos=2)
    por_umbral = {f.umbral: f for f in filas}
    # Con 0,9 encuentra a todos y no hay falsos.
    assert por_umbral[0.9].encuentra == 1.0
    assert por_umbral[0.9].pares_falsos == 0
    assert por_umbral[0.9].falsos_por_foto == 0.0
    # Con 0,7 aparecen los pares falsos de rocco y toby.
    assert por_umbral[0.7].pares_falsos > 0
    assert por_umbral[0.7].falsos_por_foto > 0
    # Más bajo no encuentra más y suma falsos: recomienda 0,9.
    assert evaluar.recomendar(filas, falsos_max=0.1).umbral == 0.9
    # Si ninguno alcanza, no recomienda nada.
    assert evaluar.recomendar(filas[:2], falsos_max=0.0) is None
    # Ni uno que no encuentra ninguna foto, aunque no tenga falsos.
    nada = evaluar.tabla(evaluar.similitudes(EMB), ANIMALES, [0.999], candidatos=2)
    assert nada[0].encuentra == 0 and evaluar.recomendar(nada, falsos_max=0.1) is None


def test_rango_de_umbrales():
    assert evaluar.rango("0.6:0.8:0.1") == [0.6, 0.7, 0.8]


def test_lee_solo_animales_con_dos_fotos(tmp_path):
    (tmp_path / "a").mkdir()
    (tmp_path / "b").mkdir()
    for nombre in ("1.jpg", "2.JPG", "nota.txt"):
        (tmp_path / "a" / nombre).write_bytes(b"x")
    (tmp_path / "b" / "1.jpg").write_bytes(b"x")
    fotos = evaluar.leer_carpeta(tmp_path, max_fotos=6)
    assert [(a, p.name) for a, p in fotos] == [("a", "1.jpg"), ("a", "2.JPG")]
