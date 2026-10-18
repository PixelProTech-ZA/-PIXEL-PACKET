/* PIXEL PACKET — chapter 03 : LINK (frames, MAC, CRC, switches, backoff) */
(function () {
  'use strict';
  var N = PP.net, H = PP.h, HUE = 166;

  PP.chapter({
    id: 'link', num: 3, short: 'LINK', layerName: 'LAYER 2 · LINK', title: 'LINK', hue: HUE,
    blurb: 'Frames, MAC addresses, the CRC that catches damage, and the switch that learns.',
    tagline: 'The link layer moves a frame exactly one hop, to a neighbour on the same cable or the same Wi-Fi. It has its own addresses and its own way of catching damage.',
    quiz: [
      { q: 'A switch receives a frame for a MAC address it has never seen. What does it do?', a: ['Drops it', 'Floods it out every port except the one it arrived on', 'Sends it to the router', 'Asks DNS'], c: 1,
        why: 'Unknown unicast is flooded. When the owner replies, the switch learns which port that MAC lives on, and from then on forwards directly.' },
      { q: 'The receiver divides the arriving frame by the CRC generator and the remainder is not zero. What now?', a: ['It repairs the damaged bits', 'It silently discards the frame', 'It asks the sender for the exact bit that is wrong', 'It keeps the frame but marks it suspect'], c: 1,
        why: 'A CRC detects damage, it does not repair it. The frame is dropped and a higher layer (TCP) notices the gap and retransmits.' },
      { q: 'Why can a cable loop between two switch ports bring a whole network down within seconds?', a: ['Cable capacity is exceeded', 'Ethernet frames have no TTL, so broadcasts circle forever and multiply', 'The switch overheats', 'DHCP runs out of addresses'], c: 1,
        why: 'IP packets have a TTL that kills them eventually. Ethernet frames do not. Spanning Tree Protocol exists to switch off redundant paths and prevent this.' }
    ],
    build: function (body) {
      PP.prose(body,
        '<p>The link layer\'s job is small and exact: get a <b>frame</b> from one device to the next device on the <i>same</i> link, a cable or a Wi-Fi network. It uses <b>MAC addresses</b>, 48 bits burned into (or randomly assigned to) a network card. A MAC means "which card on this link", never "which computer in the world". That is the network layer\'s job, in chapter 4.</p>' +
        '<p>Two things make the link layer work: a way to <b>detect damage</b> (the CRC at the end of every frame) and a way for several devices to <b>share a medium</b> without talking over each other (a switch, or a random backoff rule when they collide).</p>');

      // ---- MAC reader
      var labM = PP.lab(body, 'Read a MAC address', 'Paste any MAC. Two bits in the first byte tell you what kind it is, and the first three bytes name the manufacturer (the OUI) when the address is the factory one.');
      var mi = H('input', { type: 'text', value: '02:70:70:74:00:01', spellcheck: 'false' }), mo = H('div', { class: 'stats' });
      labM.appendChild(mi); labM.appendChild(mo);
      function macRead() {
        var m = mi.value.trim().toLowerCase().replace(/[-.]/g, ':'), ok = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(m);
        mo.innerHTML = '';
        if (!ok) { mo.appendChild(H('div', { class: 'stat' }, H('span', { class: 'l' }, 'INPUT'), H('span', { class: 'v' }, 'Six hex pairs, e.g. 3c:22:fb:12:34:56'))); return; }
        var b0 = parseInt(m.slice(0, 2), 16), multi = !!(b0 & 1), local = !!(b0 & 2), bc = m === 'ff:ff:ff:ff:ff:ff';
        [['BIT 0 OF BYTE 1', bc ? 'broadcast' : multi ? 'multicast' : 'unicast', bc || multi ? '' : 'a', bc ? 'delivered to every device on the link' : multi ? 'group address' : 'one specific card'], ['BIT 1 OF BYTE 1', local ? 'locally administered' : 'universal (factory)', local ? '' : 'a', local ? 'set by software. Phones use random ones per Wi-Fi network for privacy.' : 'assigned by the manufacturer'], ['OUI (MANUFACTURER)', local ? 'not meaningful' : m.slice(0, 8), '', local ? 'a random or virtual address has no vendor' : 'look it up in the public IEEE registry']].forEach(function (x) {
          mo.appendChild(H('div', { class: 'stat' }, H('span', { class: 'l' }, x[0]), H('span', { class: 'v ' + x[2] }, x[1]), H('span', { class: 's' }, x[3])));
        });
      }
      mi.addEventListener('input', macRead); macRead();

      // ---- CRC lab
      var lab = PP.lab(body, 'The CRC: dividing a message by a polynomial', 'Every Ethernet frame ends with a 32-bit CRC. The idea is <i>division with no carries</i>: treat the bits as a polynomial and XOR the generator in wherever a leading 1 appears. What is left over is the check value. Here is the same arithmetic with a tiny generator you can follow by eye. Click message bits to change them.');
      var GENS = [{ v: '1011', t: 'CRC-3 · x³+x+1' }, { v: '100000111', t: 'CRC-8 · x⁸+x²+x+1' }];
      var msg = '11010011101100'.split('').map(Number), gen = GENS[0].v, shown = 99, res, code;
      var gSeg = PP.seg(GENS, gen, function (v) { gen = v; shown = 99; render(); });
      var bitsEl = H('div', { class: 'bits', style: { margin: '8px 0' } });
      lab.appendChild(H('div', { class: 'row' }, H('div', null, H('label', { class: 'fld' }, 'GENERATOR'), gSeg.el), PP.btn('Random message', function () { msg = msg.map(function () { return Math.random() < 0.5 ? 1 : 0; }); shown = 99; render(); }, 'sm ghost')));
      lab.appendChild(H('label', { class: 'fld' }, 'MESSAGE (click a bit to flip it)')); lab.appendChild(bitsEl);
      var crcPre = H('pre', { class: 'code', style: { fontSize: '14px', lineHeight: '1.5', overflowX: 'auto' } });
      lab.appendChild(crcPre);
      var ctl = H('div', { class: 'row' }, PP.btn('Next XOR step', function () { shown = Math.min(shown >= 99 ? 0 : shown, 99) + 1; paintCrc(); }, 'sm'), PP.btn('Show all', function () { shown = 99; paintCrc(); }, 'sm ghost'), PP.btn('Restart', function () { shown = 0; paintCrc(); }, 'sm ghost'));
      lab.appendChild(ctl);
      var cwEl = H('div', { class: 'bits', style: { margin: '10px 0 4px' } }), verdict = H('div', { class: 'ladder-note' });
      lab.appendChild(H('label', { class: 'fld', style: { marginTop: '14px' } }, 'TRANSMITTED = MESSAGE + CRC. CLICK ANY BIT TO DAMAGE IT IN TRANSIT.')); lab.appendChild(cwEl); lab.appendChild(verdict);
      var recv = [];
      function render() {
        bitsEl.innerHTML = '';
        msg.forEach(function (b, i) { bitsEl.appendChild(H('div', { class: 'bit' + (b ? ' on' : ''), onclick: function () { msg[i] ^= 1; shown = 99; render(); } }, b)); });
        res = N.crcDivision(msg.join(''), gen); code = res.codeword.split('').map(Number); recv = code.slice();
        paintCrc(); paintCw();
      }
      function paintCrc() {
        var xors = res.steps.filter(function (s) { return s.xor; }), n = Math.min(shown, xors.length), W = msg.length + res.r, L = [];
        var first = msg.join('') + '<span style="color:var(--phy)">' + new Array(res.r + 1).join('0') + '</span>';
        L.push('<span class="rg-app">' + first.replace(/^/, '') + '</span>  <span style="color:var(--faint)">← message, then ' + res.r + ' zeros appended</span>');
        for (var i = 0; i < n; i++) {
          var s = xors[i];
          L.push(new Array(s.shift + 1).join(' ') + '<span class="rg-tcp">' + gen + '</span>  <span style="color:var(--faint)">XOR (leading 1 at position ' + (s.shift + 1) + ')</span>');
          L.push('<span style="color:var(--faint)">' + s.after.slice(0, s.shift + 1) + '</span>' + s.after.slice(s.shift + 1));
        }
        if (n >= xors.length) {
          L.push(new Array(msg.length + 1).join(' ') + '<span class="rg-fcs">' + res.remainder + '</span>  <span style="color:var(--faint)">← remainder = the CRC</span>');
        } else L.push('<span style="color:var(--faint)">' + (xors.length - n) + ' more XOR step' + (xors.length - n > 1 ? 's' : '') + '…</span>');
        crcPre.innerHTML = L.join('\n');
      }
      function paintCw() {
        cwEl.innerHTML = '';
        recv.forEach(function (b, i) {
          var dmg = b !== code[i];
          cwEl.appendChild(H('div', { class: 'bit' + (b ? ' on' : ''), style: { outline: i >= msg.length ? '1px solid hsl(12 90% 64%)' : '', background: dmg ? 'hsl(12 90% 64%)' : '', color: dmg ? '#04120e' : '' }, onclick: function () { recv[i] ^= 1; paintCw(); } }, b));
        });
        var rr = N.crcDivision(recv.join(''), gen), clean = /^0*$/.test(rr.remainder), dm = recv.filter(function (b, i) { return b !== code[i]; }).length;
        verdict.innerHTML = '<b>RECEIVER</b> divides all ' + recv.length + ' bits by ' + gen + ': remainder <b style="color:' + (clean ? 'hsl(150 80% 60%)' : 'hsl(12 90% 64%)') + '">' + rr.remainder + '</b> → ' +
          (clean ? (dm ? '<b>damage not detected</b> (' + dm + ' bits flipped, but they happen to form a multiple of the generator; real CRC-32 makes this astronomically rare)' : 'frame accepted') : 'frame <b>corrupted</b>, discarded. TCP will notice the gap and ask again.');
      }
      render();
      var real = H('div', { class: 'callout truth', style: { marginTop: '14px' } });
      lab.appendChild(real);
      function realCrc() { var t = new TextEncoder().encode('PIXEL PACKET'); real.innerHTML = 'REAL ETHERNET: the 32-bit generator is 0x04C11DB7. CRC-32("PIXEL PACKET") = 0x' + N.crc32(t).toString(16).padStart(8, '0') + ', computed live by the same code that built the frame in chapter 0.'; }
      realCrc();
      PP.algo(body, {
        name: 'CRC: polynomial long division over bits',
        idea: 'Append zeros, then repeatedly XOR the generator under the leading 1. The leftover bits are the check value. Hardware does it with a small shift register in one pass over the data.',
        steps: ['Write the message bits, and append as many zeros as the CRC is long.', 'Find the leftmost 1. XOR the generator, aligned to it, into the bits (no carries: 1 XOR 1 = 0).', 'Repeat until no 1 remains in the message part. What is left in the final bits is the remainder.', 'Send message + remainder. The receiver runs the same division on everything: a zero remainder means no detected damage.'],
        code: 'crc(msg, G):\n  w = msg + zeros(len(G) - 1)\n  for i in 0 .. len(msg)-1:\n    if w[i] == 1:\n      w[i .. i+len(G)-1] ^= G\n  return last len(G)-1 bits of w',
        cost: 'CRC-32 detects every burst of up to 32 bits, every odd number of flipped bits (with the standard generator), and all but about 1 in 4.3 billion random corruptions.'
      });

      // ---- switch lab
      var lab2 = PP.lab(body, 'The learning switch', 'Four computers on a switch. Send a frame and watch the <b>MAC table</b> build itself: the switch notes which port each source address arrives on, and uses that to forward later frames to one port only. Swap it for a hub to see what switches replaced. (Table entries age out after 40 s here; real switches usually wait 300 s.)');
      var hosts = [{ id: 'A', mac: '02:00:00:00:00:0a', ip: '192.168.1.11' }, { id: 'B', mac: '02:00:00:00:00:0b', ip: '192.168.1.12' }, { id: 'C', mac: '02:00:00:00:00:0c', ip: '192.168.1.13' }, { id: 'D', mac: '02:00:00:00:00:0d', ip: '192.168.1.14' }];
      var selS = H('select'), selD = H('select');
      hosts.forEach(function (h, i) { selS.appendChild(H('option', { value: i }, 'Host ' + h.id)); selD.appendChild(H('option', { value: i, selected: i === 2 }, 'Host ' + h.id)); });
      var mode = PP.seg([{ v: 'sw', t: 'SWITCH' }, { v: 'hub', t: 'HUB' }], 'sw', function () { setLog('Mode: ' + (mode.get() === 'hub' ? 'HUB repeats every frame to every port.' : 'SWITCH forwards using the MAC table.')); });
      lab2.appendChild(H('div', { class: 'row' }, H('div', null, H('label', { class: 'fld' }, 'FROM'), selS), H('div', null, H('label', { class: 'fld' }, 'TO'), selD), H('div', null, H('label', { class: 'fld' }, 'DEVICE'), mode.el)));
      var sendB = PP.btn('Send frame', function () { send(+selS.value, +selD.value, false); }, 'sm');
      var arpB = PP.btn('ARP: "who has that IP?"', function () { arp(+selS.value, +selD.value); }, 'sm ghost');
      lab2.appendChild(H('div', { class: 'row' }, sendB, arpB, PP.btn('Clear table', function () { table = {}; paintTable(); setLog('MAC table cleared.'); }, 'sm ghost')));
      var stage = H('div', { style: { width: '100%', overflow: 'hidden' } }); lab2.appendChild(stage);
      var tbl = H('div', { class: 'scroll-x' }), logEl = H('div', { class: 'log', style: { marginTop: '10px' } });
      lab2.appendChild(H('div', { class: 'grid2', style: { marginTop: '10px' } }, H('div', null, H('label', { class: 'fld' }, 'MAC TABLE (CAM)'), tbl), H('div', null, H('label', { class: 'fld' }, 'WHAT JUST HAPPENED'), logEl)));
      var table = {}, svgEl, nodes = {}, tokens, busy = false, geom = null, lastW = 0;
      function setLog(s) { logEl.insertBefore(H('div', { html: s }), logEl.firstChild); while (logEl.children.length > 40) logEl.removeChild(logEl.lastChild); }
      function build() {
        var W = Math.max(300, stage.clientWidth || 640), Hh = W < 520 ? 260 : 290; lastW = W;
        var sw = { x: W / 2, y: Hh / 2 }, P = [{ x: W * 0.13, y: Hh * 0.2 }, { x: W * 0.87, y: Hh * 0.2 }, { x: W * 0.13, y: Hh * 0.8 }, { x: W * 0.87, y: Hh * 0.8 }];
        geom = { sw: sw, P: P };
        stage.innerHTML = ''; svgEl = PP.svg('svg', { width: W, height: Hh, viewBox: '0 0 ' + W + ' ' + Hh, class: 'sv' }); stage.appendChild(svgEl);
        P.forEach(function (p, i) {
          svgEl.appendChild(PP.svg('line', { x1: p.x, y1: p.y, x2: sw.x, y2: sw.y, stroke: 'rgba(241,238,250,.28)', 'stroke-width': 2 }));
          var dx = p.x - sw.x, dy = p.y - sw.y, d = Math.hypot(dx, dy), q = { x: sw.x + dx / d * 70, y: sw.y + dy / d * 70 };
          var t = PP.svg('text', { x: q.x, y: q.y + 4, fill: 'hsl(166 90% 62%)', 'font-size': 10.5, 'text-anchor': 'middle' }); t.textContent = 'p' + (i + 1); svgEl.appendChild(t);
        });
        var body_ = PP.svg('rect', { x: sw.x - 52, y: sw.y - 22, width: 104, height: 44, rx: 4, fill: 'rgba(0,0,0,.7)', stroke: 'hsl(166 90% 62%)', 'stroke-width': 1.5 }); svgEl.appendChild(body_);
        var swt = PP.svg('text', { x: sw.x, y: sw.y + 5, fill: '#fff', 'font-size': 13, 'font-weight': 700, 'text-anchor': 'middle' }); swt.textContent = mode.get() === 'hub' ? 'HUB' : 'SWITCH'; svgEl.appendChild(swt); nodes.swt = swt;
        hosts.forEach(function (h, i) {
          var p = P[i], g = PP.svg('g');
          var r = PP.svg('rect', { x: p.x - 46, y: p.y - 24, width: 92, height: 48, rx: 4, fill: 'rgba(0,0,0,.7)', stroke: 'rgba(241,238,250,.4)', 'stroke-width': 1.5 }); g.appendChild(r);
          var t1 = PP.svg('text', { x: p.x, y: p.y - 4, fill: '#fff', 'font-size': 15, 'font-weight': 700, 'text-anchor': 'middle' }); t1.textContent = h.id; g.appendChild(t1);
          var t2 = PP.svg('text', { x: p.x, y: p.y + 14, fill: 'rgba(241,238,250,.6)', 'font-size': 10, 'text-anchor': 'middle' }); t2.textContent = '…' + h.mac.slice(-5); g.appendChild(t2);
          svgEl.appendChild(g); nodes[i] = r;
        });
        tokens = PP.svg('g'); svgEl.appendChild(tokens);
      }
      function flash(i, cls) { var r = nodes[i]; if (!r) return; r.setAttribute('stroke', cls === 'ok' ? 'hsl(150 80% 60%)' : 'hsl(38 90% 62%)'); r.setAttribute('fill', cls === 'ok' ? 'hsla(150,80%,55%,.22)' : 'hsla(38,90%,62%,.14)'); setTimeout(function () { r.setAttribute('stroke', 'rgba(241,238,250,.4)'); r.setAttribute('fill', 'rgba(0,0,0,.7)'); }, 700); }
      function travel(a, b, label, color) {
        return new Promise(function (res) {
          var g = PP.svg('g'), r = PP.svg('rect', { width: Math.max(26, label.length * 7 + 10), height: 18, rx: 3, fill: color }), t = PP.svg('text', { 'font-size': 10.5, 'font-weight': 700, fill: '#04120e', 'text-anchor': 'middle' }); t.textContent = label; g.appendChild(r); g.appendChild(t); tokens.appendChild(g);
          var w = +r.getAttribute('width'), t0 = performance.now(), dur = PP.reduced ? 10 : 650;
          (function mv(now) { var p = Math.min(1, (now - t0) / dur), e = PP.easeIO(p), x = PP.lerp(a.x, b.x, e), y = PP.lerp(a.y, b.y, e); r.setAttribute('x', x - w / 2); r.setAttribute('y', y - 9); t.setAttribute('x', x); t.setAttribute('y', y + 4); if (p < 1) requestAnimationFrame(mv); else { g.remove(); res(); } })(t0);
        });
      }
      function paintTable() {
        var now = performance.now(), rows = Object.keys(table).map(function (m) { return [m, table[m]]; });
        tbl.innerHTML = '';
        var t = H('table', { class: 'table' }, H('tr', null, H('th', null, 'MAC'), H('th', null, 'PORT'), H('th', null, 'AGE')));
        if (!rows.length) t.appendChild(H('tr', null, H('td', { colspan: 3 }, 'empty: the switch knows nothing yet')));
        rows.forEach(function (r) { t.appendChild(H('tr', { class: now - r[1].t < 900 ? 'win' : '' }, H('td', null, r[0]), H('td', null, 'p' + (r[1].port + 1) + ' (host ' + hosts[r[1].port].id + ')'), H('td', null, Math.round((now - r[1].t) / 1000) + ' s'))); });
        tbl.appendChild(t);
      }
      var lastP = 0;
      PP.tick(stage, function (t) {
        var now = performance.now(), ch = false;
        Object.keys(table).forEach(function (m) { if (now - table[m].t > 40000) { delete table[m]; ch = true; setLog('<b>aged out</b> ' + m); } });
        if (ch || now - lastP > 1000) { lastP = now; paintTable(); }
        var w = stage.clientWidth; if (Math.abs(w - lastW) > 10 && !busy) build();
      });
      async function deliver(src, dst, bcast, dstMac, label, color) {
        var hub = mode.get() === 'hub', ingress = src, outs = [], why = '';
        await travel(geom.P[src], geom.sw, label, color);
        if (!hub) { var known = table[hosts[src].mac], moved = known && known.port !== src; table[hosts[src].mac] = { port: src, t: performance.now() }; setLog('switch <b>learns</b> ' + hosts[src].mac + ' is on port p' + (src + 1) + (moved ? ' (it moved!)' : known ? ' (refresh)' : '')); paintTable(); }
        if (hub) { outs = [0, 1, 2, 3].filter(function (i) { return i !== src; }); why = 'HUB: electrically repeats the frame to <b>every</b> other port. Everyone can read it, including hosts it was not meant for.'; }
        else if (bcast) { outs = [0, 1, 2, 3].filter(function (i) { return i !== src; }); why = 'destination is the broadcast address: <b>flood</b> to all ports except p' + (src + 1) + '.'; }
        else if (table[dstMac] && table[dstMac].port !== src) { outs = [table[dstMac].port]; why = 'destination ' + dstMac + ' is in the table: forward to <b>port p' + (outs[0] + 1) + ' only</b>. Other hosts see nothing.'; }
        else if (table[dstMac]) { outs = []; why = 'destination is on the same port it came from: <b>filter</b> (drop).'; }
        else { outs = [0, 1, 2, 3].filter(function (i) { return i !== src; }); why = 'destination ' + dstMac + ' is <b>unknown</b>: flood to all ports except p' + (src + 1) + '. (Whoever owns it will answer, and the switch learns it.)'; }
        setLog(why);
        await Promise.all(outs.map(function (o) { return travel(geom.sw, geom.P[o], label, outs.length > 1 ? 'hsl(38 90% 62%)' : color).then(function () { var mine = bcast || o === dst; flash(o, mine ? 'ok' : 'no'); if (!mine) setLog('host ' + hosts[o].id + ' got a copy, MAC is not its own: <b>ignores</b> it' + (hub ? ' (but could have sniffed it)' : '')); else setLog('host ' + hosts[o].id + ' <b>accepts</b> the frame'); }); }));
      }
      async function send(s, d) {
        if (busy) return; if (s === d) { setLog('Pick two different hosts.'); return; }
        busy = true; setLog('<b>Host ' + hosts[s].id + ' → Host ' + hosts[d].id + '</b>: frame dst=' + hosts[d].mac);
        await deliver(s, d, false, hosts[d].mac, '→' + hosts[d].id, 'hsl(166 90% 62%)'); busy = false;
      }
      async function arp(s, d) {
        if (busy) return; if (s === d) { setLog('Pick two different hosts.'); return; }
        busy = true; setLog('<b>ARP</b>: host ' + hosts[s].id + ' knows ' + hosts[d].ip + ' but not its MAC, so it asks <i>everyone</i> (dst ff:ff:ff:ff:ff:ff): "who has ' + hosts[d].ip + '?"');
        await deliver(s, d, true, 'ff:ff:ff:ff:ff:ff', 'who has .' + hosts[d].ip.split('.')[3] + '?', 'hsl(320 90% 68%)');
        setLog('host ' + hosts[d].id + ' answers <i>unicast</i> to ' + hosts[s].mac + ': "' + hosts[d].ip + ' is at ' + hosts[d].mac + '"');
        await deliver(d, s, false, hosts[s].mac, 'is at ' + hosts[d].mac.slice(-5), 'hsl(166 90% 62%)');
        setLog('host ' + hosts[s].id + ' stores that in its <b>ARP cache</b>. Now it can address frames to ' + hosts[d].id + ' directly.'); busy = false;
      }
      mode.el.addEventListener('click', function () { if (nodes.swt) nodes.swt.textContent = mode.get() === 'hub' ? 'HUB' : 'SWITCH'; });
      build(); paintTable(); setLog('Ready. Send a frame from A to C and watch the table.');
      PP.algo(body, {
        name: 'Switch learning and forwarding',
        idea: 'A switch has no configuration for who is where. It learns by watching: the source address of every frame tells it which port that device sits behind.',
        steps: ['A frame arrives on port P with source MAC S. <b>Learn:</b> table[S] = P (and note the time).', 'Look at the destination MAC D. If D is broadcast or multicast: <b>flood</b> to every port except P.', 'If table has D: forward out that one port (or drop it if it is the arrival port).', 'If D is unknown: <b>flood</b> to every port except P. The reply will teach the switch where D is.', 'Entries unused for about 5 minutes are removed, so moved devices are relearned.'],
        code: 'on frame(f, in_port):\n  table[f.src] = (in_port, now)\n  if f.dst is broadcast or f.dst not in table:\n      send f out every port except in_port\n  elif table[f.dst].port != in_port:\n      send f out table[f.dst].port',
        cost: 'Lookup is one hash or CAM access per frame, done in hardware at line rate. Tables hold from a few thousand to hundreds of thousands of MACs.'
      });

      // ---- CSMA/CD
      var lab3 = PP.lab(body, 'Collision: the random-wait rule', 'On a shared cable (a hub, or early coax Ethernet) two stations can talk at once. That is a <b>collision</b>. The rule from 1973: each station that collided waits a random number of slots, picked from a range that <i>doubles</i> after every collision (binary exponential backoff). Run it and see who wins.');
      var slSt = PP.slider('Stations transmitting at once', { min: 2, max: 8, value: 4, fmt: function (v) { return v + ' stations'; } }, null), seed2 = 5;
      lab3.appendChild(H('div', { class: 'row' }, slSt.el, PP.btn('Run contention', function () { seed2 = (seed2 * 31 + 17) % 99991; runCsma(); }, 'sm'), PP.btn('Same stations, new luck', function () { seed2 = (seed2 * 53 + 7) % 99991; runCsma(); }, 'sm ghost')));
      var ch = H('div'); lab3.appendChild(ch);
      var cc = PP.canvas(ch, { h: function (w) { return 40 + slSt.get() * 28 + 24; } });
      var cLog = H('div', { class: 'log', style: { marginTop: '10px' } }); lab3.appendChild(cLog);
      var csm = null;
      slSt.input.addEventListener('input', function () { cc.fit(); runCsma(); });
      function runCsma() {
        var n = slSt.get(); csm = N.csma(n, N.rng(seed2), 24); cLog.innerHTML = '';
        csm.log.forEach(function (e, i) {
          var who = e.tx.map(function (x) { return String.fromCharCode(65 + x); }).join(' + ');
          cLog.appendChild(H('div', { html: 'slot <b>' + e.t + '</b> · ' + who + ' transmit → ' + (e.ok ? '<b style="color:hsl(150 80% 60%)">success</b> (frame takes 24 slots)' : '<b style="color:hsl(12 90% 64%)">COLLISION</b>, backoff: ' + e.tx.map(function (x) { return String.fromCharCode(65 + x) + ' waits ' + (e.picks[x] < 0 ? 'gives up' : e.picks[x] + ' slot' + (e.picks[x] === 1 ? '' : 's')); }).join(', ')) }));
        });
        var coll = csm.log.filter(function (e) { return !e.ok; }).length;
        cLog.appendChild(H('div', { html: '<b>' + coll + ' collision' + (coll === 1 ? '' : 's') + '</b> before all ' + n + ' stations got through, ' + csm.total + ' slots in total (a slot is 512 bit-times, 51.2 µs at 10 Mb/s).' }));
      }
      PP.tick(ch, function (t) {
        if (!csm) return;
        var g = cc.g, w = cc.w, h = cc.h, n = slSt.get(), total = Math.max(60, csm.total + 6), left = 34, sc = (w - left - 8) / total, lane = 28, top = 14;
        g.clearRect(0, 0, w, h); g.font = '700 11px ui-monospace,Menlo,Consolas,monospace'; g.textAlign = 'left';
        for (var i = 0; i < n; i++) { g.fillStyle = 'rgba(241,238,250,.6)'; g.fillText('STA ' + String.fromCharCode(65 + i), 0, top + i * lane + 15); g.strokeStyle = 'rgba(241,238,250,.1)'; g.beginPath(); g.moveTo(left, top + i * lane + 20); g.lineTo(w, top + i * lane + 20); g.stroke(); }
        var prog = PP.reduced ? 9e9 : (t * 40) % (total + 30);
        csm.log.forEach(function (e) {
          if (e.t > prog) return;
          e.tx.forEach(function (id) {
            var x = left + e.t * sc, y = top + id * lane + 3, ww = Math.max(3, Math.min(e.len, prog - e.t) * sc);
            g.fillStyle = e.ok ? 'hsla(150,80%,55%,.8)' : 'hsla(12,90%,64%,.9)'; g.fillRect(x, y, ww, 18);
            if (!e.ok && e.picks[id] >= 0) { g.strokeStyle = 'hsla(38,90%,62%,.9)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x + sc, y + 9); g.lineTo(x + sc + e.picks[id] * sc, y + 9); g.stroke(); g.setLineDash([]); g.fillStyle = 'hsl(38 90% 70%)'; g.font = '10px ui-monospace,Menlo,Consolas,monospace'; g.fillText('wait ' + e.picks[id], x + sc + 2, y + 6); g.font = '700 11px ui-monospace,Menlo,Consolas,monospace'; }
          });
        });
        g.fillStyle = 'rgba(241,238,250,.4)'; g.font = '10px ui-monospace,Menlo,Consolas,monospace'; g.fillText('time (slots) →     red = collision    green = frame sent    dashed = random wait', left, h - 6);
      });
      runCsma();
      PP.algo(body, {
        name: 'Binary exponential backoff (CSMA/CD)',
        idea: 'When you collide, the best guess is that others did too. Spread your retry over a wider and wider window until the stations stop picking the same slot.',
        steps: ['Listen first. If the medium is quiet, transmit (CSMA: carrier sense, multiple access).', 'While transmitting, keep listening. If you hear a collision (CD), stop and send a short jam signal so everyone notices.', 'After the c-th collision, pick a random integer K from 0 to 2<sup>min(c,10)</sup> − 1 and wait K slots.', 'Try again. After 16 failed attempts, give up and report an error to the layer above.'],
        code: 'c = 0\nloop:\n  wait until medium idle; transmit\n  if no collision: done\n  c += 1\n  if c > 16: fail\n  K = random(0, 2^min(c,10) - 1)\n  wait K * slot_time',
        cost: 'Two stations succeed in 1 try with probability 50% after the first collision, 75% after the second, and so on: the window keeps doubling.'
      });
      PP.callout(body, 'warn', '<b>Modern reality check.</b> Switched, full-duplex Ethernet has <b>no collisions at all</b>: every cable is a private two-way link, so CSMA/CD is only live on hubs and legacy gear. <b>Wi-Fi</b> still shares the air and uses the cousin rule CSMA/<b>CA</b>: random backoff <i>before</i> sending, plus an acknowledgement, because a radio cannot hear a collision while it is transmitting.');
      PP.deal(body, 'Link-layer faults and how to spot them', [
        '<b>Everything blinks and the whole network crawls.</b> Suspect a <b>loop</b> (a cable between two ports of the same switch). Frames have no TTL, so broadcasts circle and multiply. Unplug the last cable you added. Managed switches use Spanning Tree to prevent it.',
        '<b>Intermittent connection, "random" disconnects.</b> Two devices with the same IP fight over one ARP entry, or a duplicate MAC exists. Check <code>arp -a</code> for the gateway: if its MAC changes, someone is answering for it.',
        '<b>Link negotiates 100 Mb/s instead of 1 Gb/s.</b> A damaged pair or cheap cable. Replace the cable before you blame the router.',
        '<b>Heavy Wi-Fi congestion.</b> Every device on a channel shares one set of airtime slots. Wire the big ones (consoles, TVs, desktops) and give the radio back to phones.',
        '<b>Port security / ARP inspection</b> on managed switches defends against devices pretending to be someone else\'s MAC.'
      ]);
    }
  });
})();
