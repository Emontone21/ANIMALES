"""
Íconos de la app. Correlo cuando cambie el ícono: python3 scripts/iconos-web.py (necesita Pillow).

Sin opciones, genera desde assets/images/icon.png los de la web:
- public/iconos/icono-192.png e icono-512.png: los que pide Chrome para instalar ("any").
- public/iconos/icono-maskable-512.png: el de Android, que lo recorta en círculo u otra forma.
  El ícono de origen llena todo el cuadrado y su dibujo entra en la zona segura (el círculo
  del 80 % del centro), así que es el mismo, sin transparencias.
- public/iconos/apple-touch-icon.png (180): el de iPhone y iPad al agregarla a inicio. iOS
  pinta de negro lo transparente: va sin transparencias.
- assets/images/favicon.png (48): el de la pestaña. El export lo convierte en favicon.ico.

Con --provisorio, antes dibuja el ícono provisorio de Spot (un pin de mapa con una huella,
en los colores de src/constants/tema.ts) en assets/images/: icon.png (1024, sin
transparencias), los tres de Android (android-icon-foreground, -background y -monochrome) y
splash-icon.png. Para reemplazarlo por uno definitivo, poné los archivos nuevos en
assets/images/ con esos nombres y medidas y corré el script sin --provisorio (ver
docs/DISENO.md, "Ícono de la app").
"""

import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
IMAGENES = RAIZ / "assets" / "images"
ORIGEN = IMAGENES / "icon.png"
DESTINO = RAIZ / "public" / "iconos"

# Colores de src/constants/tema.ts (__tests__/marca.test.ts comprueba que coincidan).
PRIMARIO = "#556B2F"  # claro.primario
SOBRE_PRIMARIO = "#FFFFFF"  # claro.textoSobrePrimario

# Se dibuja a 4 veces el tamaño y se achica: así los bordes quedan suaves.
SUPERMUESTREO = 4


def elipse(centro, ancho, alto, giro_grados, puntos=72):
    """Los puntos de una elipse girada, para dibujarla como polígono."""
    cx, cy = centro
    giro = math.radians(giro_grados)
    resultado = []
    for i in range(puntos):
        a = 2 * math.pi * i / puntos
        x, y = ancho / 2 * math.cos(a), alto / 2 * math.sin(a)
        resultado.append(
            (cx + x * math.cos(giro) - y * math.sin(giro), cy + x * math.sin(giro) + y * math.cos(giro))
        )
    return resultado


def marca(lado: int, escala: float) -> Image.Image:
    """
    El pin con la huella, como máscara (blanco = pin, negro = fondo y huella), centrado en
    un cuadrado de `lado`. Las medidas son las del ícono de 1024; `escala` lo achica para las
    zonas seguras de Android.
    """
    grande = lado * SUPERMUESTREO
    k = grande / 1024 * escala
    # El centro del dibujo (el del cuadrado de 1024) queda en el centro del lienzo.
    def p(x, y):
        return (grande / 2 + (x - 512) * k, grande / 2 + (y - 512) * k)

    mascara = Image.new("L", (grande, grande), 0)
    d = ImageDraw.Draw(mascara)

    # Pin: un círculo y el triángulo hasta la punta, tangente al círculo.
    cx, cy, radio, punta = 512, 425, 245, 865
    distancia = punta - cy
    angulo = math.acos(radio / distancia)
    izquierda = (cx - radio * math.sin(angulo), cy + radio * math.cos(angulo))
    derecha = (cx + radio * math.sin(angulo), cy + radio * math.cos(angulo))
    d.ellipse([p(cx - radio, cy - radio), p(cx + radio, cy + radio)], fill=255)
    d.polygon([p(*izquierda), p(*derecha), p(cx, punta)], fill=255)

    # Huella, calada en el pin: la almohadilla y cuatro dedos.
    d.polygon([p(*q) for q in elipse((512, 497), 196, 158, 0)], fill=0)
    for x, y, giro in ((396, 380, -28), (466, 318, -9), (558, 318, 9), (628, 380, 28)):
        d.polygon([p(*q) for q in elipse((x, y), 70, 92, giro)], fill=0)

    return mascara.resize((lado, lado), Image.LANCZOS)


def sobre_fondo(mascara: Image.Image) -> Image.Image:
    """El pin en SOBRE_PRIMARIO sobre PRIMARIO, sin transparencias."""
    imagen = Image.new("RGB", mascara.size, PRIMARIO)
    imagen.paste(Image.new("RGB", mascara.size, SOBRE_PRIMARIO), mask=mascara)
    return imagen


def transparente(mascara: Image.Image) -> Image.Image:
    """El pin en SOBRE_PRIMARIO sobre transparente."""
    imagen = Image.new("RGBA", mascara.size, SOBRE_PRIMARIO + "00")
    imagen.paste(Image.new("RGBA", mascara.size, SOBRE_PRIMARIO), mask=mascara)
    return imagen


def guardar_en(imagen: Image.Image, ruta: Path) -> None:
    imagen.save(ruta, optimize=True)
    print(f"{ruta.relative_to(RAIZ)}: {imagen.width}x{imagen.height}, {ruta.stat().st_size} bytes")


def dibujar_provisorio() -> None:
    # Ícono principal: el dibujo llega hasta el 68 % del radio, dentro del círculo del 80 %
    # que respetan las máscaras (maskable de la web e iOS).
    guardar_en(sobre_fondo(marca(1024, 1.0)), ORIGEN)
    # Android adaptativo: el sistema recorta un círculo de 66 de los 108 dp. A 0,82 el pin
    # queda adentro (56 % del radio) con margen.
    guardar_en(transparente(marca(512, 0.82)), IMAGENES / "android-icon-foreground.png")
    guardar_en(Image.new("RGB", (512, 512), PRIMARIO), IMAGENES / "android-icon-background.png")
    # Monocromo (íconos con el color del tema en Android 13+): solo importa la forma.
    guardar_en(transparente(marca(432, 0.82)), IMAGENES / "android-icon-monochrome.png")
    # Pantalla de carga nativa: el pin solo, recortado a su tamaño, sobre PRIMARIO (app.json).
    pin = transparente(marca(512, 1.0))
    guardar_en(pin.crop(pin.getbbox()), IMAGENES / "splash-icon.png")


def opaco(imagen: Image.Image) -> Image.Image:
    """Sobre el color de la esquina, para que no quede nada transparente."""
    fondo = Image.new("RGB", imagen.size, imagen.convert("RGB").getpixel((0, 0)))
    fondo.paste(imagen, mask=imagen.getchannel("A"))
    return fondo


def guardar(imagen: Image.Image, lado: int, ruta: Path) -> None:
    guardar_en(imagen.resize((lado, lado), Image.LANCZOS), ruta)


def main() -> None:
    if "--provisorio" in sys.argv[1:]:
        dibujar_provisorio()
    DESTINO.mkdir(parents=True, exist_ok=True)
    original = Image.open(ORIGEN).convert("RGBA")
    guardar(original, 192, DESTINO / "icono-192.png")
    guardar(original, 512, DESTINO / "icono-512.png")
    guardar(opaco(original), 512, DESTINO / "icono-maskable-512.png")
    guardar(opaco(original), 180, DESTINO / "apple-touch-icon.png")
    guardar(opaco(original), 48, IMAGENES / "favicon.png")


if __name__ == "__main__":
    main()
