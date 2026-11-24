/* Réglages de Riamo GPS World.
   Ce fichier est public : n'y mettez jamais de clé API ni de mot de passe. */
window.RIAMO_CONFIG = {
  // Adresse qui reçoit les messages du formulaire de contact (à renseigner)
  contactEmail: "",

  // Carte (centrée sur Paris par défaut)
  center: [48.8566, 2.3522],
  zoom: 12,
  tiles: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; contributeurs OpenStreetMap"
  },

  // Sauvegarde locale et simulation
  storageKey: "riamo-gps-world-v1",
  simIntervalMs: 1500,   // une mise à jour toutes les 1,5 s
  simStep: 0.0006,       // distance parcourue à chaque mise à jour (degrés)
  maxHistory: 300,       // points d'historique gardés par appareil

  // Appareils de démonstration (status : moving, idle ou offline)
  devices: [
    { id: "d1", name: "Camion 12",         lat: 48.8443, lng: 2.3744, battery: 78, status: "moving" },
    { id: "d2", name: "Vélo livraison",    lat: 48.8606, lng: 2.3376, battery: 55, status: "moving" },
    { id: "d3", name: "Voiture Pro",       lat: 48.8738, lng: 2.2950, battery: 91, status: "idle" },
    { id: "d4", name: "Balise remorque",   lat: 48.8867, lng: 2.3431, battery: 12, status: "offline" }
  ]
};
