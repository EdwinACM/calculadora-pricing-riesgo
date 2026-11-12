"""Mismas fórmulas que web/formulas.js, escritas otra vez en Python.

Sirven para verificar el ejemplo del README sin depender de JavaScript y, si hay
Node instalado, para comparar los resultados de ambos lenguajes. Se corren con:
python -m pytest"""
import json
import random
import shutil
import subprocess
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[1]
HERMANO = RAIZ.parent.parent / "riesgo-credito-politicas" / "resultados" / "precio_riesgo.csv"

BANDAS = [("Menos de 8%", 306, 0.07354371115191384), ("8 a 20%", 5961, 0.13067863821350192),
          ("20 a 40%", 1541, 0.28675879161793694), ("40% o más", 1192, 0.6132973432360371)]
EJEMPLO = dict(pd=0.05, lgd=0.45, fondeo=0.09, gastos=0.03, capital=0.10, roe=0.15, plazo=24)


def tasa_minima(pd, lgd, fondeo, gastos, capital, roe, plazo):
    t = plazo / 12
    pd_acum = 1 - (1 - pd) ** t
    perdida = lgd * pd_acum / t
    return fondeo * (1 - capital) + perdida + gastos + capital * roe


def por_bandas(p):
    total = sum(b[1] for b in BANDAS)
    promedio = sum(b[1] * b[2] for b in BANDAS) / total
    minimas, pesos = [], []
    for _, n, pd_m in BANDAS:
        q = dict(p, pd=min(1.0, p["pd"] * pd_m / promedio))
        minimas.append(tasa_minima(**q))
        pesos.append(n / total)
    plana = sum(w * m for w, m in zip(pesos, minimas))
    return minimas, plana, [plana - m for m in minimas], pesos


def test_ejemplo_del_readme():
    assert tasa_minima(**EJEMPLO) == pytest.approx(0.1479375, abs=1e-12)
    # Desglose: fondeo 8.1%, pérdida esperada 2.19375%, gastos 3%, capital 1.5%
    assert 0.09 * 0.9 == pytest.approx(0.081)
    assert 0.45 * (1 - 0.95 ** 2) / 2 == pytest.approx(0.0219375)


def test_bandas_y_subsidio_del_readme():
    minimas, plana, subsidios, pesos = por_bandas(EJEMPLO)
    esperado = [0.13347953736261398, 0.13920300627354534, 0.15444932632487757, 0.1845045770610826]
    assert minimas == pytest.approx(esperado, abs=1e-12)
    assert plana == pytest.approx(0.14761885850589004, abs=1e-12)
    assert sum(w * s for w, s in zip(pesos, subsidios)) == pytest.approx(0, abs=1e-12)
    assert subsidios[0] > 0 and subsidios[3] < 0


def test_escenarios_del_readme():
    opt = dict(EJEMPLO, pd=0.05 * 0.7, lgd=0.40, fondeo=0.08)
    est = dict(EJEMPLO, pd=0.05 * 1.5, lgd=0.55, fondeo=0.11)
    assert tasa_minima(**opt) == pytest.approx(0.130755, abs=1e-9)
    assert tasa_minima(**est) == pytest.approx(0.183703125, abs=1e-9)


def test_bandas_iguales_al_proyecto_hermano():
    if not HERMANO.exists():
        pytest.skip("no está el proyecto hermano")
    filas = [l.split(",") for l in HERMANO.read_text(encoding="utf-8").strip().splitlines()[1:]]
    assert len(filas) == len(BANDAS)
    for f, (nombre, n, pd_m) in zip(filas, BANDAS):
        assert int(f[1]) == n and float(f[2]) == pytest.approx(pd_m, abs=1e-12)


@pytest.mark.skipif(shutil.which("node") is None, reason="no hay Node")
def test_python_y_javascript_dan_lo_mismo():
    rng = random.Random(42)
    casos = [dict(pd=rng.uniform(0, 1), lgd=rng.uniform(0, 1), fondeo=rng.uniform(0, 0.3),
                  gastos=rng.uniform(0, 0.2), capital=rng.uniform(0, 0.3), roe=rng.uniform(0, 0.5),
                  plazo=rng.randint(1, 360)) for _ in range(200)]
    js = (
        "const F=require(process.argv[1]);const c=JSON.parse(process.argv[2]);"
        "console.log(JSON.stringify(c.map(p=>[F.tasaMinima(p).tasa,F.porBandas(p).plana])));"
    )
    salida = subprocess.run(["node", "-e", js, str(RAIZ / "web" / "formulas.js"), json.dumps(casos)],
                            capture_output=True, text=True, check=True).stdout
    for p, (t_js, plana_js) in zip(casos, json.loads(salida)):
        assert t_js == pytest.approx(tasa_minima(**p), abs=1e-12)
        assert plana_js == pytest.approx(por_bandas(p)[1], abs=1e-12)
