import { useActionState, useState } from 'react';
import { Icon } from '../components/ui';
import { login } from '../lib/api';

/** Connexion au panneau d'administration (comptes admin uniquement). */
export function LoginPage() {
  const [show, setShow] = useState(false);
  const [error, submit, pending] = useActionState(async (_prev: string | null, form: FormData) => {
    try {
      await login(String(form.get('username') ?? '').trim(), String(form.get('password') ?? ''));
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Connexion impossible';
    }
  }, null);

  return (
    <div className="login-page">
      <aside className="login-brand">
        <div className="brand-row">
          <img src="/icon.svg" alt="" width={40} height={40} />
          <span>
            GameOfLife <strong>Admin</strong>
          </span>
        </div>
        <div className="login-pitch">
          <h1>Panneau d’administration</h1>
          <p>Gérez les comptes joueurs, créez les parties et suivez l’activité en temps réel.</p>
          <ul>
            <li>
              <Icon name="players" size={18} /> Création des comptes joueurs
            </li>
            <li>
              <Icon name="games" size={18} /> Parties et codes d’accès
            </li>
            <li>
              <Icon name="shield" size={18} /> Modération et journal d’activité
            </li>
          </ul>
        </div>
        <p className="login-legal">Accès réservé au personnel autorisé. Toutes les actions sont journalisées.</p>
      </aside>

      <main className="login-main">
        <form action={submit} className="login-form">
          <div className="login-icon">
            <Icon name="lock" size={26} />
          </div>
          <h2>Connexion</h2>
          <p className="text-muted">Identifiez-vous avec votre compte administrateur.</p>

          <label className="form-field">
            <span>Identifiant</span>
            <div className="input-icon">
              <Icon name="user" size={18} />
              <input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
            </div>
          </label>

          <label className="form-field">
            <span>Mot de passe</span>
            <div className="input-icon">
              <Icon name="key" size={18} />
              <input name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required />
              <button type="button" className="input-toggle" onClick={() => setShow((v) => !v)}>
                {show ? 'Masquer' : 'Afficher'}
              </button>
            </div>
          </label>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          <button className="btn btn-primary btn-block btn-lg" disabled={pending}>
            {pending ? 'Connexion…' : 'Se connecter'}
          </button>

          <p className="text-muted small center">Les comptes joueurs ne donnent pas accès à cet espace.</p>
        </form>
      </main>
    </div>
  );
}
