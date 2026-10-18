/* PIXEL PACKET — chapter 04 : ADDRESS (IPv4, subnets, VLSM, DHCP, NAT) */
(function () {
  'use strict';
  var N = PP.net, H = PP.h, HUE = 200;
  var NETC = 'hsl(200 90% 62%)', HOSTC = 'hsl(38 90% 62%)';

  PP.chapter({
    id: 'address', num: 4, short: 'ADDRESS', layerName: 'LAYER 3 · NETWORK', title: 'ADDRESS', hue: HUE,
    blurb: 'The 32-bit address, the mask that splits it, subnets, DHCP and NAT.',
    tagline: 'An IP address is not a name. It is a location, written so that a router can tell "which network" from "which machine" with one bitwise AND.',
    quiz: [
      { q: 'How many usable host addresses are in a /26 network?', a: ['64', '62', '30', '126'], c: 1,
        why: 'A /26 leaves 32 − 26 = 6 host bits: 2⁶ = 64 addresses. The first is the network address and the last is the broadcast, so <b>62</b> are usable.' },
      { q: 'Your computer shows an address starting 169.254. What most likely happened?', a: ['The ISP assigned you a premium address', 'DHCP did not answer, so the device gave itself a link-local address', 'You are connected to the internet through a VPN', 'Your router is broadcasting IPv6'], c: 1,
        why: '169.254.0.0/16 is the link-local range. Devices self-assign from it when no DHCP server answers. It is one of the most useful fault signs in networking.' },
      { q: 'Your router\'s WAN address is 100.64.12.9. Why can\'t you host a game server at home?', a: ['100.x addresses are blocked by browsers', 'It is a shared CGNAT address: your ISP translates again, so inbound connections cannot reach you', 'The firewall always blocks port 25565', 'IPv4 does not allow servers'], c: 1,
        why: '100.64.0.0/10 is reserved for carrier-grade NAT. You sit behind two translations and only the ISP controls the outer one. Options: IPv6, a tunnel or relay, or asking for a public address.' }
    ],
    build: function (body) {
      PP.prose(body,
        '<p>Every device on the internet needs an <b>IP address</b>. IPv4 addresses are 32 bits, written as four decimal bytes. That gives 2<sup>32</sup> = 4,294,967,296 addresses, and the world ran out of spare ones in 2011.</p>' +
        '<p>The address has two parts: a <b>network</b> part (shared by everything on the same network) and a <b>host</b> part (unique inside it). The <b>subnet mask</b>, or the CIDR prefix such as <code>/24</code>, says where the split is: the first 24 bits are network, the last 8 are host. Routers only ever look at the network part. That one trick is what lets the internet scale.</p>');

      // ---------- helix lab
      var ip = N.ip2int('192.168.1.37'), pf = 24;
      var lab = PP.lab(body, 'The 32-bit helix', 'Left strand: the 32 bits of the IP address. Right strand: the subnet mask (ones, then zeros). Where both are 1, the rung lights up. Those lit rungs <i>are</i> the network address: <code>network = IP AND mask</code>. Click an address node to flip it, a mask node to move the prefix, or use the controls. Drag to rotate.');
      var inp = H('input', { type: 'text', value: '192.168.1.37/24', spellcheck: 'false', style: { maxWidth: '260px' } });
      var slP = PP.slider('Prefix length', { min: 0, max: 32, value: 24, fmt: function (v) { return '/' + v; } }, function (v) { pf = v; upd(); });
      lab.appendChild(H('div', { class: 'row' }, H('div', { style: { flex: '1 1 240px' } }, H('label', { class: 'fld' }, 'ADDRESS / PREFIX'), inp), slP.el));
      var host = H('div', { style: { position: 'relative' } }); lab.appendChild(host);
      var cv = PP.canvas(host, { h: function (w) { return w < 560 ? 380 : 440; } });
      var bitsWrap = H('div', { class: 'bits', style: { margin: '8px 0 4px' } }); lab.appendChild(bitsWrap);
      var legend = H('div', { class: 'legend' }, H('span', null, H('i', { style: { background: NETC } }), 'network bits'), H('span', null, H('i', { style: { background: HOSTC } }), 'host bits')); lab.appendChild(legend);
      var stats = H('div', { class: 'stats' }); lab.appendChild(stats);
      var tnote = H('div', { class: 'ladder-note' }); lab.appendChild(tnote);
      function bitsOf(v) { return N.bits32(v).split('').map(Number); }
      function upd(fromInput) {
        var s = N.subnetInfo(ip, pf), bt = bitsOf(ip), ty = N.ipType(ip);
        if (!fromInput) inp.value = N.int2ip(ip) + '/' + pf;
        slP.set(pf); inp.style.borderColor = '';
        bitsWrap.innerHTML = '';
        bt.forEach(function (b, i) {
          if (i && i % 8 === 0) bitsWrap.appendChild(H('span', { class: 'gap' }));
          bitsWrap.appendChild(H('div', { class: 'bit' + (b ? ' on' : '') + (i < pf ? ' net' : ' host'), onclick: function () { ip = ((ip ^ (1 << (31 - i))) >>> 0); upd(); } }, b));
        });
        stats.innerHTML = '';
        [['ADDRESS', N.int2ip(ip), 'a', ''], ['MASK', N.int2ip(s.mask), '', '/' + pf + ' · wildcard ' + N.int2ip(s.wild)], ['NETWORK', N.int2ip(s.net), 'a', 'IP AND mask'], ['BROADCAST', N.int2ip(s.bc), '', 'network OR wildcard'],
        ['FIRST USABLE', N.int2ip(s.first), '', ''], ['LAST USABLE', N.int2ip(s.last), '', ''], ['USABLE HOSTS', PP.fmt(s.hosts), 'a', pf >= 31 ? (pf === 31 ? 'point-to-point (RFC 3021)' : 'a single host route') : '2^' + (32 - pf) + ' − 2'], ['ADDRESSES IN BLOCK', PP.fmt(s.size), '', 'incl. network + broadcast']].forEach(function (x) {
          stats.appendChild(H('div', { class: 'stat' }, H('span', { class: 'l' }, x[0]), H('span', { class: 'v ' + x[2] }, x[1]), H('span', { class: 's' }, x[3])));
        });
        tnote.innerHTML = '<b>' + ty.name + '</b> &nbsp;' + ty.note;
      }
      inp.addEventListener('input', function () { var r = N.parseCidr(inp.value); if (!r) { inp.style.borderColor = 'hsl(12 90% 64%)'; return; } ip = r.ip; pf = r.p; upd(true); });
      upd();
      var yawOff = 0, drag = false, lx = 0, moved = 0, nodesA = [], nodesB = [], cam = { yaw: 0, pitch: 0.1, f: 800, d: 0 }, hov = false;
      cv.c.style.touchAction = 'pan-y'; cv.c.style.cursor = 'grab';
      cv.c.addEventListener('pointerdown', function (e) { drag = true; lx = e.clientX; moved = 0; try { cv.c.setPointerCapture(e.pointerId); } catch (x) { } });
      cv.c.addEventListener('pointermove', function (e) { hov = true; if (!drag) return; var dx = e.clientX - lx; lx = e.clientX; moved += Math.abs(dx); yawOff += dx * 0.01; });
      cv.c.addEventListener('pointerleave', function () { hov = false; });
      cv.c.addEventListener('pointerup', function (e) {
        drag = false; if (moved > 5) return;
        var r = cv.c.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = null, bd = 18;
        nodesA.forEach(function (n, i) { var d = Math.hypot(n.x - x, n.y - y) - (n.z > 0 ? 6 : 0); if (d < bd) { bd = d; best = { k: 'a', i: i }; } });
        nodesB.forEach(function (n, i) { var d = Math.hypot(n.x - x, n.y - y) - (n.z > 0 ? 6 : 0); if (d < bd) { bd = d; best = { k: 'b', i: i }; } });
        if (!best) return;
        if (best.k === 'a') ip = ((ip ^ (1 << (31 - best.i))) >>> 0); else pf = (pf === best.i + 1) ? best.i : best.i + 1;
        upd();
      });
      PP.tick(host, function (t) {
        var g = cv.g, w = cv.w, h = cv.h, R = Math.min(w * 0.15, 86), cx = w * 0.4, gap = (h - 64) / 31, bt = bitsOf(ip), mk = bitsOf(N.maskOf(pf));
        if (!drag) yawOff += (PP.reduced ? 0.0 : (hov ? 0.12 : 0.5)) * 0.016;
        g.clearRect(0, 0, w, h);
        nodesA = []; nodesB = [];
        for (var i = 0; i < 32; i++) {
          var y = (i - 15.5) * gap, ang = i * 0.5 + yawOff * 1.0 + t * 0;
          nodesA.push(PP.proj(cam, R * Math.cos(ang), y, R * Math.sin(ang), cx, h / 2));
          nodesB.push(PP.proj(cam, R * Math.cos(ang + Math.PI), y, R * Math.sin(ang + Math.PI), cx, h / 2));
        }
        function strand(ns, col) {
          for (var i = 1; i < 32; i++) { var d = (ns[i].z / R + 1) / 2; g.strokeStyle = col.replace('A', String(0.65 - d * 0.5)); g.lineWidth = 1.6; g.beginPath(); g.moveTo(ns[i - 1].x, ns[i - 1].y); g.lineTo(ns[i].x, ns[i].y); g.stroke(); }
        }
        strand(nodesA, 'hsla(166,90%,62%,A)'); strand(nodesB, 'hsla(262,90%,72%,A)');
        for (var r = 0; r < 32; r++) {
          var both = bt[r] & mk[r], d2 = ((nodesA[r].z + nodesB[r].z) / 2 / R + 1) / 2;
          g.strokeStyle = both ? 'hsla(200,95%,70%,' + (0.95 - d2 * 0.5) + ')' : 'rgba(241,238,250,' + (0.1 - d2 * 0.05) + ')'; g.lineWidth = both ? 2.4 : 1;
          g.beginPath(); g.moveTo(nodesA[r].x, nodesA[r].y); g.lineTo(nodesB[r].x, nodesB[r].y); g.stroke();
        }
        var order = []; for (var k = 0; k < 32; k++) { order.push({ n: nodesA[k], i: k, a: 1 }); order.push({ n: nodesB[k], i: k, a: 0 }); }
        order.sort(function (p, q) { return q.n.z - p.n.z; });
        g.textAlign = 'center'; g.textBaseline = 'middle';
        order.forEach(function (o) {
          var n = o.n, rad = Math.max(3.5, 8.4 * n.s), dep = (n.z / R + 1) / 2, al = 1 - dep * 0.62, bit = o.a ? bt[o.i] : mk[o.i], col = o.a ? (o.i < pf ? 200 : 38) : (o.i < pf ? 262 : 330);
          g.beginPath(); g.arc(n.x, n.y, rad, 0, 7);
          if (bit) { g.fillStyle = PP.hsl(col, 90, 62, al); g.fill(); } else { g.fillStyle = PP.hsl(col, 60, 20, al * 0.6); g.fill(); g.strokeStyle = PP.hsl(col, 90, 62, al); g.lineWidth = 1.3; g.stroke(); }
          if (rad > 6) { g.fillStyle = bit ? '#04120e' : PP.hsl(col, 90, 75, al); g.font = '700 ' + Math.round(rad * 1.15) + 'px ui-monospace,Menlo,Consolas,monospace'; g.fillText(bit, n.x, n.y + 0.5); }
        });
        // labels and result column
        var rx = w * 0.8; g.textBaseline = 'alphabetic';
        g.font = '700 10.5px ui-monospace,Menlo,Consolas,monospace'; g.textAlign = 'center'; g.fillStyle = 'rgba(241,238,250,.5)'; g.fillText('IP', cx - R, 14); g.fillText('MASK', cx + R, 14); g.fillStyle = PP.hsl(200, 90, 70, 1); g.fillText('= NETWORK', rx, 14);
        g.textAlign = 'right'; g.fillStyle = 'rgba(241,238,250,.35)';
        for (var o = 0; o < 4; o++) { var yy = (o * 8 + 3.5 - 15.5) * gap + h / 2; g.fillText('octet ' + (o + 1), 62, yy + 4); }
        g.textAlign = 'center'; g.font = '600 ' + Math.max(8, Math.min(12, gap * 0.8)) + 'px ui-monospace,Menlo,Consolas,monospace';
        for (var q = 0; q < 32; q++) {
          var yq = (q - 15.5) * gap + h / 2 + 3, v = bt[q] & mk[q];
          g.fillStyle = v ? PP.hsl(200, 95, 72, 1) : 'rgba(241,238,250,.18)'; g.fillText(v, rx, yq);
          if (q % 8 === 7 && q < 31) { g.strokeStyle = 'rgba(241,238,250,.12)'; g.beginPath(); g.moveTo(rx - 14, yq + gap / 2 + 1); g.lineTo(rx + 14, yq + gap / 2 + 1); g.stroke(); }
        }
        g.textAlign = 'left'; g.fillStyle = 'rgba(241,238,250,.55)'; g.font = '11px ui-monospace,Menlo,Consolas,monospace';
        g.fillText(N.int2ip((ip & N.maskOf(pf)) >>> 0), rx - 40, h - 6);
      });
      PP.algo(body, {
        name: 'Network address = IP AND mask',
        idea: 'A router does not need to understand an address, only to ask: do the first P bits of this destination match the first P bits of that network? One AND answers it.',
        steps: ['Write the address and the mask as 32 bits each.', 'AND them: a bit stays only where <i>both</i> are 1. The result is the network address.', 'Broadcast = network OR (NOT mask): all host bits set to 1.', 'Usable hosts: 2<sup>(32−P)</sup> − 2 (minus the network and broadcast addresses). Two devices are on the same network if their (IP AND mask) are equal.'],
        code: 'same_network(a, b, mask):\n  return (a & mask) == (b & mask)\n\nnetwork   = ip & mask\nbroadcast = network | ~mask',
        cost: 'Constant time: one AND and one compare. This is the reason routing scales.'
      });

      // ---------- DHCP
      var labD = PP.lab(body, 'How a device gets its address (DHCP)', 'A phone joining Wi-Fi has no address, so it cannot be addressed and does not know who is in charge. It shouts to everyone on the link. The four-message exchange is called DORA. Step through it.');
      PP.ladder(labD, {
        actors: ['YOUR DEVICE (no IP yet)', 'DHCP SERVER (the router)'], ms: 1500,
        steps: [
          { from: 0, to: 1, label: 'DISCOVER', sub: 'src 0.0.0.0 → dst 255.255.255.255 (broadcast)', note: '<b>Discover.</b> The device has no address, so it uses 0.0.0.0 as source and broadcasts to everyone on the link: "is there a DHCP server?"' },
          { from: 1, to: 0, label: 'OFFER', sub: '192.168.1.37, mask /24, gateway .1, DNS, lease 24 h', note: '<b>Offer.</b> The server proposes an unused address from its pool, plus the settings the device needs: subnet mask, <b>default gateway</b> (the exit router), <b>DNS servers</b> and a lease time.' },
          { from: 0, to: 1, label: 'REQUEST', sub: '"I would like 192.168.1.37"', note: '<b>Request.</b> The device formally asks for that address. It is also broadcast, so that if several servers made offers, the others know theirs was declined.' },
          { from: 1, to: 0, label: 'ACK', sub: 'lease confirmed', note: '<b>Acknowledge.</b> The server records the lease. The device now configures its network interface and is ready to talk.' },
          { from: 0, to: 0, label: 'at 50% of lease: renew', note: '<b>Renewal.</b> At half the lease time the device quietly asks the same server to extend it. If nobody ever answers, a device gives itself a <b>169.254.x.x</b> address, which is how you can tell DHCP failed.' }
        ]
      });

      // ---------- VLSM
      var labV = PP.lab(body, 'Cut a network into the right-sized pieces (VLSM)', 'One block of addresses, several departments of different sizes. The planner uses the standard rule: sort largest first, give each the smallest block that fits (hosts + 2), and align every block to its own size.');
      var baseIn = H('input', { type: 'text', value: '192.168.10.0/24', spellcheck: 'false' }), needIn = H('input', { type: 'text', value: '60, 28, 10, 2', spellcheck: 'false' });
      labV.appendChild(H('div', { class: 'grid2' }, H('div', null, H('label', { class: 'fld' }, 'BLOCK TO SPLIT'), baseIn), H('div', null, H('label', { class: 'fld' }, 'HOSTS NEEDED PER SUBNET (comma separated)'), needIn)));
      var vbar = H('div', { class: 'bar', style: { height: '26px', margin: '12px 0 4px' } }), vtbl = H('div', { class: 'scroll-x' }), vnote = H('div');
      labV.appendChild(vbar); labV.appendChild(vnote); labV.appendChild(vtbl);
      function vlsm() {
        var b = N.parseCidr(baseIn.value), needs = needIn.value.split(/[ ,;]+/).filter(Boolean).map(Number);
        vnote.innerHTML = ''; vtbl.innerHTML = ''; vbar.innerHTML = '';
        if (!b || b.p < 8 || b.p > 30) { PP.callout(vnote, 'bad', 'Enter a block like 192.168.10.0/24 (prefix between /8 and /30).'); return; }
        if (!needs.length || needs.some(function (x) { return !(x >= 1) || x > 1e7; })) { PP.callout(vnote, 'bad', 'Enter whole numbers of hosts, e.g. 60, 28, 10, 2.'); return; }
        var r = N.vlsm(b.ip, b.p, needs), total = Math.pow(2, 32 - b.p);
        r.out.forEach(function (o, i) { vbar.appendChild(H('i', { style: { width: (o.size / total * 100) + '%', background: PP.hsl((i * 67 + 190) % 360, 85, 60, 0.9), borderRight: '1px solid #000' }, title: '/' + o.prefix })); });
        if (!r.ok) { PP.callout(vnote, 'bad', '<b>It does not fit.</b> After placing ' + r.out.length + ' subnet(s) there is no room for the ' + r.failed.need + '-host requirement. Use a bigger block (shorter prefix).'); }
        else PP.callout(vnote, '', '<b>' + PP.fmt(r.used) + ' of ' + PP.fmt(total) + ' addresses used</b> (' + (r.used / total * 100).toFixed(0) + '%). Free space left: ' + PP.fmt(total - r.used) + ' addresses, still in one contiguous block at the end for future growth.');
        var t = H('table', { class: 'table' }, H('tr', null, ['NEED', 'BLOCK', 'MASK', 'NETWORK', 'USABLE RANGE', 'BROADCAST', 'USABLE'].map(function (x) { return H('th', null, x); })));
        r.out.forEach(function (o, i) {
          var si = N.subnetInfo(o.net, o.prefix);
          t.appendChild(H('tr', null, H('td', null, o.need + ' hosts'), H('td', { style: { color: PP.hsl((i * 67 + 190) % 360, 85, 70, 1) } }, N.int2ip(o.net) + '/' + o.prefix), H('td', null, N.int2ip(si.mask)), H('td', null, N.int2ip(si.net)), H('td', null, N.int2ip(si.first) + ' – ' + N.int2ip(si.last)), H('td', null, N.int2ip(si.bc)), H('td', null, si.hosts)));
        });
        vtbl.appendChild(t);
      }
      baseIn.addEventListener('input', vlsm); needIn.addEventListener('input', vlsm); vlsm();
      PP.algo(body, {
        name: 'VLSM: variable-length subnet allocation',
        idea: 'Do not give every department the same size. Hand out the biggest blocks first, so smaller ones can fill the gaps without wasting addresses or breaking alignment.',
        steps: ['For each requirement n, find the smallest power of two ≥ n + 2: that block has prefix 32 − log₂(size).', 'Sort the requirements largest first.', 'Place each block at the next address that is a multiple of its own size (alignment keeps it a valid CIDR block).', 'If a block would run past the end of the parent network, the plan does not fit.'],
        code: 'cur = parent.network\nfor n in sorted(needs, reverse=True):\n  size = 2 ** ceil(log2(n + 2))\n  cur  = ceil(cur / size) * size      # align\n  if cur + size > parent.end: fail\n  allocate(cur, 32 - log2(size)); cur += size',
        cost: 'Used on every real network design. The example above runs the same function as the unit-tested engine.'
      });

      // ---------- NAT
      var labN = PP.lab(body, 'NAT: one public address, many devices', 'Private addresses (10/8, 172.16/12, 192.168/16) cannot be routed on the internet. Your router fixes that by rewriting the source of outgoing packets and keeping a table, so replies can be mapped back. Open connections, then try an unsolicited packet from outside.');
      var DEV = [{ n: 'PC 1', ip: '192.168.1.20' }, { n: 'PC 2', ip: '192.168.1.21' }, { n: 'PHONE', ip: '192.168.1.30' }], SRV = [{ n: 'WEB', ip: '192.0.2.7', port: 443 }, { n: 'CHAT', ip: '198.51.100.9', port: 443 }];
      var cg = PP.seg([{ v: 0, t: 'HOME ROUTER ONLY' }, { v: 1, t: 'PLUS ISP CGNAT' }], 0, function (v) { cgnat = v; wan(); natLog(v ? 'ISP now translates <i>again</i> (CGNAT). Your router\'s WAN address is a shared 100.64.x.x one.' : 'Back to one translation: your router owns a public address.'); });
      var pfCb = H('input', { type: 'checkbox' }), pfLab = H('label', { style: { font: '12px var(--mono)', color: 'var(--dim)', display: 'inline-flex', gap: '6px', alignItems: 'center', cursor: 'pointer' } }, pfCb, 'Port forward: outside port 8080 → PC 1 port 80');
      var btnRow = H('div', { class: 'row' });
      DEV.forEach(function (d, i) { btnRow.appendChild(PP.btn(d.n + ' → ' + (i === 2 ? 'CHAT' : 'WEB'), function () { openConn(i, i === 2 ? 1 : 0); }, 'sm')); });
      btnRow.appendChild(PP.btn('Unsolicited packet from the internet', function () { inbound(false); }, 'sm ghost'));
      btnRow.appendChild(PP.btn('Inbound to port 8080', function () { inbound(true); }, 'sm ghost'));
      labN.appendChild(H('div', { class: 'row' }, cg.el, pfLab)); labN.appendChild(btnRow);
      var nst = H('div', { style: { width: '100%', overflow: 'hidden' } }); labN.appendChild(nst);
      var ntb = H('div', { class: 'scroll-x' }), nlg = H('div', { class: 'log', style: { marginTop: '10px' } }), wanEl = H('div', { class: 'stat', style: { marginTop: '10px' } });
      labN.appendChild(H('div', { class: 'grid2', style: { marginTop: '10px' } }, H('div', null, H('label', { class: 'fld' }, 'NAT TABLE (inside the router)'), ntb), H('div', null, H('label', { class: 'fld' }, 'WHAT JUST HAPPENED'), nlg)));
      labN.appendChild(wanEl);
      var cgnat = 0, nat = [], nextPort = 40001 + Math.floor(Math.random() * 500), nsvg, nlayer, ngeo, nbusy = false, nW = 0, usedSrc = {};
      function natLog(s) { nlg.insertBefore(H('div', { html: s }), nlg.firstChild); while (nlg.children.length > 30) nlg.removeChild(nlg.lastChild); }
      function pubIp() { return cgnat ? '100.64.17.9' : '203.0.113.5'; }
      function wan() { wanEl.innerHTML = '<span class="l">ROUTER WAN ADDRESS</span><span class="v a">' + pubIp() + '</span><span class="s">' + N.ipType(N.ip2int(pubIp())).name + (cgnat ? ' — not reachable from the internet' : ' — reachable') + '</span>'; }
      function buildN() {
        var W = Math.max(300, nst.clientWidth || 600), Hh = 230; nW = W; nst.innerHTML = '';
        nsvg = PP.svg('svg', { width: W, height: Hh, viewBox: '0 0 ' + W + ' ' + Hh, class: 'sv' }); nst.appendChild(nsvg);
        var R = { x: W * 0.46, y: Hh / 2 }, L = DEV.map(function (d, i) { return { x: W * 0.1, y: Hh * (0.2 + i * 0.3) }; }), S = SRV.map(function (d, i) { return { x: W * 0.9, y: Hh * (0.3 + i * 0.4) }; });
        ngeo = { R: R, L: L, S: S, I: { x: W * 0.68, y: Hh / 2 } };
        L.forEach(function (p) { nsvg.appendChild(PP.svg('line', { x1: p.x, y1: p.y, x2: R.x, y2: R.y, stroke: 'rgba(241,238,250,.25)', 'stroke-width': 2 })); });
        S.forEach(function (p) { nsvg.appendChild(PP.svg('line', { x1: ngeo.I.x, y1: ngeo.I.y, x2: p.x, y2: p.y, stroke: 'rgba(241,238,250,.25)', 'stroke-width': 2 })); });
        nsvg.appendChild(PP.svg('line', { x1: R.x, y1: R.y, x2: ngeo.I.x, y2: ngeo.I.y, stroke: 'hsl(200 90% 62%)', 'stroke-width': 2.5 }));
        function box(p, a, b, c) { nsvg.appendChild(PP.svg('rect', { x: p.x - 38, y: p.y - 20, width: 76, height: 40, rx: 4, fill: 'rgba(0,0,0,.72)', stroke: c || 'rgba(241,238,250,.4)', 'stroke-width': 1.4 })); var t = PP.svg('text', { x: p.x, y: p.y - 3, fill: '#fff', 'font-size': 11.5, 'font-weight': 700, 'text-anchor': 'middle' }); t.textContent = a; nsvg.appendChild(t); var t2 = PP.svg('text', { x: p.x, y: p.y + 12, fill: 'rgba(241,238,250,.6)', 'font-size': 9.5, 'text-anchor': 'middle' }); t2.textContent = b; nsvg.appendChild(t2); }
        L.forEach(function (p, i) { box(p, DEV[i].n, DEV[i].ip, null); });
        S.forEach(function (p, i) { box(p, SRV[i].n, SRV[i].ip, null); });
        box(R, 'ROUTER', 'NAT + DHCP', 'hsl(166 90% 62%)'); box(ngeo.I, 'INTERNET', 'public routing', 'hsl(200 90% 62%)');
        nlayer = PP.svg('g'); nsvg.appendChild(nlayer);
      }
      function paintNat() {
        ntb.innerHTML = '';
        var t = H('table', { class: 'table' }, H('tr', null, H('th', null, 'INSIDE (private)'), H('th', null, 'OUTSIDE (public)'), H('th', null, 'TO')));
        if (pfCb.checked) t.appendChild(H('tr', null, H('td', null, '192.168.1.20:80'), H('td', null, pubIp() + ':8080'), H('td', null, 'static (port forward)')));
        nat.forEach(function (r) { t.appendChild(H('tr', null, H('td', null, r.inIp + ':' + r.inPort), H('td', null, pubIp() + ':' + r.outPort), H('td', null, r.dst))); });
        if (!nat.length && !pfCb.checked) t.appendChild(H('tr', null, H('td', { colspan: 3 }, 'empty: nothing has gone out yet')));
        ntb.appendChild(t);
      }
      async function openConn(di, si) {
        if (nbusy) return; nbusy = true;
        var d = DEV[di], s = SRV[si], inPort = 49152 + Math.floor(Math.random() * 16000), outPort = nextPort++;
        natLog('<b>' + d.n + '</b> sends from ' + d.ip + ':' + inPort + ' to ' + s.ip + ':' + s.port);
        await PP.travel(nlayer, ngeo.L[di], ngeo.R, d.ip.split('.')[3] + ':' + inPort, 'hsl(166 90% 62%)');
        nat.push({ inIp: d.ip, inPort: inPort, outPort: outPort, dst: s.n + ' ' + s.ip + ':' + s.port }); paintNat();
        natLog('router <b>rewrites the source</b> to ' + pubIp() + ':' + outPort + ' and records the pair in its table');
        await PP.travel(nlayer, ngeo.R, ngeo.I, pubIp().split('.').slice(2).join('.') + ':' + outPort, 'hsl(200 90% 62%)');
        await PP.travel(nlayer, ngeo.I, ngeo.S[si], pubIp().split('.').slice(2).join('.') + ':' + outPort, 'hsl(200 90% 62%)');
        natLog('server ' + s.n + ' sees a connection from <b>' + pubIp() + ':' + outPort + '</b>. It never learns ' + d.ip + '.');
        await PP.travel(nlayer, ngeo.S[si], ngeo.I, '→ :' + outPort, 'hsl(320 90% 68%)');
        await PP.travel(nlayer, ngeo.I, ngeo.R, '→ :' + outPort, 'hsl(320 90% 68%)');
        natLog('reply arrives for port ' + outPort + ': table lookup → <b>' + d.ip + ':' + inPort + '</b>. Router rewrites the destination and delivers.');
        await PP.travel(nlayer, ngeo.R, ngeo.L[di], d.ip.split('.')[3] + ':' + inPort, 'hsl(320 90% 68%)'); nbusy = false;
      }
      async function inbound(fwd) {
        if (nbusy) return; nbusy = true;
        var port = fwd ? 8080 : (nat.length ? nat[0].outPort + 7 : 40123);
        natLog('<b>Outside host</b> sends a packet to ' + pubIp() + ':' + port + ', unsolicited');
        await PP.travel(nlayer, ngeo.S[0], ngeo.I, '→ :' + port, 'hsl(12 90% 64%)');
        if (cgnat) { natLog('<b>Dropped by your ISP\'s NAT</b>: it has no mapping for this address either, and you cannot add one. This is why hosting is impossible behind CGNAT.'); nbusy = false; return; }
        await PP.travel(nlayer, ngeo.I, ngeo.R, '→ :' + port, 'hsl(12 90% 64%)');
        if (fwd && pfCb.checked) { natLog('router matches the <b>static port-forward</b>: 8080 → 192.168.1.20:80. Delivered.'); await PP.travel(nlayer, ngeo.R, ngeo.L[0], ':80', 'hsl(150 80% 55%)'); }
        else if (fwd) natLog('<b>Dropped</b>: port 8080 has no mapping. Tick the port-forward box to create one.');
        else natLog('<b>Dropped</b>: no table entry for port ' + port + '. A packet nobody asked for has nowhere to go. This accidental one-way door is why NAT also works as a basic firewall (it is not a real one).');
        nbusy = false;
      }
      pfCb.addEventListener('change', function () { paintNat(); natLog(pfCb.checked ? 'Port forward added: 8080 → PC 1:80' : 'Port forward removed.'); });
      buildN(); paintNat(); wan(); natLog('Click a device button to open a connection.');
      PP.tick(nst, function () { var w = nst.clientWidth; if (Math.abs(w - nW) > 10 && !nbusy) buildN(); });
      PP.algo(body, {
        name: 'NAT / PAT: translating addresses and ports',
        idea: 'Many private hosts share one public address by being told apart by port number. The router keeps the translation table, which is why replies find their way home.',
        steps: ['Outgoing packet: record (inside IP, inside port, destination) in the table; pick a free outside port.', 'Rewrite the source to (public IP, outside port). Recompute the IP and TCP checksums.', 'Incoming packet: look up the destination port in the table. Found: rewrite the destination back and forward it inside. Not found: drop.', 'Entries expire after a quiet period (minutes for UDP, hours for established TCP).'],
        cost: 'About 64,000 ports per public address bounds the number of simultaneous connections a single IP can carry.'
      });
      PP.deal(body, 'Address problems you will actually meet', [
        '<b>169.254.x.x on your PC:</b> DHCP did not answer. Reconnect, power-cycle the router (it clears the lease table), check the DHCP pool is not exhausted, or set a static address to test.',
        '<b>"Double NAT":</b> a router plugged behind another router. Games and port-forwards break. Put the first router in bridge/modem mode or use its DMZ/forward chain.',
        '<b>WAN address starts 100.64 to 100.127?</b> You are behind CGNAT. Ask the ISP for a public address, use IPv6, or use a relay or tunnel service.',
        '<b>VPN stops local printing or breaks sites:</b> your home subnet and the VPN\'s subnet overlap (both 192.168.1.0/24). Move one of them, for example your home to 192.168.77.0/24.',
        '<b>Two devices, same address:</b> a static address inside the DHCP pool. Keep static addresses outside the pool or use DHCP reservations.'
      ]);
    }
  });
})();
