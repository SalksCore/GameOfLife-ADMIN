import { useState, type FormEvent } from 'react';
import { fmtDate, Icon, PageHeader } from '../components/ui';
import { adminsApi, ROLE_LABEL } from '../lib/admins';
import { logout } from '../lib/api';
import { useSession } from '../lib/session';

/** Indice de solidité simple : longueur + variété des caractères */
function strength(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (pw.length < 12) return { score: 0, label: 'Trop court (12 caractères minimum)' };
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/].filter((r) => r.test(pw)).length;
  if (pw.length >= 16 && kinds >= 3) return { score: 3, label: 'Solide' };
  if (kinds >= 2) return { score: 2, label: 'Correct' };
  return { score: 1, label: 'Faible : mélangez lettres, chiffres et symboles' };
}

/** Mon compte : informations et changement de mot de passe. */
export function AccountPage() {
  const { user } = useSession();
  const [next, setNext] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const s = strength(next);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const current = String(form.get('current') ?? '');
    if (next !== String(form.get('confirm') ?? '')) return setError('Les deux mots de passe ne correspondent pas');
    setBusy(true);
    setError(null);
    try {
      await adminsApi.changeOwnPassword(current, next);
      // Toutes les sessions sont coupées côté serveur : on revient à l'écran de connexion
      alert('Mot de passe changé. Reconnectez-vous avec le nouveau.');
      await logout();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;
  const role = user.role ?? 'admin';

  return (
    <>
      <PageHeader title="Mon compte" subtitle="Vos informations de connexion au panneau." />
      <div className="account-grid">
        <div className="card account-id">
          <div className={`avatar avatar-xl avatar-${role}`}>{user.username.slice(0, 2)}</div>
          <div>
            <h2>{user.username}</h2>
            <span className={`role-pill role-${role}`}>{ROLE_LABEL[role]}</span>
          </div>
          <dl className="details">
            <dt>Dernière connexion</dt>
            <dd>{user.lastLoginAt ? fmtDate.format(new Date(user.lastLoginAt)) : '—'}</dd>
            {user.createdAt && (
              <>
                <dt>Compte créé</dt>
                <dd>{fmtDate.format(new Date(user.createdAt))}</dd>
              </>
            )}
            <dt>Session</dt>
            <dd>12 h maximum</dd>
          </dl>
        </div>

        <form className="card padded form-grid" onSubmit={submit}>
          <div className="card-title">
            <Icon name="lock" size={18} /> Changer de mot de passe
          </div>
          <label className="form-field">
            <span>Mot de passe actuel</span>
            <input name="current" type={show ? 'text' : 'password'} autoComplete="current-password" required />
          </label>
          <label className="form-field">
            <span>Nouveau mot de passe</span>
            <input
              name="next"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
            {next && (
              <div className={`strength s${s.score}`}>
                <div className="strength-bar">
                  {[1, 2, 3].map((i) => (
                    <span key={i} className={i <= s.score ? 'on' : undefined} />
                  ))}
                </div>
                <small>{s.label}</small>
              </div>
            )}
          </label>
          <label className="form-field">
            <span>Confirmer</span>
            <input name="confirm" type={show ? 'text' : 'password'} autoComplete="new-password" required />
          </label>
          <label className="switch-row">
            <input type="checkbox" className="switch" checked={show} onChange={(e) => setShow(e.target.checked)} />
            <span>Afficher les mots de passe</span>
          </label>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-actions">
            <span className="text-muted small">Toutes vos sessions seront fermées.</span>
            <button className="btn btn-primary" disabled={busy || s.score === 0}>
              {busy ? 'Enregistrement…' : 'Changer le mot de passe'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
