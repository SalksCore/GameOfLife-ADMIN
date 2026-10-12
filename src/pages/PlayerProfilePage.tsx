import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { CredentialsModal } from '../components/CredentialsModal';
import { fmtDate, fmtDay, Icon, Modal, useConfirm } from '../components/ui';
import { ApiError } from '../lib/api';
import {
  ACTION_LABELS,
  describeDevice,
  playersApi,
  relativeTime,
  type Credentials,
  type PlayerProfile,
} from '../lib/players';

type Tab = 'games' | 'logins' | 'moderation';

/** Fiche complète d'un joueur */
export function PlayerProfilePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();
  const [data, setData] = useState<PlayerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>('games');
  const [editOpen, setEditOpen] = useState(false);
  const [banOpen, setBanOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [credentials, setCredentials] = useState<Credentials[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  // Dernière version enregistrée des notes : le rafraîchissement auto n'écrase pas une saisie en cours
  const savedNotes = useRef('');

  const load = useCallback(async () => {
    try {
      const res = await playersApi.get(id);
      setData(res);
      setNotes((cur) => (cur === savedNotes.current ? res.player.notes : cur));
      savedNotes.current = res.player.notes;
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 400)) setNotFound(true);
      else setError(err instanceof Error ? err.message : 'Erreur');
    }
  }, [id]);

  useEffect(() => {
    void load();
    // La présence (en ligne / en partie) évolue : rafraîchissement régulier
    const t = setInterval(() => void load(), 15_000);
    return () => clearInterval(t);
  }, [load]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  if (notFound) {
    return (
      <div className="card empty-state">
        <h2>Joueur introuvable</h2>
        <p className="text-muted">Ce compte n’existe pas ou a été supprimé.</p>
        <Link className="btn" to="/joueurs">
          Retour à la liste
        </Link>
      </div>
    );
  }
  if (!data) return <p className="text-muted">{error ?? 'Chargement…'}</p>;

  const { player: p, presence, stats } = data;
  const name = `${p.firstName} ${p.lastName}`;

  async function resetPassword() {
    if (!(await confirm('Nouveau mot de passe', <p>Générer un nouveau mot de passe pour <strong>{name}</strong> ? L’ancien ne fonctionnera plus et le joueur sera déconnecté.</p>, true))) return;
    await act(async () => {
      const res = await playersApi.resetPassword(p.id);
      setCredentials([{ ...res.credentials, firstName: p.firstName, lastName: p.lastName }]);
    });
  }

  async function revoke() {
    if (!(await confirm('Déconnecter partout', <p>Fermer les {data!.activeSessions} session(s) de <strong>{name}</strong> ? Le joueur devra se reconnecter.</p>))) return;
    await act(() => playersApi.revokeSessions(p.id));
  }

  async function unban() {
    if (!(await confirm('Réactiver le compte', <p>Réactiver le compte de <strong>{name}</strong> ?</p>))) return;
    await act(() => playersApi.ban(p.id, false));
  }

  async function submitEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setModalError(null);
    try {
      await playersApi.update(p.id, { firstName: String(form.get('firstName')), lastName: String(form.get('lastName')) });
      setEditOpen(false);
      await load();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  async function submitBan(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get('reason') ?? '').trim();
    setBanOpen(false);
    await act(() => playersApi.ban(p.id, true, reason || undefined));
  }

  async function submitDelete() {
    setBusy(true);
    try {
      await playersApi.remove(p.id);
      navigate('/joueurs', { replace: true });
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Erreur');
      setBusy(false);
    }
  }

  async function saveNotes() {
    await act(async () => {
      await playersApi.update(p.id, { notes });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2_000);
    });
  }

  return (
    <>
      <Link to="/joueurs" className="back-link">
        <Icon name="back" size={16} /> Joueurs
      </Link>

      {error && <div className="alert alert-error">{error}</div>}
      {p.bannedAt && (
        <div className="alert alert-error banner-row">
          <div>
            <strong>Compte suspendu</strong> depuis le {fmtDate.format(new Date(p.bannedAt))}
            {p.bannedReason && <> — motif : « {p.bannedReason} »</>}
          </div>
          <button className="btn btn-sm" onClick={() => void unban()} disabled={busy}>
            Réactiver
          </button>
        </div>
      )}

      {/* En-tête du profil */}
      <section className="card profile-head">
        <div className="profile-id">
          <div className="avatar avatar-xl">
            {p.firstName.charAt(0)}
            {p.lastName.charAt(0)}
            {presence.online && <span className="presence" />}
          </div>
          <div>
            <h1>{name}</h1>
            <div className="profile-meta">
              <code className="code">{p.username}</code>
              {presence.online ? (
                <span className="badge badge-ok">
                  <span className="dot on" /> En ligne
                </span>
              ) : (
                <span className="badge badge-ended">Hors ligne · {relativeTime(p.lastLoginAt)}</span>
              )}
              {presence.room && (
                <Link to="/parties" className="badge badge-info">
                  Dans la partie {presence.room.code} · {presence.room.name}
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="profile-actions">
          <button className="btn" onClick={() => { setModalError(null); setEditOpen(true); }} disabled={busy}>
            <Icon name="edit" size={16} /> Modifier
          </button>
          <button className="btn" onClick={() => void resetPassword()} disabled={busy}>
            <Icon name="key" size={16} /> Nouveau mot de passe
          </button>
          <button className="btn" onClick={() => void revoke()} disabled={busy || data.activeSessions === 0}>
            <Icon name="logout" size={16} /> Déconnecter
          </button>
          {!p.bannedAt && (
            <button className="btn btn-ghost-danger" onClick={() => setBanOpen(true)} disabled={busy}>
              Suspendre
            </button>
          )}
          <button
            className="btn btn-ghost-danger"
            onClick={() => { setDeleteConfirm(''); setModalError(null); setDeleteOpen(true); }}
            disabled={busy}
            aria-label="Supprimer le compte"
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      </section>

      <div className="profile-grid">
        <div className="profile-side">
          <section className="card">
            <div className="card-head">
              <h2>Informations</h2>
            </div>
            <dl className="details">
              <dt>Prénom</dt>
              <dd>{p.firstName}</dd>
              <dt>Nom</dt>
              <dd>{p.lastName}</dd>
              <dt>Identifiant</dt>
              <dd>
                <code className="code">{p.username}</code>
              </dd>
              <dt>Nom en jeu</dt>
              <dd>{p.displayName}</dd>
              <dt>Compte créé</dt>
              <dd>
                {fmtDay.format(new Date(p.createdAt))}
                {p.createdBy && <span className="text-muted"> par {p.createdBy}</span>}
              </dd>
              <dt>Dernière connexion</dt>
              <dd>{p.lastLoginAt ? fmtDate.format(new Date(p.lastLoginAt)) : 'Jamais'}</dd>
              <dt>Sessions actives</dt>
              <dd>{data.activeSessions}</dd>
              <dt>Statut</dt>
              <dd>
                {p.bannedAt ? <span className="badge badge-danger">Suspendu</span> : <span className="badge badge-ok">Actif</span>}
              </dd>
            </dl>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Notes internes</h2>
              {notesSaved && <span className="saved">Enregistré ✓</span>}
            </div>
            <div className="padded stack-sm">
              <textarea
                rows={5}
                maxLength={2000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Visible uniquement par les administrateurs…"
              />
              <div className="form-actions">
                <button className="btn btn-sm btn-primary" disabled={busy || notes === p.notes} onClick={() => void saveNotes()}>
                  Enregistrer
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="profile-main">
          <div className="mini-stats">
            <div className="card mini">
              <span>Parties jouées</span>
              <strong>{stats.gamesPlayed}</strong>
            </div>
            <div className="card mini">
              <span>Sur 30 jours</span>
              <strong>{stats.gamesLast30Days}</strong>
            </div>
            <div className="card mini">
              <span>Durée moyenne</span>
              <strong>{stats.gamesPlayed && stats.averageMinutes < 1 ? "< 1" : stats.averageMinutes} min</strong>
            </div>
            <div className="card mini">
              <span>Dernière partie</span>
              <strong>{stats.lastGameAt ? relativeTime(stats.lastGameAt) : '—'}</strong>
            </div>
          </div>

          <section className="card">
            <div className="tabs-inline bordered" role="tablist">
              <button role="tab" aria-selected={tab === 'games'} onClick={() => setTab('games')}>
                Parties <span className="count">{data.games.length}</span>
              </button>
              <button role="tab" aria-selected={tab === 'logins'} onClick={() => setTab('logins')}>
                Connexions <span className="count">{data.logins.length}</span>
              </button>
              <button role="tab" aria-selected={tab === 'moderation'} onClick={() => setTab('moderation')}>
                Historique admin <span className="count">{data.moderation.length}</span>
              </button>
            </div>

            {tab === 'games' &&
              (data.games.length === 0 ? (
                <p className="empty">Aucune partie terminée.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Partie</th>
                      <th>Code</th>
                      <th className="num">Joueurs</th>
                      <th>Date</th>
                      <th className="num">Durée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.games.map((g) => (
                      <tr key={g.id}>
                        <td className="strong">{g.name}</td>
                        <td>
                          <code className="code">{g.code}</code>
                        </td>
                        <td className="num">{g.playerCount}</td>
                        <td>{fmtDate.format(new Date(g.startedAt))}</td>
                        <td className="num">
                          {Math.max(1, Math.round((Date.parse(g.endedAt) - Date.parse(g.startedAt)) / 60_000))} min
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))}

            {tab === 'logins' &&
              (data.logins.length === 0 ? (
                <p className="empty">Ce joueur ne s’est jamais connecté.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Appareil</th>
                      <th>Adresse IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.logins.map((l) => (
                      <tr key={l.at}>
                        <td>{fmtDate.format(new Date(l.at))}</td>
                        <td title={l.userAgent ?? undefined}>{describeDevice(l.userAgent)}</td>
                        <td>
                          <code className="code plain">{l.ip ?? '—'}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))}

            {tab === 'moderation' &&
              (data.moderation.length === 0 ? (
                <p className="empty">Aucune action enregistrée.</p>
              ) : (
                <ul className="timeline">
                  {data.moderation.map((m) => {
                    const info = ACTION_LABELS[m.action] ?? { label: m.action, tone: 'info' as const };
                    return (
                      <li key={m.id}>
                        <span className={`timeline-dot tone-${info.tone}`} />
                        <div>
                          <div>
                            <strong>{info.label}</strong>
                            {m.details && <span className="text-muted"> — {m.details}</span>}
                          </div>
                          <div className="text-muted small">
                            {fmtDate.format(new Date(m.createdAt))} · {m.admin ?? 'admin supprimé'}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ))}
          </section>
        </div>
      </div>

      {/* Fenêtres */}
      <Modal
        open={editOpen}
        title="Modifier le joueur"
        onClose={() => setEditOpen(false)}
        footer={
          <>
            <button className="btn" onClick={() => setEditOpen(false)}>
              Annuler
            </button>
            <button className="btn btn-primary" form="edit-player" disabled={busy}>
              Enregistrer
            </button>
          </>
        }
      >
        <form id="edit-player" className="form-grid two" onSubmit={submitEdit} key={p.updatedAt}>
          <label className="form-field">
            <span>Prénom</span>
            <input name="firstName" defaultValue={p.firstName} required maxLength={40} />
          </label>
          <label className="form-field">
            <span>Nom</span>
            <input name="lastName" defaultValue={p.lastName} required maxLength={40} />
          </label>
          <p className="text-muted small span-2">
            L’identifiant <code>{p.username}</code> ne change pas, pour que le joueur puisse toujours se connecter.
          </p>
          {modalError && <div className="alert alert-error span-2">{modalError}</div>}
        </form>
      </Modal>

      <Modal
        open={banOpen}
        title="Suspendre le compte"
        onClose={() => setBanOpen(false)}
        footer={
          <>
            <button className="btn" onClick={() => setBanOpen(false)}>
              Annuler
            </button>
            <button className="btn btn-danger" form="ban-player">
              Suspendre
            </button>
          </>
        }
      >
        <form id="ban-player" className="form-grid" onSubmit={submitBan}>
          <p>
            <strong>{name}</strong> sera immédiatement déconnecté et ne pourra plus se connecter.
          </p>
          <label className="form-field">
            <span>Motif (facultatif, visible dans l’historique)</span>
            <input name="reason" maxLength={300} placeholder="Ex. : comportement inapproprié dans le chat" />
          </label>
        </form>
      </Modal>

      <Modal
        open={deleteOpen}
        title="Supprimer le compte"
        onClose={() => setDeleteOpen(false)}
        footer={
          <>
            <button className="btn" onClick={() => setDeleteOpen(false)}>
              Annuler
            </button>
            <button
              className="btn btn-danger"
              disabled={busy || deleteConfirm.trim().toLowerCase() !== p.username}
              onClick={() => void submitDelete()}
            >
              Supprimer définitivement
            </button>
          </>
        }
      >
        <div className="alert alert-error">
          Action <strong>irréversible</strong> : le compte, ses connexions et sa participation aux parties seront supprimés.
          Pour bloquer un joueur temporairement, préférez la suspension.
        </div>
        <label className="form-field">
          <span>
            Tapez <code>{p.username}</code> pour confirmer
          </span>
          <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} autoComplete="off" />
        </label>
        {modalError && <div className="alert alert-error">{modalError}</div>}
      </Modal>

      <CredentialsModal title="Nouveau mot de passe" list={credentials} onClose={() => setCredentials(null)} />
      {dialog}
    </>
  );
}

