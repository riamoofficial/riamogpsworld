(function () {
  'use strict';
  var css = '.gps-map .leaflet-control-layers{display:none!important}' +
    '#g2-ui{display:none;font-family:sans-serif}' +
    '#g2-layers{position:fixed;left:12px;top:76px;z-index:2600;width:48px;height:48px;border-radius:50%;border:0;background:#fff;color:#111;font-size:22px;box-shadow:0 2px 10px #0006}' +
    '#g2-recb{position:fixed;left:12px;top:132px;z-index:2600;background:#d32f2f;color:#fff;border-radius:14px;padding:4px 10px;font:700 12px sans-serif;display:none}' +
    '#g2-back{position:fixed;top:0;left:0;right:0;bottom:0;z-index:2790;background:#0006;display:none}' +
    '#g2-sheet{position:fixed;left:0;right:0;bottom:0;z-index:2800;background:#fff;color:#111;border-radius:22px 22px 0 0;padding:16px 16px 24px;max-height:75vh;overflow:auto;display:none;box-shadow:0 -4px 16px #0005}' +
    '#g2-sheet h3{margin:0 0 14px;font-size:20px;display:flex;justify-content:space-between}' +
    '.g2-grid{display:flex;gap:12px;flex-wrap:wrap}' +
    '.g2-card{width:30%;text-align:center;font-size:13px;color:#1976d2}' +
    '.g2-card div{height:62px;border-radius:14px;border:3px solid #cfe3f7;display:flex;align-items:center;justify-content:center;font-size:30px;background:#eef3f8;margin-bottom:4px}' +
    '.g2-card.sel div{border-color:#2196f3}' +
    '.g2-item{display:flex;align-items:center;gap:16px;padding:14px 4px;font-size:17px;border-bottom:1px solid #eef0f3}' +
    '.g2-item i{width:28px;text-align:center;font-style:normal;font-size:22px}' +
    '.g2-sw{margin-left:auto;width:44px;height:24px;border-radius:12px;background:#bbb;position:relative;flex:none}' +
    '.g2-sw:after{content:"";position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .15s}' +
    '.g2-sw.on{background:#2196f3}.g2-sw.on:after{left:22px}' +
    '#g2-cats,#g2-poi{position:fixed;top:68px;left:0;right:0;bottom:0;z-index:2650;background:#eee;color:#111;overflow:auto;display:none;padding-bottom:30px}' +
    '.g2-cat{display:flex;align-items:center;gap:16px;padding:10px 16px;font-size:18px}' +
    '.g2-cat b{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;flex:none;font-weight:400}' +
    '.g2-poi{padding:12px 16px;border-bottom:1px solid #d6d9de;font-size:16px}.g2-poi small{display:block;opacity:.65;margin-top:2px}' +
    '.g2-h{padding:12px 16px;font-weight:700;font-size:15px;opacity:.7}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var K = 'g2-set', set = { zoom: true, awake: false, voice: true, miles: false, style: 'dark' };
  try { var sv = JSON.parse(localStorage.getItem(K) || '{}'); for (var k in sv) set[k] = sv[k]; } catch (e) {}
  function save() { try { localStorage.setItem(K, JSON.stringify(set)); } catch (e) {} }
  window.__noVoice = !set.voice; window.__miles = !!set.miles;

  function $(id) { return document.getElementById(id); }
  function getMap() { return window.__riamoMap || null; }
  function toast2(t) {
    var d = document.createElement('div'); d.textContent = t;
    d.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:120px;z-index:4100;background:#222;color:#fff;padding:8px 14px;border-radius:18px;font:13px sans-serif;max-width:86%;text-align:center';
    document.body.appendChild(d); setTimeout(function () { d.remove(); }, 3500);
  }
  function fmt(d) {
    if (window.__miles) { var mi = d / 1609.34; return mi < 0.2 ? Math.round(d * 3.281 / 10) * 10 + ' ft' : mi.toFixed(1) + ' mi'; }
    return d < 1000 ? Math.round(d / 10) * 10 + ' m' : (d / 1000).toFixed(1) + ' km';
  }

  var OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', AO = '© OpenStreetMap';
  var STY = {
    plan: { n: 'Plan', i: '🗺️', L: [{ u: OSM, a: AO, z: 19 }] },
    dark: { n: 'Sombre', i: '🌙', L: [{ u: OSM + '?dark=1', a: AO, z: 19 }] },
    sat: { n: 'Satellite', i: '🛰️', L: [
      { u: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', a: 'Imagerie © Esri', z: 19 },
      { u: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', a: '© Esri', z: 19 }] },
    terrain: { n: 'Terrain', i: '⛰️', L: [{ u: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', a: '© OpenTopoMap', z: 17 }] },
    hike: { n: 'Randonnée', i: '🥾', L: [{ u: OSM, a: AO, z: 19 }, { u: 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', a: '© Waymarked Trails', z: 18 }] },
    bike: { n: 'Cyclisme', i: '🚴', L: [{ u: OSM, a: AO, z: 19 }, { u: 'https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png', a: '© Wa

cd ~/riamo-gps-world
git pull
cat > gps2.js <<'EOF'
(function () {
  'use strict';
  var css = '.gps-map .leaflet-control-layers{display:none!important}' +
    '#g2-ui{display:none;font-family:sans-serif}' +
    '#g2-layers{position:fixed;left:12px;top:76px;z-index:2600;width:48px;height:48px;border-radius:50%;border:0;background:#fff;color:#111;font-size:22px;box-shadow:0 2px 10px #0006}' +
    '#g2-recb{position:fixed;left:12px;top:132px;z-index:2600;background:#d32f2f;color:#fff;border-radius:14px;padding:4px 10px;font:700 12px sans-serif;display:none}' +
    '#g2-back{position:fixed;top:0;left:0;right:0;bottom:0;z-index:2790;background:#0006;display:none}' +
    '#g2-sheet{position:fixed;left:0;right:0;bottom:0;z-index:2800;background:#fff;color:#111;border-radius:22px 22px 0 0;padding:16px 16px 24px;max-height:75vh;overflow:auto;display:none;box-shadow:0 -4px 16px #0005}' +
    '#g2-sheet h3{margin:0 0 14px;font-size:20px;display:flex;justify-content:space-between}' +
    '.g2-grid{display:flex;gap:12px;flex-wrap:wrap}' +
    '.g2-card{width:30%;text-align:center;font-size:13px;color:#1976d2}' +
    '.g2-card div{height:62px;border-radius:14px;border:3px solid #cfe3f7;display:flex;align-items:center;justify-content:center;font-size:30px;background:#eef3f8;margin-bottom:4px}' +
    '.g2-card.sel div{border-color:#2196f3}' +
    '.g2-item{display:flex;align-items:center;gap:16px;padding:14px 4px;font-size:17px;border-bottom:1px solid #eef0f3}' +
    '.g2-item i{width:28px;text-align:center;font-style:normal;font-size:22px}' +
    '.g2-sw{margin-left:auto;width:44px;height:24px;border-radius:12px;background:#bbb;position:relative;flex:none}' +
    '.g2-sw:after{content:"";position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .15s}' +
    '.g2-sw.on{background:#2196f3}.g2-sw.on:after{left:22px}' +
    '#g2-cats,#g2-poi{position:fixed;top:68px;left:0;right:0;bottom:0;z-index:2650;background:#eee;color:#111;overflow:auto;display:none;padding-bottom:30px}' +
    '.g2-cat{display:flex;align-items:center;gap:16px;padding:10px 16px;font-size:18px}' +
    '.g2-cat b{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;flex:none;font-weight:400}' +
    '.g2-poi{padding:12px 16px;border-bottom:1px solid #d6d9de;font-size:16px}.g2-poi small{display:block;opacity:.65;margin-top:2px}' +
    '.g2-h{padding:12px 16px;font-weight:700;font-size:15px;opacity:.7}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var K = 'g2-set', set = { zoom: true, awake: false, voice: true, miles: false, style: 'dark' };
  try { var sv = JSON.parse(localStorage.getItem(K) || '{}'); for (var k in sv) set[k] = sv[k]; } catch (e) {}
  function save() { try { localStorage.setItem(K, JSON.stringify(set)); } catch (e) {} }
  window.__noVoice = !set.voice; window.__miles = !!set.miles;

  function $(id) { return document.getElementById(id); }
  function getMap() { return window.__riamoMap || null; }
  function toast2(t) {
    var d = document.createElement('div'); d.textContent = t;
    d.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:120px;z-index:4100;background:#222;color:#fff;padding:8px 14px;border-radius:18px;font:13px sans-serif;max-width:86%;text-align:center';
    document.body.appendChild(d); setTimeout(function () { d.remove(); }, 3500);
  }
  function fmt(d) {
    if (window.__miles) { var mi = d / 1609.34; return mi < 0.2 ? Math.round(d * 3.281 / 10) * 10 + ' ft' : mi.toFixed(1) + ' mi'; }
    return d < 1000 ? Math.round(d / 10) * 10 + ' m' : (d / 1000).toFixed(1) + ' km';
  }

  var OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', AO = '© OpenStreetMap';
  var STY = {
    plan: { n: 'Plan', i: '🗺️', L: [{ u: OSM, a: AO, z: 19 }] },
    dark: { n: 'Sombre', i: '🌙', L: [{ u: OSM + '?dark=1', a: AO, z: 19 }] },
    sat: { n: 'Satellite', i: '🛰️', L: [
      { u: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', a: 'Imagerie © Esri', z: 19 },
      { u: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', a: '© Esri', z: 19 }] },
    terrain: { n: 'Terrain', i: '⛰️', L: [{ u: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', a: '© OpenTopoMap', z: 17 }] },
    hike: { n: 'Randonnée', i: '🥾', L: [{ u: OSM, a: AO, z: 19 }, { u: 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', a: '© Waymarked Trails', z: 18 }] },
    bike: { n: 'Cyclisme', i: '🚴', L: [{ u: OSM, a: AO, z: 19 }, { u: 'https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png', a: '© Waymarked Trails', z: 18 }] },
    metro: { n: 'Métro', i: '🚇', L: [{ u: OSM, a: AO, z: 19 }, { u: 'https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', a: '© OpenRailwayMap', z: 19 }] }
  };
  var appBase = null, cur = [];
  function clearCur(m) { cur.forEach(function (l) { if (m.hasLayer(l)) m.removeLayer(l); }); cur = []; }
  function applyStyle(key) {
    var m = getMap(); if (!m || !window.L || !STY[key]) return;
    if (!appBase) { appBase = []; m.eachLayer(function (l) { if (l instanceof L.TileLayer) appBase.push(l); }); }
    appBase.forEach(function (l) { if (m.hasLayer(l)) m.removeLayer(l); });
    clearCur(m);
    STY[key].L.forEach(function (d, i) {
      var l = L.tileLayer(d.u, { maxZoom: d.z, maxNativeZoom: d.z, subdomains: 'abc', attribution: d.a, zIndex: i + 1 });
      l.addTo(m); cur.push(l);
    });
    set.style = key; save();
  }
  function restoreBase() {
    var m = getMap(); if (!m || !appBase) return;
    clearCur(m); appBase.forEach(function (l) { if (!m.hasLayer(l)) l.addTo(m); });
  }

  var myPos = null, rec = null, lock = null, onGps = false, poiLayer = null;
  var oa = window.__rgArrow;
  if (oa) {
    window.__rgArrow = function (pos) {
      myPos = pos;
      if (rec) { var l = rec.pts[rec.pts.length - 1]; if (!l || l[0] !== pos[0] || l[1] !== pos[1]) rec.pts.push([pos[0], pos[1], new Date().toISOString()]); }
      return oa.apply(this, arguments);
    };
  }

  var ui = document.createElement('div'); ui.id = 'g2-ui';
  ui.innerHTML = '<button id="g2-layers" title="Styles de carte">🗂️</button><div id="g2-recb">● REC</div><div id="g2-back"></div><div id="g2-sheet"></div><div id="g2-cats"></div><div id="g2-poi"></div>';
  function closeSheet() { $('g2-back').style.display = 'none'; $('g2-sheet').style.display = 'none'; }
  function sheetOpen() { return $('g2-sheet').style.display === 'block'; }
  function openSheet(html) { $('g2-sheet').innerHTML = html; $('g2-back').style.display = 'block'; $('g2-sheet').style.display = 'block'; var x = $('g2-sx'); if (x) x.onclick = closeSheet; }
  function closePanels() { $('g2-cats').style.display = 'none'; $('g2-poi').style.display = 'none'; }
  function panelOpen() { return $('g2-cats').style.display === 'block' || $('g2-poi').style.display === 'block'; }

  function layersSheet() {
    var h = '<h3>Styles et couches de cartes <span id="g2-sx">✕</span></h3><div class="g2-grid">';
    Object.keys(STY).forEach(function (k) { h += '<div class="g2-card' + (set.style === k ? ' sel' : '') + '" data-s="' + k + '"><div>' + STY[k].i + '</div>' + STY[k].n + '</div>'; });
    openSheet(h + '</div>');
    Array.prototype.forEach.call(document.querySelectorAll('#g2-sheet .g2-card'), function (c) {
      c.onclick = function () { applyStyle(c.getAttribute('data-s')); closeSheet(); };
    });
  }

  function wake(on) {
    try {
      if (on && navigator.wakeLock && !lock) { navigator.wakeLock.request('screen').then(function (l) { lock = l; l.addEventListener('release', function () { lock = null; }); }).catch(function () {}); }
      else if (!on && lock) { lock.release(); lock = null; }
    } catch (e) {}
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && set.awake && onGps) wake(true); });
  function applySettings() {
    var z = $('gps-zoom'); if (z) z.style.display = set.zoom ? 'flex' : 'none';
    window.__noVoice = !set.voice; window.__miles = !!set.miles; wake(set.awake && onGps);
  }
  var ROWS = [['zoom', 'Boutons « + » et « − » sur la carte'], ['voice', 'Instructions vocales'], ['awake', 'Laisser l’écran allumé'], ['miles', 'Unités : miles au lieu de kilomètres']];
  function settingsSheet() {
    var h = '<h3>Paramètres <span id="g2-sx">✕</span></h3>';
    ROWS.forEach(function (r) { h += '<div class="g2-item" data-k="' + r[0] + '">' + r[1] + '<div class="g2-sw' + (set[r[0]] ? ' on' : '') + '"></div></div>'; });
    openSheet(h);
    Array.prototype.forEach.call(document.querySelectorAll('#g2-sheet .g2-item'), function (it) {
      it.onclick = function () {
        var key = it.getAttribute('data-k'); set[key] = !set[key]; save(); applySettings();
        it.querySelector('.g2-sw').classList.toggle('on', !!set[key]);
      };
    });
  }

  function gpx(pts) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Riamo GPS World" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Trajet Riamo</name><trkseg>' +
      pts.map(function (p) { return '<trkpt lat="' + p[0] + '" lon="' + p[1] + '"><time>' + p[2] + '</time></trkpt>'; }).join('') + '</trkseg></trk></gpx>';
  }
  function download(name, text) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/gpx+xml' })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function toggleRec() {
    if (!rec) {
      rec = { pts: [] }; if (myPos) rec.pts.push([myPos[0], myPos[1], new Date().toISOString()]);
      $('g2-recb').style.display = 'block'; toast2('● Enregistrement du trajet démarré');
    } else {
      var r = rec; rec = null; $('g2-recb').style.display = 'none';
      if (r.pts.length < 2) { toast2('Trajet trop court : rien à enregistrer.'); return; }
      var d = new Date();
      download('trajet-' + d.toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.gpx', gpx(r.pts));
      toast2('Trajet enregistré (' + r.pts.length + ' points)');
    }
  }
  function curPos() { var m = getMap(); return myPos || (m ? [m.getCenter().lat, m.getCenter().lng] : null); }
  function sharePos() {
    var p = curPos(); if (!p) { toast2('Position inconnue.'); return; }
    var url = 'https://www.openstreetmap.org/?mlat=' + p[0].toFixed(6) + '&mlon=' + p[1].toFixed(6) + '#map=17/' + p[0].toFixed(6) + '/' + p[1].toFixed(6);
    if (navigator.share) navigator.share({ title: 'Ma position', text: 'Ma position', url: url }).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast2('Lien copié'); });
    else window.open(url, '_blank');
  }
  function menuSheet() {
    openSheet('<div class="g2-item" id="m-add"><i>➕</i>Ajouter un lieu sur OpenStreetMap</div>' +
      '<div class="g2-item" id="m-dl"><i>⬇️</i>Cartes hors ligne</div>' +
      '<div class="g2-item" id="m-set"><i>⚙️</i>Paramètres</div>' +
      '<div class="g2-item" id="m-rec"><i>🔴</i>' + (rec ? 'Arrêter et enregistrer le trajet' : 'Enregistrer le trajet') + '</div>' +
      '<div class="g2-item" id="m-share"><i>📤</i>Partager ma position</div>');
    $('m-add').onclick = function () { var p = curPos(); closeSheet(); if (p) window.open('https://www.openstreetmap.org/edit#map=17/' + p[0].toFixed(5) + '/' + p[1].toFixed(5), '_blank'); };
    $('m-dl').onclick = function () { closeSheet(); toast2('Les zones OpenStreetMap déjà affichées restent disponibles hors ligne.'); };
    $('m-set').onclick = settingsSheet;
    $('m-rec').onclick = function () { closeSheet(); toggleRec(); };
    $('m-share').onclick = function () { closeSheet(); sharePos(); };
  }

  var CATS = [
    ['Un endroit pour manger', '🍴', '#9a7217', ['["amenity"~"restaurant|fast_food|cafe|food_court"]']],
    ['Hôtel', '🛏️', '#7b3a14', ['["tourism"~"hotel|hostel|guest_house|motel"]']],
    ['Épiceries', '🛒', '#5b5f53', ['["shop"~"supermarket|convenience|greengrocer|grocery"]']],
    ['Sites touristiques', '⭐', '#7b3a14', ['["tourism"~"attraction|museum|viewpoint|artwork"]']],
    ['WiFi', '📶', '#5a5c4f', ['["internet_access"="wlan"]']],
    ['Transport', '🚆', '#2b2f2b', ['["railway"~"station|halt"]', '["amenity"="bus_station"]', '["highway"="bus_stop"]']],
    ['Stations-service', '⛽', '#5b5f53', ['["amenity"="fuel"]']],
    ['Stationnement', '🅿️', '#2277a3', ['["amenity"="parking"]']],
    ['Achats', '🛍️', '#7a4a8a', ['["shop"~"mall|department_store|clothes|shoes"]']],
    ['D’occasion', '♻️', '#7a4a8a', ['["shop"~"second_hand|charity"]']],
    ['DAB', '💳', '#5b5f53', ['["amenity"="atm"]']],
    ['Vie nocturne', '🍸', '#a8832c', ['["amenity"~"bar|pub|nightclub"]']],
    ['Banque', '🏦', '#5b5f53', ['["amenity"="bank"]']],
    ['Divertissement', '🎬', '#7b3a14', ['["amenity"~"cinema|theatre"]']],
    ['Eau', '💧', '#14a0c8', ['["amenity"="drinking_water"]']],
    ['Hôpital', '🏥', '#b83b3b', ['["amenity"~"hospital|clinic"]']],
    ['Pharmacie', '💊', '#b83b3b', ['["amenity"="pharmacy"]']],
    ['Recyclage', '♻️', '#5bb02a', ['["amenity"="recycling"]']],
    ['Aménagements pour camping-car', '🚐', '#6b6e60', ['["amenity"="sanitary_dump_station"]', '["tourism"="caravan_site"]']],
    ['Police', '👮', '#5b5f53', ['["amenity"="police"]']],
    ['Toilettes', '🚻', '#5b5f53', ['["amenity"="toilets"]']],
    ['Poste', '✉️', '#5b5f53', ['["amenity"="post_office"]']]
  ];
  function openCats() {
    var h = '<div class="g2-h">CATÉGORIES</div>';
    CATS.forEach(function (c, i) { h += '<div class="g2-cat" data-c="' + i + '"><b style="background:' + c[2] + '">' + c[1] + '</b>' + c[0] + '</div>'; });
    var el = $('g2-cats'); el.innerHTML = h; el.style.display = 'block'; $('g2-poi').style.display = 'none';
    Array.prototype.forEach.call(el.querySelectorAll('.g2-cat'), function (d) {
      d.onclick = function () { searchCat(CATS[+d.getAttribute('data-c')]); };
    });
  }
  function showPoi(html) {
    var el = $('g2-poi');
    el.innerHTML = '<div class="g2-poi" id="g2-pb">← Retour aux catégories</div>' + html;
    el.style.display = 'block'; $('g2-cats').style.display = 'none';
    $('g2-pb').onclick = openCats;
  }
  function poiQuery(c, lat, lon, r) {
    var parts = c[3].map(function (f) { return 'nwr' + f + '(around:' + r + ',' + lat + ',' + lon + ');'; });
    return '[out:json][timeout:25];(' + parts.join('') + ');out center 60;';
  }
  function searchCat(c) {
    var p = curPos(); if (!p) { toast2('Position inconnue.'); return; }
    showPoi('<div class="g2-h">' + c[1] + ' ' + c[0] + ' · recherche…</div>');
    tryRadius(c, p, 3000);
  }
  function tryRadius(c, p, r) {
    fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(poiQuery(c, p[0], p[1], r)))
      .then(function (x) { return x.json(); }).then(function (j) {
        var res = (j.elements || []).map(function (e) {
          var la = e.lat != null ? e.lat : (e.center && e.center.lat), lo = e.lon != null ? e.lon : (e.center && e.center.lon);
          if (la == null || lo == null) return null;
          var t = e.tags || {};
          return { n: t.name || t.brand || t.operator || c[0], la: la, lo: lo, d: L.latLng(p[0], p[1]).distanceTo(L.latLng(la, lo)),
            a: [t['addr:street'], t['addr:city']].filter(Boolean).join(', ') };
        }).filter(Boolean).sort(function (a, b) { return a.d - b.d; }).slice(0, 30);
        if (!res.length && r < 12000) { tryRadius(c, p, 12000); return; }
        listPoi(c, res);
      }).catch(function () { showPoi('<div class="g2-h">Recherche impossible (réseau).</div>'); });
  }
  function pickPoi(o) {
    var tj = window.__tj; closePanels();
    $('gps-q').value = o.n; $('gps-q').blur();
    if (!tj) { toast2('Module itinéraire absent.'); return; }
    tj.S.to = [o.la, o.lo]; if (myPos) tj.S.from = myPos;
    tj.compute();
  }
  function listPoi(c, res) {
    var m = getMap();
    if (poiLayer && m) { m.removeLayer(poiLayer); poiLayer = null; }
    var h = '<div class="g2-h">' + c[1] + ' ' + c[0] + ' · ' + res.length + ' résultat(s) proche(s)</div>';
    if (!res.length) h += '<div class="g2-poi">Rien trouvé dans cette zone.</div>';
    res.forEach(function (o, i) { h += '<div class="g2-poi" data-i="' + i + '"><b>' + o.n.replace(/</g, '&lt;') + '</b><small>' + fmt(o.d) + (o.a ? ' · ' + o.a.replace(/</g, '&lt;') : '') + '</small></div>'; });
    showPoi(h);
    Array.prototype.forEach.call($('g2-poi').querySelectorAll('[data-i]'), function (d) { d.onclick = function () { pickPoi(res[+d.getAttribute('data-i')]); }; });
    if (m && res.length) {
      poiLayer = L.layerGroup(res.map(function (o) {
        var mk = L.marker([o.la, o.lo], { icon: L.divIcon({ className: '', html: '<div style="font-size:24px;filter:drop-shadow(0 1px 2px #000)">' + c[1] + '</div>', iconSize: [28, 28], iconAnchor: [14, 14] }) });
        mk.on('click', function () { pickPoi(o); });
        return mk;
      })).addTo(m);
    }
  }

  var tries = 0;
  function mount() {
    var top = $('gps-top'), q = $('gps-q');
    if (!top || !q) { if (tries++ < 20) setTimeout(mount, 400); return; }
    document.body.appendChild(ui);
    var mb = document.createElement('button'); mb.id = 'g2-menu'; mb.textContent = '☰'; mb.title = 'Menu'; top.appendChild(mb);
    mb.onclick = menuSheet;
    $('g2-layers').onclick = layersSheet;
    $('g2-back').onclick = closeSheet;
    q.addEventListener('focus', function () { if (!q.value.trim()) openCats(); });
    q.addEventListener('click', function () { if (!q.value.trim() && !panelOpen()) openCats(); });
    q.addEventListener('input', function () { if (q.value.trim()) closePanels(); else openCats(); });
    $('gps-x').addEventListener('click', function (e) {
      if (sheetOpen() || panelOpen()) { e.stopImmediatePropagation(); closeSheet(); closePanels(); }
    }, true);
    new MutationObserver(function () {
      var on = document.documentElement.classList.contains('gps-on');
      if (on === onGps) return; onGps = on;
      if (on) { ui.style.display = 'block'; applyStyle(STY[set.style] ? set.style : 'dark'); applySettings(); }
      else {
        ui.style.display = 'none'; closeSheet(); closePanels(); restoreBase(); wake(false);
        var m = getMap(); if (poiLayer && m) { m.removeLayer(poiLayer); poiLayer = null; }
      }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
