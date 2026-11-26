var C = 'riamo-carte-v1';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
function put(r, res) { if (res && res.ok) { var c = res.clone(); caches.open(C).then(function (ch) { ch.put(r, c); }); } return res; }
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var u = new URL(r.url);
  var ofm = u.hostname === 'tiles.openfreemap.org';
  if ((ofm && /^\/(fonts|sprites)\//.test(u.pathname)) || u.hostname === 'unpkg.com') {
    e.respondWith(caches.match(r).then(function (hit) { return hit || fetch(r).then(function (res) { return put(r, res); }); }));
  } else if ((ofm && /^\/styles\//.test(u.pathname)) || u.origin === location.origin) {
    e.respondWith(fetch(r).then(function (res) { return put(r, res); }).catch(function () { return caches.match(r); }));
  }
});
