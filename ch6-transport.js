/* PIXEL PACKET — chapter 06 : TRANSPORT (TCP, congestion control, UDP, QUIC) */
(function () {
  'use strict';
  var N = PP.net, H = PP.h, HUE = 262;

  PP.chapter({
    id: 'transport', num: 6, short: 'TRANSPORT', layerName: 'LAYER 4 · TRANSPORT', title: 'TRANSPORT', hue: HUE,
    blurb: 'Reliable streams over an unreliable network: handshakes, windows, congestion control.',
    tagline: 'IP delivers packets with no promises. TCP adds the promises: in order, no gaps, no duplicates, and not so fast that it breaks the road for everyone.',
    quiz: [
      { q: 'A TCP connection loses one packet. What does standard (Reno) TCP do to its congestion window?', a: ['Doubles it', 'Resets to zero and gives up', 'Roughly halves it, then grows slowly again', 'Ignores it: loss is normal'], c: 2,
        why: 'Loss is read as a congestion signal. TCP halves its window (multiplicative decrease) and then adds one segment per round trip (additive increase): the AIMD sawtooth.' },
      { q: 'You have a 1 Gbit/s link with 200 ms RTT but a single download only gets about 2.6 Mbit/s. Which limit is the most likely cause?', a: ['The disk is slow', 'A fixed 64 KB receive window: throughput ≤ window ÷ RTT', 'The cable is too long', 'DNS is slow'], c: 1,
        why: '65,535 bytes per 0.2 s = about 2.6 Mbit/s, whatever the link speed. That is why TCP window scaling exists, and why bandwidth–delay product matters on long paths.' },
      { q: 'Why does QUIC run over UDP instead of being a new IP protocol?', a: ['UDP is faster than IP', 'Routers and firewalls everywhere already pass UDP; a brand new protocol number would be dropped (ossification)', 'UDP has built-in encryption', 'TCP is deprecated'], c: 1,
        why: 'Middleboxes break anything they do not recognise. QUIC hides inside UDP and implements reliability, streams and TLS 1.3 itself in user space, so it can evolve without waiting for operating systems.' }
    ],
    build: function (body) {
      PP.prose(body,
        '<p>IP gets a packet to the right <i>machine</i>. It does not say which <i>program</i> should receive it, and it does not promise the packet arrives at all. The <b>transport layer</b> fixes both.</p>' +
        '<p><b>Ports</b> (16-bit numbers) pick the program: 443 is HTTPS, 53 is DNS, 22 is SSH. A connection is identified by four numbers: <code>source IP, source port, destination IP, destination port</code>. <b>UDP</b> adds only ports and a checksum: fast, no promises. <b>TCP</b> builds a reliable, ordered byte stream on top.</p>');

      // ---------- handshake
      var labH = PP.lab(body, 'Opening and closing a TCP connection', 'Three messages open a connection and four close it. The sequence numbers are the whole trick: each side counts the bytes it sends, and the other side says which byte it expects next. Step through with a realistic example.');
      var ISN_C = 1000, ISN_S = 5000;
      PP.ladder(labH, {
        actors: ['CLIENT (your browser)', 'SERVER (port 443)'], ms: 1500, rowH: 54,
        steps: [
          { from: 0, to: 1, label: 'SYN', sub: 'seq=' + ISN_C + '  (can we talk?)', note: '<b>SYN.</b> The client picks a random <b>initial sequence number</b> (random so old, delayed packets from earlier connections cannot be mistaken for new ones) and says: "I want to open a connection."' },
          { from: 1, to: 0, label: 'SYN + ACK', sub: 'seq=' + ISN_S + '  ack=' + (ISN_C + 1), note: '<b>SYN-ACK.</b> The server picks its own number and acknowledges the client\'s: "I expect byte ' + (ISN_C + 1) + ' next." A SYN uses up one sequence number even though it carries no data.' },
          { from: 0, to: 1, label: 'ACK', sub: 'seq=' + (ISN_C + 1) + '  ack=' + (ISN_S + 1), note: '<b>ACK.</b> Both directions are confirmed. That is <b>1 RTT</b> spent before a single byte of data. Every new connection pays this tax, and it is why connection reuse and HTTP/2/3 matter.' },
          { from: 0, to: 1, label: 'DATA 500 bytes', sub: 'seq=' + (ISN_C + 1) + '  ack=' + (ISN_S + 1), note: '<b>Data.</b> 500 bytes starting at byte ' + (ISN_C + 1) + '. If the server does not acknowledge in time, the client resends.' },
          { from: 1, to: 0, label: 'ACK', sub: 'ack=' + (ISN_C + 501), note: '<b>Cumulative ACK.</b> "I have everything up to byte ' + (ISN_C + 500) + ', send ' + (ISN_C + 501) + ' next." One ACK can confirm many segments.' },
          { from: 0, to: 1, label: 'FIN', sub: 'I am finished sending', note: '<b>FIN.</b> The client has no more data. The connection is <i>half-closed</i>: it can still receive.' },
          { from: 1, to: 0, label: 'ACK', sub: '', note: '<b>ACK of FIN.</b> The server confirms.' },
          { from: 1, to: 0, label: 'FIN', sub: 'now I am finished too', note: '<b>FIN.</b> The server closes its direction when it is done.' },
          { from: 0, to: 1, label: 'ACK', sub: 'then wait 2×MSL', note: '<b>Final ACK.</b> The client waits (TIME-WAIT, commonly 30–60 s) in case that last ACK was lost, so the server is not left hanging. A busy server can run out of ports stuck in TIME-WAIT.' }
        ]
      });

      // ---------- congestion
      var labC = PP.lab(body, 'Congestion control: the sawtooth', 'The sender does not know the network\'s capacity, so it <i>probes</i>. It sends 1 segment, then doubles every round trip (<b>slow start</b>), then adds just 1 per round trip (<b>congestion avoidance</b>). When a packet is lost it cuts the window. The graph is a simulation of TCP Reno with a seeded random generator, so the same settings give the same run. Flying dots are the packets in flight.');
      var cfg = { loss: 0.3, rtt: 80, mode: 'reno', rounds: 90, seed: 7 };
      var segM = PP.seg([{ v: 'reno', t: 'RENO (halve on loss)' }, { v: 'timeout', t: 'TIMEOUT (back to 1)' }], 'reno', function (v) { cfg.mode = v; sim(); });
      var slL = PP.slider('Random loss rate', { min: 0, max: 100, value: 30, fmt: function (v) { return (v / 100).toFixed(2) + ' %'; } }, function (v) { cfg.loss = v / 100; sim(); });
      var slR = PP.slider('Round-trip time', { min: 5, max: 400, value: 80, fmt: function (v) { return v + ' ms'; } }, function (v) { cfg.rtt = v; sim(); });
      labC.appendChild(segM.el); labC.appendChild(H('div', { class: 'grid2' }, slL.el, slR.el));
      labC.appendChild(PP.btn('New random run', function () { cfg.seed = 1 + Math.floor(Math.random() * 99999); sim(); }, 'sm ghost'));
      var chost = H('div'), ccv = PP.canvas(chost, { h: 300 }); labC.appendChild(chost);
      var cstats = H('div', { class: 'stats' }); labC.appendChild(cstats);
      var cnote = H('div', { class: 'ladder-note' }); labC.appendChild(cnote);
      var series = [], MSS = 1460;
      function sim() {
        var rnd = N.rng(cfg.seed), cw = 1, ss = 64, phase = 'ss', p = cfg.loss / 100; series = []; var sum = 0, losses = 0;
        for (var r = 0; r < cfg.rounds; r++) {
          var pl = p > 0 ? 1 - Math.pow(1 - p, Math.floor(cw)) : 0, lost = rnd() < pl;
          series.push({ cw: cw, ss: ss, ph: phase, lost: lost }); sum += cw;
          if (lost) { losses++; ss = Math.max(2, cw / 2); if (cfg.mode === 'timeout') { cw = 1; phase = 'ss'; } else { cw = ss; phase = 'ca'; } }
          else if (phase === 'ss') { cw = cw * 2; if (cw >= ss) { cw = ss; phase = 'ca'; } } else cw += 1;
        }
        var avg = sum / cfg.rounds, thr = avg * MSS * 8 / (cfg.rtt / 1000), mat = p > 0 ? N.mathis(MSS, cfg.rtt / 1000, p) : Infinity;
        cstats.innerHTML = '';
        [['AVERAGE WINDOW', avg.toFixed(1) + ' segments', 'a'], ['LOSS EVENTS', losses + ' in ' + cfg.rounds + ' RTTs', ''], ['THROUGHPUT (this run)', PP.net.fmtRate(thr), 'a'], ['MATHIS ESTIMATE', mat === Infinity ? 'no loss: link-limited' : PP.net.fmtRate(mat), '']].forEach(function (x) { cstats.appendChild(H('div', { class: 'stat' }, H('span', { class: 'l' }, x[0]), H('span', { class: 'v ' + x[1 === 1 ? '' : x[2]] }, x[1]))); });
        cnote.innerHTML = 'Throughput ≈ window × 1460 bytes ÷ RTT. Halve the RTT and the throughput doubles: <b>distance costs speed</b> even on a perfect link. The <b>Mathis formula</b> (rate ≈ MSS/RTT × 1.22/√p) predicts the average from loss alone: loss is worse than most people expect, and 1% loss on a 100 ms path caps one TCP flow near 1.4 Mbit/s.';
      }
      sim();
      var flight = [];
      PP.tick(chost, function (t) {
        var g = ccv.g, w = ccv.w, h = ccv.h, L = 44, R = w - 12, T = 14, B = h - 78, maxC = 4;
        series.forEach(function (s) { maxC = Math.max(maxC, s.cw, s.ss > 0 && s.ss < 1000 ? 0 : 0); });
        maxC = Math.ceil(maxC * 1.1);
        g.clearRect(0, 0, w, h); g.font = '10px ui-monospace,Menlo,monospace'; g.fillStyle = 'rgba(241,238,250,.4)'; g.textAlign = 'right';
        for (var k = 0; k <= 4; k++) { var v = maxC * k / 4, y = B - (B - T) * k / 4; g.strokeStyle = 'rgba(241,238,250,.07)'; g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke(); g.fillText(Math.round(v), L - 5, y + 3); }
        g.textAlign = 'left'; g.fillText('cwnd (segments) vs round trips →', L, 10);
        var n = series.length, X = function (i) { return L + (R - L) * i / (n - 1); }, Y = function (v) { return B - (B - T) * v / maxC; };
        var reveal = Math.min(n, ((t * 0.0004 * 14) % (n + 20)));
        if (PP.reduced) reveal = n;
        g.lineWidth = 2.4; g.beginPath();
        for (var i = 0; i < n && i <= reveal; i++) { var s = series[i]; i ? g.lineTo(X(i), Y(s.cw)) : g.moveTo(X(i), Y(s.cw)); if (i + 1 < n) g.lineTo(X(i + 1), Y(s.cw)); }
        g.strokeStyle = 'hsl(262,90%,72%)'; g.stroke();
        for (var j = 0; j < n && j <= reveal; j++) { var q = series[j]; if (q.lost) { g.fillStyle = 'hsl(12,90%,64%)'; g.beginPath(); g.arc(X(j), Y(q.cw), 5, 0, 7); g.fill(); } }
        var ci = Math.min(n - 1, Math.floor(reveal)), cur = series[ci];
        g.fillStyle = '#fff'; g.beginPath(); g.arc(X(ci), Y(cur.cw), 4, 0, 7); g.fill();
        g.fillStyle = cur.ph === 'ss' ? 'hsl(38,90%,62%)' : 'hsl(166,90%,62%)'; g.textAlign = 'right'; g.fillText((cur.ph === 'ss' ? 'SLOW START' : 'CONGESTION AVOIDANCE') + ' · cwnd ' + cur.cw.toFixed(1), R, 10);
        // the pipe: packets in flight
        var py = h - 38, ph = 26; g.strokeStyle = 'rgba(241,238,250,.22)'; g.strokeRect(L, py - ph / 2, R - L, ph); g.fillStyle = 'rgba(241,238,250,.4)'; g.textAlign = 'left'; g.fillText('SENDER', L, h - 8); g.textAlign = 'right'; g.fillText('RECEIVER', R, h - 8); g.textAlign = 'center'; g.fillText(Math.floor(cur.cw) + ' packets in flight', (L + R) / 2, h - 8);
        var cnt = Math.min(60, Math.max(1, Math.floor(cur.cw)));
        for (var m = 0; m < cnt; m++) {
          var f = ((t * 0.00035 + m / cnt) % 1), x = L + 8 + f * (R - L - 16), yy = py + Math.sin(t * 0.004 + m * 1.7) * (ph / 2 - 5);
          g.fillStyle = PP.hsl(262 + f * 60, 90, 68, 0.95); g.fillRect(x - 3, yy - 3, 6, 6);
        }
      });
      PP.algo(body, {
        name: 'AIMD: additive increase, multiplicative decrease',
        idea: 'The one rule that keeps the internet from collapsing. Every sender probes gently upward and backs off hard on loss. Many flows following the same rule converge to a fair share without talking to each other.',
        steps: ['Slow start: cwnd starts small (10 segments in modern Linux) and doubles every RTT until it reaches ssthresh or sees loss.', 'Congestion avoidance: add 1 segment per RTT (cwnd += MSS²/cwnd per ACK).', 'On loss detected by 3 duplicate ACKs: ssthresh = cwnd / 2; cwnd = ssthresh (fast recovery).', 'On a retransmission timeout (worse signal): ssthresh = cwnd / 2; cwnd = 1 and slow start again.'],
        code: 'on ACK:   cwnd += (cwnd < ssthresh) ? 1 : 1/cwnd\non 3dup:  ssthresh = max(cwnd/2, 2); cwnd = ssthresh\non RTO:   ssthresh = max(cwnd/2, 2); cwnd = 1',
        cost: 'CUBIC (Linux, Windows, macOS default) replaces the straight line with a cubic curve that recovers faster on fast long paths. BBR (Google) abandons loss as the signal and models bandwidth and RTT directly.'
      });

      // ---------- BDP
      var labB = PP.lab(body, 'Why a fast link can still be slow', 'Two ceilings on every TCP flow: the <b>window</b> (data in flight cannot exceed it) and the <b>bandwidth–delay product</b> (the amount of data a path can hold). Enter your link and round-trip time.');
      var bw = 100, rt = 200, win = 64;
      var sB = PP.slider('Link bandwidth', { min: 1, max: 1000, value: 100, fmt: function (v) { return v + ' Mbit/s'; } }, function (v) { bw = v; calcB(); });
      var sR = PP.slider('Round-trip time', { min: 1, max: 500, value: 200, fmt: function (v) { return v + ' ms'; } }, function (v) { rt = v; calcB(); });
      var sW = PP.slider('Receive window', { min: 8, max: 4096, value: 64, step: 8, fmt: function (v) { return v + ' KB'; } }, function (v) { win = v; calcB(); });
      labB.appendChild(H('div', { class: 'grid3' }, sB.el, sR.el, sW.el));
      var bst = H('div', { class: 'stats' }), bbar = H('div', { class: 'bar', style: { height: '22px', margin: '10px 0 4px' } }), bnote = H('div', { class: 'ladder-note' }); labB.appendChild(bst); labB.appendChild(bbar); labB.appendChild(bnote);
      function calcB() {
        var bdp = bw * 1e6 / 8 * (rt / 1000), wb = win * 1024, cap = Math.min(bw * 1e6, wb * 8 / (rt / 1000)), pct = cap / (bw * 1e6) * 100;
        bst.innerHTML = '';
        [['BANDWIDTH×DELAY', Math.round(bdp / 1024).toLocaleString() + ' KB', 'a', 'bytes needed in flight to fill the path'], ['WINDOW CEILING', N.fmtRate(wb * 8 / (rt / 1000)), '', 'window ÷ RTT'], ['ACTUAL MAX', N.fmtRate(cap), 'a', pct.toFixed(0) + '% of the link']].forEach(function (x) { bst.appendChild(H('div', { class: 'stat' }, H('span', { class: 'l' }, x[0]), H('span', { class: 'v ' + x[2] }, x[1]), H('span', { class: 's' }, x[3]))); });
        bbar.innerHTML = ''; bbar.appendChild(H('i', { style: { width: Math.min(100, pct) + '%', background: pct > 90 ? 'hsl(150,80%,55%)' : pct > 40 ? 'hsl(38,90%,62%)' : 'hsl(12,90%,64%)' } }));
        bnote.innerHTML = pct >= 99 ? 'The window is big enough: the link itself is the limit.' : 'The <b>window is the bottleneck</b>: the sender waits for ACKs while the link sits idle. Fix: enable <b>window scaling</b> (RFC 7323, on by default in modern systems; the plain 16-bit field only reaches 64 KB), or use several parallel connections.';
      }
      calcB();
      PP.algo(body, {
        name: 'Retransmission timeout (RFC 6298)',
        idea: 'How long should a sender wait before assuming a packet is lost? Too short: needless duplicates. Too long: slow recovery. TCP measures the round-trip time continuously and keeps a smoothed average and a variance.',
        steps: ['First sample R: SRTT = R, RTTVAR = R / 2.', 'Each later sample R: RTTVAR = 0.75·RTTVAR + 0.25·|SRTT − R|, then SRTT = 0.875·SRTT + 0.125·R.', 'RTO = SRTT + max(clock granularity, 4·RTTVAR), at least 1 second.', 'On timeout, double the RTO (exponential backoff). Karn\'s rule: never take an RTT sample from a retransmitted packet.'],
        cost: 'The smoothing is an exponentially weighted moving average (EWMA): constant memory, constant time, in every TCP stack.'
      });

      // ---------- RTO calc
      var labR = PP.lab(body, 'Compute an RTO yourself', 'Type round-trip-time samples in milliseconds. The tool applies the real RFC 6298 equations to each one.');
      var rin = H('input', { type: 'text', value: '100, 110, 95, 400, 105, 100', spellcheck: 'false' }); labR.appendChild(H('label', { class: 'fld' }, 'RTT SAMPLES (ms), COMMA SEPARATED')); labR.appendChild(rin);
      var rtb = H('div', { class: 'scroll-x' }); labR.appendChild(rtb);
      function rto() {
        var xs = rin.value.split(/[ ,;]+/).filter(Boolean).map(Number).filter(function (x) { return x > 0 && isFinite(x); }).slice(0, 30), srtt = 0, rv = 0; rtb.innerHTML = '';
        if (!xs.length) return;
        var t = H('table', { class: 'table' }, H('tr', null, ['#', 'SAMPLE', 'SRTT', 'RTTVAR', 'RTO (min 1000 ms)'].map(function (x) { return H('th', null, x); })));
        xs.forEach(function (r, i) {
          if (!i) { srtt = r; rv = r / 2; } else { rv = 0.75 * rv + 0.25 * Math.abs(srtt - r); srtt = 0.875 * srtt + 0.125 * r; }
          t.appendChild(H('tr', null, H('td', null, i + 1), H('td', null, r), H('td', null, srtt.toFixed(1)), H('td', null, rv.toFixed(1)), H('td', null, Math.max(1000, srtt + Math.max(1, 4 * rv)).toFixed(0))));
        }); rtb.appendChild(t);
      }
      rin.addEventListener('input', rto); rto();

      // ---------- UDP / QUIC
      PP.prose(body, '<h3 class="h3">Choosing a transport</h3>');
      var tb = H('div', { class: 'scroll-x' }), tt = H('table', { class: 'table' }, H('tr', null, ['', 'TCP', 'UDP', 'QUIC (HTTP/3)'].map(function (x) { return H('th', null, x); })));
      [['Delivery', 'reliable, ordered stream', 'best effort datagrams', 'reliable, many independent streams'], ['Setup cost', '1 RTT (+1–2 for TLS)', 'none', '1 RTT total, 0 on resumption'], ['One lost packet', 'stalls the whole stream (head-of-line blocking)', 'only that packet is lost', 'stalls only its own stream'], ['Runs in', 'the OS kernel', 'the OS kernel', 'the application (over UDP)'], ['Good for', 'web (HTTP/1–2), email, SSH, files', 'DNS, voice/video calls, games, VPNs', 'modern web, mobile (survives Wi-Fi ↔ 4G switches)']].forEach(function (r) { tt.appendChild(H('tr', null, r.map(function (c, i) { return H('td', { style: i === 0 ? { color: 'var(--faint)' } : null }, c); }))); });
      tb.appendChild(tt); body.appendChild(tb);
      PP.deal(body, 'Transport problems you will actually meet', [
        '<b>"Connection refused" vs "timed out":</b> refused means the machine answered and nothing listens on that port (RST). Timed out means a firewall dropped the packets silently. Different fixes.',
        '<b>Fast speed test, slow downloads:</b> speed tests open many parallel connections. One flow can be limited by window, loss or RTT. Test a single download from a nearby server.',
        '<b>Calls and games stutter while a download runs:</b> bufferbloat. The router queue fills and every packet waits behind it. Turn on SQM / smart queue management (fq_codel, CAKE) on your router and cap the speed at about 90% of line rate.',
        '<b>Port already in use / too many TIME-WAIT:</b> a server was restarted quickly or opens huge numbers of short connections. Reuse connections (keep-alive) instead of raising limits.'
      ]);
    }
  });
})();
