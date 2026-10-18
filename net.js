/* PIXEL PACKET — net.js
   Pure algorithm engine. No DOM. Every number the course shows is computed here.
   PixelProTech Solutions (Pty) Ltd */
(function (root) {
  'use strict';
  var N = {};

  /* ---------- CRC-32 (IEEE 802.3, reflected, poly 0x04C11DB7 / 0xEDB88320) ---------- */
  var T = null;
  function table() {
    if (T) return T;
    T = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      T[n] = c >>> 0;
    }
    return T;
  }
  N.crc32 = function (u8) {
    var t = table(), c = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) c = t[(c ^ u8[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };

  /* ---------- Long-division CRC, shown step by step (any generator) ---------- */
  // msg, poly are strings of 0/1. poly includes the leading 1 (e.g. '100000111' = x^8+x^2+x+1)
  N.crcDivision = function (msg, poly) {
    var r = poly.length - 1;
    var work = (msg + new Array(r + 1).join('0')).split('').map(Number);
    var p = poly.split('').map(Number);
    var steps = [];
    for (var i = 0; i <= msg.length - 1; i++) {
      if (work[i] === 1) {
        var before = work.join('');
        for (var j = 0; j < p.length; j++) work[i + j] ^= p[j];
        steps.push({ shift: i, xor: true, before: before, after: work.join('') });
      } else {
        steps.push({ shift: i, xor: false, before: work.join(''), after: work.join('') });
      }
    }
    var rem = work.slice(msg.length).join('');
    return { steps: steps, remainder: rem, codeword: msg + rem, r: r };
  };

  /* ---------- Internet checksum (RFC 1071) ---------- */
  N.inetChecksum = function (u8) {
    var sum = 0;
    for (var i = 0; i < u8.length; i += 2) sum += (u8[i] << 8) | (i + 1 < u8.length ? u8[i + 1] : 0);
    while (sum >>> 16) sum = (sum & 0xffff) + (sum >>> 16);
    return (~sum) & 0xffff;
  };

  /* ---------- IPv4 ---------- */
  N.ip2int = function (s) {
    var p = String(s).trim().split('.');
    if (p.length !== 4) return null;
    var v = 0;
    for (var i = 0; i < 4; i++) {
      if (!/^\d{1,3}$/.test(p[i])) return null;
      var n = +p[i];
      if (n > 255) return null;
      v = v * 256 + n;
    }
    return v >>> 0;
  };
  N.int2ip = function (v) { return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255].join('.'); };
  N.maskOf = function (p) { return p <= 0 ? 0 : ((0xFFFFFFFF << (32 - p)) >>> 0); };
  N.bits32 = function (v) { var s = (v >>> 0).toString(2); return new Array(33 - s.length).join('0') + s; };
  N.parseCidr = function (s) {
    var m = String(s).trim().match(/^(\d+\.\d+\.\d+\.\d+)(?:\s*\/\s*(\d{1,2}))?$/);
    if (!m) return null;
    var ip = N.ip2int(m[1]);
    if (ip === null) return null;
    var p = m[2] === undefined ? 24 : +m[2];
    if (p < 0 || p > 32) return null;
    return { ip: ip, p: p };
  };
  N.subnetInfo = function (ip, p) {
    var m = N.maskOf(p);
    var net = (ip & m) >>> 0;
    var bc = (net | ((~m) >>> 0)) >>> 0;
    var size = Math.pow(2, 32 - p), first, last, hosts;
    if (p === 32) { first = last = net; hosts = 1; }
    else if (p === 31) { first = net; last = bc; hosts = 2; }
    else { first = net + 1; last = bc - 1; hosts = size - 2; }
    return { ip: ip, p: p, mask: m, wild: (~m) >>> 0, net: net, bc: bc, first: first, last: last, hosts: hosts, size: size };
  };
  function inC(ip, net, p) { var m = N.maskOf(p); return ((ip & m) >>> 0) === ((net & m) >>> 0); }
  var SPECIAL = [
    ['0.0.0.0', 8, '"This network"', 'Only valid as a source while a device has no address yet (e.g. DHCP Discover).'],
    ['10.0.0.0', 8, 'Private (RFC 1918)', 'Not routable on the public internet. Home, office and cloud networks reuse it.'],
    ['100.64.0.0', 10, 'Shared / CGNAT (RFC 6598)', 'Your ISP is sharing one public address between many customers.'],
    ['127.0.0.0', 8, 'Loopback', 'Never leaves your machine. 127.0.0.1 is "me".'],
    ['169.254.0.0', 16, 'Link-local (APIPA)', 'A device gave itself this because DHCP did not answer. A classic fault sign.'],
    ['172.16.0.0', 12, 'Private (RFC 1918)', 'Not routable on the public internet.'],
    ['192.0.0.0', 24, 'IETF protocol assignments', 'Reserved for protocol use.'],
    ['192.0.2.0', 24, 'Documentation (TEST-NET-1)', 'Safe to use in examples. Never real.'],
    ['192.168.0.0', 16, 'Private (RFC 1918)', 'The default of most home routers.'],
    ['198.18.0.0', 15, 'Benchmarking', 'Reserved for network equipment testing.'],
    ['198.51.100.0', 24, 'Documentation (TEST-NET-2)', 'Safe to use in examples. Never real.'],
    ['203.0.113.0', 24, 'Documentation (TEST-NET-3)', 'Safe to use in examples. Never real.'],
    ['224.0.0.0', 4, 'Multicast', 'One-to-many delivery. Not a normal host address.'],
    ['240.0.0.0', 4, 'Reserved', 'Reserved for future use.']
  ];
  N.ipType = function (ip) {
    if (ip === 0xFFFFFFFF) return { name: 'Limited broadcast', note: 'Every device on this link.', priv: false };
    for (var i = 0; i < SPECIAL.length; i++) {
      var s = SPECIAL[i];
      if (inC(ip, N.ip2int(s[0]), s[1])) return { name: s[2], note: s[3], priv: /Private|CGNAT|Shared/.test(s[2]) };
    }
    return { name: 'Public (globally routable)', note: 'Can be reached from anywhere, if routing and firewalls allow it.', priv: false };
  };
  // VLSM: allocate blocks largest-first, aligned
  N.vlsm = function (base, basePrefix, needs) {
    var items = needs.map(function (n, i) { return { need: n, i: i }; }).sort(function (a, b) { return b.need - a.need; });
    var start = (base & N.maskOf(basePrefix)) >>> 0;
    var end = start + Math.pow(2, 32 - basePrefix);
    var cur = start, out = [];
    for (var k = 0; k < items.length; k++) {
      var it = items[k], bits = 2;
      while (Math.pow(2, bits) - 2 < it.need) bits++;
      var size = Math.pow(2, bits);
      cur = Math.ceil(cur / size) * size;
      if (cur + size > end) return { ok: false, out: out, failed: it, start: start, end: end };
      out.push({ need: it.need, prefix: 32 - bits, net: cur, size: size, usable: size - 2, idx: it.i });
      cur += size;
    }
    return { ok: true, out: out, start: start, end: end, used: cur - start };
  };
  // Longest-prefix match
  N.lpm = function (routes, ip) {
    var best = null;
    for (var i = 0; i < routes.length; i++) {
      var r = routes[i];
      if (inC(ip, r.net, r.p) && (!best || r.p > best.p)) best = r;
    }
    return best;
  };
  N.inCidr = inC;

  /* ---------- MAC ---------- */
  N.macStr = function (u8, off) {
    off = off || 0; var a = [];
    for (var i = 0; i < 6; i++) a.push(('0' + u8[off + i].toString(16)).slice(-2));
    return a.join(':');
  };

  /* ---------- Frame builder: the real bytes of an Ethernet/IPv4/TCP frame ---------- */
  N.buildFrame = function (o) {
    var pay = o.payload;
    var tcp = new Uint8Array(20 + pay.length), ip = new Uint8Array(20);
    var dv;
    // TCP header
    dv = new DataView(tcp.buffer);
    dv.setUint16(0, o.sport); dv.setUint16(2, o.dport);
    dv.setUint32(4, o.seq >>> 0); dv.setUint32(8, o.ack >>> 0);
    tcp[12] = 5 << 4; tcp[13] = o.flags; dv.setUint16(14, o.win);
    dv.setUint16(16, 0); dv.setUint16(18, 0);
    tcp.set(pay, 20);
    // IP header
    dv = new DataView(ip.buffer);
    ip[0] = 0x45; ip[1] = 0; dv.setUint16(2, 20 + tcp.length); dv.setUint16(4, o.ipid);
    dv.setUint16(6, 0x4000); ip[8] = 64; ip[9] = 6; dv.setUint16(10, 0);
    dv.setUint32(12, o.srcIp); dv.setUint32(16, o.dstIp);
    dv = new DataView(ip.buffer); dv.setUint16(10, N.inetChecksum(ip));
    // TCP checksum with pseudo header
    var ps = new Uint8Array(12 + tcp.length);
    var pv = new DataView(ps.buffer);
    pv.setUint32(0, o.srcIp); pv.setUint32(4, o.dstIp); ps[8] = 0; ps[9] = 6; pv.setUint16(10, tcp.length);
    ps.set(tcp, 12);
    new DataView(tcp.buffer).setUint16(16, N.inetChecksum(ps));
    // Ethernet
    var l3 = ip.length + tcp.length;
    var padN = Math.max(0, 46 - l3);
    var eth = new Uint8Array(14 + l3 + padN + 4);
    eth.set(o.dstMac, 0); eth.set(o.srcMac, 6); eth[12] = 0x08; eth[13] = 0x00;
    eth.set(ip, 14); eth.set(tcp, 14 + 20);
    var fcsAt = 14 + l3 + padN;
    var crc = N.crc32(eth.subarray(0, fcsAt));
    eth[fcsAt] = crc & 255; eth[fcsAt + 1] = (crc >>> 8) & 255; eth[fcsAt + 2] = (crc >>> 16) & 255; eth[fcsAt + 3] = (crc >>> 24) & 255;
    var regions = [
      { name: 'Ethernet header', layer: 'link', s: 0, e: 14 },
      { name: 'IPv4 header', layer: 'net', s: 14, e: 34 },
      { name: 'TCP header', layer: 'tcp', s: 34, e: 54 },
      { name: 'Payload (HTTP)', layer: 'app', s: 54, e: 54 + pay.length }
    ];
    if (padN) regions.push({ name: 'Padding', layer: 'pad', s: 54 + pay.length, e: 54 + pay.length + padN });
    regions.push({ name: 'FCS (CRC-32)', layer: 'fcs', s: fcsAt, e: fcsAt + 4 });
    var frame = 14 + l3 + padN + 4;
    return { bytes: eth, regions: regions, crc: crc, padN: padN, frameLen: frame, wireLen: frame + 20, payloadLen: pay.length,
      efficiency: pay.length / (frame + 20), ipCsum: new DataView(ip.buffer).getUint16(10), tcpCsum: new DataView(tcp.buffer).getUint16(16) };
  };

  /* ---------- Geography ---------- */
  N.haversine = function (la1, lo1, la2, lo2) {
    var R = 6371.0088, r = Math.PI / 180;
    var dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
    var a = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  };

  /* ---------- Probability / capacity ---------- */
  N.binomTail = function (n, p, k) { // P(X > k)
    if (n <= k) return 0;
    if (p >= 1) return 1;
    if (p <= 0) return 0;
    var pmf = Math.pow(1 - p, n), tail = 0;
    for (var i = 0; i <= n; i++) {
      if (i > k) tail += pmf;
      pmf = pmf * (n - i) / (i + 1) * (p / (1 - p));
    }
    return Math.min(1, tail);
  };
  N.shannon = function (bw, snrDb) { return bw * Math.log(1 + Math.pow(10, snrDb / 10)) / Math.LN2; };
  N.mathis = function (mssBytes, rttSec, p) { return (mssBytes * 8 / rttSec) * (1.22 / Math.sqrt(p)); };

  /* ---------- Seeded random + Gaussian ---------- */
  N.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  N.gauss = function (n, seed) {
    var r = N.rng(seed), out = new Float32Array(n);
    for (var i = 0; i < n; i += 2) {
      var u = Math.max(1e-9, r()), v = r();
      var m = Math.sqrt(-2 * Math.log(u));
      out[i] = m * Math.cos(2 * Math.PI * v);
      if (i + 1 < n) out[i + 1] = m * Math.sin(2 * Math.PI * v);
    }
    return out;
  };

  /* ---------- Line codes and modulation ---------- */
  N.SPB = 40; // samples per bit
  N.encode = function (bits, kind) {
    var spb = N.SPB, out = new Float32Array(bits.length * spb), TAU = 2 * Math.PI;
    for (var b = 0; b < bits.length; b++) {
      var bit = bits[b];
      for (var s = 0; s < spb; s++) {
        var t = s / spb, v = 0;
        if (kind === 'nrz') v = bit ? 1 : -1;
        else if (kind === 'man') v = t < 0.5 ? (bit ? -1 : 1) : (bit ? 1 : -1); // 1 = low->high mid-bit
        else if (kind === 'ask') v = (bit ? 1 : 0.3) * Math.sin(TAU * 4 * t);
        else if (kind === 'fsk') v = Math.sin(TAU * (bit ? 6 : 3) * t);
        else if (kind === 'psk') v = (bit ? 1 : -1) * Math.sin(TAU * 4 * t);
        out[b * spb + s] = v;
      }
    }
    return out;
  };
  N.decode = function (x, nbits, kind) {
    var spb = N.SPB, TAU = 2 * Math.PI, bits = [];
    for (var b = 0; b < nbits; b++) {
      var bit = 0, i, t, o = b * spb;
      if (kind === 'nrz') { var m = 0; for (i = 0; i < spb; i++) m += x[o + i]; bit = m > 0 ? 1 : 0; }
      else if (kind === 'man') {
        var a = 0, c = 0;
        for (i = 0; i < spb / 2; i++) { a += x[o + i]; c += x[o + spb / 2 + i]; }
        bit = c > a ? 1 : 0;
      } else if (kind === 'ask') {
        var q = 0; for (i = 0; i < spb; i++) q += x[o + i] * Math.sin(TAU * 4 * i / spb);
        bit = (q * 2 / spb) > 0.65 ? 1 : 0;
      } else if (kind === 'psk') {
        var z = 0; for (i = 0; i < spb; i++) z += x[o + i] * Math.sin(TAU * 4 * i / spb);
        bit = z > 0 ? 1 : 0;
      } else if (kind === 'fsk') {
        var s0 = 0, c0 = 0, s1 = 0, c1 = 0;
        for (i = 0; i < spb; i++) {
          t = i / spb;
          s0 += x[o + i] * Math.sin(TAU * 3 * t); c0 += x[o + i] * Math.cos(TAU * 3 * t);
          s1 += x[o + i] * Math.sin(TAU * 6 * t); c1 += x[o + i] * Math.cos(TAU * 6 * t);
        }
        bit = (s1 * s1 + c1 * c1) > (s0 * s0 + c0 * c0) ? 1 : 0;
      }
      bits.push(bit);
    }
    return bits;
  };
  N.power = function (x) { var s = 0; for (var i = 0; i < x.length; i++) s += x[i] * x[i]; return s / x.length; };

  /* ---------- Routing: Dijkstra and Bellman-Ford, step by step ---------- */
  function adjacency(nodes, edges) {
    var adj = {};
    nodes.forEach(function (n) { adj[n] = []; });
    edges.forEach(function (e, i) {
      if (e.down) return;
      adj[e.a].push({ to: e.b, w: e.w, ei: i });
      adj[e.b].push({ to: e.a, w: e.w, ei: i });
    });
    return adj;
  }
  function cp(o) { return JSON.parse(JSON.stringify(o, function (k, v) { return v === Infinity ? 'inf' : v; }), function (k, v) { return v === 'inf' ? Infinity : v; }); }
  N.dijkstraSteps = function (nodes, edges, src) {
    var adj = adjacency(nodes, edges), dist = {}, prev = {}, done = {}, steps = [];
    nodes.forEach(function (n) { dist[n] = Infinity; });
    dist[src] = 0;
    steps.push({ kind: 'init', dist: cp(dist), prev: cp(prev), done: cp(done), cur: null, rel: [] });
    for (;;) {
      var u = null, best = Infinity;
      for (var i = 0; i < nodes.length; i++) { var n = nodes[i]; if (!done[n] && dist[n] < best) { best = dist[n]; u = n; } }
      if (u === null) break;
      done[u] = true;
      var rel = [];
      adj[u].forEach(function (x) {
        if (done[x.to]) { rel.push({ ei: x.ei, to: x.to, imp: false, skip: true }); return; }
        var nd = dist[u] + x.w;
        if (nd < dist[x.to]) { dist[x.to] = nd; prev[x.to] = u; rel.push({ ei: x.ei, to: x.to, imp: true }); }
        else rel.push({ ei: x.ei, to: x.to, imp: false });
      });
      steps.push({ kind: 'settle', dist: cp(dist), prev: cp(prev), done: cp(done), cur: u, rel: rel });
    }
    return steps;
  };
  // Synchronous distance-vector rounds (what RIP-style neighbours do)
  N.bellmanSteps = function (nodes, edges, src) {
    var adj = adjacency(nodes, edges), dist = {}, prev = {}, steps = [];
    nodes.forEach(function (n) { dist[n] = Infinity; });
    dist[src] = 0;
    steps.push({ kind: 'init', dist: cp(dist), prev: cp(prev), changed: [], round: 0 });
    for (var r = 1; r <= nodes.length; r++) {
      var nd = {}, np = {}, changed = [];
      nodes.forEach(function (n) { nd[n] = dist[n]; np[n] = prev[n]; });
      nodes.forEach(function (v) {
        adj[v].forEach(function (x) { // x.to advertises dist[x.to] to v
          if (dist[x.to] + x.w < nd[v]) { nd[v] = dist[x.to] + x.w; np[v] = x.to; }
        });
      });
      nodes.forEach(function (n) { if (nd[n] !== dist[n]) changed.push(n); });
      dist = nd; prev = np;
      steps.push({ kind: 'round', dist: cp(dist), prev: cp(prev), changed: changed, round: r });
      if (!changed.length) break;
    }
    return steps;
  };
  N.pathTo = function (prev, src, dst) {
    var p = [dst], c = dst, g = 0;
    while (c !== src && g++ < 100) { if (prev[c] === undefined) return null; c = prev[c]; p.unshift(c); }
    return p;
  };

  /* ---------- CSMA/CD with binary exponential backoff (802.3, 1-persistent) ---------- */
  N.csma = function (n, rng, F) {
    F = F || 24;
    var st = [], log = [], i, guard = 0;
    for (i = 0; i < n; i++) st.push({ id: i, T: 0, c: 0, done: false, dropped: false });
    while (st.some(function (s) { return !s.done; }) && guard++ < 800) {
      var act = st.filter(function (s) { return !s.done; });
      var T = Math.min.apply(null, act.map(function (s) { return s.T; }));
      var tx = act.filter(function (s) { return s.T === T; });
      if (tx.length === 1) {
        var w = tx[0]; w.done = true;
        log.push({ t: T, tx: [w.id], ok: true, len: F });
        var end = T + F;
        act.forEach(function (o) { if (o !== w && o.T < end) o.T = end; });
      } else {
        var picks = {};
        tx.forEach(function (s) {
          s.c++;
          if (s.c > 16) { s.done = true; s.dropped = true; picks[s.id] = -1; return; }
          var k = Math.floor(rng() * Math.pow(2, Math.min(s.c, 10)));
          picks[s.id] = k; s.T = T + 1 + k;
        });
        log.push({ t: T, tx: tx.map(function (s) { return s.id; }), ok: false, picks: picks, len: 1 });
      }
    }
    return { log: log, stations: st, total: log.length ? log[log.length - 1].t + (log[log.length - 1].len || 1) : 0 };
  };

  /* ---------- Diffie-Hellman toys ---------- */
  N.modPow = function (b, e, m) {
    var r = 1n; b %= m;
    while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; }
    return r;
  };
  // Baby-step giant-step: find x with g^x = h (mod p)
  N.bsgs = function (g, h, p) {
    var m = BigInt(Math.ceil(Math.sqrt(Number(p)))), tbl = new Map(), cur = 1n, j;
    for (j = 0n; j < m; j++) { if (!tbl.has(cur)) tbl.set(cur, j); cur = cur * g % p; }
    var inv = N.modPow(g, p - 1n - (m % (p - 1n)), p), gamma = h;
    for (var i = 0n; i < m; i++) {
      if (tbl.has(gamma)) return { x: i * m + tbl.get(gamma), steps: Number(m + i + 1n) };
      gamma = gamma * inv % p;
    }
    return null;
  };

  /* ---------- Wi-Fi 2.4 GHz channel overlap ---------- */
  N.chFreq = function (ch) { return ch === 14 ? 2484 : 2407 + 5 * ch; };
  N.chOverlap = function (a, b) { return Math.max(0, 1 - Math.abs(N.chFreq(a) - N.chFreq(b)) / 20); };
  N.bestChannel = function (neigh, chans) {
    var best = null;
    chans.forEach(function (c) {
      var cost = 0;
      neigh.forEach(function (n) { cost += n.w * N.chOverlap(c, n.ch); });
      if (best === null || cost < best.cost - 1e-9) best = { ch: c, cost: cost };
    });
    return best;
  };

  /* ---------- Fiber optics ---------- */
  N.fiber = function (n1, n2) {
    var NA = Math.sqrt(n1 * n1 - n2 * n2);
    return { NA: NA, accept: Math.asin(Math.min(1, NA)) * 180 / Math.PI, critical: Math.asin(n2 / n1) * 180 / Math.PI };
  };

  /* ---------- Formatting ---------- */
  N.hex = function (u8, s, e) {
    var a = []; s = s || 0; e = e === undefined ? u8.length : e;
    for (var i = s; i < e; i++) a.push(('0' + u8[i].toString(16)).slice(-2));
    return a;
  };
  N.fmtRate = function (bps) {
    if (bps >= 1e9) return (bps / 1e9).toFixed(2) + ' Gb/s';
    if (bps >= 1e6) return (bps / 1e6).toFixed(bps >= 1e8 ? 0 : 1) + ' Mb/s';
    if (bps >= 1e3) return (bps / 1e3).toFixed(1) + ' kb/s';
    return bps.toFixed(0) + ' b/s';
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = N;
  else root.PPNET = N;
})(typeof window !== 'undefined' ? window : globalThis);
