import { useEffect, useState, type FormEvent } from 'react';
import { CopyButton, fmtDate, Icon, Modal, PageHeader, PhaseBadge, useConfirm } from '../components/ui';
import { useLive } from '../lib/admin-socket';
import { fetchSettings } from '../lib/settings';
import { LIMITS, type AdminRoom } from '../protocol';

/** Création et pilotage des parties en direct. */
export function GamesPage() {
  const { rooms, call, online } = useLive();
  const { confirm, dialog } = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);
  const [created, setCreated] = useState<{ code: string; name: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [defaultMax, setDefaultMax] = useState(30);

  useEffect(() => {
    fetchSettings()
      .then((s) => setDefaultMax(s.general.defaultMaxPlayers))
      .catch(() => {});
  }, []);

  async function run(event: Parameters<typeof call>[0], payload: object) {
    setError(null);
    const res = await call(event, payload);
    if (!res.ok) setError(res.error);
    return res.ok;
  }

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    setBusy(true);
    const res = await call<{ id: string; code: string }>('admin:createRoom', {
      name,
      maxPlayers: Number(form.get('maxPlayers')),
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setCreateOpen(false);
    setCreated({ code: res.data.code, name });
    setOpen(res.data.id);
  }

  async function start(r: AdminRoom) {
    if (await confirm('Lancer la partie', <p>Lancer « {r.name} » avec {r.players.length} joueur(s) ? Plus personne ne pourra rejoindre.</p>))
      await run('admin:startRoom', { roomId: r.id });
  }
  async function end(r: AdminRoom) {
    if (await confirm('Terminer la partie', <p>Terminer « {r.name} » ? La partie sera sauvegardée dans l’historique.</p>))
      await run('admin:endRoom', { roomId: r.id });
  }
  async function close(r: AdminRoom) {
    if (await confirm('Fermer la partie', <p>Fermer « {r.name} » ? Les joueurs seront renvoyés à l’accueil.</p>, true))
      await run('admin:closeRoom', { roomId: r.id });
  }
  async function kick(r: AdminRoom, p: AdminRoom['players'][number]) {
    if (await confirm('Retirer le joueur', <p>Retirer {p.displayName} ({p.username}) de la partie ?</p>, true))
      await run('admin:kick', { roomId: r.id, playerId: p.id });
  }

  return (
    <>
      <PageHeader
        title="Parties"
        subtitle="Créez une partie et communiquez son code aux joueurs"
        actions={
          <button className="btn btn-primary" disabled={!online} onClick={() => setCreateOpen(true)}>
            <Icon name="plus" size={18} /> Nouvelle partie
          </button>
        }
      />

      {error && <div className="alert alert-error">{error}</div>}

      <section className="card">
        <div className="card-head">
          <h2>Parties ouvertes ({rooms.length})</h2>
        </div>
        {rooms.length === 0 ? (
          <p className="empty">Aucune partie ouverte. Créez-en une pour obtenir un code.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Partie</th>
                <th>Code</th>
                <th>Statut</th>
                <th className="num">Joueurs</th>
                <th>Créée</th>
                <th className="actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <RoomRows
                  key={r.id}
                  room={r}
                  expanded={open === r.id}
                  onToggle={() => setOpen(open === r.id ? null : r.id)}
                  onStart={() => void start(r)}
                  onEnd={() => void end(r)}
                  onClose={() => void close(r)}
                  onKick={(p) => void kick(r, p)}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Modal
        open={createOpen}
        title="Nouvelle partie"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button className="btn" onClick={() => setCreateOpen(false)}>
              Annuler
            </button>
            <button className="btn btn-primary" form="create-room" disabled={busy}>
              Créer la partie
            </button>
          </>
        }
      >
        <form id="create-room" className="form-grid" onSubmit={create}>
          <label className="form-field">
            <span>Nom de la partie</span>
            <input name="name" required minLength={LIMITS.roomNameMin} maxLength={LIMITS.roomNameMax} autoFocus />
          </label>
          <label className="form-field">
            <span>Nombre maximum de joueurs</span>
            <input
              name="maxPlayers"
              type="number"
              required
              min={LIMITS.maxPlayersMin}
              max={LIMITS.maxPlayersMax}
              defaultValue={defaultMax}
              key={defaultMax}
            />
          </label>
        </form>
      </Modal>

      <Modal
        open={!!created}
        title="Partie créée"
        onClose={() => setCreated(null)}
        footer={
          <button className="btn btn-primary" onClick={() => setCreated(null)}>
            Terminé
          </button>
        }
      >
        <p>
          Communiquez ce code aux joueurs de <strong>{created?.name}</strong> :
        </p>
        <div className="big-code">{created?.code}</div>
        <div className="center">
          <CopyButton value={created?.code ?? ''} label="Copier le code" />
        </div>
      </Modal>

      {dialog}
    </>
  );
}

function RoomRows(props: {
  room: AdminRoom;
  expanded: boolean;
  onToggle: () => void;
  onStart: () => void;
  onEnd: () => void;
  onClose: () => void;
  onKick: (p: AdminRoom['players'][number]) => void;
}) {
  const { room: r, expanded } = props;
  return (
    <>
      <tr className={expanded ? 'row-open' : undefined}>
        <td>
          <button className="link" onClick={props.onToggle} aria-expanded={expanded}>
            <span className={`chevron${expanded ? ' open' : ''}`}>›</span> {r.name}
          </button>
        </td>
        <td>
          <code className="code">{r.code}</code>
        </td>
        <td>
          <PhaseBadge phase={r.phase} />
        </td>
        <td className="num">
          {r.players.length}/{r.maxPlayers}
        </td>
        <td className="text-muted">
          {fmtDate.format(r.createdAt)} · {r.createdBy}
        </td>
        <td className="actions">
          {r.phase === 'lobby' && (
            <button className="btn btn-sm btn-success" onClick={props.onStart} disabled={!r.players.length}>
              <Icon name="play" size={16} /> Lancer
            </button>
          )}
          {r.phase === 'playing' && (
            <button className="btn btn-sm btn-warning" onClick={props.onEnd}>
              <Icon name="stop" size={16} /> Terminer
            </button>
          )}
          <button className="btn btn-sm btn-ghost-danger" onClick={props.onClose}>
            Fermer
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="row-detail">
          <td colSpan={6}>
            {r.players.length === 0 ? (
              <p className="text-muted">Aucun joueur. Code à communiquer : {r.code}</p>
            ) : (
              <ul className="player-list">
                {r.players.map((p) => (
                  <li key={p.id}>
                    <span className={`dot ${p.connected ? 'on' : 'off'}`} title={p.connected ? 'Connecté' : 'Déconnecté'} />
                    <span className="strong">{p.displayName}</span>
                    <span className="text-muted">{p.username}</span>
                    <button className="btn btn-xs btn-ghost-danger" onClick={() => props.onKick(p)}>
                      Retirer
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
