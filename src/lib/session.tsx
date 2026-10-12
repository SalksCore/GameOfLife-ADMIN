import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { onSessionChange, refreshSession, type User } from './api';

interface SessionState {
  user: User | null;
  ready: boolean;
}

const SessionContext = createContext<SessionState>({ user: null, ready: false });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ user: null, ready: false });

  useEffect(() => {
    const off = onSessionChange((user) => setState({ user, ready: true }));
    // Restaure la session au chargement grâce au cookie httpOnly
    refreshSession().then((user) => setState({ user, ready: true }));
    return off;
  }, []);

  return <SessionContext value={state}>{children}</SessionContext>;
}

export const useSession = () => use(SessionContext);
