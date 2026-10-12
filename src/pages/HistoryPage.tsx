import { Fragment, useEffect, useState } from 'react';
import { fmtDate, PageHeader } from '../components/ui';
import { request } from '../lib/api';

interface Game {
  id: string;
  code: string;
  name: string;
  playerCount: number;
  startedAt: string;
  endedAt: string;
  createdBy: string | null;
}

interface GamePlayer {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
}

/** Parties terminées et sauvegardées. */
export function HistoryPage() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [open, setOpen] = useState<{ id: string; players: GamePlayer[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    request<Game[]>('GET', '/api/admin/games')
      .then(setGames)
      .catch((err: Error) => setError(err.message));
  }, []);

  async function toggle(id: string) {
    if (open?.id === id) return setOpen(null);
    try {
      setOpen({ id, players: await request<GamePlayer[]>('GET', `/api/admin/games/${id}/players`) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }

  return (
    <>
      <PageHeader title="Historique" subtitle="Les 50 dernières parties terminées" />
      {error && <div className="alert alert-error">{error}</div>}
      <section className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Partie</th>
              <th>Code</th>
              <th className="num">Joueurs</th>
              <th>Début</th>
              <th className="num">Durée</th>
              <th>Créée par</th>
            </tr>
          </thead>
          <tbody>
            {games?.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  Aucune partie terminée pour le moment.
                </td>
              </tr>
            )}
            {games?.map((g) => (
              <Fragment key={g.id}>
                <tr className={open?.id === g.id ? 'row-open' : undefined}>
                  <td>
                    <button className="link" onClick={() => void toggle(g.id)} aria-expanded={open?.id === g.id}>
                      <span className={`chevron${open?.id === g.id ? ' open' : ''}`}>›</span> {g.name}
                    </button>
                  </td>
                  <td>
                    <code className="code">{g.code}</code>
                  </td>
                  <td className="num">{g.playerCount}</td>
                  <td>{fmtDate.format(new Date(g.startedAt))}</td>
                  <td className="num">
                    {Math.max(1, Math.round((Date.parse(g.endedAt) - Date.parse(g.startedAt)) / 60_000))} min
                  </td>
                  <td className="text-muted">{g.createdBy ?? '—'}</td>
                </tr>
                {open?.id === g.id && (
                  <tr className="row-detail">
                    <td colSpan={6}>
                      <ul className="player-list">
                        {open.players.map((p) => (
                          <li key={p.id}>
                            <span className="strong">
                              {p.firstName} {p.lastName}
                            </span>
                            <span className="text-muted">{p.username}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
