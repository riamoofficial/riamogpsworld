(function () {
  'use strict';
  var S = { from: null, to: null, mode: 'car', steps: [], coords: [], layer: null, me: null, watch: null, idx: 1, spoken: {}, lastReroute: 0, driving: false };
  var fl = null, myTab = null;
  function getMap() { return window.__riamoMap || null; }
  if (window.L && L.Map) {
    ['invalidateSize', 'getZoom', 'getBounds', 'setView', 'panTo', 'fitBounds'].forEach(function (n) {
      var o = L.Map.prototype[n]; if (!o || o.__rg) return;
      var w = function () { if (!window.__riamoMap) window.__riamoMap = this; return o.apply(this, arguments); };
      w.__rg = 1; L.Map.prototype[n] = w;
    });
    setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 400);
  }
  var css = '.tj{padding:12px 14px}.tj h3{margin:0 0 6px;font-size:16px}.tj label{display:block;font-size:12px;opacity:.75;margin:8px 0 4px}' +
    '.tj .row{display:flex;gap:6px}.tj input{flex:1;min-width:0;padding:10px;border-radius:10px;border:1px solid #3a4a6b;background:#0f1a30;color:#fff;font-size:15px}' +
    '.tj button{padding:10px 12px;border-radius:10px;border:1px solid #2ea8ff;background:transparent;color:#7cc4ff;font-size:14px}' +
    '.tj button.on,.tj button.main{background:linear-gradient(90deg,#22d3a8,#38bdf8);color:#04121f;border:0;font-weight:700}' +
    '.tj ul{list-style:none;margin:4px 0;padding:0}.tj li{padding:9px;border-bottom:1px solid #22304d;font-size:13px}' +
    '#tab-route{display:none}body.tj-on #tab-route{display:block!important}body.tj-on .sb-panel:not(#tab-route){display:none!important}' +
    '#tj-banner{position:fixed;top:8px;left:8px;right:8px;z-index:3500;background:#0b57d0;color:#fff;border-radius:12px;padding:12px;font:600 17px sans-serif;display:none;box-shadow:0 3px 10px #0008}#tj-banner small{display:block;font-weight:400;font-size:13px;margin-top:4px}' +
    '#tj-float{position:fixed;left:8px;right:8px;bottom:8px;z-index:3000;background:#0b1220;color:#fff;border-radius:14px;max-height:75vh;overflow:auto;display:none}' +
    '#tj-fab{position:fixed;left:12px;bottom:90px;z-index:3000;background:#1a73e8;color:#fff;border:0;border-radius:24px;padding:12px 16px;font:600 15px sans-serif}';
  var HTML = '<h3>🧭 Itinéraire</h3>' +
    '<label>Départ</label><div class="row"><input id="tj-from" placeholder="Ma position actuelle (GPS)"><button id="tj-me" title="Ma position">📍</button><button id="tj-pf" title="Choisir sur la carte">🖱️</button></div><ul id="tj-sf"></ul>' +
    '<label>Destination souhaitée</label><div class="row"><input id="tj-to" type="search" placeholder="Adresse, ville, lieu…"><button id="tj-go">🔍</button><button id="tj-pt" title="Choisir sur la carte">🖱️</button></div><ul id="tj-st"></ul>' +
    '<div class="row" style="margin-top:8px"><button data-m="car" class="on">🚗 Voiture</button><button data-m="bike">🚲 Vélo</button><button data-m="foot">🚶 À pied</button></div>' +
    '<div id="tj-info" style="margin:8px 0;font-weight:600"></div>' +
    '<div class="row"><button id="tj-drive" class="main" style="display:none">▶ Mode conduite</button><button id="tj-stop" style="display:none">⏹ Arrêter</button></div>' +
    '<div id="tj-steps" style="font-size:13px;margin-top:8px"></div>';

  function $(id) { return document.getElementById(id); }
  function info(t) { $('tj-info').textContent = t; }
  function fmtD(m) { if (window.__miles) { var mi = m / 1609.34; return mi < 0.2 ? (Math.round(m * 3.281 / 10) * 10) + ' ft' : mi.toFixed(1) + ' mi'; } return m < 1000 ? (Math.round(m / 10) * 10) + ' m' : (m / 1000).toFixed(1) + ' km'; }
  function fmtT(s) { var m = Math.round(s / 60); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; }
  function dist(a, b) { return L.latLng(a[0], a[1]).distanceTo(L.latLng(b[0], b[1])); }
  function say(t) { if (window.__noVoice) return; try { var u = new SpeechSynthesisUtterance(t); u.lang = 'fr-FR'; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {} }
  function txt(s) {
    var m = s.maneuver || {}, n = s.name ? ' sur ' + s.name : '';
    var mod = { left: 'à gauche', right: 'à droite', 'slight left': 'légèrement à gauche', 'slight right': 'légèrement à droite', 'sharp left': 'franchement à gauche', 'sharp right': 'franchement à droite' }[m.modifier];
    if (m.type === 'depart') return 'Départ' + n;
    if (m.type === 'arrive') return 'Vous êtes arrivé';
    if (m.type === 'roundabout' || m.type === 'rotary') return 'Au rond-point, prenez la sortie' + n;
    if (m.modifier === 'uturn') return 'Faites demi-tour';
    if (!mod || m.modifier === 'straight') return 'Continuez tout droit' + n;
    return 'Tournez ' + mod + n;
  }
  function locate(cb) {
    if (!navigator.geolocation) { info('GPS non disponible sur cet appareil.'); return; }
    info('Recherche de ta position…');
    navigator.geolocation.getCurrentPosition(function (p) { cb([p.coords.latitude, p.coords.longitude]); },
      function () { info('Position refusée : autorise la localisation pour ce site.'); }, { enableHighAccuracy: true, timeout: 20000 });
  }
  function search(q, ul, pick) {
    ul.innerHTML = '<li>Recherche…</li>';
    fetch('https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=fr&q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); }).then(function (res) {
        ul.innerHTML = '';
        if (!res.length) { ul.innerHTML = '<li>Aucun résultat</li>'; return; }
        res.forEach(function (r) {
          var li = document.createElement('li'); li.textContent = r.display_name;
          li.onclick = function () { ul.innerHTML = ''; pick([+r.lat, +r.lon], r.display_name); };
          ul.appendChild(li);
        });
      }).catch(function () { ul.innerHTML = '<li>Recherche impossible (réseau)</li>'; });
  }
  function compute() {
    if (!S.to) { info('Choisis une destination.'); return; }
    if (!S.from) { locate(function (p) { S.from = p; $('tj-from').value = 'Ma position (GPS)'; compute(); }); return; }
    window.dispatchEvent(new Event('resize'));
    var url = 'https://routing.openstreetmap.de/routed-' + S.mode + '/route/v1/driving/' + S.from[1] + ',' + S.from[0] + ';' + S.to[1] + ',' + S.to[0] + '?overview=full&geometries=geojson&steps=true';
    info('Calcul de l’itinéraire…');
    fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.routes || !j.routes.length) { info('Aucun itinéraire trouvé.'); return; }
      var rt = j.routes[0], m = getMap();
      S.coords = rt.geometry.coordinates.map(function (c) { return [c[1], c[0]]; });
      S.steps = rt.legs[0].steps; S.idx = 1; S.spoken = {};
      if (m) {
        if (S.layer) m.removeLayer(S.layer);
        S.layer = L.polyline(S.coords, { color: '#22d3a8', weight: 6 }).addTo(m);
        if (!S.driving) m.fitBounds(S.layer.getBounds(), { padding: [40, 40] });
      }
      info('✓ ' + fmtD(rt.distance) + ' · ' + fmtT(rt.duration) + (m ? '' : ' (carte non détectée : trajet non tracé)'));
      $('tj-steps').innerHTML = S.steps.map(function (s) { return '<div style="padding:5px 0;border-bottom:1px solid #22304d">' + txt(s) + ' <small>(' + fmtD(s.distance) + ')</small></div>'; }).join('');
      $('tj-drive').style.display = 'inline-block';
    }).catch(function () { info('Erreur réseau : itinéraire impossible.'); });
  }
  function nearest(p) { var b = 1e9; for (var i = 0; i < S.coords.length; i += 2) { var d = dist(p, S.coords[i]); if (d < b) b = d; } return b; }
  function onPos(p) {
    var pos = [p.coords.latitude, p.coords.longitude], m = getMap(), ban = $('tj-banner');
    if (m) {
      if (window.__rgArrow) window.__rgArrow(pos, p.coords.heading, p.coords.speed); else if (!S.me) S.me = L.circleMarker(pos, { radius: 9, color: '#fff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1 }).addTo(m); else S.me.setLatLng(pos);
      m.setView(pos, Math.max(m.getZoom(), 17));
    }
    var sp = p.coords.speed ? Math.round(p.coords.speed * 3.6) + ' km/h' : '';
    while (S.idx < S.steps.length - 1 && dist(pos, [S.steps[S.idx].maneuver.location[1], S.steps[S.idx].maneuver.location[0]]) < 25) S.idx++;
    var s = S.steps[S.idx];
    if (s) {
      var d = dist(pos, [s.maneuver.location[1], s.maneuver.location[0]]);
      ban.innerHTML = txt(s) + '<small>dans ' + fmtD(d) + (sp ? ' · ' + sp : '') + '</small>';
      if (d < 150 && !S.spoken[S.idx]) { S.spoken[S.idx] = 1; say('Dans ' + fmtD(d) + ', ' + txt(s)); }
      if (s.maneuver.type === 'arrive' && d < 30) { say('Vous êtes arrivé'); stopDrive(); return; }
    }
    if (S.coords.length && nearest(pos) > 60 && Date.now() - S.lastReroute > 15000) { S.lastReroute = Date.now(); say('Recalcul de l’itinéraire'); S.from = pos; compute(); }
  }
  function startDrive() {
    if (!S.steps.length) return;
    S.driving = true; closeFloat();
    $('tj-banner').style.display = 'block'; $('tj-banner').textContent = 'Recherche du signal GPS…'; $('tj-stop').style.display = 'inline-block';
    try { document.documentElement.requestFullscreen(); } catch (e) {}
    try { navigator.wakeLock && navigator.wakeLock.request('screen'); } catch (e) {}
    S.watch = navigator.geolocation.watchPosition(onPos, function () { $('tj-banner').textContent = 'GPS indisponible'; }, { enableHighAccuracy: true, maximumAge: 1000 });
    say('Navigation démarrée');
  }
  function stopDrive() {
    S.driving = false; if (S.watch != null) navigator.geolocation.clearWatch(S.watch); S.watch = null;
    $('tj-banner').style.display = 'none'; $('tj-stop').style.display = 'none';
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
  }
  function openFloat() { if (fl) fl.style.display = 'block'; }
  function closeFloat() { if (fl) fl.style.display = 'none'; }

  function pick(w) {
    var m = getMap(); if (!m) { info('Carte non détectée : touche la carte puis réessaie.'); return; }
    closeFloat(); info('Touche la carte pour choisir ' + (w === 'from' ? 'le départ' : 'la destination') + '…');
    m.once('click', function (e) {
      var p = [e.latlng.lat, e.latlng.lng];
      if (w === 'from') { S.from = p; $('tj-from').value = 'Point choisi sur la carte'; } else { S.to = p; $('tj-to').value = 'Point choisi sur la carte'; }
      openFloat(); compute();
    });
  }
  function autoFrom() { if (!S.from) locate(function (p) { S.from = p; $('tj-from').value = 'Ma position (GPS)'; info('Départ : ta position actuelle. Choisis ta destination.'); }); }
  function bind() {
    $('tj-me').onclick = function () { locate(function (p) { S.from = p; $('tj-from').value = 'Ma position (GPS)'; info('Départ : ta position.'); if (S.to) compute(); }); };
    $('tj-go').onclick = function () { var q = $('tj-to').value.trim(); if (q) search(q, $('tj-st'), function (p, n) { S.to = p; $('tj-to').value = n; compute(); }); };
    $('tj-to').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('tj-go').click(); } });
    $('tj-from').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); var q = $('tj-from').value.trim(); if (q) search(q, $('tj-sf'), function (p, n) { S.from = p; $('tj-from').value = n; if (S.to) compute(); }); }
    });
    $('tj-pf').onclick = function () { pick('from'); };
    $('tj-pt').onclick = function () { pick('to'); };
    Array.prototype.forEach.call(document.querySelectorAll('.tj [data-m]'), function (b) {
      b.onclick = function () {
        S.mode = b.getAttribute('data-m');
        Array.prototype.forEach.call(document.querySelectorAll('.tj [data-m]'), function (x) { x.classList.toggle('on', x === b); });
        if (S.to) compute();
      };
    });
    $('tj-drive').onclick = startDrive;
    $('tj-stop').onclick = stopDrive;
  }
  function setOn(on) {
    document.body.classList.toggle('tj-on', on);
    Array.prototype.forEach.call(document.querySelectorAll('.sb-tab'), function (x) {
      if (x === myTab) { x.classList.toggle('active', on); x.classList.toggle('is-active', on); x.setAttribute('aria-selected', on ? 'true' : 'false'); }
      else if (on) { x.classList.remove('active', 'is-active'); x.setAttribute('aria-selected', 'false'); }
    });
    if (on) autoFrom();
  }
  function mount() {
    try {
      var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
      var ban = document.createElement('div'); ban.id = 'tj-banner'; document.body.appendChild(ban);
      var box = document.createElement('div'); box.className = 'tj'; box.innerHTML = HTML;
      var tab = document.querySelector('.sb-tab[data-tab="history"]') || document.querySelector('.sb-tab');
      var ref = document.getElementById('tab-history') || document.querySelector('.sb-panel');
      if (tab && ref && tab.parentNode && ref.parentNode) {
        myTab = tab.cloneNode(false); myTab.id = 'tj-tab'; myTab.setAttribute('data-tab', 'route');
        myTab.classList.remove('active', 'is-active'); myTab.setAttribute('aria-selected', 'false'); myTab.textContent = '🧭 Route';
        tab.parentNode.insertBefore(myTab, tab);
        var pan = document.createElement('section'); pan.className = 'sb-panel'; pan.id = 'tab-route'; pan.setAttribute('role', 'tabpanel');
        pan.appendChild(box); ref.parentNode.insertBefore(pan, ref);
        document.addEventListener('click', function (e) {
          var t = e.target.closest ? e.target.closest('.sb-tab') : null;
          if (t) setOn(t === myTab);
        }, true);
      } else {
        var fab = document.createElement('button'); fab.id = 'tj-fab'; fab.textContent = '🧭 Route';
        fl = document.createElement('div'); fl.id = 'tj-float';
        var x = document.createElement('button'); x.textContent = '✕'; x.style.cssText = 'float:right;margin:8px;background:#222;color:#fff;border:0;border-radius:8px;padding:6px 10px';
        x.onclick = closeFloat; fl.appendChild(x); fl.appendChild(box);
        fab.onclick = function () { openFloat(); autoFrom(); };
        document.body.appendChild(fab); document.body.appendChild(fl);
      }
      bind();
    } catch (e) {
      var b = document.createElement('div');
      b.style.cssText = 'position:fixed;left:8px;right:8px;top:70px;z-index:9999;background:#b3261e;color:#fff;padding:10px;border-radius:10px;font:12px monospace';
      b.textContent = 'Erreur trajet.js : ' + e.message; document.body.appendChild(b);
    }
  }
  var tries = 0;
  function wait() { if (document.querySelector('.sb-tab') || tries++ > 10) mount(); else setTimeout(wait, 300); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wait); else wait();
  window.__tj = { S: S, compute: compute, startDrive: startDrive, stopDrive: stopDrive, search: search };
})();
