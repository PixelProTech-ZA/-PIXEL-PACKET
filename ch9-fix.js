/* PIXEL PACKET — chapter 09 : FIX (troubleshooting, commands, live measurements) */
(function () {
  'use strict';
  var N = PP.net, H = PP.h, HUE = 150;

  PP.chapter({
    id: 'fix', num: 9, short: 'FIX', layerName: 'ALL LAYERS', title: 'FIX', hue: HUE,
    blurb: 'A repeatable method, the commands, and real measurements from your own connection.',
    tagline: 'Troubleshooting is not guessing. Walk up the layers from the cable to the app, and the first test that fails tells you where the problem lives.',
    quiz: [
      { q: 'You can ping 1.1.1.1 but "ping example.com" says the name cannot be resolved. Where is the fault?', a: ['The cable', 'DNS', 'The website\'s firewall', 'Your IP address'], c: 1,
        why: 'The path to the internet works (ping by number succeeded). Only the name-to-address step fails: DNS. Change resolver or check the router\'s DNS setting.' },
      { q: 'A traceroute shows * * * on hop 5, but hops 6, 7 and the destination answer normally. What does that mean?', a: ['Hop 5 is broken and traffic is failing', 'Hop 5 just does not answer ICMP probes; traffic still passes through it', 'The destination is down', 'You are being attacked'], c: 1,
        why: 'Many routers rate-limit or ignore TTL-exceeded replies. If later hops respond, packets clearly passed through. Only worry when everything after a point is silent.' },
      { q: 'Why is the first request in a latency test usually slower than the next ones?', a: ['The server wakes up', 'It pays for DNS, TCP and TLS setup; later requests reuse the connection', 'The browser throttles it', 'Random noise only'], c: 1,
        why: 'The first request includes name lookup, TCP handshake and TLS. Later ones ride the warm connection. Good tools discard the warm-up sample or report it separately.' }
    ],
    build: function (body) {
      PP.prose(body,
        '<p>Every network problem is a failure at <i>some</i> layer. The method: test from the <b>bottom up</b>, one layer at a time, and stop at the first failure. A test that passes also tells you something: everything beneath it is fine. This one habit beats any amount of rebooting and hoping.</p>');

      // ---------- decision tree
      var T = {
        n0: { layer: 'phy', q: 'Does your device say it is connected? (Wi-Fi joined, or cable plugged in with the link light on)', yes: 'n1', no: 'L0' },
        n1: { layer: 'link', q: 'Does it have a valid IP address? (not blank, not 169.254.x.x)', yes: 'n2', no: 'L1' },
        n2: { layer: 'net', q: 'Can you ping the default gateway (your router, often 192.168.x.1)?', yes: 'n3', no: 'L2' },
        n3: { layer: 'net', q: 'Can you ping a public address by number? (ping 1.1.1.1)', yes: 'n4', no: 'L3' },
        n4: { layer: 'app', q: 'Can you ping by name? (ping example.com)', yes: 'n5', no: 'L4' },
        n5: { layer: 'tcp', q: 'Can you reach the service port? (see the command tabs: port test to host:443)', yes: 'n6', no: 'L5' },
        n6: { layer: 'app', q: 'Does the site or app work now in a normal browser window?', yes: 'L7', no: 'L6' },
        L0: { leaf: 1, layer: 'phy', t: 'Layer 1–2 problem: no link', f: ['Toggle Wi-Fi off/on, or airplane mode on/off.', 'Wired: re-seat both ends, try another cable and another port. Look for the link light.', 'Test a second device on the same network: if it also fails, the problem is the router, not your device.', 'Wi-Fi: forget the network and rejoin; check you are in range (below about −70 dBm things get unreliable).'] },
        L1: { leaf: 1, layer: 'link', t: 'Layer 2–3 problem: no valid address (DHCP failed)', f: ['169.254.x.x means the device asked for an address and nobody answered.', 'Power-cycle the router (clears a full or stuck lease table).', 'Check the router\'s DHCP pool is enabled and not exhausted (lots of old devices, short pool).', 'Release/renew the lease: Windows <code>ipconfig /release</code> then <code>/renew</code>.'] },
        L2: { leaf: 1, layer: 'net', t: 'Local network problem: you cannot reach your own router', f: ['Wi-Fi: move closer; change the channel (see the channel lab below); switch between 2.4 and 5 GHz.', 'Check for a wrong subnet: device 192.168.1.x but router at 192.168.0.1 means a static address was left in place. Set the adapter to automatic (DHCP).', 'Router MAC-filtering or client isolation / guest-network isolation enabled.', 'Reboot router and device. If still failing, the router or its Wi-Fi radio may be faulty.'] },
        L3: { leaf: 1, layer: 'net', t: 'The router works but nothing beyond it does: WAN or ISP', f: ['Log in to the router: does it show a WAN/internet IP? None means the modem/fibre/line is down.', 'WAN IP in 100.64–100.127.x.x: you are behind CGNAT. Outbound is fine; inbound hosting is not possible.', 'Fibre: check the ONT lights (a red LOS light means the fibre signal is lost: call your ISP). DSL/cable: check modem sync lights.', 'Check the ISP\'s outage page from mobile data. Run <code>traceroute 1.1.1.1</code>: if hop 1 (the router) answers and nothing after does, the fault is upstream.'] },
        L4: { leaf: 1, layer: 'app', t: 'DNS problem: the network works, name lookup does not', f: ['Switch the DNS server to 1.1.1.1 or 8.8.8.8 on the device or router. If that fixes it, your ISP\'s resolver was the problem.', 'Flush the local cache (see the command tabs).', 'Check a VPN, security software, or a "family safe" DNS setting is not overriding.', 'Use the LIVE DoH lookup in chapter 07 to see if the name resolves through another path.'] },
        L5: { leaf: 1, layer: 'tcp', t: 'The address resolves, but the port does not open', f: ['<b>Timeout</b>: a firewall is silently dropping packets (your PC, router, the server\'s firewall, or a school/work filter).', '<b>Refused</b>: the server is up but nothing listens on that port (service stopped or wrong port).', 'Try from another network (phone data). If it works there, your network blocks it. If it fails everywhere, the server side is down.', 'Check IPv6 vs IPv4: a broken IPv6 path with a working IPv4 one causes long delays. Test with <code>ping -4</code> and <code>ping -6</code>.'] },
        L6: { leaf: 1, layer: 'app', t: 'Network is fine: the fault is TLS or the application', f: ['Wrong date/time on the device breaks certificates: check the clock first.', 'A proxy, VPN or antivirus HTTPS-scanning can break connections. Disable temporarily to test.', 'Try another browser or a private window (extensions, stale cookies, corrupted cache).', 'Look at the actual error: certificate error, 4xx (your request), 5xx (their server). The status code tells you whose problem it is.'] },
        L7: { leaf: 1, layer: 'app', t: 'It works now. Was it intermittent?', f: ['Measure instead of guessing: run the LIVE latency probe below for a minute and look at jitter and spikes.', 'Intermittent drops usually mean Wi-Fi interference (channel), a failing cable or port, or a congested uplink (bufferbloat).', 'Note the time and the symptom. Patterns (every evening, only when the microwave runs) are the clue.'] }
      };
      var labT = PP.lab(body, 'The bottom-up decision tree', 'Answer from your own device as you go (the command tabs below show how to run each test). Each answer lights one layer.');
      var path = [], tbox = H('div'); labT.appendChild(tbox);
      function tree(id) {
        var n = T[id]; tbox.innerHTML = '';
        var trail = H('div', { class: 'row', style: { gap: '6px', marginBottom: '10px' } });
        path.forEach(function (p) { trail.appendChild(H('span', { style: { font: '11px var(--mono)', padding: '3px 8px', border: '1px solid ' + PP.lc(T[p.id].layer, 0.8), color: PP.lc(T[p.id].layer, 1, 72) } }, (p.ans ? '✔ ' : '✘ ') + T[p.id].layer.toUpperCase())); });
        tbox.appendChild(trail);
        if (!n.leaf) {
          tbox.appendChild(H('div', { class: 'stat', style: { borderLeft: '4px solid ' + PP.lc(n.layer, 1), marginBottom: '10px' } }, H('span', { class: 'l', style: { color: PP.lc(n.layer, 1, 70) } }, 'TEST ' + (path.length + 1) + ' · LAYER ' + n.layer.toUpperCase()), H('span', { class: 'v', style: { fontSize: '16px', fontWeight: 500 } }, n.q)));
          tbox.appendChild(H('div', { class: 'row' }, PP.btn('Yes, it works', function () { path.push({ id: id, ans: 1 }); tree(n.yes); }, ''), PP.btn('No, it fails', function () { path.push({ id: id, ans: 0 }); tree(n.no); }, 'ghost'), path.length ? PP.btn('◀ Back', function () { var p = path.pop(); tree(p.id); }, 'sm ghost') : ''));
        } else {
          tbox.appendChild(H('div', { class: 'stat', style: { borderLeft: '4px solid ' + PP.lc(n.layer, 1), marginBottom: '10px' } }, H('span', { class: 'l', style: { color: PP.lc(n.layer, 1, 70) } }, 'DIAGNOSIS'), H('span', { class: 'v', style: { fontSize: '17px' } }, n.t)));
          var ul = H('ol', { class: 'steps' }); n.f.forEach(function (f) { ul.appendChild(H('li', { html: f })); }); tbox.appendChild(ul);
          tbox.appendChild(H('div', { class: 'row' }, PP.btn('Start over', function () { path = []; tree('n0'); }, 'sm ghost'), path.length ? PP.btn('◀ Back', function () { var p = path.pop(); tree(p.id); }, 'sm ghost') : ''));
        }
      }
      tree('n0');

      // ---------- command tabs
      var labC = PP.lab(body, 'The commands, per system', 'Run these in a terminal (Windows: Command Prompt or PowerShell; macOS: Terminal; Linux: any shell). Replace example.com with your target. None of them change anything except where noted.');
      var CMD = [
        ['See your address, gateway, DNS', 'ipconfig /all', 'ipconfig getifaddr en0 &&  netstat -nr | grep default && scutil --dns | grep nameserver', 'ip -br addr; ip route; resolvectl status'],
        ['Ping your router / the internet', 'ping 192.168.1.1\nping 1.1.1.1', 'ping -c 4 192.168.1.1\nping -c 4 1.1.1.1', 'ping -c 4 192.168.1.1\nping -c 4 1.1.1.1'],
        ['Trace the path', 'tracert example.com', 'traceroute example.com', 'traceroute example.com   # or: mtr -rwc 20 example.com'],
        ['Look up DNS', 'nslookup example.com 1.1.1.1', 'dig example.com @1.1.1.1', 'dig example.com @1.1.1.1'],
        ['Test a port', 'Test-NetConnection example.com -Port 443   # PowerShell', 'nc -vz example.com 443', 'nc -vz example.com 443'],
        ['Who is listening on my machine', 'netstat -ano | findstr LISTEN', 'lsof -iTCP -sTCP:LISTEN -n -P', 'ss -tlnp'],
        ['Flush the DNS cache (changes local cache only)', 'ipconfig /flushdns', 'sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder', 'resolvectl flush-caches'],
        ['Renew the DHCP lease (briefly drops connection)', 'ipconfig /release && ipconfig /renew', 'sudo ipconfig set en0 DHCP', 'sudo dhclient -r && sudo dhclient'],
        ['See Wi-Fi signal and channel', 'netsh wlan show interfaces', '/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I   # older macOS; newer: hold Option and click the Wi-Fi icon', 'nmcli dev wifi list']
      ];
      PP.tabs(labC, [{ t: 'WINDOWS', i: 1 }, { t: 'MACOS', i: 2 }, { t: 'LINUX', i: 3 }].map(function (o) { return { t: o.t, render: function (el) { CMD.forEach(function (c) { el.appendChild(H('div', { class: 'fld', style: { marginTop: '10px' } }, c[0].toUpperCase())); el.appendChild(PP.code(c[o.i])); }); } }; }));

      // ---------- LIVE measurements
      var labM = PP.lab(body, 'LIVE: measure the connection you are on', 'Real numbers from this browser, right now. Each reading says where it came from, and when the browser will not tell us something it says <b>NOT AVAILABLE</b> instead of inventing a value.');
      var info = H('div', { class: 'stats' }); labM.appendChild(info);
      function paintInfo() {
        info.innerHTML = ''; var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        function s(l, v, sub, a) { info.appendChild(H('div', { class: 'stat' }, H('span', { class: 'l' }, l), H('span', { class: 'v ' + (a || ''), style: { fontSize: '15px' } }, v), H('span', { class: 's' }, sub))); }
        s('BROWSER SAYS ONLINE', navigator.onLine ? 'yes' : 'NO', 'navigator.onLine: only means "has a network interface", not "internet works"', navigator.onLine ? 'a' : '');
        if (c) { s('EFFECTIVE TYPE', c.effectiveType || 'n/a', 'browser\'s estimate (slow-2g / 2g / 3g / 4g), a rough class, not a measurement'); s('ESTIMATED RTT', c.rtt !== undefined ? c.rtt + ' ms' : 'n/a', 'rounded estimate from recent traffic'); s('ESTIMATED DOWNLINK', c.downlink !== undefined ? c.downlink + ' Mbit/s' : 'n/a', 'rounded; capped by the browser'); s('DATA SAVER', c.saveData ? 'on' : 'off', 'navigator.connection.saveData'); }
        else s('CONNECTION DETAILS', 'NOT AVAILABLE', 'this browser (for example Safari and Firefox desktop) does not expose the Network Information API');
        s('SECURE CONTEXT', window.isSecureContext ? 'yes' : 'no', 'https:// or localhost; some features need it'); s('LANGUAGE / TZ', (navigator.language || '?') + ' · ' + (Intl.DateTimeFormat().resolvedOptions().timeZone || '?'), 'from the browser');
      }
      paintInfo(); window.addEventListener('online', paintInfo); window.addEventListener('offline', paintInfo); var cx = navigator.connection; if (cx && cx.addEventListener) cx.addEventListener('change', paintInfo);

      var probeSeg = PP.seg([{ v: 'self', t: 'THIS APP\'S SERVER' }, { v: 'cf', t: 'CLOUDFLARE EDGE' }], 'self', null);
      var runB = PP.btn('Run 20 probes', function () { probe(); }, ''), pst = H('div', { class: 'ladder-note' }, 'Pick a target and run. The first probe is a warm-up and is not counted.');
      labM.appendChild(H('div', { class: 'row', style: { marginTop: '12px' } }, probeSeg.el, runB));
      var phost = H('div'), pcv = PP.canvas(phost, { h: 200 }); labM.appendChild(phost); labM.appendChild(pst);
      var pstat = H('div', { class: 'stats' }); labM.appendChild(pstat);
      var samples = [], failed = 0, running = false;
      async function probe() {
        if (running) return; running = true; runB.disabled = true; samples = []; failed = 0; var tgt = probeSeg.get();
        pst.innerHTML = tgt === 'self' ? 'Measuring round trips to <b>the server that delivered this app</b> (if that is your own computer, it will show about 0 ms: honest, but not the internet).' : 'Measuring HTTPS round trips to <b>Cloudflare\'s nearest edge</b> (opaque request: only timing is readable, never content).';
        for (var i = 0; i < 21; i++) {
          var url = tgt === 'self' ? location.pathname + '?probe=' + Date.now() + '_' + i : 'https://www.cloudflare.com/cdn-cgi/trace?probe=' + Date.now() + '_' + i, t0 = performance.now(), ac = new AbortController(), to = setTimeout(function () { ac.abort(); }, 4000);
          try { await fetch(url, { method: 'GET', cache: 'no-store', mode: tgt === 'self' ? 'same-origin' : 'no-cors', signal: ac.signal }); var ms = performance.now() - t0; if (i > 0) samples.push(ms); } catch (e) { if (i > 0) failed++; }
          clearTimeout(to); await new Promise(function (r) { setTimeout(r, 150); }); calc();
        }
        running = false; runB.disabled = false;
        if (!samples.length) pst.innerHTML = '<b>NOT AVAILABLE.</b> Every probe failed (' + failed + '). You may be offline, or the target is blocked on this network or by an extension.';
        else pst.innerHTML = '<b>LIVE</b> &middot; ' + samples.length + ' samples, ' + failed + ' failed. Jitter is how much latency wobbles: good for calls under ~30 ms, bad above ~100 ms. Values include browser and HTTPS overhead, so they run a little above a raw ping.';
      }
      function calc() {
        pstat.innerHTML = ''; if (!samples.length) return;
        var mn = Math.min.apply(null, samples), mx = Math.max.apply(null, samples), av = samples.reduce(function (a, b) { return a + b; }, 0) / samples.length, jt = 0; for (var i = 1; i < samples.length; i++) jt += Math.abs(samples[i] - samples[i - 1]); jt = samples.length > 1 ? jt / (samples.length - 1) : 0;
        var sorted = samples.slice().sort(function (a, b) { return a - b; }), p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
        [['MIN', mn.toFixed(0) + ' ms', ''], ['AVERAGE', av.toFixed(0) + ' ms', 'a'], ['95TH PERCENTILE', p95.toFixed(0) + ' ms', ''], ['MAX', mx.toFixed(0) + ' ms', ''], ['JITTER (mean change)', jt.toFixed(1) + ' ms', 'a'], ['FAILED', failed + ' of ' + (samples.length + failed), failed ? '' : '']].forEach(function (x) { pstat.appendChild(H('div', { class: 'stat' }, H('span', { class: 'l' }, x[0]), H('span', { class: 'v ' + x[2] }, x[1]))); });
      }
      PP.tick(phost, function () {
        var g = pcv.g, w = pcv.w, h = pcv.h, L = 40, R = w - 8, T0 = 12, B = h - 18; g.clearRect(0, 0, w, h);
        g.font = '10px ui-monospace,Menlo,monospace'; g.fillStyle = 'rgba(241,238,250,.35)'; g.textAlign = 'right';
        if (!samples.length) { g.textAlign = 'center'; g.fillText('no data yet: press Run', w / 2, h / 2); return; }
        var mx = Math.max(10, Math.max.apply(null, samples) * 1.15), n = samples.length;
        for (var k = 0; k <= 3; k++) { var y = B - (B - T0) * k / 3; g.strokeStyle = 'rgba(241,238,250,.07)'; g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke(); g.fillText((mx * k / 3).toFixed(0) + ' ms', L - 4, y + 3); }
        var bw = (R - L) / 20;
        samples.forEach(function (s, i) { var hh = (B - T0) * s / mx; g.fillStyle = s > mx * 0.8 ? 'hsl(12,90%,64%)' : 'hsl(150,85%,58%)'; g.fillRect(L + i * bw + 1, B - hh, bw - 2, hh); });
      });

      // navigation timing
      var navT = H('div'); labM.appendChild(H('label', { class: 'fld', style: { marginTop: '14px' } }, 'HOW THIS PAGE LOADED (Navigation Timing, from your browser)')); labM.appendChild(navT);
      (function () {
        var e = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
        if (!e) { navT.appendChild(PP.callout(null, 'bad', '<b>NOT AVAILABLE</b>: this browser does not report Navigation Timing.')); return; }
        var parts = [['DNS', e.domainLookupEnd - e.domainLookupStart, 320], ['TCP connect', (e.secureConnectionStart > 0 ? e.secureConnectionStart : e.connectEnd) - e.connectStart, 262], ['TLS', e.secureConnectionStart > 0 ? e.connectEnd - e.secureConnectionStart : 0, 12], ['Waiting (server)', e.responseStart - e.requestStart, 38], ['Download', e.responseEnd - e.responseStart, 166]].map(function (p) { return [p[0], Math.max(0, p[1]), p[2]]; });
        var tot = parts.reduce(function (a, p) { return a + p[1]; }, 0) || 1;
        var bar = H('div', { class: 'bar', style: { height: '22px' } }); parts.forEach(function (p) { bar.appendChild(H('i', { style: { width: Math.max(0.5, p[1] / tot * 100) + '%', background: PP.hsl(p[2], 85, 60, 0.95) }, title: p[0] })); }); navT.appendChild(bar);
        navT.appendChild(H('div', { class: 'row', style: { marginTop: '6px', font: '12px var(--mono)', color: 'var(--dim)' } }, parts.map(function (p) { return H('span', { style: { color: PP.hsl(p[2], 85, 72, 1) } }, p[0] + ' ' + p[1].toFixed(1) + ' ms'); })));
        navT.appendChild(H('div', { class: 'ladder-note', html: 'Zero values are normal for a page served from localhost or from the service-worker cache: no DNS, connect or TLS was needed. That is the offline-first benefit, measured.' }));
      })();

      // ---------- Wi-Fi channel lab
      var labW = PP.lab(body, 'Wi-Fi channel picker (2.4 GHz)', 'Channels 1 to 13 are only 5 MHz apart but each signal is about 20 MHz wide, so neighbouring channels overlap badly. Only <b>1, 6 and 11</b> are clear of each other. Enter the networks around you (from a Wi-Fi scanner), and the tool scores every channel with the engine\'s overlap model. A browser cannot scan Wi-Fi itself, so the list is yours: nothing is detected or faked.');
      var nets = [{ ch: 1, w: 3 }, { ch: 6, w: 4 }, { ch: 6, w: 2 }, { ch: 11, w: 3 }, { ch: 9, w: 2 }], nlist = H('div'), wcv, whost = H('div'), wres = H('div');
      labW.appendChild(nlist); labW.appendChild(H('div', { class: 'row' }, PP.btn('+ Add a neighbour network', function () { nets.push({ ch: 6, w: 3 }); paintW(); }, 'sm'), PP.btn('Clear all', function () { nets = []; paintW(); }, 'sm ghost'))); labW.appendChild(whost); labW.appendChild(wres);
      wcv = PP.canvas(whost, { h: 230 });
      function paintW() {
        nlist.innerHTML = '';
        nets.forEach(function (n, i) {
          var sel = H('select', { style: { width: '96px', flex: '0 0 auto' }, onchange: function () { n.ch = +sel.value; paintW(); } }); for (var c = 1; c <= 13; c++) { var o = H('option', { value: c, text: 'ch ' + c }); if (c === n.ch) o.selected = true; sel.appendChild(o); }
          var sl = H('input', { type: 'range', min: 1, max: 5, value: n.w, style: { width: '140px' }, oninput: function () { n.w = +sl.value; calcW(); } });
          nlist.appendChild(H('div', { class: 'row', style: { gap: '10px', alignItems: 'center' } }, H('span', { style: { font: '12px var(--mono)', color: 'var(--faint)' } }, 'NET ' + (i + 1)), sel, H('span', { style: { font: '11px var(--mono)', color: 'var(--faint)' } }, 'strength'), sl, PP.btn('✕', function () { nets.splice(i, 1); paintW(); }, 'sm ghost')));
        }); calcW();
      }
      function calcW() {
        wres.innerHTML = ''; var all = []; for (var c = 1; c <= 13; c++) all.push(c);
        var costs = all.map(function (c) { var s = 0; nets.forEach(function (n) { s += n.w * N.chOverlap(c, n.ch); }); return { ch: c, cost: s }; });
        var b3 = N.bestChannel(nets, [1, 6, 11]), b13 = N.bestChannel(nets, all);
        wres._costs = costs; wres._b3 = b3;
        wres.appendChild(H('div', { class: 'stats' }, H('div', { class: 'stat' }, H('span', { class: 'l' }, 'BEST OF 1 / 6 / 11'), H('span', { class: 'v a' }, 'channel ' + b3.ch), H('span', { class: 's' }, 'interference score ' + b3.cost.toFixed(2) + '. The recommended choice: you share a channel but do not smear across others.')), H('div', { class: 'stat' }, H('span', { class: 'l' }, 'LOWEST SCORE OF ANY CHANNEL'), H('span', { class: 'v' }, 'channel ' + b13.ch), H('span', { class: 's' }, 'score ' + b13.cost.toFixed(2) + (b13.ch % 5 !== 1 && [1, 6, 11].indexOf(b13.ch) < 0 ? '. Looks good only because it is far from <i>these</i> networks; it will overlap newcomers and hurt everyone. Prefer 1, 6, 11.' : '.')))));
      }
      PP.tick(whost, function () {
        var g = wcv.g, w = wcv.w, h = wcv.h, L = 14, R = w - 14, B = h - 26, T0 = 14, X = function (f) { return L + (f - 2397) / (2497 - 2397) * (R - L); }; g.clearRect(0, 0, w, h);
        g.strokeStyle = 'rgba(241,238,250,.18)'; g.beginPath(); g.moveTo(L, B); g.lineTo(R, B); g.stroke(); g.fillStyle = 'rgba(241,238,250,.5)'; g.font = '10px ui-monospace,Menlo,monospace'; g.textAlign = 'center';
        for (var c = 1; c <= 13; c++) g.fillText(c, X(N.chFreq(c)), B + 14);
        nets.forEach(function (n, i) { var f = N.chFreq(n.ch), hgt = (B - T0) * (0.25 + n.w * 0.15); g.beginPath(); g.moveTo(X(f - 11), B); g.bezierCurveTo(X(f - 6), B - hgt * 1.3, X(f + 6), B - hgt * 1.3, X(f + 11), B); g.closePath(); g.fillStyle = PP.hsl((i * 53 + 150) % 360, 85, 60, 0.22 + 0.04 * Math.sin(performance.now() * 0.003 + i)); g.fill(); g.strokeStyle = PP.hsl((i * 53 + 150) % 360, 85, 66, 0.9); g.lineWidth = 1.5; g.stroke(); });
        var best = wres._b3; if (best) { var f = N.chFreq(best.ch); g.strokeStyle = 'hsl(150,90%,62%)'; g.setLineDash([4, 4]); g.lineWidth = 2; g.beginPath(); g.moveTo(X(f), B); g.lineTo(X(f), T0); g.stroke(); g.setLineDash([]); g.fillStyle = 'hsl(150,90%,62%)'; g.fillText('BEST ' + best.ch, X(f), T0 - 2); }
      });
      paintW();

      // ---------- traceroute annotated
      var labR = PP.lab(body, 'Reading a traceroute (annotated SAMPLE: illustrative, not a live trace)', 'This is example output so you can learn to read one. A real trace shows your own path (you can run it from the command tabs).');
      var rows = [['1', '192.168.1.1', '1.2 ms', 'Your router. Always hop 1. Slow or failing here means a local problem.'], ['2', '10.40.0.1', '8.5 ms', 'ISP\'s first device (a private address is common here). The last-mile link has added ~7 ms.'], ['3', '196.x.x.x', '9.1 ms', 'ISP aggregation router.'], ['4', '* * *', '', 'No reply: this router does not answer probes. <b>Not a fault</b> if later hops respond.'], ['5', 'ix-peer.example', '11.8 ms', 'An internet exchange or peering link between networks.'], ['6', 'transit.example', '168.3 ms', '<b>Big jump (+156 ms)</b>: usually a long undersea or intercontinental hop. Fine if it stays high afterwards; a jump that <i>returns to low</i> is just a router slow to answer.'], ['7', 'edge.example', '169.0 ms', 'Stays high: the real distance cost. Latency is a floor set by the speed of light in glass (about 5 µs per km).'], ['8', 'server.example', '169.4 ms', 'Destination reached: the path works. Total ~169 ms.']];
      var rt = H('table', { class: 'table' }, H('tr', null, ['HOP', 'ADDRESS', 'RTT', 'WHAT IT MEANS'].map(function (x) { return H('th', null, x); }))); rows.forEach(function (r) { rt.appendChild(H('tr', null, H('td', null, r[0]), H('td', null, r[1]), H('td', null, r[2]), H('td', { html: r[3] }))); }); var rw = H('div', { class: 'scroll-x' }); rw.appendChild(rt); labR.appendChild(rw);
      PP.algo(body, { name: 'How traceroute works', idea: 'IP packets carry a Time-To-Live counter that every router decrements. A router that drops it to zero throws the packet away and sends back an error naming itself. Traceroute abuses that on purpose.', steps: ['Send a probe with TTL = 1. The first router decrements it to 0, drops it, and replies "time exceeded". Now you know hop 1 and its round-trip time.', 'Send a probe with TTL = 2: it dies at hop 2. Then TTL = 3, and so on.', 'Stop when the destination itself answers (a port-unreachable or an echo reply).', 'Each hop is probed 3 times; "*" means no reply within the timeout.'], code: 'for ttl in 1, 2, 3, ...:\n  send probe(dst, ttl)\n  reply = wait(timeout)\n  print(ttl, reply.source or "*", reply.rtt)\n  if reply.source == dst: break', cost: 'The reply shows the path the <i>probe</i> took, and the return path can differ. That asymmetry is why one-way delay cannot be read from RTT/2 reliably.' });
      PP.deal(body, 'The short field guide', [
        '<b>Change one thing at a time</b> and re-test. Changing five things then finding it works teaches you nothing.',
        '<b>Always compare</b>: another device, another network (phone data), another site. A problem on all of them is yours; on one of them is theirs.',
        '<b>Wi-Fi vs everything else</b>: plug a laptop into the router with a cable. If cable is fine, it is the radio, not the line.',
        '<b>Write down</b> the symptom, the time and what you tested. If you call your ISP, "I can ping my router but not 1.1.1.1, traceroute stops after hop 1" gets you past first-line scripts.',
        '<b>Slow, not down?</b> Test during the problem, not after. Intermittent faults hide as soon as you start looking.'
      ]);
    }
  });
})();
