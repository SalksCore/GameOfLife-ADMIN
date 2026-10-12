import { useEffect, useState, type FormEvent } from 'react';
import { fmtDate, Icon, PageHeader, useConfirm } from '../components/ui';
import { useLive } from '../lib/admin-socket';
import { request } from '../lib/api';
import { fetchSettings, fromLocalInput, toLocalInput, type MaintenanceSettings, type SettingsMeta } from '../lib/settings';

/** Activation du mode maintenance et aperçu de l'écran vu par les joueurs */
export function MaintenancePage() {
  const { stats } = useLive();
  const { confirm, dialog } = useConfirm();
  const [current, setCurrent] = useState<MaintenanceSettings | null>(null);
  const [meta, setMeta] = useState<SettingsMeta | null>(null);
  const [message, setMessage] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings()
      .then((s) => {
        setCurrent(s.maintenance);
        setMeta(s.meta.maintenance);
        setMessage(s.maintenance.message);
        setEndsAt(toLocalInput(s.maintenance.endsAt));
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  async function save(enabled: boolean) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await request<{ maintenance: MaintenanceSettings; meta: { maintenance: SettingsMeta } }>(
        'PUT',
        '/api/admin/settings/maintenance',
        { enabled, message: message.trim(), endsAt: fromLocalInput(endsAt) },
      );
      setCurrent(res.maintenance);
      setMeta(res.meta.maintenance);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    if (!current) return;
    if (!current.enabled) {
      const players = stats?.connectedPlayers ?? 0;
      const ok = await confirm(
        'Activer la maintenance',
        <>
          <p>Le jeu deviendra inaccessible aux joueurs :</p>
          <ul className="bullets">
            <li>
              <strong>{players}</strong> joueur(s) connecté(s) seront déconnectés et verront l’écran de maintenance ;
            </li>
            <li>les connexions joueurs seront refusées ;</li>
            <li>les parties en cours restent ouvertes et les joueurs les retrouveront à la reprise ;</li>
            <li>le panneau d’administration reste accessible.</li>
          </ul>
        </>,
        true,
      );
      if (!ok) return;
    }
    await save(!current.enabled);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void save(current?.enabled ?? false);
  }

  const enabled = current?.enabled ?? false;

  return (
    <>
      <PageHeader title="Maintenance" subtitle="Rendre le jeu temporairement indisponible pour les joueurs" />
      {error && <div className="alert alert-error">{error}</div>}

      <section className={`card status-panel ${enabled ? 'is-on' : 'is-off'}`}>
        <div className="status-icon">
          <Icon name={enabled ? 'lock' : 'shield'} size={26} />
        </div>
        <div className="status-text">
          <h2>{enabled ? 'Maintenance en cours' : 'Le jeu est en ligne'}</h2>
          <p>
            {enabled
              ? `Depuis le ${current?.since ? fmtDate.format(new Date(current.since)) : '—'}. Les joueurs voient l’écran de maintenance.`
              : `${stats?.connectedPlayers ?? 0} joueur(s) connecté(s), ${stats?.gamesInProgress ?? 0} partie(s) en cours.`}
          </p>
          {meta?.updatedAt && (
            <p className="text-muted small">
              Dernière modification le {fmtDate.format(new Date(meta.updatedAt))} par {meta.updatedBy ?? '—'}
            </p>
          )}
        </div>
        <button
          className={`btn btn-lg ${enabled ? 'btn-success' : 'btn-danger'}`}
          onClick={() => void toggle()}
          disabled={busy || !current}
        >
          {enabled ? 'Remettre le jeu en ligne' : 'Activer la maintenance'}
        </button>
      </section>

      <div className="two-cols">
        <section className="card">
          <div className="card-head">
            <h2>Message affiché aux joueurs</h2>
          </div>
          <form className="form-grid padded" onSubmit={submit}>
            <label className="form-field">
              <span>Message</span>
              <textarea
                rows={4}
                maxLength={300}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Le jeu est en maintenance. Nous revenons très vite !"
              />
              <small className="text-muted">{message.length}/300</small>
            </label>
            <label className="form-field">
              <span>Retour estimé (facultatif)</span>
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </label>
            <div className="form-actions">
              {saved && <span className="saved">Enregistré ✓</span>}
              <button className="btn btn-primary" disabled={busy}>
                Enregistrer le message
              </button>
            </div>
          </form>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Aperçu côté joueur</h2>
          </div>
          <div className="phone-preview">
            <div className="phone-screen">
              <div className="phone-icon">🛠️</div>
              <strong>Maintenance en cours</strong>
              <p>{message.trim() || 'Le jeu est en maintenance. Nous revenons très vite !'}</p>
              {endsAt && <p className="phone-eta">Retour prévu : {fmtDate.format(new Date(endsAt))}</p>}
            </div>
          </div>
        </section>
      </div>

      {dialog}
    </>
  );
}
