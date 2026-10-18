/* PIXEL PACKET service worker: offline-first, flat file list */
var VER = 'pixel-packet-v1';
var FILES = ['./', 'index.html', 'style.css', 'net.js', 'core.js', 'hero.js', 'boot.js',
  'ch0-trail.js', 'ch1-origin.js', 'ch2-wire.js', 'ch3-link.js', 'ch4-address.js', 'ch5-route.js',
  'ch6-transport.js', 'ch7-name.js', 'ch8-secure.js', 'ch9-fix.js', 'ch10-algos.js',
  'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VER).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VER; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.search.indexOf('probe=') >= 0) return; /* live probes and other origins always hit the network */
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(function (hit) {
    var net = fetch(r).then(function (res) { if (res && res.ok) { var cp = res.clone(); caches.open(VER).then(function (c) { c.put(r, cp); }); } return res; }).catch(function () { return hit || (r.mode === 'navigate' ? caches.match('index.html') : undefined); });
    return hit || net;
  }));
});
