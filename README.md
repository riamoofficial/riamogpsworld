# Riamo GPS World

Site vitrine et application web de suivi GPS (Leaflet + OpenStreetMap), 100 % statique : aucun build, aucune clé d'API.

- **Site vitrine** : présentation, fonctionnalités, tarifs, contact, mentions.
- **Application GPS** : liste des traceurs (recherche, filtres, statut, vitesse, batterie, coordonnées), carte interactive, géorepérage (alertes d'entrée/sortie), historique de trajet avec rejeu et export CSV, ajout de traceurs, simulation temps réel, persistance `localStorage`.
- Bascule instantanée **Site vitrine / Application GPS** depuis l'en-tête (liens directs : `#site`, `#app`).

## Structure

```
riamo-gps-world/
├── index.html     # Site vitrine + application (deux vues)
├── styles.css     # Thème sombre responsive
├── app.js         # Logique de l'application GPS
├── config.js      # Configuration (source de données réelle, carte)
├── favicon.svg
├── .gitignore
└── README.md
```

## Lancer en local

Ouvrez simplement `index.html` dans un navigateur (connexion Internet nécessaire pour Leaflet et les tuiles).
Pour un serveur local :

```bash
cd riamo-gps-world
python3 -m http.server 8080      # puis http://localhost:8080
# ou : npx serve .
```

## Utiliser l'application

1. Cliquez sur **Application GPS** : 7 traceurs de démonstration bougent dans le monde (simulation ×10, réglable, pause possible).
2. **Traceurs** : recherchez, filtrez, cliquez sur un traceur pour le centrer ; la fiche permet de suivre, passer hors ligne ou supprimer. **＋ Ajouter** crée un traceur (coordonnées, centre de la carte ou clic sur la carte).
3. **Zones** : nom + rayon + type d'alerte, puis « Placer sur la carte » (clic) ou « Au centre de la carte ». Les entrées/sorties génèrent une notification et une ligne dans **Alertes**.
4. **Trajets** : période, distance, vitesse max, rejeu avec curseur, export CSV.
5. Les traceurs, zones et alertes sont conservés dans `localStorage`. Le bouton **↺ Réinitialiser** restaure la démo.

## Connecter des données réelles

Éditez `config.js` :

```js
window.RIAMO_CONFIG = {
  dataSource: { type: 'websocket', url: 'wss://votre-serveur/gps', intervalMs: 5000 },
};
```

- `type: 'websocket'` : un message JSON par mise à jour.
- `type: 'rest'` : l'API est interrogée toutes les `intervalMs` ms.
- Format accepté : un objet, un tableau, ou `{ "devices": [...] }` :

```json
{ "id": "abc123", "name": "Camion 12", "type": "camion", "lat": 48.8566, "lng": 2.3522, "speed": 42, "battery": 87, "heading": 90 }
```

Seuls `id`, `lat` et `lng` sont obligatoires. Un traceur externe passe « hors ligne » après 90 s sans donnée. Depuis la console ou votre propre script : `window.RiamoGPS.ingest({...})`.
Le serveur doit autoriser le CORS pour l'API REST.

## Publier sur GitHub (`riamofficial`)

### 1. S'authentifier sans se bloquer sur `/login/device`

La page `https://github.com/login/device` ne sert que si un outil (GitHub CLI, Git Credential Manager…) vous a affiché un **code à 8 caractères** dans le terminal. Sans code généré, ne l'utilisez pas : elle ne mène à rien. Choisissez plutôt l'une de ces méthodes :

```bash
gh auth login --web        # le terminal affiche un code ; collez-le sur /login/device
```

ou un **Personal Access Token** (GitHub → Settings → Developer settings → Tokens, droit `repo`) saisi comme mot de passe lors du `git push` HTTPS, ou une **clé SSH** (`ssh-keygen -t ed25519`, puis ajout de la clé publique dans Settings → SSH keys).

### 2. Créer le dépôt et pousser

Créez `riamofficial/riamo-gps-world` sur github.com (vide, sans README), puis :

```bash
cd riamo-gps-world
git init -b main
git add .
git commit -m "Riamo GPS World : site vitrine et application GPS"
git remote add origin https://github.com/riamofficial/riamo-gps-world.git
git push -u origin main
```

Avec GitHub CLI : `gh repo create riamofficial/riamo-gps-world --public --source=. --push`.

### 3. Mettre en ligne avec GitHub Pages

Dépôt → **Settings → Pages** → Source : *Deploy from a branch* → branche `main`, dossier `/ (root)` → Save.
Le site sera disponible sur `https://riamofficial.github.io/riamo-gps-world/`.

### Alternative : Cloudflare Pages

Projet connecté au dépôt GitHub : *Framework preset* = None, *Build command* = vide, *Build output directory* = `/` (racine). Chaque `git push` sur `main` redéploie le site (par ex. `riamogpsworld.pages.dev`).

## Personnaliser

- Couleurs : variables `:root` en haut de `styles.css`.
- Tarifs et textes : `index.html` (les prix sont indicatifs).
- Types de traceurs, zones et traceurs de démo : constantes en haut de `app.js`.
- Mentions légales : complétez le texte dans `app.js` (objet `LEGAL`) avec les informations de votre structure.

## Limites et production

- La simulation est locale ; pour du suivi réel, branchez une source (voir ci-dessus).
- Le `localStorage` est limité (~5 Mo) et propre à chaque navigateur.
- Les tuiles `tile.openstreetmap.org` sont réservées à un usage modéré ; en production à fort trafic, utilisez un fournisseur de tuiles dédié.
- Le formulaire de contact enregistre localement : branchez Formspree, Cloudflare Workers ou votre API.

Cartes © contributeurs [OpenStreetMap](https://www.openstreetmap.org/copyright), tuiles © [CARTO](https://carto.com/attributions), bibliothèque [Leaflet](https://leafletjs.com).
