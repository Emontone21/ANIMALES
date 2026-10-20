"""Arranca el servicio: `python -m app`. El puerto sale de PORT (Cloud Run usa 8080)."""

from __future__ import annotations

import os

PUERTO_POR_DEFECTO = 7860


def puerto() -> int:
    valor = os.environ.get("PORT", "").strip()
    return int(valor) if valor else PUERTO_POR_DEFECTO


if __name__ == "__main__":
    import uvicorn

    # Una sola instancia del proceso: los modelos ocupan memoria y la inferencia va de a una.
    uvicorn.run("app.main:app", host="0.0.0.0", port=puerto(), workers=1)
