import { useEffect } from 'react';
import { useParams } from 'react-router';
import { Screen } from '../components/screen/Screen';
import { useLive } from '../lib/admin-socket';
import { useLiveRoom } from '../lib/live-room';

/** Ouvre l'écran projeté dans une fenêtre à part (à glisser sur le vidéoprojecteur) */
export const openProjector = (roomId: string) => window.open(`/ecran/${roomId}`, `gol-screen-${roomId}`, 'popup,width=1280,height=720');

/** Écran projeté seul, plein cadre (fenêtre du vidéoprojecteur) */
export function ProjectorPage() {
  const { id } = useParams();
  const { live, offset, missing } = useLiveRoom(id);
  const { call } = useLive();
  const started = !!live && live.screen.phase !== 'lobby';

  // Une télécommande de présentation (→ et ←) fonctionne aussi depuis la fenêtre projetée
  useEffect(() => {
    if (!id || !started) return;
    const onKey = (e: KeyboardEvent) => {
      const action =
        e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' '
          ? 'next'
          : e.key === 'ArrowLeft' || e.key === 'PageUp'
            ? 'prev'
            : e.key === 'r' || e.key === 'R'
              ? 'reveal'
              : null;
      if (e.key === 'f' && !e.ctrlKey) void document.documentElement.requestFullscreen?.().catch(() => {});
      if (!action) return;
      e.preventDefault();
      void call('admin:deck', { roomId: id, action });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [id, started, call]);

  if (missing) return <div className="projector-msg">Partie introuvable</div>;
  if (!live) return <div className="projector-msg">Connexion…</div>;
  return (
    <div className="projector" onDoubleClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})}>
      <div className="scr-frame fullscreen">
        <Screen view={live.screen} offset={offset} />
      </div>
    </div>
  );
}
