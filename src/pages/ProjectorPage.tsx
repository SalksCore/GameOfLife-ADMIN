import { useParams } from 'react-router';
import { Screen } from '../components/screen/Screen';
import { useLiveRoom } from '../lib/live-room';

/** Ouvre l'écran projeté dans une fenêtre à part (à glisser sur le vidéoprojecteur) */
export const openProjector = (roomId: string) =>
  window.open(`/ecran/${roomId}`, `gol-screen-${roomId}`, 'popup,width=1280,height=720');

/** Écran projeté seul, plein cadre (fenêtre du vidéoprojecteur) */
export function ProjectorPage() {
  const { id } = useParams();
  const { live, offset, missing } = useLiveRoom(id);
  if (missing) return <div className="projector-msg">Partie introuvable</div>;
  if (!live) return <div className="projector-msg">Connexion…</div>;
  return (
    <div className="projector">
      <div className="scr-frame fullscreen">
        <Screen view={live.screen} offset={offset} />
      </div>
    </div>
  );
}
