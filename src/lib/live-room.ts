import { useEffect, useState } from 'react';
import type { LiveRoom } from '../protocol';
import { useLive } from './admin-socket';

/**
 * Suit une partie en temps réel (écran projeté + régie).
 * S'abonne à chaque (re)connexion et se désabonne en quittant la page.
 */
export function useLiveRoom(roomId: string | undefined) {
  const { socket, online } = useLive();
  const [live, setLive] = useState<LiveRoom | null>(null);
  const [offset, setOffset] = useState(0);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!socket || !roomId || !online) return;
    const onLive = (l: LiveRoom) => {
      if (l.roomId !== roomId) return;
      setOffset(l.screen.now - Date.now());
      setLive(l);
    };
    socket.on('admin:live', onLive);
    socket
      .timeout(5_000)
      .emitWithAck('admin:watch', { roomId })
      .then((res) => {
        if (res.ok) {
          setMissing(false);
          onLive(res.data);
        } else setMissing(true);
      })
      .catch(() => {});
    return () => {
      socket.off('admin:live', onLive);
      if (socket.connected) socket.emit('admin:unwatch', { roomId }, () => {});
    };
  }, [socket, roomId, online]);

  return { live, offset, missing };
}
