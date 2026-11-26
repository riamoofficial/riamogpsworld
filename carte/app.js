'use strict';
/* ===== Riamo GPS World — carte 3D (MapLibre GL JS + OpenFreeMap + PMTiles) ===== */
var OFM_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
var OFM_TILEJSON = 'https://tiles.openfreemap.org/planet';
var SAT_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
var CAP = 6000;               // nombre maximal de tuiles par téléchargement de zone
var SRC = 'openmaptiles';     // nom de la source vectorielle (détecté dans le style)
var map = null, state = { fond: 'plan', b3d: true, lang: 'fr', off: false, cats: [] };

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
var LS = {
  get: function (k, d) { try { var v = localStorage.getItem('rc-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem('rc-' + k, JSON.stringify(v)); } catch (e) {} }
};
state.fond = LS.get('fond', 'plan'); state.b3d = LS.get('b3d', true); state.lang = LS.get('lang', 'fr');
state.off = LS.get('off', false); state.cats = LS.get('cats', []);

/* ---------- Calcul de tuiles ---------- */
function clampLat(v) { return Math.max(-85.0511, Math.min(85.0511, v)); }
function lon2x(lon, z) { var n = Math.pow(2, z); return Math.max(0, Math.min(n - 1, Math.floor((lon + 180) / 360 * n))); }
function lat2y(lat, z) {
  var r = clampLat(lat) * Math.PI / 180, n = Math.pow(2, z);
  return Math.max(0, Math.min(n - 1, Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n)));
}
function countTiles(b, zmax) {
  var n = 0;
  for (var z = 0; z <= zmax; z++) n += (lon2x(b.e, z) - lon2x(b.w, z) + 1) * (lat2y(b.s, z) - lat2y(b.n, z) + 1);
  return n;
}
function listTiles(b, zmax) {
  var out = [];
  for (var z = 0; z <= zmax; z++) {
    for (var x = lon2x(b.w, z); x <= lon2x(b.e, z); x++) for (var y = lat2y(b.n, z); y <= lat2y(b.s, z); y++) out.push([z, x, y]);
  }
  return out;
}
function viewBox() { var b = map.getBounds(); return { w: b.getWest(), s: b.getSouth(), e: b.getEast(), n: b.getNorth() }; }

/* ---------- Stockage local : IndexedDB (zones) + OPFS (fichiers .pmtiles) ---------- */
var dbp = new Promise(function (res, rej) {
  var r = indexedDB.open('riamo-offline', 1);
  r.onupgradeneeded = function () { var d = r.result; d.createObjectStore('tiles'); d.createObjectStore('regions', { keyPath: 'id' }); };
  r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
});
function tx(store, mode, fn) {
  return dbp.then(function (db) {
    return new Promise(function (res, rej) {
      var t = db.transaction(store, mode), out = fn(t.objectStore(store));
      t.oncomplete = function () { res(out && out.result); }; t.onerror = function () { rej(t.error); };
    });
  });
}
var archives = [];
function addArchive(name, file) {
  archives = archives.filter(function (a) { return a.name !== name; });
  archives.push({ name: name, size: file.size, p: new pmtiles.PMTiles(new pmtiles.FileSource(file)) });
}
async function loadArchives() {
  try {
    var d = await navigator.storage.getDirectory();
    for await (var e of d.entries()) { if (/\.pmtiles$/i.test(e[0])) addArchive(e[0], await e[1].getFile()); }
  } catch (err) {}
}
async function saveStream(name, stream, total, onProg) {
  var d = await navigator.storage.getDirectory(), fh = await d.getFileHandle(name, { create: true }), w = await fh.createWritable();
  var rd = stream.getReader(), got = 0;
  try {
    for (;;) { var r = await rd.read(); if (r.done) break; await w.write(r.value); got += r.value.length; onProg(got, total); }
    await w.close();
  } catch (err) { try { await w.abort(); } catch (e2) {} throw err; }
  return fh.getFile();
}

/* ---------- Protocole ofm:// : archives .pmtiles > zones locales > réseau ---------- */
var tpl = LS.get('tpl', null);
function getTemplate(force) {
  if (!force && tpl && Date.now() - LS.get('tplT', 0) < 43200000) return Promise.resolve(tpl);
  return fetch(OFM_TILEJSON).then(function (r) { return r.json(); }).then(function (j) {
    tpl = j.tiles[0]; LS.set('tpl', tpl); LS.set('tplT', Date.now()); return tpl;
  }).catch(function (e) { if (tpl) return tpl; throw e; });
}
async function netTile(z, x, y, signal, retry) {
  var t = await getTemplate(!!retry);
  var r = await fetch(t.replace('{z}', z).replace('{x}', x).replace('{y}', y), { signal: signal });
  if (r.status === 404 && !retry) return netTile(z, x, y, signal, true);
  if (!r.ok) return new ArrayBuffer(0);
  return r.arrayBuffer();
}
async function getTile(z, x, y, signal) {
  for (var i = 0; i < archives.length; i++) {
    try { var r = await archives[i].p.getZxy(z, x, y); if (r && r.data) return { data: r.data }; } catch (e) {}
  }
  var hit = null;
  try { hit = await tx('tiles', 'readonly', function (s) { return s.get(z + '/' + x + '/' + y); }); } catch (e) {}
  if (hit) return { data: hit };
  if (state.off || !navigator.onLine) return { data: new ArrayBuffer(0) };
  try { return { data: await netTile(z, x, y, signal) }; } catch (e) { return { data: new ArrayBuffer(0) }; }
}
maplibregl.addProtocol('ofm', function (params, abort) {
  var m = /^ofm:\/\/(\d+)\/(\d+)\/(\d+)/.exec(params.url);
  return getTile(+m[1], +m[2], +m[3], abort && abort.signal);
});

/* ---------- Style : OpenFreeMap « liberty » + 3D + satellite + lieux ---------- */
var vis0 = {}, origText = {}, lastStyleJson = null;
async function loadStyle() {
  var st;
  try {
    var r = await fetch(OFM_STYLE); st = await r.json(); LS.set('styleJson', st);
  } catch (e) { st = LS.get('styleJson', null); }
  if (!st) throw new Error('Style introuvable : connecte-toi une première fois à Internet.');
  Object.keys(st.sources).forEach(function (k) {
    if (st.sources[k].type === 'vector') {
      SRC = k;
      st.sources[k] = { type: 'vector', tiles: ['ofm://{z}/{x}/{y}'], minzoom: 0, maxzoom: 14,
        attribution: '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> Données © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>' };
    }
  });
  return st;
}
function firstSymbolId() {
  var l = map.getStyle().layers.filter(function (x) { return x.type === 'symbol'; })[0];
  return l ? l.id : undefined;
}
function add3D() {
  map.getStyle().layers.forEach(function (l) { if (l.type === 'fill-extrusion') map.removeLayer(l.id); });
  map.addLayer({
    id: 'b3d', type: 'fill-extrusion', source: SRC, 'source-layer': 'building', minzoom: 13,
    filter: ['!=', ['get', 'hide_3d'], true],
    paint: {
      'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 10], 0, '#d9dde3', 50, '#c4cad4', 200, '#a9b3c3'],
      'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, ['coalesce', ['get', 'render_height'], 9]],
      'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, ['coalesce', ['get', 'render_min_height'], 0]],
      'fill-extrusion-opacity': 0.85
    }
  }, firstSymbolId());
  try { map.setLight({ anchor: 'viewport', color: '#ffffff', intensity: 0.35, position: [1.15, 210, 35] }); } catch (e) {}
}
function addSat() {
  map.addSource('sat', { type: 'raster', tiles: [SAT_URL], tileSize: 256, maxzoom: 19, attribution: 'Imagerie © Esri, Maxar, Earthstar Geographics' });
  map.addLayer({ id: 'sat', type: 'raster', source: 'sat', layout: { visibility: 'none' } }, map.getStyle().layers[0].id);
}

/* ---------- Langue : name:xx avec repli sur name ---------- */
var LANGS = [['auto', 'Automatique (nom local)'], ['fr', 'Français'], ['en', 'English'], ['es', 'Español'], ['de', 'Deutsch'], ['it', 'Italiano'], ['pt', 'Português'],
  ['nl', 'Nederlands'], ['ru', 'Русский'], ['ar', 'العربية'], ['zh', '中文'], ['ja', '日本語'], ['ko', '한국어'], ['tr', 'Türkçe']];
function applyLang(lang) {
  state.lang = lang; LS.set('lang', lang);
  map.getStyle().layers.forEach(function (l) {
    if (l.type !== 'symbol' || !l.layout || !l.layout['text-field']) return;
    if (l.id.indexOf('shield') >= 0 || /housenumber|ref/.test(l['source-layer'] || '')) return;
    if (l.id.indexOf('poicat-') === 0) { map.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', 'name:' + (lang === 'auto' ? 'latin' : lang)], ['get', 'name']]); return; }
    if (!/name/.test(JSON.stringify(l.layout['text-field']))) return;
    if (!origText[l.id]) origText[l.id] = l.layout['text-field'];
    map.setLayoutProperty(l.id, 'text-field', lang === 'auto' ? origText[l.id] : ['coalesce', ['get', 'name:' + lang], ['get', 'name']]);
  });
}

/* ---------- Fond : plan / satellite / hybride ---------- */
var ROAD = /road|street|highway|bridge|tunnel|motorway|aeroway|rail|ferry|path|transit/;
function refreshVis() {
  var f = state.fond;
  map.getStyle().layers.forEach(function (l) {
    var id = l.id, v;
    if (id === 'sat') v = f !== 'plan';
    else if (id === 'b3d') v = state.b3d;
    else if (id.indexOf('poicat-') === 0) v = state.cats.indexOf(id.slice(7)) >= 0;
    else if (f === 'plan') v = vis0[id] !== 'none';
    else if (f === 'sat') v = false;
    else v = l.type === 'symbol' || (l.type === 'line' && ROAD.test(id));
    map.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none');
  });
  if (map.getLayer('b3d')) map.setPaintProperty('b3d', 'fill-extrusion-opacity', f === 'plan' ? 0.85 : 0.6);
}
function setFond(f) {
  state.fond = f; LS.set('fond', f); refreshVis();
  Array.prototype.forEach.call(document.querySelectorAll('#seg-fond button'), function (b) { b.classList.toggle('on', b.getAttribute('data-f') === f); });
}

/* ---------- Lieux (POI) par catégories ---------- */
var CATS = [
  { id: 'resto', n: 'Restaurants', e: '🍴', c: '#e67e22', cls: ['restaurant', 'fast_food', 'cafe', 'bar', 'food_court'] },
  { id: 'fuel', n: 'Stations-service', e: '⛽', c: '#c0392b', cls: ['fuel', 'charging_station'] },
  { id: 'hotel', n: 'Hôtels', e: '🛏️', c: '#8e44ad', cls: ['lodging', 'hotel', 'hostel', 'guest_house', 'motel'] },
  { id: 'hosp', n: 'Hôpitaux', e: '🏥', c: '#e74c3c', cls: ['hospital', 'clinic', 'doctors', 'pharmacy'] },
  { id: 'park', n: 'Parkings', e: '🅿️', c: '#2980b9', cls: ['parking', 'bicycle_parking'] },
  { id: 'shop', n: 'Commerces', e: '🛍️', c: '#16a085', cls: ['shop', 'grocery', 'supermarket', 'convenience', 'clothing_store', 'bakery', 'butcher', 'mall', 'department_store'] },
  { id: 'trans', n: 'Transports', e: '🚆', c: '#34495e', cls: ['railway', 'bus', 'subway', 'tram', 'ferry_terminal', 'airport', 'taxi'] }
];
function mkIcon(e, color) {
  var s = 64, c = document.createElement('canvas'); c.width = c.height = s;
  var x = c.getContext('2d');
  x.fillStyle = color; x.beginPath(); x.arc(32, 32, 28, 0, 7); x.fill();
  x.lineWidth = 4; x.strokeStyle = '#fff'; x.stroke();
  x.font = '30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e, 32, 35);
  return x.getImageData(0, 0, s, s);
}
function addPois() {
  var tf = map.getStyle().layers.filter(function (l) { return l.layout && l.layout['text-font']; })[0];
  var font = tf ? tf.layout['text-font'] : ['Noto Sans Regular'];
  CATS.forEach(function (c) {
    map.addImage('ic-' + c.id, mkIcon(c.e, c.c), { pixelRatio: 2 });
    map.addLayer({
      id: 'poicat-' + c.id, type: 'symbol', source: SRC, 'source-layer': 'poi', minzoom: 12,
      filter: ['any', ['in', ['get', 'class'], ['literal', c.cls]], ['in', ['get', 'subclass'], ['literal', c.cls]]],
      layout: {
        'icon-image': 'ic-' + c.id, 'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.4, 17, 0.8], 'icon-allow-overlap': false,
        'text-field': ['coalesce', ['get', 'name:' + (state.lang === 'auto' ? 'latin' : state.lang)], ['get', 'name']],
        'text-font': font, 'text-size': 11, 'text-offset': [0, 1.3], 'text-anchor': 'top', 'text-optional': true, visibility: 'none'
      },
      paint: { 'text-color': '#222', 'text-halo-color': '#fff', 'text-halo-width': 1.4 }
    });
    map.on('click', 'poicat-' + c.id, function (e) { var f = e.features[0]; popup(f.geometry.coordinates, f.properties, c); });
    map.on('mouseenter', 'poicat-' + c.id, function () { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'poicat-' + c.id, function () { map.getCanvas().style.cursor = ''; });
  });
}
function popup(ll, p, c) {
  var nm = p['name:' + state.lang] || p.name || c.n;
  new maplibregl.Popup({ offset: 14 }).setLngLat(ll).setHTML('<b>' + esc(nm) + '</b><br>' + c.e + ' ' + esc(c.n) +
    '<br><a href="https://www.openstreetmap.org/directions?to=' + ll[1].toFixed(6) + '%2C' + ll[0].toFixed(6) + '" target="_blank">Itinéraire →</a>').addTo(map);
}
function activeIds() { return state.cats.map(function (id) { return 'poicat-' + id; }).filter(function (id) { return map.getLayer(id); }); }
var lt = null;
function refreshList() {
  var box = $('plist'); if (!box || !map) return;
  var ids = activeIds();
  if (!ids.length) { box.innerHTML = '<p class="muted">Choisis une ou plusieurs catégories ci-dessus. Zoome sur une ville pour voir les lieux.</p>'; return; }
  var cen = map.getCenter(), seen = {}, rows = [], q = $('lf').value.trim().toLowerCase();
  map.queryRenderedFeatures({ layers: ids }).forEach(function (f) {
    var p = f.properties, c = f.geometry.coordinates, nm = p['name:' + state.lang] || p.name || '';
    var k = nm + '|' + c[0].toFixed(5) + '|' + c[1].toFixed(5); if (seen[k]) return; seen[k] = 1;
    if (q && nm.toLowerCase().indexOf(q) < 0) return;
    rows.push({ n: nm, c: c, p: p, cat: CATS.filter(function (x) { return 'poicat-' + x.id === f.layer.id; })[0], d: cen.distanceTo(new maplibregl.LngLat(c[0], c[1])) });
  });
  rows.sort(function (a, b) { return a.d - b.d; });
  rows = rows.slice(0, 40);
  box.innerHTML = rows.length ? '' : '<p class="muted">Aucun lieu visible ici : zoome ou déplace la carte.</p>';
  rows.forEach(function (r) {
    var d = document.createElement('div'); d.className = 'item';
    d.innerHTML = r.cat.e + ' <b>' + esc(r.n || r.cat.n) + '</b><small>' + (r.d < 1000 ? Math.round(r.d) + ' m' : (r.d / 1000).toFixed(1) + ' km') + ' · ' + esc(r.cat.n) + '</small>';
    d.onclick = function () { map.flyTo({ center: r.c, zoom: Math.max(map.getZoom(), 16.5) }); popup(r.c, r.p, r.cat); };
    box.appendChild(d);
  });
}
function renderChips() {
  var box = $('chips'); box.innerHTML = '';
  CATS.forEach(function (c) {
    var b = document.createElement('button'); b.className = 'chip' + (state.cats.indexOf(c.id) >= 0 ? ' on' : ''); b.textContent = c.e + ' ' + c.n;
    b.onclick = function () {
      var i = state.cats.indexOf(c.id); if (i >= 0) state.cats.splice(i, 1); else state.cats.push(c.id);
      LS.set('cats', state.cats); b.classList.toggle('on'); refreshVis(); setTimeout(refreshList, 400);
    };
    box.appendChild(b);
  });
}

/* ---------- Hors ligne : zones, fichiers .pmtiles, quota ---------- */
var cancel = false;
function prog(id, a, b) { $(id).style.width = (b ? Math.min(100, a / b * 100) : 0) + '%'; }
function mo(n) { return (n / 1048576).toFixed(n > 1e8 ? 0 : 1) + ' Mo'; }
async function pool(items, n, fn) {
  var i = 0;
  await Promise.all(Array.from({ length: n }, async function () { while (i < items.length && !cancel) { await fn(items[i++]); } }));
}
function updEst() {
  if (!map) return;
  var n = countTiles(viewBox(), +$('zmax').value);
  $('est').textContent = n.toLocaleString('fr-FR') + ' tuiles ≈ ' + Math.round(n * 30 / 1024) + ' Mo' +
    (n > CAP ? ' — zone trop grande (max ' + CAP.toLocaleString('fr-FR') + '). Zoome, ou utilise un fichier .pmtiles ci-dessous.' : '');
  $('dl').disabled = n > CAP;
}
async function prefetchAssets() {
  var st = map.getStyle(), urls = [];
  if (st.sprite) ['.json', '.png', '@2x.json', '@2x.png'].forEach(function (s) { urls.push(st.sprite + s); });
  if (st.glyphs) {
    var fonts = {};
    st.layers.forEach(function (l) { if (l.layout && Array.isArray(l.layout['text-font'])) fonts[l.layout['text-font'].join(',')] = 1; });
    Object.keys(fonts).forEach(function (f) {
      ['0-255', '256-511', '8192-8447'].forEach(function (r) { urls.push(st.glyphs.replace('{fontstack}', encodeURIComponent(f)).replace('{range}', r)); });
    });
  }
  await Promise.all(urls.map(function (u) { return fetch(u).catch(function () {}); }));
}
async function downloadRegion() {
  var box = viewBox(), zmax = +$('zmax').value, list = listTiles(box, zmax);
  if (list.length > CAP) return;
  var name = prompt('Nom de la zone :', 'Zone ' + new Date().toLocaleDateString('fr-FR')); if (!name) return;
  cancel = false; $('dl').disabled = true;
  var done = 0, bytes = 0, fails = 0;
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) {}
  try {
    var t = await getTemplate(false);
    await pool(list, 6, async function (c) {
      var key = c[0] + '/' + c[1] + '/' + c[2];
      try {
        var ex = await tx('tiles', 'readonly', function (s) { return s.get(key); });
        if (!ex) {
          var r = await fetch(t.replace('{z}', c[0]).replace('{x}', c[1]).replace('{y}', c[2]));
          if (r.ok) { var buf = await r.arrayBuffer(); bytes += buf.byteLength; await tx('tiles', 'readwrite', function (s) { return s.put(buf, key); }); }
        }
      } catch (e) { fails++; }
      done++; prog('dlbar', done, list.length); $('dlmsg').textContent = done + ' / ' + list.length + ' tuiles · ' + mo(bytes);
    });
    if (cancel) { $('dlmsg').textContent = 'Téléchargement annulé.'; }
    else {
      await prefetchAssets();
      await tx('regions', 'readwrite', function (s) { return s.put({ id: Date.now(), name: name, bbox: box, zmax: zmax, tiles: list.length, bytes: bytes, date: new Date().toISOString() }); });
      $('dlmsg').textContent = '✓ Zone enregistrée (' + mo(bytes) + (fails ? ', ' + fails + ' échecs' : '') + ').';
    }
  } catch (e) { $('dlmsg').textContent = 'Erreur : ' + e.message; }
  $('dl').disabled = false; renderRegions(); renderStore(); updEst();
}
function inBox(c, r) { return c[0] <= r.zmax && c[1] >= lon2x(r.bbox.w, c[0]) && c[1] <= lon2x(r.bbox.e, c[0]) && c[2] >= lat2y(r.bbox.n, c[0]) && c[2] <= lat2y(r.bbox.s, c[0]); }
async function delRegion(r) {
  if (!confirm('Supprimer « ' + r.name + ' » ?')) return;
  var others = (await tx('regions', 'readonly', function (s) { return s.getAll(); })).filter(function (x) { return x.id !== r.id; });
  var keys = listTiles(r.bbox, r.zmax).filter(function (c) { return !others.some(function (o) { return inBox(c, o); }); });
  await tx('tiles', 'readwrite', function (s) { keys.forEach(function (c) { s.delete(c[0] + '/' + c[1] + '/' + c[2]); }); return null; });
  await tx('regions', 'readwrite', function (s) { return s.delete(r.id); });
  renderRegions(); renderStore();
}
async function renderRegions() {
  var rs = await tx('regions', 'readonly', function (s) { return s.getAll(); }) || [], box = $('regions');
  box.innerHTML = rs.length ? '' : 'Aucune zone enregistrée.';
  rs.forEach(function (r) {
    var d = document.createElement('div'); d.className = 'item';
    d.innerHTML = '<b>' + esc(r.name) + '</b><small>' + r.tiles.toLocaleString('fr-FR') + ' tuiles · ' + mo(r.bytes) + ' · z≤' + r.zmax + '</small>';
    var go = document.createElement('button'); go.className = 'btn'; go.textContent = 'Voir'; go.style.marginRight = '6px';
    go.onclick = function () { map.fitBounds([[r.bbox.w, r.bbox.s], [r.bbox.e, r.bbox.n]], { padding: 30 }); };
    var del = document.createElement('button'); del.className = 'btn'; del.textContent = 'Supprimer'; del.onclick = function () { delRegion(r); };
    d.appendChild(document.createElement('br')); d.appendChild(go); d.appendChild(del); box.appendChild(d);
  });
}
function renderArchives() {
  var box = $('archives'); box.innerHTML = archives.length ? '' : 'Aucun fichier .pmtiles importé.';
  archives.forEach(function (a) {
    var d = document.createElement('div'); d.className = 'item'; d.innerHTML = '<b>' + esc(a.name) + '</b><small>' + mo(a.size) + '</small>';
    var del = document.createElement('button'); del.className = 'btn'; del.textContent = 'Supprimer';
    del.onclick = async function () {
      if (!confirm('Supprimer ce fichier ?')) return;
      try { var dir = await navigator.storage.getDirectory(); await dir.removeEntry(a.name); } catch (e) {}
      archives = archives.filter(function (x) { return x.name !== a.name; }); renderArchives(); renderStore(); var s2 = map.getSource(SRC); if (s2 && s2.reload) s2.reload();
    };
    d.appendChild(document.createElement('br')); d.appendChild(del); box.appendChild(d);
  });
}
async function renderStore() {
  try { var e = await navigator.storage.estimate(); $('store').textContent = 'Stockage utilisé : ' + mo(e.usage) + ' sur ' + mo(e.quota) + ' disponibles.'; } catch (err) {}
}
async function importPmtiles(stream, name, total) {
  $('pmmsg').textContent = 'Import de ' + name + '…';
  try {
    var f = await saveStream(name, stream, total, function (a, b) { prog('pmbar', a, b); $('pmmsg').textContent = mo(a) + (b ? ' / ' + mo(b) : ''); });
    addArchive(name, f); $('pmmsg').textContent = '✓ ' + name + ' importé.'; renderArchives(); renderStore();
    var src = map.getSource(SRC); if (src && src.reload) src.reload();
  } catch (e) { $('pmmsg').textContent = 'Erreur : ' + e.message + ' (le serveur doit autoriser CORS).'; }
}

/* ---------- Recherche d’adresse (Nominatim) ---------- */
var qt = null, qmark = null;
function geocode() {
  var q = $('q').value.trim(), box = $('qres'); if (q.length < 3) { box.style.display = 'none'; return; }
  fetch('https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=' + (state.lang === 'auto' ? 'fr' : state.lang) + '&q=' + encodeURIComponent(q))
    .then(function (r) { return r.json(); }).then(function (res) {
      box.innerHTML = ''; box.style.display = res.length ? 'block' : 'none';
      res.forEach(function (r) {
        var li = document.createElement('li'); li.textContent = r.display_name;
        li.onclick = function () {
          box.style.display = 'none'; $('q').value = r.display_name;
          if (qmark) qmark.remove(); qmark = new maplibregl.Marker({ color: '#22d3a8' }).setLngLat([+r.lon, +r.lat]).addTo(map);
          map.flyTo({ center: [+r.lon, +r.lat], zoom: 16, pitch: Math.max(map.getPitch(), 45) });
        };
        box.appendChild(li);
      });
    }).catch(function () {});
}

/* ---------- Interface et démarrage ---------- */
function showPanel(p) {
  var sheet = $('sheet'), cur = sheet.getAttribute('data-p');
  Array.prototype.forEach.call(document.querySelectorAll('#nav button'), function (b) { b.classList.remove('on'); });
  if (cur === p && sheet.style.display === 'block') { sheet.style.display = 'none'; sheet.removeAttribute('data-p'); return; }
  sheet.style.display = 'block'; sheet.setAttribute('data-p', p);
  Array.prototype.forEach.call(document.querySelectorAll('.pn'), function (x) { x.classList.toggle('on', x.id === 'p-' + p); });
  document.querySelector('#nav button[data-p="' + p + '"]').classList.add('on');
  if (p === 'lieux') refreshList();
  if (p === 'off') { updEst(); renderRegions(); renderArchives(); renderStore(); }
}
function setPitch(p) { map.easeTo({ pitch: p, bearing: p ? (map.getBearing() || -17) : 0, duration: 600 }); }
function wireUI() {
  Array.prototype.forEach.call(document.querySelectorAll('#nav button'), function (b) { b.onclick = function () { showPanel(b.getAttribute('data-p')); }; });
  Array.prototype.forEach.call(document.querySelectorAll('#seg-fond button'), function (b) { b.onclick = function () { setFond(b.getAttribute('data-f')); }; });
  $('c3d').checked = state.b3d; $('c3d').onchange = function () { state.b3d = this.checked; LS.set('b3d', state.b3d); refreshVis(); };
  $('rp').oninput = function () { map.setPitch(+this.value); };
  $('b3').onclick = function () { setPitch(map.getPitch() > 5 ? 0 : 60); };
  $('rn').onclick = function () { map.easeTo({ bearing: 0, duration: 500 }); };
  map.on('pitch', function () { var p = Math.round(map.getPitch()); $('rp').value = p; $('b3').classList.toggle('on', p > 5); });
  var sel = $('lang'); LANGS.forEach(function (l) { var o = document.createElement('option'); o.value = l[0]; o.textContent = l[1]; sel.appendChild(o); });
  sel.value = state.lang; sel.onchange = function () { applyLang(this.value); setTimeout(refreshList, 300); };
  renderChips(); $('lf').oninput = refreshList;
  map.on('moveend', function () {
    LS.set('view', { c: map.getCenter().toArray(), z: map.getZoom(), p: map.getPitch(), b: map.getBearing() });
    clearTimeout(lt); lt = setTimeout(function () { var s = $('sheet').getAttribute('data-p'); if (s === 'lieux') refreshList(); if (s === 'off') updEst(); }, 250);
  });
  $('zmax').onchange = updEst; $('dl').onclick = downloadRegion; $('dlc').onclick = function () { cancel = true; };
  $('foff').checked = state.off; $('foff').onchange = function () { state.off = this.checked; LS.set('off', state.off); var s = map.getSource(SRC); if (s && s.reload) s.reload(); };
  $('pmfile').onchange = function () { var f = this.files[0]; if (f) importPmtiles(f.stream(), f.name, f.size); };
  $('pmgo').onclick = function () {
    var u = $('pmurl').value.trim(); if (!/^https?:\/\//.test(u)) return;
    fetch(u).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return importPmtiles(r.body, u.split('/').pop().split('?')[0] || 'region.pmtiles', +r.headers.get('content-length') || 0); })
      .catch(function (e) { $('pmmsg').textContent = 'Erreur : ' + e.message; });
  };
  $('q').oninput = function () { clearTimeout(qt); qt = setTimeout(geocode, 450); };
}
async function boot() {
  await loadArchives();
  var style;
  try { style = await loadStyle(); } catch (e) { document.body.insertAdjacentHTML('beforeend', '<p style="position:fixed;top:80px;left:12px;right:12px;z-index:9;background:#b3261e;color:#fff;padding:12px;border-radius:10px">' + esc(e.message) + '</p>'); return; }
  var v = LS.get('view', { c: [2.3522, 48.8566], z: 13.5, p: 0, b: 0 });
  map = new maplibregl.Map({ container: 'map', style: style, center: v.c, zoom: v.z, pitch: v.p, bearing: v.b, maxPitch: 75, attributionControl: { compact: true } });
  window.RIAMO = { map: map };
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showAccuracyCircle: true }), 'top-right');
  map.addControl(new maplibregl.ScaleControl(), 'bottom-left');
  map.on('load', function () {
    map.getStyle().layers.forEach(function (l) { vis0[l.id] = (l.layout && l.layout.visibility) || 'visible'; });
    add3D(); addSat(); addPois();
    applyLang(state.lang); setFond(state.fond); wireUI(); refreshVis();
    if (map.getPitch() > 5) $('b3').classList.add('on');
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw-carte.js', { scope: './' }).catch(function () {});
}
boot();
