# GameOfLife ADMIN

Panneau d'administration : sidebar bleu foncé, contenu clair.

| Page | Rôle |
|---|---|
| **Connexion** | Page dédiée, réservée aux comptes admin (table `admins`). Les comptes joueurs ne fonctionnent pas ici. |
| **Tableau de bord** (`/`) | Joueurs connectés, parties ouvertes et en cours, état du serveur, alerte si maintenance |
| **Parties** (`/parties`) | Créer une partie (le **code** s'affiche en grand), la lancer, la terminer (sauvegarde), la fermer, voir les joueurs et en retirer |
| **Statistiques** (`/statistiques`) | Indicateurs sur 7, 30 ou 90 jours ; graphiques (parties par jour, joueurs actifs, pic de connectés, nouveaux comptes) ; joueurs les plus actifs ; tableau de données |
| **Joueurs** (`/joueurs`) | Recherche (nom, prénom, identifiant), filtres (actifs, suspendus, jamais connectés), tri, joueurs en ligne ; création unitaire ou **en masse** (copier-coller d'une liste, export CSV des identifiants). L'identifiant (`djean`) et le mot de passe sont générés et affichés **une seule fois**. |
| **Profil joueur** (`/joueurs/:id`) | Identité, présence (en ligne, dans quelle partie), statistiques, parties jouées, connexions récentes (date, appareil, IP), historique de modération, notes internes. Actions : modifier le nom, nouveau mot de passe, déconnecter partout, suspendre (avec motif) ou réactiver, supprimer (confirmation par saisie de l'identifiant). |
| **Historique** (`/historique`) | Parties terminées, avec leurs participants |
| **Maintenance** (`/maintenance`) | Activer ou désactiver, message et heure de retour, aperçu de l'écran vu par les joueurs |
| **Paramètres** (`/parametres`) | Nom du jeu, message d'accueil, valeurs par défaut des parties, limites, chat |
| **Journal** (`/journal`) | Toutes les actions d'administration, filtrables, avec lien vers le joueur concerné |

**Stack** : React 19 · Vite · TypeScript · socket.io-client (namespace `/admin`). Aucune librairie d'interface : les icônes sont en SVG inline et les modales utilisent `<dialog>`.

## Démarrage

```bash
npm install
npm run dev      # http://localhost:5174 (l'API doit tourner sur :3000)
npm run build
```

En production, le serveur web doit renvoyer `index.html` pour toutes les routes (ex. nginx : `try_files $uri /index.html;`).

Le premier compte admin se crée côté API, serveur arrêté : `npm run admin:create -- <identifiant> <motdepasse>`. Relancer la commande sur un admin existant réinitialise son mot de passe et coupe ses sessions.

## Structure

```
src/
  protocol.ts            COPIE du contrat de l'API : à garder synchronisée
  lib/api.ts             client HTTP (routes /api/admin/auth, token en mémoire)
  lib/admin-socket.tsx   connexion temps réel : stats et parties tenues à jour automatiquement
  lib/players.ts         appels API joueurs, libellés du journal, formatage
  lib/settings.ts        appels API paramètres
  components/ui.tsx      icônes, modale, confirmation, bouton copier, badges
  components/charts.tsx  graphiques SVG (barres, courbe) sans dépendance
  pages/                 une page par route (react-router)
```

## Sécurité

- Tous les droits sont vérifiés **par l'API** : token admin exigé sur chaque route `/api/admin/*` et sur le namespace `/admin`, et compte admin relu en base à chaque requête.
- Sessions admin plus courtes que celles des joueurs (token de 10 min, session de 12 h), avec un cookie distinct.
- Mots de passe joueurs affichés une seule fois, jamais stockés en clair. L'impression ne sort que la fiche d'identifiants.
- Actions sensibles confirmées dans une fenêtre dédiée, et toutes journalisées.
- `noindex` et `no-referrer`. En production :
  - héberger sur un sous-domaine dédié (ex. `admin.exemple.com`), idéalement restreint par IP, VPN ou Cloudflare Access ;
  - appliquer les mêmes en-têtes de sécurité que PHONE.
