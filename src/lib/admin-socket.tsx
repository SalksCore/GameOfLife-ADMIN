import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Ack, AdminClientToServerEvents, AdminRoom, AdminServerToClientEvents, AdminStats } from '../protocol';
import { getAccessToken, logout, refreshSession } from './api';

export type AdminSocket = Socket<AdminServerToClientEvents, AdminClientToServerEvents>;

interface Live {
  online: boolean;
  error: string | null;
  stats: AdminStats | null;
  /** Parties ouvertes, tenues à jour en temps réel */
  rooms: AdminRoom[];
  call: <T = undefined>(event: keyof AdminClientToServerEvents, ...args: unknown[]) => Promise<Ack<T>>;
}

const LiveContext = createContext<Live | null>(null);

/** Connexion temps réel au namespace /admin (refusée si le token n'est pas un token admin). */
export function LiveProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<AdminSocket | null>(null);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [rooms, setRooms] = useState<AdminRoom[]>([]);

  useEffect(() => {
    const s: AdminSocket = io(`${import.meta.env.VITE_API_URL ?? ''}/admin`, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: (cb) => void getAccessToken().then((token) => cb({ token })),
    });

    const loadRooms = () =>
      s
        .timeout(5_000)
        .emitWithAck('admin:rooms')
        .then((res) => res.ok && setRooms(res.data))
        .catch(() => {});

    s.on('connect', () => {
      setOnline(true);
      setError(null);
      void loadRooms();
    });
    s.on('disconnect', () => setOnline(false));
    s.on('connect_error', async () => {
      setOnline(false);
      setError('Connexion temps réel impossible, nouvel essai…');
      // Token expiré ou révoqué : renouvellement, sinon retour à la connexion
      if (!(await refreshSession())) void logout();
    });
    s.on('admin:stats', setStats);
    s.on('admin:roomsChanged', () => void loadRooms());

    setSocket(s);
    return () => {
      s.removeAllListeners();
      s.disconnect();
    };
  }, []);

  const call = useCallback(
    async (event: keyof AdminClientToServerEvents, ...args: unknown[]) => {
      if (!socket?.connected) return { ok: false, error: 'Hors ligne' };
      try {
        // emitWithAck n'est pas typé pour un nom d'événement générique
        return await (socket.timeout(5_000) as any).emitWithAck(event, ...args);
      } catch {
        return { ok: false, error: 'Le serveur ne répond pas' };
      }
    },
    [socket],
  ) as Live['call'];

  const value = useMemo(() => ({ online, error, stats, rooms, call }), [online, error, stats, rooms, call]);
  return <LiveContext value={value}>{children}</LiveContext>;
}

export function useLive(): Live {
  const ctx = use(LiveContext);
  if (!ctx) throw new Error('useLive doit être utilisé dans <LiveProvider>');
  return ctx;
}
