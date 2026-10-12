import { Icon, PageHeader, PhaseBadge, type IconName } from '../components/ui';
import { useLive } from '../lib/admin-socket';
import { Link, useNavigate } from 'react-router';

function formatUptime(sec: number) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d ? `${d} j ${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

function Stat({ icon, label, value, tone }: { icon: IconName; label: string; value: string | number; tone: string }) {
  return (
    <div className="card stat-card">
      <div className={`stat-icon tone-${tone}`}>
        <Icon name={icon} size={22} />
      </div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { stats, rooms } = useLive();
  const s = stats;

  return (
    <>
      <PageHeader title="Tableau de bord" subtitle="Activité du serveur en temps réel" />

      {s?.maintenance && (
        <div className="alert alert-warning banner-row">
          <span>
            <strong>Mode maintenance actif</strong> : les joueurs ne peuvent pas se connecter.
          </span>
          <Link className="btn btn-sm" to="/maintenance">
            Gérer
          </Link>
        </div>
      )}

      <div className="stat-grid">
        <Stat icon="players" label="Joueurs connectés" value={s?.connectedPlayers ?? '—'} tone="blue" />
        <Stat icon="games" label="Parties ouvertes" value={s?.rooms ?? '—'} tone="indigo" />
        <Stat icon="play" label="Parties en cours" value={s?.gamesInProgress ?? '—'} tone="green" />
        <Stat
          icon="dashboard"
          label="Serveur"
          value={s ? `${s.memoryMb} Mo · ${formatUptime(s.uptimeSec)}` : '—'}
          tone="slate"
        />
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Parties ouvertes</h2>
          <Link className="btn btn-primary btn-sm" to="/parties">
            <Icon name="plus" size={16} /> Nouvelle partie
          </Link>
        </div>
        {rooms.length === 0 ? (
          <p className="empty">Aucune partie ouverte pour le moment.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Partie</th>
                <th>Code</th>
                <th>Statut</th>
                <th className="num">Joueurs</th>
              </tr>
            </thead>
            <tbody>
              {rooms.slice(0, 8).map((r) => (
                <tr key={r.id} className="clickable" onClick={() => navigate('/parties')}>
                  <td className="strong">{r.name}</td>
                  <td>
                    <code className="code">{r.code}</code>
                  </td>
                  <td>
                    <PhaseBadge phase={r.phase} />
                  </td>
                  <td className="num">
                    {r.players.length}/{r.maxPlayers}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
