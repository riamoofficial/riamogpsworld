/*
 * Riamo GPS World — configuration
 * Modifiez ce fichier sans toucher à app.js.
 *
 * dataSource.type :
 *   'none'       → simulation locale uniquement (par défaut)
 *   'websocket'  → reçoit des positions en JSON via WebSocket (ex. 'wss://exemple.com/gps')
 *   'rest'       → interroge une API REST toutes les `intervalMs` millisecondes
 *
 * Format JSON attendu (un objet, un tableau d'objets, ou { "devices": [...] }) :
 *   { "id": "abc123", "name": "Camion 12", "type": "camion",
 *     "lat": 48.8566, "lng": 2.3522, "speed": 42, "battery": 87, "heading": 90 }
 * Seuls id, lat et lng sont obligatoires.
 */
window.RIAMO_CONFIG = {
  dataSource: {
    type: 'none',
    url: '',
    intervalMs: 5000
  },
  map: {
    defaultCenter: [25, 10],
    defaultZoom: 2
  }
};
