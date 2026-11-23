/**
 * Textes légaux (dossier de conception, onglet « Légal », L1 à L4 et L6).
 * Ce fichier est identique dans PHONE et ADMIN (src/legal.ts) : toute modification doit être reportée dans les deux.
 */

export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; head: string[]; rows: string[][] };

export interface LegalPage {
  id: LegalId;
  title: string;
  short: string;
  blocks: LegalBlock[];
}

export type LegalId = 'mentions' | 'confidentialite' | 'cookies' | 'cgu';

export const CONTACT = 'salks.pro@gmail.com';
export const UPDATED = '22 novembre 2026';

/** Information des joueurs, à lire avant la connexion (L6) */
export const PLAYER_NOTICE = [
  'Ton compte contient ton prénom et ton nom, rien d’autre. La famille que tu vas jouer est tirée au hasard : elle n’a aucun lien avec ta vraie famille. Les sondages sont anonymes.',
  'Le jeu est volontairement injuste : c’est le sujet de l’exposé. Rien n’est noté, rien n’est envoyé au prof.',
  `Tu ne veux pas que ton nom soit enregistré ? Dis-le aux orateurs : tu joueras avec un pseudo au hasard. Tout est supprimé 3 mois après la partie. Questions : ${CONTACT}.`,
];

export const LEGAL: LegalPage[] = [
  {
    id: 'mentions',
    title: 'Mentions légales',
    short: 'Mentions légales',
    blocks: [
      {
        type: 'table',
        head: ['Rubrique', 'Contenu'],
        rows: [
          ['Éditeur', `Dahrel FAMIBELLE, particulier (développeur à titre personnel). Contact : ${CONTACT}`],
          ['Directeur de la publication', 'Dahrel FAMIBELLE'],
          ['Hébergement des sites (jeu, admin)', 'Vercel Inc. [adresse à compléter], États-Unis (fichiers statiques des sites, réseau de diffusion)'],
          ['Hébergement du serveur (API)', 'Oracle Cloud Infrastructure, Oracle Corporation [adresse à compléter], région Marseille, France'],
          ['Base de données', 'PostgreSQL sur le même serveur Oracle Cloud Infrastructure, région Marseille, France'],
          [
            'Propriété intellectuelle',
            'Le code, les textes, les règles du jeu, les illustrations et le logo GameOfLife sont la propriété de Dahrel FAMIBELLE (© 2026). Toute reproduction sans autorisation est interdite. Polices Bricolage Grotesque et DM Sans (licence SIL Open Font License). Les chiffres réels cités appartiennent à leurs sources (Insee, DEPP, France Stratégie, Dares, OVE).',
          ],
          ['Données personnelles', 'Voir la politique de confidentialité et la politique de cookies.'],
        ],
      },
    ],
  },
  {
    id: 'confidentialite',
    title: 'Politique de confidentialité',
    short: 'Confidentialité',
    blocks: [
      { type: 'p', text: `Dernière mise à jour : ${UPDATED}. Cette politique explique quelles données GameOfLife enregistre, pourquoi, combien de temps, et comment exercer vos droits.` },
      { type: 'h', text: '1 · Responsable du traitement' },
      { type: 'p', text: `Le responsable du traitement est Dahrel FAMIBELLE, développeur et éditeur de GameOfLife, agissant à titre personnel. Contact : ${CONTACT}.` },
      { type: 'h', text: '2 · Personnes concernées' },
      { type: 'p', text: 'Les joueurs (élèves du groupe Classe 1A_GR2, tous âgés de plus de 16 ans) et les deux orateurs qui utilisent le panneau admin (le développeur et le co-orateur).' },
      { type: 'h', text: '3 · Données enregistrées' },
      {
        type: 'table',
        head: ['Catégorie', 'Données', 'Origine'],
        rows: [
          ['Compte joueur', 'Prénom, nom (ou pseudonyme aléatoire), identifiant généré, empreinte du mot de passe, avatar, couleur, nombre de parties, dates de création et de dernière connexion', 'Saisi par le développeur à partir de la liste du groupe ; avatar choisi par le joueur'],
          ['Connexions', 'Date, adresse IP, navigateur et appareil de chaque connexion réussie', 'Automatique'],
          ['Sessions', 'Empreinte du jeton de session, date d’expiration', 'Automatique'],
          ['Parties', 'Code, nom, date, nombre et liste des participants', 'Automatique'],
          ['Modération', 'Suspension et son motif, notes internes, journal des actions d’admin', 'Saisi par un admin'],
          ['Comptes admin', 'Pseudo, empreinte du mot de passe, dernière connexion', 'Développeur'],
        ],
      },
      { type: 'p', text: 'Ne sont jamais enregistrés : le mot de passe en clair, les réponses aux sondages (anonymes, gardées seulement le temps de la partie), le détail des choix de jeu, les messages du chat, les réglages d’affichage (gardés sur le téléphone).' },
      { type: 'p', text: 'La « classe sociale » du jeu est tirée au hasard : elle ne dit rien de la famille réelle du joueur. GameOfLife ne collecte aucune donnée sensible (santé, origine, opinions, religion).' },
      { type: 'h', text: '4 · Option anonyme' },
      { type: 'p', text: 'Un élève qui ne veut pas que son nom soit enregistré le dit avant la partie, oralement ou par mail. Son compte est alors créé avec un pseudonyme tiré au hasard (ex. « Renard 42 ») : aucun prénom ni nom n’est enregistré, et il joue normalement. Il peut aussi jouer en binôme sur le téléphone d’un camarade.' },
      { type: 'h', text: '5 · Finalités et base légale' },
      {
        type: 'table',
        head: ['Finalité', 'Base légale (article 6 du RGPD)'],
        rows: [
          ['Permettre au groupe de jouer pendant l’exposé', 'Intérêt légitime du responsable : faire vivre un exposé pédagogique interactif. Les joueurs sont informés le jour même et peuvent choisir l’option anonyme.'],
          ['Sécuriser le service (connexions, sessions, suspensions, journal)', 'Intérêt légitime : protéger les comptes et le service.'],
          ['Mesurer la fréquentation (sans nom)', 'Intérêt légitime.'],
        ],
      },
      { type: 'p', text: 'Aucune donnée n’est utilisée pour de la publicité, du profilage, une note scolaire ou une décision qui produirait des effets sur l’élève.' },
      { type: 'h', text: '6 · Durée de conservation' },
      {
        type: 'table',
        head: ['Données', 'Durée'],
        rows: [
          ['Comptes joueurs, parties, historique des connexions, notes internes', 'Supprimés automatiquement 3 mois après la partie'],
          ['Sessions', '30 jours (joueurs), 12 heures (admins), puis expirées automatiquement'],
          ['Journal des actions d’admin', '3 mois'],
          ['Accès admin du co-orateur', 'Supprimé le jour de la fin de l’exposé'],
          ['Statistiques sans nom', 'Conservées : elles ne permettent d’identifier personne'],
        ],
      },
      { type: 'h', text: '7 · Qui voit les données' },
      { type: 'p', text: 'Seuls le développeur et le co-orateur (comptes admin) ont accès aux comptes. Les autres joueurs voient seulement le nom en jeu et l’avatar pendant la partie. Le professeur et le lycée n’ont aucun accès. Aucune donnée n’est vendue ni transmise à un tiers.' },
      { type: 'h', text: '8 · Hébergeurs (sous-traitants)' },
      {
        type: 'table',
        head: ['Prestataire', 'Rôle', 'Lieu des serveurs'],
        rows: [
          ['Vercel Inc.', 'Sites du jeu et de l’admin (fichiers statiques, réseau de diffusion)', 'Réseau mondial ; société aux États-Unis'],
          ['Oracle Cloud Infrastructure', 'Serveur de l’API (temps réel)', 'Marseille, France'],
          ['Oracle Cloud Infrastructure', 'Base de données (PostgreSQL), sauvegardée chaque nuit sur le même serveur', 'Marseille, France'],
        ],
      },
      { type: 'p', text: 'Les données des joueurs (comptes, connexions, parties) sont stockées en France, sur le serveur Oracle de Marseille. Les sites eux-mêmes sont servis par Vercel, société américaine, qui ne reçoit pas les données des comptes mais voit passer les connexions aux pages : cet accès est encadré par le cadre de protection des données UE-États-Unis ou par les clauses contractuelles types de la Commission européenne prévues dans ses conditions.' },
      { type: 'h', text: '9 · Sécurité' },
      {
        type: 'list',
        items: [
          'Mots de passe chiffrés (empreinte) : personne ne peut les lire, pas même l’admin.',
          'Session par cookie sécurisé, inaccessible aux scripts de la page ; jeton d’accès de 15 minutes gardé en mémoire.',
          'Pas d’inscription libre : seuls les admins créent les comptes. Tentatives de connexion limitées.',
          'Connexions chiffrées (HTTPS), en-têtes de sécurité, origines autorisées limitées.',
          'Toute action d’admin est inscrite au journal.',
        ],
      },
      { type: 'h', text: '10 · Vos droits' },
      { type: 'p', text: `Vous pouvez demander l’accès à vos données, leur correction, leur suppression, la limitation de leur utilisation, leur portabilité, ou vous opposer à leur traitement. Écrivez à ${CONTACT} en précisant votre identifiant. Réponse sous un mois au plus. Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la CNIL (www.cnil.fr).` },
      { type: 'h', text: '11 · Fuite de données' },
      { type: 'p', text: 'En cas de fuite de données, le responsable prévient les joueurs concernés et, si nécessaire, la CNIL dans les 72 heures.' },
    ],
  },
  {
    id: 'cookies',
    title: 'Politique de cookies',
    short: 'Cookies',
    blocks: [
      { type: 'p', text: 'GameOfLife n’utilise que ce qui est strictement nécessaire pour vous garder connecté. Aucun cookie publicitaire, aucune mesure d’audience, aucun réseau social.' },
      {
        type: 'table',
        head: ['Nom', 'Type', 'Rôle', 'Durée'],
        rows: [
          ['gol_player_rt', 'Cookie (jeu)', 'Garde le joueur connecté sur son téléphone', '30 jours'],
          ['gol_admin_rt', 'Cookie (admin)', 'Garde l’admin connecté', '12 heures'],
          ['gol.prefs', 'Stockage local (jeu)', 'Langue, mode daltonien, économie d’énergie', 'Jusqu’à effacement'],
          ['Adresse du jeu', 'Stockage local (admin)', 'Adresse affichée sur l’écran projeté', 'Jusqu’à effacement'],
        ],
      },
      { type: 'p', text: 'Ces éléments sont strictement nécessaires au service : la loi n’impose donc pas de bandeau de consentement. Les cookies de session sont protégés (non lisibles par les scripts, envoyés uniquement en HTTPS). Vous pouvez les effacer à tout moment dans votre navigateur ; vous serez simplement déconnecté.' },
    ],
  },
  {
    id: 'cgu',
    title: 'Conditions générales d’utilisation',
    short: 'CGU',
    blocks: [
      { type: 'p', text: `Dernière mise à jour : ${UPDATED}. En se connectant, le joueur accepte ces conditions.` },
      { type: 'h', text: '1 · Objet' },
      { type: 'p', text: 'GameOfLife est un jeu pédagogique édité par Dahrel FAMIBELLE. Il sert à un exposé sur l’égalité des chances présenté au groupe Classe 1A_GR2. Il est gratuit et sans publicité.' },
      { type: 'h', text: '2 · Accès' },
      { type: 'p', text: 'Le jeu est accessible sur invitation. Les identifiants sont personnels et remis par les orateurs ; ils ne doivent pas être partagés. Un élève sans téléphone joue en binôme. Un élève qui le souhaite joue avec un pseudonyme aléatoire (option anonyme).' },
      { type: 'h', text: '3 · Un jeu volontairement inégal' },
      { type: 'p', text: 'Le jeu est déséquilibré exprès : c’est son sujet. La famille de départ est tirée au hasard et donne plus ou moins de ressources. Les règles, les probabilités et les chiffres sont décrits dans le dossier de conception.' },
      { type: 'p', text: 'Pour les besoins de l’exposé, les orateurs peuvent intervenir pendant la partie : imposer une famille, former un binôme, donner ou retirer de l’argent dans le jeu, déclencher un événement collectif, mettre en pause ou retirer un joueur. Ces interventions servent uniquement la démonstration. Le résultat d’un joueur ne dit rien de sa valeur, n’est pas noté et n’est jamais transmis au professeur.' },
      { type: 'h', text: '4 · Comportement' },
      { type: 'p', text: 'Le nom en jeu et le chat doivent rester respectueux. En cas d’abus, un admin peut retirer un joueur de la partie ou suspendre son compte.' },
      { type: 'h', text: '5 · Contenu' },
      { type: 'p', text: 'Les situations du jeu sont fictives et simplifiées. Les chiffres réels affichés viennent de sources publiques citées (Insee, DEPP, France Stratégie, Dares, OVE).' },
      { type: 'h', text: '6 · Disponibilité' },
      { type: 'p', text: 'Le service est fourni sans garantie de disponibilité. Une maintenance ou un incident peut l’interrompre ; l’exposé dispose d’une version de secours.' },
      { type: 'h', text: '7 · Propriété' },
      { type: 'p', text: 'Le jeu et ses contenus appartiennent à Dahrel FAMIBELLE (voir les mentions légales). Les captures d’écran pour un usage scolaire sont autorisées.' },
      { type: 'h', text: '8 · Données personnelles' },
      { type: 'p', text: 'Voir la politique de confidentialité et la politique de cookies.' },
      { type: 'h', text: '9 · Fin du service' },
      { type: 'p', text: 'Les comptes sont supprimés 3 mois après la partie. Le jeu peut ensuite être fermé ou réutilisé pour une autre présentation, avec de nouveaux comptes.' },
      { type: 'h', text: '10 · Contact' },
      { type: 'p', text: CONTACT },
    ],
  },
];
