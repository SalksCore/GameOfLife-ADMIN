import { LegalLinks } from '../components/Legal';
import { useActionState, useState } from 'react';
import { LifeGrid, Logo } from '../components/Logo';
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
        <div className="login-board">
          <LifeGrid cols={22} rows={10} interval={650} />
        </div>
        <div className="brand-row">
          <Logo size={40} />
        </div>
        <div className="login-pitch">
          <span className="eyebrow">Régie de l’exposé</span>
          <h1>
            L’école garantit-elle <em>l’égalité des chances</em> ?
          </h1>
          <p>Le panneau qui fait tourner la partie : comptes des joueurs, régie en direct, écran projeté et résultats.</p>
          <ul>
            <li>
              <Icon name="players" size={18} /> Comptes joueurs et fiches à découper
            </li>
            <li>
              <Icon name="games" size={18} /> Parties, Stream Deck et écran projeté
            </li>
            <li>
              <Icon name="key" size={18} /> Équipe admin, journal de chaque action
            </li>
          </ul>
        </div>
        <div>
          <p className="login-legal">Accès réservé à l’équipe de l’exposé. Toutes les actions sont journalisées.</p>
          <LegalLinks className="on-dark" />
        </div>
      </aside>

      <main className="login-main">
        <form action={submit} className="login-form">
          <div className="login-icon">
            <Icon name="lock" size={26} />
          </div>
          <h2>Connexion</h2>
          <p className="text-muted">Avec le compte admin que l’équipe vous a remis.</p>

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
