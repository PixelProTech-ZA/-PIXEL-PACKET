/* PIXEL PACKET — chapter 01 : ORIGIN */
(function () {
  'use strict';
  var N = PP.net, H = PP.h;
  var EVENTS = [
    { y: '1964', t: 'Packets are born', c: 'Paul Baran at RAND (USA) and Donald Davies at NPL (UK) independently propose chopping messages into small blocks that find their own way. Davies gives them the name "packet".', i: 'A network with no single path to break. Everything in this course is built from packets.' },
    { y: '1969', t: 'ARPANET speaks', c: 'On 29 October a UCLA machine tries to log in to one at SRI. The letters "LO" arrive before the system crashes. By December four sites are linked: UCLA, SRI, UC Santa Barbara and Utah.', i: 'The first working packet-switched network, funded to share scarce computers.' },
    { y: '1973', t: 'Ethernet', c: 'Bob Metcalfe\'s memo at Xerox PARC (22 May) sketches a shared cable where colliding stations wait a random time and retry. The idea is borrowed from ALOHAnet, a radio network in Hawaii.', i: 'Chapter 03 rebuilds that random-backoff rule so you can watch it work.' },
    { y: '1974', t: 'TCP described', c: 'Vint Cerf and Bob Kahn publish "A Protocol for Packet Network Intercommunication": one reliable layer that can sit on top of many different networks. "Internet" is short for internetworking.', i: 'Chapter 06 shows the machinery of reliability: sequence numbers, ACKs, windows.' },
    { y: '1983', t: 'Flag day', c: 'On 1 January the ARPANET switches from its old NCP protocol to TCP/IP. The same year DNS is designed so that names replace a hand-edited HOSTS.TXT file.', i: 'Chapters 04 to 07: addresses, routing, transport and names all date from here.' },
    { y: '1991', t: 'The Web opens', c: 'Tim Berners-Lee proposed a linked information system at CERN in 1989, ran the first server in 1990, and the Web opened to the public in 1991.', i: 'The Web is one application riding on the internet. It is not the internet.' },
    { y: '1991', t: 'South Africa connects', c: 'On 12 November, Mike Lawrie at Rhodes University links the university computer centre to the home of Randy Bush in Oregon, USA: the country\'s first IP connection.', i: 'Every South African packet traces back to a link like that one.' },
    { y: '1993', t: 'CIDR saves the table', c: 'Classless Inter-Domain Routing (RFC 1519) lets address blocks be any size instead of fixed class A, B or C, slowing address waste and routing-table growth.', i: 'Chapters 04 and 05 use CIDR in every lab.' },
    { y: '1995', t: 'Backbone goes commercial', c: 'The NSFNET backbone is shut down in April and the internet becomes a mesh of commercial networks that agree to interconnect, using BGP.', i: 'Chapter 05: the "network of networks" is a set of business agreements.' },
    { y: '1999', t: 'Wi-Fi', c: 'IEEE 802.11b arrives and the Wi-Fi name is born. Radio replaces cable for the last few metres, with CSMA/CA because a radio cannot listen while it talks.', i: 'Chapters 02, 03 and 09 (channel choice).' },
    { y: '2009', t: 'SEACOM lights up', c: 'A submarine cable down Africa\'s east coast goes live in mid-2009, bringing a large step up in capacity to South Africa and to the countries along the route.', i: 'Chapter 02: why fibre, and what distance does to latency.' },
    { y: '2011', t: 'IPv4 runs dry', c: 'IANA hands out its last blocks of IPv4 addresses in early 2011 and regional registries follow. NAT stretches the supply. IPv6 is the long-term answer.', i: 'Chapter 04: the 32-bit helix and why NAT exists.' },
    { y: '2021', t: 'QUIC', c: 'QUIC (RFC 9000) rebuilds reliable, encrypted transport on top of UDP, and HTTP/3 (RFC 9114, 2022) rides on it. Some lessons of TCP are being learned a second time.', i: 'Chapters 06 and 08.' },
    { y: '2022', t: 'Equiano lands', c: 'Google\'s Equiano cable reaches Melkbosstrand, north of Cape Town, in August 2022, linked to Sesimbra in Portugal. Fibre is the physical internet; this is where it meets South Africa.', i: 'Chapter 02 puts a fibre in front of you.' }
  ];

  PP.chapter({
    id: 'origin', num: 1, short: 'ORIGIN', layerName: 'WHERE IT COMES FROM', title: 'ORIGIN', hue: 46,
    blurb: 'Packet switching, ARPANET, and why sharing beat reserving.',
    tagline: 'The internet was not designed in one go. It is a pile of ideas, each one fixing a failure of the last. Start with the big one: why we send packets at all.',
    quiz: [
      { q: 'Why did packet switching beat circuit switching for computer data?', a: ['Packets are smaller, so they travel faster', 'Data is bursty, so sharing a link lets many users use capacity a reserved circuit would leave idle', 'Circuits cannot carry digital data', 'Packets can never be lost'], c: 1,
        why: 'A phone call needs a steady stream. Computers send in bursts with long silences. A reserved circuit sits idle in the silences, shared packets fill them. The price: packets can queue or be dropped.' },
      { q: 'What happened at Rhodes University on 12 November 1991?', a: ['South Africa\'s first IP connection to the internet was made', 'The SEACOM cable came ashore', 'The .za domain was abolished', 'The first South African website went live'], c: 0,
        why: 'Mike Lawrie connected the university\'s computer centre to the home of Randy Bush in Oregon: the first IP link for the country.' },
      { q: 'What did the 1 January 1983 "flag day" change?', a: ['The Web was invented', 'ARPANET switched from NCP to TCP/IP', 'IPv6 was switched on', 'Ethernet became a standard'], c: 1,
        why: 'Every host had to switch protocols on the same day. TCP/IP has been the common language ever since.' }
    ],
    build: function (body) {
      PP.prose(body,
        '<p>Before the internet, a long-distance connection meant a <b>circuit</b>: the phone company physically reserved a path, end to end, for as long as you talked. It worked beautifully for voice and badly for computers, because computers do not talk steadily. They send a burst, then nothing for seconds.</p>' +
        '<p><b>Packet switching</b> turns that around. Cut every message into small packets, label each with where it is going, and let them share every link with everyone else\'s packets. Nothing is reserved, so nothing sits idle. The deal you accept in return: packets may wait in a queue, or be thrown away when the queue is full. Everything from chapter 3 onwards is about living with that deal.</p>');

      // ---- timeline ring
      var lab = PP.lab(body, 'The timeline ring', 'Drag the ring, press the arrows, or tap a card. Each card ends with a pointer to the chapter where that idea comes back. Dates from the original RFCs, university and cable-operator records.');
      var wrap = H('div', { class: 'ring-wrap' }), ring = H('div', { class: 'ring' });
      wrap.appendChild(ring); lab.appendChild(wrap);
      var n = EVENTS.length, step = 360 / n, cards = EVENTS.map(function (e, i) {
        var el = H('div', { class: 'rcard' }, H('span', { class: 'y' }, e.y), H('h5', null, e.t), H('div', null, e.c.length > 150 ? e.c.slice(0, e.c.lastIndexOf(' ', 150)) + '…' : e.c));
        el.addEventListener('click', function () { if (!moved) { target = i * step; auto = 0; } });
        ring.appendChild(el); return el;
      });
      var info = H('div', { class: 'ring-info' }); lab.appendChild(info);
      var rot = 0, target = null, vel = 0, drag = false, lx = 0, moved = false, auto = 3.2, idle = 0, front = -1;
      function R() { var cw = wrap.clientWidth < 560 ? 220 : 250; return (cw / 2 + 6) / Math.tan(Math.PI / n); }
      wrap.addEventListener('pointerdown', function (e) { drag = true; moved = false; lx = e.clientX; vel = 0; target = null; auto = 0; try { wrap.setPointerCapture(e.pointerId); } catch (x) { } });
      wrap.addEventListener('pointermove', function (e) { if (!drag) return; var dx = e.clientX - lx; lx = e.clientX; if (Math.abs(dx) > 1) moved = true; rot -= dx * 0.28; vel = -dx * 0.28; });
      wrap.addEventListener('pointerup', function () { drag = false; setTimeout(function () { moved = false; }, 30); });
      wrap.addEventListener('pointercancel', function () { drag = false; });
      var bar = H('div', { class: 'row' }, PP.btn('◀', function () { target = (Math.round(rot / step) - 1) * step; auto = 0; }, 'sm ghost'), PP.btn('▶', function () { target = (Math.round(rot / step) + 1) * step; auto = 0; }, 'sm ghost'), H('span', { class: 'hint' }, 'AUTO-ROTATES UNTIL YOU TOUCH IT'));
      lab.appendChild(bar);
      PP.tick(wrap, function (t, dt) {
        var rr = R();
        if (!drag) {
          if (target !== null) { rot += (target - rot) * Math.min(1, dt * 7); if (Math.abs(target - rot) < 0.05) { rot = target; target = null; } }
          else if (Math.abs(vel) > 0.05) { rot += vel; vel *= 0.93; if (Math.abs(vel) <= 0.05) target = Math.round(rot / step) * step; }
          else if (auto && !PP.reduced) rot += auto * dt;
        }
        ring.style.transform = 'translateZ(' + (-rr) + 'px) rotateY(' + (-rot) + 'deg)';
        var fi = ((Math.round(rot / step) % n) + n) % n;
        cards.forEach(function (c, i) {
          c.style.transform = 'rotateY(' + (i * step) + 'deg) translateZ(' + rr + 'px)';
          var d = Math.abs((((rot - i * step) % 360) + 540) % 360 - 180); // angular distance
          c.style.opacity = String(PP.clamp(1.25 - d / 80, 0.25, 1));
        });
        if (fi !== front) {
          front = fi; cards.forEach(function (c, i) { c.classList.toggle('front', i === fi); });
          var e = EVENTS[fi]; info.innerHTML = '<b>' + e.y + ' · ' + e.t + '</b><br>' + e.c + '<small>' + e.i + '</small>';
        }
      });

      // ---- circuit vs packet
      var lab2 = PP.lab(body, 'Reserve or share?', 'Both panels carry the same users over a link with room for 10 simultaneous streams. Left: every user needs a reserved circuit. Right: users just send packets when they have something to say. Push the user count past 10 and watch what each approach does.');
      var host = H('div'); lab2.appendChild(host);
      var cv = PP.canvas(host, { h: function (w) { return w < 600 ? 360 : 300; } });
      var slU = PP.slider('Users', { min: 4, max: 60, value: 30, fmt: function (v) { return v + ' users'; } }, function () { reset(); });
      var slA = PP.slider('Each user is sending', { min: 2, max: 60, value: 10, fmt: function (v) { return v + '% of the time'; } }, function () { reset(); });
      lab2.appendChild(H('div', { class: 'row' }, slU.el, slA.el));
      var stats = H('div', { class: 'stats' }); lab2.appendChild(stats);
      var CAP = 10, COLS = 28, QMAX = 36, st, acc = 0;
      function reset() {
        var nU = slU.get(), p = slA.get() / 100, b = 0.25, a = b * p / (1 - p);
        st = { users: [], c: [], p: [], q: [], drops: 0, sumUsed: 0, sumServed: 0, sumQ: 0, ticks: 0, a: a, b: b };
        for (var i = 0; i < nU; i++) st.users.push(Math.random() < p);
      }
      function simStep() {
        var nU = st.users.length, act = [];
        for (var i = 0; i < nU; i++) {
          st.users[i] = st.users[i] ? (Math.random() > st.b) : (Math.random() < st.a);
          if (st.users[i]) act.push(i);
        }
        // circuit: users 0..CAP-1 own a slot
        var col = [], used = 0;
        for (var s = 0; s < CAP; s++) { var on = s < nU && st.users[s]; col.push(on ? s + 1 : 0); if (on) used++; }
        st.c.push(col); if (st.c.length > COLS) st.c.shift(); st.sumUsed += used;
        // packet: queue
        for (var k = act.length - 1; k > 0; k--) { var j = Math.floor(Math.random() * (k + 1)); var tmp = act[k]; act[k] = act[j]; act[j] = tmp; }
        act.forEach(function (u) { if (st.q.length < QMAX) st.q.push(u); else st.drops++; });
        var pc = [], served = 0;
        for (var s2 = 0; s2 < CAP; s2++) { if (st.q.length) { pc.push(st.q.shift() + 1); served++; } else pc.push(0); }
        st.p.push(pc); if (st.p.length > COLS) st.p.shift(); st.sumServed += served; st.sumQ += st.q.length; st.ticks++;
        paintStats();
      }
      function paintStats() {
        var nU = st.users.length, pr = slA.get() / 100, tailP = N.binomTail(nU, pr, CAP);
        stats.innerHTML = '';
        [['CIRCUIT: USERS SERVED', Math.min(nU, CAP) + ' of ' + nU, nU > CAP ? '' : 'a', nU > CAP ? (nU - CAP) + ' get a busy signal' : 'everyone fits'],
        ['CIRCUIT: SLOTS USED', st.ticks ? Math.round(st.sumUsed / st.ticks / CAP * 100) + '%' : '-', '', 'reserved but idle slots are wasted'],
        ['PACKETS: LINK USED', st.ticks ? Math.round(st.sumServed / st.ticks / CAP * 100) + '%' : '-', 'a', 'avg queue ' + (st.ticks ? (st.sumQ / st.ticks).toFixed(1) : '0') + ' packets, ' + st.drops + ' dropped'],
        ['P(MORE THAN 10 ACTIVE)', tailP < 0.0001 ? '< 0.01%' : (tailP * 100).toFixed(tailP < 0.01 ? 2 : 1) + '%', '', 'binomial: n=' + nU + ', p=' + pr.toFixed(2)]].forEach(function (x) {
          stats.appendChild(H('div', { class: 'stat' }, H('span', { class: 'l' }, x[0]), H('span', { class: 'v ' + x[2] }, x[1]), H('span', { class: 's' }, x[3])));
        });
      }
      reset();
      PP.tick(host, function (t, dt) {
        acc += dt; while (acc > 0.16) { acc -= 0.16; simStep(); }
        var g = cv.g, w = cv.w, h = cv.h, narrow = w < 600, pw = narrow ? w - 8 : (w - 30) / 2, ph = narrow ? (h - 20) / 2 : h;
        g.clearRect(0, 0, w, h);
        function panel(ox, oy, title, cols, isPacket) {
          var cell = Math.max(5, Math.min(13, Math.floor((pw - 12) / COLS))), gap = 2, gw = COLS * (cell + gap);
          g.font = '700 11px ui-monospace,Menlo,Consolas,monospace'; g.textAlign = 'left'; g.fillStyle = isPacket ? PP.lc('net') : PP.lc('phy'); g.fillText(title, ox + 4, oy + 14);
          var top = oy + 26;
          for (var c = 0; c < cols.length; c++) {
            var x = ox + 4 + gw - (cols.length - c) * (cell + gap);
            for (var r = 0; r < CAP; r++) {
              var v = cols[c][r], y = top + (CAP - 1 - r) * (cell + gap);
              if (v) { g.fillStyle = PP.hsl(((v - 1) * 47) % 360, 85, 62, 0.95); g.fillRect(x, y, cell, cell); }
              else { g.strokeStyle = isPacket ? 'rgba(241,238,250,.18)' : 'hsla(38,90%,62%,.4)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1); }
            }
          }
          var by = top + CAP * (cell + gap) + 8;
          g.fillStyle = 'rgba(241,238,250,.55)'; g.font = '10.5px ui-monospace,Menlo,Consolas,monospace';
          if (isPacket) {
            g.fillText('QUEUE (' + st.q.length + ')', ox + 4, by + 8);
            for (var i = 0; i < QMAX; i++) {
              var qx = ox + 4 + (i % 18) * (cell + gap), qy = by + 14 + Math.floor(i / 18) * (cell + gap);
              if (i < st.q.length) { g.fillStyle = PP.hsl(((st.q[i]) * 47) % 360, 85, 62, 0.95); g.fillRect(qx, qy, cell, cell); }
              else { g.strokeStyle = 'rgba(241,238,250,.13)'; g.strokeRect(qx + 0.5, qy + 0.5, cell - 1, cell - 1); }
            }
          } else {
            var blocked = Math.max(0, st.users.length - CAP);
            g.fillText(blocked ? 'BLOCKED USERS (busy signal)' : 'ALL USERS HAVE A CIRCUIT', ox + 4, by + 8);
            for (var b = 0; b < Math.min(blocked, 36); b++) { g.fillStyle = 'hsla(12,90%,64%,.9)'; g.fillRect(ox + 4 + (b % 18) * (cell + gap), by + 14 + Math.floor(b / 18) * (cell + gap), cell, cell); }
            g.fillStyle = 'rgba(241,238,250,.4)'; g.fillText('hollow = reserved but idle', ox + 4, by + 14 + 2 * (cell + gap) + 12);
          }
        }
        panel(0, 0, 'CIRCUIT SWITCHING', st.c, false);
        if (narrow) panel(0, ph + 10, 'PACKET SWITCHING', st.p, true); else panel(pw + 30, 0, 'PACKET SWITCHING', st.p, true);
      });

      PP.algo(body, {
        name: 'Statistical multiplexing with store-and-forward',
        idea: 'Many bursty senders share one link. Capacity is given out packet by packet to whoever has something to send, instead of being reserved per user.',
        steps: [
          'The sender cuts its data into packets and puts a header with the destination on each.',
          'A router <b>receives the whole packet</b> first (store), reads the header, and picks the outgoing link.',
          'If the link is busy the packet waits in a <b>queue</b>. When the link is free it is sent (forward).',
          'If the queue is full the packet is <b>dropped</b>. The endpoints notice and slow down (chapter 6).'
        ],
        code: 'on packet arrival at router:\n  out = lookup(packet.dst)          # chapter 5\n  if queue[out].length < LIMIT:\n      queue[out].push(packet)\n  else:\n      drop(packet)\n\nwhen link[out] becomes free:\n  send(queue[out].pop_front())      # takes L/R seconds',
        cost: 'Per hop delay = packet size / link rate. A 1500 B packet on a 10 Mb/s link: 12,000 bits / 10,000,000 = 1.2 ms. With 35 users each active 10% of the time, the chance that more than 10 are active at once is only about 0.04%.'
      });
      PP.deal(body, 'What this means when your internet is slow', [
        '<b>Slow only at certain hours?</b> That is shared capacity running out (the right-hand panel at 35+ users). Test in the evening and again at night. If speed tracks the clock, the problem is upstream, not your router.',
        '<b>Slow all day, every device?</b> Look at your own link: an overloaded Wi-Fi channel or a single heavy upload fills <i>your</i> queue first (chapter 9).',
        'ISPs sell more capacity than the link holds, on purpose, because of the maths above. That is normal. A good one watches the tail probability and adds capacity before it bites.'
      ]);
    }
  });
})();
