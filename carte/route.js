(function () {
  'use strict';
  var OSRM = 'https://routing.openstreetmap.de/routed-';
  var S = { to: null, toName: '', mode: 'car', coords: [], steps: [], total: 0, dur: 0, idx: 1, spoken: {}, driving: false, watch: null, last: null, lastRe: 0, head: 0, marker: null, dest: null, lock: null, passive: false };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtD(m) { return m < 1000 ? (Math.round(m / 10) * 10) + ' m' : (m / 1000).toFixed(1) + ' km'; }
  function fmtT(s) { var m = Math.round(s / 60); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; }
  function dist(a, b) { return new maplibregl.LngLat(a[0], a[1]).distanceTo(new maplibregl.LngLat(b[0], b[1])); }
  function bearing(a, b) {
    var r = Math.PI / 180, dl = (b[0] - a[0]) * r, y = Math.sin(dl) * Math.cos(b[1] * r);
    var x = Math.cos(a[1] * r) * Math.sin(b[1] * r) - Math.sin(a[1] * r) * Math.cos(b[1] * r) * Math.cos(dl);
    return (Math.atan2(y, x) / r + 360) % 360;
  }
  function smooth(a, b) { var d = ((b - a + 540) % 360) - 180; return (a + d * 0.4 + 360) % 360; }
  function say(t) { try { if (!S.mute) { var u = new SpeechSynthesisUtterance(t); u.lang = 'fr-FR'; speechSynthesis.cancel(); speechSynthesis.speak(u); } } catch (e) {} }
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
  function ready(cb) {
    var n = 0, t = setInterval(function () {
      var m = window.RIAMO && window.RIAMO.map;
      if (m && m.getLayer && m.getLayer('b3d') && $('nav') && $('sheet')) { clearInterval(t); cb(m); } else if (++n > 300) clearInterval(t);
    }, 300);
  }

  ready(function (map) {
    var st = document.createElement('style');
    st.textContent = 'body.drive #nav,body.drive #sheet,body.drive #top,body.drive #fab{display:none!important}' +
      '#r-ban{position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);left:8px;right:8px;z-index:9;background:#0b57d0;color:#fff;border-radius:14px;padding:14px;font:700 19px sans-serif;display:none;box-shadow:0 3px 12px #0008}' +
      '#r-ban small{display:block;font-weight:400;font-size:14px;margin-top:4px}' +
      '#r-bar{position:fixed;left:8px;right:8px;bottom:calc(env(safe-area-inset-bottom,0px) + 10px);z-index:9;background:#121c33;color:#fff;border-radius:16px;padding:12px 14px;display:none;align-items:center;justify-content:space-between;gap:10px;box-shadow:0 3px 12px #0008}' +
      '#r-bar button{padding:10px 14px;border-radius:12px;border:0;background:#e6ebf1;color:#111;font:700 14px sans-serif}' +
      '#r-sug div{padding:10px 4px;border-bottom:1px solid #25324f;font-size:14px}';
    document.head.appendChild(st);

    var btn = document.createElement('button'); btn.setAttribute('data-p', 'route'); btn.textContent = '🧭 Trajet';
    btn.onclick = function () { showPanel('route'); }; $('nav').appendChild(btn);
    var pn = document.createElement('div'); pn.className = 'pn'; pn.id = 'p-route';
    pn.innerHTML = '<h4>Itinéraire</h4><div class="row"><span>Départ</span><b class="muted" id="r-from">Ma position (GPS)</b></div>' +
      '<input type="text" id="r-q" placeholder="Destination : adresse, ville, lieu…" style="width:100%;box-sizing:border-box">' +
      '<div class="row"><button class="btn main" id="r-go">Rechercher</button><button class="btn" id="r-pick">🖱️ Sur la carte</button></div><div id="r-sug"></div>' +
      '<div class="seg" id="r-mode"><button data-m="car" class="on">🚗 Voiture</button><button data-m="bike">🚲 Vélo</button><button data-m="foot">🚶 À pied</button></div>' +
      '<div id="r-info" style="margin:10px 0;font-weight:700"></div>' +
      '<div class="row"><button class="btn main" id="r-drive" style="display:none">▶ Démarrer la conduite</button></div><div id="r-steps"></div>';
    $('sheet').appendChild(pn);
    var ban = document.createElement('div'); ban.id = 'r-ban'; document.body.appendChild(ban);
    var bar = document.createElement('div'); bar.id = 'r-bar';
    bar.innerHTML = '<div id="r-rem" style="font-weight:700"></div><div><button id="r-mute">🔊</button> <button id="r-stop">⏹ Arrêter</button></div>';
    document.body.appendChild(bar);
    var loc = document.createElement('button'); loc.id = 'r-loc'; loc.textContent = '📍'; loc.title = 'Ma position'; $('fab').appendChild(loc);

    map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    var sym = map.getStyle().layers.filter(function (l) { return l.type === 'symbol'; })[0], before = sym ? sym.id : undefined;
    map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 10 } }, before);
    map.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#1a73e8', 'line-width': 6 } }, before);

    function arrowEl() {
      var d = document.createElement('div');
      d.innerHTML = '<svg viewBox="0 0 48 48" width="54" height="54"><path d="M24 4 L40 42 L24 34 L8 42 Z" fill="#2196f3" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>';
      d.style.filter = 'drop-shadow(0 2px 4px #0008)'; return d;
    }
    function nearest(p) { var b = 1e9; for (var i = 0; i < S.coords.length; i += 2) { var d = dist(p, S.coords[i]); if (d < b) b = d; } return b; }
    function geoErr() { $('r-info').textContent = 'Position refusée : autorise la localisation pour ce site.'; }

    function compute(from) {
      if (!S.to) { $('r-info').textContent = 'Choisis une destination.'; return; }
      var go = function (f) {
        S.from = f; $('r-info').textContent = 'Calcul de l’itinéraire…';
        fetch(OSRM + S.mode + '/route/v1/driving/' + f[0] + ',' + f[1] + ';' + S.to[0] + ',' + S.to[1] + '?overview=full&geometries=geojson&steps=true')
          .then(function (r) { return r.json(); }).then(function (j) {
            if (!j.routes || !j.routes.length) { $('r-info').textContent = 'Aucun itinéraire trouvé.'; return; }
            var rt = j.routes[0];
            S.coords = rt.geometry.coordinates; S.steps = rt.legs[0].steps; S.total = rt.distance; S.dur = rt.duration; S.idx = 1; S.spoken = {};
            map.getSource('route').setData({ type: 'Feature', geometry: rt.geometry, properties: {} });
            if (S.dest) S.dest.remove(); S.dest = new maplibregl.Marker({ color: '#e53935' }).setLngLat(S.to).addTo(map);
            if (!S.driving) {
              var b = new maplibregl.LngLatBounds(S.coords[0], S.coords[0]); S.coords.forEach(function (c) { b.extend(c); });
              map.fitBounds(b, { padding: { top: 90, bottom: 260, left: 40, right: 40 }, pitch: Math.max(map.getPitch(), 45) });
            }
            $('r-info').textContent = '✓ ' + fmtD(rt.distance) + ' · ' + fmtT(rt.duration);
            $('r-steps').innerHTML = S.steps.map(function (s) { return '<div class="item">' + esc(txt(s)) + '<small>' + fmtD(s.distance) + '</small></div>'; }).join('');
            $('r-drive').style.display = 'inline-block';
          }).catch(function () { $('r-info').textContent = 'Erreur réseau : itinéraire impossible.'; });
      };
      if (from) go(from);
      else if (S.last) go(S.last);
      else if (navigator.geolocation) { $('r-info').textContent = 'Recherche de ta position…'; navigator.geolocation.getCurrentPosition(function (p) { go([p.coords.longitude, p.coords.latitude]); }, geoErr, { enableHighAccuracy: true, timeout: 20000 }); }
      else geoErr();
    }
    function search() {
      var q = $('r-q').value.trim(); if (!q) return; var box = $('r-sug'); box.textContent = 'Recherche…';
      fetch('https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=fr&q=' + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (res) {
        box.innerHTML = res.length ? '' : 'Aucun résultat';
        res.forEach(function (r) {
          var d = document.createElement('div'); d.textContent = r.display_name;
          d.onclick = function () { box.innerHTML = ''; S.to = [+r.lon, +r.lat]; S.toName = r.display_name; $('r-q').value = r.display_name; compute(); };
          box.appendChild(d);
        });
      }).catch(function () { box.textContent = 'Recherche impossible (réseau).'; });
    }

    function onPos(p) {
      var pos = [p.coords.longitude, p.coords.latitude], sp = p.coords.speed, h = p.coords.heading;
      if (h == null || isNaN(h) || (sp != null && sp < 1)) { h = (S.last && dist(S.last, pos) > 4) ? bearing(S.last, pos) : S.head; }
      S.head = smooth(S.head, h); S.last = pos;
      if (!S.marker) S.marker = new maplibregl.Marker({ element: arrowEl(), rotationAlignment: 'map', pitchAlignment: 'map' });
      S.marker.setLngLat(pos).setRotation(S.head).addTo(map);
      if (S.passive && !S.driving && !S.centered) { S.centered = true; map.flyTo({ center: pos, zoom: Math.max(map.getZoom(), 16) }); }
      if (!S.driving) return;
      map.easeTo({ center: pos, bearing: S.head, pitch: 60, zoom: Math.max(map.getZoom(), 17), offset: [0, Math.round(window.innerHeight * 0.18)], duration: 900, essential: true });
      while (S.idx < S.steps.length - 1 && dist(pos, S.steps[S.idx].maneuver.location) < 25) S.idx++;
      var s = S.steps[S.idx], d = s ? dist(pos, s.maneuver.location) : 0, kmh = sp ? Math.round(sp * 3.6) + ' km/h' : '';
      if (s) {
        $('r-ban').innerHTML = esc(txt(s)) + '<small>dans ' + fmtD(d) + (kmh ? ' · ' + kmh : '') + '</small>';
        if (d < 150 && !S.spoken[S.idx]) { S.spoken[S.idx] = 1; say('Dans ' + fmtD(d) + ', ' + txt(s)); }
        if (s.maneuver.type === 'arrive' && d < 30) { say('Vous êtes arrivé'); stopDrive(); return; }
        var rem = d; for (var i = S.idx + 1; i < S.steps.length; i++) rem += S.steps[i].distance;
        $('r-rem').textContent = fmtD(rem) + ' · ' + fmtT(S.dur * (rem / (S.total || 1)));
      }
      if (S.coords.length && nearest(pos) > 60 && Date.now() - S.lastRe > 15000) { S.lastRe = Date.now(); say('Recalcul de l’itinéraire'); compute(pos); }
    }
    function watch() {
      if (S.watch != null || !navigator.geolocation) return;
      S.watch = navigator.geolocation.watchPosition(onPos, geoErr, { enableHighAccuracy: true, maximumAge: 1000, timeout: 30000 });
    }
    function startDrive() {
      if (!S.steps.length) return;
      S.driving = true; document.body.classList.add('drive'); $('r-ban').style.display = 'block'; $('r-bar').style.display = 'flex';
      $('r-ban').textContent = 'Recherche du signal GPS…';
      try { document.documentElement.requestFullscreen(); } catch (e) {}
      try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { S.lock = l; }).catch(function () {}); } catch (e) {}
      watch(); say('Navigation démarrée');
    }
    function stopDrive() {
      S.driving = false; document.body.classList.remove('drive'); $('r-ban').style.display = 'none'; $('r-bar').style.display = 'none';
      if (!S.passive && S.watch != null) { navigator.geolocation.clearWatch(S.watch); S.watch = null; }
      try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
      try { if (S.lock) { S.lock.release(); S.lock = null; } } catch (e) {}
      map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
    }
    window.RIAMO.routeTo = function (lon, lat, name) {
      S.to = [lon, lat]; S.toName = name || 'Destination'; $('r-q').value = S.toName;
      var sh = $('sheet'); if (sh.getAttribute('data-p') !== 'route' || sh.style.display !== 'block') showPanel('route');
      compute(); return false;
    };

    $('r-go').onclick = search;
    $('r-q').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); search(); } });
    $('r-pick').onclick = function () {
      $('sheet').style.display = 'none';
      map.once('click', function (e) { S.to = [e.lngLat.lng, e.lngLat.lat]; S.toName = 'Point choisi sur la carte'; $('r-q').value = S.toName; showPanel('route'); compute(); });
    };
    Array.prototype.forEach.call(document.querySelectorAll('#r-mode button'), function (b) {
      b.onclick = function () {
        S.mode = b.getAttribute('data-m');
        Array.prototype.forEach.call(document.querySelectorAll('#r-mode button'), function (x) { x.classList.toggle('on', x === b); });
        if (S.to) compute();
      };
    });
    $('r-drive').onclick = startDrive; $('r-stop').onclick = stopDrive;
    $('r-mute').onclick = function () { S.mute = !S.mute; this.textContent = S.mute ? '🔇' : '🔊'; };
    loc.onclick = function () {
      S.passive = !S.passive; loc.classList.toggle('on', S.passive); S.centered = false;
      if (S.passive) watch();
      else if (!S.driving) { if (S.watch != null) navigator.geolocation.clearWatch(S.watch); S.watch = null; if (S.marker) S.marker.remove(); }
    };
  });
})();
