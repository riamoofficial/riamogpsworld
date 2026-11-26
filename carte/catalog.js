(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var n = 0, t = setInterval(function () {
    if (window.RIAMO && window.RIAMO.map && $('archives') && typeof importPmtiles === 'function') { clearInterval(t); init(); } else if (++n > 300) clearInterval(t);
  }, 300);
  function init() {
    var box = document.createElement('div');
    box.innerHTML = '<h4>Cartes hébergées (GitHub / Cloudflare)</h4><div id="cat-list" class="muted">Chargement…</div>';
    $('archives').parentNode.insertBefore(box, $('archives').nextSibling);
    function render() {
      fetch('data/regions.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (list) {
        var out = $('cat-list'); out.innerHTML = list.length ? '' : 'Aucune région publiée pour l’instant (voir l’action « Construire une région »).';
        list.forEach(function (it) {
          var file = it.file.split('/').pop(), inst = archives.some(function (a) { return a.name === file; });
          var d = document.createElement('div'); d.className = 'item';
          d.innerHTML = '<b>' + esc(it.name) + '</b><small>' + (it.mb ? it.mb + ' Mo' : '') + (it.date ? ' · ' + esc(it.date) : '') + (inst ? ' · ✓ installé' : '') + '</small>';
          var b = document.createElement('button'); b.className = 'btn'; b.textContent = inst ? 'Réinstaller' : 'Télécharger'; b.style.marginTop = '6px';
          b.onclick = function () {
            b.disabled = true;
            fetch(new URL(it.file, location.href).href).then(function (r) {
              if (!r.ok) throw new Error('HTTP ' + r.status);
              return importPmtiles(r.body, file, +r.headers.get('content-length') || 0);
            }).catch(function (e) { $('pmmsg').textContent = 'Erreur : ' + e.message; }).then(function () { b.disabled = false; render(); });
          };
          d.appendChild(document.createElement('br')); d.appendChild(b); out.appendChild(d);
        });
      }).catch(function () { $('cat-list').textContent = 'Catalogue indisponible.'; });
    }
    render();
    document.querySelector('#nav button[data-p="off"]').addEventListener('click', render);
  }
})();
