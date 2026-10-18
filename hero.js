/* PIXEL PACKET — hero.js : the signal globe and the live hex tape */
(function () {
  'use strict';
  var N = PP.net;
  var CITY = {
    JNB: ['Johannesburg', -26.2, 28.0], CPT: ['Cape Town', -33.9, 18.4], DBN: ['Durban', -29.9, 31.0], LOS: ['Lagos', 6.5, 3.4],
    NBO: ['Nairobi', -1.3, 36.8], MBA: ['Mombasa', -4.0, 39.7], LIS: ['Lisbon', 38.7, -9.1], LON: ['London', 51.5, -0.1],
    MRS: ['Marseille', 43.3, 5.4], FRA: ['Frankfurt', 50.1, 8.7], NYC: ['New York', 40.7, -74.0], GRU: ['Sao Paulo', -23.5, -46.6],
    BOM: ['Mumbai', 19.1, 72.9], SIN: ['Singapore', 1.35, 103.8], SYD: ['Sydney', -33.9, 151.2]
  };
  // Stylised links. Not exact cable routes. Land links are marked dashed.
  var LINKS = [
    ['CPT', 'LIS'], ['CPT', 'LON'], ['CPT', 'LOS'], ['LOS', 'LIS'], ['DBN', 'MBA'], ['MBA', 'BOM'], ['BOM', 'MRS'], ['MRS', 'LON'], ['LON', 'FRA'],
    ['LON', 'NYC'], ['LIS', 'NYC'], ['NYC', 'GRU'], ['LIS', 'GRU'], ['BOM', 'SIN'], ['SIN', 'SYD'], ['FRA', 'MRS'], ['MBA', 'NBO', 1], ['JNB', 'DBN', 1], ['JNB', 'CPT', 1], ['JNB', 'NBO', 1], ['CPT', 'GRU']
  ];
  PP.CITY = CITY; PP.LINKS = LINKS;

  function vec(lat, lon) {
    var p = lat * Math.PI / 180, l = lon * Math.PI / 180;
    return [Math.cos(p) * Math.sin(l), -Math.sin(p), -Math.cos(p) * Math.cos(l)];
  }
  function slerp(a, b, u) {
    var d = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])), om = Math.acos(d), so = Math.sin(om);
    if (so < 1e-6) return a.slice();
    var s1 = Math.sin((1 - u) * om) / so, s2 = Math.sin(u * om) / so;
    return [a[0] * s1 + b[0] * s2, a[1] * s1 + b[1] * s2, a[2] * s1 + b[2] * s2];
  }
  PP.globe = function (host, o) {
    o = o || {};
    var cv = PP.canvas(host, { h: function () { return host.clientHeight || 600; } });
    var g = cv.g, cam = { yaw: -0.5, pitch: 0.34, f: 900, d: 700 };
    var V = {}; Object.keys(CITY).forEach(function (k) { V[k] = vec(CITY[k][1], CITY[k][2]); });
    var nodes = Object.keys(CITY), edges = LINKS.map(function (l) { return { a: l[0], b: l[1], w: Math.round(N.haversine(CITY[l[0]][1], CITY[l[0]][2], CITY[l[1]][1], CITY[l[1]][2])), land: !!l[2] }; });
    var packets = [], spawn = 0, vel = 0, drag = false, lx = 0;
    var sats = []; for (var i = 0; i < 46; i++) sats.push({ a: i / 46 * Math.PI * 2, r: 1.38 + (i % 3) * 0.03, tilt: 0.5 });
    function newPacket() {
      var s = PP.pick(nodes), d = PP.pick(nodes), n = 0;
      while ((d === s || N.haversine(CITY[s][1], CITY[s][2], CITY[d][1], CITY[d][2]) < 2500) && n++ < 20) { s = PP.pick(nodes); d = PP.pick(nodes); }
      var st = N.dijkstraSteps(nodes, edges, s), path = N.pathTo(st[st.length - 1].prev, s, d);
      if (!path || path.length < 2) return;
      packets.push({ path: path, leg: 0, u: 0, trail: [], hue: PP.pick([166, 200, 262, 320, 38]), speed: PP.rnd(0.55, 0.9) });
    }
    host.parentNode.addEventListener('pointerdown', function (e) { if (e.target.closest('a,button')) return; drag = true; lx = e.clientX; });
    window.addEventListener('pointerup', function () { drag = false; });
    window.addEventListener('pointermove', function (e) { if (!drag) return; var dx = e.clientX - lx; lx = e.clientX; cam.yaw += dx * 0.006; vel = dx * 0.006; });
    function pos(k, lift) { var v = V[k], r = lift || 1; return [v[0] * r, v[1] * r, v[2] * r]; }
    function arcPt(ed, u) {
      var a = V[ed[0]], b = V[ed[1]], p = slerp(a, b, u), dist = N.haversine(CITY[ed[0]][1], CITY[ed[0]][2], CITY[ed[1]][1], CITY[ed[1]][2]);
      var lift = 1 + (dist / 20000) * 0.55 * Math.sin(Math.PI * u) * (ed[2] ? 0.3 : 1);
      return [p[0] * lift, p[1] * lift, p[2] * lift];
    }
    PP.tick(host, function (t, dt) {
      var w = cv.w, h = cv.h, wide = w >= 900;
      var R = Math.min(w * (wide ? 0.3 : 0.46), h * 0.4), cx = wide ? w * 0.7 : w * 0.5, cy = wide ? h * 0.5 : h * 0.72;
      cam.f = 900; cam.d = 900;
      if (!drag) { vel *= 0.95; cam.yaw += (PP.reduced ? 0.02 : 0.11) * dt + vel; }
      g.clearRect(0, 0, w, h);
      function P(v, r) { return PP.proj(cam, v[0] * R * (r || 1), v[1] * R * (r || 1), v[2] * R * (r || 1), cx, cy); }
      // glow
      var gr = g.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.5);
      gr.addColorStop(0, 'hsla(166,90%,50%,.10)'); gr.addColorStop(0.6, 'hsla(262,90%,60%,.05)'); gr.addColorStop(1, 'transparent');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      // graticule
      g.lineWidth = 1;
      function line(fn, n, hue) {
        var prev = null;
        for (var i = 0; i <= n; i++) {
          var q = P(fn(i / n)), dpt = (q.z / R + 1) / 2;
          if (prev) { g.strokeStyle = PP.hsl(hue, 80, 60, 0.5 * (1 - dpt) + 0.05); g.beginPath(); g.moveTo(prev.x, prev.y); g.lineTo(q.x, q.y); g.stroke(); }
          prev = q;
        }
      }
      for (var la = -60; la <= 60; la += 30) line(function (u) { return vec(la, -180 + 360 * u); }, 72, 200);
      for (var lo = -180; lo < 180; lo += 30) line(function (u) { return vec(-90 + 180 * u, lo); }, 36, 166);
      // links
      LINKS.forEach(function (l) {
        var prev = null;
        g.setLineDash(l[2] ? [3, 5] : []);
        for (var i = 0; i <= 28; i++) {
          var q = P(arcPt(l, i / 28)), dpt = (q.z / R + 1) / 2;
          if (prev) { g.strokeStyle = PP.hsl(l[2] ? 38 : 166, 90, 62, (0.62 * (1 - dpt) + 0.04)); g.lineWidth = l[2] ? 1 : 1.4; g.beginPath(); g.moveTo(prev.x, prev.y); g.lineTo(q.x, q.y); g.stroke(); }
          prev = q;
        }
      });
      g.setLineDash([]);
      // cities
      var sa = { JNB: 1, CPT: 1, DBN: 1 };
      nodes.forEach(function (k) {
        var q = P(V[k]), dpt = (q.z / R + 1) / 2;
        if (dpt > 0.62) return;
        var al = 1 - dpt, me = !!sa[k];
        g.fillStyle = me ? PP.hsl(38, 95, 66, al) : PP.hsl(166, 95, 66, al * 0.9);
        g.beginPath(); g.arc(q.x, q.y, (me ? 4.2 : 3) * q.s * 1.1, 0, 7); g.fill();
        if (me || dpt < 0.3) {
          g.font = '600 ' + (me ? 11 : 10) + 'px ui-monospace,Menlo,Consolas,monospace'; g.fillStyle = PP.hsl(me ? 38 : 166, 80, 78, al * 0.85);
          g.fillText(CITY[k][0].toUpperCase(), q.x + 8, q.y + 4);
        }
      });
      // packets
      spawn -= dt;
      if (spawn <= 0 && packets.length < 5) { newPacket(); spawn = PP.rnd(0.8, 2.2); }
      packets = packets.filter(function (pk) {
        var a = pk.path[pk.leg], b = pk.path[pk.leg + 1], ed = [a, b], rev = false;
        var def = LINKS.filter(function (l) { return (l[0] === a && l[1] === b) || (l[0] === b && l[1] === a); })[0];
        if (!def) { return false; }
        rev = def[0] !== a; var ee = [def[0], def[1], def[2]];
        var dist = N.haversine(CITY[a][1], CITY[a][2], CITY[b][1], CITY[b][2]);
        pk.u += dt * pk.speed * 4200 / Math.max(900, dist);
        if (pk.u >= 1) { pk.u = 0; pk.leg++; if (pk.leg >= pk.path.length - 1) return false; }
        var u = rev ? 1 - pk.u : pk.u, q = P(arcPt(ee, u));
        pk.trail.push({ x: q.x, y: q.y, z: q.z }); if (pk.trail.length > 16) pk.trail.shift();
        for (var i = 1; i < pk.trail.length; i++) {
          var dpt = (pk.trail[i].z / R + 1) / 2; g.strokeStyle = PP.hsl(pk.hue, 95, 70, (i / pk.trail.length) * 0.9 * (1 - dpt * 0.8)); g.lineWidth = 1 + i / pk.trail.length * 2.4;
          g.beginPath(); g.moveTo(pk.trail[i - 1].x, pk.trail[i - 1].y); g.lineTo(pk.trail[i].x, pk.trail[i].y); g.stroke();
        }
        var dh = (q.z / R + 1) / 2; g.fillStyle = PP.hsl(pk.hue, 100, 82, 1 - dh * 0.7); g.beginPath(); g.arc(q.x, q.y, 3.2, 0, 7); g.fill();
        return true;
      });
      // satellites
      sats.forEach(function (s, i) {
        var a = s.a + t * 0.18, x = Math.cos(a) * s.r, z = Math.sin(a) * s.r, y = Math.sin(a * 2 + i) * 0.04 + z * Math.sin(s.tilt) * 0.6;
        var q = P([x, y, z * Math.cos(s.tilt)]), dpt = (q.z / R + 1.5) / 3;
        g.fillStyle = PP.hsl(262, 90, 78, 0.65 * (1 - dpt) + 0.05); g.fillRect(q.x - 1, q.y - 1, 2.2, 2.2);
      });
    });
  };

  /* live hex tape: the real bytes of one frame, coloured by layer */
  PP.hexTape = function (host) {
    var cv = PP.canvas(host, { h: 34 }), g = cv.g;
    var pay = new TextEncoder().encode('GET / HTTP/1.1\r\nHost: example.com\r\nAccept: */*\r\n\r\n');
    var f = N.buildFrame({ payload: pay, srcMac: [2, 0x70, 0x70, 0x74, 0, 1], dstMac: [2, 0x70, 0x70, 0x74, 0, 2], srcIp: N.ip2int('192.168.1.37'), dstIp: N.ip2int('192.0.2.7'), sport: 51034, dport: 80, seq: 1000, ack: 2000, flags: 0x18, win: 64240, ipid: 4242 });
    var col = []; f.regions.forEach(function (r) { for (var i = r.s; i < r.e; i++) col[i] = r.layer; });
    PP.tick(host, function (t) {
      var w = cv.w, step = 26, off = (t * 46) % (step * f.bytes.length);
      g.clearRect(0, 0, w, 34); g.font = '600 13px ui-monospace,Menlo,Consolas,monospace'; g.textBaseline = 'middle';
      var n = f.bytes.length, start = Math.floor(off / step), sub = off - start * step;
      for (var i = 0; i * step - sub < w + step; i++) {
        var bi = (start + i) % n, x = i * step - sub;
        g.fillStyle = PP.lc(col[bi] || 'pad', 0.9, 66); g.fillText(PP.hex2(f.bytes[bi]), x, 17);
      }
      g.fillStyle = 'rgba(7,7,10,.96)'; g.fillRect(0, 0, 104, 34);
      g.fillStyle = 'hsl(166 90% 56%)'; g.fillText('LIVE FRAME', 8, 17);
    });
  };

  PP.hero = function () {
    var gw = document.getElementById('globe-wrap'), ht = document.getElementById('hero-title'), hx = document.getElementById('hexrain');
    if (gw) PP.globe(gw);
    if (ht) PP.bitTitle(ht, 'PIXEL\nPACKET', { hue: 166, max: 15 });
    if (hx) PP.hexTape(hx);
  };
})();
