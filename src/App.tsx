import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useParams } from 'react-router';
import { Icon, type IconName } from './components/ui';
import { LiveProvider, useLive } from './lib/admin-socket';
import { logout } from './lib/api';
import { useSession } from './lib/session';
import { LegalSheet } from './components/Legal';
import { Logo } from './components/Logo';
import { AccountPage } from './pages/AccountPage';
import { TeamPage } from './pages/TeamPage';
import { DashboardPage } from './pages/DashboardPage';
import { DeckPage } from './pages/DeckPage';
import { ExposePage } from './pages/ExposePage';
import { GamesPage } from './pages/GamesPage';
import { HistoryPage } from './pages/HistoryPage';
import { JournalPage } from './pages/JournalPage';
import { LoginPage } from './pages/LoginPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { PlayerProfilePage } from './pages/PlayerProfilePage';
import { PlayersPage } from './pages/PlayersPage';
import { ProjectorPage } from './pages/ProjectorPage';
import { RegiePage } from './pages/RegiePage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';

const NAV: { title: string; items: { to: string; label: string; icon: IconName }[] }[] = [
  {
    title: 'Pilotage',
    items: [
      { to: '/', label: 'Tableau de bord', icon: 'dashboard' },
      { to: '/parties', label: 'Parties', icon: 'games' },
      { to: '/expose', label: 'Exposé (diapos, cartes)', icon: 'journal' },
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
      { to: '/equipe', label: 'Équipe admin', icon: 'key' },
      { to: '/maintenance', label: 'Maintenance', icon: 'tool' },
      { to: '/parametres', label: 'Paramètres', icon: 'settings' },
      { to: '/journal', label: 'Journal', icon: 'journal' },
      { to: '/legal', label: 'Légal et RGPD', icon: 'shield' },
    ],
  },
];

function Shell({ username, role }: { username: string; role: 'owner' | 'admin' }) {
  const { online, error, rooms, stats } = useLive();
  const live = rooms.filter((r) => r.phase !== 'ended').length;

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="brand-row" aria-label="GameOfLife admin, tableau de bord">
          <Logo size={34} />
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
          <NavLink to="/compte" className="me" title="Mon compte">
            <div className={`me-avatar avatar-${role}`}>{username.slice(0, 2)}</div>
            <div>
              <div className="me-name">{username}</div>
              <div className="me-status">
                <span className={`dot ${online ? 'on' : 'off'}`} /> {online ? 'En direct' : 'Hors ligne'} ·{' '}
                {role === 'owner' ? 'Propriétaire' : 'Admin'}
              </div>
            </div>
          </NavLink>
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
            <Route path="/parties/:id" element={<ToRegie />} />
            <Route path="/expose" element={<ExposePage />} />
            <Route path="/statistiques" element={<StatsPage />} />
            <Route path="/joueurs" element={<PlayersPage />} />
            <Route path="/joueurs/:id" element={<PlayerProfilePage />} />
            <Route path="/historique" element={<HistoryPage />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
            <Route path="/parametres" element={<SettingsPage />} />
            <Route path="/legal" element={<LegalSheet inline />} />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/equipe" element={<TeamPage />} />
            <Route path="/compte" element={<AccountPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

/** Ancienne adresse d'une partie : redirige vers sa gestion */
function ToRegie() {
  const { id } = useParams();
  return <Navigate to={`/regie/${id}`} replace />;
}

export function App() {
  const { user, ready } = useSession();
  if (!ready) return <div className="boot">Chargement…</div>;
  // La session ne peut contenir qu'un compte admin (routes, cookie et token dédiés côté API)
  if (!user) return <LoginPage />;
  return (
    <BrowserRouter>
      <LiveProvider key={user.id}>
        <Routes>
          {/* Écran du vidéoprojecteur : plein cadre, sans le menu */}
          <Route path="/ecran/:id" element={<ProjectorPage />} />
          {/* Gestion d'une partie : page à part, plein écran, sans le menu */}
          <Route path="/regie/:id" element={<RegiePage />} />
          {/* Stream Deck plein écran (tablette) */}
          <Route path="/deck/:id" element={<DeckPage />} />
          <Route path="/*" element={<Shell username={user.username} role={user.role ?? 'admin'} />} />
        </Routes>
      </LiveProvider>
    </BrowserRouter>
  );
}
