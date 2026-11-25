(function () {
  'use strict';
  var css = '.rg-btn2[title="Plein écran"]{display:none!important}' +
    '#gps-open{position:fixed;right:12px;bottom:210px;z-index:1500;height:46px;padding:0 14px;border-radius:23px;border:0;background:linear-gradient(90deg,#22d3a8,#38bdf8);color:#04121f;font:700 14px sans-serif;box-shadow:0 2px 8px #0006}' +
    'html.gps-on,html.gps-on body{overflow:hidden!important}' +
    '.gps-map{position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;width:100%!important;height:100%!important;z-index:2400!important;margin:0!important;border-radius:0!important}' +
    '.gps-map .leaflet-control-zoom{display:none!important}' +
    'html.gps-on #tj-fab,html.gps-on #tj-float{display:none!important}' +
    '#gps-ui{display:none;font-family:sans-serif}' +
    '#gps-ui>*{position:fixed;z-index:2600}' +
    '#gps-top{top:8px;left:8px;right:8px;display:flex;gap:6px;align-items:center;background:#fff;border-radius:28px;padding:6px;box-shadow:0 3px 12px #0006}' +
    '#gps-top input{flex:1;min-width:0;border:0;outline:0;font-size:16px;padding:8px;color:#111;background:transparent}' +
    '#gps-top button{width:40px;height:40px;border-radius:50%;border:0;background:#eef3f8;font-size:18px;color:#111}' +
    '#gps-r{top:68px;left:8px;right:8px;list-style:none;margin:0;padding:0;background:#fff;color:#111;border-radius:14px;max-height:40vh;overflow:auto;box-shadow:0 3px 12px #0006;display:none}' +
    '#gps-r li{padding:12px;border-bottom:1px solid #e3e8ee;font-size:14px}' +
    '#gps-zoom{right:12px;top:45%;display:flex;flex-direction:column;gap:10px}' +
    '#gps-zoom button,#gps-loc{width:54px;height:54px;border-radius:50%;border:0;background:#fff;color:#111;font-size:28px;box-shadow:0 2px 10px #0006}' +
    '#gps-loc{right:12px;bottom:130px;padding:0;display:flex;align-items:center;justify-content:center}' +
    '#gps-card{left:8px;right:8px;bottom:10px;background:#fff;color:#111;border-radius:18px;padding:12px;box-shadow:0 3px 14px #0007;display:none;font-size:15px}' +
    '#gps-card button{margin:8px 6px 0 0;padding:11px 16px;border-radius:12px;border:0;font-size:15px;font-weight:700}' +
    '#gps-go{background:linear-gradient(90deg,#22d3a8,#38bdf8);color:#04121f}' +
    '#gps-stop,#gps-clr{background:#e6ebf1;color:#111}' +
    '#gps-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:120px;z-index:4000;background:#222;color:#fff;padding:8px 14px;border-radius:18px;font:13px sans-serif}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var arrow = null, lastPos = null, lastHead = 0, follow = true, moving = false, watchId = null, orig = null, dragBound = false;
  var ARROW = '<svg viewBox="0 0 48 48" width="48" height="48"><path d="M24 4 L40 42 L24 34 L8 42 Z" fill="#2196f3" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>';
  function getMap() { return window.__riamoMap || null; }
  function toast(t) {
    var d = document.createElement('div'); d.id = 'gps-toast'; d.textContent = t; document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 3500);
  }
  function bearing(a, b) {
    var r = Math.PI / 180, dl = (b[1] - a[1]) * r;
    var y = Math.sin(dl) * Math.cos(b[0] * r);
    var x = Math.cos(a[0] * r) * Math.sin(b[0] * r) - Math.sin(a[0] * r) * Math.cos(b[0] * r) * Math.cos(dl);
    return (Math.atan2(y, x) / r + 360) % 360;
  }
  function setHead(h) {
    lastHead = h;
    if (arrow && arrow.getElement()) { var d = arrow.getElement().firstChild; if (d) d.style.transform = 'rotate(' + h + 'deg)'; }
  }
  window.__rgArrow = function (pos, heading, speed) {
    var m = getMap(); if (!m || !window.L) return;
    moving = speed != null && speed > 1.5;
    if (heading == null || isNaN(heading)) {
      if (lastPos && L.latLng(lastPos).distanceTo(L.latLng(pos)) > 5) heading = bearing(lastPos, pos); else heading = lastHead;
    }
    if (!arrow) {
      arrow = L.marker(pos, { icon: L.divIcon({ className: '', html: '<div style="width:48px;height:48px;transition:transform .3s">' + ARROW + '</div>', iconSize: [48, 48], iconAnchor: [24, 24] }), zIndexOffset: 1000, interactive: false }).addTo(m);
    } else { arrow.setLatLng(pos); }
    lastPos = pos; setHead(heading);
  };
  window.addEventListener('deviceorientationabsolute', function (e) {
    if (e.alpha != null && !moving && e.beta != null && Math.abs(e.beta) < 50) setHead((360 - e.alpha) % 360);
  }, true);

  function startWatch() {
    if (watchId != null || !navigator.geolocation) return;
    watchId = navigator.geolocation.watchPosition(function (p) {
      var pos = [p.coords.latitude, p.coords.longitude], m = getMap();
      window.__rgArrow(pos, p.coords.heading, p.coords.speed);
      var driving = window.__tj && window.__tj.S.driving;
      if (m && follow && !driving) m.setView(pos, Math.max(m.getZoom(), 16));
    }, function () { toast('Position refusée : autorise la localisation pour ce site.'); },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 30000 });
  }

  var ui = document.createElement('div'); ui.id = 'gps-ui';
  ui.innerHTML = '<div id="gps-top"><button id="gps-x" title="Quitter">✕</button><input id="gps-q" type="search" placeholder="Où allez-vous ?"><button id="gps-s">🔍</button></div>' +
    '<ul id="gps-r"></ul>' +
    '<div id="gps-zoom"><button id="gps-zi">+</button><button id="gps-zo">−</button></div>' +
    '<button id="gps-loc" title="Ma position">' + ARROW.replace('width="48" height="48"', 'width="30" height="30"') + '</button>' +
    '<div id="gps-card"><div id="gps-info"></div><button id="gps-go">▶ Démarrer</button><button id="gps-stop">⏹ Arrêter</button><button id="gps-clr">✕ Effacer</button></div>';

  function $(id) { return document.getElementById(id); }
  function enter() {
    var m = getMap();
    if (!m) { toast('Carte non détectée : ouvre Application GPS puis réessaie.'); return; }
    var c = m.getContainer();
    orig = { p: c.parentNode, n: c.nextSibling, c: c };
    document.body.appendChild(c);
    c.classList.add('gps-map'); document.documentElement.classList.add('gps-on');
    ui.style.display = 'block';
    try { document.documentElement.requestFullscreen(); } catch (e) {}
    setTimeout(function () { m.invalidateSize(); }, 150);
    follow = true; startWatch();
    if (!dragBound) { m.on('dragstart', function () { follow = false; }); dragBound = true; }
  }
  function exit() {
    if (!orig) return;
    var m = getMap(), c = orig.c;
    c.classList.remove('gps-map');
    if (orig.n && orig.n.parentNode === orig.p) orig.p.insertBefore(c, orig.n); else orig.p.appendChild(c);
    document.documentElement.classList.remove('gps-on'); ui.style.display = 'none';
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
    orig = null;
    setTimeout(function () { if (m) m.invalidateSize(); }, 150);
  }
  function goRoute() {
    var tj = window.__tj; if (!tj) { toast('Module itinéraire absent.'); return; }
    startWatch();
    if (lastPos) tj.S.from = lastPos;
    tj.compute();
  }
  function doSearch() {
    var v = $('gps-q').value.trim(), tj = window.__tj; if (!v) return;
    if (!tj) { toast('Module itinéraire absent.'); return; }
    var res = $('gps-r'); res.style.display = 'block';
    tj.search(v, res, function (p, n) { res.innerHTML = ''; res.style.display = 'none'; $('gps-q').value = n; tj.S.to = p; goRoute(); });
  }
  function clearRoute() {
    var tj = window.__tj, m = getMap(); if (!tj) return;
    if (tj.S.driving) tj.stopDrive();
    if (tj.S.layer && m) m.removeLayer(tj.S.layer);
    tj.S.layer = null; tj.S.steps = []; tj.S.coords = []; tj.S.to = null;
    var i = $('tj-info'); if (i) i.textContent = '';
    var g = $('tj-drive'); if (g) g.style.display = 'none';
    $('gps-q').value = '';
  }
  function mount() {
    document.body.appendChild(ui);
    var b = document.createElement('button'); b.id = 'gps-open'; b.textContent = '🗺️ GPS plein écran'; b.onclick = enter;
    document.body.appendChild(b);
    $('gps-x').onclick = function () { if (window.__tj && window.__tj.S.driving) window.__tj.stopDrive(); exit(); };
    $('gps-s').onclick = doSearch;
    $('gps-q').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });
    $('gps-zi').onclick = function () { var m = getMap(); if (m) m.zoomIn(); };
    $('gps-zo').onclick = function () { var m = getMap(); if (m) m.zoomOut(); };
    $('gps-loc').onclick = function () {
      var m = getMap(); follow = true; startWatch();
      if (lastPos && m) m.setView(lastPos, Math.max(m.getZoom(), 17)); else toast('Recherche du signal GPS…');
    };
    $('gps-go').onclick = function () { if (window.__tj) window.__tj.startDrive(); };
    $('gps-stop').onclick = function () { if (window.__tj) window.__tj.stopDrive(); };
    $('gps-clr').onclick = clearRoute;
    setInterval(function () {
      if (!orig || !window.__tj) return;
      var t = $('tj-info'), g = $('tj-drive'), txt = t ? t.textContent : '', drv = window.__tj.S.driving;
      $('gps-card').style.display = txt ? 'block' : 'none';
      $('gps-info').textContent = txt;
      $('gps-go').style.display = (g && g.style.display !== 'none' && !drv) ? 'inline-block' : 'none';
      $('gps-stop').style.display = drv ? 'inline-block' : 'none';
    }, 600);
    window.__gpsFull = enter;
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
