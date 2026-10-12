/**
 * Client HTTP de l'API.
 * - Access token (15 min) gardé uniquement en mémoire (jamais dans localStorage -> pas volable par XSS persistant)
 * - Refresh token dans un cookie httpOnly géré par le navigateur
 */

/** Compte ADMIN (table séparée des joueurs : un compte joueur ne peut pas se connecter ici) */
export interface User {
  id: string;
  username: string;
  lastLoginAt: string | null;
}

interface Session {
  accessToken: string;
  account: User;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const BASE = import.meta.env.VITE_API_URL ?? '';
// Routes de session propres aux admins (cookie distinct de celui des joueurs)
const AUTH = '/api/admin/auth';
const HEADERS = { 'Content-Type': 'application/json', 'X-Requested-With': 'GameOfLife' };

let accessToken: string | null = null;
let expiresAt = 0;
let refreshing: Promise<User | null> | null = null;
const listeners = new Set<(user: User | null) => void>();

export function onSessionChange(fn: (user: User | null) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setSession(session: Session | null) {
  accessToken = session?.accessToken ?? null;
  expiresAt = session ? readExp(session.accessToken) : 0;
  listeners.forEach((fn) => fn(session?.account ?? null));
}

function readExp(jwt: string): number {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

async function post<T>(path: string, body: unknown = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'POST',
    credentials: 'include',
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Erreur réseau');
  return data as T;
}

/** Renouvelle la session via le cookie (requêtes simultanées mutualisées). */
export function refreshSession(): Promise<User | null> {
  // Un autre onglet a pu renouveler le cookie au même instant : un second essai suffit alors
  const attempt = () => post<Session>(AUTH + '/refresh');
  refreshing ??= attempt()
    .catch(async (err) => {
      if (!(err instanceof ApiError && err.status === 401)) throw err;
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));
      return attempt();
    })
    .then((s) => {
      setSession(s);
      return s.account;
    })
    .catch((err) => {
      if (err instanceof ApiError && err.status === 401) setSession(null);
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Token valide pour au moins 30 s, renouvelé si nécessaire. */
export async function getAccessToken(): Promise<string | null> {
  if (accessToken && expiresAt - Date.now() > 30_000) return accessToken;
  await refreshSession();
  return accessToken;
}

export async function login(username: string, password: string): Promise<User> {
  const s = await post<Session>(AUTH + '/login', { username, password });
  setSession(s);
  return s.account;
}

export async function logout(): Promise<void> {
  try {
    await post(AUTH + '/logout');
  } finally {
    setSession(null);
  }
}

/** Requête authentifiée, avec un nouvel essai après renouvellement si le token a expiré. */
export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getAccessToken();
    if (!token) throw new ApiError(401, 'Non authentifié');
    const res = await fetch(BASE + path, {
      method,
      credentials: 'include',
      headers:
        body === undefined
          ? { 'X-Requested-With': 'GameOfLife', Authorization: `Bearer ${token}` }
          : { ...HEADERS, Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 401 && attempt === 0) {
      accessToken = null;
      continue;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data.error ?? 'Erreur réseau');
    return data as T;
  }
  throw new ApiError(401, 'Non authentifié');
}
