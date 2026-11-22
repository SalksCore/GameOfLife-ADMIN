import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { StreamDeck, useDeckPages } from '../components/StreamDeck';
import { useLive } from '../lib/admin-socket';
import { useLiveRoom } from '../lib/live-room';
import type { LiveRoom } from '../protocol';

/** Ouvre le Stream Deck dans un onglet (à afficher sur une tablette, ou à côté de la régie) */
export const openDeck = (roomId: string) => window.open(`/deck/${roomId}`, `gol-deck-${roomId}`);

/** Stream Deck plein écran : télécommande tactile de la régie */
export function DeckPage() {
  const { id } = useParams();
  const { live, offset, missing } = useLiveRoom(id);
  if (missing)
    return (
      <div className="rg-empty">
        <p>Cette partie n’existe plus.</p>
        <Link to="/parties">Retour aux parties</Link>
      </div>
    );
  if (!live) return <div className="rg-empty">Connexion à la partie…</div>;
  return <Deck live={live} offset={offset} />;
}

function Deck({ live, offset }: { live: LiveRoom; offset: number }) {
  const { online } = useLive();
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    document.title = `Stream Deck · ${live.screen.name}`;
  }, [live.screen.name]);
  useEffect(() => {
    if (!toast && !error) return;
    const t = setTimeout(() => {
      setToast(null);
      setError(null);
    }, 2_500);
    return () => clearTimeout(t);
  }, [toast, error]);
  const pages = useDeckPages(live, offset, { notify: setToast, onError: setError });
  const step = live.control.deck[live.control.cursor];
  const cols = typeof window !== 'undefined' && window.innerWidth < 700 ? 3 : 5;
  return (
    <div className="sd-page">
      <header className="sd-top">
        <span className={`rg-dot ${online ? 'on' : 'off'}`} />
        <strong>{live.screen.name}</strong>
        <span className="sd-top-step">{step ? `${live.control.cursor + 1}/${live.control.deck.length} · ${step.title}` : 'Salle d’attente'}</span>
        {toast && <span className="rg-toast">{toast}</span>}
        {error && <span className="sd-err">{error}</span>}
      </header>
      <StreamDeck pages={pages} cols={cols} big />
    </div>
  );
}
