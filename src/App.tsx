import { BrowserRouter, Link, Navigate, NavLink, Route, Routes } from 'react-router';
import { Icon, type IconName } from './components/ui';
import { LiveProvider, useLive } from './lib/admin-socket';
import { logout } from './lib/api';
import { useSession } from './lib/session';
import { DashboardPage } from './pages/DashboardPage';
import { GamesPage } from './pages/GamesPage';
import { HistoryPage } from './pages/HistoryPage';
import { JournalPage } from './pages/JournalPage';
import { LoginPage } from './pages/LoginPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { PlayerProfilePage } from './pages/PlayerProfilePage';
import { PlayersPage } from './pages/PlayersPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';

const NAV: { title: string; items: { to: string; label: string; icon: IconName }[] }[] = [
  {
    title: 'Pilotage',
    items: [
      { to: '/', label: 'Tableau de bord', icon: 'dashboard' },
      { to: '/parties', label: 'Parties', icon: 'games' },
      { to: '/statistiques', label: 'Statistiques', icon: 'chart' },
    ],
  },
  {
    title: 'Joueurs',
    items: [
      { to: '/joueurs', label: 'Joueurs', icon: 'players' },
      { to: '/historique', label: 'Historique des parties', icon: 'history' },
    ],
  },
  {
    title: 'Système',
    items: [
      { to: '/maintenance', label: 'Maintenance', icon: 'tool' },
      { to: '/parametres', label: 'Paramètres', icon: 'settings' },
      { to: '/journal', label: 'Journal', icon: 'journal' },
    ],
  },
];

function Shell({ username }: { username: string }) {
  const { online, error, rooms, stats } = useLive();
  const live = rooms.filter((r) => r.phase !== 'ended').length;

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="brand-row">
          <img src="/icon.svg" alt="" width={34} height={34} />
          <span>
            GameOfLife <strong>Admin</strong>
          </span>
        </Link>

        <nav>
          {NAV.map((section) => (
            <div key={section.title} className="nav-section">
              <div className="nav-title">{section.title}</div>
              {section.items.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.to === '/'} className="nav-item">
                  <Icon name={n.icon} />
                  <span>{n.label}</span>
                  {n.to === '/parties' && live > 0 && <span className="nav-count">{live}</span>}
                  {n.to === '/maintenance' && stats?.maintenance && <span className="nav-count warn">ON</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="me">
            <div className="me-avatar">{username.charAt(0).toUpperCase()}</div>
            <div>
              <div className="me-name">{username}</div>
              <div className="me-status">
                <span className={`dot ${online ? 'on' : 'off'}`} /> {online ? 'Temps réel actif' : 'Hors ligne'}
              </div>
            </div>
          </div>
          <button className="nav-item" onClick={() => void logout()}>
            <Icon name="logout" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      <div className="main">
        {stats?.maintenance && (
          <div className="maintenance-strip">
            <Icon name="tool" size={16} /> Le jeu est en maintenance : les joueurs ne peuvent pas se connecter.
            <Link to="/maintenance">Gérer</Link>
          </div>
        )}
        <main className="content">
          {error && <div className="alert alert-warning">{error}</div>}
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/parties" element={<GamesPage />} />
            <Route path="/statistiques" element={<StatsPage />} />
            <Route path="/joueurs" element={<PlayersPage />} />
            <Route path="/joueurs/:id" element={<PlayerProfilePage />} />
            <Route path="/historique" element={<HistoryPage />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
            <Route path="/parametres" element={<SettingsPage />} />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export function App() {
  const { user, ready } = useSession();
  if (!ready) return <div className="boot">Chargement…</div>;
  // La session ne peut contenir qu'un compte admin (routes, cookie et token dédiés côté API)
  if (!user) return <LoginPage />;
  return (
    <BrowserRouter>
      <LiveProvider key={user.id}>
        <Shell username={user.username} />
      </LiveProvider>
    </BrowserRouter>
  );
}
