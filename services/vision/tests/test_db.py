"""La clave de Supabase: la secreta nueva (sb_secret_…) y la legacy service_role (eyJ…)."""

from __future__ import annotations

import asyncio

import httpx
import pytest

from app import db

SECRETA = "sb_secret_prueba1234567890"
LEGACY = "eyJhbGciOiJIUzI1NiJ9.e30.firma"


def test_prefiere_la_secreta_nueva():
    assert db.clave_desde_entorno({"SUPABASE_SECRET_KEY": SECRETA, "SUPABASE_SERVICE_ROLE_KEY": LEGACY}) == SECRETA
    assert db.clave_desde_entorno({"SUPABASE_SERVICE_ROLE_KEY": LEGACY}) == LEGACY
    # Vacía cuenta como que no está.
    assert db.clave_desde_entorno({"SUPABASE_SECRET_KEY": "", "SUPABASE_SERVICE_ROLE_KEY": LEGACY}) == LEGACY
    assert db.clave_desde_entorno({}) == ""


def test_tipo_de_clave():
    assert db.tipo_de_clave(SECRETA) == "secreta"
    assert db.tipo_de_clave(LEGACY) == "legacy"
    assert db.tipo_de_clave("sb_publishable_x") == "desconocida"


def test_la_secreta_va_solo_en_apikey():
    headers = db.headers_para(SECRETA)
    assert headers["apikey"] == SECRETA
    assert "Authorization" not in headers


def test_la_legacy_va_en_apikey_y_como_bearer():
    headers = db.headers_para(LEGACY)
    assert headers["apikey"] == LEGACY
    assert headers["Authorization"] == f"Bearer {LEGACY}"


@pytest.mark.parametrize(("clave", "con_bearer"), [(SECRETA, False), (LEGACY, True)])
def test_lo_que_sale_en_cada_pedido(monkeypatch, clave, con_bearer):
    pedidos: list[httpx.Request] = []

    def responder(pedido: httpx.Request) -> httpx.Response:
        pedidos.append(pedido)
        if pedido.url.path.endswith("/guardar_embedding"):
            return httpx.Response(200, json=2)
        if "storage" in pedido.url.path:
            return httpx.Response(200, content=b"foto")
        return httpx.Response(200, json=[], headers={"content-range": "*/0"})

    monkeypatch.setattr(db, "SUPABASE_URL", "https://abc123.supabase.co")
    monkeypatch.setattr(db, "CLAVE", clave)
    monkeypatch.setattr(db, "TRANSPORTE", httpx.MockTransport(responder))

    async def todo():
        await db.listar_pendientes()
        await db.contar_pendientes()
        coincidencias = await db.guardar_embedding("av1", [0.1] * 384, None)
        foto = await db.descargar_foto("u/foto.jpg")
        return coincidencias, foto

    assert asyncio.run(todo()) == (2, b"foto")
    rest = [p for p in pedidos if p.url.path.startswith("/rest/")]
    assert len(rest) == 3
    for p in rest:
        assert p.headers["apikey"] == clave
        assert ("authorization" in p.headers) is con_bearer
        # Supabase rechaza la clave secreta si el pedido parece de un navegador.
        assert "Mozilla" not in p.headers["user-agent"]
    # La foto sale del bucket público: sin clave.
    (foto,) = [p for p in pedidos if "storage" in p.url.path]
    assert str(foto.url) == "https://abc123.supabase.co/storage/v1/object/public/fotos/u/foto.jpg"
    assert "apikey" not in foto.headers and "authorization" not in foto.headers


def test_sin_clave_no_esta_configurada(monkeypatch):
    monkeypatch.setattr(db, "SUPABASE_URL", "https://abc123.supabase.co")
    monkeypatch.setattr(db, "CLAVE", "")
    assert not db.configurada()
    with pytest.raises(RuntimeError, match="SUPABASE_SECRET_KEY"):
        db._cliente()
