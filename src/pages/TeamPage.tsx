import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { CopyButton, fmtDay, Icon, Modal, PageHeader, useConfirm } from '../components/ui';
import { adminsApi, ROLE_LABEL, type AdminCredentials, type AdminRole, type AdminRow } from '../lib/admins';
import { relativeTime } from '../lib/players';
import { useSession } from '../lib/session';

/** L'équipe qui a accès au panneau : propriétaires et admins. */
export function TeamPage() {
  const { user } = useSession();
  const [rows, setRows] = useState<AdminRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [role, setRole] = useState<AdminRole>('admin');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creds, setCreds] = useState<{ title: string; value: AdminCredentials } | null>(null);
  const { confirm, dialog } = useConfirm();

  const me = rows?.find((r) => r.id === user?.id);
  const isOwner = (me?.role ?? user?.role) === 'owner';

  const load = useCallback(async () => {
    try {
      setRows((await adminsApi.list()).admins);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
    await load();
  }

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const username = String(new FormData(e.currentTarget).get('username') ?? '').trim();
    setBusy(true);
    setFormError(null);
    try {
      const res = await adminsApi.create(username, role);
      setCreateOpen(false);
      setCreds({ title: `Compte ${ROLE_LABEL[role].toLowerCase()} créé`, value: res.credentials });
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  const owners = rows?.filter((r) => r.role === 'owner' && !r.disabledAt).length ?? 0;

  return (
    <>
      <PageHeader
        title="Équipe"
        subtitle="Les personnes qui ont accès au panneau. Chaque action est inscrite au journal à leur nom."
        actions={
          isOwner && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setFormError(null);
                setRole('admin');
                setCreateOpen(true);
              }}
            >
              <Icon name="plus" size={18} /> Ajouter un admin
            </button>
          )
        }
      />

      {error && <div className="alert alert-error">{error}</div>}

      <div className="team-roles">
        <div className="role-card">
          <span className="role-pill role-owner">
            <Icon name="key" size={14} /> Propriétaire
          </span>
          <p>Tout le panneau, plus la gestion de l’équipe : ajouter, désactiver, supprimer un admin.</p>
        </div>
        <div className="role-card">
          <span className="role-pill role-admin">
            <Icon name="shield" size={14} /> Admin
          </span>
          <p>Parties, régie, joueurs, statistiques, paramètres. Ne peut pas gérer l’équipe.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>{rows ? `${rows.length} compte${rows.length > 1 ? 's' : ''}` : 'Chargement…'}</h2>
          {!isOwner && rows && <span className="text-muted small">Lecture seule : seul un propriétaire gère l’équipe.</span>}
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Compte</th>
              <th>Rôle</th>
              <th>Dernière connexion</th>
              <th>Sessions</th>
              <th>Depuis</th>
              {isOwner && <th className="actions">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows?.map((a) => {
              const self = a.id === user?.id;
              const lastOwner = a.role === 'owner' && !a.disabledAt && owners <= 1;
              return (
                <tr key={a.id} className={a.disabledAt ? 'is-disabled' : undefined}>
                  <td>
                    <div className="person">
                      <div className={`avatar avatar-${a.role}`}>{a.username.slice(0, 2)}</div>
                      <div>
                        <strong>{a.username}</strong>
                        {self && <span className="you-badge">vous</span>}
                        {a.disabledAt && <div className="small text-muted">Désactivé le {fmtDay.format(new Date(a.disabledAt))}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    {isOwner && !self && !a.disabledAt ? (
                      <select
                        className="select"
                        value={a.role}
                        disabled={lastOwner}
                        title={lastOwner ? 'Il faut garder au moins un propriétaire actif' : undefined}
                        onChange={(e) => void run(() => adminsApi.update(a.id, { role: e.target.value as AdminRole }))}
                      >
                        <option value="owner">Propriétaire</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className={`role-pill role-${a.role}`}>{ROLE_LABEL[a.role]}</span>
                    )}
                  </td>
                  <td>{relativeTime(a.lastLoginAt)}</td>
                  <td className="num">{a.disabledAt ? '—' : a.activeSessions}</td>
                  <td>{fmtDay.format(new Date(a.createdAt))}</td>
                  {isOwner && (
                    <td className="actions">
                      {self ? (
                        <Link className="btn btn-sm" to="/compte">
                          Mon compte
                        </Link>
                      ) : (
                        <>
                          {!a.disabledAt && (
                            <button
                              className="btn btn-sm"
                              onClick={async () => {
                                const ok = await confirm(
                                  'Nouveau mot de passe',
                                  <>
                                    Générer un nouveau mot de passe pour <strong>{a.username}</strong> ? Ses sessions ouvertes
                                    sont coupées.
                                  </>,
                                );
                                if (ok)
                                  await run(async () =>
                                    setCreds({ title: 'Nouveau mot de passe', value: (await adminsApi.resetPassword(a.id)).credentials }),
                                  );
                              }}
                            >
                              <Icon name="key" size={15} /> Mot de passe
                            </button>
                          )}
                          <button
                            className={`btn btn-sm${a.disabledAt ? '' : ' btn-warning'}`}
                            disabled={lastOwner}
                            onClick={async () => {
                              if (!a.disabledAt) {
                                const ok = await confirm(
                                  'Désactiver ce compte',
                                  <>
                                    <strong>{a.username}</strong> est déconnecté tout de suite et ne peut plus se connecter. Vous pourrez
                                    le réactiver.
                                  </>,
                                  true,
                                );
                                if (!ok) return;
                              }
                              await run(() => adminsApi.update(a.id, { disabled: !a.disabledAt }));
                            }}
                          >
                            {a.disabledAt ? 'Réactiver' : 'Désactiver'}
                          </button>
                          <button
                            className="btn btn-sm btn-ghost-danger"
                            disabled={lastOwner}
                            aria-label={`Supprimer ${a.username}`}
                            onClick={async () => {
                              const ok = await confirm(
                                'Supprimer ce compte',
                                <>
                                  Supprimer définitivement <strong>{a.username}</strong> ? Ses actions restent au journal, sans son nom.
                                </>,
                                true,
                              );
                              if (ok) await run(() => adminsApi.remove(a.id));
                            }}
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={createOpen}
        title="Ajouter un admin"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button className="btn" onClick={() => setCreateOpen(false)}>
              Annuler
            </button>
            <button className="btn btn-primary" form="create-admin" disabled={busy}>
              {busy ? 'Création…' : 'Créer le compte'}
            </button>
          </>
        }
      >
        <form id="create-admin" className="form-grid" onSubmit={create}>
          <label className="form-field">
            <span>Identifiant</span>
            <input name="username" required minLength={3} maxLength={32} pattern="[a-zA-Z0-9_\-]{3,32}" autoCapitalize="none" spellCheck={false} placeholder="ex. coorateur" />
            <small className="text-muted">Lettres, chiffres, - et _. Le mot de passe est généré et affiché une seule fois.</small>
          </label>
          <div className="choice-list">
            {(['admin', 'owner'] as const).map((r) => (
              <label key={r} className="choice">
                <input type="radio" name="role" checked={role === r} onChange={() => setRole(r)} />
                <span>
                  <strong>{ROLE_LABEL[r]}</strong>
                  <small>{r === 'owner' ? 'Peut aussi gérer l’équipe.' : 'Tout sauf la gestion de l’équipe. Conseillé.'}</small>
                </span>
              </label>
            ))}
          </div>
          {formError && <div className="alert alert-error">{formError}</div>}
        </form>
      </Modal>

      <Modal
        open={!!creds}
        title={creds?.title ?? ''}
        onClose={() => setCreds(null)}
        footer={
          <>
            <CopyButton value={creds ? `Identifiant : ${creds.value.username}\nMot de passe : ${creds.value.password}` : ''} label="Tout copier" />
            <button className="btn btn-primary" onClick={() => setCreds(null)}>
              J’ai transmis les identifiants
            </button>
          </>
        }
      >
        <div className="alert alert-warning">
          Ce mot de passe ne sera <strong>plus jamais affiché</strong>. Transmettez-le en main propre ; la personne pourra le changer
          dans « Mon compte ».
        </div>
        {creds && (
          <div className="credentials">
            <div className="cred-row">
              <span>Identifiant</span>
              <code>{creds.value.username}</code>
              <CopyButton value={creds.value.username} />
            </div>
            <div className="cred-row">
              <span>Mot de passe</span>
              <code>{creds.value.password}</code>
              <CopyButton value={creds.value.password} />
            </div>
          </div>
        )}
      </Modal>
      {dialog}
    </>
  );
}
