// Se corre con: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const F = require('../web/formulas.js');

const cerca = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} no es ${b}`);
const ejemplo = () => F.validar(F.EJEMPLO).valores;

test('ejemplo numérico del README: tasa mínima de 14.79375%', () => {
  const r = F.tasaMinima(ejemplo());
  cerca(r.T, 2);
  cerca(r.pdAcum, 0.0975);
  cerca(r.perdida, 0.0219375);
  cerca(r.fondeo, 0.081);
  cerca(r.capital, 0.015);
  cerca(r.gastos, 0.03);
  cerca(r.tasa, 0.1479375);
});

test('a 12 meses la pérdida esperada es PD por LGD', () => {
  const r = F.tasaMinima({ pd: 0.04, lgd: 0.5, fondeo: 0.08, gastos: 0.02, capital: 0, roe: 0.2, plazo: 12 });
  cerca(r.perdida, 0.02);
  cerca(r.tasa, 0.08 + 0.02 + 0.02);
});

test('sin capital el rendimiento exigido no cambia la tasa', () => {
  const base = { pd: 0.05, lgd: 0.45, fondeo: 0.09, gastos: 0.03, capital: 0, plazo: 24 };
  cerca(F.tasaMinima({ ...base, roe: 0.05 }).tasa, F.tasaMinima({ ...base, roe: 0.4 }).tasa);
});

test('bandas del README: tasas mínimas, tasa plana y subsidios', () => {
  const b = F.porBandas(ejemplo());
  const minimas = b.filas.map(f => f.tasaMinima);
  [0.13347953736261398, 0.13920300627354534, 0.15444932632487757, 0.1845045770610826]
    .forEach((x, i) => cerca(minimas[i], x));
  cerca(b.plana, 0.14761885850589004);
  const sub = b.filas.map(f => f.subsidio);
  cerca(sub[0], 0.014139321143276068);
  cerca(sub[3], -0.03688571855519254);
});

test('la PD reescalada de las bandas promedia la PD de entrada', () => {
  const b = F.porBandas(ejemplo());
  cerca(b.pdEfectiva, 0.05, 1e-12);
});

test('el subsidio cruzado ponderado por clientes suma cero', () => {
  for (const pd of [0.5, 5, 12, 30]) {
    const v = F.validar({ ...F.EJEMPLO, pd }).valores;
    const b = F.porBandas(v);
    cerca(b.filas.reduce((a, f) => a + f.peso * f.subsidio, 0), 0, 1e-12);
  }
});

test('las bandas coinciden con el proyecto hermano si está disponible', (t) => {
  const ruta = path.resolve(__dirname, '../../../riesgo-credito-politicas/resultados/precio_riesgo.csv');
  if (!fs.existsSync(ruta)) { t.skip('no está el proyecto hermano'); return; }
  const filas = fs.readFileSync(ruta, 'utf8').trim().split('\n').slice(1).map(l => l.split(','));
  assert.equal(filas.length, F.BANDAS.length);
  filas.forEach((f, i) => {
    assert.equal(Number(f[1]), F.BANDAS[i].clientes);
    cerca(Number(f[2]), F.BANDAS[i].pdMensual, 1e-12);
  });
});

test('escenarios: optimista < base < estrés y base igual al cálculo directo', () => {
  const e = F.escenarios(ejemplo());
  assert.ok(e[0].resultado.tasa < e[1].resultado.tasa && e[1].resultado.tasa < e[2].resultado.tasa);
  cerca(e[1].resultado.tasa, 0.1479375);
  cerca(e[0].resultado.tasa, 0.130755, 1e-9);
  cerca(e[2].resultado.tasa, 0.183703125, 1e-9);
});

test('validación rechaza vacíos, texto, fuera de rango y plazos con decimales', () => {
  assert.equal(F.validar({ ...F.EJEMPLO, pd: '' }).ok, false);
  assert.equal(F.validar({ ...F.EJEMPLO, pd: 'abc' }).ok, false);
  assert.equal(F.validar({ ...F.EJEMPLO, lgd: 101 }).ok, false);
  assert.equal(F.validar({ ...F.EJEMPLO, pd: -1 }).ok, false);
  assert.equal(F.validar({ ...F.EJEMPLO, plazo: 0 }).ok, false);
  assert.equal(F.validar({ ...F.EJEMPLO, plazo: 361 }).ok, false);
  assert.equal(F.validar({ ...F.EJEMPLO, plazo: 12.5 }).ok, false);
  assert.equal(F.validar({ ...F.EJEMPLO, fondeo: Infinity }).ok, false);
  assert.equal(F.validar({ ...F.EJEMPLO, fondeo: NaN }).ok, false);
  assert.equal(F.validar({ ...F.EJEMPLO, capital: undefined }).ok, false);
  assert.equal(F.validar(F.EJEMPLO).ok, true);
});

test('seguridad de la página: CSP estricta y sin patrones peligrosos', () => {
  const dir = path.resolve(__dirname, '../web');
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const csp = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)[1];
  for (const p of ["default-src 'none'", "script-src 'self'", "style-src 'self'", "img-src 'self' data:",
    "connect-src 'self'", "base-uri 'none'", "form-action 'none'"]) { assert.ok(csp.includes(p), p); }
  assert.ok(!csp.includes('unsafe'));
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html));
  assert.ok(!/ style=|<style|\son\w+=/.test(html));
  for (const f of fs.readdirSync(dir).filter(n => /\.(html|js|css)$/.test(n))) {
    const t = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|\beval\s*\(|new Function|document\.write/.test(t), f);
    assert.ok(!/(src|href)="https?:\/\/|url\(\s*['"]?https?:|@import/.test(t), f);
  }
});
