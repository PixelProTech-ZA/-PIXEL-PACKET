/* PIXEL PACKET — chapter 08 : SECURE (TLS, key exchange, hashes, certificates) */
(function () {
  'use strict';
  var N = PP.net, H = PP.h, HUE = 12;
  var SUB = (window.crypto && crypto.subtle) ? crypto.subtle : null;
  function hx(buf, sep) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join(sep === undefined ? ' ' : sep); }
  function enc(s) { return new TextEncoder().encode(s); }

  PP.chapter({
    id: 'secure', num: 8, short: 'SECURE', layerName: 'LAYER 5\u20137 \u00b7 TLS', title: 'SECURE', hue: HUE,
    blurb: 'How two strangers agree on a secret in public: key exchange, TLS, hashes, certificates.',
    tagline: 'Every cable, Wi-Fi network and router your packet crosses is hostile territory. Cryptography is how two machines build a private room inside it.',
    quiz: [
      { q: 'In Diffie-Hellman, an eavesdropper sees p, g, A = g^a mod p and B = g^b mod p. Why can they not compute the shared secret?', a: ['They can; DH is only a toy', 'Recovering a from A is the discrete logarithm problem, infeasible for large p', 'The values are encrypted', 'The secret is sent separately'], c: 1,
        why: 'Going forward (modular exponentiation) is fast; going backward (discrete log) has no known fast method for properly sized parameters. With a 30-bit prime you can break it in milliseconds (try it above). With 2048 bits, no.' },
      { q: 'You see the padlock and https:// on a site. What does that actually prove?', a: ['The site is safe and honest', 'The connection is encrypted and you are talking to whoever controls that exact domain name', 'The site has no malware', 'Your IP address is hidden'], c: 1,
        why: 'TLS gives confidentiality, integrity and authenticity <i>of the endpoint</i>. A phishing site on <code>paypa1-login.com</code> can have a perfectly valid padlock.' },
      { q: 'You change one character in a message and hash it with SHA-256. About how many of the 256 output bits change?', a: ['1', 'About 8', 'About half (~128)', 'None: hashes are stable'], c: 2,
        why: 'The avalanche effect: a good hash flips about half of the output bits for any tiny input change, so similar inputs give unrelated-looking outputs. Try it in the lab.' }
    ],
    build: function (body) {
      PP.prose(body,
        '<p>Without encryption, anyone on the path can <b>read</b> your traffic, <b>change</b> it, or <b>pretend to be</b> the server. TLS (the "S" in HTTPS) solves all three with one handshake. Three ideas do the work:</p>' +
        '<ul><li><b>Key exchange</b>: two parties agree on a shared secret over a public channel.</li><li><b>Symmetric encryption + authentication</b> (AES-GCM, ChaCha20-Poly1305): fast, uses the shared secret, and detects tampering.</li><li><b>Certificates</b>: a chain of signatures that ties a public key to a domain name, so you know <i>who</i> you agreed the secret with.</li></ul>');

      // ---------- TLS ladder
      var labT = PP.lab(body, 'The TLS 1.3 handshake', 'One round trip, then everything is encrypted. Step through it.');
      PP.ladder(labT, {
        actors: ['BROWSER', 'SERVER'], ms: 1700, rowH: 62,
        steps: [
          { from: 0, to: 1, label: 'ClientHello', sub: 'versions, ciphers, key share, SNI', note: '<b>ClientHello.</b> "I speak TLS 1.3 with these ciphers. Here is my <b>public key share</b> (an ephemeral elliptic-curve point), and the <b>server name</b> I want (SNI)." Guessing the key exchange in advance is what saves a round trip compared to TLS 1.2.' },
          { from: 1, to: 0, label: 'ServerHello + key share', sub: 'chosen cipher, server public key share', note: '<b>ServerHello.</b> The server picks a cipher and sends its own key share. <b>Both sides can now compute the same shared secret</b> and derive keys from it. Everything after this message is encrypted.' },
          { from: 1, to: 0, label: 'Certificate (encrypted)', sub: 'chain of certificates', note: '<b>Certificate.</b> Sent encrypted. The browser checks: signed by a trusted CA through the chain? Valid dates? Does the name match the site? Not revoked?' },
          { from: 1, to: 0, label: 'CertificateVerify + Finished', sub: 'signature over the whole handshake', note: '<b>Proof of possession.</b> The server signs a hash of the handshake with its private key. Only the real owner of the certificate can do that. <b>Finished</b> is a MAC over everything, so a tampered handshake is detected.' },
          { from: 0, to: 1, label: 'Finished', sub: '', note: '<b>Client Finished.</b> The browser confirms it saw the same handshake. Total: <b>1 round trip</b> after the TCP handshake.' },
          { from: 0, to: 1, label: 'HTTP request (encrypted)', sub: 'AES-GCM / ChaCha20-Poly1305', note: '<b>Application data.</b> From here every record is encrypted <i>and</i> authenticated with fresh keys. Each record carries an authentication tag: change one bit and decryption fails.' },
          { from: 1, to: 0, label: 'HTTP response (encrypted)', sub: '', note: '<b>Forward secrecy.</b> The key shares were ephemeral and thrown away. Even if the server\'s long-term key is stolen next year, recorded traffic from today cannot be decrypted.' }
        ]
      });

      // ---------- WebCrypto lab
      var labE = PP.lab(body, 'LIVE: real key exchange and encryption, in your browser', 'Alice and Bob each generate a real <b>ECDH P-256</b> key pair using the browser\'s own crypto engine (WebCrypto). They exchange only their <i>public</i> keys. Both derive the same <b>AES-256-GCM</b> key. Eve sees everything that crosses the wire, yet cannot read it, and cannot change it without being caught.');
      var eres = H('div'); 
      if (!SUB) { PP.callout(labE, 'bad', '<b>NOT AVAILABLE.</b> This browser or context does not expose WebCrypto (<code>crypto.subtle</code>). It needs a secure context: <b>https://</b> or <b>localhost</b>. Open the app from its https address and this lab will run.'); }
      else {
        var msgIn = H('input', { type: 'text', value: 'Meet at the oasis at 21:00', maxlength: 120, spellcheck: 'false' });
        labE.appendChild(H('label', { class: 'fld' }, 'ALICE\'S MESSAGE')); labE.appendChild(msgIn);
        var st = { ct: null, iv: null, kB: null }, tamperBtn;
        labE.appendChild(H('div', { class: 'row' }, PP.btn('1 \u00b7 Generate keys, exchange, encrypt', run, ''), tamperBtn = PP.btn('2 \u00b7 Eve flips one bit of the ciphertext', tamper, 'ghost')));
        tamperBtn.disabled = true; labE.appendChild(eres);
      }
      async function run() {
        eres.innerHTML = '';
        try {
          var P = { name: 'ECDH', namedCurve: 'P-256' }, A = await SUB.generateKey(P, true, ['deriveKey']), B = await SUB.generateKey(P, true, ['deriveKey']);
          var pubA = await SUB.exportKey('raw', A.publicKey), pubB = await SUB.exportKey('raw', B.publicKey);
          var D = { name: 'AES-GCM', length: 256 }, kA = await SUB.deriveKey({ name: 'ECDH', public: B.publicKey }, A.privateKey, D, true, ['encrypt', 'decrypt']), kB = await SUB.deriveKey({ name: 'ECDH', public: A.publicKey }, B.privateKey, D, true, ['encrypt', 'decrypt']);
          var rA = hx(await SUB.exportKey('raw', kA), ''), rB = hx(await SUB.exportKey('raw', kB), '');
          var iv = crypto.getRandomValues(new Uint8Array(12)), pt = enc(msgIn.value || ' '), ct = await SUB.encrypt({ name: 'AES-GCM', iv: iv }, kA, pt);
          st.ct = new Uint8Array(ct); st.iv = iv; st.kB = kB; tamperBtn.disabled = false;
          var same = rA === rB;
          function row(who, col, title, val) { return H('div', { class: 'stat', style: { marginBottom: '8px' } }, H('span', { class: 'l', style: { color: col } }, who + ' \u00b7 ' + title), H('span', { class: 'v', style: { fontSize: '12px', fontWeight: 400 } }, val)); }
          eres.appendChild(row('ALICE', 'hsl(166,90%,62%)', 'public key (sent in the clear, 65 bytes)', hx(pubA).slice(0, 96) + ' \u2026'));
          eres.appendChild(row('BOB', 'hsl(262,90%,72%)', 'public key (sent in the clear, 65 bytes)', hx(pubB).slice(0, 96) + ' \u2026'));
          eres.appendChild(row('ALICE', 'hsl(166,90%,62%)', 'derived AES-256 key (never sent)', rA.slice(0, 32) + '\u2026'));
          eres.appendChild(row('BOB', 'hsl(262,90%,72%)', 'derived AES-256 key (never sent)', rB.slice(0, 32) + '\u2026' + (same ? '   \u2714 identical to Alice\'s' : '   \u2718 MISMATCH')));
          eres.appendChild(row('EVE', 'hsl(12,90%,64%)', 'sees on the wire: IV (12 B) + ciphertext + 16-byte auth tag', hx(iv) + ' | ' + hx(ct)));
          var out = H('div', { id: 'dec-out' }); eres.appendChild(out);
          var back = await SUB.decrypt({ name: 'AES-GCM', iv: iv }, kB, ct); PP.callout(out, '', '<b>Bob decrypts:</b> \u201c' + new TextDecoder().decode(back).replace(/</g, '&lt;') + '\u201d &nbsp; (authentication tag verified)');
        } catch (e) { PP.callout(eres, 'bad', '<b>Failed:</b> ' + (e && e.message) + '. This browser may not support ECDH P-256 or AES-GCM through WebCrypto.'); }
      }
      async function tamper() {
        if (!st.ct) return; var bad = new Uint8Array(st.ct), i = Math.floor(Math.random() * Math.max(1, bad.length - 16)); bad[i] ^= 1;
        var out = document.getElementById('dec-out') || eres, d = H('div'); out.appendChild(d);
        try { await SUB.decrypt({ name: 'AES-GCM', iv: st.iv }, st.kB, bad); PP.callout(d, 'bad', 'Unexpected: decryption succeeded.'); }
        catch (e) { PP.callout(d, 'bad', '<b>Eve flipped bit 0 of byte ' + i + ' of the ciphertext. Bob\'s decryption REFUSED it:</b> the authentication tag no longer matches. This is what <i>authenticated</i> encryption means: tampering is detected, never silently accepted.'); }
      }

      // ---------- toy DH
      var labD = PP.lab(body, 'Diffie-Hellman by hand, and why size matters', 'The same idea as above, with numbers small enough to see. Alice and Bob choose secrets, exchange <code>g<sup>x</sup> mod p</code>, and arrive at the same value. Then Eve tries the one attack she has: solving the <b>discrete logarithm</b> with the baby-step giant-step algorithm. Small primes fall instantly.');
      var primes = [{ v: '10007', t: '14-bit prime' }, { v: '1000003', t: '20-bit' }, { v: '1000000007', t: '30-bit' }, { v: '2147483647', t: '31-bit (2\u00b3\u00b9\u22121)' }], pSel = '1000000007', rnd = N.rng(Date.now() & 0xffff);
      var pSeg = PP.seg(primes.map(function (p) { return { v: p.v, t: p.t }; }), pSel, function (v) { pSel = v; dh(true); });
      labD.appendChild(pSeg.el); labD.appendChild(PP.btn('New secrets', function () { dh(true); }, 'sm ghost'));
      var dhOut = H('div', { class: 'stats' }), eveOut = H('div'), a, b; labD.appendChild(dhOut); labD.appendChild(eveOut);
      function dh(fresh) {
        var p = BigInt(pSel), g = 5n; if (fresh || a === undefined) { a = BigInt(2 + Math.floor(Math.random() * 1e6)) % (p - 3n) + 2n; b = BigInt(2 + Math.floor(Math.random() * 1e6)) % (p - 3n) + 2n; }
        var A = N.modPow(g, a, p), B = N.modPow(g, b, p), sA = N.modPow(B, a, p), sB = N.modPow(A, b, p);
        dhOut.innerHTML = '';
        [['PUBLIC (everyone knows)', 'p = ' + p + ', g = ' + g, ''], ['ALICE secret a (hidden)', String(a), ''], ['BOB secret b (hidden)', String(b), ''], ['ALICE SENDS A = g^a mod p', String(A), 'a'], ['BOB SENDS B = g^b mod p', String(B), 'a'], ['ALICE computes B^a mod p', String(sA), ''], ['BOB computes A^b mod p', String(sB) + (sA === sB ? '  \u2714 same' : '  \u2718'), '']].forEach(function (x) { dhOut.appendChild(H('div', { class: 'stat' }, H('span', { class: 'l' }, x[0]), H('span', { class: 'v ' + x[2], style: { fontSize: '14px' } }, x[1]))); });
        eveOut.innerHTML = ''; var eb = PP.btn('Eve attacks: solve for a from A', function () {
          var t0 = performance.now(), r = N.bsgs(g, A, p), ms = performance.now() - t0; eveOut.querySelector('.res') && eveOut.querySelector('.res').remove();
          var d = H('div', { class: 'res' }); eveOut.appendChild(d);
          if (!r) { PP.callout(d, 'bad', 'Eve found nothing.'); return; }
          var es = N.modPow(B, r.x, p); PP.callout(d, es === sA ? 'bad' : '', '<b>Eve recovered a secret exponent (' + r.x + ') in ' + PP.fmt(r.steps) + ' steps (' + ms.toFixed(1) + ' ms, measured)</b>, computed B<sup>x</sup> mod p = <b>' + es + '</b>' + (es === sA ? ' and <b>got the shared secret</b>. This key exchange is broken.' : '.') + '<br>Work needed is about \u221ap. For a <b>2048-bit</b> prime that is about 2<sup>1024</sup> steps: more than the number of atoms in the observable universe. For elliptic curves of 256 bits, about 2<sup>128</sup>. That gap is the entire security of the internet.');
        }, 'sm'); eveOut.appendChild(eb);
      }
      dh(true);
      PP.algo(body, {
        name: 'Diffie-Hellman key exchange',
        idea: 'Mixing paint: easy to mix two colours, impossible to un-mix. Modular exponentiation is the "mixing"; the discrete logarithm is the "un-mixing".',
        steps: ['Publicly agree on a large prime p and a generator g.', 'Alice picks secret a and sends A = g<sup>a</sup> mod p. Bob picks b and sends B = g<sup>b</sup> mod p.', 'Alice computes B<sup>a</sup> mod p; Bob computes A<sup>b</sup> mod p. Both equal g<sup>ab</sup> mod p.', 'Use that shared value to derive symmetric keys. Modern TLS does the same on an elliptic curve (X25519, P-256): same idea, much smaller numbers for the same strength.'],
        code: 'def modpow(b, e, m):      # square-and-multiply\n  r = 1; b %= m\n  while e:\n    if e & 1: r = r * b % m\n    b = b * b % m; e >>= 1\n  return r',
        cost: 'Square-and-multiply makes g<sup>a</sup> take only about log\u2082(a) steps, even for 2000-bit numbers. Attacking it by baby-step giant-step takes \u221ap steps and \u221ap memory.'
      });

      // ---------- hash avalanche
      var labH = PP.lab(body, 'Hashes: the fingerprint and the avalanche', 'A hash turns any input into a fixed-size fingerprint. Change one character and about half the 256 bits flip. Edit the text and watch the grid: each cell is one bit of SHA-256; <span style="color:hsl(12,90%,64%)">red</span> cells differ from the original.');
      var h1 = H('input', { type: 'text', value: 'Pay Alice R100', spellcheck: 'false' }), h2 = H('input', { type: 'text', value: 'Pay Alice R900', spellcheck: 'false' });
      var hout = H('div');
      if (!SUB) PP.callout(labH, 'bad', '<b>NOT AVAILABLE</b> without WebCrypto (needs https:// or localhost).');
      else { labH.appendChild(H('div', { class: 'grid2' }, H('div', null, H('label', { class: 'fld' }, 'ORIGINAL'), h1), H('div', null, H('label', { class: 'fld' }, 'CHANGED'), h2))); labH.appendChild(hout); h1.addEventListener('input', hash); h2.addEventListener('input', hash); hash(); }
      var hcv = null, hbits = null;
      async function hash() {
        var a1 = new Uint8Array(await SUB.digest('SHA-256', enc(h1.value))), a2 = new Uint8Array(await SUB.digest('SHA-256', enc(h2.value))), diff = 0;
        hout.innerHTML = ''; var wrap = H('div', { class: 'grid2' }), mk = function (arr, ref) { var g = H('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(32,1fr)', gap: '2px' } }); for (var i = 0; i < 256; i++) { var bit = (arr[i >> 3] >> (7 - (i & 7))) & 1, rb = ref ? (ref[i >> 3] >> (7 - (i & 7))) & 1 : bit, d = ref && bit !== rb; if (d) diff++; g.appendChild(H('i', { style: { aspectRatio: '1', background: d ? 'hsl(12,90%,60%)' : bit ? 'hsl(12,70%,45%)' : 'rgba(241,238,250,.07)', display: 'block', boxShadow: d ? '0 0 6px hsl(12,90%,60%)' : '' } })); } return g; };
        wrap.appendChild(H('div', null, mk(a1), H('div', { style: { font: '11px var(--mono)', color: 'var(--faint)', marginTop: '6px', wordBreak: 'break-all' } }, hx(a1, '')))); wrap.appendChild(H('div', null, mk(a2, a1), H('div', { style: { font: '11px var(--mono)', color: 'var(--faint)', marginTop: '6px', wordBreak: 'break-all' } }, hx(a2, ''))));
        hout.appendChild(wrap); var same = h1.value === h2.value;
        hout.appendChild(H('div', { class: 'ladder-note', html: same ? 'The inputs are identical, so the hashes are identical.' : '<b>' + diff + ' of 256 bits differ (' + (diff / 2.56).toFixed(0) + '%)</b>. Expected for a good hash: about 128 (50%). Hashes are used for file integrity, password storage (with salt and a slow function), digital signatures and blockchains.' }));
      }

      // ---------- certs
      PP.prose(body, '<h3 class="h3">Certificates: who is the key really for?</h3><p>Encryption alone is not enough: you could be agreeing a perfect secret with an attacker. A <b>certificate</b> says "this public key belongs to <code>example.com</code>", signed by a <b>Certificate Authority</b>. Your OS and browser ship a list of roughly 100+ root CAs they trust; each root signs intermediates, which sign the site\'s leaf certificate. The browser verifies the chain, step by step.</p>');
      var chain = H('div', { class: 'grid3' });
      [['ROOT CA', 'Stored in your OS / browser. Self-signed. Kept offline. Valid for ~20 years.', 12], ['INTERMEDIATE CA', 'Signed by the root. Does the day-to-day signing so the root key stays offline.', 38], ['LEAF CERTIFICATE', 'Signed by the intermediate. Names the domain(s), public key, validity (public CAs now issue about 90-day certificates, and the maximum keeps shrinking).', 166]].forEach(function (c) { chain.appendChild(H('div', { class: 'stat', style: { borderTop: '3px solid ' + PP.hsl(c[2], 85, 60, 1) } }, H('span', { class: 'l' }, c[0]), H('span', { class: 's' }, c[1]))); });
      body.appendChild(chain);
      PP.algo(body, { name: 'What the browser checks, in order', idea: 'Any single failure produces the full-screen warning page. Each has a distinct cause and fix.', steps: ['<b>Signature chain</b>: each certificate is signed by the next, ending at a root I trust.', '<b>Validity dates</b>: now is between "not before" and "not after". (A wrong device clock breaks every site: check the date first.)', '<b>Name match</b>: the domain I typed is in the certificate\'s Subject Alternative Names.', '<b>Revocation / transparency</b>: not revoked, and logged in public Certificate Transparency logs.'], cost: 'Three public-key operations per handshake on the client; the symmetric AES work afterwards is hardware-accelerated and nearly free.' });
      PP.deal(body, 'Security problems you will actually meet', [
        '<b>"Your connection is not private" on every site:</b> check the device\'s date and time first. A wrong clock makes every certificate look expired or not yet valid.',
        '<b>On one site only:</b> expired certificate (site owner problem), name mismatch (you typed the wrong host or it is misconfigured), or a captive-portal Wi-Fi intercepting the connection: open <code>http://neverssl.com</code> to trigger the login page.',
        '<b>Public Wi-Fi:</b> HTTPS protects the content, but the network still sees <i>which domains</i> you visit. A VPN moves that trust to the VPN company; it does not remove it.',
        '<b>Never click through a certificate warning</b> to log in somewhere. The warning means the identity check failed: you may be talking to an impostor.',
        '<b>Padlock is not a trust badge:</b> criminals get valid certificates for look-alike domains. Read the domain, not the lock.'
      ]);
    }
  });
})();
