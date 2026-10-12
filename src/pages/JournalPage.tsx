import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../components/ui';
import { request } from '../lib/api';
import { ACTION_LABELS } from '../lib/players';

interface Action {
  id: string;
  admin: string | null;
  action: string;
  target: string | null;
  details: string | null;
  playerId: string | null;
  createdAt: string;
}

interface PageData {
  items: Action[];
  page: number;
  pageSize: number;
  total: number;
}

type Filter = '' | 'player' | 'room' | 'settings' | 'maintenance';

const FILTERS: { id: Filter; label: string }[] = [
  { id: '', label: 'Tout' },
  { id: 'player', label: 'Joueurs' },
  { id: 'room', label: 'Parties' },
  { id: 'settings', label: 'Paramètres' },
  { id: 'maintenance', label: 'Maintenance' },
];

const fmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });

/** Journal des actions d'administration */
export function JournalPage() {
  const [filter, setFilter] = useState<Filter>('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams({ page: String(page) });
    if (filter) qs.set('type', filter);
    request<PageData>('GET', `/api/admin/actions?${qs}`)
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, [filter, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader title="Journal" subtitle="Toutes les actions effectuées depuis l’administration" />
      {error && <div className="alert alert-error">{error}</div>}
      <section className="card">
        <div className="toolbar">
          <div className="tabs-inline" role="tablist">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => {
                  setFilter(f.id);
                  setPage(1);
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="text-muted">{data?.total ?? 0} action(s)</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Administrateur</th>
              <th>Action</th>
              <th>Cible</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={4} className="empty">
                  Aucune action enregistrée.
                </td>
              </tr>
            )}
            {data?.items.map((a) => {
              const info = ACTION_LABELS[a.action] ?? { label: a.action, tone: 'info' };
              const deleted = a.action === 'player.delete';
              return (
                <tr key={a.id}>
                  <td className="text-muted nowrap">{fmt.format(new Date(a.createdAt))}</td>
                  <td className="strong">{a.admin ?? '—'}</td>
                  <td>
                    <span className={`badge badge-${info.tone}`}>{info.label}</span>
                  </td>
                  <td>
                    {a.playerId && !deleted ? (
                      <Link className="link" to={`/joueurs/${a.playerId}`}>
                        {a.target ?? 'Voir le joueur'}
                      </Link>
                    ) : (
                      (a.target ?? '—')
                    )}
                    {a.details && <div className="text-muted small">{a.details}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pages > 1 && (
          <div className="pager">
            <span />
            <div className="pager-buttons">
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Précédent
              </button>
              <span>
                Page {page} / {pages}
              </span>
              <button className="btn btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Suivant
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
