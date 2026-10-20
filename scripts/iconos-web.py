"""
Íconos de la web instalable (public/iconos/), generados desde assets/images/icon.png.
Correlo cuando cambie el ícono de la app: python3 scripts/iconos-web.py (necesita Pillow).

- icono-192.png e icono-512.png: los que pide Chrome para instalar ("any").
- icono-maskable-512.png: el de Android, que lo recorta en círculo u otra forma. El ícono
  de origen ya llena todo el cuadrado y su dibujo entra en la zona segura (el círculo del
  80 % del centro), así que es el mismo, sin transparencias.
- apple-touch-icon.png (180): el de iPhone y iPad al agregarla a inicio. iOS pinta de negro
  lo transparente: va sin transparencias.
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


def guardar(imagen: Image.Image, lado: int, nombre: str) -> None:
    imagen.resize((lado, lado), Image.LANCZOS).save(DESTINO / nombre, optimize=True)
    print(f"{nombre}: {lado}x{lado}, {(DESTINO / nombre).stat().st_size} bytes")


def main() -> None:
    DESTINO.mkdir(parents=True, exist_ok=True)
    original = Image.open(ORIGEN).convert("RGBA")
    guardar(original, 192, "icono-192.png")
    guardar(original, 512, "icono-512.png")
    guardar(opaco(original), 512, "icono-maskable-512.png")
    guardar(opaco(original), 180, "apple-touch-icon.png")


if __name__ == "__main__":
    main()
