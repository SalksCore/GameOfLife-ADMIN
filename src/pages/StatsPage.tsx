import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { BarChart, DataTable, LineChart, type Point } from '../components/charts';
import { Icon, PageHeader, type IconName } from '../components/ui';
import { request } from '../lib/api';

interface Stats {
  days: number;
  totals: {
    players: number;
    activePlayers7d: number;
    suspended: number;
    neverLoggedIn: number;
    games: number;
    participations: number;
    avgPlayersPerGame: number;
    avgGameMinutes: number;
    peakConcurrent: number;
  };
  daily: { day: string; games: number; participations: number; newPlayers: number; activePlayers: number }[];
  concurrency: { bucket: string; peak: number; games: number }[];
  topPlayers: { id: string; username: string; displayName: string; firstName: string; lastName: string; games: number }[];
  live: { connectedPlayers: number; gamesInProgress: number };
}

const PERIODS = [7, 30, 90] as const;
const shortDay = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const longDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const hourFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

function Kpi({ icon, label, value, hint }: { icon: IconName; label: string; value: string | number; hint?: string }) {
  return (
    <div className="card kpi">
      <div className="kpi-head">
        <Icon name={icon} size={18} />
        {label}
      </div>
      <div className="kpi-value">{value}</div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="card chart-card">
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="text-muted small">{subtitle}</p>}
        </div>
      </div>
      <div className="chart-body">{children}</div>
    </section>
  );
}

/** Statistiques de fréquentation et d'activité */
export function StatsPage() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    request<Stats>('GET', `/api/admin/stats?days=${days}`)
      .then((s) => !cancelled && setStats(s))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [days]);

  const series = (key: 'games' | 'activePlayers' | 'newPlayers'): Point[] =>
    stats?.daily.map((d) => {
      const date = new Date(`${d.day}T00:00:00Z`);
      return { label: shortDay.format(date), title: longDay.format(date), value: d[key] };
    }) ?? [];

  const concurrency: Point[] =
    stats?.concurrency.map((c) => {
      const date = new Date(`${c.bucket}:00Z`);
      return {
        label: days <= 7 ? hourFmt.format(date) : shortDay.format(date),
        title: days <= 7 ? hourFmt.format(date) : longDay.format(date),
        value: c.peak,
      };
    }) ?? [];

  const t = stats?.totals;

  return (
    <>
      <PageHeader
        title="Statistiques"
        subtitle="Fréquentation et activité du jeu"
        actions={
          <div className="segmented" role="group" aria-label="Période">
            {PERIODS.map((p) => (
              <button key={p} aria-pressed={days === p} onClick={() => setDays(p)}>
                {p} jours
              </button>
            ))}
          </div>
        }
      />

      {error && <div className="alert alert-error">{error}</div>}

      <div className="kpi-grid">
        <Kpi icon="games" label="Parties terminées" value={t?.games ?? '—'} hint={`sur ${days} jours`} />
        <Kpi icon="players" label="Participations" value={t?.participations ?? '—'} hint={`${t?.avgPlayersPerGame ?? 0} joueurs / partie en moyenne`} />
        <Kpi icon="history" label="Durée moyenne" value={t ? `${t.games && t.avgGameMinutes < 1 ? "< 1" : t.avgGameMinutes} min` : '—'} hint="par partie" />
        <Kpi icon="dashboard" label="Pic de connectés" value={t?.peakConcurrent ?? '—'} hint={`${stats?.live.connectedPlayers ?? 0} en ce moment`} />
        <Kpi icon="user" label="Comptes joueurs" value={t?.players ?? '—'} hint={`${t?.activePlayers7d ?? 0} actifs sur 7 jours`} />
        <Kpi icon="shield" label="Jamais connectés" value={t?.neverLoggedIn ?? '—'} hint={`${t?.suspended ?? 0} compte(s) suspendu(s)`} />
      </div>

      {stats && (
        <>
          <div className="chart-grid">
            <ChartCard title="Parties terminées par jour">
              <BarChart data={series('games')} unit="partie(s)" label="Parties terminées par jour" />
            </ChartCard>
            <ChartCard title="Joueurs actifs par jour" subtitle="Joueurs distincts s’étant connectés">
              <BarChart data={series('activePlayers')} unit="joueur(s)" label="Joueurs actifs par jour" />
            </ChartCard>
            <ChartCard
              title="Pic de joueurs connectés"
              subtitle={days <= 7 ? 'Maximum par heure (relevé toutes les 5 min)' : 'Maximum par jour (relevé toutes les 5 min)'}
            >
              {concurrency.length ? (
                <LineChart data={concurrency} unit="joueur(s) connecté(s)" label="Pic de joueurs connectés" />
              ) : (
                <p className="empty">Pas encore de relevé : le premier arrive dans les 5 minutes suivant le démarrage.</p>
              )}
            </ChartCard>
            <ChartCard title="Nouveaux comptes par jour">
              <BarChart data={series('newPlayers')} unit="compte(s) créé(s)" label="Nouveaux comptes par jour" />
            </ChartCard>
          </div>

          <div className="two-cols">
            <section className="card">
              <div className="card-head">
                <h2>Joueurs les plus actifs</h2>
                <span className="text-muted small">{days} derniers jours</span>
              </div>
              {stats.topPlayers.length === 0 ? (
                <p className="empty">Aucune partie terminée sur la période.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th className="num">#</th>
                      <th>Joueur</th>
                      <th>Identifiant</th>
                      <th className="num">Parties</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topPlayers.map((p, i) => (
                      <tr key={p.id}>
                        <td className="num text-muted">{i + 1}</td>
                        <td>
                          <Link className="link" to={`/joueurs/${p.id}`}>
                            {p.firstName} {p.lastName}
                          </Link>
                        </td>
                        <td>
                          <code className="code">{p.username}</code>
                        </td>
                        <td className="num strong">{p.games}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="card">
              <div className="card-head">
                <h2>Données détaillées</h2>
                <button className="btn btn-sm" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable}>
                  {showTable ? 'Masquer' : 'Afficher le tableau'}
                </button>
              </div>
              {showTable ? (
                <DataTable
                  rows={[series('games'), series('activePlayers'), series('newPlayers')]}
                  columns={['Parties', 'Joueurs actifs', 'Nouveaux comptes']}
                />
              ) : (
                <p className="empty">Les valeurs jour par jour des graphiques, sous forme de tableau.</p>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
