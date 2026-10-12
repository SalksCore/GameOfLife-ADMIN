import { request } from './api';

export interface PlayerRow {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string;
  gamesPlayed: number;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  bannedAt: string | null;
  bannedReason: string | null;
  online?: boolean;
}

export interface PlayerProfile {
  player: PlayerRow & { notes: string; createdBy: string | null };
  presence: { online: boolean; room: { id: string; code: string; name: string; phase: 'lobby' | 'playing' | 'ended' } | null };
  activeSessions: number;
  stats: {
    gamesPlayed: number;
    gamesLast30Days: number;
    firstGameAt: string | null;
    lastGameAt: string | null;
    averageMinutes: number;
  };
  games: { id: string; code: string; name: string; playerCount: number; startedAt: string; endedAt: string }[];
  logins: { at: string; ip: string | null; userAgent: string | null }[];
  moderation: { id: string; action: string; details: string | null; admin: string | null; createdAt: string }[];
}

export interface Credentials {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
}

export const playersApi = {
  get: (id: string) => request<PlayerProfile>('GET', `/api/admin/players/${id}`),
  update: (id: string, patch: Partial<Pick<PlayerRow, 'firstName' | 'lastName'>> & { notes?: string }) =>
    request<{ player: PlayerProfile['player'] }>('PATCH', `/api/admin/players/${id}`, patch),
  resetPassword: (id: string) =>
    request<{ credentials: { username: string; password: string } }>('POST', `/api/admin/players/${id}/reset-password`, {}),
  revokeSessions: (id: string) => request('POST', `/api/admin/players/${id}/revoke-sessions`, {}),
  ban: (id: string, banned: boolean, reason?: string) =>
    request<{ player: PlayerRow }>('POST', `/api/admin/players/${id}/ban`, { banned, reason }),
  remove: (id: string) => request('DELETE', `/api/admin/players/${id}`),
};

/** Libellés des actions du journal */
export const ACTION_LABELS: Record<string, { label: string; tone: 'ok' | 'info' | 'warning' | 'danger' }> = {
  'player.create': { label: 'Compte créé', tone: 'ok' },
  'player.rename': { label: 'Nom modifié', tone: 'info' },
  'player.notes': { label: 'Notes modifiées', tone: 'info' },
  'player.reset-password': { label: 'Nouveau mot de passe', tone: 'info' },
  'player.logout': { label: 'Déconnecté partout', tone: 'warning' },
  'player.ban': { label: 'Suspension', tone: 'danger' },
  'player.unban': { label: 'Réactivation', tone: 'ok' },
  'player.kick': { label: 'Retiré d’une partie', tone: 'warning' },
  'player.delete': { label: 'Compte supprimé', tone: 'danger' },
  'room.create': { label: 'Partie créée', tone: 'ok' },
  'room.start': { label: 'Partie lancée', tone: 'info' },
  'room.end': { label: 'Partie terminée', tone: 'info' },
  'room.close': { label: 'Partie fermée', tone: 'warning' },
  'settings.update': { label: 'Paramètres modifiés', tone: 'info' },
  'maintenance.on': { label: 'Maintenance activée', tone: 'danger' },
  'maintenance.off': { label: 'Maintenance terminée', tone: 'ok' },
  'maintenance.update': { label: 'Message de maintenance', tone: 'info' },
};

/** "Mozilla/5.0 (iPhone; …) Safari" -> "Safari · iPhone" */
export function describeDevice(ua: string | null): string {
  if (!ua) return 'Inconnu';
  const os = /iPhone|iPad/.test(ua)
    ? 'iPhone/iPad'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Autre';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Navigateur inconnu';
  return `${browser} · ${os}`;
}

export function relativeTime(iso: string | null): string {
  if (!iso) return 'Jamais';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'À l’instant';
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Il y a ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `Il y a ${d} j`;
  return new Date(iso).toLocaleDateString('fr-FR');
}
