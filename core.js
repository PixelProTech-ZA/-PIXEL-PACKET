/* PIXEL PACKET — core.js
   Shared engine: loop, canvas, 3D, bit-matrix titles, warp, UI parts, chapters, progress.
   PixelProTech Solutions (Pty) Ltd */
(function () {
  'use strict';
  var SVGNS = 'http://www.w3.org/2000/svg';
  var PP = window.PP = { chapters: [], labCount: 0, algoCount: 0 };
  var N = PP.net = window.PPNET;

  /* ---------- tiny helpers ---------- */
  PP.reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  PP.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  PP.lerp = function (a, b, t) { return a + (b - a) * t; };
  PP.rnd = function (a, b) { return a + Math.random() * (b - a); };
  PP.rndi = function (a, b) { return Math.floor(PP.rnd(a, b + 1)); };
  PP.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  PP.ease = function (t) { t = PP.clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); };
  PP.easeIO = function (t) { t = PP.clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  PP.hsl = function (h, s, l, a) { return 'hsla(' + h + ',' + s + '%,' + l + '%,' + (a === undefined ? 1 : a) + ')'; };
  PP.LAYER = { phy: 38, link: 166, net: 200, tcp: 262, app: 320, fcs: 12, pad: 220 };
  PP.lc = function (layer, a, l) { return PP.hsl(PP.LAYER[layer], 90, l || 62, a === undefined ? 1 : a); };
  PP.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  PP.fmt = function (v, d) { return Number(v).toLocaleString('en-US', { maximumFractionDigits: d === undefined ? 0 : d, minimumFractionDigits: 0 }); };
  PP.store = {
    get: function (k, d) { try { var v = localStorage.getItem('pp.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('pp.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked: course still works */ } }
  };

  function add(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(c && c.nodeType ? c : document.createTextNode(String(c)));
  }
  function make(el, attrs, args) {
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (var i = 2; i < args.length; i++) add(el, args[i]);
    return el;
  }
  PP.h = function (tag, attrs) { return make(document.createElement(tag), attrs, arguments); };
  PP.svg = function (tag, attrs) { return make(document.createElementNS(SVGNS, tag), attrs, arguments); };
  PP.$ = function (s, r) { return (r || document).querySelector(s); };
  PP.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  PP.hex2 = function (n) { return ('0' + (n & 255).toString(16)).slice(-2); };

  /* ---------- master loop: only visible things animate ---------- */
  var tickers = [], io = null, last = 0;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.target._tk) e.target._tk.vis = e.isIntersecting; });
    }, { rootMargin: '120px' });
  }
  PP.tick = function (el, fn) {
    var t = { el: el, fn: fn, vis: !io, t0: null };
    el._tk = t; tickers.push(t);
    if (io) io.observe(el);
    return t;
  };
  function frame(ts) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = ts; return; }
    var dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
    var t = ts / 1000;
    for (var i = 0; i < tickers.length; i++) {
      var k = tickers[i];
      if (!k.vis) continue;
      try { k.fn(t, dt, k); } catch (e) { if (!k.err) { k.err = 1; console.error('ticker error', e); } }
    }
  }
  requestAnimationFrame(frame);

  /* ---------- canvas with DPR + resize ---------- */
  PP.canvas = function (parent, opts) {
    opts = opts || {};
    var c = PP.h('canvas', { class: 'cv' });
    parent.appendChild(c);
    var o = { c: c, g: c.getContext('2d'), w: 0, h: 0, dpr: 1, onresize: null };
    function fit() {
      var w = Math.max(40, Math.round(parent.clientWidth || parent.getBoundingClientRect().width || 300));
      var h = typeof opts.h === 'function' ? opts.h(w) : (opts.h || (opts.aspect ? Math.round(w / opts.aspect) : 300));
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      if (w === o.w && h === o.h && dpr === o.dpr) return;
      o.w = w; o.h = h; o.dpr = dpr;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      c.style.width = w + 'px'; c.style.height = h + 'px';
      o.g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (o.onresize) o.onresize(o);
    }
    o.fit = fit;
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(parent);
    else window.addEventListener('resize', fit);
    fit();
    return o;
  };
  PP.ptr = function (el) {
    var p = { x: -999, y: -999, inside: false, down: false, nx: 0.5, ny: 0.5 };
    function set(e) {
      var r = el.getBoundingClientRect();
      p.x = e.clientX - r.left; p.y = e.clientY - r.top; p.inside = true;
      p.nx = p.x / Math.max(1, r.width); p.ny = p.y / Math.max(1, r.height);
    }
    el.addEventListener('pointermove', set);
    el.addEventListener('pointerdown', function (e) { p.down = true; set(e); });
    window.addEventListener('pointerup', function () { p.down = false; });
    el.addEventListener('pointerleave', function () { p.inside = false; p.x = p.y = -999; });
    return p;
  };

  /* ---------- tiny 3D ---------- */
  PP.proj = function (cam, x, y, z, cx, cy) {
    var cyw = Math.cos(cam.yaw), syw = Math.sin(cam.yaw), cpt = Math.cos(cam.pitch), spt = Math.sin(cam.pitch);
    var x1 = x * cyw - z * syw, z1 = x * syw + z * cyw;
    var y1 = y * cpt - z1 * spt, z2 = y * spt + z1 * cpt;
    var s = cam.f / (cam.f + cam.d + z2);
    return { x: cx + x1 * s, y: cy + y1 * s, z: z2, s: s };
  };

  /* ---------- bit-matrix titles: the Pixel signature ---------- */
  var F = {
    A: '01110,10001,10001,11111,10001,10001,10001', B: '11110,10001,10001,11110,10001,10001,11110', C: '01110,10001,10000,10000,10000,10001,01110',
    D: '11110,10001,10001,10001,10001,10001,11110', E: '11111,10000,10000,11110,10000,10000,11111', F: '11111,10000,10000,11110,10000,10000,10000',
    G: '01110,10001,10000,10111,10001,10001,01111', H: '10001,10001,10001,11111,10001,10001,10001', I: '01110,00100,00100,00100,00100,00100,01110',
    J: '00111,00010,00010,00010,00010,10010,01100', K: '10001,10010,10100,11000,10100,10010,10001', L: '10000,10000,10000,10000,10000,10000,11111',
    M: '10001,11011,10101,10101,10001,10001,10001', N: '10001,11001,10101,10011,10001,10001,10001', O: '01110,10001,10001,10001,10001,10001,01110',
    P: '11110,10001,10001,11110,10000,10000,10000', Q: '01110,10001,10001,10001,10101,10010,01101', R: '11110,10001,10001,11110,10100,10010,10001',
    S: '01111,10000,10000,01110,00001,00001,11110', T: '11111,00100,00100,00100,00100,00100,00100', U: '10001,10001,10001,10001,10001,10001,01110',
    V: '10001,10001,10001,10001,10001,01010,00100', W: '10001,10001,10001,10101,10101,11011,10001', X: '10001,10001,01010,00100,01010,10001,10001',
    Y: '10001,10001,01010,00100,00100,00100,00100', Z: '11111,00001,00010,00100,01000,10000,11111',
    '0': '01110,10001,10011,10101,11001,10001,01110', '1': '00100,01100,00100,00100,00100,00100,01110', '2': '01110,10001,00001,00010,00100,01000,11111',
    '3': '11110,00001,00001,01110,00001,00001,11110', '4': '00010,00110,01010,10010,11111,00010,00010', '5': '11111,10000,11110,00001,00001,10001,01110',
    '6': '00110,01000,10000,11110,10001,10001,01110', '7': '11111,00001,00010,00100,01000,01000,01000', '8': '01110,10001,10001,01110,10001,10001,01110',
    '9': '01110,10001,10001,01111,00001,00010,01100', ' ': '00000,00000,00000,00000,00000,00000,00000', '.': '00000,00000,00000,00000,00000,01100,01100',
    '/': '00001,00001,00010,00100,01000,10000,10000', '-': '00000,00000,00000,11111,00000,00000,00000', ':': '00000,01100,01100,00000,01100,01100,00000'
  };
  PP.bitTitle = function (parent, text, opts) {
    opts = opts || {};
    var lines = String(text).toUpperCase().split('\n');
    var hue = opts.hue === undefined ? 166 : opts.hue;
    var cell = 10, H = 80, dots = [], assembled = false, started = null;
    var pt = { x: -999, y: -999 };
    function layout(w) {
      var maxCols = 1;
      lines.forEach(function (l) { maxCols = Math.max(maxCols, l.length * 6 - 1); });
      cell = Math.max(2, Math.min(opts.max || 12, Math.floor((w - 6) / maxCols)));
      var gap = Math.round(cell * 1.6);
      H = lines.length * 7 * cell + (lines.length - 1) * gap + cell * 2;
      var old = dots; dots = [];
      lines.forEach(function (l, li) {
        var lw = (l.length * 6 - 1) * cell, ox = opts.center ? Math.round((w - lw) / 2) : 3;
        for (var ci = 0; ci < l.length; ci++) {
          var rows = (F[l[ci]] || F[' ']).split(',');
          for (var r = 0; r < 7; r++) for (var c = 0; c < 5; c++) {
            if (rows[r][c] !== '1') continue;
            var hx = ox + (ci * 6 + c) * cell + cell / 2, hy = cell + li * (7 * cell + gap) + r * cell + cell / 2;
            dots.push({
              hx: hx, hy: hy, sx: hx + PP.rnd(-w * 0.6, w * 0.6), sy: hy + PP.rnd(-H * 2, H * 2),
              delay: Math.random() * 0.9 + (hx / w) * 0.5, dur: PP.rnd(0.7, 1.3), ch: Math.random() < 0.5 ? '0' : '1', ox: 0, oy: 0, z: Math.random()
            });
          }
        }
      });
      if (assembled || PP.reduced) dots.forEach(function (d) { d.delay = -9; d.dur = 0.01; });
      return H;
    }
    var cv = PP.canvas(parent, { h: layout });
    cv.c.classList.add('bt');
    cv.c.addEventListener('pointermove', function (e) { var r = cv.c.getBoundingClientRect(); pt.x = e.clientX - r.left; pt.y = e.clientY - r.top; });
    cv.c.addEventListener('pointerleave', function () { pt.x = pt.y = -999; });
    PP.tick(parent, function (t) {
      var g = cv.g; if (started === null) started = t;
      var tt = t - started;
      g.clearRect(0, 0, cv.w, cv.h);
      g.font = '700 ' + (cell * 1.0) + 'px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      var R = Math.max(40, cell * 7), done = true;
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i], p = PP.clamp((tt - d.delay) / d.dur, 0, 1), e = PP.ease(p);
        if (p < 1) done = false;
        var x = PP.lerp(d.sx, d.hx, e), y = PP.lerp(d.sy, d.hy, e);
        if (p >= 1) y += Math.sin(t * 1.5 + d.hx * 0.04) * cell * 0.16;
        var dx = x - pt.x, dy = y - pt.y, dist = Math.sqrt(dx * dx + dy * dy), tx = 0, ty = 0;
        if (dist < R && dist > 0.01) { var f = Math.pow(1 - dist / R, 2) * cell * 3; tx = dx / dist * f; ty = dy / dist * f; }
        d.ox += (tx - d.ox) * 0.14; d.oy += (ty - d.oy) * 0.14;
        if (!PP.reduced && Math.random() < 0.0025) d.ch = d.ch === '0' ? '1' : '0';
        var b = 0.5 + 0.5 * Math.sin(t * 2.1 - d.hx * 0.028 + d.hy * 0.02);
        var al = 0.25 + 0.75 * e, hh = hue + (d.z > 0.9 ? 40 : 0);
        g.fillStyle = PP.hsl(hh, 90, 55, (0.14 + 0.2 * b) * al);
        g.fillRect(x + d.ox - cell * 0.46, y + d.oy - cell * 0.46, cell * 0.92, cell * 0.92);
        g.fillStyle = PP.hsl(hh, 95, 62 + 24 * b, (0.72 + 0.28 * b) * al);
        g.fillText(d.ch, x + d.ox, y + d.oy);
      }
      if (done) assembled = true;
    });
    return cv;
  };

  /* ---------- warp background ---------- */
  PP.scrollV = 0;
  PP.warp = function () {
    var c = document.getElementById('warp'); if (!c) return;
    var g = c.getContext('2d'), w = 0, h = 0, dpr = 1, S = [], COUNT = PP.reduced ? 70 : 230;
    var HUES = [166, 166, 166, 200, 200, 262, 320, 38];
    function size() {
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      w = window.innerWidth; h = window.innerHeight;
      c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px';
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function star(s, far) {
      s.x = PP.rnd(-1, 1); s.y = PP.rnd(-1, 1);
      if (Math.abs(s.x) < 0.08 && Math.abs(s.y) < 0.08) s.x += 0.2;
      s.z = far ? 1 : PP.rnd(0.05, 1); s.h = PP.pick(HUES); s.k = Math.random();
      return s;
    }
    for (var i = 0; i < COUNT; i++) S.push(star({}, false));
    size(); window.addEventListener('resize', size);
    var lastY = window.scrollY, lastT = performance.now();
    window.addEventListener('scroll', function () {
      var now = performance.now(), dt = Math.max(8, now - lastT);
      var v = (window.scrollY - lastY) / dt * 1000;
      PP.scrollV = PP.scrollV * 0.6 + v * 0.4; lastY = window.scrollY; lastT = now;
    }, { passive: true });
    var tk = { vis: true, fn: null };
    tickers.push(tk);
    tk.fn = function (t, dt) {
      PP.scrollV *= 0.94;
      var speed = (PP.reduced ? 0.02 : 0.07) + Math.min(1.3, Math.abs(PP.scrollV) / 1400);
      g.clearRect(0, 0, w, h);
      var cx = w / 2, cy = h * 0.46, f = Math.min(w, h) * 0.55;
      for (var i = 0; i < S.length; i++) {
        var s = S[i], pz = s.z + speed * dt * (1.4 + s.k);
        s.z -= speed * dt * (0.5 + s.k * 0.9);
        if (s.z <= 0.03) { star(s, true); continue; }
        var sx = cx + s.x / s.z * f * 0.5, sy = cy + s.y / s.z * f * 0.5;
        if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) { star(s, true); continue; }
        var px = cx + s.x / pz * f * 0.5, py = cy + s.y / pz * f * 0.5;
        var a = PP.clamp((1 - s.z) * 1.15, 0, 1) * (0.35 + s.k * 0.5);
        g.strokeStyle = PP.hsl(s.h, 90, 62, a);
        g.lineWidth = 0.5 + (1 - s.z) * (1 + s.k * 1.5);
        g.beginPath(); g.moveTo(px, py); g.lineTo(sx, sy); g.stroke();
      }
    };
  };

  /* ---------- UI parts ---------- */
  PP.btn = function (label, onclick, cls) { return PP.h('button', { type: 'button', class: 'btn ' + (cls || ''), onclick: onclick }, label); };
  PP.seg = function (opts, val, onchange) {
    var wrap = PP.h('div', { class: 'seg' }), btns = [];
    function set(v) { val = v; opts.forEach(function (o, i) { btns[i].classList.toggle('on', o.v === v); }); }
    opts.forEach(function (o) {
      var b = PP.h('button', { type: 'button', class: 'seg-b' + (o.v === val ? ' on' : ''), onclick: function () { set(o.v); if (onchange) onchange(o.v); } }, o.t);
      btns.push(b); wrap.appendChild(b);
    });
    return { el: wrap, get: function () { return val; }, set: set };
  };
  var sid = 0;
  PP.slider = function (label, o, onchange) {
    var id = 'sl' + (++sid), out = PP.h('output'), fmt = o.fmt || function (v) { return v; };
    var inp = PP.h('input', { type: 'range', min: o.min, max: o.max, step: o.step || 1, value: o.value, id: id });
    function upd() { out.textContent = fmt(+inp.value); }
    inp.addEventListener('input', function () { upd(); if (onchange) onchange(+inp.value); });
    upd();
    return { el: PP.h('label', { class: 'slider', for: id }, PP.h('span', { class: 'sl-l' }, label), inp, out), get: function () { return +inp.value; }, set: function (v) { inp.value = v; upd(); }, input: inp };
  };
  PP.code = function (text) { return PP.h('pre', { class: 'code' }, PP.h('code', { text: text })); };
  PP.callout = function (parent, kind, html) {
    var el = PP.h('div', { class: 'callout ' + kind, html: html }); if (parent) parent.appendChild(el); return el;
  };
  PP.prose = function (parent, html) { var el = PP.h('div', { class: 'prose', html: html }); parent.appendChild(el); return el; };
  PP.lab = function (parent, title, desc) {
    PP.labCount++;
    var body = PP.h('div', { class: 'lab-body' });
    var el = PP.h('div', { class: 'lab' },
      PP.h('div', { class: 'lab-head' }, PP.h('span', { class: 'lab-k' }, 'LAB ' + String(PP.labCount).padStart(2, '0')), PP.h('h3', null, title)),
      desc ? PP.h('p', { class: 'lab-desc', html: desc }) : null, body);
    parent.appendChild(el);
    return body;
  };
  PP.algo = function (parent, o) {
    PP.algoCount++;
    var el = PP.h('div', { class: 'algo' },
      PP.h('div', { class: 'algo-k' }, 'THE ALGORITHM'),
      PP.h('h4', null, o.name),
      PP.h('p', { class: 'algo-idea', html: o.idea }),
      PP.h('ol', null, o.steps.map(function (s) { return PP.h('li', { html: s }); })),
      o.code ? PP.h('details', null, PP.h('summary', null, 'Show the pseudocode'), PP.code(o.code)) : null,
      o.cost ? PP.h('p', { class: 'algo-cost', html: o.cost }) : null);
    parent.appendChild(el); return el;
  };
  PP.deal = function (parent, title, items) {
    var el = PP.h('div', { class: 'deal' }, PP.h('div', { class: 'deal-k' }, 'DEAL WITH IT'), PP.h('h4', null, title),
      PP.h('ul', null, items.map(function (s) { return PP.h('li', { html: s }); })));
    parent.appendChild(el); return el;
  };
  PP.tabs = function (parent, defs) {
    var bar = PP.h('div', { class: 'seg' }), pane = PP.h('div', { class: 'tabpane' }), btns = [], built = {};
    function show(i) {
      btns.forEach(function (b, j) { b.classList.toggle('on', i === j); });
      pane.innerHTML = '';
      if (!built[i]) { built[i] = PP.h('div'); defs[i].render(built[i]); }
      pane.appendChild(built[i]);
    }
    defs.forEach(function (d, i) { var b = PP.h('button', { type: 'button', class: 'seg-b', onclick: function () { show(i); } }, d.t); btns.push(b); bar.appendChild(b); });
    parent.appendChild(bar); parent.appendChild(pane); show(0);
    return { show: show };
  };

  /* ---------- SVG packet token travelling between two points ---------- */
  PP.travel = function (layer, a, b, label, color, ms) {
    return new Promise(function (res) {
      var g = PP.svg('g'), wd = Math.max(26, String(label).length * 6.6 + 10);
      var r = PP.svg('rect', { width: wd, height: 18, rx: 3, fill: color });
      var t = PP.svg('text', { 'font-size': 10.5, 'font-weight': 700, fill: '#04120e', 'text-anchor': 'middle', style: 'font-family:var(--mono)' });
      t.textContent = label; g.appendChild(r); g.appendChild(t); layer.appendChild(g);
      var t0 = performance.now(), dur = PP.reduced ? 10 : (ms || 650);
      (function mv(now) {
        var p = Math.min(1, (now - t0) / dur), e = PP.easeIO(p), x = PP.lerp(a.x, b.x, e), y = PP.lerp(a.y, b.y, e);
        r.setAttribute('x', x - wd / 2); r.setAttribute('y', y - 9); t.setAttribute('x', x); t.setAttribute('y', y + 4);
        if (p < 1) requestAnimationFrame(mv); else { g.remove(); res(); }
      })(t0);
    });
  };

  /* ---------- ladder (sequence diagram with playback) ---------- */
  PP.ladder = function (parent, def) {
    var stage = PP.h('div', { class: 'ladder-stage' });
    var note = PP.h('div', { class: 'ladder-note' }, 'Press Play, or Step through one message at a time.');
    var idx = -1, timer = null, lastW = 0, svgEl = null;
    var playB = PP.btn('Play', function () { if (timer) stop(); else play(); }, 'sm');
    var ctl = PP.h('div', { class: 'ladder-ctl' }, playB, PP.btn('Step', function () { stop(); next(); }, 'sm ghost'), PP.btn('Reset', function () { stop(); idx = -1; paint(); }, 'sm ghost'));
    var wrap = PP.h('div', { class: 'ladder' }, ctl, stage, note);
    parent.appendChild(wrap);
    function stop() { if (timer) { clearInterval(timer); timer = null; } playB.textContent = idx >= def.steps.length - 1 ? 'Replay' : 'Play'; }
    function play() { if (idx >= def.steps.length - 1) idx = -1; playB.textContent = 'Pause'; next(); timer = setInterval(function () { if (idx >= def.steps.length - 1) { stop(); return; } next(); }, def.ms || 1400); }
    function next() { if (idx < def.steps.length - 1) { idx++; paint(true); } }
    function build() {
      var W = Math.max(290, stage.clientWidth || 600), n = def.actors.length, rowH = def.rowH || 48, top = 50;
      var H = top + def.steps.length * rowH + 14;
      var svg = PP.svg('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, class: 'ladder-svg' });
      var xs = def.actors.map(function (a, i) { return W / (n * 2) * (2 * i + 1); });
      def.actors.forEach(function (a, i) {
        var bw = Math.min(W / n - 10, 104);
        svg.appendChild(PP.svg('line', { x1: xs[i], y1: 38, x2: xs[i], y2: H - 6, class: 'ld-life' }));
        svg.appendChild(PP.svg('rect', { x: xs[i] - bw / 2, y: 6, width: bw, height: 30, rx: 3, class: 'ld-actor' }));
        var tx = PP.svg('text', { x: xs[i], y: 25, class: 'ld-actor-t', 'text-anchor': 'middle' }); tx.textContent = a; svg.appendChild(tx);
      });
      def.steps.forEach(function (s, i) {
        var y = top + i * rowH + rowH / 2, g = PP.svg('g', { class: 'ld-step', 'data-i': i });
        var x1 = xs[s.from], x2 = xs[s.to];
        if (s.from === s.to) {
          g.appendChild(PP.svg('rect', { x: x1 + 8, y: y - 14, width: Math.min(150, W / n - 20), height: 26, rx: 3, class: 'ld-self' }));
          var st = PP.svg('text', { x: x1 + 14, y: y + 4, class: 'ld-lab' }); st.textContent = s.label; g.appendChild(st);
        } else {
          g.appendChild(PP.svg('line', { x1: x1, y1: y, x2: x2, y2: y, class: 'ld-arrow' }));
          var dir = x2 > x1 ? -1 : 1;
          g.appendChild(PP.svg('path', { d: 'M' + x2 + ' ' + y + ' l' + (dir * 9) + ' -5 l0 10 z', class: 'ld-head' }));
          var lab = PP.svg('text', { x: (x1 + x2) / 2, y: y - 7, class: 'ld-lab', 'text-anchor': 'middle' }); lab.textContent = s.label; g.appendChild(lab);
          if (s.sub) { var sub = PP.svg('text', { x: (x1 + x2) / 2, y: y + 15, class: 'ld-sub', 'text-anchor': 'middle' }); sub.textContent = s.sub; g.appendChild(sub); }
        }
        g.addEventListener('click', function () { stop(); idx = i; paint(true); });
        svg.appendChild(g);
      });
      stage.innerHTML = ''; stage.appendChild(svg); svgEl = svg; lastW = W;
    }
    function paint(anim) {
      if (!svgEl) return;
      PP.$$('.ld-step', svgEl).forEach(function (g, i) {
        g.classList.toggle('on', i <= idx); g.classList.toggle('cur', i === idx);
      });
      if (idx >= 0) {
        var s = def.steps[idx];
        note.innerHTML = '<b>' + (idx + 1) + '/' + def.steps.length + '</b> &nbsp;' + (s.note || s.label);
        if (anim && !PP.reduced) {
          var g = PP.$('.ld-step[data-i="' + idx + '"]', svgEl), ln = PP.$('.ld-arrow', g);
          if (ln) {
            var d = PP.svg('circle', { r: 4, class: 'ld-dot', cx: ln.getAttribute('x1'), cy: ln.getAttribute('y1') }); svgEl.appendChild(d);
            var x1 = +ln.getAttribute('x1'), x2 = +ln.getAttribute('x2'), t0 = performance.now();
            (function mv(now) { var p = Math.min(1, (now - t0) / 450); d.setAttribute('cx', x1 + (x2 - x1) * PP.ease(p)); if (p < 1) requestAnimationFrame(mv); else d.remove(); })(t0);
          }
        }
      } else note.textContent = 'Press Play, or Step through one message at a time.';
      if (idx >= def.steps.length - 1) playB.textContent = timer ? 'Pause' : 'Replay';
    }
    build(); paint();
    if ('ResizeObserver' in window) new ResizeObserver(function () { var w = stage.clientWidth; if (Math.abs(w - lastW) > 8) { build(); paint(); } }).observe(stage);
    return { reset: function () { stop(); idx = -1; paint(); } };
  };

  /* ---------- quiz ---------- */
  PP.isDone = function (id) { var s = PP.store.get('q.' + id, null); return !!(s && s.every(function (x) { return x >= 0; })); };
  PP.quiz = function (parent, id, qs) {
    var state = PP.store.get('q.' + id, null);
    if (!state || state.length !== qs.length) state = qs.map(function () { return -1; });
    var score = PP.h('div', { class: 'q-score' });
    var el = PP.h('div', { class: 'quiz' }, PP.h('div', { class: 'quiz-k' }, 'CHECK YOURSELF'), PP.h('h4', null, 'Three questions. Deliver the packet.'));
    var cards = qs.map(function (q, qi) {
      var why = PP.h('p', { class: 'q-why', html: q.why }), opts = PP.h('div', { class: 'q-opts' });
      var bs = q.a.map(function (t, ai) {
        var b = PP.h('button', { type: 'button', class: 'q-opt', onclick: function () { if (state[qi] >= 0) return; state[qi] = ai; PP.store.set('q.' + id, state); paint(); if (PP.isDone(id)) PP.progress(); } }, t);
        opts.appendChild(b); return b;
      });
      var card = PP.h('div', { class: 'q' }, PP.h('p', { class: 'q-q', html: (qi + 1) + '. ' + q.q }), opts, why);
      card._paint = function () {
        var a = state[qi];
        bs.forEach(function (b, ai) {
          b.classList.toggle('right', a >= 0 && ai === q.c); b.classList.toggle('wrong', a >= 0 && ai === a && ai !== q.c); b.disabled = a >= 0;
        });
        why.classList.toggle('show', a >= 0);
      };
      el.appendChild(card); return card;
    });
    el.appendChild(score);
    function paint() {
      cards.forEach(function (c) { c._paint(); });
      var ans = state.filter(function (x) { return x >= 0; }).length, ok = state.filter(function (x, i) { return x === qs[i].c; }).length;
      score.innerHTML = '';
      if (ans === qs.length) {
        score.appendChild(PP.h('span', { class: 'q-done', html: 'PACKET DELIVERED &middot; ' + ok + '/' + qs.length + ' correct' }));
        score.appendChild(PP.btn('Try again', function () { state = qs.map(function () { return -1; }); PP.store.set('q.' + id, state); paint(); PP.progress(); }, 'sm ghost'));
      } else score.appendChild(PP.h('span', { class: 'q-prog' }, ans + '/' + qs.length + ' answered'));
    }
    paint(); parent.appendChild(el);
  };

  /* ---------- chapters, rail, progress ---------- */
  PP.chapter = function (def) { PP.chapters.push(def); };
  PP.progress = function () {
    var chs = PP.chapters.filter(function (c) { return c.quiz; }), n = 0;
    chs.forEach(function (c) {
      var d = PP.isDone(c.id); if (d) n++;
      var dot = document.getElementById('rail-' + c.id); if (dot) dot.classList.toggle('done', d);
    });
    var el = document.getElementById('prog-count'); if (el) el.textContent = n + '/' + chs.length + ' delivered';
  };
  PP.mount = function (main) {
    PP.chapters.sort(function (a, b) { return a.num - b.num; });
    PP.chapters.forEach(function (c) {
      var sec = PP.h('section', { class: 'chap', id: 'c-' + c.id, style: '--h:' + c.hue });
      var tcont = PP.h('div', { class: 'chap-title' });
      sec.appendChild(PP.h('header', { class: 'chap-head' },
        PP.h('div', { class: 'chap-num' }, (c.num === 99 ? 'INDEX' : 'CHAPTER ' + String(c.num).padStart(2, '0')) + ' · ' + c.layerName),
        tcont, PP.h('p', { class: 'chap-tag', html: c.tagline })));
      var body = PP.h('div', { class: 'chap-body' });
      sec.appendChild(body); main.appendChild(sec);
      PP.bitTitle(tcont, c.title, { hue: c.hue, max: 13 });
      try { c.build(body); if (c.quiz) PP.quiz(body, c.id, c.quiz); }
      catch (e) { console.error('chapter failed: ' + c.id, e); body.appendChild(PP.h('div', { class: 'callout bad', html: '<b>This chapter failed to build.</b> ' + String(e && e.message || e) })); }
    });
  };
  PP.buildRail = function () {
    var rail = document.getElementById('rail'); if (!rail) return;
    var cube = PP.h('div', { class: 'pcube', 'aria-hidden': 'true' }, PP.h('div', { class: 'pc pc1' }), PP.h('div', { class: 'pc pc2' }), PP.h('div', { class: 'pc pc3' }), PP.h('div', { class: 'pc pc4' }), PP.h('div', { class: 'pc pc5' }), PP.h('div', { class: 'pc pc6' }));
    var list = PP.h('ol', { class: 'rail-list' });
    list.appendChild(PP.h('li', null, PP.h('a', { href: '#top', class: 'rail-a', id: 'rail-hero', style: '--h:166', title: 'Start' }, PP.h('i'), PP.h('span', null, 'START'))));
    PP.chapters.forEach(function (c) {
      list.appendChild(PP.h('li', null, PP.h('a', { href: '#c-' + c.id, class: 'rail-a', id: 'rail-' + c.id, style: '--h:' + c.hue, title: c.title.replace('\n', ' ') },
        PP.h('i'), PP.h('span', null, c.num === 99 ? 'IDX' : String(c.num).padStart(2, '0') + ' ' + c.short))));
    });
    rail.appendChild(PP.h('div', { class: 'rail-track' }, cube)); rail.appendChild(list);
    var secs = [document.getElementById('top')].concat(PP.chapters.map(function (c) { return document.getElementById('c-' + c.id); })), ids = ['rail-hero'].concat(PP.chapters.map(function (c) { return 'rail-' + c.id; }));
    var bar = document.getElementById('prog-bar'), pend = false;
    function upd() {
      pend = false;
      var y = window.scrollY, max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight), p = PP.clamp(y / max, 0, 1);
      rail.style.setProperty('--p', p.toFixed(4)); if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      var cur = 0, line = window.innerHeight * 0.4;
      secs.forEach(function (s, i) { if (s && s.getBoundingClientRect().top <= line) cur = i; });
      ids.forEach(function (id, i) { var a = document.getElementById(id); if (a) a.classList.toggle('cur', i === cur); });
      var ca = document.getElementById(ids[cur]); if (ca && window.innerWidth < 900 && ca.scrollIntoView) { var ls = ca.parentNode.parentNode; ls.scrollLeft = ca.offsetLeft - ls.clientWidth / 2 + ca.clientWidth / 2; }
    }
    window.addEventListener('scroll', function () { if (!pend) { pend = true; requestAnimationFrame(upd); } }, { passive: true });
    window.addEventListener('resize', upd); upd();
    rail.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('a') : null; if (!a) return;
      var id = a.getAttribute('href').slice(1), t = document.getElementById(id); if (!t) return;
      e.preventDefault(); t.scrollIntoView({ behavior: PP.reduced ? 'auto' : 'smooth', block: 'start' });
    });
  };
})();
