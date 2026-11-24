/* Riamo GPS World : application de démonstration (100 % dans le navigateur) */
(function () {
  "use strict";
  var C = window.RIAMO_CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  var COLORS = { moving: "#13795b", idle: "#a15c00", offline: "#b3261e" };
  var LABELS = { moving: "En mouvement", idle: "À l’arrêt", offline: "Hors ligne" };

  function el(tag, text, cls) {
    var e = document.createElement(tag);
    if (text != null) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  }
  function timeStr(t) { return new Date(t).toLocaleTimeString("fr-FR"); }
  function dist(a, b, c, d) {
    var R = 6371000, p = Math.PI / 180;
    var x = (c - a) * p, y = (d - b) * p * Math.cos(((a + c) / 2) * p);
    return Math.sqrt(x * x + y * y) * R;
  }

  /* ---------- Données et sauvegarde locale ---------- */
  function fresh() {
    return {
      devices: C.devices.map(function (d) {
        return { id: d.id, name: d.name, battery: d.battery, lat: d.lat, lng: d.lng,
          status: d.status, speed: 0, heading: Math.random() * 6.28, inside: {},
          history: [[d.lat, d.lng, Date.now()]] };
      }),
      zones: [], alerts: []
    };
  }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(C.storageKey));
      if (s && s.devices && s.zones && s.alerts) return s;
    } catch (e) {}
    return fresh();
  }
  function save() { try { localStorage.setItem(C.storageKey, JSON.stringify(state)); } catch (e) {} }
  function get(id) { return state.devices.filter(function (d) { return d.id === id; })[0]; }

  var state = load();

  /* ---------- Carte ---------- */
  var map = L.map("map").setView(C.center, C.zoom);
  L.tileLayer(C.tiles.url, { maxZoom: 19, attribution: C.tiles.attribution }).addTo(map);
  var markers = {}, circles = {}, selected = null, trackLine = null, replayMarker = null;

  function toast(msg, cls) {
    var t = el("div", msg, "toast " + (cls || ""));
    $("toasts").appendChild(t);
    setTimeout(function () { t.remove(); }, 4000);
  }

  /* ---------- Appareils ---------- */
  function matches(d) {
    var q = $("search").value.trim().toLowerCase(), s = $("statusFilter").value;
    return (!q || d.name.toLowerCase().indexOf(q) > -1) && (s === "all" || d.status === s);
  }
  function popupEl(d) {
    var w = el("div");
    w.appendChild(el("strong", d.name));
    w.appendChild(el("div", LABELS[d.status] + ", " + d.speed + " km/h"));
    w.appendChild(el("div", "Batterie : " + Math.round(d.battery) + " %"));
    return w;
  }
  function drawMarkers() {
    state.devices.forEach(function (d) {
      var m = markers[d.id];
      if (!m) {
        m = markers[d.id] = L.circleMarker([d.lat, d.lng], { radius: 10, weight: 3, color: "#fff", fillOpacity: 1 });
        m.bindTooltip(d.name);
        m.bindPopup(function () { return popupEl(d); });
        m.on("click", function () { select(d.id, false); });
      }
      m.setLatLng([d.lat, d.lng]);
      m.setStyle({ fillColor: COLORS[d.status] });
      if (matches(d)) { if (!map.hasLayer(m)) m.addTo(map); } else { m.remove(); }
    });
  }
  function renderList() {
    var ul = $("deviceList"), n = 0;
    ul.textContent = "";
    state.devices.filter(matches).forEach(function (d) {
      n++;
      var li = el("li"), b = el("button", null, "dev" + (d.id === selected ? " sel" : ""));
      b.type = "button";
      var info = el("span", d.name);
      info.appendChild(el("small", LABELS[d.status] + (d.status === "moving" ? ", " + d.speed + " km/h" : "")));
      b.appendChild(el("span", null, "dot " + d.status));
      b.appendChild(info);
      b.appendChild(el("span", Math.round(d.battery) + " %"));
      b.onclick = function () { select(d.id, true); };
      li.appendChild(b);
      ul.appendChild(li);
    });
    $("deviceCount").textContent = n;
    if (!n) ul.appendChild(el("li", "Aucun appareil ne correspond.", "count"));
  }
  function select(id, fly) {
    selected = id;
    var d = get(id);
    if (fly) map.flyTo([d.lat, d.lng], 15);
    if (markers[id]) markers[id].openPopup();
    $("historyDevice").value = id;
    renderList();
    if (!$("tab-history").hidden) loadTrack();
  }
  function refresh() { renderList(); drawMarkers(); }
  $("search").oninput = refresh;
  $("statusFilter").onchange = refresh;

  /* ---------- Zones et alertes ---------- */
  function renderZones() {
    var ul = $("zoneList");
    ul.textContent = "";
    Object.keys(circles).forEach(function (k) { circles[k].remove(); delete circles[k]; });
    state.zones.forEach(function (z) {
      circles[z.id] = L.circle([z.lat, z.lng], { radius: z.r, color: "#2f4bff", weight: 2, fillOpacity: 0.12 })
        .addTo(map).bindTooltip(z.name);
      var li = el("li"), b = el("button", "Supprimer");
      b.type = "button";
      b.onclick = function () {
        state.zones = state.zones.filter(function (x) { return x.id !== z.id; });
        state.devices.forEach(function (d) { delete d.inside[z.id]; });
        save(); renderZones();
      };
      li.appendChild(el("span", z.name + " (rayon " + z.r + " m)"));
      li.appendChild(b);
      ul.appendChild(li);
    });
    if (!state.zones.length) ul.appendChild(el("li", "Aucune zone. Centrez la carte puis ajoutez-en une."));
  }
  function renderAlerts() {
    var ul = $("alertList");
    ul.textContent = "";
    state.alerts.forEach(function (a) {
      var li = el("li");
      li.appendChild(el("span", a.msg));
      li.appendChild(el("small", timeStr(a.t), "count"));
      ul.appendChild(li);
    });
    if (!state.alerts.length) ul.appendChild(el("li", "Aucune alerte. Ajoutez une zone et lancez la simulation."));
  }
  function addAlert(msg, cls) {
    state.alerts.unshift({ t: Date.now(), msg: msg });
    state.alerts.length = Math.min(state.alerts.length, 50);
    toast(msg, cls);
    renderAlerts();
  }
  function checkZones(d) {
    state.zones.forEach(function (z) {
      var inZone = dist(d.lat, d.lng, z.lat, z.lng) <= z.r;
      if (d.inside[z.id] !== undefined && d.inside[z.id] !== inZone) {
        addAlert(d.name + (inZone ? " est entré dans " : " est sorti de ") + z.name, inZone ? "" : "warn");
      }
      d.inside[z.id] = inZone;
    });
  }
  $("zoneRadius").oninput = function () { $("zoneRadiusOut").textContent = this.value + " m"; };
  $("btnZone").onclick = function () {
    var c = map.getCenter();
    var z = { id: "z" + Date.now(), name: "Zone " + (state.zones.length + 1), lat: c.lat, lng: c.lng, r: +$("zoneRadius").value };
    state.zones.push(z);
    state.devices.forEach(function (d) { d.inside[z.id] = dist(d.lat, d.lng, z.lat, z.lng) <= z.r; });
    save(); renderZones();
    toast(z.name + " ajoutée");
  };
  $("btnClearAlerts").onclick = function () { state.alerts = []; save(); renderAlerts(); };

  /* ---------- Simulation ---------- */
  var simTimer = null;
  function tick() {
    state.devices.forEach(function (d) {
      if (d.status === "offline") return;
      if (d.status === "moving" && Math.random() < 0.05) d.status = "idle";
      else if (d.status === "idle" && Math.random() < 0.2) d.status = "moving";
      if (d.status === "moving") {
        d.heading += (Math.random() - 0.5) * 0.8;
        d.lat += Math.cos(d.heading) * C.simStep;
        d.lng += Math.sin(d.heading) * C.simStep / Math.cos(d.lat * Math.PI / 180);
        d.speed = 20 + Math.round(Math.random() * 40);
        d.battery = Math.max(1, d.battery - 0.05);
        d.history.push([d.lat, d.lng, Date.now()]);
        if (d.history.length > C.maxHistory) d.history.shift();
        checkZones(d);
      } else { d.speed = 0; }
    });
    save(); refresh();
    if (!rpTimer && !$("tab-history").hidden) loadTrack();
  }
  $("btnSim").onclick = function () {
    var on = !simTimer;
    if (on) { simTimer = setInterval(tick, C.simIntervalMs); }
    else { clearInterval(simTimer); simTimer = null; }
    this.setAttribute("aria-pressed", on);
    this.textContent = on ? "Arrêter la simulation" : "Lancer la simulation";
  };

  /* ---------- Historique et rejeu ---------- */
  var rpTimer = null;
  function histDev() { return get($("historyDevice").value) || state.devices[0]; }
  function stopReplay() { clearInterval(rpTimer); rpTimer = null; $("replayPlay").textContent = "Lecture"; }
  function showStep() {
    var d = histDev(), i = +$("replayRange").value, p = d.history[i];
    if (!p || !replayMarker) return;
    replayMarker.setLatLng([p[0], p[1]]);
    $("replayTime").textContent = "Point " + (i + 1) + " sur " + d.history.length + ", " + timeStr(p[2]);
  }
  function loadTrack() {
    stopReplay();
    var d = histDev(), r = $("replayRange");
    if (trackLine) { trackLine.remove(); trackLine = null; }
    if (replayMarker) { replayMarker.remove(); replayMarker = null; }
    r.max = Math.max(0, d.history.length - 1);
    r.value = r.max;
    if (d.history.length < 2) { $("replayTime").textContent = "Aucun trajet : lancez la simulation."; return; }
    trackLine = L.polyline(d.history.map(function (p) { return [p[0], p[1]]; }), { color: "#2f4bff", weight: 4 }).addTo(map);
    replayMarker = L.circleMarker([d.lat, d.lng], { radius: 7, color: "#fff", weight: 2, fillColor: "#2f4bff", fillOpacity: 1 }).addTo(map);
    showStep();
  }
  $("historyDevice").onchange = loadTrack;
  $("replayRange").oninput = function () { stopReplay(); showStep(); };
  $("replayPlay").onclick = function () {
    if (rpTimer) { stopReplay(); return; }
    var r = $("replayRange");
    if (!trackLine) { toast("Aucun trajet à rejouer", "warn"); return; }
    if (+r.value >= +r.max) r.value = 0;
    this.textContent = "Pause";
    rpTimer = setInterval(function () {
      if (+r.value >= +r.max) { stopReplay(); return; }
      r.value = +r.value + 1;
      showStep();
    }, 600 / +$("replaySpeed").value);
  };

  /* ---------- Onglets, position, réinitialisation ---------- */
  document.querySelectorAll(".tab").forEach(function (t) {
    t.onclick = function () {
      document.querySelectorAll(".tab").forEach(function (x) {
        var on = x === t;
        x.classList.toggle("on", on);
        x.setAttribute("aria-selected", on);
        $("tab-" + x.dataset.tab).hidden = !on;
      });
      if (t.dataset.tab === "history") loadTrack();
    };
  });
  $("btnLocate").onclick = function () {
    if (!navigator.geolocation) { toast("Position indisponible sur ce navigateur", "bad"); return; }
    navigator.geolocation.getCurrentPosition(function (p) {
      map.flyTo([p.coords.latitude, p.coords.longitude], 15);
      toast("Carte centrée sur votre position");
    }, function () { toast("Autorisation refusée : position non utilisée", "warn"); }, { timeout: 10000 });
  };
  $("btnReset").onclick = function () {
    if (!confirm("Effacer les zones, alertes et historiques enregistrés ?")) return;
    try { localStorage.removeItem(C.storageKey); } catch (e) {}
    location.reload();
  };

  /* ---------- Contact, mentions légales, pied de page ---------- */
  $("contactForm").onsubmit = function (e) {
    e.preventDefault();
    if (!C.contactEmail) { toast("Adresse e-mail à renseigner dans config.js", "warn"); return; }
    var f = new FormData(this);
    location.href = "mailto:" + C.contactEmail +
      "?subject=" + encodeURIComponent("Message de " + f.get("name")) +
      "&body=" + encodeURIComponent(f.get("message") + "\n\n" + f.get("email"));
  };
  $("openLegal").onclick = function () { $("legal").showModal(); };
  $("closeLegal").onclick = function () { $("legal").close(); };
  $("year").textContent = new Date().getFullYear();

  /* ---------- Démarrage ---------- */
  state.devices.forEach(function (d) {
    var o = el("option", d.name);
    o.value = d.id;
    $("historyDevice").appendChild(o);
  });
  drawMarkers(); renderList(); renderZones(); renderAlerts();
})();
