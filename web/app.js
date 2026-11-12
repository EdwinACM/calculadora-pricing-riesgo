(function () {
  'use strict';

  var F = window.Formulas;
  var CAMPOS = Object.keys(F.LIMITES);
  var EASE_MS = 750;
  var ultimo = null;
  var escenario = 1;
  var NOMBRES_ESC = [
    'Optimista: PD por 0.7, LGD 5 puntos menos y fondeo 1 punto menos.',
    'Base: los supuestos tal como los escribiste.',
    'Estrés: PD por 1.5, LGD 10 puntos más y fondeo 2 puntos más.'
  ];

  document.documentElement.classList.add('js');

  function $(id) { return document.getElementById(id); }
  function vaciar(n) { while (n.firstChild) { n.removeChild(n.firstChild); } }
  function el(tag, clase, texto) {
    var n = document.createElement(tag);
    if (clase) { n.className = clase; }
    if (texto !== undefined && texto !== null) { n.textContent = texto; }
    return n;
  }
  function sinMovimiento() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // Los valores llegan como decimales (0.05 es 5%).
  function pct(v, d) {
    var dec = d === undefined ? 2 : d;
    return (v * 100).toLocaleString('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + '%';
  }
  function puntos(v) {
    var x = v * 100;
    return (x >= 0 ? '+' : '−') + Math.abs(x).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' puntos';
  }

  // ---------- Cifras que cuentan ----------
  // Cada nodo recuerda su valor mostrado y anima desde ahí hasta el nuevo con requestAnimationFrame.
  var contadores = new Map();
  function salida(t) { return 1 - Math.pow(1 - t, 4); }
  function cuenta(nodo, destino, formato) {
    var c = contadores.get(nodo);
    if (!c) { c = { actual: 0, raf: 0 }; contadores.set(nodo, c); }
    if (c.raf) { cancelAnimationFrame(c.raf); c.raf = 0; }
    if (sinMovimiento() || Math.abs(destino - c.actual) < 1e-9) {
      c.actual = destino;
      nodo.textContent = formato(destino);
      return;
    }
    var desde = c.actual;
    var inicio = null;
    function paso(ahora) {
      if (inicio === null) { inicio = ahora; }
      var t = Math.min(1, (ahora - inicio) / EASE_MS);
      c.actual = desde + (destino - desde) * salida(t);
      nodo.textContent = formato(c.actual);
      if (t < 1) { c.raf = requestAnimationFrame(paso); }
      else { c.raf = 0; c.actual = destino; nodo.textContent = formato(destino); }
    }
    c.raf = requestAnimationFrame(paso);
  }

  // ---------- Tablas y listas ----------
  function tabla(caption, cabeceras, filas, numericas) {
    var t = el('table');
    t.appendChild(el('caption', null, caption));
    var cab = el('thead');
    var fc = el('tr');
    cabeceras.forEach(function (c, i) {
      var th = el('th', numericas.indexOf(i) >= 0 ? 'num' : '', c);
      th.setAttribute('scope', 'col');
      fc.appendChild(th);
    });
    cab.appendChild(fc);
    t.appendChild(cab);
    var cuerpo = el('tbody');
    filas.forEach(function (f) {
      var tr = el('tr');
      f.forEach(function (c, i) {
        if (i === 0) {
          var th = el('th', null, c);
          th.setAttribute('scope', 'row');
          tr.appendChild(th);
        } else {
          var td = el('td', numericas.indexOf(i) >= 0 ? 'num' : '', typeof c === 'object' ? c.texto : c);
          if (typeof c === 'object' && c.clase) { td.className += ' ' + c.clase; }
          tr.appendChild(td);
        }
      });
      cuerpo.appendChild(tr);
    });
    t.appendChild(cuerpo);
    return t;
  }

  function leyenda(ul, items) {
    vaciar(ul);
    items.forEach(function (it) {
      var li = el('li');
      var m = el('span', 'muestra ' + it.clase);
      m.setAttribute('aria-hidden', 'true');
      li.appendChild(m);
      li.appendChild(el('span', null, it.nombre));
      ul.appendChild(li);
    });
  }

  // ---------- Composición (una sola barra) ----------
  var COMP = [
    { clave: 'fondeo', nombre: 'Fondeo', clase: 'a' },
    { clave: 'perdida', nombre: 'Pérdida esperada', clase: 'b' },
    { clave: 'gastos', nombre: 'Gastos', clase: 'c' },
    { clave: 'capital', nombre: 'Capital', clase: 'd' }
  ];
  var compNodos = null;
  function construirComposicion() {
    var ul = $('componentes');
    vaciar(ul);
    compNodos = COMP.map(function (c) {
      var li = el('li');
      var nom = el('span', 'comp-nom');
      var m = el('span', 'muestra ' + c.clase);
      m.setAttribute('aria-hidden', 'true');
      nom.appendChild(m);
      nom.appendChild(el('span', null, c.nombre));
      var val = el('div', 'comp-val');
      var parte = el('div', 'comp-parte');
      li.appendChild(nom); li.appendChild(val); li.appendChild(parte);
      ul.appendChild(li);
      return { val: val, parte: parte };
    });
  }
  function pintarComposicion(r) {
    var tramos = $('barra').children;
    var x = 0;
    var partes = [];
    COMP.forEach(function (c, i) {
      var w = r.tasa > 0 ? r[c.clave] / r.tasa : 0;
      tramos[i].style.setProperty('--x', String(x));
      tramos[i].style.setProperty('--w', String(w));
      x += w;
      partes.push(w);
      cuenta(compNodos[i].val, r[c.clave], function (v) { return pct(v); });
      cuenta(compNodos[i].parte, w, function (v) { return (v * 100).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + '% de la tasa'; });
    });
    $('barra').setAttribute('aria-label', 'Composición de la tasa mínima de ' + pct(r.tasa) + ': ' +
      COMP.map(function (c) { return c.nombre + ' ' + pct(r[c.clave]); }).join(', '));
    $('d-comp').textContent = 'Cuánto aporta cada concepto a la tasa de ' + pct(r.tasa) + '. El ancho de cada tramo es su parte de la tasa.';
  }

  // ---------- Barras divergentes ----------
  var filasDiv = null;
  function construirDivergente(n) {
    var ul = $('fd-lista');
    vaciar(ul);
    filasDiv = [];
    for (var i = 0; i < n; i++) {
      var li = el('li', 'fd-fila');
      var nom = el('span', 'fd-nombre');
      var t1 = el('span'); var t2 = el('small');
      nom.appendChild(t1); nom.appendChild(t2);
      var pista = el('span', 'fd-pista');
      pista.setAttribute('aria-hidden', 'true');
      var pos = el('span', 'fd-barra pos');
      var neg = el('span', 'fd-barra neg');
      pista.appendChild(neg); pista.appendChild(pos);
      var val = el('span', 'fd-valor');
      li.appendChild(nom); li.appendChild(pista); li.appendChild(val);
      ul.appendChild(li);
      filasDiv.push({ t1: t1, t2: t2, pos: pos, neg: neg, val: val });
    }
  }
  function pintarDivergente(b) {
    if (!filasDiv) { construirDivergente(b.filas.length); }
    var max = 0.005;
    b.filas.forEach(function (f) { if (Math.abs(f.subsidio) > max) { max = Math.abs(f.subsidio); } });
    b.filas.forEach(function (f, i) {
      var n = filasDiv[i];
      n.t1.textContent = f.nombre + ' de PD';
      n.t2.textContent = 'Tasa mínima ' + pct(f.tasaMinima);
      var v = Math.abs(f.subsidio) / max;
      n.pos.style.setProperty('--v', String(f.subsidio >= 0 ? v : 0));
      n.neg.style.setProperty('--v', String(f.subsidio < 0 ? v : 0));
      n.val.className = 'fd-valor ' + (f.subsidio >= 0 ? 'pos' : 'neg');
      cuenta(n.val, f.subsidio, puntos);
    });
    $('g-band').setAttribute('aria-label', 'Subsidio cruzado por banda, en puntos de tasa anual: ' +
      b.filas.map(function (f) { return f.nombre + ' ' + puntos(f.subsidio); }).join(', '));
  }

  // ---------- Lectura y pintado ----------
  function leer() {
    var e = {};
    CAMPOS.forEach(function (k) { e[k] = $(k).value; });
    return e;
  }

  function mostrarErrores(errores) {
    CAMPOS.forEach(function (k) {
      var msg = errores[k] || '';
      $('falla-' + k).textContent = msg;
      if (msg) { $(k).setAttribute('aria-invalid', 'true'); } else { $(k).removeAttribute('aria-invalid'); }
      if (msg && $('mas').contains($(k))) { abrirPliegue($('b-mas'), true); }
    });
  }

  var temporizadorSR = null;
  function anunciar(texto) {
    clearTimeout(temporizadorSR);
    temporizadorSR = setTimeout(function () { $('h-tasa-sr').textContent = texto; }, 700);
  }

  function pintarResultados(p) {
    var esc = F.escenarios(p);
    var sel = esc[escenario];
    var r = sel.resultado;
    var b = F.porBandas(sel.entrada);

    cuenta($('h-tasa'), r.tasa, function (v) { return pct(v); });
    cuenta($('mini-cifra'), r.tasa, function (v) { return pct(v); });
    cuenta($('h-plana'), b.plana, function (v) { return pct(v); });
    cuenta($('h-dif'), r.tasa - b.plana, puntos);
    esc.forEach(function (e, i) { cuenta($('s-' + i), e.resultado.tasa, function (v) { return pct(v); }); });
    $('d-esc').textContent = NOMBRES_ESC[escenario];
    anunciar('Tasa mínima anual, escenario ' + sel.nombre.toLowerCase() + ': ' + pct(r.tasa));

    pintarComposicion(r);

    var d = $('t-desglose-tabla');
    vaciar(d);
    d.appendChild(tabla('Componentes de la tasa mínima anual, escenario ' + sel.nombre.toLowerCase(), ['Componente', 'Tasa', 'Cómo sale'], [
      ['Fondeo', pct(r.fondeo), 'costo de fondeo por (1 menos capital asignado)'],
      ['Pérdida esperada', pct(r.perdida), 'LGD por PD acumulada entre T'],
      ['Gastos operativos', pct(r.gastos), 'dato de entrada'],
      ['Capital', pct(r.capital), 'capital asignado por rendimiento exigido'],
      ['Tasa mínima', pct(r.tasa), 'suma de los cuatro']
    ], [1]));
    var te = $('t-esc-tabla');
    vaciar(te);
    te.appendChild(tabla('Escenarios', ['Escenario', 'PD', 'LGD', 'Fondeo', 'Pérdida esperada', 'Tasa mínima'],
      esc.map(function (e) {
        return [e.nombre, pct(e.entrada.pd), pct(e.entrada.lgd, 1), pct(e.entrada.fondeo), pct(e.resultado.perdida), pct(e.resultado.tasa)];
      }), [1, 2, 3, 4, 5]));

    $('d-band').textContent = 'Las cuatro bandas de PD del proyecto hermano, reescaladas para que su PD promedio sea ' + pct(sel.entrada.pd) +
      ' (escenario ' + sel.nombre.toLowerCase() + '). La tasa plana es ' + pct(b.plana) + '.';
    leyenda($('l-band'), [{ clase: 'pos', nombre: 'La banda paga de más y subsidia a otras' }, { clase: 'neg', nombre: 'La banda paga menos de lo que cuesta' }]);
    pintarDivergente(b);
    var tb = $('t-band-tabla');
    vaciar(tb);
    tb.appendChild(tabla('Tasa mínima, tasa plana y subsidio cruzado por banda',
      ['Banda', '% de clientes', 'PD mensual original', 'PD a 12 meses reescalada', 'Tasa mínima', 'Tasa plana', 'Subsidio cruzado'],
      b.filas.map(function (f) {
        return [f.nombre, pct(f.peso, 1), pct(f.pdMensual, 1), pct(f.pd), pct(f.tasaMinima), pct(b.plana),
          { texto: puntos(f.subsidio) + (f.subsidio >= 0 ? ' (paga de más)' : ' (paga menos)'), clase: f.subsidio >= 0 ? 'pos' : 'neg' }];
      }), [1, 2, 3, 4, 5, 6]));
    $('n-band').textContent = 'La PD mensual original es la del mes siguiente en la base de 2005, que tiene 22% de incumplimiento mensual. ' +
      'Aquí solo se usa la forma del riesgo entre bandas: cuánto más riesgosa es cada una frente al promedio.';
  }

  function sincronizarDeslizador(k) {
    var r = $(k + '-r');
    var n = Number($(k).value);
    if (!isFinite(n) || $(k).value.trim() === '') { return; }
    var mn = Number(r.min), mx = Number(r.max);
    var f = Math.min(1, Math.max(0, (n - mn) / (mx - mn)));
    r.value = String(n);
    r.style.setProperty('--f', String(f));
    r.setAttribute('aria-valuetext', $(k).value + (k === 'plazo' ? ' meses' : ' por ciento'));
  }

  function actualizar() {
    var v = F.validar(leer());
    mostrarErrores(v.errores);
    var cuerpo = $('heroe-cuerpo');
    var error = $('error');
    if (!v.ok) {
      cuerpo.hidden = true;
      $('resto').hidden = true;
      error.hidden = false;
      error.textContent = 'Corrige los campos marcados para ver los resultados.';
      ultimo = null;
      return;
    }
    error.hidden = true;
    var primera = cuerpo.hidden;
    cuerpo.hidden = false;
    $('resto').hidden = false;
    ultimo = v.valores;
    pintarResultados(v.valores);
    if (primera) { observar(); }
  }

  function alEscribir(k) {
    sincronizarDeslizador(k);
    actualizar();
  }

  function cargarEjemplo() {
    CAMPOS.forEach(function (k) { $(k).value = String(F.EJEMPLO[k]); sincronizarDeslizador(k); });
    actualizar();
  }

  // ---------- Pliegues, escenarios, tema ----------
  function abrirPliegue(boton, abrir) {
    var panel = $(boton.getAttribute('aria-controls'));
    boton.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    panel.classList.toggle('abierto', abrir);
  }
  function iniciarPliegues() {
    var botones = document.querySelectorAll('.despliega');
    Array.prototype.forEach.call(botones, function (b) {
      var texto = b.querySelector('span');
      var original = texto.textContent;
      b.addEventListener('click', function () {
        var abrir = b.getAttribute('aria-expanded') !== 'true';
        abrirPliegue(b, abrir);
        if (b.classList.contains('chico')) { texto.textContent = abrir ? 'Ocultar la tabla' : original; }
        else if (b.id === 'b-formulas') { texto.textContent = abrir ? 'Ocultar el ejemplo y las fórmulas' : original; }
      });
    });
  }

  function iniciarEscenarios() {
    var seg = $('segmentado');
    var radios = seg.querySelectorAll('input[name="esc"]');
    function aplicar() {
      Array.prototype.forEach.call(radios, function (r) { if (r.checked) { escenario = Number(r.value); } });
      seg.style.setProperty('--i', String(escenario));
    }
    Array.prototype.forEach.call(radios, function (r) {
      r.addEventListener('change', function () { aplicar(); if (ultimo) { pintarResultados(ultimo); } });
    });
    aplicar();
  }

  function iniciarTema() {
    var modos = ['auto', 'claro', 'oscuro'];
    var i = 0;
    var b = $('tema');
    var raiz = document.documentElement;
    var espera = null;
    b.addEventListener('click', function () {
      i = (i + 1) % modos.length;
      raiz.classList.add('cambia-tema');
      clearTimeout(espera);
      espera = setTimeout(function () { raiz.classList.remove('cambia-tema'); }, 600);
      if (modos[i] === 'auto') { raiz.removeAttribute('data-theme'); }
      else { raiz.setAttribute('data-theme', modos[i] === 'claro' ? 'light' : 'dark'); }
      b.textContent = 'Tema: ' + (modos[i] === 'auto' ? 'automático' : modos[i]);
    });
  }

  // ---------- Aparición escalonada y barra móvil ----------
  var io = null;
  var observados = new Set();
  function observar() {
    var nodos = document.querySelectorAll('.revela');
    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(nodos, function (n) { n.classList.add('visto'); });
      return;
    }
    if (!io) {
      io = new IntersectionObserver(function (entradas) {
        var k = 0;
        entradas.forEach(function (e) {
          if (!e.isIntersecting) { return; }
          e.target.style.setProperty('--d', (k * 90) + 'ms');
          e.target.classList.add('visto');
          io.unobserve(e.target);
          k++;
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
    }
    Array.prototype.forEach.call(nodos, function (n) {
      if (!observados.has(n) && !n.classList.contains('visto')) { observados.add(n); io.observe(n); }
    });
  }
  function iniciarMini() {
    var cifra = $('h-tasa');
    if (!('IntersectionObserver' in window)) { return; }
    new IntersectionObserver(function (es) {
      var visible = es[0].isIntersecting || es[0].boundingClientRect.top > 0;
      $('mini').classList.toggle('visible', !visible && !!ultimo);
    }, { threshold: 0 }).observe(cifra);
  }

  function iniciar() {
    iniciarTema();
    iniciarPliegues();
    iniciarEscenarios();
    construirComposicion();
    CAMPOS.forEach(function (k) {
      $(k).addEventListener('input', function () { alEscribir(k); });
      $(k + '-r').addEventListener('input', function (ev) {
        $(k).value = ev.target.value;
        alEscribir(k);
      });
    });
    $('ejemplo').addEventListener('click', cargarEjemplo);
    observar();
    iniciarMini();
    cargarEjemplo();
  }

  iniciar();
})();
