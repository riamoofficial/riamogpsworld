(function () {
  'use strict';
  var css = '.rg-btn2{position:fixed;right:12px;z-index:1500;width:46px;height:46px;border-radius:50%;border:0;background:#fff;color:#111;font-size:21px;box-shadow:0 2px 8px #0006}' +
    'html.rg-light{filter:invert(1) hue-rotate(180deg);background:#fff}' +
    'html.rg-light img,html.rg-light video,html.rg-light .leaflet-tile-pane,html.rg-light .leaflet-marker-pane{filter:invert(1) hue-rotate(180deg)}' +
    'html.rg-full header{display:none!important}' +
    '#rg-toast{position:fixed;left:50%;transform:translateX(-50%);top:12px;z-index:2000;background:#0a7d3b;color:#fff;padding:8px 14px;border-radius:20px;font:600 13px sans-serif}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function ready(fn) { if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    var root = document.documentElement;
    try { if (localStorage.getItem('rg-theme') === 'light') root.classList.add('rg-light'); } catch (e) {}

    var theme = document.createElement('button');
    theme.className = 'rg-btn2'; theme.style.bottom = '150px'; theme.textContent = '🌓'; theme.title = 'Mode clair / sombre';
    theme.onclick = function () {
      var light = root.classList.toggle('rg-light');
      try { localStorage.setItem('rg-theme', light ? 'light' : 'dark'); } catch (e) {}
    };

    var fs = document.createElement('button');
    fs.className = 'rg-btn2'; fs.style.bottom = '210px'; fs.textContent = '⛶'; fs.title = 'Plein écran';
    fs.onclick = function () {
      var on = root.classList.toggle('rg-full');
      try { if (on) root.requestFullscreen(); else if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
      setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 250);
    };
    document.addEventListener('fullscreenchange', function () {
      if (!document.fullscreenElement) { root.classList.remove('rg-full'); window.dispatchEvent(new Event('resize')); }
    });

    var t = document.createElement('div'); t.id = 'rg-toast'; t.textContent = '✓ Mise à jour chargée';
    document.body.appendChild(theme); document.body.appendChild(fs); document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3000);
  });
})();
