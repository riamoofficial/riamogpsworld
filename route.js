(function () {
  'use strict';
  var map = null;
  if (window.L && L.Map && L.Map.addInitHook) {
    L.Map.addInitHook(function () { map = this; window.__riamoMap = this; });
  }
  var S = { from: null, to: null, mode: 'car', steps: [], coords: [], layer: null,
            me: null, watch: null, idx: 1, spoken: {}, lastReroute: 0, driving: false, pick: false };

  var css = '#rg-fab{position:fixed;left:12px;bottom:90px;z-index:1200;background:#1a73e8;color:#fff;border:0;border-radius:24px;padding:12px 16px;font:600 15px sans-serif;box-shadow:0 2px 8px #0006}' +
    '#rg-panel{position:fixed;left:8px;right:8px;bottom:8px;z-index:1300;background:#fff;color:#111;border-radius:14px;padding:12px;box-shadow:0 4px 16px #0007;font:14px sans-serif;display:none;max-height:70vh;overflow:auto}' +
    '#rg-panel input{width:100%;box-sizing:border-box;padding:10px;margin:4px 0;border:1px solid #bbb;border-radius:8px;font-size:15px}' +
    '#rg-panel button{padding:9px 12px;margin:3px 3px 3px 0;border:1px solid #1a73e8;background:#fff;color:#1a73e8;border-radius:8px;font-size:14px}' +
    '#rg-panel button.on,#rg-panel button.main{background:#1a73e8;color:#fff}' +
    '#rg-sug div{padding:8px;border-bottom:1px solid #eee}' +
    '#rg-banner{position:fixed;top:8px;left:8px;right:8px;z-index:1400;background:#0b57d0;color:#fff;border-radius:12px;padding:12px;font:600 17px sans-serif;display:none;box-shadow:0 3px 10px #0008}' +
    '#rg-banner small{display:block;font-weight:400;font-size:13px;margin-top:4px}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function el(h) { var d = document.createElement('div'); d.innerHTML = h; return d.firstChild; }
  var fab = el('<button id="rg-fab">🧭 Route</button>');
  var banner = el('<div id="rg-banner"></div>');
  var panel = el('<div id="rg-panel">' +
    '<b>Itinéraire</b> <button id="rg-close" style="float:right">✕</button>' +
    '<input id="rg-from" placeholder="Départ : ma position (GPS)">' +
    '<button id="rg-me">📍 Ma position</button>' +
    '<input id="rg-to" type="search" placeholder="Destination : adresse, ville, lieu…">' +
    '<button id="rg-pick">🖱️ Sur la carte</button><button id="rg-go" class="main">Rechercher</button>' +
    '<div id="rg-sug"></div>' +
    '<div><button data-m="car" class="on">🚗 Voiture</button><button data-m="bike">🚲 Vélo</button><button data-m="foot">🚶 À pied</button></div>' +
    '<div id="rg-info" style="margin:6px 0"></div>' +
    '<button id="rg-drive" class="main" style="display:none">▶ Mode conduite</button>' +
    '<button id="rg-stop" style="display:none">⏹ Arrêter</button>' +
    '<div id="rg-steps"></div></div>');
  document.addEventListener('DOMContentLoaded', function () {
    document.body.appendChild(fab); document.body.appendChild(banner); document.body.appendChild(panel); bind();
  });
  if (document.readyState !== 'loading') { document.body.appendChild(fab); document.body.appendChild(banner); document.body.appendChild(panel); bind(); }

  function $(id) { return document.getElementById(id); }
  function getMap() { return map || window.__riamoMap; }
  function fmtD(m) { return m < 1000 ? (Math.round(m / 10) * 10) + ' m' : (m / 1000).toFixed(1) + ' km'; }
  function fmtT(s) { var m = Math.round(s / 60); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; }
  function dist(a, b) { return L.latLng(a[0], a[1]).distanceTo(L.latLng(b[0], b[1])); }

  function say(t) {
    try { var u = new SpeechSynthesisUtterance(t); u.lang = 'fr-FR'; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {}
  }
  function txt(s) {
    var m = s.maneuver || {}, n = s.name ? ' sur ' + s.name : '';
    var mod = { left: 'à gauche', right: 'à droite', 'slight left': 'légèrement à gauche', 'sli

cd ~/riamo-gps-world
rm -f route.js
cp -n index.html index.html.bak
cat > route.js <<'EOF'
(function () {
  'use strict';
  var map = null;
  if (window.L && L.Map && L.Map.addInitHook) {
    L.Map.addInitHook(function () { map = this; window.__riamoMap = this; });
  }
  var S = { from: null, to: null, mode: 'car', steps: [], coords: [], layer: null,
            me: null, watch: null, idx: 1, spoken: {}, lastReroute: 0, driving: false };

  var css = '#rg-fab{position:fixed;left:12px;bottom:90px;z-index:1200;background:#1a73e8;color:#fff;border:0;border-radius:24px;padding:12px 16px;font:600 15px sans-serif;box-shadow:0 2px 8px #0006}' +
    '#rg-panel{position:fixed;left:8px;right:8px;bottom:8px;z-index:1300;background:#fff;color:#111;border-radius:14px;padding:12px;box-shadow:0 4px 16px #0007;font:14px sans-serif;display:none;max-height:70vh;overflow:auto}' +
    '#rg-panel input{width:100%;box-sizing:border-box;padding:10px;margin:4px 0;border:1px solid #bbb;border-radius:8px;font-size:15px}' +
    '#rg-panel button{padding:9px 12px;margin:3px 3px 3px 0;border:1px solid #1a73e8;background:#fff;color:#1a73e8;border-radius:8px;font-size:14px}' +
    '#rg-panel button.on,#rg-panel button.main{background:#1a73e8;color:#fff}' +
    '#rg-sug div{padding:8px;border-bottom:1px solid #eee}' +
    '#rg-banner{position:fixed;top:8px;left:8px;right:8px;z-index:1400;background:#0b57d0;color:#fff;border-radius:12px;padding:12px;font:600 17px sans-serif;display:none;box-shadow:0 3px 10px #0008}' +
    '#rg-banner small{display:block;font-weight:400;font-size:13px;margin-top:4px}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function el(h) { var d = document.createElement('div'); d.innerHTML = h; return d.firstChild; }
  var fab = el('<button id="rg-fab">🧭 Route</button>');
  var banner = el('<div id="rg-banner"></div>');
  var panel = el('<div id="rg-panel">' +
    '<b>Itinéraire</b> <button id="rg-close" style="float:right">✕</button>' +
    '<input id="rg-from" placeholder="Départ : ma position (GPS)">' +
    '<button id="rg-me">📍 Ma position</button>' +
    '<input id="rg-to" type="search" placeholder="Destination : adresse, ville, lieu…">' +
    '<
cat >> route.js <<'EOF'

  function $(id) { return document.getElementById(id); }
  function getMap() { return map || window.__riamoMap; }
  function fmtD(m) { return m < 1000 ? (Math.round(m / 10) * 10) + ' m' : (m / 1000).toFixed(1) + ' km'; }
  function fmtT(s) { var m = Math.round(s / 60); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; }
  function dist(a, b) { return L.latLng(a[0], a[1]).distanceTo(L.latLng(b[0], b[1])); }

  function say(t) {
    try { var u = new SpeechSynthesisUtterance(t); u.lang = 'fr-FR'; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {}
  }
  function txt(s) {
    var m = s.maneuver || {}, n = s.name ? ' sur ' + s.name : '';
    var mod = { left: 'à gauche', right: 'à droite', 'slight left': 'légèrement à gauche', 'slight right': 'légèrement à droite',
      'sharp left': 'franchement à gauche', 'sharp right': 'franchement à droite' }[m.modifier];
    if (m.type === 'depart') return 'Départ' + n;
    if (m.type === 'arrive') return 'Vous êtes arrivé';
    if (m.type === 'roundabout' || m.type === 'rotary') return 'Au rond-point, prenez la sortie' + n;
    if (m.modifier === 'uturn') return 'Faites demi-tour';
    if (!mod || m.modifier === 'straight') return 'Continuez tout droit' + n;
    return 'Tournez ' + mod + n;
  }

  function locate(cb) {
    navigator.geolocation.getCurrentPosition(function (p) { cb([p.coords.latitude, p.coords.longitude]); },
      function () { alert('Position GPS indisponible. Active la localisation.'); }, { enableHighAccuracy: true, timeout: 15000 });
  }

  function geocode(q) {
    fetch('https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=fr&q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); }).then(function (res) {
        var box = $('rg-sug'); box.innerHTML = '';
        if (!res.length) { box.textContent = 'Aucun résultat.'; return; }
        res.forEach(function (r) {
          var d = document.createElement('div'); d.textContent = r.display_name;
          d.onclick = function () { S.to = [+r.lat, +r.lon]; $('rg-to').value = r.display_name; box.innerHTML = ''; compute(); };
          box.appendChild(d);
        });
      }).catch(function () { $('rg-sug').textContent = 'Recherche impossible (réseau).'; });
  }

  function compute(fromPos) {
    var m = getMap();
    if (!m) { alert('Carte introuvable.'); return; }
    var go = function (from) {
      S.from = from;
      if (!S.to) return;
      var url = 'https://routing.openstreetmap.de/routed-' + S.mode + '/route/v1/driving/' +
        from[1] + ',' + from[0] + ';' + S.to[1] + ',' + S.to[0] + '?overview=full&geometries=geojson&steps=true';
      $('rg-info').textContent = 'Calcul…';
      fetch(url).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.routes || !j.routes.length) { $('rg-info').textContent = 'Aucun itinéraire trouvé.'; return; }
        var rt = j.routes[0];
        S.coords = rt.geometry.coordinates.map(function (c) { return [c[1], c[0]]; });
        S.steps = rt.legs[0].steps; S.idx = 1; S.spoken = {};
        if (S.layer) m.removeLayer(S.layer);
        S.layer = L.polyline(S.coords, { color: '#1a73e8', weight: 6 }).addTo(m);
        if (!S.driving) m.fitBounds(S.layer.getBounds(), { padding: [40, 40] });
        $('rg-info').textContent = fmtD(rt.distance) + ' · ' + fmtT(rt.duration);
        $('rg-steps').innerHTML = S.steps.map(function (s) { return '<div style="padding:4px 0;border-bottom:1px solid #eee">' + txt(s) + ' <small>(' + fmtD(s.distance) + ')</small></div>'; }).join('');
        $('rg-drive').style.display = 'inline-block';
      }).catch(function () { $('rg-info').textContent = 'Erreur réseau.'; });
    };
    if (fromPos) go(fromPos); else if (S.from) go(S.from); else locate(go);
  }

  function nearestDist(p) {
    var best = 1e9; for (var i = 0; i < S.coords.length; i += 2) { var d = dist(p, S.coords[i]); if (d < best) best = d; } return best;
  }

  function onPos(p) {
    var pos = [p.coords.latitude, p.coords.longitude], m = getMap();
    if (!S.me) S.me = L.circleMarker(pos, { radius: 9, color: '#fff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1 }).addTo(m);
    else S.me.setLatLng(pos);
    m.setView(pos, Math.max(m.getZoom(), 17));
    var sp = p.coords.speed ? Math.round(p.coords.speed * 3.6) + ' km/h' : '';
    while (S.idx < S.steps.length - 1 && dist(pos, [S.steps[S.idx].maneuver.location[1], S.steps[S.idx].maneuver.location[0]]) < 25) S.idx++;
    var s = S.steps[S.idx];
    if (s) {
      var d = dist(pos, [s.maneuver.location[1], s.maneuver.location[0]]);
      banner.innerHTML = txt(s) + '<small>dans ' + fmtD(d) + (sp ? ' · ' + sp : '') + '</small>';
      if (d < 150 && !S.spoken[S.idx]) { S.spoken[S.idx] = 1; say('Dans ' + fmtD(d) + ', ' + txt(s)); }
      if (s.maneuver.type === 'arrive' && d < 30) { say('Vous êtes arrivé'); stopDrive(); return; }
    }
    if (S.coords.length && nearestDist(pos) > 60 && Date.now() - S.lastReroute > 15000) {
      S.lastReroute = Date.now(); say('Recalcul de l’itinéraire'); compute(pos);
    }
  }

  function startDrive() {
    if (!S.steps.length) return;
    S.driving = true; panel.style.display = 'none'; fab.style.display = 'none'; banner.style.display = 'block';
    banner.textContent = 'Recherche du signal GPS…';
    $('rg-stop').style.display = 'inline-block';
    try { navigator.wakeLock && navigator.wakeLock.request('screen'); } catch (e) {}
    S.watch = navigator.geolocation.watchPosition(onPos, function () { banner.textContent = 'GPS indisponible'; },
      { enableHighAccuracy: true, maximumAge: 1000 });
    say('Navigation démarrée');
  }
  function stopDrive() {
    S.driving = false; if (S.watch != null) navigator.geolocation.clearWatch(S.watch); S.watch = null;
    banner.style.display = 'none'; fab.style.display = 'block'; $('rg-stop').style.display = 'none';
  }

  function bind() {
    fab.onclick = function () { panel.style.display = 'block'; };
    $('rg-close').onclick = function () { panel.style.display = 'none'; };
    $('rg-me').onclick = function () { locate(function (p) { S.from = p; $('rg-from').value = 'Ma position (GPS)'; compute(); }); };
    $('rg-go').onclick = function () { var q = $('rg-to').value.trim(); if (q) geocode(q); };
    $('rg-to').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('rg-go').click(); } });
    $('rg-pick').onclick = function () {
      var m = getMap(); if (!m) return; panel.style.display = 'none';
      m.once('click', function (e) { S.to = [e.latlng.lat, e.latlng.lng]; $('rg-to').value = 'Point choisi sur la carte'; panel.style.display = 'block'; compute(); });
    };
    Array.prototype.forEach.call(panel.querySelectorAll('[data-m]'), function (b) {
      b.onclick = function () {
        S.mode = b.getAttribute('data-m');
        Array.prototype.forEach.call(panel.querySelectorAll('[data-m]'), function (x) { x.classList.toggle('on', x === b); });
        if (S.to) compute();
      };
    });
    $('rg-drive').onclick = startDrive;
    $('rg-stop').onclick = stopDrive;
  }
})();
