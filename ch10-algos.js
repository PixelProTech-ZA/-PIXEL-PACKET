/* PIXEL PACKET — chapter 99 : ALGORITHM INDEX */
(function () {
  'use strict';
  var H = PP.h;
  var A = [
    ['Internet checksum', 'trail', 'Sum 16-bit words with end-around carry, then invert. Protects IP/TCP/UDP headers. Cheap, catches most single errors.', 'sum = 0\nfor w in words16(data): sum += w\nwhile sum >> 16: sum = (sum & 0xFFFF) + (sum >> 16)\nreturn ~sum & 0xFFFF', 'O(n)'],
    ['Packet vs circuit switching (binomial tail)', 'origin', 'If each of n users is active a fraction p of the time, P(more than k active) = sum of C(n,i) p^i (1-p)^(n-i). Sharing wins because users rarely peak together.', 'P = sum(C(n,i) * p**i * (1-p)**(n-i) for i in range(k+1, n+1))', 'O(n)'],
    ['Line coding (NRZ, Manchester, ASK/FSK/PSK)', 'wire', 'Turn bits into signal levels or waveforms. Manchester puts a transition in every bit (self-clocking); PSK encodes bits as phase and is decoded by correlating with a reference.', 'manchester: 1 -> (low,high)   0 -> (high,low)\ndecode: compare first half to second half', 'O(n)'],
    ['Shannon capacity', 'wire', 'The hard limit of any noisy channel: C = B log2(1 + S/N). More bandwidth or cleaner signal; nothing else.', 'C = B * log2(1 + snr_linear)   # snr_linear = 10**(dB/10)', 'O(1)'],
    ['Snell\'s law and total internal reflection (fibre)', 'wire', 'Light stays in the fibre if it hits the core/cladding boundary beyond the critical angle: sin(theta_c) = n2/n1.', 'theta_c = asin(n2 / n1)   # needs n1 > n2', 'O(1)'],
    ['Haversine great-circle distance', 'wire', 'Shortest path over a sphere between two lat/long points; the floor for propagation delay (about 5 microseconds per km in glass).', 'a = sin(dlat/2)**2 + cos(lat1)*cos(lat2)*sin(dlon/2)**2\nd = 2 * R * asin(sqrt(a))', 'O(1)'],
    ['CRC-32 (polynomial long division)', 'link', 'Treat the frame as a huge binary number and divide by a fixed polynomial using XOR. The remainder is the check value; a receiver whose division leaves a remainder of 0 accepts. Detects all burst errors up to 32 bits.', 'for bit in message_bits_padded:\n  if reg & TOP: reg = (reg << 1) ^ POLY\n  else:         reg <<= 1', 'O(n)'],
    ['MAC learning (transparent bridge)', 'link', 'A switch learns "address X is behind port P" from the source of every frame, forwards known destinations to one port, floods unknown ones, and ages entries out.', 'table[src] = (in_port, now)\nif dst in table: send(table[dst].port)\nelse: flood(except in_port)', 'O(1) per frame (hash)'],
    ['CSMA/CD binary exponential backoff', 'link', 'After the k-th collision wait a random number of slot times in [0, 2^min(k,10) - 1]; give up after 16. Contention thins out automatically.', 'k = min(attempts, 10)\nwait = random(0, 2**k - 1) * slot_time', 'O(1)'],
    ['Network / broadcast from address and mask', 'address', 'network = ip AND mask; broadcast = network OR NOT mask; hosts = 2^(32-p) - 2.', 'net = ip & mask\nbc  = net | (~mask & 0xFFFFFFFF)', 'O(1)'],
    ['VLSM allocation', 'address', 'Sort requirements largest first, give each the smallest power-of-two block that fits (hosts + 2), aligned to its own size.', 'for n in sorted(needs, reverse=True):\n  size = 2**ceil(log2(n+2)); cur = align(cur, size); alloc(cur, size); cur += size', 'O(k log k)'],
    ['DHCP (DORA) and NAT/PAT', 'address', 'Discover/Offer/Request/Ack gives a lease. NAT keeps a table (inside ip:port) <-> (public ip:port) so many hosts share one address.', 'out: table[(pub, newport)] = (src, sport); rewrite src\nin:  (src, sport) = table[(dst, dport)]; rewrite dst', 'O(1) per packet'],
    ['Longest-prefix match', 'route', 'Among all routes containing the destination, choose the longest prefix. Real routers use a binary trie or TCAM.', 'best = max((r for r in routes if match(dst, r)), key=plen)', 'O(32) trie'],
    ['Dijkstra shortest path', 'route', 'Repeatedly settle the nearest unsettled node and relax its edges. Link-state routing (OSPF, IS-IS).', 'while unsettled:\n  u = argmin(dist)\n  for v, w in adj[u]: dist[v] = min(dist[v], dist[u] + w)', 'O((V+E) log V)'],
    ['Bellman-Ford / distance-vector', 'route', 'Each node adopts the best (neighbour distance + link cost). Rounds repeat until stable. RIP; also the root of count-to-infinity.', 'for round in range(V-1):\n  for (u,v,w) in edges: dist[v] = min(dist[v], dist[u] + w)', 'O(V*E)'],
    ['BGP best-path selection', 'route', 'Policy first: longest prefix, highest local-pref, shortest AS path, lowest origin/MED, eBGP over iBGP, lowest IGP cost, lowest router ID.', 'candidates = filter_by_each_rule_in_order(routes)', 'O(routes)'],
    ['TCP three-way handshake and sequence numbers', 'transport', 'SYN / SYN-ACK / ACK agree on initial sequence numbers; cumulative ACKs name the next expected byte.', 'C->S SYN(seq=x)\nS->C SYN+ACK(seq=y, ack=x+1)\nC->S ACK(ack=y+1)', 'O(1) setup, 1 RTT'],
    ['AIMD congestion control (Reno)', 'transport', 'Slow start doubles, then +1 per RTT; on loss halve. Many flows converge to a fair share.', 'on ack:  cwnd += 1 if cwnd < ssthresh else 1/cwnd\non loss: ssthresh = cwnd/2; cwnd = ssthresh', 'O(1) per ACK'],
    ['Mathis throughput model', 'transport', 'Rate <= (MSS/RTT) * 1.22/sqrt(p). Loss and RTT bound a single TCP flow.', 'rate = (mss*8/rtt) * 1.22 / sqrt(p)', 'O(1)'],
    ['RTO estimation (RFC 6298)', 'transport', 'Exponentially weighted SRTT and RTTVAR give the retransmission timeout.', 'rttvar = 0.75*rttvar + 0.25*abs(srtt - r)\nsrtt = 0.875*srtt + 0.125*r\nrto = max(1.0, srtt + 4*rttvar)', 'O(1) per sample'],
    ['Bandwidth-delay product', 'transport', 'Bytes in flight needed to fill a path: bandwidth x RTT. A window smaller than this wastes the link.', 'bdp = bandwidth_bytes_per_s * rtt_s', 'O(1)'],
    ['DNS recursive resolution with TTL caching', 'name', 'Walk root -> TLD -> authoritative, caching every answer and referral until its TTL expires, including negative answers.', 'if cache.fresh(name): return cache[name]\nserver = closest_ns(name) or ROOT\nrepeat: ask; answer -> cache, return; referral -> descend', '~3-4 RTT cold, 0 hot'],
    ['Diffie-Hellman key exchange', 'secure', 'A = g^a mod p, B = g^b mod p, shared = B^a = A^b. Security rests on the discrete logarithm.', 'shared = pow(B, a, p) == pow(A, b, p)', 'O(log a) multiplications'],
    ['Square-and-multiply (fast modular exponentiation)', 'secure', 'Compute g^e mod m in log2(e) steps by squaring.', 'r = 1\nwhile e:\n  if e & 1: r = r*b % m\n  b = b*b % m; e >>= 1', 'O(log e)'],
    ['Baby-step giant-step (discrete log)', 'secure', 'Meet in the middle to solve g^x = h: store g^j for j < m, then step h * g^(-m*i). Takes about sqrt(p) work, which is why key size matters.', 'm = isqrt(p)+1; table = {g**j % p: j for j in range(m)}\nfor i in range(m): if h*pow(g,-m*i,p)%p in table: return i*m + table[...]', 'O(sqrt p) time and memory'],
    ['TLS 1.3 handshake', 'secure', 'Ephemeral key shares in Hello messages, certificate chain validation, signature over the transcript, Finished MACs, then AEAD records.', 'derive(handshake_keys, ecdh(a, B))\nverify(chain); verify(sig, transcript_hash)', '1 RTT'],
    ['Authenticated encryption (AES-GCM)', 'secure', 'Encrypts and produces a 16-byte tag over ciphertext + header; any modification makes decryption fail.', 'ct, tag = AESGCM(key, iv).encrypt(pt, aad)\ndecrypt raises if tag mismatch', 'O(n), hardware-accelerated'],
    ['SHA-256 hashing (avalanche)', 'secure', 'Fixed 256-bit fingerprint. A one-bit input change flips about half the output bits.', 'digest = sha256(message)', 'O(n)'],
    ['Wi-Fi channel selection', 'fix', 'Score each candidate channel by the strength-weighted spectral overlap with neighbours; pick the minimum. Overlap shrinks linearly with 5 MHz channel spacing out to ~20 MHz.', 'cost(c) = sum(w * max(0, 1 - abs(f(c) - f(n)) / 20))', 'O(channels x networks)'],
    ['Traceroute (TTL probing)', 'fix', 'Send probes with TTL 1, 2, 3, ...; each router that drops one reveals itself with an ICMP time-exceeded message.', 'for ttl in 1..30: probe(dst, ttl); print(reply.src, rtt)', 'O(hops)']
  ];
  var NAMES = { trail: '00 TRAIL', origin: '01 ORIGIN', wire: '02 WIRE', link: '03 LINK', address: '04 ADDRESS', route: '05 ROUTE', transport: '06 TRANSPORT', name: '07 NAME', secure: '08 SECURE', fix: '09 FIX' };
  var HUES = { trail: 38, origin: 166, wire: 38, link: 166, address: 200, route: 200, transport: 262, name: 320, secure: 12, fix: 150 };

  PP.chapter({
    id: 'algos', num: 99, short: 'IDX', layerName: 'EVERY ALGORITHM IN ONE PLACE', title: 'ALGORITHMS', hue: 280,
    blurb: 'Every algorithm in this course: idea, pseudocode, cost, and a jump back to its lab.',
    tagline: 'The same ' + A.length + ' ideas run the whole internet. Search them, read the pseudocode, and jump back to the lab where you can watch each one work.',
    build: function (body) {
      var q = H('input', { type: 'text', placeholder: 'search: crc, dijkstra, backoff, tls, ...', spellcheck: 'false', style: { maxWidth: '360px' } }), list = H('div', { class: 'grid2', style: { marginTop: '12px' } }), cnt = H('div', { class: 'ladder-note' });
      body.appendChild(H('label', { class: 'fld' }, 'FIND AN ALGORITHM')); body.appendChild(q); body.appendChild(cnt); body.appendChild(list);
      function paint() {
        var s = q.value.trim().toLowerCase(); list.innerHTML = ''; var n = 0;
        A.forEach(function (a) {
          if (s && (a[0] + ' ' + a[2] + ' ' + a[3] + ' ' + a[1] + ' ' + NAMES[a[1]]).toLowerCase().indexOf(s) < 0) return; n++;
          var d = H('details', { class: 'stat', style: { borderTop: '3px solid ' + PP.hsl(HUES[a[1]], 85, 60, 1), gap: '6px' } });
          d.appendChild(H('summary', { style: { cursor: 'pointer', listStyle: 'none' } }, H('span', { class: 'l', style: { color: PP.hsl(HUES[a[1]], 85, 72, 1) } }, NAMES[a[1]]), H('span', { class: 'v', style: { fontSize: '14px', display: 'block', margin: '3px 0' } }, a[0]), H('span', { class: 's', style: { display: 'block' } }, a[2])));
          d.appendChild(PP.code(a[3])); d.appendChild(H('div', { style: { font: '12px var(--mono)', color: 'var(--acc)', margin: '6px 0' } }, 'COST ' + a[4]));
          d.appendChild(H('a', { href: '#c-' + a[1], style: { font: '12px var(--mono)' }, onclick: function (e) { var t = document.getElementById('c-' + a[1]); if (t) { e.preventDefault(); t.scrollIntoView({ behavior: PP.reduced ? 'auto' : 'smooth' }); } } }, '\u2192 open the lab in chapter ' + NAMES[a[1]]));
          list.appendChild(d);
        });
        cnt.textContent = n + ' of ' + A.length + ' algorithms' + (s ? ' match "' + s + '"' : '') + '. Tap one to open its pseudocode.'; if (!n) list.appendChild(H('div', { class: 'stat' }, 'No match. Try a shorter word.'));
      }
      q.addEventListener('input', paint); paint();
      PP.callout(body, '', '<b>Nothing here is a black box.</b> The engine that runs the labs (<code>net.js</code>) is a plain file of these functions, unit-tested against published reference values (for example, CRC-32 of "123456789" is 0xCBF43926 and the RFC 1071 checksum example). You can read it, copy it, and reuse it.');
    }
  });
})();
