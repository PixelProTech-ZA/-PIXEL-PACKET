/* PIXEL PACKET — chapter 00 : THE TRAIL (the whole journey, encapsulation) */
(function () {
  'use strict';
  var N = PP.net, H = PP.h;
  var STAGES = [
    { k: 'app', n: 'APPLICATION', s: 'HTTP', d: 'Your browser writes a plain-text request. At this point it is just bytes of data, with no idea how it will travel.' },
    { k: 'tcp', n: 'TRANSPORT', s: 'TCP', d: 'TCP adds a 20-byte header: source and destination <b>port</b> (which program), <b>sequence</b> numbers (which bytes), flags, window and a checksum. This is what makes delivery reliable.' },
    { k: 'net', n: 'NETWORK', s: 'IP', d: 'IP adds a 20-byte header: <b>source and destination address</b>, TTL, protocol number and a header checksum. Routers read this layer and nothing deeper.' },
    { k: 'link', n: 'LINK', s: 'ETHERNET', d: 'Ethernet adds a 14-byte header (<b>MAC addresses</b> for the next hop only) and a 4-byte <b>FCS</b> trailer: a CRC-32 that catches corruption. Short frames are padded to 64 bytes.' },
    { k: 'phy', n: 'PHYSICAL', s: 'BITS', d: 'The frame becomes electricity, light or radio. A preamble and start byte (8 B) go first, and a 12-byte quiet gap follows. These count against the wire, not against your data.' }
  ];
  var DEFAULT = 'GET /index.html HTTP/1.1\nHost: example.com\nAccept: */*\n\n';
  var SRC = N.ip2int('192.168.1.37'), DST = N.ip2int('192.0.2.7');

  PP.chapter({
    id: 'trail', num: 0, short: 'TRAIL', layerName: 'THE WHOLE JOURNEY', title: 'THE\nTRAIL', hue: 166,
    blurb: 'One packet, wrapped in five envelopes. The map for everything after.',
    tagline: 'Nothing "travels" as a web page. It is chopped into packets, wrapped in envelopes, and passed hand to hand. Here is one, taken apart byte by byte.',
    quiz: [
      { q: 'A TCP segment carries 1460 bytes of your data. How many bytes does it occupy on the Ethernet wire, counting preamble and the gap after it?', a: ['1460', '1500', '1518', '1538'], c: 3,
        why: '1460 data + 20 TCP + 20 IP = 1500 (the classic MTU). Add 14 Ethernet header + 4 FCS = 1518 (the frame). Add 8 preamble/start + 12 quiet gap = <b>1538</b> byte-times on the wire.' },
      { q: 'Between your laptop and a web server ten routers away, which header is rewritten at every hop?', a: ['The TCP header', 'The IP source and destination', 'The Ethernet (MAC) header', 'The HTTP request'], c: 2,
        why: 'MAC addresses only name the <i>next hop</i>, so each router builds a fresh Ethernet header. The IP addresses stay put (unless NAT rewrites them), only the TTL counts down.' },
      { q: 'You send a single byte of data. Roughly what fraction of the bytes on the wire is your data?', a: ['About 1%', 'About 25%', 'About 50%', 'About 90%'], c: 0,
        why: '1 byte of data is padded up to a 64-byte frame, and with preamble and gap it costs 84 byte-times: 1/84 is about <b>1.2%</b>. Headers are a fixed tax, which is why tiny packets are expensive.' }
    ],
    build: function (body) {
      PP.prose(body,
        '<p>Open a web page and nothing "travels" as a page. Your device chops the request into small pieces called <b>packets</b>, wraps each one in envelopes, and hands it to the nearest neighbour. That neighbour reads only the outermost envelope, decides who is next, and passes it on. Milliseconds later the pieces are reassembled on the other side.</p>' +
        '<p>Every rule hidden in that paragraph (how to wrap, how to address, who is next, what to do when a piece goes missing) is a <b>protocol</b>. Networking is the study of those agreements, stacked in layers so each can change without breaking the others. Textbooks teach seven OSI layers; the internet really runs the TCP/IP model. This course uses the five that map to real headers you can see in the lab below.</p>');
      var lg = H('div', { class: 'legend' });
      [['phy', 'Physical'], ['link', 'Link'], ['net', 'Network'], ['tcp', 'Transport'], ['app', 'Application']].forEach(function (x) {
        lg.appendChild(H('span', null, H('i', { style: { background: PP.lc(x[0]) } }), x[1]));
      });
      body.appendChild(H('div', { class: 'hint' }, 'One colour per layer. It follows the packet through the whole course.'));
      body.appendChild(lg);

      // ---- the map
      var map = H('div', { class: 'grid3', style: { margin: '14px 0 26px' } });
      PP.chapters.forEach(function (c) {
        if (c.id === 'trail') return;
        map.appendChild(H('a', { href: '#c-' + c.id, class: 'stat', style: { textDecoration: 'none', borderColor: 'hsl(' + c.hue + ' 90% 62% / .4)' } },
          H('span', { class: 'l', style: { color: 'hsl(' + c.hue + ' 90% 62%)' } }, c.num === 99 ? 'INDEX' : 'CHAPTER ' + String(c.num).padStart(2, '0')),
          H('span', { class: 'v', style: { fontSize: '15px' } }, c.title.replace('\n', ' ')),
          H('span', { class: 's' }, c.blurb || '')));
      });
      body.appendChild(map);

      // ---- LAB: wrap a packet
      var lab = PP.lab(body, 'Wrap a packet', 'Type anything below. The tower shows your data being wrapped layer by layer into a real Ethernet frame, drawn to byte scale, so you can see how much of the wire is your data and how much is envelope. Drag the scene to rotate it.');
      var ta = H('textarea', { rows: 3, spellcheck: 'false' }); ta.value = DEFAULT;
      var chips = H('div', { class: 'row' },
        H('span', { class: 'hint' }, 'TRY:'),
        PP.btn('1 byte', function () { ta.value = 'A'; upd(); }, 'sm ghost'),
        PP.btn('typical request', function () { ta.value = DEFAULT; upd(); }, 'sm ghost'),
        PP.btn('full segment (1460 B)', function () { ta.value = new Array(1461).join('x'); upd(); }, 'sm ghost'));
      lab.appendChild(H('label', { class: 'fld' }, 'YOUR DATA (the application payload)')); lab.appendChild(ta); lab.appendChild(chips);
      var host = H('div', { style: { position: 'relative', margin: '8px 0' } }); lab.appendChild(host);
      var cv = PP.canvas(host, { h: function (w) { return Math.round(Math.max(320, Math.min(600, w * 0.8))); } });
      var ptr = PP.ptr(cv.c);
      cv.c.style.touchAction = 'pan-y'; cv.c.style.cursor = 'grab';
      var stageSl = PP.slider('Stage', { min: 0, max: 4, step: 0.01, value: 0, fmt: function (v) { return STAGES[Math.min(4, Math.round(v))].n; } }, function (v) { playing = 0; s = v; });
      var ctl = H('div', { class: 'row' }, PP.btn('SEND ▼', function () { playing = 1; if (s >= 3.99) s = 0; }, 'sm'), PP.btn('RECEIVE ▲', function () { playing = -1; if (s <= 0.01) s = 4; }, 'sm ghost'), stageSl.el);
      lab.appendChild(ctl);
      var cap = H('div', { class: 'ladder-note' }); lab.appendChild(cap);
      var bar = H('div', { class: 'bar', style: { marginTop: '14px' } }); lab.appendChild(bar);
      var barLg = H('div', { class: 'legend' }); lab.appendChild(barLg);
      var stats = H('div', { class: 'stats' }); lab.appendChild(stats);

      // second lab: bytes
      var lab2 = PP.lab(body, 'Read the real bytes', 'This is exactly what the first lab built, as hex. The layer colours match. Checksums and the CRC are computed live from your data using the same algorithms real hardware uses. Hover a byte to see what it belongs to.');
      var hexEl = H('div', { class: 'hexdump' }); lab2.appendChild(hexEl);
      var legend2 = H('div', { class: 'legend' }); lab2.appendChild(legend2);
      var tblWrap = H('div', { class: 'scroll-x', style: { marginTop: '10px' } }); lab2.appendChild(tblWrap);

      var F = null, items = [], s = 0, playing = 0, yawDrag = 0, last = null;
      function toBytes() {
        var t = ta.value.replace(/\r?\n/g, '\r\n'), b = new TextEncoder().encode(t);
        if (b.length > 1460) b = b.subarray(0, 1460);
        return b;
      }
      function upd() {
        var pay = toBytes();
        F = N.buildFrame({ payload: pay, srcMac: [2, 0x70, 0x70, 0x74, 0, 1], dstMac: [2, 0x70, 0x70, 0x74, 0, 2], srcIp: SRC, dstIp: DST, sport: 51034, dport: 80, seq: 1000, ack: 2000, flags: 0x18, win: 64240, ipid: 4242 });
        items = {
          app: { k: 'app', name: 'HTTP data', b: Math.max(1, pay.length) }, tcp: { k: 'tcp', name: 'TCP', b: 20 }, ip: { k: 'net', name: 'IPv4', b: 20 },
          eth: { k: 'link', name: 'Ethernet', b: 14 }, pad: { k: 'pad', name: 'pad', b: F.padN }, fcs: { k: 'fcs', name: 'FCS', b: 4 }
        };
        // legend / stats
        var segs = [['Preamble+SFD', 'phy', 8], ['Ethernet hdr', 'link', 14], ['IPv4 hdr', 'net', 20], ['TCP hdr', 'tcp', 20], ['Your data', 'app', pay.length], ['Padding', 'pad', F.padN], ['FCS', 'fcs', 4], ['Gap', 'phy', 12]].filter(function (x) { return x[2] > 0; });
        var tot = F.wireLen;
        bar.innerHTML = ''; barLg.innerHTML = '';
        segs.forEach(function (x) {
          bar.appendChild(H('i', { style: { width: (x[2] / tot * 100) + '%', background: PP.lc(x[1], x[0] === 'Gap' || x[0] === 'Preamble+SFD' ? 0.45 : 0.95) }, title: x[0] + ' ' + x[2] + ' B' }));
          barLg.appendChild(H('span', null, H('i', { style: { background: PP.lc(x[1]) } }), x[0] + ' ' + x[2] + ' B'));
        });
        stats.innerHTML = '';
        [['YOUR DATA', pay.length + ' B', 'a', ta.value.length > 1460 ? 'cut to one segment (1460 B)' : 'what you typed'], ['FRAME', F.frameLen + ' B', '', 'Ethernet header to FCS'], ['ON THE WIRE', F.wireLen + ' B', '', 'with preamble + 12 B gap'], ['EFFICIENCY', (F.efficiency * 100).toFixed(1) + '%', 'a', 'your data / wire bytes']].forEach(function (x) {
          stats.appendChild(H('div', { class: 'stat' }, H('span', { class: 'l' }, x[0]), H('span', { class: 'v ' + x[2] }, x[1]), H('span', { class: 's' }, x[3])));
        });
        legend2.innerHTML = '';
        F.regions.forEach(function (r) { legend2.appendChild(H('span', null, H('i', { style: { background: PP.lc(r.layer) } }), r.name + ' · ' + (r.e - r.s) + ' B')); });
        // hex
        var colr = []; F.regions.forEach(function (r) { for (var i = r.s; i < r.e; i++) colr[i] = r; });
        hexEl.innerHTML = '';
        var n = F.bytes.length, showEnd = Math.min(n - 4, 54 + 28), i;
        for (i = 0; i < n; i++) {
          if (i === showEnd && n - 4 > showEnd) { hexEl.appendChild(H('span', { class: 'rg-pad' }, ' … ' + (n - 4 - showEnd) + ' more bytes … ')); i = n - 5; continue; }
          var r = colr[i];
          hexEl.appendChild(H('span', { class: 'rg-' + r.layer, title: r.name + ' (byte ' + i + ')' }, PP.hex2(F.bytes[i]) + ' '));
        }
        // table
        var dv = new DataView(F.bytes.buffer), u = F.bytes;
        function hx(a, b) { return N.hex(u, a, b).join(' '); }
        var rows = [
          ['link', 'Destination MAC', hx(0, 6), N.macStr(u, 0) + ' — the next hop, not the final server. The leading 02 marks a locally administered address.'],
          ['link', 'Source MAC', hx(6, 12), N.macStr(u, 6) + ' — your network card.'],
          ['link', 'EtherType', hx(12, 14), '0x0800 means the payload is IPv4.'],
          ['net', 'Version + header length', hx(14, 15), '4 = IPv4, 5 = five 32-bit words = 20-byte header.'],
          ['net', 'Total length', hx(16, 18), dv.getUint16(16) + ' bytes: IP header + TCP header + your data.'],
          ['net', 'Identification / flags', hx(18, 22), 'Flags 0x4000 = Don\'t Fragment: routers must not split it, they must report back if it is too big.'],
          ['net', 'TTL', hx(22, 23), u[22] + ' hops left. Every router subtracts 1; at 0 the packet dies. This is how traceroute works.'],
          ['net', 'Protocol', hx(23, 24), '6 = TCP (17 would be UDP, 1 ICMP).'],
          ['net', 'Header checksum', hx(24, 26), '0x' + F.ipCsum.toString(16).padStart(4, '0') + ' — Internet checksum of the 20 IP header bytes. Each router recomputes it after lowering TTL.'],
          ['net', 'Source IP', hx(26, 30), N.int2ip(dv.getUint32(26)) + ' (private address of your device)'],
          ['net', 'Destination IP', hx(30, 34), N.int2ip(dv.getUint32(30)) + ' (a documentation address standing in for a server)'],
          ['tcp', 'Source port', hx(34, 36), dv.getUint16(34) + ' — an ephemeral port your OS picked for this connection.'],
          ['tcp', 'Destination port', hx(36, 38), dv.getUint16(36) + ' — HTTP. 443 would be HTTPS.'],
          ['tcp', 'Sequence number', hx(38, 42), dv.getUint32(38) + ' — the byte-stream position of the first data byte here.'],
          ['tcp', 'Acknowledgement', hx(42, 46), dv.getUint32(42) + ' — "I have received everything before this byte."'],
          ['tcp', 'Flags', hx(47, 48), '0x' + u[47].toString(16) + ' = PSH + ACK: push this data up now, and the ACK field is valid.'],
          ['tcp', 'Window', hx(48, 50), dv.getUint16(48) + ' bytes the receiver is willing to buffer (flow control).'],
          ['tcp', 'Checksum', hx(50, 52), '0x' + F.tcpCsum.toString(16).padStart(4, '0') + ' — covers header, data and a pseudo-header of the IP addresses.'],
          ['fcs', 'FCS (CRC-32)', hx(n - 4, n), '0x' + F.crc.toString(16).padStart(8, '0') + ' — sent least-significant byte first. Computed over everything from the MAC addresses to the end of the data.']
        ];
        var tb = H('table', { class: 'table' }, H('tr', null, H('th', null, 'LAYER'), H('th', null, 'FIELD'), H('th', null, 'BYTES'), H('th', null, 'MEANING')));
        rows.forEach(function (r) { tb.appendChild(H('tr', null, H('td', { class: 'rg-' + r[0] }, r[0].toUpperCase()), H('td', null, r[1]), H('td', { class: 'rg-' + r[0] }, r[2]), H('td', null, r[3]))); });
        tblWrap.innerHTML = ''; tblWrap.appendChild(tb);
      }
      ta.addEventListener('input', upd); upd();

      // ---- 3D drawing
      var cam = { yaw: -0.5, pitch: 0.52, f: 900, d: 0 };
      function box(g, cx0, cy0, X, Y, Z, w, h, d, hue, al, lite) {
        var xs = [X - w / 2, X + w / 2], ys = [Y - h / 2, Y + h / 2], zs = [Z - d / 2, Z + d / 2], v = [];
        for (var i = 0; i < 8; i++) v.push(PP.proj(cam, xs[i & 1], ys[(i >> 1) & 1], zs[(i >> 2) & 1], cx0, cy0));
        var faces = [[[0, 1, 5, 4], 14], [[0, 1, 3, 2], 0], [[4, 5, 7, 6], -4], [[0, 2, 6, 4], -10], [[1, 3, 7, 5], -8]];
        faces.forEach(function (f) { f.z = (v[f[0][0]].z + v[f[0][1]].z + v[f[0][2]].z + v[f[0][3]].z) / 4; });
        faces.sort(function (a, b) { return b.z - a.z; });
        faces.forEach(function (f) {
          g.beginPath(); f[0].forEach(function (k, j) { if (j) g.lineTo(v[k].x, v[k].y); else g.moveTo(v[k].x, v[k].y); }); g.closePath();
          g.fillStyle = PP.hsl(hue, 80, lite + f[1], al); g.fill(); g.strokeStyle = PP.hsl(hue, 95, 80, al * 0.9); g.lineWidth = 1; g.stroke();
        });
        return v[0].z;
      }
      function layout(list, W) { // returns [{it, x0, w}] centred
        var tot = 0; list.forEach(function (it) { tot += it.b; });
        var k = W * 0.88 / Math.max(tot, 140), x = -tot * k / 2, out = [];
        list.forEach(function (it) { var w = Math.max(5, it.b * k); out.push({ it: it, x: x + w / 2, w: w }); x += it.b * k; });
        return { out: out, k: k, tot: tot };
      }
      function groupFor(st) {
        var I = items;
        if (st === 0) return [I.app];
        if (st === 1) return [I.tcp, I.app];
        if (st === 2) return [I.ip, I.tcp, I.app];
        var g = [I.eth, I.ip, I.tcp, I.app]; if (I.pad.b) g.push(I.pad); g.push(I.fcs); return g;
      }
      PP.tick(host, function (t, dt) {
        var g = cv.g, w = cv.w, h = cv.h;
        if (playing) { s += playing * dt * 0.5; if (s >= 4) { s = 4; playing = 0; } if (s <= 0) { s = 0; playing = 0; } stageSl.set(s); }
        if (ptr.down) { if (last !== null) yawDrag += (ptr.x - last) * 0.008; last = ptr.x; } else { last = null; yawDrag *= 0.97; }
        cam.yaw = -0.55 + Math.sin(t * 0.28) * 0.22 + yawDrag;
        g.clearRect(0, 0, w, h);
        var PW = Math.min(w * 0.84, 720), PD = PW * 0.3, GAP = PW * 0.118, cx0 = w / 2 + PW * 0.02, cy0 = h * 0.5;
        var ys = [0, 1, 2, 3, 4].map(function (i) { return (i - 2) * GAP; });
        // plates, lowest first
        for (var i = 4; i >= 0; i--) {
          var L = STAGES[i], c = [[-PW / 2, -PD / 2], [PW / 2, -PD / 2], [PW / 2, PD / 2], [-PW / 2, PD / 2]].map(function (p) { return PP.proj(cam, p[0], ys[i], p[1], cx0, cy0); });
          var on = Math.abs(s - i) < 0.6;
          g.beginPath(); c.forEach(function (q, j) { if (j) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); }); g.closePath();
          g.fillStyle = PP.lc(L.k, on ? 0.16 : 0.07, 50); g.fill(); g.strokeStyle = PP.lc(L.k, on ? 0.95 : 0.4); g.lineWidth = on ? 1.8 : 1; g.stroke();
          var lq = PP.proj(cam, -PW / 2, ys[i], PD / 2, cx0, cy0);
          g.font = '700 ' + Math.max(9, Math.round(PW / 62)) + 'px ui-monospace,Menlo,Consolas,monospace'; g.textAlign = 'left'; g.fillStyle = PP.lc(L.k, on ? 1 : 0.7, 70);
          g.fillText((i + 1) + ' ' + L.n, Math.max(6, lq.x - 4), lq.y + 14);
          g.textAlign = 'right'; g.fillStyle = PP.lc(L.k, 0.5, 70);
          var rq = PP.proj(cam, PW / 2, ys[i], PD / 2, cx0, cy0); g.fillText(L.s, Math.min(w - 6, rq.x + 4), rq.y + 14);
        }
        // slabs
        var st = Math.min(3, Math.floor(s)), f = s - st, e4 = PP.clamp((s - 3.55) / 0.45, 0, 1);
        var cur = layout(groupFor(st), PW), nxt = st < 3 ? layout(groupFor(st + 1), PW) : null, ops = [];
        var slabH = Math.max(10, PW * 0.034), slabD = PD * 0.62;
        var yGroup = PP.lerp(ys[st], ys[st + 1], f < 0.3 ? 0 : PP.easeIO((f - 0.3) / 0.7)) - slabH / 2 - 3;
        if (st === 3) yGroup = PP.lerp(ys[3], ys[4], PP.easeIO(PP.clamp((s - 3) / 0.6, 0, 1))) - slabH / 2 - 3;
        var ee = PP.ease(f < 0.5 ? f / 0.5 : 1);
        var label = '';
        if (st < 3) {
          nxt.out.forEach(function (n) {
            var prev = cur.out.filter(function (c) { return c.it === n.it; })[0], x, wd, al = 1;
            if (prev) { x = PP.lerp(prev.x, n.x, ee); wd = PP.lerp(prev.w, n.w, ee); } else { x = PP.lerp(-PW * 0.75, n.x, ee); wd = n.w; al = ee; }
            ops.push({ it: n.it, x: x, w: wd, al: al });
          });
          label = ['HTTP data', 'TCP segment', 'IP packet'][st + (f > 0.5 ? 1 : 0)] || '';
          label = ['HTTP data', 'TCP segment', 'IP packet', 'Ethernet frame'][st + (f > 0.5 ? 1 : 0)];
        } else {
          cur.out.forEach(function (c) { ops.push({ it: c.it, x: c.x, w: c.w, al: 1 - e4 }); });
          label = 'Ethernet frame';
        }
        ops.sort(function (a, b) { return a.x - b.x; });
        var gz = 0;
        if (e4 < 1) ops.forEach(function (o) { if (o.al > 0.02) box(g, cx0, cy0, o.x, yGroup, gz, o.w, slabH, slabD, PP.LAYER[o.it.k], Math.min(1, o.al), 52); });
        // bits on the wire
        if (e4 > 0) {
          var segs = [['phy', 8], ['link', 14], ['net', 20], ['tcp', 20], ['app', items.app.b], ['pad', F.padN], ['fcs', 4], ['phy', 12]].filter(function (x) { return x[1] > 0; }), BN = 110, tot = F.wireLen, cum = [], a = 0;
          segs.forEach(function (x) { a += x[1]; cum.push(a / tot); });
          var bw = PW * 0.9, y4 = ys[4] - 8, bits = [];
          for (var b = 0; b < BN; b++) {
            var u = (b / BN + t * 0.12) % 1, q = u * 1.0, si = 0; while (si < cum.length - 1 && (b / BN) > cum[si]) si++;
            bits.push({ x: (u - 0.5) * bw, si: si, b: b });
          }
          bits.forEach(function (o) {
            var bob = Math.sin(t * 3 + o.b) * 3, fade = Math.min(1, Math.min(o.x + bw / 2, bw / 2 - o.x) / 40);
            box(g, cx0, cy0, o.x, y4 + bob, (o.b % 3 - 1) * PD * 0.12, PW * 0.012, PW * 0.012, PW * 0.012, PP.LAYER[segs[o.si][0]], e4 * Math.max(0.1, fade), 58);
          });
          label = 'bits on the wire';
        }
        var cq = PP.proj(cam, 0, yGroup - slabH / 2, 0, cx0, cy0);
        g.textAlign = 'center'; g.font = '700 ' + Math.max(10, Math.round(PW / 56)) + 'px ui-monospace,Menlo,Consolas,monospace';
        var sizes = [items.app.b, items.app.b + 20, items.app.b + 40, F.frameLen, F.wireLen], si2 = Math.min(4, Math.round(s));
        g.fillStyle = '#fff'; g.fillText(label + ' · ' + sizes[si2] + ' B', cx0 + (cq.x - cx0) * 0.2, cq.y - 14);
        cap.innerHTML = '<b>' + STAGES[si2].n + '</b> &nbsp;' + STAGES[si2].d;
      });
    }
  });
})();
