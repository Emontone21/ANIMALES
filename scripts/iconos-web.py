"""
Íconos de la web. Correlo cuando cambie el ícono: python3 scripts/iconos-web.py (necesita Pillow).

Genera desde assets/images/icon.png (el ícono de la app, ver docs/DISENO.md, "Logo"):
- public/iconos/icono-192.png e icono-512.png: los que pide Chrome para instalar ("any").
- public/iconos/icono-maskable-512.png: el de Android, que lo recorta en círculo u otra forma.
  El ícono de origen llena todo el cuadrado y su dibujo entra en la zona segura (el círculo
  del 80 % del centro), así que es el mismo, sin transparencias.
- public/iconos/apple-touch-icon.png (180): el de iPhone y iPad al agregarla a inicio. iOS
  pinta de negro lo transparente: va sin transparencias.

No toca assets/images/: el ícono, los de Android, la pantalla de carga y el favicon (48, con
las esquinas redondeadas y la chapita más grande, para que se lea en la pestaña) vienen
dibujados con el logo y se reemplazan a mano.
"""

from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "assets" / "images" / "icon.png"
DESTINO = RAIZ / "public" / "iconos"


def opaco(imagen: Image.Image) -> Image.Image:
    """Sobre el color de la esquina, para que no quede nada transparente."""
    fondo = Image.new("RGB", imagen.size, imagen.convert("RGB").getpixel((0, 0)))
    fondo.paste(imagen, mask=imagen.getchannel("A"))
    return fondo


def guardar(imagen: Image.Image, lado: int, ruta: Path) -> None:
    imagen = imagen.resize((lado, lado), Image.LANCZOS)
    imagen.save(ruta, optimize=True)
    print(f"{ruta.relative_to(RAIZ)}: {imagen.width}x{imagen.height}, {ruta.stat().st_size} bytes")


def main() -> None:
    DESTINO.mkdir(parents=True, exist_ok=True)
    original = Image.open(ORIGEN).convert("RGBA")
    guardar(original, 192, DESTINO / "icono-192.png")
    guardar(original, 512, DESTINO / "icono-512.png")
    guardar(opaco(original), 512, DESTINO / "icono-maskable-512.png")
    guardar(opaco(original), 180, DESTINO / "apple-touch-icon.png")


if __name__ == "__main__":
    main()
