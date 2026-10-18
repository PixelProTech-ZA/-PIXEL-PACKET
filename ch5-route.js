/* PIXEL PACKET — chapter 05 : ROUTE (longest prefix match, shortest path, BGP) */
(function () {
  'use strict';
  var N = PP.net, H = PP.h, HUE = 200;

  PP.chapter({
    id: 'route', num: 5, short: 'ROUTE', layerName: 'LAYER 3 · NETWORK', title: 'ROUTE', hue: HUE,
    blurb: 'How a router chooses, and how the whole internet agrees on where things are.',
    tagline: 'No router knows the whole path. Each only knows the next hop. The internet works because millions of tiny local decisions line up.',
    quiz: [
      { q: 'A router has 10.0.0.0/8, 10.1.0.0/16 and 10.1.2.0/24. Where does a packet for 10.1.2.77 go?', a: ['The /8 route: shortest prefix wins', 'The /16 route: it is in the middle', 'The /24 route: the longest matching prefix wins', 'It is load-balanced across all three'], c: 2,
        why: 'All three match, so the router picks the most specific one: the <b>longest prefix</b>. This is also how a BGP hijack works: a more specific announcement beats the real one.' },
      { q: 'What is the real difference between Dijkstra (link-state) and Bellman-Ford (distance-vector) in routing?', a: ['Dijkstra is faster, so it is always used', 'Link-state routers each learn the whole map and compute paths; distance-vector routers only trade distances with neighbours', 'Distance-vector can only handle two routers', 'There is no real difference'], c: 1,
        why: 'OSPF and IS-IS flood the topology so every router runs Dijkstra on the same map. RIP trades "I can reach X in N hops" with neighbours only (Bellman-Ford), which is simpler but slower to converge.' },
      { q: 'What does BGP route on, between different organisations?', a: ['The fastest measured path', 'Policy: business relationships and AS-path, not speed', 'Geographic distance', 'The lowest packet loss'], c: 1,
        why: 'BGP does not measure speed. It prefers what the operator configured (local preference, customer over peer over transit), then the shortest AS path. Money and contracts decide, not milliseconds.' }
    ],
    build: function (body) {
      PP.prose(body,
        '<p>A <b>router</b> has one job: look at the destination address of each packet and decide which neighbour to hand it to. That decision uses the <b>routing table</b>: a list of prefixes, each pointing to a next hop. The table is built by <b>routing protocols</b>, which are algorithms that let routers share what they know.</p>' +
        '<p>Two layers of problem. <b>Inside</b> one organisation, routers can share complete maps and compute shortest paths (OSPF, IS-IS, RIP). <b>Between</b> organisations (about 75,000+ autonomous systems), they cannot share everything or trust everyone, so <b>BGP</b> exchanges reachability and policy instead.</p>');

      // ---------- LPM
      var routes = [
        { net: N.ip2int('0.0.0.0'), p: 0, hop: 'ISP uplink', tag: 'default' },
        { net: N.ip2int('10.0.0.0'), p: 8, hop: 'core router', tag: 'private' },
        { net: N.ip2int('10.1.0.0'), p: 16, hop: 'building B', tag: '' },
        { net: N.ip2int('10.1.2.0'), p: 24, hop: 'room 12 switch', tag: '' },
        { net: N.ip2int('208.65.152.0'), p: 22, hop: 'Transit A (real owner)', tag: 'owner' }
      ];
      var hijacked = false, dest = N.ip2int('10.1.2.77');
      var labL = PP.lab(body, 'Longest prefix match: the bit trie', 'Every route is a path down a binary tree: bit 0 goes left, bit 1 goes right, and a route ends at depth P. Your packet\'s destination drops down its own bit path. The <i>deepest</i> route it passes through wins. Try the real 2008 case with the preset button.');
      var dIn = H('input', { type: 'text', value: '10.1.2.77', spellcheck: 'false', style: { maxWidth: '240px' } });
      var presets = H('div', { class: 'row' },
        PP.btn('10.1.2.77', function () { setD('10.1.2.77'); }, 'sm ghost'), PP.btn('10.1.9.1', function () { setD('10.1.9.1'); }, 'sm ghost'), PP.btn('8.8.8.8', function () { setD('8.8.8.8'); }, 'sm ghost'),
        PP.btn('YouTube-range 208.65.153.238', function () { setD('208.65.153.238'); }, 'sm ghost'),
        PP.btn('24 Feb 2008: a rogue /24 appears', function () { hijacked = !hijacked; if (hijacked) { routes.push({ net: N.ip2int('208.65.153.0'), p: 24, hop: 'Pakistan Telecom (wrong!)', tag: 'rogue' }); setD('208.65.153.238'); } else { routes = routes.filter(function (r) { return r.tag !== 'rogue'; }); } paintL(); }, 'sm'));
      labL.appendChild(H('div', null, H('label', { class: 'fld' }, 'DESTINATION ADDRESS'), dIn)); labL.appendChild(presets);
      var lhost = H('div'), lcv = PP.canvas(lhost, { h: 330 }); labL.appendChild(lhost);
      var ltb = H('div', { class: 'scroll-x' }), lnote = H('div'); labL.appendChild(ltb); labL.appendChild(lnote);
      function setD(s) { dIn.value = s; var v = N.ip2int(s); if (v !== null) dest = v; paintL(); }
      dIn.addEventListener('input', function () { var v = N.ip2int(dIn.value.trim()); dIn.style.borderColor = v === null ? 'hsl(12 90% 64%)' : ''; if (v !== null) { dest = v; paintL(); } });
      function common(a, b) { var x = (a ^ b) >>> 0; return x === 0 ? 32 : Math.clz32(x); }
      function paintL() {
        var win = N.lpm(routes, dest); ltb.innerHTML = '';
        var t = H('table', { class: 'table' }, H('tr', null, ['PREFIX', 'NEXT HOP', 'BITS MATCHING', 'RESULT'].map(function (x) { return H('th', null, x); })));
        routes.slice().sort(function (a, b) { return b.p - a.p; }).forEach(function (r) {
          var cm = common(r.net, dest), ok = cm >= r.p;
          t.appendChild(H('tr', { class: r === win ? 'win' : '' }, H('td', null, N.int2ip(r.net) + '/' + r.p), H('td', null, r.hop), H('td', null, Math.min(cm, r.p) + ' / ' + r.p + ' needed'), H('td', null, r === win ? 'WINS (longest)' : ok ? 'matches, but shorter' : 'no match')));
        });
        ltb.appendChild(t);
        lnote.innerHTML = '';
        if (win) PP.callout(lnote, win.tag === 'rogue' ? 'bad' : '', 'Packet for <b>' + N.int2ip(dest) + '</b> is sent to <b>' + win.hop + '</b> via ' + N.int2ip(win.net) + '/' + win.p + (win.tag === 'rogue' ? '. <b>This is a hijack.</b> The /24 is more specific than the real owner\'s /22, so every router that hears it prefers it. On 24 Feb 2008 Pakistan Telecom announced a /24 inside YouTube\'s /22 to block YouTube locally; the announcement leaked to the wider internet and pulled YouTube traffic into Pakistan for roughly two hours.' : '.'));
      }
      PP.tick(lhost, function (t) {
        var g = lcv.g, w = lcv.w, h = lcv.h, top = 26, bot = h - 14, maxD = 24, win = N.lpm(routes, dest), pad = 20;
        g.clearRect(0, 0, w, h);
        function pt(net, d) { var x = 0.5, st = 0.25; for (var i = 0; i < d; i++) { var b = (net >>> (31 - i)) & 1; x += (b ? 1 : -1) * st; st /= 2; } return { x: pad + x * (w - pad * 2), y: top + (d / maxD) * (bot - top) }; }
        g.font = '10px ui-monospace,Menlo,monospace'; g.fillStyle = 'rgba(241,238,250,.3)'; g.textAlign = 'left';
        [0, 8, 16, 24].forEach(function (d) { var y = top + (d / maxD) * (bot - top); g.strokeStyle = 'rgba(241,238,250,.07)'; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); g.fillText('/' + d, 4, y - 3); });
        function path(net, to, col, lw) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); var p = pt(net, 0); g.moveTo(p.x, p.y); for (var d = 1; d <= to; d++) { p = pt(net, d); g.lineTo(p.x, p.y); } g.stroke(); }
        routes.forEach(function (r) { path(r.net, Math.min(r.p, maxD), r.tag === 'rogue' ? 'hsla(12,90%,64%,.55)' : 'hsla(200,70%,60%,.45)', 1.4); });
        var dd = Math.min(common(dest, win ? win.net : 0), maxD); if (win) dd = Math.min(win.p, maxD);
        path(dest, maxD, 'hsla(38,90%,62%,.25)', 1);
        if (win) path(dest, Math.min(win.p, maxD), 'hsla(150,85%,60%,1)', 3.2);
        var ph = (t * 0.0006) % 1, ps = pt(dest, 0); // travelling packet
        var dep = ph * (win ? Math.min(win.p, maxD) : maxD), di = Math.floor(dep), a = pt(dest, di), b = pt(dest, Math.min(di + 1, maxD));
        g.fillStyle = '#fff'; g.beginPath(); g.arc(PP.lerp(a.x, b.x, dep - di), PP.lerp(a.y, b.y, dep - di), 4, 0, 7); g.fill();
        routes.forEach(function (r) {
          var p = pt(r.net, Math.min(r.p, maxD)), isW = r === win, rad = isW ? 7 + 2 * Math.sin(t * 0.006) : 5;
          g.fillStyle = isW ? 'hsl(150,85%,60%)' : r.tag === 'rogue' ? 'hsl(12,90%,64%)' : 'hsl(200,90%,62%)'; g.beginPath(); g.arc(p.x, p.y, rad, 0, 7); g.fill();
          g.fillStyle = 'rgba(241,238,250,.85)'; g.textAlign = p.x > w * 0.6 ? 'right' : 'left'; g.fillText(N.int2ip(r.net) + '/' + r.p, p.x + (p.x > w * 0.6 ? -10 : 10), p.y + 3);
        });
      });
      paintL();
      PP.algo(body, {
        name: 'Longest-prefix match (LPM)',
        idea: 'Many prefixes can contain one address. The most specific (longest) prefix is the one the owner meant for it, so it always wins. This lets a /24 carve an exception out of a /16 without deleting anything.',
        steps: ['Find every route where (destination AND mask) equals the route\'s network.', 'Pick the one with the largest prefix length.', 'Forward to its next hop. If nothing matches, there is no route: drop and send an ICMP "unreachable".'],
        code: 'best = None\nfor r in routes:\n  if (dst & r.mask) == r.net:\n    if best is None or r.plen > best.plen:\n      best = r\nreturn best.next_hop',
        cost: 'Linear scan above is O(n). Real routers use a binary trie or TCAM hardware: O(32) lookups, or one clock cycle, for 1,000,000+ routes.'
      });

      // ---------- shortest path
      var NODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      var POS = { A: [0.08, 0.5], B: [0.28, 0.16], C: [0.28, 0.84], D: [0.5, 0.5], E: [0.7, 0.16], F: [0.7, 0.84], G: [0.92, 0.5] };
      var EDGES = [{ a: 'A', b: 'B', w: 4 }, { a: 'A', b: 'C', w: 2 }, { a: 'B', b: 'C', w: 1 }, { a: 'B', b: 'D', w: 5 }, { a: 'C', b: 'D', w: 8 }, { a: 'C', b: 'F', w: 10 }, { a: 'D', b: 'E', w: 2 }, { a: 'D', b: 'F', w: 2 }, { a: 'E', b: 'G', w: 3 }, { a: 'F', b: 'G', w: 1 }, { a: 'B', b: 'E', w: 9 }];
      var labP = PP.lab(body, 'Find the shortest path (OSPF vs RIP)', 'Pick an algorithm and step through it. <b>Dijkstra</b> repeatedly settles the closest unsettled router. <b>Bellman-Ford</b> runs in rounds where every router adopts the best offer from its neighbours, which is how distance-vector protocols behave. <b>Click any link to cut it</b> and watch the network re-converge.');
      var algo = 'dij', src = 'A', dst = 'G', si = 0, steps = [];
      var segA = PP.seg([{ v: 'dij', t: 'DIJKSTRA (link-state)' }, { v: 'bf', t: 'BELLMAN-FORD (distance-vector)' }], 'dij', function (v) { algo = v; recompute(); });
      var segS = PP.seg(NODES.map(function (n) { return { v: n, t: n }; }), 'A', function (v) { src = v; recompute(); });
      var segD = PP.seg(NODES.map(function (n) { return { v: n, t: n }; }), 'G', function (v) { dst = v; paintP(); });
      labP.appendChild(segA.el);
      labP.appendChild(H('div', { class: 'row' }, H('div', null, H('label', { class: 'fld' }, 'FROM'), segS.el), H('div', null, H('label', { class: 'fld' }, 'TO'), segD.el)));
      var pctl = H('div', { class: 'row' }, PP.btn('◀ Back', function () { si = Math.max(0, si - 1); paintP(); }, 'sm ghost'), PP.btn('Step ▶', function () { si = Math.min(steps.length - 1, si + 1); paintP(); }, 'sm'), PP.btn('Run to end', function () { si = steps.length - 1; paintP(); }, 'sm ghost'), PP.btn('Restore all links', function () { EDGES.forEach(function (e) { e.down = false; }); recompute(); }, 'sm ghost'));
      labP.appendChild(pctl);
      var pst = H('div'), pcv = PP.svg('svg', { class: 'sv', viewBox: '0 0 700 300', preserveAspectRatio: 'xMidYMid meet' }); pst.appendChild(pcv); labP.appendChild(pst);
      var ptb = H('div', { class: 'scroll-x' }), pnote = H('div', { class: 'ladder-note' }); labP.appendChild(ptb); labP.appendChild(pnote);
      function recompute() { steps = algo === 'dij' ? N.dijkstraSteps(NODES, EDGES, src) : N.bellmanSteps(NODES, EDGES, src); si = Math.min(si, steps.length - 1); si = 0; paintP(); }
      function paintP() {
        var s = steps[si], last = si === steps.length - 1, rel = (algo === 'dij' && s.rel) ? s.rel : [], relIdx = {}; rel.forEach(function (r) { relIdx[r.ei] = r; });
        var path = (last && s.dist[dst] !== Infinity) ? N.pathTo(s.prev, src, dst) : null, onPath = {};
        if (path) for (var i = 1; i < path.length; i++) { EDGES.forEach(function (e, k) { if (!e.down && ((e.a === path[i - 1] && e.b === path[i]) || (e.b === path[i - 1] && e.a === path[i]))) onPath[k] = 1; }); }
        pcv.innerHTML = '';
        function P(n) { return { x: 40 + POS[n][0] * 620, y: 30 + POS[n][1] * 240 }; }
        EDGES.forEach(function (e, k) {
          var a = P(e.a), b = P(e.b), col = e.down ? 'rgba(241,238,250,.12)' : onPath[k] ? 'hsl(150,85%,60%)' : relIdx[k] ? (relIdx[k].imp ? 'hsl(38,90%,62%)' : 'hsl(200,60%,55%)') : 'rgba(241,238,250,.3)';
          var ln = PP.svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: col, 'stroke-width': onPath[k] ? 5 : relIdx[k] ? 3 : 2, 'stroke-dasharray': e.down ? '4 6' : '', style: 'cursor:pointer' });
          var hit = PP.svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: 'transparent', 'stroke-width': 22, style: 'cursor:pointer' });
          hit.addEventListener('click', function () { e.down = !e.down; recompute(); });
          pcv.appendChild(ln); pcv.appendChild(hit);
          var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; pcv.appendChild(PP.svg('rect', { x: mx - 11, y: my - 10, width: 22, height: 20, rx: 3, fill: '#07070A', stroke: 'rgba(241,238,250,.25)' }));
          var tx = PP.svg('text', { x: mx, y: my + 4, 'text-anchor': 'middle', fill: e.down ? 'hsl(12,90%,64%)' : '#F1EEFA', 'font-size': 12, 'font-weight': 700, 'pointer-events': 'none' }); tx.textContent = e.down ? '✕' : e.w; pcv.appendChild(tx);
        });
        NODES.forEach(function (n) {
          var p = P(n), d = s.dist[n], settled = algo === 'dij' ? s.done && s.done[n] : d !== Infinity, cur = algo === 'dij' ? s.cur === n : (s.changed || []).indexOf(n) >= 0, inP = path && path.indexOf(n) >= 0;
          pcv.appendChild(PP.svg('circle', { cx: p.x, cy: p.y, r: 25, fill: inP ? 'hsl(150,70%,28%)' : cur ? 'hsl(38,80%,32%)' : settled ? 'hsl(200,60%,26%)' : '#0e0e16', stroke: n === src ? '#fff' : cur ? 'hsl(38,90%,62%)' : 'rgba(241,238,250,.4)', 'stroke-width': n === src ? 3 : 2 }));
          var t1 = PP.svg('text', { x: p.x, y: p.y - 1, 'text-anchor': 'middle', fill: '#fff', 'font-size': 15, 'font-weight': 700 }); t1.textContent = n; pcv.appendChild(t1);
          var t2 = PP.svg('text', { x: p.x, y: p.y + 14, 'text-anchor': 'middle', fill: 'hsl(38,90%,70%)', 'font-size': 11 }); t2.textContent = d === Infinity ? '∞' : d; pcv.appendChild(t2);
        });
        ptb.innerHTML = '';
        var t = H('table', { class: 'table' }, H('tr', null, H('th', null, 'ROUTER'), NODES.map(function (n) { return H('th', null, n); })));
        t.appendChild(H('tr', null, H('td', null, 'distance'), NODES.map(function (n) { return H('td', null, s.dist[n] === Infinity ? '∞' : s.dist[n]); })));
        t.appendChild(H('tr', null, H('td', null, 'via'), NODES.map(function (n) { return H('td', null, s.prev[n] || (n === src ? 'self' : '–')); })));
        ptb.appendChild(t);
        var msg;
        if (algo === 'dij') msg = s.kind === 'init' ? '<b>Start.</b> ' + src + ' is distance 0, everything else is ∞.' : '<b>Settle ' + s.cur + ' (distance ' + s.dist[s.cur] + ').</b> It is the closest router not yet settled, so its distance is final. Its links are relaxed: ' + (s.rel.filter(function (r) { return r.imp; }).map(function (r) { return r.to; }).join(', ') || 'no neighbour improved') + '.';
        else msg = s.kind === 'init' ? '<b>Round 0.</b> Only ' + src + ' knows a route (to itself).' : '<b>Round ' + s.round + '.</b> Every router looked at its neighbours\' distances from the previous round. ' + (s.changed.length ? 'Updated: ' + s.changed.join(', ') + '.' : '<b>Nothing changed: converged.</b>');
        if (last) msg += path ? ' &nbsp;<b>Shortest path ' + src + '→' + dst + ': ' + path.join(' → ') + ' (cost ' + s.dist[dst] + ').</b>' : (src === dst ? '' : ' &nbsp;<b>' + dst + ' is unreachable.</b>');
        pnote.innerHTML = msg;
      }
      recompute();
      PP.algo(body, {
        name: 'Dijkstra\'s shortest path (OSPF, IS-IS)',
        idea: 'Greedy and exact: the closest unsettled node can never be improved by a longer route, because all link costs are positive. Settle it, then see what it opens up.',
        steps: ['dist[source] = 0, all others ∞. All nodes unsettled.', 'Pick the unsettled node u with the smallest dist. Mark it settled.', 'For each neighbour v of u: if dist[u] + cost(u,v) < dist[v], update dist[v] and prev[v] = u.', 'Repeat until all reachable nodes are settled. Follow prev[] backwards from the target to read the path.'],
        code: 'while unsettled:\n  u = argmin(dist over unsettled)\n  settle(u)\n  for v, w in neighbours(u):\n    if dist[u] + w < dist[v]:\n      dist[v] = dist[u] + w; prev[v] = u',
        cost: 'O((V + E) log V) with a priority queue. Each OSPF router runs this on the same link-state database, so they agree.'
      });
      PP.algo(body, {
        name: 'Bellman-Ford (distance-vector, RIP)',
        idea: 'Each router only needs to ask neighbours: "how far are you from X?" Add the link cost, keep the best. Repeat until nobody changes. No router needs the whole map.',
        steps: ['Each router starts knowing only itself (distance 0).', 'Each round, router v computes min over neighbours n of (cost(v,n) + dist_n), using the neighbours\' values from the previous round.', 'Stop when a full round changes nothing.', 'A broken link makes a router advertise a worse route; bad news travels slowly ("count to infinity"). RIP caps hops at 15 so infinity is 16.'],
        cost: 'O(V·E). At most V−1 rounds. Simple and low memory, but slower to converge than link-state.'
      });

      // ---------- BGP
      PP.prose(body,
        '<h3 class="h3">BGP: the internet\'s glue</h3>' +
        '<p>Each large network is an <b>Autonomous System (AS)</b> with a number (AS15169 is Google, AS13335 is Cloudflare). They are connected by <b>customer → provider</b> (pay) and <b>peer ↔ peer</b> (swap traffic free) relationships. Over BGP, an AS tells its neighbours "I can reach this prefix, via this AS path". Receiving several candidates for one prefix, a router selects <b>the best</b>, in roughly this order:</p>');
      var order = [['Longest prefix', 'Not part of "best path" itself: LPM happens first. A more specific route always beats a less specific one.'],
      ['Highest LOCAL_PREF', 'Your own policy. Usually: customer routes (they pay you) over peers (free) over transit (you pay).'],
      ['Shortest AS_PATH', 'Fewer networks in the path. A rough, crude proxy for "closer".'],
      ['Lowest ORIGIN, then MED', 'Hints about how the route started and which entry point the neighbour prefers.'],
      ['eBGP over iBGP, then lowest IGP cost', 'Leave my network at the nearest exit ("hot potato").'],
      ['Final tie-breakers', 'Oldest route, lowest router ID.']];
      var ol = H('div', { class: 'grid2' }); order.forEach(function (o, i) { ol.appendChild(H('div', { class: 'stat' }, H('span', { class: 'l' }, 'STEP ' + i), H('span', { class: 'v a', style: { fontSize: '14px' } }, o[0]), H('span', { class: 's' }, o[1]))); }); body.appendChild(ol);
      PP.callout(body, 'bad', '<b>BGP trusts what it is told.</b> By default nobody checks that an AS is allowed to announce a prefix. Two famous consequences: the <b>2008 YouTube/Pakistan Telecom</b> hijack (above), and on <b>4 Oct 2021</b> Facebook withdrew the BGP routes to its own DNS servers during a maintenance error, so Facebook, Instagram and WhatsApp vanished from the internet for about six hours. The fix being deployed is <b>RPKI</b>: cryptographically signed statements of "this AS may originate this prefix".');
      PP.deal(body, 'Routing problems you will actually meet', [
        '<b>"I can ping my router but not the internet":</b> your default route or the ISP link is the problem, not your Wi-Fi. Run a traceroute and see where it stops (chapter 09).',
        '<b>Traceroute dies in the middle, then works for the destination:</b> a router in the middle simply does not answer ICMP. Only worry if the <i>destination</i> never replies.',
        '<b>Traffic takes a strange long path:</b> BGP routes on policy and cost, not distance. A packet from Pretoria to a server in Johannesburg can hairpin via Europe if the two ISPs do not peer. Peering at an IXP is the fix.',
        '<b>Static routes on a small office router:</b> keep them few and documented. A forgotten static route outlives the staff who added it.'
      ]);
    }
  });
})();
