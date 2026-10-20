"""Evalúa el reconocimiento con fotos de animales conocidos.

Uso:
    python evaluar.py CARPETA --especie perro [--cache embeddings.npz]

CARPETA tiene una subcarpeta por animal, con dos o más fotos de ese animal:

    CARPETA/
      firulais/  1.jpg 2.jpg 3.jpg
      manchita/  a.jpg b.jpg
      ...

Todas las fotos tienen que ser de la especie de --especie (para comparar
perros con perros y gatos con gatos, como la app). Calcula los embeddings con
el mismo recorte y el mismo modelo que el servicio y, para cada umbral:

- pares del mismo animal: cuántos pares de fotos de un mismo animal superan el
  umbral (los que el servicio detectaría);
- pares falsos: cuántos pares de animales distintos lo superan;
- como en la app, que compara cada foto nueva con la mejor foto de cada otro
  animal: qué parte de las fotos encuentra a su animal y cuántas coincidencias
  falsas tendría cada foto si hubiera --candidatos animales cerca.

Recomienda el umbral más bajo (el que más encuentra) que no pase de
--falsos-max coincidencias falsas por foto. Los embeddings se guardan en
--cache: la segunda vez no se recalculan.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np

EXTENSIONES = {".jpg", ".jpeg", ".png", ".webp"}


@dataclass
class Fila:
    umbral: float
    pares_mismo: int
    total_mismo: int
    pares_falsos: int
    total_falsos: int
    encuentra: float  # fracción de fotos que encuentran a su animal
    falsos_por_foto: float  # con --candidatos animales cerca


# --- Cálculos (sin modelos: los usan las pruebas) ------------------------------


def similitudes(embeddings: np.ndarray) -> np.ndarray:
    """Similitud coseno entre todas las fotos (los embeddings ya vienen con norma 1)."""
    return embeddings @ embeddings.T


def pares(sim: np.ndarray, animales: list[str]) -> tuple[np.ndarray, np.ndarray]:
    """Similitudes de los pares del mismo animal y de los pares de animales distintos."""
    etiquetas = np.asarray(animales)
    mismo = etiquetas[:, None] == etiquetas[None, :]
    arriba = np.triu(np.ones_like(mismo, dtype=bool), k=1)
    return sim[mismo & arriba], sim[~mismo & arriba]


def mejores_por_animal(sim: np.ndarray, animales: list[str]) -> tuple[np.ndarray, np.ndarray]:
    """Como guardar_embedding: cada foto contra la mejor foto de cada animal.

    Devuelve, por foto, la mejor similitud con otra foto de su animal (nan si
    no tiene otra) y una matriz fotos × animales con la mejor similitud con
    cada otro animal (nan en el suyo).
    """
    nombres = sorted(set(animales))
    indice = {nombre: i for i, nombre in enumerate(nombres)}
    columnas = np.asarray([indice[a] for a in animales])
    n = len(animales)
    propio = np.full(n, np.nan)
    otros = np.full((n, len(nombres)), -np.inf)
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            if columnas[j] == columnas[i]:
                propio[i] = sim[i, j] if np.isnan(propio[i]) else max(propio[i], sim[i, j])
            else:
                otros[i, columnas[j]] = max(otros[i, columnas[j]], sim[i, j])
    otros[np.arange(n), columnas] = np.nan
    return propio, otros


def tabla(
    sim: np.ndarray, animales: list[str], umbrales: list[float], candidatos: int
) -> list[Fila]:
    mismo, distintos = pares(sim, animales)
    propio, otros = mejores_por_animal(sim, animales)
    con_otra = ~np.isnan(propio)
    cantidad_otros = np.sum(~np.isnan(otros), axis=1)
    filas = []
    for u in umbrales:
        # Coincidencias falsas por foto, llevadas a "candidatos" animales cerca.
        falsos = np.nansum(otros >= u, axis=1) / np.maximum(cantidad_otros, 1) * candidatos
        filas.append(
            Fila(
                umbral=round(u, 4),
                pares_mismo=int(np.sum(mismo >= u)),
                total_mismo=int(mismo.size),
                pares_falsos=int(np.sum(distintos >= u)),
                total_falsos=int(distintos.size),
                encuentra=float(np.mean(propio[con_otra] >= u)) if con_otra.any() else 0.0,
                falsos_por_foto=float(np.mean(falsos)),
            )
        )
    return filas


def recomendar(filas: list[Fila], falsos_max: float) -> Fila | None:
    """El umbral que más encuentra sin pasar de falsos_max coincidencias falsas por foto.

    Uno que no encuentra ninguna foto no sirve aunque no tenga falsos.
    """
    aceptables = [f for f in filas if f.falsos_por_foto <= falsos_max and f.encuentra > 0]
    if not aceptables:
        return None
    return max(aceptables, key=lambda f: (f.encuentra, f.umbral))


def rango(texto: str) -> list[float]:
    """"0.6:0.95:0.05" -> [0.6, 0.65, ..., 0.95]."""
    desde, hasta, paso = (float(x) for x in texto.split(":"))
    cantidad = int(round((hasta - desde) / paso)) + 1
    return [round(desde + i * paso, 4) for i in range(cantidad)]


# --- Fotos y modelos -----------------------------------------------------------


def leer_carpeta(carpeta: Path, max_fotos: int) -> list[tuple[str, Path]]:
    fotos = []
    for animal in sorted(p for p in carpeta.iterdir() if p.is_dir()):
        archivos = sorted(p for p in animal.iterdir() if p.suffix.lower() in EXTENSIONES)[:max_fotos]
        if len(archivos) >= 2:
            fotos.extend((animal.name, archivo) for archivo in archivos)
    return fotos


def calcular_embeddings(fotos: list[tuple[str, Path]], especie: str) -> np.ndarray:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from app import vision  # carga torch y los modelos reales

    vision.cargar_modelos()
    vectores = []
    for i, (_, archivo) in enumerate(fotos, start=1):
        vectores.append(vision.procesar_imagen(archivo.read_bytes(), especie).embedding)
        if i % 50 == 0:
            print(f"  {i}/{len(fotos)} fotos", file=sys.stderr)
    return np.asarray(vectores, dtype=np.float32)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("carpeta", type=Path)
    p.add_argument("--especie", choices=["perro", "gato", "otro"], required=True)
    p.add_argument("--umbrales", default="0.50:0.95:0.05", type=rango)
    p.add_argument("--candidatos", type=int, default=20, help="animales de la especie cerca de cada foto")
    p.add_argument("--falsos-max", type=float, default=0.2, help="coincidencias falsas por foto aceptables")
    p.add_argument("--max-fotos", type=int, default=6, help="fotos por animal como máximo")
    p.add_argument("--cache", type=Path, help="archivo .npz para guardar o reusar los embeddings")
    args = p.parse_args(argv)

    if args.cache and args.cache.exists():
        datos = np.load(args.cache, allow_pickle=False)
        embeddings, animales = datos["embeddings"], [str(a) for a in datos["animales"]]
        print(f"Embeddings de {args.cache}: {len(animales)} fotos", file=sys.stderr)
    else:
        fotos = leer_carpeta(args.carpeta, args.max_fotos)
        if not fotos:
            print("No hay subcarpetas con dos fotos o más.", file=sys.stderr)
            return 1
        animales = [a for a, _ in fotos]
        print(f"{len(set(animales))} animales, {len(fotos)} fotos", file=sys.stderr)
        embeddings = calcular_embeddings(fotos, args.especie)
        if args.cache:
            np.savez(args.cache, embeddings=embeddings, animales=np.asarray(animales))

    filas = tabla(similitudes(embeddings), animales, args.umbrales, args.candidatos)
    print(f"{len(set(animales))} animales, {len(animales)} fotos, {args.candidatos} candidatos cerca\n")
    print("umbral  pares mismo animal   pares falsos          encuentra  falsos/foto")
    for f in filas:
        print(
            f"{f.umbral:6.2f}  {f.pares_mismo:6d}/{f.total_mismo:<6d} {f.pares_mismo / max(f.total_mismo, 1):6.1%}"
            f"  {f.pares_falsos:7d}/{f.total_falsos:<8d} {f.pares_falsos / max(f.total_falsos, 1):6.2%}"
            f"  {f.encuentra:8.1%}  {f.falsos_por_foto:10.2f}"
        )
    elegida = recomendar(filas, args.falsos_max)
    if elegida:
        print(
            f"\nRecomendado: {elegida.umbral:.2f} (encuentra el {elegida.encuentra:.0%} y deja "
            f"{elegida.falsos_por_foto:.2f} coincidencias falsas por foto)"
        )
    else:
        print(
            f"\nNingún umbral encuentra fotos dejando {args.falsos_max} falsos por foto o menos: "
            "probá otro rango o revisá las fotos."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
