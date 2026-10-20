"""Los endpoints, con el modelo falso y la base en memoria."""

from __future__ import annotations

import asyncio

import httpx
import pytest

from app import main
from app.__main__ import PUERTO_POR_DEFECTO, puerto
from tests.conftest import SECRETO


def test_salud(cliente):
    r = cliente.get("/salud")
    assert r.status_code == 200
    assert r.json() == {"ok": True, "modelos": True, "db": True}


@pytest.mark.parametrize("ruta", ["/procesar", "/procesar-pendientes"])
def test_sin_secreto_o_con_otro_no_procesa(cliente, base, ruta):
    base.agregar("a1")
    cuerpo = {"avistamiento_id": "a1"}
    assert cliente.post(ruta, json=cuerpo).status_code == 401
    assert cliente.post(ruta, json=cuerpo, headers={"X-Vision-Secret": "otro"}).status_code == 401
    assert base.guardados == {}


def test_procesar_trabaja_dentro_del_pedido(cliente, base):
    base.agregar("a1")
    r = cliente.post("/procesar", json={"avistamiento_id": "a1"}, headers=SECRETO)
    # La respuesta ya trae el resultado: se procesó antes de responder, no en segundo plano.
    assert r.status_code == 200
    assert r.json() == {"procesado": True, "coincidencias": 1}
    guardado = base.guardados["a1"]
    assert len(guardado["embedding"]) == 384
    # El perro falso ocupa la mitad central de 64 × 48; con 8 % de margen.
    assert guardado["bbox"] == {"x": 13, "y": 10, "ancho": 37, "alto": 28, "confianza": 0.9}


def test_procesar_algo_que_no_esta_pendiente(cliente, base):
    r = cliente.post("/procesar", json={"avistamiento_id": "nada"}, headers=SECRETO)
    assert r.json() == {"procesado": False, "motivo": "no_pendiente"}


def test_un_error_queda_en_la_base_para_reintentar(cliente, base):
    base.agregar("a1")
    base.fallar_descarga.add("a1")
    r = cliente.post("/procesar", json={"avistamiento_id": "a1"}, headers=SECRETO)
    assert r.status_code == 200
    assert r.json() == {"procesado": False, "motivo": "error"}
    assert "404" in base.errores["a1"]


def test_procesar_pendientes_vacia_la_cola(cliente, base):
    for i in range(5):
        base.agregar(f"a{i}")
    base.fallar_descarga.add("a2")
    r = cliente.post("/procesar-pendientes", headers=SECRETO)
    assert r.status_code == 200
    assert r.json() == {"procesados": 4, "errores": 1, "quedan": 0}
    assert set(base.guardados) == {"a0", "a1", "a3", "a4"}


def test_procesar_pendientes_respeta_el_tope_de_tiempo(modelos, base):
    for i in range(10):
        base.agregar(f"a{i}")
    # Reloj falso: cada vez que se mira, pasaron 20 segundos.
    ahora = [0.0]

    def reloj():
        ahora[0] += 20
        return ahora[0]

    resultado = asyncio.run(main.vaciar_cola(100, reloj=reloj))
    assert 0 < resultado["procesados"] < 10
    assert resultado["procesados"] + resultado["quedan"] == 10
    assert resultado["errores"] == 0


def test_procesar_pendientes_no_repite_una_foto_en_la_misma_vuelta(modelos, base, monkeypatch):
    base.agregar("a1")
    # Una base que sigue devolviendo la foto aunque falle (por ejemplo, otra la volvió a encolar).
    async def marcar_error_sin_sacar(avistamiento_id, error):
        base.errores[avistamiento_id] = error

    monkeypatch.setattr(main.db, "marcar_error", marcar_error_sin_sacar)
    base.fallar_descarga.add("a1")
    resultado = asyncio.run(main.vaciar_cola(60))
    assert resultado == {"procesados": 0, "errores": 1, "quedan": 1}


def test_la_misma_foto_pedida_dos_veces_a_la_vez_se_procesa_una(base):
    from app import vision
    from tests.conftest import ModelosFalsos

    lentos = ModelosFalsos(demora=0.2)
    vision.usar_modelos(lentos)
    base.agregar("a1")

    async def dos_pedidos():
        transporte = httpx.ASGITransport(app=main.app)
        async with httpx.AsyncClient(transport=transporte, base_url="http://prueba") as c:
            return await asyncio.gather(
                c.post("/procesar", json={"avistamiento_id": "a1"}, headers=SECRETO),
                c.post("/procesar", json={"avistamiento_id": "a1"}, headers=SECRETO),
            )

    try:
        respuestas = asyncio.run(dos_pedidos())
    finally:
        vision.usar_modelos(None)
    cuerpos = sorted((r.json() for r in respuestas), key=lambda c: c["procesado"])
    assert cuerpos == [{"procesado": False, "motivo": "en_curso"}, {"procesado": True, "coincidencias": 1}]
    assert lentos.llamadas == 1


def test_una_segunda_vuelta_de_la_cola_no_se_superpone(base, modelos):
    base.agregar("a1")

    async def con_vuelta_en_curso():
        transporte = httpx.ASGITransport(app=main.app)
        async with httpx.AsyncClient(transport=transporte, base_url="http://prueba") as c:
            async with main._vaciando:
                return await c.post("/procesar-pendientes", headers=SECRETO)

    r = asyncio.run(con_vuelta_en_curso())
    assert r.json() == {"procesados": 0, "errores": 0, "quedan": 1, "ocupado": True}
    assert base.guardados == {}


def test_no_hay_bucle_ni_tareas_en_segundo_plano():
    # En Cloud Run no hay CPU fuera de los pedidos: nada corre por su cuenta.
    assert not hasattr(main, "_bucle_cola")
    assert "BackgroundTasks" not in open(main.__file__, encoding="utf-8").read()


def test_puerto_desde_la_variable_port(monkeypatch):
    monkeypatch.delenv("PORT", raising=False)
    assert puerto() == PUERTO_POR_DEFECTO == 7860
    monkeypatch.setenv("PORT", "8080")
    assert puerto() == 8080
