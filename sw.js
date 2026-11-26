const CACHE = 'riamo-20261126r';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var url = new URL(r.url);
  var isTile = /tile|basemaps/.test(url.hostname);
  if (url.origin === location.origin) {
    e.respondWith(fetch(r.url, { cache: 'no-cache' }).then(function (res) {
      var c = res.clone(); caches.open(CACHE).then(function (ch) { ch.put(r, c); }); return res;
    }).catch(function () { return caches.match(r); }));
  } else if (url.hostname === 'unpkg.com' || isTile) {
    e.respondWith(caches.match(r).then(function (hit) {
      return hit || fetch(r).then(function (res) {
        var c = res.clone(); caches.open(CACHE).then(function (ch) { ch.put(r, c); }); return res;
      });
    }));
  }
});
