import { useEffect, useState, type FormEvent } from 'react';
import { fmtDate, PageHeader } from '../components/ui';
import { request } from '../lib/api';
import { fetchSettings, type GeneralSettings, type SettingsMeta } from '../lib/settings';
import { LIMITS } from '../protocol';

/** Paramètres généraux du jeu */
export function SettingsPage() {
  const [form, setForm] = useState<GeneralSettings | null>(null);
  const [initial, setInitial] = useState<GeneralSettings | null>(null);
  const [meta, setMeta] = useState<SettingsMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchSettings()
      .then((s) => {
        setForm(s.general);
        setInitial(s.general);
        setMeta(s.meta.general);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  if (!form) return <PageHeader title="Paramètres" subtitle={error ?? 'Chargement…'} />;

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) => {
    setSaved(false);
    setForm({ ...form, [key]: value });
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await request<{ general: GeneralSettings; meta: { general: SettingsMeta } }>(
        'PUT',
        '/api/admin/settings/general',
        form,
      );
      setForm(res.general);
      setInitial(res.general);
      setMeta(res.meta.general);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <PageHeader
        title="Paramètres"
        subtitle={
          meta?.updatedAt
            ? `Dernière modification le ${fmtDate.format(new Date(meta.updatedAt))} par ${meta.updatedBy ?? '—'}`
            : 'Réglages généraux du jeu'
        }
        actions={
          <>
            {saved && !dirty && <span className="saved">Enregistré ✓</span>}
            <button type="button" className="btn" disabled={!dirty || busy} onClick={() => setForm(initial)}>
              Annuler les modifications
            </button>
            <button className="btn btn-primary" disabled={!dirty || busy}>
              Enregistrer
            </button>
          </>
        }
      />
      {error && <div className="alert alert-error">{error}</div>}

      <section className="card settings-section">
        <div className="settings-intro">
          <h2>Identité du jeu</h2>
          <p>Affiché aux joueurs sur l’application.</p>
        </div>
        <div className="settings-fields">
          <label className="form-field">
            <span>Nom du jeu</span>
            <input value={form.gameName} maxLength={40} required onChange={(e) => set('gameName', e.target.value)} />
            <small className="text-muted">Titre de l’écran de connexion.</small>
          </label>
          <label className="form-field">
            <span>Message d’accueil</span>
            <textarea
              rows={3}
              maxLength={200}
              value={form.welcomeMessage}
              placeholder="Ex. : Bienvenue ! Les parties commencent à 14 h."
              onChange={(e) => set('welcomeMessage', e.target.value)}
            />
            <small className="text-muted">Affiché au-dessus de la saisie du code. Laisser vide pour ne rien afficher.</small>
          </label>
        </div>
      </section>

      <section className="card settings-section">
        <div className="settings-intro">
          <h2>Parties</h2>
          <p>Valeurs utilisées lors de la création et de la gestion des parties.</p>
        </div>
        <div className="settings-fields">
          <label className="form-field">
            <span>Joueurs maximum par défaut</span>
            <input
              type="number"
              min={LIMITS.maxPlayersMin}
              max={LIMITS.maxPlayersMax}
              value={form.defaultMaxPlayers}
              onChange={(e) => set('defaultMaxPlayers', Number(e.target.value))}
            />
            <small className="text-muted">
              Pré-rempli à la création d’une partie ({LIMITS.maxPlayersMin} à {LIMITS.maxPlayersMax}).
            </small>
          </label>
          <label className="form-field">
            <span>Parties ouvertes simultanément (maximum)</span>
            <input
              type="number"
              min={1}
              max={2000}
              value={form.maxOpenRooms}
              onChange={(e) => set('maxOpenRooms', Number(e.target.value))}
            />
            <small className="text-muted">Protège le serveur contre une création excessive.</small>
          </label>
          <label className="form-field">
            <span>Fermeture automatique des parties inactives</span>
            <div className="input-suffix">
              <input
                type="number"
                min={1}
                max={72}
                value={form.idleTimeoutHours}
                onChange={(e) => set('idleTimeoutHours', Number(e.target.value))}
              />
              <span>heures</span>
            </div>
          </label>
        </div>
      </section>

      <section className="card settings-section">
        <div className="settings-intro">
          <h2>Communication</h2>
          <p>Échanges entre joueurs pendant les parties.</p>
        </div>
        <div className="settings-fields">
          <label className="switch-row">
            <input
              type="checkbox"
              className="switch"
              checked={form.chatEnabled}
              onChange={(e) => set('chatEnabled', e.target.checked)}
            />
            <span>
              <strong>Chat des parties</strong>
              <small className="text-muted">
                {form.chatEnabled ? 'Les joueurs peuvent écrire dans le chat.' : 'Le chat est fermé pour tous les joueurs.'}
              </small>
            </span>
          </label>
        </div>
      </section>
    </form>
  );
}
