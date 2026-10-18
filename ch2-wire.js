/* PIXEL PACKET — chapter 02 : WIRE (physical layer) */
(function () {
  'use strict';
  var N = PP.net, H = PP.h, HUE = 38;
  var KINDS = [
    { v: 'nrz', t: 'NRZ', d: 'Non-return-to-zero: high voltage is 1, low is 0. Simple, but a long run of identical bits has no edges, so the receiver can lose count.' },
    { v: 'man', t: 'MANCHESTER', d: 'Every bit has a transition in the middle (here 1 = low to high, 0 = high to low; the opposite convention also exists). The clock travels inside the data. Used by 10 Mb/s Ethernet, at the cost of doubling the bandwidth needed.' },
    { v: 'ask', t: 'ASK', d: 'Amplitude-shift keying: a carrier wave, loud for 1 and quiet for 0. Easiest to build, easiest for noise to fool.' },
    { v: 'fsk', t: 'FSK', d: 'Frequency-shift keying: one frequency for 0, a higher one for 1. Robust against amplitude changes. Old modems and many simple radios.' },
    { v: 'psk', t: 'PSK', d: 'Phase-shift keying: the carrier flips upside down for a 0. The basis of Wi-Fi, LTE and satellite links, extended with several phases and amplitudes at once (QAM).' }
  ];
  function textBits(s) {
    var b = []; s = s.slice(0, 4);
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i) & 255; for (var k = 7; k >= 0; k--) b.push((c >> k) & 1); }
    return b.length ? b : [0];
  }

  PP.chapter({
    id: 'wire', num: 2, short: 'WIRE', layerName: 'LAYER 1 · PHYSICAL', title: 'WIRE', hue: HUE,
    blurb: 'How a bit becomes voltage, light or radio, and what noise and distance do to it.',
    tagline: 'A bit is not a number on the wire. It is a physical change that a receiver has to notice through noise. Everything above this chapter assumes it worked.',
    quiz: [
      { q: 'Why does a Wi-Fi connection get slower as you walk away from the router?', a: ['The router runs out of data to send', 'Lower signal-to-noise forces the radio to pick simpler modulation that carries fewer bits per symbol', 'The router deliberately throttles distant devices', 'Packets become larger with distance'], c: 1,
        why: 'Shannon: capacity depends on bandwidth and SNR. As SNR falls, the radio steps down to a safer modulation (fewer bits per symbol). The link is not "weaker", it is more cautious.' },
      { q: 'Why does light stay inside an optical fibre?', a: ['The core is coated with a mirror', 'The core has a higher refractive index than the cladding, so shallow rays are totally internally reflected', 'The cladding absorbs stray light', 'Glass conducts light like a wire conducts current'], c: 1,
        why: 'Rays that hit the core/cladding boundary at a shallow enough angle cannot escape. That angle limit is the acceptance cone, set by the two refractive indices.' },
      { q: 'A path is 12,000 km long and signals in fibre travel at about 200,000 km/s. What is the absolute minimum one-way delay?', a: ['About 6 ms', 'About 60 ms', 'About 600 ms', 'Zero, light is instant'], c: 1,
        why: '12,000 / 200,000 = 0.06 s = <b>60 ms</b>. No software, protocol or money can beat propagation delay.' }
    ],
    build: function (body) {
      PP.prose(body,
        '<p>A cable carries only physics: voltage on copper, light in glass, or a radio wave in the air. To send a <b>1</b> and a <b>0</b>, the sender changes something (a voltage, an amplitude, a frequency, a phase) and the receiver measures it. The receiver is always measuring through <b>noise</b>: heat in the wires, a neighbour\'s radio, a microwave oven.</p>' +
        '<p>Three media do almost all the work. <b>Copper</b> twisted pairs (Ethernet cable) carry voltage up to about 100 m. <b>Fibre</b> carries light for kilometres to oceans, and all long-distance traffic is on it. <b>Radio</b> (Wi-Fi, mobile data, satellite) trades range and reliability for freedom from cables.</p>');

      // ---------------- LAB: scope
      var lab = PP.lab(body, 'The signal scope', 'Type up to four characters. Pick how the bits are put onto the wire, then add noise. The receiver decodes by <i>correlation</i>: it multiplies what it receives by what a 1 and a 0 should look like, and picks the better match. Red marks a bit it got wrong.');
      var inp = H('input', { type: 'text', maxlength: 4, value: 'Hi', spellcheck: 'false', style: { maxWidth: '120px' } });
      var kindSeg = PP.seg(KINDS.map(function (k) { return { v: k.v, t: k.t }; }), 'man', function () { recompute(); });
      var slN = PP.slider('Noise', { min: 0, max: 220, value: 35, fmt: function (v) { return (v / 100).toFixed(2) + ' σ'; } }, function () { recompute(); });
      var seed = 11;
      lab.appendChild(H('div', { class: 'row' }, H('div', null, H('label', { class: 'fld' }, 'TEXT TO SEND'), inp), H('div', null, H('label', { class: 'fld' }, 'ENCODING'), kindSeg.el)));
      lab.appendChild(H('div', { class: 'row' }, slN.el, PP.btn('Re-roll noise', function () { seed = (seed * 7 + 13) % 99991; recompute(); }, 'sm ghost')));
      var host = H('div'); lab.appendChild(host);
      var cv = PP.canvas(host, { h: function (w) { return w < 560 ? 230 : 260; } });
      var kdesc = H('div', { class: 'ladder-note' }); lab.appendChild(kdesc);
      var stats = H('div', { class: 'stats' }); lab.appendChild(stats);
      var bits, clean, noisy, dec, errs, snr;
      function recompute() {
        var kind = kindSeg.get(), sg = slN.get() / 100;
        bits = textBits(inp.value); clean = N.encode(bits, kind);
        var nz = N.gauss(clean.length, seed); noisy = new Float32Array(clean.length);
        for (var i = 0; i < clean.length; i++) noisy[i] = clean[i] + nz[i] * sg;
        dec = N.decode(noisy, bits.length, kind);
        errs = 0; for (var j = 0; j < bits.length; j++) if (dec[j] !== bits[j]) errs++;
        snr = sg > 0 ? 10 * Math.log10(N.power(clean) / (sg * sg)) : Infinity;
        for (var k = 0; k < KINDS.length; k++) if (KINDS[k].v === kind) kdesc.innerHTML = '<b>' + KINDS[k].t + '</b> &nbsp;' + KINDS[k].d;
        stats.innerHTML = '';
        var recv = ''; for (var m = 0; m < dec.length; m += 8) { var c = 0; for (var q = 0; q < 8 && m + q < dec.length; q++) c = c * 2 + dec[m + q]; recv += (c >= 32 && c < 127) ? String.fromCharCode(c) : '¿'; }
        [['BITS SENT', bits.length, '', bits.length / 8 + ' character' + (bits.length > 8 ? 's' : '')], ['BIT ERRORS', errs, errs ? '' : 'a', 'BER ' + (errs / bits.length * 100).toFixed(1) + '%'],
        ['SNR', isFinite(snr) ? snr.toFixed(1) + ' dB' : 'no noise', 'a', 'signal power / noise power'], ['RECEIVER READS', recv, errs ? '' : 'a', errs ? 'corrupted' : 'perfect']].forEach(function (x) {
          stats.appendChild(H('div', { class: 'stat' }, H('span', { class: 'l' }, x[0]), H('span', { class: 'v ' + x[2] }, String(x[1])), H('span', { class: 's' }, x[3])));
        });
        lastSnr = snr;
      }
      var lastSnr = 0;
      inp.addEventListener('input', recompute); recompute();
      PP.tick(host, function (t) {
        var g = cv.g, w = cv.w, h = cv.h, L = noisy.length, pad = 10, X = function (i) { return pad + i / L * (w - 2 * pad); };
        var cy = h * 0.5 - 14, amp = h * 0.27, nb = bits.length;
        g.clearRect(0, 0, w, h);
        g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, w, h);
        g.strokeStyle = 'rgba(241,238,250,.07)'; g.lineWidth = 1;
        for (var y = -2; y <= 2; y++) { g.beginPath(); g.moveTo(0, cy - y * amp * 0.5); g.lineTo(w, cy - y * amp * 0.5); g.stroke(); }
        g.font = '600 ' + (nb > 16 ? 9 : 11) + 'px ui-monospace,Menlo,Consolas,monospace'; g.textAlign = 'center';
        for (var b = 0; b < nb; b++) {
          var x0 = X(b * N.SPB);
          g.strokeStyle = 'rgba(241,238,250,.12)'; g.setLineDash([2, 4]); g.beginPath(); g.moveTo(x0, 18); g.lineTo(x0, h - 30); g.stroke(); g.setLineDash([]);
          g.fillStyle = PP.lc('phy', 0.9); g.fillText(bits[b], x0 + (X(N.SPB) - X(0)) / 2, 13);
        }
        // clean ghost
        g.strokeStyle = 'rgba(241,238,250,.28)'; g.lineWidth = 1; g.setLineDash([3, 3]); g.beginPath();
        for (var i = 0; i < L; i++) { var yy = cy - clean[i] * amp; if (i) g.lineTo(X(i), yy); else g.moveTo(X(i), yy); } g.stroke(); g.setLineDash([]);
        // noisy trace with sweeping beam
        var head = PP.reduced ? L : Math.floor(((t * 0.32) % 1.25) * L);
        g.strokeStyle = PP.hsl(HUE, 90, 62, 0.4); g.lineWidth = 1.2; g.beginPath();
        for (var a = 0; a < L; a++) { var ya = cy - PP.clamp(noisy[a], -2.4, 2.4) * amp; if (a) g.lineTo(X(a), ya); else g.moveTo(X(a), ya); } g.stroke();
        g.strokeStyle = PP.hsl(HUE, 100, 72, 1); g.lineWidth = 2; g.shadowColor = PP.hsl(HUE, 100, 60, 1); g.shadowBlur = 8; g.beginPath();
        var lim = Math.min(L, head);
        for (var c = 0; c < lim; c++) { var yc = cy - PP.clamp(noisy[c], -2.4, 2.4) * amp; if (c) g.lineTo(X(c), yc); else g.moveTo(X(c), yc); } g.stroke(); g.shadowBlur = 0;
        // decoded strip
        var bw = (X(N.SPB) - X(0));
        for (var d = 0; d < nb; d++) {
          var ok = dec[d] === bits[d], bx = X(d * N.SPB);
          g.fillStyle = ok ? 'hsla(150,80%,55%,.18)' : 'hsla(12,90%,64%,.5)'; g.fillRect(bx + 1, h - 26, bw - 2, 22);
          g.fillStyle = ok ? 'hsl(150 80% 70%)' : '#fff'; g.fillText(dec[d], bx + bw / 2, h - 11);
        }
        g.textAlign = 'left'; g.fillStyle = 'rgba(241,238,250,.5)'; g.font = '10px ui-monospace,Menlo,Consolas,monospace'; g.fillText('RECEIVER DECODES', 8, h - 30 + 0);
      });

      // Shannon
      var lab2 = PP.lab(body, 'The speed limit of any channel', 'Claude Shannon proved in 1948 that a channel with bandwidth <b>B</b> and signal-to-noise ratio <b>S/N</b> can carry at most <code>C = B × log₂(1 + S/N)</code> bits per second, no matter how clever the coding. This is why every wireless standard is a fight for wider channels and cleaner signal.');
      var slB = PP.slider('Bandwidth', { min: 1, max: 160, value: 20, fmt: function (v) { return v + ' MHz'; } }, upd);
      var slS = PP.slider('SNR', { min: 0, max: 50, step: 0.5, value: 30, fmt: function (v) { return v.toFixed(1) + ' dB'; } }, upd);
      lab2.appendChild(H('div', { class: 'row' }, slB.el, slS.el, PP.btn('Use the scope\'s SNR', function () { if (isFinite(lastSnr)) { slS.set(PP.clamp(Math.round(lastSnr * 2) / 2, 0, 50)); upd(); } }, 'sm ghost')));
      var pipe = H('div', { class: 'bar', style: { height: '22px', marginTop: '8px' } }, H('i', { style: { width: '0%', background: PP.lc('phy', 0.9) } }));
      var shOut = H('div', { class: 'stats' });
      lab2.appendChild(pipe); lab2.appendChild(shOut);
      function upd() {
        var B = slB.get() * 1e6, S = slS.get(), C = N.shannon(B, S), snrLin = Math.pow(10, S / 10);
        pipe.firstChild.style.width = Math.min(100, C / 2.7e9 * 100) + '%';
        shOut.innerHTML = '';
        [['CEILING', N.fmtRate(C), 'a', 'one antenna, ideal coding'], ['S/N (RATIO)', snrLin < 100 ? snrLin.toFixed(1) + '×' : Math.round(snrLin) + '×', '', 'power ratio from ' + S.toFixed(1) + ' dB'], ['BITS PER SYMBOL', Math.log(1 + snrLin) / Math.LN2 < 10 ? (Math.log(1 + snrLin) / Math.LN2).toFixed(2) : (Math.log(1 + snrLin) / Math.LN2).toFixed(1), '', 'log₂(1 + S/N)']].forEach(function (x) {
          shOut.appendChild(H('div', { class: 'stat' }, H('span', { class: 'l' }, x[0]), H('span', { class: 'v ' + x[2] }, x[1]), H('span', { class: 's' }, x[3])));
        });
      }
      upd();
      PP.algo(body, {
        name: 'Correlation detection (the matched filter)',
        idea: 'To decide whether a received bit is a 1 or a 0, compare it with what each would look like. Noise is random, so it averages towards zero over the bit time, while the real signal adds up.',
        steps: ['Take the samples that make up one bit time (here 40).', 'Multiply them, sample by sample, by the shape of a clean 1 and of a clean 0, and add up each result.', 'The larger total wins. For PSK a single sign test is enough: positive means 1.', 'Wider bit time or stronger signal means a bigger gap between the two totals, so fewer errors.'],
        code: 'for each bit:\n  s1 = sum( rx[i] * wave_for_1[i] )\n  s0 = sum( rx[i] * wave_for_0[i] )\n  bit = 1 if s1 > s0 else 0',
        cost: 'This is the exact decoder running in the scope above, not an illustration.'
      });
      PP.algo(body, {
        name: 'Shannon–Hartley capacity',
        idea: 'The hard ceiling on a noisy channel. Real systems get within a fraction of it using modulation and error-correcting codes.',
        steps: ['Measure the bandwidth B in hertz.', 'Convert SNR from decibels to a ratio: S/N = 10^(dB/10).', 'C = B × log₂(1 + S/N).', 'Double the bandwidth and capacity doubles. Double the <i>power</i> and you gain only about one extra bit per symbol.'],
        cost: 'Example: 20 MHz at 30 dB: 20,000,000 × log₂(1001) = about 199 Mb/s per antenna stream.'
      });

      // ---------------- LAB: fibre
      var lab3 = PP.lab(body, 'Inside a fibre', 'Light is launched into the glass core at an angle you control. Inside, it either bounces forever (total internal reflection) or leaks into the cladding. The cut-off is the <b>acceptance cone</b>, set by the two refractive indices. Schematic, not to scale: real cores are 9 to 62 micrometres wide.');
      var slT = PP.slider('Launch angle', { min: 0, max: 30, step: 0.5, value: 8, fmt: function (v) { return v.toFixed(1) + '°'; } }, null);
      var slI = PP.slider('Cladding index n₂', { min: 1.4, max: 1.475, step: 0.005, value: 1.46, fmt: function (v) { return v.toFixed(3); } }, null);
      lab3.appendChild(H('div', { class: 'row' }, slT.el, slI.el));
      var fh = H('div'); lab3.appendChild(fh);
      var fc = PP.canvas(fh, { h: 250 });
      var fstats = H('div', { class: 'stats' }); lab3.appendChild(fstats);
      var N1 = 1.48;
      PP.tick(fh, function (t) {
        var g = fc.g, w = fc.w, h = fc.h, th = slT.get(), n2 = slI.get(), info = N.fiber(N1, n2), sinT = Math.sin(th * Math.PI / 180);
        var guided = sinT <= info.NA, thC = Math.asin(Math.min(1, sinT / N1)), slope = Math.tan(thC) * 2.4, a = h * 0.12, cy = h / 2, x0 = 24, W = w - 48;
        g.clearRect(0, 0, w, h);
        g.fillStyle = PP.hsl(HUE, 60, 40, 0.1); g.fillRect(x0, cy - a - h * 0.2, W, 2 * a + h * 0.4);
        g.fillStyle = PP.hsl(HUE, 90, 55, 0.2); g.fillRect(x0, cy - a, W, 2 * a);
        g.strokeStyle = PP.hsl(HUE, 90, 62, 0.8); g.lineWidth = 1.5; g.strokeRect(x0, cy - a, W, 2 * a);
        g.font = '10.5px ui-monospace,Menlo,Consolas,monospace'; g.textAlign = 'left'; g.fillStyle = 'rgba(241,238,250,.55)';
        g.fillText('CLADDING  n₂ = ' + n2.toFixed(3), x0 + 6, cy - a - h * 0.2 + 14); g.fillText('CORE  n₁ = ' + N1.toFixed(2), x0 + 6, cy - a + 14);
        // ray path
        var pts = [{ x: 0, y: 0 }], x = 0, y = 0, dir = 1, leak = false, guard = 0;
        if (slope < 1e-4) pts.push({ x: W, y: 0 });
        else {
          while (x < W && guard++ < 60) {
            var dy = dir > 0 ? a - y : y + a, dx = dy / slope;
            if (x + dx >= W) { pts.push({ x: W, y: y + dir * (W - x) * slope }); break; }
            x += dx; y = dir * a; pts.push({ x: x, y: y });
            if (!guided) { leak = true; var ex = Math.min(W, x + (h * 0.2) / (slope * 1.8)); pts.push({ x: ex, y: dir * (a + h * 0.2) }); break; }
            dir = -dir;
          }
        }
        var cum = [0]; for (var i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
        g.strokeStyle = guided ? PP.hsl(166, 95, 70, 0.9) : PP.hsl(12, 95, 68, 0.9); g.lineWidth = 2; g.shadowColor = g.strokeStyle; g.shadowBlur = 8; g.beginPath();
        pts.forEach(function (p, j) { if (j) g.lineTo(x0 + p.x, cy + p.y); else g.moveTo(x0 + p.x, cy + p.y); }); g.stroke(); g.shadowBlur = 0;
        var total = cum[cum.length - 1] || 1;
        for (var k = 0; k < 7; k++) {
          var s = ((t * 140 + k * total / 7) % total), j = 1; while (j < cum.length - 1 && cum[j] < s) j++;
          var u = (s - cum[j - 1]) / Math.max(1e-6, cum[j] - cum[j - 1]), px = PP.lerp(pts[j - 1].x, pts[j].x, u), py = PP.lerp(pts[j - 1].y, pts[j].y, u);
          g.fillStyle = leak && j === pts.length - 1 ? 'hsla(12,95%,70%,' + (1 - u) + ')' : '#fff'; g.beginPath(); g.arc(x0 + px, cy + py, 3.5, 0, 7); g.fill();
        }
        // launch cone
        g.strokeStyle = 'rgba(241,238,250,.3)'; g.setLineDash([3, 4]); g.beginPath();
        var ta = Math.tan(info.accept * Math.PI / 180) * 60; g.moveTo(x0 - 60, cy - ta); g.lineTo(x0, cy); g.lineTo(x0 - 60, cy + ta); g.stroke(); g.setLineDash([]);
        g.fillStyle = 'rgba(241,238,250,.55)'; g.fillText('acceptance cone ±' + info.accept.toFixed(1) + '°', 4, h - 8);
        g.textAlign = 'right'; g.fillStyle = guided ? PP.lc('link', 1) : PP.hsl(12, 95, 70, 1); g.font = '700 12px ui-monospace,Menlo,Consolas,monospace';
        g.fillText(guided ? 'GUIDED — total internal reflection' : 'LEAKING — outside the acceptance cone', w - 10, h - 8);
        if (!fstats._k || fstats._k !== th + '|' + n2) {
          fstats._k = th + '|' + n2; fstats.innerHTML = '';
          [['NUMERICAL APERTURE', info.NA.toFixed(3), 'a', '√(n₁² − n₂²)'], ['ACCEPTANCE HALF-ANGLE', info.accept.toFixed(1) + '°', '', 'asin(NA), from air'], ['CRITICAL ANGLE', info.critical.toFixed(1) + '°', '', 'asin(n₂ / n₁), measured from the normal'], ['YOUR RAY', guided ? 'trapped' : 'escapes', guided ? 'a' : '', 'launched at ' + th.toFixed(1) + '°']].forEach(function (x) {
            fstats.appendChild(H('div', { class: 'stat' }, H('span', { class: 'l' }, x[0]), H('span', { class: 'v ' + x[2] }, x[1]), H('span', { class: 's' }, x[3])));
          });
        }
      });
      // attenuation
      var slD = PP.slider('Fibre length', { min: 1, max: 10000, step: 1, value: 100, fmt: function (v) { return PP.fmt(v) + ' km'; } }, updA);
      var attOut = H('div', { class: 'stats' });
      lab3.appendChild(H('div', { class: 'row' }, slD.el)); lab3.appendChild(attOut);
      function updA() {
        var km = slD.get(), dB = 0.2 * km, amps = Math.max(0, Math.ceil(km / 80) - 1), exp = dB / 10;
        attOut.innerHTML = '';
        [['LOSS AT 0.2 dB/km', dB.toFixed(dB < 100 ? 1 : 0) + ' dB', '', 'typical for 1550 nm light'], ['LIGHT LEFT', exp < 6 ? (Math.pow(10, -exp) * 100).toPrecision(2) + '%' : '1 part in 10^' + exp.toFixed(0), exp > 4 ? '' : 'a', 'without amplifiers'], ['AMPLIFIERS NEEDED', amps, 'a', 'one every ~80 km (undersea repeaters)']].forEach(function (x) {
          attOut.appendChild(H('div', { class: 'stat' }, H('span', { class: 'l' }, x[0]), H('span', { class: 'v ' + x[2] }, String(x[1])), H('span', { class: 's' }, x[3])));
        });
      }
      updA();

      // ---------------- LAB: four delays
      var lab4 = PP.lab(body, 'Four delays, one hard floor', 'Every packet pays four delays at each hop: <b>processing</b> (read the header), <b>queuing</b> (wait for the link), <b>transmission</b> (push the bits out, L/R) and <b>propagation</b> (the signal travels, d/s). Only propagation depends on distance, and it can never be zero.');
      var C = PP.CITY, keys = Object.keys(C);
      function sel(def) { var s = H('select'); keys.forEach(function (k) { s.appendChild(H('option', { value: k, selected: k === def }, C[k][0])); }); s.addEventListener('change', calc); return s; }
      var sa = sel('JNB'), sb = sel('LON');
      var slRoute = PP.slider('Path is longer than the straight line by', { min: 1, max: 2.5, step: 0.05, value: 1.4, fmt: function (v) { return '×' + v.toFixed(2); } }, calc);
      var slSize = PP.slider('Packet size', { min: 64, max: 1500, step: 1, value: 1500, fmt: function (v) { return v + ' B'; } }, calc);
      var slHops = PP.slider('Hops', { min: 1, max: 25, value: 12, fmt: function (v) { return v + ' hops'; } }, calc);
      var slQ = PP.slider('Queuing per hop', { min: 0, max: 20, step: 0.1, value: 0.5, fmt: function (v) { return v.toFixed(1) + ' ms'; } }, calc);
      var rate = H('select'); [[1e6, '1 Mb/s'], [1e7, '10 Mb/s'], [1e8, '100 Mb/s'], [1e9, '1 Gb/s'], [1e10, '10 Gb/s']].forEach(function (r) { rate.appendChild(H('option', { value: r[0], selected: r[0] === 1e8 }, r[1])); }); rate.addEventListener('change', calc);
      var medSeg = PP.seg([{ v: 2.0e8, t: 'FIBRE 2.0×10⁸ m/s' }, { v: 3.0e8, t: 'RADIO 3.0×10⁸ m/s' }], 2.0e8, calc);
      lab4.appendChild(H('div', { class: 'grid2' }, H('div', null, H('label', { class: 'fld' }, 'FROM'), sa), H('div', null, H('label', { class: 'fld' }, 'TO'), sb)));
      lab4.appendChild(H('div', { class: 'row' }, slRoute.el, slHops.el));
      lab4.appendChild(H('div', { class: 'row' }, slSize.el, slQ.el));
      lab4.appendChild(H('div', { class: 'row' }, H('div', null, H('label', { class: 'fld' }, 'LINK RATE (each hop)'), rate), H('div', null, H('label', { class: 'fld' }, 'MEDIUM'), medSeg.el)));
      var dbar = H('div', { class: 'bar', style: { height: '18px', margin: '8px 0 4px' } }); var dleg = H('div', { class: 'legend' }); var dout = H('div', { class: 'stats' });
      lab4.appendChild(dbar); lab4.appendChild(dleg); lab4.appendChild(dout);
      function calc() {
        var A = C[sa.value], B = C[sb.value], km = N.haversine(A[1], A[2], B[1], B[2]), speed = medSeg.get(), R = +rate.value, hops = slHops.get();
        var path = km * slRoute.get(), prop = path * 1000 / speed * 1000, tr = slSize.get() * 8 / R * 1000 * hops, proc = 0.02 * hops, que = slQ.get() * hops, one = prop + tr + proc + que;
        var floor = km * 1000 / 2.0e8 * 1000;
        var parts = [['Propagation', prop, 'phy'], ['Transmission', tr, 'link'], ['Processing', proc, 'net'], ['Queuing', que, 'app']];
        dbar.innerHTML = ''; dleg.innerHTML = '';
        parts.forEach(function (p) { dbar.appendChild(H('i', { style: { width: (p[1] / one * 100) + '%', background: PP.lc(p[2], 0.95) }, title: p[0] })); dleg.appendChild(H('span', null, H('i', { style: { background: PP.lc(p[2]) } }), p[0] + ' ' + p[1].toFixed(p[1] < 10 ? 2 : 1) + ' ms')); });
        dout.innerHTML = '';
        [['GREAT-CIRCLE DISTANCE', PP.fmt(km) + ' km', '', C[sa.value][0] + ' to ' + C[sb.value][0]], ['ONE-WAY TOTAL', one.toFixed(1) + ' ms', 'a', 'sum of the four delays'], ['ROUND TRIP', (2 * one).toFixed(1) + ' ms', 'a', 'what ping would show'], ['PHYSICS FLOOR (RTT)', (2 * floor).toFixed(1) + ' ms', '', 'straight fibre, zero equipment']].forEach(function (x) {
          dout.appendChild(H('div', { class: 'stat' }, H('span', { class: 'l' }, x[0]), H('span', { class: 'v ' + x[2] }, x[1]), H('span', { class: 's' }, x[3])));
        });
      }
      calc();
      PP.callout(body, 'truth', 'THE FLOOR IS REAL. Distances are great-circle (haversine). Real routes are longer because cables follow coasts and rights-of-way, so the stretch slider is your estimate, not a measurement. Use chapter 9 to measure a real round trip from this device.');
      PP.deal(body, 'Physical-layer problems you can fix with your hands', [
        '<b>Wi-Fi gets slower with distance or walls.</b> That is the SNR slider above. Move the router central and high, or add an access point wired by cable. Do not rely on a repeater that shares the same radio to talk both ways: it halves your throughput.',
        '<b>Copper Ethernet:</b> 100 m is the limit. Cheap cable, kinks and badly crimped ends cause errors that look like "slow internet". A link that negotiates down to 100 Mb/s instead of 1 Gb/s often has a bad pair.',
        '<b>Fibre:</b> a dirty connector is the single most common fault. Never look into a live fibre or its connector. Respect the bend radius, and clean before you plug.',
        '<b>Interference:</b> 2.4 GHz is shared with Bluetooth, baby monitors and microwave ovens. 5 GHz has more room but shorter range. Chapter 9 has a channel picker.'
      ]);
    }
  });
})();
