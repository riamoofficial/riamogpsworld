/* ==========================================================
   Riamo GPS World — application web de suivi GPS
   Leaflet + OpenStreetMap, sans dépendance de build.
   Sections : config · utilitaires · état · carte · rendu ·
   géorepérage · simulation · sources de données · événements
   ========================================================== */
(() => {
  'use strict';

  /* ---------- 1. Configuration ---------- */
  const DEFAULTS = {
    storagePrefix: 'riamo-gps-world:',
    historyMax: 800,
    historyIntervalMs: 3000,
    externalTimeoutMs: 90000,
    lowBattery: 15,
    maxAlerts: 100,
    dataSource: { type: 'none', url: '', intervalMs: 5000 },
    map: { defaultCenter: [25, 10], defaultZoom: 2 },
  };
  const USER_CFG = window.RIAMO_CONFIG || {};
  const CFG = {
    ...DEFAULTS,
    ...USER_CFG,
    dataSource: { ...DEFAULTS.dataSource, ...(USER_CFG.dataSource || {}) },
    map: { ...DEFAULTS.map, ...(USER_CFG.map || {}) },
  };

  const TYPES = {
    voiture: { label: 'Voiture', emoji: '🚗', max: 110 },
    camion: { label: 'Camion', emoji: '🚚', max: 90 },
    velo: { label: 'Vélo', emoji: '🚴', max: 28 },
    personne: { label: 'Personne', emoji: '🚶', max: 6 },
    animal: { label: 'Animal', emoji: '🐕', max: 14 },
    conteneur: { label: 'Conteneur', emoji: '📦', max: 45 },
  };
  const COLORS = ['#22d3a6', '#3b82f6', '#f59e0b', '#ec4899', '#a78bfa', '#f97316', '#14b8a6', '#ef4444'];
  const MODE_LABEL = { both: 'Entrée et sortie', enter: 'Entrée', exit: 'Sortie' };
  const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

  const DEMO_DEVICES = [
    { name: 'Voiture Marie', type: 'voiture', lat: 48.8606, lng: 2.3376, speed: 38 },
    { name: 'Vélo Léo', type: 'velo', lat: 48.853, lng: 2.3499, speed: 16 },
    { name: 'Camion Lyon 07', type: 'camion', lat: 45.764, lng: 4.8357, speed: 52 },
    { name: 'Conteneur Marseille', type: 'conteneur', lat: 43.2965, lng: 5.3698, speed: 0, online: false, battery: 18 },
    { name: 'Taxi New York', type: 'voiture', lat: 40.758, lng: -73.9855, speed: 30 },
    { name: 'Coursier Tokyo', type: 'velo', lat: 35.6762, lng: 139.6503, speed: 18 },
    { name: 'Rex (chien)', type: 'animal', lat: 51.5074, lng: -0.1278, speed: 6 },
  ];
  const DEMO_ZONES = [
    { name: 'Centre de Paris', lat: 48.8566, lng: 2.3522, radius: 4000, mode: 'both' },
    { name: 'Dépôt Lyon', lat: 45.764, lng: 4.8357, radius: 1500, mode: 'both' },
    { name: 'Midtown Manhattan', lat: 40.7549, lng: -73.984, radius: 1500, mode: 'both' },
    { name: 'Quartier Shibuya', lat: 35.6595, lng: 139.7005, radius: 2500, mode: 'enter' },
  ];
  const ZONE_COLORS = ['#22d3a6', '#3b82f6', '#f59e0b', '#ec4899', '#a78bfa', '#f97316'];

  /* ---------- 2. Utilitaires ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const uid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371008.8;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function destination(lat, lng, bearingDeg, distM) {
    const R = 6371008.8;
    const d = distM / R;
    const b = toRad(bearingDeg);
    const p1 = toRad(lat);
    const l1 = toRad(lng);
    const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
    const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
    return { lat: toDeg(p2), lng: ((toDeg(l2) + 540) % 360) - 180 };
  }

  const fmtCoord = (d) => `${d.lat.toFixed(5)}, ${d.lng.toFixed(5)}`;
  const fmtTime = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const fmtDist = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2).replace('.', ',')} km`);
  const compass = (h) => COMPASS[Math.round((((h % 360) + 360) % 360) / 45) % 8];

  function relTime(t) {
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 5) return "à l'instant";
    if (s < 60) return `il y a ${s} s`;
    if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
    return `il y a ${Math.floor(s / 86400)} j`;
  }

  function fmtDuration(ms) {
    const m = Math.round(ms / 60000);
    if (m < 1) return `${Math.round(ms / 1000)} s`;
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
  }

  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(CFG.storagePrefix + key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(CFG.storagePrefix + key, JSON.stringify(value));
      } catch (e) {
        console.warn('Stockage local indisponible ou plein', e);
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(CFG.storagePrefix + key);
      } catch (e) {
        /* ignoré */
      }
    },
  };

  function toast(msg, kind = '') {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.remove(), 5000);
    while (box.children.length > 4) box.firstChild.remove();
  }

  /* ---------- 3. État ---------- */
  const state = {
    view: 'site',
    devices: [],
    zones: [],
    alerts: [],
    selectedId: null,
    follow: false,
    simulating: true,
    simFactor: 10,
    showTrail: true,
    filter: { q: '', status: 'all' },
    placing: null,
    unread: 0,
    tab: 'devices',
  };

  let map = null;
  let appReady = false;
  let zoneLayer = null;
  let trailLayer = null;
  let replayMarker = null;
  let userMarker = null;
  const markers = new Map();
  const zoneLayers = new Map();
  let replayTimer = null;
  let saveTimer = null;
  let listSignature = '';
  let sourceLabel = 'Simulation locale';

  const deviceById = (id) => state.devices.find((d) => d.id === id) || null;
  const zoneById = (id) => state.zones.find((z) => z.id === id) || null;
  const selected = () => deviceById(state.selectedId);

  function makeDevice(p) {
    const type = TYPES[p.type] ? p.type : 'voiture';
    return {
      id: String(p.id || uid()),
      name: String(p.name || 'Traceur').slice(0, 60),
      type,
      lat: p.lat,
      lng: p.lng,
      speed: isNum(p.speed) ? p.speed : 0,
      heading: isNum(p.heading) ? p.heading : rand(0, 360),
      battery: isNum(p.battery) ? clamp(p.battery, 0, 100) : Math.round(rand(55, 100)),
      online: p.online !== false,
      lastUpdate: p.lastUpdate || Date.now(),
      color: p.color || COLORS[state.devices.length % COLORS.length],
      zones: Array.isArray(p.zones) ? p.zones : [],
      history: Array.isArray(p.history) ? p.history : [],
      external: !!p.external,
      lowNotified: !!p.lowNotified,
    };
  }

  function seedHistory(d) {
    if (d.history.length) return;
    const now = Date.now();
    const v = Math.max(d.speed, TYPES[d.type].max * 0.35);
    const stepM = Math.max(15, (v / 3.6) * 30);
    let p = { lat: d.lat, lng: d.lng };
    let h = d.heading;
    const pts = [];
    for (let i = 1; i <= 30; i++) {
      p = destination(p.lat, p.lng, (h + 180) % 360, stepM);
      h += rand(-10, 10);
      pts.unshift({ lat: p.lat, lng: p.lng, t: now - i * 30000, s: Math.round(Math.max(0, v + rand(-5, 5))) });
    }
    pts.push({ lat: d.lat, lng: d.lng, t: now, s: Math.round(d.speed) });
    d.history = pts;
  }

  function loadState() {
    const devs = store.get('devices', null);
    const zs = store.get('zones', null);
    const als = store.get('alerts', null);
    const prefs = store.get('prefs', {});
    state.devices = [];

    if (Array.isArray(devs)) {
      devs.forEach((p) => {
        if (p && isNum(p.lat) && isNum(p.lng)) state.devices.push(makeDevice(p));
      });
    } else {
      DEMO_DEVICES.forEach((p) => {
        const d = makeDevice(p);
        seedHistory(d);
        state.devices.push(d);
      });
    }

    if (Array.isArray(zs)) {
      state.zones = zs.filter((z) => z && isNum(z.lat) && isNum(z.lng) && isNum(z.radius)).map((z, i) => ({
        id: String(z.id || uid()),
        name: String(z.name || 'Zone'),
        lat: z.lat,
        lng: z.lng,
        radius: z.radius,
        mode: MODE_LABEL[z.mode] ? z.mode : 'both',
        color: z.color || ZONE_COLORS[i % ZONE_COLORS.length],
      }));
    } else {
      state.zones = DEMO_ZONES.map((z, i) => ({ ...z, id: uid(), color: ZONE_COLORS[i % ZONE_COLORS.length] }));
    }

    state.alerts = Array.isArray(als) ? als : [];
    if (typeof prefs.simulating === 'boolean') state.simulating = prefs.simulating;
    if (isNum(prefs.simFactor)) state.simFactor = prefs.simFactor;

    state.devices.forEach((d) => checkGeofences(d, true));
  }

  function persist() {
    store.set('devices', state.devices);
    store.set('zones', state.zones);
    store.set('alerts', state.alerts);
    store.set('prefs', { simulating: state.simulating, simFactor: state.simFactor });
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 1500);
  }

  /* ---------- 4. Vues (site / application) ---------- */
  function showView(v, opts = {}) {
    const { scroll = true, updateHash = true } = opts;
    state.view = v;
    $('#view-site').hidden = v !== 'site';
    $('#view-app').hidden = v !== 'app';
    document.body.classList.toggle('is-app', v === 'app');
    document.body.classList.toggle('is-site', v === 'site');
    $$('.switch-btn').forEach((b) => {
      const on = b.dataset.view === v;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    document.title =
      v === 'app' ? 'Application GPS — Riamo GPS World' : 'Riamo GPS World — Suivi GPS mondial en temps réel';
    if (updateHash) {
      try {
        history.replaceState(null, '', '#' + v);
      } catch (e) {
        /* certains navigateurs refusent en file:// */
      }
    }
    if (v === 'app') ensureApp();
    else if (scroll) window.scrollTo({ top: 0 });
  }

  function route() {
    const h = decodeURIComponent(location.hash.replace('#', ''));
    if (h === 'app') showView('app', { updateHash: false });
    else if (!h || h === 'site') showView('site', { updateHash: false, scroll: false });
    else {
      showView('site', { updateHash: false, scroll: false });
      const el = document.getElementById(h);
      if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth' }));
    }
  }

  /* ---------- 5. Carte ---------- */
  function makeIcon(d) {
    const sel = d.id === state.selectedId;
    return L.divIcon({
      className: 'mk-wrap',
      html: `<div class="mk ${d.online ? 'on' : 'off'} ${sel ? 'sel' : ''}" style="--c:${d.color}">${TYPES[d.type].emoji}</div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
      popupAnchor: [0, -18],
    });
  }

  function addMarker(d) {
    if (!map) return;
    const m = L.marker([d.lat, d.lng], { icon: makeIcon(d), title: d.name, keyboard: true });
    m.bindTooltip(esc(d.name), { direction: 'top', offset: [0, -16] });
    m.on('click', () => selectDevice(d.id));
    m.addTo(map);
    markers.set(d.id, m);
  }

  function removeMarker(id) {
    const m = markers.get(id);
    if (m) m.remove();
    markers.delete(id);
  }

  function refreshMarker(d) {
    const m = markers.get(d.id);
    if (m) m.setIcon(makeIcon(d));
  }

  function addZoneLayer(z) {
    if (!map) return;
    const c = L.circle([z.lat, z.lng], {
      radius: z.radius,
      color: z.color,
      weight: 2,
      dashArray: '6 6',
      fillColor: z.color,
      fillOpacity: 0.12,
    });
    c.bindTooltip(esc(z.name), { sticky: true });
    c.on('click', (e) => {
      if (state.placing) handleMapClick(e.latlng);
    });
    c.addTo(zoneLayer);
    zoneLayers.set(z.id, c);
  }

  function rebuildMapObjects() {
    if (!map) return;
    markers.forEach((m) => m.remove());
    markers.clear();
    zoneLayer.clearLayers();
    zoneLayers.clear();
    state.devices.forEach(addMarker);
    state.zones.forEach(addZoneLayer);
  }

  function initMap() {
    map = L.map('map', { worldCopyJump: true, minZoom: 2 }).setView(CFG.map.defaultCenter, CFG.map.defaultZoom);
    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });
    const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
      attribution: '&copy; OpenStreetMap &copy; <a href="https://carto.com/attributions">CARTO</a>',
    });
    osm.addTo(map);
    L.control.layers({ 'Plan clair (OSM)': osm, 'Plan sombre': dark }, null, { position: 'topright' }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);
    zoneLayer = L.layerGroup().addTo(map);
    trailLayer = L.layerGroup().addTo(map);
    map.on('click', (e) => handleMapClick(e.latlng));
    map.on('dragstart', () => {
      if (state.follow) {
        state.follow = false;
        updateCardFields();
      }
    });
    rebuildMapObjects();
  }

  function fitAll() {
    if (!map) return;
    const pts = state.devices.map((d) => [d.lat, d.lng]);
    if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 12 });
    else map.setView(CFG.map.defaultCenter, CFG.map.defaultZoom);
  }

  function ensureApp() {
    if (!appReady) {
      initMap();
      appReady = true;
      renderAll();
      fitAll();
      startDataSource();
    }
    setTimeout(() => map && map.invalidateSize(), 50);
  }

  /* ---------- 6. Placement sur la carte ---------- */
  function startPlacing(kind, data, msg) {
    state.placing = { kind, data };
    $('#placeText').textContent = msg;
    $('#placeBanner').hidden = false;
    $('#map').classList.add('placing');
    $('#map').scrollIntoView({ block: 'nearest' });
  }
  function stopPlacing() {
    state.placing = null;
    $('#placeBanner').hidden = true;
    $('#map').classList.remove('placing');
  }
  function handleMapClick(latlng) {
    if (!state.placing) return;
    const { kind, data } = state.placing;
    stopPlacing();
    if (kind === 'zone') createZone({ ...data, lat: latlng.lat, lng: latlng.lng });
    if (kind === 'device') createDevice({ ...data, lat: latlng.lat, lng: latlng.lng });
  }

  /* ---------- 7. Traceurs ---------- */
  function createDevice(p) {
    const d = makeDevice(p);
    seedHistory(d);
    state.devices.push(d);
    addMarker(d);
    checkGeofences(d, true);
    persist();
    renderAll();
    selectDevice(d.id, { fly: true });
    toast(`Traceur « ${d.name} » ajouté`);
  }

  function removeDevice(id) {
    removeMarker(id);
    state.devices = state.devices.filter((d) => d.id !== id);
    if (state.selectedId === id) selectDevice(null);
    persist();
    renderAll();
  }

  function setOnline(d, on) {
    if (d.online === on) return;
    d.online = on;
    if (!on) {
      d.speed = 0;
      pushAlert({ type: 'offline', deviceId: d.id, msg: `${d.name} est passé hors ligne` }, 'warn');
    } else {
      d.lastUpdate = Date.now();
    }
    refreshMarker(d);
    if (state.selectedId === d.id) renderCard();
    scheduleSave();
    renderAll();
  }

  function selectDevice(id, opts = {}) {
    const prev = selected();
    state.selectedId = id;
    if (!id) state.follow = false;
    if (prev) refreshMarker(prev);
    const d = selected();
    if (d) refreshMarker(d);
    stopReplay();
    clearReplayMarker();
    const slider = $('#replaySlider');
    renderCard();
    drawTrail();
    updateHistoryPanel();
    if (d) slider.value = slider.max;
    renderDeviceList(true);
    if (d && opts.fly && map) map.flyTo([d.lat, d.lng], Math.max(map.getZoom(), 13), { duration: 0.8 });
  }

  /* ---------- 8. Géorepérage & alertes ---------- */
  function createZone(p) {
    const z = {
      id: uid(),
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      radius: p.radius,
      mode: p.mode,
      color: ZONE_COLORS[state.zones.length % ZONE_COLORS.length],
    };
    state.zones.push(z);
    addZoneLayer(z);
    state.devices.forEach((d) => checkGeofences(d, true));
    persist();
    renderZoneList();
    if (map) map.fitBounds(zoneLayers.get(z.id).getBounds(), { padding: [40, 40] });
    toast(`Zone « ${z.name} » créée`);
  }

  function removeZone(id) {
    const c = zoneLayers.get(id);
    if (c) c.remove();
    zoneLayers.delete(id);
    state.zones = state.zones.filter((z) => z.id !== id);
    state.devices.forEach((d) => {
      d.zones = d.zones.filter((zid) => zid !== id);
    });
    persist();
    renderZoneList();
    updateCardFields();
  }

  function checkGeofences(d, silent = false) {
    const inside = [];
    state.zones.forEach((z) => {
      const isIn = haversine(d.lat, d.lng, z.lat, z.lng) <= z.radius;
      const was = d.zones.includes(z.id);
      if (isIn) inside.push(z.id);
      if (silent) return;
      if (isIn && !was && z.mode !== 'exit') {
        pushAlert({ type: 'enter', deviceId: d.id, zoneId: z.id, msg: `${d.name} est entré dans la zone « ${z.name} »` }, '');
      }
      if (!isIn && was && z.mode !== 'enter') {
        pushAlert({ type: 'exit', deviceId: d.id, zoneId: z.id, msg: `${d.name} est sorti de la zone « ${z.name} »` }, 'warn');
      }
    });
    d.zones = inside;
  }

  function checkBattery(d) {
    if (d.battery <= CFG.lowBattery && !d.lowNotified) {
      d.lowNotified = true;
      pushAlert({ type: 'battery', deviceId: d.id, msg: `Batterie faible sur ${d.name} (${Math.round(d.battery)} %)` }, 'danger');
    } else if (d.battery > CFG.lowBattery + 5) {
      d.lowNotified = false;
    }
  }

  function pushAlert(a, kind) {
    state.alerts.unshift({ id: uid(), t: Date.now(), ...a });
    if (state.alerts.length > CFG.maxAlerts) state.alerts.length = CFG.maxAlerts;
    if (!(state.view === 'app' && state.tab === 'alerts')) state.unread += 1;
    toast(a.msg, kind);
    renderAlerts();
    scheduleSave();
  }

  /* ---------- 9. Mises à jour de position ---------- */
  function commitUpdate(d, u) {
    if (isNum(u.lat) && isNum(u.lng)) {
      d.lat = u.lat;
      d.lng = u.lng;
    }
    if (isNum(u.speed)) d.speed = u.speed;
    if (isNum(u.battery)) d.battery = clamp(u.battery, 0, 100);
    if (isNum(u.heading)) d.heading = u.heading;
    d.lastUpdate = u.ts || Date.now();
    const last = d.history[d.history.length - 1];
    if (!last || d.lastUpdate - last.t >= CFG.historyIntervalMs) {
      d.history.push({ lat: d.lat, lng: d.lng, t: d.lastUpdate, s: Math.round(d.speed) });
      if (d.history.length > CFG.historyMax) d.history.splice(0, d.history.length - CFG.historyMax);
    }
    checkGeofences(d);
    checkBattery(d);
    const m = markers.get(d.id);
    if (m) m.setLatLng([d.lat, d.lng]);
    if (state.follow && state.selectedId === d.id && map) map.panTo([d.lat, d.lng], { animate: true });
    scheduleSave();
  }

  /* ---------- 10. Simulation ---------- */
  function simulateStep(d, seconds) {
    const T = TYPES[d.type];
    d.heading = (d.heading + rand(-14, 14) + 360) % 360;
    d.speed = clamp(d.speed + rand(-5, 5), 0, T.max);
    if (d.speed < 1 && Math.random() < 0.3) d.speed = T.max * rand(0.25, 0.6);
    if (Math.random() < 0.01) d.speed = 0;
    const dist = (d.speed / 3.6) * seconds;
    const next = dist > 0 ? destination(d.lat, d.lng, d.heading, dist) : { lat: d.lat, lng: d.lng };
    const battery = d.battery - 0.01 * (seconds / 5);
    commitUpdate(d, { lat: next.lat, lng: next.lng, battery });
    if (d.battery <= 0) setOnline(d, false);
  }

  function tick() {
    const now = Date.now();
    state.devices.forEach((d) => {
      if (d.external && d.online && now - d.lastUpdate > CFG.externalTimeoutMs) setOnline(d, false);
    });
    if (!appReady || state.view !== 'app') return;
    if (state.simulating) {
      state.devices.forEach((d) => {
        if (d.online && !d.external) simulateStep(d, state.simFactor);
      });
    }
    refreshUI();
  }

  function updateSimUI() {
    $('#simToggle').textContent = state.simulating ? '⏸ Pause' : '▶ Démarrer';
    $('#simDot').classList.toggle('live', state.simulating);
    $('#simStatus').textContent = state.simulating
      ? `Simulation en cours (×${state.simFactor}) · ${sourceLabel}`
      : `Simulation en pause · ${sourceLabel}`;
    $('#simSpeed').value = String(state.simFactor);
  }

  /* ---------- 11. Rendu ---------- */
  function refreshUI() {
    updateDeviceItems();
    renderSummary();
    updateCardFields();
    updateHistoryPanel();
    drawTrail();
    updateZoneCounts();
  }

  function renderAll() {
    renderDeviceList(true);
    renderSummary();
    renderZoneList();
    renderAlerts();
    renderCard();
    updateHistoryPanel();
    updateSimUI();
  }

  function visibleDevices() {
    const q = state.filter.q.trim().toLowerCase();
    return state.devices
      .filter((d) => {
        const st = state.filter.status;
        if (st === 'online' && !d.online) return false;
        if (st === 'offline' && d.online) return false;
        if (st === 'moving' && !(d.online && d.speed > 1)) return false;
        if (q && !(d.name.toLowerCase().includes(q) || TYPES[d.type].label.toLowerCase().includes(q) || d.id.toLowerCase().includes(q))) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  function renderSummary() {
    const on = state.devices.filter((d) => d.online).length;
    $('#summary').textContent = `${on} en ligne · ${state.devices.length - on} hors ligne · ${state.devices.length} au total`;
  }

  function batClass(b) {
    return b <= CFG.lowBattery ? 'low' : b <= 40 ? 'mid' : '';
  }

  function renderDeviceList(force) {
    const list = visibleDevices();
    const sig = list.map((d) => `${d.id}|${d.name}|${d.online}|${d.color}`).join(';') + '#' + state.selectedId;
    $('#deviceEmpty').hidden = list.length > 0;
    if (force || sig !== listSignature) {
      listSignature = sig;
      $('#deviceList').innerHTML = list
        .map(
          (d) => `
        <li class="dev ${d.id === state.selectedId ? 'is-selected' : ''} ${d.online ? '' : 'is-offline'}" data-id="${esc(d.id)}" tabindex="0" role="button" aria-label="Sélectionner ${esc(d.name)}">
          <span class="dev-ico" style="--c:${d.color}">${TYPES[d.type].emoji}</span>
          <div class="dev-main">
            <div class="dev-top"><strong>${esc(d.name)}</strong><span class="pill ${d.online ? 'on' : 'off'}">${d.online ? 'En ligne' : 'Hors ligne'}</span></div>
            <div class="dev-meta">
              <span data-f="speed"></span>
              <span><span class="bat"><i data-f="batbar"></i></span><span data-f="battery"></span></span>
              <span data-f="time"></span>
            </div>
            <div class="dev-coord" data-f="coord"></div>
          </div>
        </li>`
        )
        .join('');
    }
    updateDeviceItems();
  }

  // Met à jour les champs dynamiques sans recréer le DOM (les clics restent fiables).
  function updateDeviceItems() {
    $$('#deviceList .dev').forEach((el) => {
      const d = deviceById(el.dataset.id);
      if (!d) return;
      const set = (f, v) => {
        const n = el.querySelector(`[data-f="${f}"]`);
        if (n && n.textContent !== v) n.textContent = v;
      };
      set('speed', `⚡ ${Math.round(d.speed)} km/h`);
      set('battery', `${Math.round(d.battery)} %`);
      set('time', relTime(d.lastUpdate));
      set('coord', fmtCoord(d));
      const bar = el.querySelector('[data-f="batbar"]');
      if (bar) {
        bar.style.width = `${Math.round(d.battery)}%`;
        bar.className = batClass(d.battery);
      }
    });
  }

  function renderZoneList() {
    $('#zoneEmpty').hidden = state.zones.length > 0;
    $('#zoneList').innerHTML = state.zones
      .map(
        (z) => `
      <li class="zone-item" data-zid="${esc(z.id)}">
        <span class="zone-dot" style="--c:${z.color}"></span>
        <div class="zone-info">
          <strong>${esc(z.name)}</strong>
          <small>${fmtDist(z.radius)} · ${MODE_LABEL[z.mode]} · <span data-f="zcount">0</span> traceur(s) dedans</small>
        </div>
        <button type="button" class="btn btn-sm" data-zact="locate" aria-label="Voir la zone">🎯</button>
        <button type="button" class="btn btn-sm btn-danger" data-zact="delete" aria-label="Supprimer la zone">🗑</button>
      </li>`
      )
      .join('');
    updateZoneCounts();
  }

  function updateZoneCounts() {
    $$('#zoneList .zone-item').forEach((el) => {
      const n = state.devices.filter((d) => d.zones.includes(el.dataset.zid)).length;
      const c = el.querySelector('[data-f="zcount"]');
      if (c && c.textContent !== String(n)) c.textContent = n;
    });
  }

  const ALERT_ICON = { enter: '🟢', exit: '🟠', battery: '🪫', offline: '📴' };

  function renderAlerts() {
    $('#alertEmpty').hidden = state.alerts.length > 0;
    $('#alertSummary').textContent = `${state.alerts.length} alerte(s)`;
    $('#alertList').innerHTML = state.alerts
      .map(
        (a) => `
      <li class="alert-item ${esc(a.type)}" data-did="${esc(a.deviceId || '')}">
        <span class="alert-ico">${ALERT_ICON[a.type] || '🔔'}</span>
        <div class="alert-text">${esc(a.msg)}<small>${fmtTime(a.t)}</small></div>
      </li>`
      )
      .join('');
    const b = $('#alertBadge');
    b.hidden = state.unread <= 0;
    b.textContent = state.unread > 99 ? '99+' : state.unread;
  }

  function renderCard() {
    const d = selected();
    const card = $('#deviceCard');
    if (!d) {
      card.hidden = true;
      card.innerHTML = '';
      return;
    }
    card.hidden = false;
    card.innerHTML = `
      <div class="card-head">
        <span class="dev-ico" style="--c:${d.color}">${TYPES[d.type].emoji}</span>
        <div class="card-title">
          <h3>${esc(d.name)}</h3>
          <span class="pill ${d.online ? 'on' : 'off'}">${d.online ? 'En ligne' : 'Hors ligne'}</span>
          <small>${TYPES[d.type].label}</small>
        </div>
        <button type="button" class="icon-btn" data-act="close" aria-label="Fermer la fiche">✕</button>
      </div>
      <dl class="stats">
        <div><dt>Vitesse</dt><dd data-f="speed"></dd></div>
        <div><dt>Batterie</dt><dd data-f="battery"></dd></div>
        <div><dt>Cap</dt><dd data-f="heading"></dd></div>
        <div class="wide"><dt>Coordonnées</dt><dd data-f="coord"></dd></div>
        <div class="wide"><dt>Dernière mise à jour</dt><dd data-f="time"></dd></div>
        <div class="wide"><dt>Zones</dt><dd data-f="zones"></dd></div>
      </dl>
      <div class="card-actions">
        <button type="button" class="btn btn-sm" data-act="center">🎯 Centrer</button>
        <button type="button" class="btn btn-sm" data-act="follow" aria-pressed="${state.follow}">📍 Suivre</button>
        <button type="button" class="btn btn-sm" data-act="history">🛣️ Trajet</button>
        <button type="button" class="btn btn-sm" data-act="toggle">${d.online ? '⏻ Hors ligne' : '⏻ En ligne'}</button>
        <button type="button" class="btn btn-sm btn-danger" data-act="delete">🗑 Supprimer</button>
      </div>`;
    updateCardFields();
  }

  function updateCardFields() {
    const d = selected();
    const card = $('#deviceCard');
    if (!d || card.hidden) return;
    const set = (f, v) => {
      const n = card.querySelector(`[data-f="${f}"]`);
      if (n && n.textContent !== v) n.textContent = v;
    };
    set('speed', `${Math.round(d.speed)} km/h`);
    set('battery', `${Math.round(d.battery)} %`);
    set('heading', `${Math.round(d.heading)}° ${compass(d.heading)}`);
    set('coord', fmtCoord(d));
    set('time', `${fmtTime(d.lastUpdate)} (${relTime(d.lastUpdate)})`);
    const names = d.zones.map((id) => (zoneById(id) || {}).name).filter(Boolean);
    set('zones', names.length ? names.join(', ') : 'Aucune');
    const f = card.querySelector('[data-act="follow"]');
    if (f) f.setAttribute('aria-pressed', String(state.follow));
  }

  /* ---------- 12. Historique ---------- */
  function currentHistory() {
    const d = selected();
    if (!d) return [];
    const r = $('#histRange').value;
    if (r === 'all') return d.history;
    const cutoff = Date.now() - Number(r) * 60000;
    return d.history.filter((p) => p.t >= cutoff);
  }

  function drawTrail() {
    if (!trailLayer) return;
    trailLayer.clearLayers();
    const d = selected();
    if (!d || !state.showTrail) return;
    const pts = currentHistory();
    if (pts.length < 2) return;
    const ll = pts.map((p) => [p.lat, p.lng]);
    L.polyline(ll, { color: d.color, weight: 4, opacity: 0.85 }).addTo(trailLayer);
    L.circleMarker(ll[0], { radius: 6, color: '#fff', weight: 2, fillColor: '#22c55e', fillOpacity: 1 })
      .bindTooltip('Départ')
      .addTo(trailLayer);
  }

  function updateHistoryPanel() {
    const d = selected();
    $('#histEmpty').hidden = !!d;
    $('#histBody').hidden = !d;
    if (!d) return;
    const pts = currentHistory();
    $('#histName').textContent = d.name;
    let dist = 0;
    let vmax = 0;
    for (let i = 0; i < pts.length; i++) {
      vmax = Math.max(vmax, pts[i].s || 0);
      if (i) dist += haversine(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
    }
    $('#hPoints').textContent = String(pts.length);
    $('#hDist').textContent = fmtDist(dist);
    $('#hMax').textContent = `${vmax} km/h`;
    $('#hDur').textContent = pts.length > 1 ? fmtDuration(pts[pts.length - 1].t - pts[0].t) : '—';
    const slider = $('#replaySlider');
    slider.max = String(Math.max(0, pts.length - 1));
    slider.disabled = pts.length < 2;
    $('#replayPlay').disabled = pts.length < 2;
    if (Number(slider.value) > Number(slider.max)) slider.value = slider.max;
  }

  function clearReplayMarker() {
    if (replayMarker) {
      replayMarker.remove();
      replayMarker = null;
    }
    $('#replayInfo').textContent = 'Déplacez le curseur pour parcourir le trajet.';
  }

  function showReplay(i) {
    const d = selected();
    const pts = currentHistory();
    const p = pts[i];
    if (!d || !p || !map) return;
    if (!replayMarker) {
      replayMarker = L.circleMarker([p.lat, p.lng], { radius: 9, color: '#fff', weight: 3, fillColor: d.color, fillOpacity: 1 }).addTo(map);
    } else {
      replayMarker.setLatLng([p.lat, p.lng]);
    }
    $('#replayInfo').textContent = `${fmtTime(p.t)} · ${p.s} km/h`;
  }

  function stopReplay() {
    clearInterval(replayTimer);
    replayTimer = null;
    $('#replayPlay').textContent = '▶ Rejouer';
  }

  function toggleReplay() {
    if (replayTimer) {
      stopReplay();
      return;
    }
    const slider = $('#replaySlider');
    if (Number(slider.value) >= Number(slider.max)) slider.value = '0';
    $('#replayPlay').textContent = '⏸ Pause';
    replayTimer = setInterval(() => {
      const next = Number(slider.value) + 1;
      if (next > Number(slider.max)) {
        stopReplay();
        return;
      }
      slider.value = String(next);
      showReplay(next);
    }, 120);
  }

  function exportCsv() {
    const d = selected();
    if (!d) return;
    const rows = ['horodatage,latitude,longitude,vitesse_kmh'];
    currentHistory().forEach((p) => rows.push(`${new Date(p.t).toISOString()},${p.lat.toFixed(6)},${p.lng.toFixed(6)},${p.s}`));
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `trajet-${d.name.replace(/[^\w-]+/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- 13. Sources de données réelles ---------- */
  function ingest(payload) {
    const items = Array.isArray(payload) ? payload : payload && Array.isArray(payload.devices) ? payload.devices : payload ? [payload] : [];
    let touched = false;
    items.forEach((it) => {
      if (!it || it.id == null) return;
      const lat = Number(it.lat);
      const lng = Number(it.lng);
      if (!isNum(lat) || !isNum(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
      const id = String(it.id);
      let d = deviceById(id);
      if (!d) {
        d = makeDevice({ id, name: it.name || `Traceur ${id}`, type: it.type, lat, lng, external: true, speed: Number(it.speed) || 0 });
        state.devices.push(d);
        addMarker(d);
        checkGeofences(d, true);
      }
      d.external = true;
      const ts = it.timestamp ? new Date(it.timestamp).getTime() : Date.now();
      if (!d.online) {
        d.online = true;
        refreshMarker(d);
      }
      commitUpdate(d, {
        lat,
        lng,
        speed: it.speed != null ? Number(it.speed) : undefined,
        battery: it.battery != null ? Number(it.battery) : undefined,
        heading: it.heading != null ? Number(it.heading) : undefined,
        ts: Number.isFinite(ts) ? ts : Date.now(),
      });
      touched = true;
    });
    if (touched && appReady) {
      renderDeviceList(false);
      renderSummary();
    }
  }

  function setSource(label) {
    sourceLabel = label;
    if (appReady) updateSimUI();
  }

  function connectWebSocket(url) {
    const open = () => {
      let ws;
      try {
        ws = new WebSocket(url);
      } catch (e) {
        setSource('URL WebSocket invalide');
        return;
      }
      ws.onopen = () => setSource('WebSocket connecté');
      ws.onmessage = (ev) => {
        try {
          ingest(JSON.parse(ev.data));
        } catch (e) {
          console.warn('Message WebSocket invalide', e);
        }
      };
      ws.onclose = () => {
        setSource('WebSocket déconnecté, reconnexion…');
        setTimeout(open, 5000);
      };
      ws.onerror = () => ws.close();
    };
    open();
  }

  function pollRest(url, every) {
    const run = () =>
      fetch(url, { headers: { Accept: 'application/json' } })
        .then((r) => {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        })
        .then((data) => {
          ingest(data);
          setSource('API REST connectée');
        })
        .catch((e) => {
          console.warn('Erreur API REST', e);
          setSource('API REST injoignable');
        });
    run();
    setInterval(run, Math.max(1000, every));
  }

  function startDataSource() {
    const ds = CFG.dataSource;
    if (ds.type === 'websocket' && ds.url) connectWebSocket(ds.url);
    else if (ds.type === 'rest' && ds.url) pollRest(ds.url, ds.intervalMs);
    updateSimUI();
  }

  /* ---------- 14. Onglets ---------- */
  function setTab(name) {
    state.tab = name;
    $$('.sb-tab').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === name));
    $$('.sb-panel').forEach((p) => p.classList.toggle('is-active', p.id === `tab-${name}`));
    if (name === 'alerts') {
      state.unread = 0;
      renderAlerts();
    }
    if (name === 'history') updateHistoryPanel();
  }

  /* ---------- 15. Dialogues légaux ---------- */
  const LEGAL = {
    mentions: {
      title: 'Mentions légales',
      body: `<p><strong>Éditeur :</strong> Riamo GPS World, projet publié sur GitHub par le compte « riamofficial ».</p>
        <p><strong>Hébergement :</strong> site statique hébergé via GitHub Pages ou Cloudflare Pages.</p>
        <p><strong>Cartographie :</strong> © contributeurs OpenStreetMap, tuiles © CARTO. Bibliothèque Leaflet.</p>
        <p>Complétez cette page avec la raison sociale, l'adresse et le contact de l'éditeur avant une mise en production commerciale.</p>`,
    },
    privacy: {
      title: 'Politique de confidentialité',
      body: `<p>L'application fonctionne dans votre navigateur : vos traceurs, zones et alertes sont stockés localement (localStorage) et ne sont envoyés à aucun serveur.</p>
        <p>Seules les tuiles de carte sont téléchargées auprès d'OpenStreetMap / CARTO, qui peuvent voir votre adresse IP.</p>
        <p>Les messages du formulaire de contact sont enregistrés localement en mode démonstration.</p>
        <p>Vous pouvez tout effacer en vidant les données du site dans votre navigateur ou via le bouton « Réinitialiser ».</p>`,
    },
    cgu: {
      title: "Conditions d'utilisation",
      body: `<p>Riamo GPS World est fourni « en l'état », à titre de démonstration. Les positions affichées par la simulation sont fictives.</p>
        <p>Si vous connectez des données réelles, vous restez responsable du respect de la vie privée des personnes suivies et de la réglementation en vigueur (notamment le RGPD).</p>
        <p>Ne l'utilisez pas comme unique moyen de sécurité ou de secours.</p>`,
    },
  };

  /* ---------- 16. Événements ---------- */
  function wire() {
    // Bascule site / application + liens internes
    document.addEventListener('click', (e) => {
      const v = e.target.closest('[data-view]');
      if (v) {
        e.preventDefault();
        showView(v.dataset.view);
        return;
      }
      const lg = e.target.closest('[data-legal]');
      if (lg) {
        const c = LEGAL[lg.dataset.legal];
        $('#legalTitle').textContent = c.title;
        $('#legalBody').innerHTML = c.body;
        $('#legalDialog').showModal();
        return;
      }
      if (e.target.closest('[data-close]')) {
        const dlg = e.target.closest('dialog');
        if (dlg) dlg.close();
      }
    });
    window.addEventListener('hashchange', route);

    // Formulaire de contact (mode démo : enregistrement local)
    $('#contactForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const msgs = store.get('contacts', []);
      msgs.push({ t: Date.now(), nom: fd.get('nom'), email: fd.get('email'), offre: fd.get('offre'), message: fd.get('message') });
      store.set('contacts', msgs);
      e.target.reset();
      $('#contactStatus').textContent =
        'Merci ! Votre message a été enregistré localement (mode démonstration — voir le README pour brancher un service d’envoi).';
    });

    // Onglets
    $$('.sb-tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

    // Recherche / filtres
    $('#searchInput').addEventListener('input', (e) => {
      state.filter.q = e.target.value;
      renderDeviceList(true);
    });
    $('#statusFilter').addEventListener('change', (e) => {
      state.filter.status = e.target.value;
      renderDeviceList(true);
    });

    // Liste des traceurs
    const list = $('#deviceList');
    const pick = (e) => {
      const li = e.target.closest('.dev');
      if (li) selectDevice(li.dataset.id, { fly: true });
    };
    list.addEventListener('click', pick);
    list.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pick(e);
      }
    });

    // Fiche traceur
    $('#deviceCard').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      const d = selected();
      if (!b || !d) return;
      const act = b.dataset.act;
      if (act === 'close') selectDevice(null);
      if (act === 'center' && map) map.flyTo([d.lat, d.lng], Math.max(map.getZoom(), 15), { duration: 0.7 });
      if (act === 'follow') {
        state.follow = !state.follow;
        if (state.follow && map) map.panTo([d.lat, d.lng]);
        updateCardFields();
      }
      if (act === 'history') setTab('history');
      if (act === 'toggle') setOnline(d, !d.online);
      if (act === 'delete' && confirm(`Supprimer « ${d.name} » ?`)) removeDevice(d.id);
    });

    // Ajout d'un traceur
    const dlg = $('#deviceDialog');
    const form = $('#deviceForm');
    $('#addDeviceBtn').addEventListener('click', () => {
      form.reset();
      dlg.showModal();
    });
    $('#dCenter').addEventListener('click', () => {
      if (!map) return;
      const c = map.getCenter();
      $('#dLat').value = c.lat.toFixed(5);
      $('#dLng').value = c.lng.toFixed(5);
    });
    const readDevice = () => ({
      name: $('#dName').value.trim(),
      type: $('#dType').value,
      speed: clamp(Number($('#dSpeed').value) || 0, 0, 300),
    });
    $('#dPick').addEventListener('click', () => {
      if (!$('#dName').reportValidity()) return;
      const data = readDevice();
      dlg.close();
      startPlacing('device', data, `Cliquez sur la carte pour placer « ${data.name} »`);
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = readDevice();
      let lat = parseFloat($('#dLat').value);
      let lng = parseFloat($('#dLng').value);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        const c = map ? map.getCenter() : { lat: CFG.map.defaultCenter[0], lng: CFG.map.defaultCenter[1] };
        lat = c.lat;
        lng = c.lng;
      }
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        toast('Coordonnées invalides', 'danger');
        return;
      }
      dlg.close();
      createDevice({ ...data, lat, lng });
    });

    // Placement : annulation
    $('#placeCancel').addEventListener('click', stopPlacing);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.placing) stopPlacing();
    });

    // Zones
    const readZone = () => ({
      name: $('#zoneName').value.trim(),
      radius: clamp(Number($('#zoneRadius').value) || 1000, 50, 500000),
      mode: $('#zoneMode').value,
    });
    $('#zoneForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = readZone();
      startPlacing('zone', data, `Cliquez sur la carte pour placer la zone « ${data.name} »`);
    });
    $('#zoneHere').addEventListener('click', () => {
      if (!$('#zoneForm').reportValidity() || !map) return;
      const c = map.getCenter();
      createZone({ ...readZone(), lat: c.lat, lng: c.lng });
    });
    $('#zoneList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-zact]');
      const li = e.target.closest('.zone-item');
      if (!b || !li) return;
      const z = zoneById(li.dataset.zid);
      if (!z) return;
      if (b.dataset.zact === 'locate' && map) map.fitBounds(zoneLayers.get(z.id).getBounds(), { padding: [40, 40] });
      if (b.dataset.zact === 'delete' && confirm(`Supprimer la zone « ${z.name} » ?`)) removeZone(z.id);
    });

    // Historique
    $('#histRange').addEventListener('change', () => {
      stopReplay();
      clearReplayMarker();
      updateHistoryPanel();
      drawTrail();
    });
    $('#showTrail').addEventListener('change', (e) => {
      state.showTrail = e.target.checked;
      drawTrail();
    });
    $('#replaySlider').addEventListener('input', (e) => showReplay(Number(e.target.value)));
    $('#replayPlay').addEventListener('click', toggleReplay);
    $('#exportCsv').addEventListener('click', exportCsv);
    $('#clearHistory').addEventListener('click', () => {
      const d = selected();
      if (!d || !confirm(`Effacer l'historique de « ${d.name} » ?`)) return;
      d.history = [{ lat: d.lat, lng: d.lng, t: Date.now(), s: Math.round(d.speed) }];
      stopReplay();
      clearReplayMarker();
      updateHistoryPanel();
      drawTrail();
      persist();
    });

    // Alertes
    $('#alertList').addEventListener('click', (e) => {
      const li = e.target.closest('.alert-item');
      if (li && li.dataset.did && deviceById(li.dataset.did)) selectDevice(li.dataset.did, { fly: true });
    });
    $('#clearAlerts').addEventListener('click', () => {
      state.alerts = [];
      state.unread = 0;
      renderAlerts();
      persist();
    });

    // Simulation
    $('#simToggle').addEventListener('click', () => {
      state.simulating = !state.simulating;
      updateSimUI();
      persist();
    });
    $('#simSpeed').addEventListener('change', (e) => {
      state.simFactor = Number(e.target.value);
      updateSimUI();
      persist();
    });
    $('#resetBtn').addEventListener('click', () => {
      if (!confirm('Réinitialiser les traceurs, zones et alertes de démonstration ?')) return;
      ['devices', 'zones', 'alerts', 'prefs'].forEach(store.remove);
      stopReplay();
      state.selectedId = null;
      state.follow = false;
      state.unread = 0;
      loadState();
      rebuildMapObjects();
      renderAll();
      drawTrail();
      fitAll();
      toast('Données de démonstration réinitialisées');
    });

    // Boutons de la carte
    $('#fitAll').addEventListener('click', fitAll);
    $('#locateMe').addEventListener('click', () => {
      if (!map) return;
      if (!navigator.geolocation) {
        toast('Géolocalisation non disponible', 'warn');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const ll = [pos.coords.latitude, pos.coords.longitude];
          if (userMarker) userMarker.remove();
          userMarker = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#0ea5e9', fillOpacity: 1 })
            .bindTooltip('Vous êtes ici')
            .addTo(map);
          map.flyTo(ll, 15, { duration: 0.8 });
        },
        () => toast('Position refusée ou indisponible', 'warn'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

    window.addEventListener('beforeunload', persist);
  }

  /* ---------- 17. Démarrage ---------- */
  function init() {
    $('#year').textContent = new Date().getFullYear();
    loadState();
    wire();
    setInterval(tick, 1000);
    route();
  }

  // API publique : window.RiamoGPS.ingest({...}) pour pousser des positions réelles
  window.RiamoGPS = {
    ingest,
    getDevices: () => JSON.parse(JSON.stringify(state.devices)),
    getZones: () => JSON.parse(JSON.stringify(state.zones)),
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
