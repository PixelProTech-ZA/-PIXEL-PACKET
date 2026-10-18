/* PIXEL PACKET — chapter 07 : NAME (DNS) */
(function () {
  'use strict';
  var N = PP.net, H = PP.h, HUE = 320;

  PP.chapter({
    id: 'name', num: 7, short: 'NAME', layerName: 'LAYER 7 · APPLICATION', title: 'NAME', hue: HUE,
    blurb: 'DNS: the phone book that turns names into addresses, and how it caches.',
    tagline: 'Computers route to numbers. People remember names. DNS is the global, distributed database in between, and when it breaks, "the internet is down".',
    quiz: [
      { q: 'Your browser asks for www.example.com. Who does the actual walk from the root down to the answer?', a: ['The browser itself', 'The recursive resolver (your ISP\'s, or 1.1.1.1 / 8.8.8.8)', 'The root servers, in one step', 'The website\'s own server'], c: 1,
        why: 'Your device only runs a small <i>stub</i> resolver. It hands the whole question to a recursive resolver, which queries the root, then the TLD, then the authoritative server, and caches the answers.' },
      { q: 'A site moved servers, but some people still reach the old one for hours. Why?', a: ['Their computer is broken', 'Cached answers live until their TTL expires', 'DNS only updates at midnight', 'The old server is still online'], c: 1,
        why: 'Every DNS answer carries a TTL (seconds it may be cached). Lower the TTL <i>before</i> a migration (to 300 s, say), switch, then raise it again.' },
      { q: 'What does DNS-over-HTTPS (DoH) protect?', a: ['The website content from the ISP', 'The DNS questions from being read or altered on the path to the resolver', 'Your IP address from the website', 'Nothing: it is only faster'], c: 1,
        why: 'DoH wraps the DNS query in HTTPS, so the network between you and the resolver cannot read or tamper with it. The resolver still sees your questions, and the destination IP is still visible to the ISP.' }
    ],
    build: function (body) {
      PP.prose(body,
        '<p>The <b>Domain Name System</b> is a distributed, hierarchical database. A name is read <i>right to left</i>: in <code>www.example.com.</code> there is an invisible root (the final dot), then <b>com</b> (top-level domain), then <b>example</b> (the organisation), then <b>www</b> (a host). Each level is run by someone different, and each only needs to know who runs the level below.</p>' +
        '<p>Nobody has the whole database. There are <b>13 root server identities</b> (A to M), operated by 12 organisations, served from well over a thousand machines worldwide using <i>anycast</i> (the same address announced from many places, and you reach the nearest).</p>');

      // ---------- resolution ladder
      var labL = PP.lab(body, 'One lookup, step by step', 'What happens when you type a name into a browser with an empty cache. The example name is fictional-safe (<code>example.com</code> is reserved for documentation).');
      PP.ladder(labL, {
        actors: ['YOU (stub)', 'RESOLVER', 'ROOT', '.COM TLD', 'AUTHORITATIVE'], ms: 1700, rowH: 56,
        steps: [
          { from: 0, to: 1, label: 'www.example.com A ?', sub: 'recursion desired', note: '<b>Your device</b> asks its configured resolver (from DHCP: usually the router, which forwards to the ISP). It only wants a final answer.' },
          { from: 1, to: 2, label: 'www.example.com A ?', sub: '', note: '<b>Resolver → root.</b> The resolver has no cached answer, so it asks a root server (it ships with their addresses built in, the "root hints").' },
          { from: 2, to: 1, label: 'ask .com: NS list', sub: 'referral', note: '<b>The root does not know the answer</b> but knows who runs <code>com</code>. It returns a <i>referral</i>: the names and addresses of the .com servers.' },
          { from: 1, to: 3, label: 'www.example.com A ?', sub: '', note: '<b>Resolver → .com servers.</b> Same question, one level down.' },
          { from: 3, to: 1, label: 'ask example.com NS', sub: 'referral', note: '<b>Another referral:</b> the .com servers know which name servers are responsible for <code>example.com</code> (set when the owner registered the domain).' },
          { from: 1, to: 4, label: 'www.example.com A ?', sub: '', note: '<b>Resolver → authoritative server.</b> This one holds the actual records, configured by the domain owner.' },
          { from: 4, to: 1, label: 'A 93.184.216.34', sub: 'TTL 3600', note: '<b>The answer</b>, with a <b>TTL</b>: "you may remember this for 3600 seconds". (The address shown is just the illustration for the reserved example name.)' },
          { from: 1, to: 0, label: 'A 93.184.216.34', sub: 'cached 3600 s', note: '<b>Resolver → you.</b> It stores the answer, so the next person asking gets it in about one millisecond instead of about 100.' },
          { from: 0, to: 0, label: 'now open TCP to it', note: '<b>Only now</b> does your browser start the TCP handshake (chapter 06) to the address it just learned.' }
        ]
      });

      // ---------- query bytes
      var labQ = PP.lab(body, 'The real bytes of a DNS question', 'DNS is a binary protocol. This builds the exact message your device sends for the name you type. Hover or tap a coloured group to read what it means. (Header ID is fixed here only so the picture is stable.)');
      var qn = H('input', { type: 'text', value: 'www.example.com', spellcheck: 'false', style: { maxWidth: '300px' } }), qt = PP.seg([{ v: 1, t: 'A (IPv4)' }, { v: 28, t: 'AAAA (IPv6)' }, { v: 15, t: 'MX (mail)' }, { v: 16, t: 'TXT' }], 1, function () { qb(); });
      labQ.appendChild(H('div', { class: 'row' }, H('div', null, H('label', { class: 'fld' }, 'NAME'), qn), H('div', null, H('label', { class: 'fld' }, 'RECORD TYPE'), qt.el)));
      var qhex = H('div', { class: 'hexdump', style: { overflowX: 'auto' } }), qleg = H('div', { class: 'ladder-note' }, 'Tap a group.'); labQ.appendChild(qhex); labQ.appendChild(qleg);
      function qb() {
        var name = qn.value.trim().replace(/\.$/, ''), labels = name.split('.'), bad = !name || labels.some(function (l) { return !l || l.length > 63 || !/^[A-Za-z0-9_-]+$/.test(l); }) || name.length > 253;
        qhex.innerHTML = ''; if (bad) { qleg.textContent = 'Enter a valid name: labels of letters, digits or hyphen, up to 63 characters each.'; return; }
        var G = [[[0x12, 0x34], 'ID', 'Random 16-bit ID. The reply must echo it so the answer can be matched to the question (and, being random, harder to forge).', 12],
        [[0x01, 0x00], 'FLAGS', '0x0100: QR=0 (a query), opcode 0 (standard), <b>RD=1</b> (recursion desired). A response sets QR=1, adds RA (recursion available) and the response code (0 OK, 3 NXDOMAIN = no such name).', 38],
        [[0, 1], 'QDCOUNT = 1', 'One question follows.', 200], [[0, 0], 'ANCOUNT = 0', 'No answers in a query.', 200], [[0, 0], 'NSCOUNT = 0', 'No authority records.', 200], [[0, 0], 'ARCOUNT = 0', 'No additional records.', 200]];
        labels.forEach(function (l) { var b = [l.length]; for (var i = 0; i < l.length; i++) b.push(l.charCodeAt(i)); G.push([b, 'LABEL "' + l + '"', 'Names are length-prefixed: <b>' + l.length + '</b> then the ' + l.length + ' ASCII bytes of "' + l + '". There are no dots on the wire.', 166]); });
        G.push([[0], 'END (0)', 'A zero-length label marks the root: the end of the name.', 166]);
        var ty = qt.get(); G.push([[ty >> 8, ty & 255], 'QTYPE = ' + ty, 'What record is wanted: 1=A, 28=AAAA, 15=MX, 16=TXT, 2=NS, 5=CNAME.', 320]); G.push([[0, 1], 'QCLASS = IN', 'Class 1 is "Internet". The others are historical.', 262]);
        var total = 0; G.forEach(function (g) { total += g[0].length; });
        G.forEach(function (g) {
          var s = H('span', { class: 'hxg', tabindex: '0', style: { color: PP.hsl(g[3], 85, 72, 1), borderBottom: '2px solid ' + PP.hsl(g[3], 85, 60, 0.8), marginRight: '8px', display: 'inline-block', cursor: 'pointer', font: '13px var(--mono)', padding: '2px 0' }, text: g[0].map(function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join(' ') });
          var show = function () { qleg.innerHTML = '<b>' + g[1] + '</b> &nbsp;' + g[2]; }; s.addEventListener('mouseenter', show); s.addEventListener('click', show); s.addEventListener('focus', show); qhex.appendChild(s);
        });
        qhex.appendChild(H('div', { style: { marginTop: '8px', font: '12px var(--mono)', color: 'var(--faint)' } }, 'Total: ' + total + ' bytes in one UDP datagram to port 53. A browser-sized HTML page weighs thousands of times more, yet nothing loads without these ' + total + '.'));
      }
      qn.addEventListener('input', qb); qb();

      // ---------- cache sim
      var labC = PP.lab(body, 'Caching and TTL', 'A resolver\'s cache is the reason DNS is fast. Ask for names and advance the clock: answers are served from cache until their TTL runs out. This is a simulation with made-up records, to show the rule.');
      var recs = { 'shop.example.com': { ip: '192.0.2.10', ttl: 300 }, 'news.example.com': { ip: '192.0.2.20', ttl: 60 }, 'static.example.com': { ip: '192.0.2.30', ttl: 86400 } };
      var clock = 0, cache = {}, clog = H('div', { class: 'log' }), ccache = H('div', { class: 'scroll-x' });
      var cb = H('div', { class: 'row' }); Object.keys(recs).forEach(function (n) { cb.appendChild(PP.btn('Ask ' + n.split('.')[0], function () { ask(n); }, 'sm')); });
      cb.appendChild(PP.btn('+30 s', function () { adv(30); }, 'sm ghost')); cb.appendChild(PP.btn('+5 min', function () { adv(300); }, 'sm ghost')); cb.appendChild(PP.btn('Flush cache', function () { cache = {}; l('cache flushed (like <code>ipconfig /flushdns</code>)'); paintC(); }, 'sm ghost'));
      labC.appendChild(cb); labC.appendChild(H('div', { class: 'grid2' }, H('div', null, H('label', { class: 'fld' }, 'RESOLVER CACHE'), ccache), H('div', null, H('label', { class: 'fld' }, 'LOG'), clog)));
      function l(s) { clog.insertBefore(H('div', { html: '<b>t=' + clock + 's</b> ' + s }), clog.firstChild); }
      function adv(s) { clock += s; Object.keys(cache).forEach(function (k) { if (cache[k].exp <= clock) { l(k + ' expired from cache (TTL ran out)'); delete cache[k]; } }); l('clock +' + s + ' s'); paintC(); }
      function ask(n) { var c = cache[n]; if (c && c.exp > clock) l('<b>CACHE HIT</b> ' + n + ' → ' + c.ip + ' in ~1 ms (' + (c.exp - clock) + ' s left)'); else { cache[n] = { ip: recs[n].ip, exp: clock + recs[n].ttl }; l('<b>MISS</b> ' + n + ': full lookup (~60–150 ms) → ' + recs[n].ip + ', cached for ' + recs[n].ttl + ' s'); } paintC(); }
      function paintC() {
        ccache.innerHTML = ''; var t = H('table', { class: 'table' }, H('tr', null, ['NAME', 'ADDRESS', 'TTL LEFT'].map(function (x) { return H('th', null, x); }))), any = 0;
        Object.keys(cache).forEach(function (k) { any = 1; var left = cache[k].exp - clock, pct = left / recs[k].ttl * 100; t.appendChild(H('tr', null, H('td', null, k), H('td', null, cache[k].ip), H('td', null, left + ' s', H('div', { class: 'bar', style: { height: '4px', marginTop: '4px' } }, H('i', { style: { width: pct + '%', background: 'hsl(320,90%,68%)' } }))))); });
        if (!any) t.appendChild(H('tr', null, H('td', { colspan: 3 }, 'empty'))); ccache.appendChild(t);
      }
      paintC(); l('clock starts. Ask for a name.');
      PP.algo(body, {
        name: 'Iterative resolution with caching',
        idea: 'Split the work: authoritative servers hold the truth for their own zone and nothing else; recursive resolvers do the walking and remember what they learn.',
        steps: ['Check the cache for the full answer. If it is there and its TTL has not expired, return it.', 'Otherwise find the closest cached delegation (NS records) for the name. With nothing cached, start at the root hints.', 'Ask that server. If it answers authoritatively, cache the answer and return it. If it returns a referral (NS records), cache those too and ask the next server down.', 'Failures are cached as well (negative caching: NXDOMAIN, RFC 2308), so a typo storm does not hammer the root.'],
        code: 'resolve(name, type):\n  if cache has (name,type) and not expired: return it\n  server = closest_known_ns(name) or ROOT\n  loop:\n    r = ask(server, name, type)\n    if r.answer:   cache(r); return r\n    if r.referral: cache(r.ns); server = pick(r.ns)\n    else: return error',
        cost: 'About 3–4 round trips cold, zero on a hit. Most lookups are hits, which is why DNS handles trillions of queries a day.'
      });

      // ---------- LIVE DoH
      var labD = PP.lab(body, 'LIVE: ask a real resolver from this page', 'This sends a real <b>DNS-over-HTTPS</b> request from your browser to a public resolver and times it. If your network blocks it, you will see <b>NOT AVAILABLE</b> with the reason: nothing here is pretended. Your question goes to the resolver you pick (Cloudflare or Google), so use a name you are happy to share.');
      var dn = H('input', { type: 'text', value: 'example.com', spellcheck: 'false', style: { maxWidth: '260px' } }), dty = PP.seg([{ v: 'A', t: 'A' }, { v: 'AAAA', t: 'AAAA' }, { v: 'MX', t: 'MX' }, { v: 'TXT', t: 'TXT' }, { v: 'NS', t: 'NS' }], 'A', null);
      var dres = H('div'), dbtn = PP.btn('Look it up', function () { doh(); }, '');
      labD.appendChild(H('div', { class: 'row' }, H('div', null, H('label', { class: 'fld' }, 'NAME'), dn), H('div', null, H('label', { class: 'fld' }, 'TYPE'), dty.el), dbtn)); labD.appendChild(dres);
      var TN = { 1: 'A', 2: 'NS', 5: 'CNAME', 15: 'MX', 16: 'TXT', 28: 'AAAA', 6: 'SOA' }, RC = ['NOERROR (ok)', 'FORMERR', 'SERVFAIL', 'NXDOMAIN (no such name)', 'NOTIMP', 'REFUSED'];
      async function q1(url, to) { var ac = new AbortController(), id = setTimeout(function () { ac.abort(); }, to), t0 = performance.now(); try { var r = await fetch(url, { headers: { Accept: 'application/dns-json' }, signal: ac.signal, cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); var j = await r.json(); return { j: j, ms: performance.now() - t0 }; } finally { clearTimeout(id); } }
      async function doh() {
        var name = dn.value.trim().replace(/\.$/, ''); dres.innerHTML = '';
        if (!name || !/^[A-Za-z0-9._-]+$/.test(name)) { PP.callout(dres, 'bad', 'Enter a valid domain name.'); return; }
        dbtn.disabled = true; dres.appendChild(H('div', { class: 'ladder-note' }, 'asking…'));
        var srcs = [['Cloudflare (cloudflare-dns.com)', 'https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(name) + '&type=' + dty.get()], ['Google (dns.google)', 'https://dns.google/resolve?name=' + encodeURIComponent(name) + '&type=' + dty.get()]], fails = [], got = null;
        for (var i = 0; i < srcs.length && !got; i++) { try { var r = await q1(srcs[i][1], 6000); got = { src: srcs[i][0], r: r }; } catch (e) { fails.push(srcs[i][0] + ': ' + (e && e.name === 'AbortError' ? 'timed out after 6 s' : (e && e.message) || 'blocked')); } }
        dbtn.disabled = false; dres.innerHTML = '';
        if (!got) { PP.callout(dres, 'bad', '<b>NOT AVAILABLE.</b> Could not reach a DoH resolver from this page. ' + fails.join(' · ') + '. Possible reasons: you are offline, a firewall or school/work network blocks DoH, or a browser extension blocks the request. This is a real limit of your network, not a bug in the lesson.'); return; }
        var j = got.r.j;
        PP.callout(dres, '', '<b>LIVE</b> &middot; answered by <b>' + got.src + '</b> in <b>' + got.r.ms.toFixed(0) + ' ms</b> (includes your HTTPS round trip; the resolver may have served it from its cache) &middot; status <b>' + (RC[j.Status] || j.Status) + '</b>' + (j.AD ? ' &middot; DNSSEC validated (AD)' : ''));
        var t = H('table', { class: 'table' }, H('tr', null, ['NAME', 'TYPE', 'TTL', 'DATA'].map(function (x) { return H('th', null, x); })));
        (j.Answer || []).forEach(function (a) { t.appendChild(H('tr', null, H('td', null, a.name), H('td', null, TN[a.type] || a.type), H('td', null, a.TTL + ' s'), H('td', null, a.data))); });
        if (!(j.Answer || []).length) t.appendChild(H('tr', null, H('td', { colspan: 4 }, 'no answer records (the name exists with no data of this type, or does not exist)')));
        var w = H('div', { class: 'scroll-x' }); w.appendChild(t); dres.appendChild(w);
      }
      PP.algo(body, { name: 'What the record types mean', idea: 'The same name can hold several kinds of record, each answering a different question.', steps: ['<b>A / AAAA</b>: the IPv4 / IPv6 address of a host.', '<b>CNAME</b>: "this name is an alias of that name". Cannot sit at the zone apex next to other records.', '<b>MX</b>: which servers receive email for the domain, with a preference number (lowest first).', '<b>TXT</b>: free text. Used for SPF/DKIM/DMARC email authentication and domain-ownership proofs.', '<b>NS</b>: which servers are authoritative. <b>SOA</b>: zone administration data. <b>PTR</b>: reverse lookup, address → name.'], cost: 'Lookups are cheap; the hard part is propagation: every cache between you and the authority keeps the old answer until its TTL expires.' });

      PP.deal(body, 'DNS problems you will actually meet', [
        '<b>Can ping 8.8.8.8 but not google.com:</b> the network works, DNS does not. Change the resolver (1.1.1.1, 8.8.8.8, or your ISP\'s), or fix the router\'s DNS setting.',
        '<b>Site works on phone data but not on Wi-Fi:</b> the Wi-Fi\'s resolver is broken or filtering. Test with <code>nslookup name 1.1.1.1</code> against a different resolver.',
        '<b>Changed a record but nothing changes:</b> wait for the old TTL; flush local cache (Windows <code>ipconfig /flushdns</code>, macOS <code>sudo dscacheutil -flushcache</code>, Linux <code>resolvectl flush-caches</code>); query the authoritative server directly with <code>dig @ns1.yourhost name</code>.',
        '<b>"DNS_PROBE_FINISHED_NXDOMAIN":</b> the name does not exist: usually a typo, an expired domain, or a missing record.',
        '<b>Email going to spam:</b> check SPF, DKIM and DMARC TXT records. They are DNS records, and receivers check them.',
        '<b>Privacy:</b> plain DNS is readable by everyone on the path. DoH/DoT (DNS-over-TLS) hide the question from the network, but the resolver you choose still sees it. Choose a resolver you trust.'
      ]);
    }
  });
})();
