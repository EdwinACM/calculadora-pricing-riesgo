/* Fórmulas de la calculadora. Sin DOM: se usa en la página y en las pruebas de Node.
   Todas las tasas y probabilidades entran y salen como decimales anuales (0.05 es 5%). */
(function (raiz, fabrica) {
  'use strict';
  if (typeof module === 'object' && module.exports) { module.exports = fabrica(); }
  else { raiz.Formulas = fabrica(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Bandas de PD del proyecto riesgo-credito-politicas (resultados/precio_riesgo.csv):
  // clientes de la muestra de prueba (9,000) y PD media predicha del mes siguiente.
  // Son probabilidades de un mes en una base con 22% de incumplimiento mensual.
  var BANDAS = [
    { nombre: 'Menos de 8%', clientes: 306, pdMensual: 0.07354371115191384 },
    { nombre: '8 a 20%', clientes: 5961, pdMensual: 0.13067863821350192 },
    { nombre: '20 a 40%', clientes: 1541, pdMensual: 0.28675879161793694 },
    { nombre: '40% o más', clientes: 1192, pdMensual: 0.6132973432360371 }
  ];

  // Límites de las entradas, en las unidades de la página (porcentajes y meses).
  var LIMITES = {
    pd: { min: 0, max: 100, etiqueta: 'PD a 12 meses' },
    lgd: { min: 0, max: 100, etiqueta: 'LGD' },
    fondeo: { min: 0, max: 50, etiqueta: 'Costo de fondeo' },
    gastos: { min: 0, max: 50, etiqueta: 'Gastos operativos' },
    capital: { min: 0, max: 50, etiqueta: 'Capital asignado' },
    roe: { min: 0, max: 100, etiqueta: 'Rendimiento exigido' },
    plazo: { min: 1, max: 360, etiqueta: 'Plazo', entero: true }
  };

  var EJEMPLO = { pd: 5, lgd: 45, fondeo: 9, gastos: 3, capital: 10, roe: 15, plazo: 24 };

  // Cada escenario mueve algunos supuestos respecto del caso base.
  var ESCENARIOS = [
    { id: 'optimista', nombre: 'Optimista', pdFactor: 0.7, lgdPuntos: -5, fondeoPuntos: -1 },
    { id: 'base', nombre: 'Base', pdFactor: 1, lgdPuntos: 0, fondeoPuntos: 0 },
    { id: 'estres', nombre: 'Estrés', pdFactor: 1.5, lgdPuntos: 10, fondeoPuntos: 2 }
  ];

  /* Valida las entradas en unidades de la página. Devuelve { ok, errores, valores } con
     los valores ya convertidos a decimales (el plazo queda en meses). */
  function validar(entrada) {
    var errores = {};
    var v = {};
    Object.keys(LIMITES).forEach(function (k) {
      var lim = LIMITES[k];
      var crudo = entrada[k];
      var n = (typeof crudo === 'string' && crudo.trim() === '') ? NaN : Number(crudo);
      if (crudo === null || crudo === undefined || !isFinite(n)) {
        errores[k] = lim.etiqueta + ': escribe un número.';
      } else if (n < lim.min || n > lim.max) {
        errores[k] = lim.etiqueta + ': debe estar entre ' + lim.min + ' y ' + lim.max + (k === 'plazo' ? ' meses.' : '%.');
      } else if (lim.entero && Math.floor(n) !== n) {
        errores[k] = lim.etiqueta + ': usa meses enteros.';
      } else {
        v[k] = k === 'plazo' ? n : n / 100;
      }
    });
    return { ok: Object.keys(errores).length === 0, errores: errores, valores: v };
  }

  /* Tasa mínima anual que cubre el riesgo, con un crédito de pago único al vencimiento,
     exposición constante y tasa de incumplimiento constante en el tiempo.
       T = plazo / 12
       PD acumulada = 1 - (1 - PD)^T
       pérdida esperada anualizada = LGD * PD acumulada / T
       fondeo = costo de fondeo * (1 - k)
       capital = k * rendimiento exigido
       tasa mínima = fondeo + pérdida esperada + gastos + capital */
  function tasaMinima(p) {
    var T = p.plazo / 12;
    var pdAcum = 1 - Math.pow(1 - p.pd, T);
    var perdida = p.lgd * pdAcum / T;
    var fondeo = p.fondeo * (1 - p.capital);
    var capital = p.capital * p.roe;
    var gastos = p.gastos;
    return { T: T, pdAcum: pdAcum, perdida: perdida, fondeo: fondeo, capital: capital, gastos: gastos,
      tasa: fondeo + perdida + gastos + capital };
  }

  /* Tasa plana contra tasa por banda. Las PD de las bandas del proyecto hermano se
     reescalan para que su promedio ponderado por clientes sea la PD de entrada:
     PD banda = PD entrada * (PD mensual de la banda / PD mensual promedio), con tope de 100%.
     La tasa plana es el promedio de las tasas mínimas de las bandas ponderado por clientes,
     así que el subsidio cruzado ponderado suma cero. Subsidio positivo: la banda paga de
     más y subsidia a otras. Negativo: la banda paga menos de lo que cuesta. */
  function porBandas(p) {
    var total = BANDAS.reduce(function (a, b) { return a + b.clientes; }, 0);
    var promedio = BANDAS.reduce(function (a, b) { return a + b.clientes * b.pdMensual; }, 0) / total;
    var filas = BANDAS.map(function (b) {
      var pd = Math.min(1, p.pd * b.pdMensual / promedio);
      var r = tasaMinima({ pd: pd, lgd: p.lgd, fondeo: p.fondeo, gastos: p.gastos, capital: p.capital, roe: p.roe, plazo: p.plazo });
      return { nombre: b.nombre, peso: b.clientes / total, pdMensual: b.pdMensual, pd: pd, tasaMinima: r.tasa, detalle: r };
    });
    var plana = filas.reduce(function (a, f) { return a + f.peso * f.tasaMinima; }, 0);
    filas.forEach(function (f) { f.subsidio = plana - f.tasaMinima; });
    var pdEfectiva = filas.reduce(function (a, f) { return a + f.peso * f.pd; }, 0);
    return { filas: filas, plana: plana, pdPromedioHermano: promedio, pdEfectiva: pdEfectiva };
  }

  function acotar(x, min, max) { return Math.min(max, Math.max(min, x)); }

  function escenarios(p) {
    return ESCENARIOS.map(function (e) {
      var q = {
        pd: acotar(p.pd * e.pdFactor, 0, 1),
        lgd: acotar(p.lgd + e.lgdPuntos / 100, 0, 1),
        fondeo: Math.max(0, p.fondeo + e.fondeoPuntos / 100),
        gastos: p.gastos, capital: p.capital, roe: p.roe, plazo: p.plazo
      };
      return { id: e.id, nombre: e.nombre, entrada: q, resultado: tasaMinima(q) };
    });
  }

  return { BANDAS: BANDAS, LIMITES: LIMITES, EJEMPLO: EJEMPLO, ESCENARIOS: ESCENARIOS,
    validar: validar, tasaMinima: tasaMinima, porBandas: porBandas, escenarios: escenarios };
});
