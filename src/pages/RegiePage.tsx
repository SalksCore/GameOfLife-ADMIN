import { useEffect, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Screen, Token } from '../components/screen/Screen';
import { useConfirm } from '../components/ui';
import { useLive } from '../lib/admin-socket';
import { useLiveRoom } from '../lib/live-room';
import { defaultPhoneUrl, joinUrl, phoneUrl, setPhoneUrl } from '../lib/phone-url';
import {
  CLASS_LABELS,
  DISTRIBUTIONS,
  LIMITS,
  SOCIAL_CLASSES,
  STAGE_LABELS,
  type BoardPlayer,
  type ControlView,
  type Distribution,
  type GameControl,
  type LiveRoom,
  type SocialClass,
} from '../protocol';
import { openProjector } from './ProjectorPage';

const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const short = (c: SocialClass) => CLASS_LABELS[c].replace('Classe ', '');

type Run = (event: Parameters<ReturnType<typeof useLive>['call']>[0], payload: object) => Promise<boolean>;

/** Joueur affiché dans la régie (salle d'attente ou partie) */
interface Row {
  id: string;
  displayName: string;
  avatar: string;
  color: string;
  connected: boolean;
  /** Classe imposée (salle d'attente) */
  role: SocialClass | null;
  game: BoardPlayer | null;
}

/**
 * Gestion d'une partie, plein écran et sans le menu du panneau (façon logiciel de diffusion) :
 * programme en direct au centre, joueurs à gauche (clic droit = actions), commandes à droite.
 */
export function RegiePage() {
  const { id } = useParams();
  const { live, offset, missing } = useLiveRoom(id);
  const { online } = useLive();

  if (missing)
    return (
      <div className="rg-empty">
        <p>Cette partie n’existe plus (fermée, ou serveur redémarré).</p>
        <Link to="/parties">Retour aux parties</Link>
      </div>
    );
  if (!live) return <div className="rg-empty">Connexion à la partie…</div>;
  return <Regie live={live} offset={offset} online={online} />;
}

function Regie({ live, offset, online }: { live: LiveRoom; offset: number; online: boolean }) {
  const { call } = useLive();
  const { confirm, dialog } = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; playerId: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const { screen, control } = live;
  const roomId = screen.roomId;
  const board = screen.board;
  const inGame = !!board && !board.final;

  useEffect(() => {
    document.title = `Gestion · ${screen.name}`;
  }, [screen.name]);

  const run: Run = async (event, payload) => {
    setError(null);
    const res = await call(event, payload);
    if (!res.ok) setError(res.error);
    return res.ok;
  };
  const notify = (text: string) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2_200);
  };
  const gameControl = (action: GameControl) => run('admin:gameControl', { roomId, action });

  const rows: Row[] = board
    ? [...board.players]
        .sort((a, b) => b.score - a.score)
        .map((p) => ({ ...p, role: null, game: p }))
    : screen.lobby.map((p) => ({ ...p, role: control.roles[p.id] ?? null, game: null }));
  const selectedRow = rows.find((r) => r.id === selected) ?? null;

  async function kick(row: Row) {
    if (await confirm('Retirer le joueur', <p>Retirer {row.displayName} de la partie ?</p>, true)) {
      if (await run('admin:kick', { roomId, playerId: row.id })) notify(`${row.displayName} retiré·e`);
    }
  }
  async function give(target: string, amount: number, label: string) {
    if (await run('admin:give', { roomId, target, amount }))
      notify(`${amount > 0 ? '+' : ''}${money.format(amount)} · ${label}`);
  }
  async function start() {
    const n = screen.lobby.length;
    if (
      await confirm(
        'Lancer la partie',
        <p>
          Lancer avec {n} joueur{n > 1 ? 's' : ''} ? Les classes sont tirées au sort (sauf celles imposées), puis plus
          personne ne peut rejoindre.
        </p>,
      )
    )
      await run('admin:startRoom', { roomId });
  }
  async function end() {
    if (await confirm('Terminer la partie', <p>Passer directement à la pyramide sociale ?</p>, true))
      await run('admin:endRoom', { roomId });
  }

  const openMenu = (e: ReactMouseEvent, playerId: string) => {
    e.preventDefault();
    setSelected(playerId);
    setMenu({ x: e.clientX, y: e.clientY, playerId });
  };

  return (
    <div className="rg" onContextMenu={(e) => e.target === e.currentTarget && e.preventDefault()}>
      {/* ---------- Barre du haut ---------- */}
      <header className="rg-top">
        <Link to="/parties" className="rg-back" title="Retour au panneau">
          ‹ Panneau
        </Link>
        <div className="rg-title">
          <strong>{screen.name}</strong>
          <span className="rg-code">{screen.code}</span>
          <span className={`rg-phase phase-${screen.phase}`}>
            {screen.phase === 'lobby' ? 'Salle d’attente' : screen.phase === 'playing' ? 'En jeu' : 'Terminée'}
          </span>
          {inGame && (
            <span className="rg-stage">
              {STAGE_LABELS[board.stage]} · {board.step === 'play' ? 'temps libre' : board.step === 'intro' ? 'introduction' : 'bilan'}
            </span>
          )}
        </div>
        <div className="rg-top-actions">
          {toast && <span className="rg-toast">{toast}</span>}
          <button className="rg-btn" onClick={() => openProjector(roomId)}>
            Ouvrir l’écran (projecteur)
          </button>
        </div>
      </header>

      <div className="rg-body">
        {/* ---------- Joueurs ---------- */}
        <Dock title={`Joueurs · ${rows.length}`} className="rg-players" hint="Clic droit sur un joueur pour agir">
          {rows.length === 0 ? (
            <p className="rg-muted rg-pad">Personne pour l’instant. Le code et le QR code sont affichés à l’écran.</p>
          ) : (
            <ul className="rg-list">
              {rows.map((r, i) => (
                <li
                  key={r.id}
                  className={`${selected === r.id ? 'sel' : ''}${r.connected ? '' : ' away'}`}
                  onClick={() => setSelected(r.id)}
                  onContextMenu={(e) => openMenu(e, r.id)}
                >
                  {r.game && <span className="rg-rank">{i + 1}</span>}
                  <Token avatar={r.avatar} color={r.color} dim={!r.connected} />
                  <span className="rg-name">{r.displayName}</span>
                  {r.game ? (
                    <>
                      {r.game.busy ? (
                        <span className="rg-doing alert" title={control.pending[r.id] ?? 'Situation en cours'}>
                          !
                        </span>
                      ) : (
                        r.game.activity && (
                          <span className="rg-doing" title={r.game.activity.label}>
                            {r.game.activity.emoji}
                          </span>
                        )
                      )}
                      <span className="rg-cls" data-cls={r.game.cls}>
                        {short(r.game.cls)}
                      </span>
                      <span className="rg-score">{r.game.score.toFixed(0)}</span>
                    </>
                  ) : (
                    <span className="rg-cls" data-cls={r.role ?? undefined}>
                      {r.role ? short(r.role) : '🎲'}
                    </span>
                  )}
                  <button className="rg-more" onClick={(e) => openMenu(e, r.id)} aria-label={`Actions pour ${r.displayName}`}>
                    ⋯
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selectedRow && <PlayerDetail row={selectedRow} pending={control.pending[selectedRow.id] ?? null} />}
        </Dock>

        {/* ---------- Programme ---------- */}
        <main className="rg-center">
          <Dock title="Programme" className="rg-program" badge={<span className="rg-live">EN DIRECT</span>}>
            <div className="rg-program-frame">
              <div className="scr-frame">
                <Screen view={screen} offset={offset} />
              </div>
            </div>
          </Dock>

          {inGame && (
            <div className="rg-center-row">
              <Dock title="En ce moment" className="rg-now">
                <ul className="rg-now-list">
                  {board.players
                    .filter((p) => p.activity || p.busy)
                    .map((p) => (
                      <li key={p.id}>
                        <Token avatar={p.avatar} color={p.color} />
                        <strong>{p.displayName}</strong>
                        <span>{p.busy ? `répond à : ${control.pending[p.id] ?? 'une situation'}` : `${p.activity!.emoji} ${p.activity!.label}`}</span>
                      </li>
                    ))}
                </ul>
              </Dock>
              <Dock title="Commandes" className="rg-transport">
                <div className="rg-transport-grid">
                  {board.paused ? (
                    <button className="rg-btn big go" onClick={() => void gameControl('resume')}>
                      ▶ Reprendre
                    </button>
                  ) : (
                    <button className="rg-btn big" onClick={() => void gameControl('pause')}>
                      ❚❚ Pause
                    </button>
                  )}
                  <button className="rg-btn" onClick={() => void gameControl('nextStage')}>
                    ⏩ {board.step === 'milestone' ? 'Étape suivante' : `Finir « ${STAGE_LABELS[board.stage]} » (bilan)`}
                  </button>
                  <button className="rg-btn danger" onClick={() => void end()}>
                    ■ Terminer (pyramide)
                  </button>
                </div>
              </Dock>
            </div>
          )}
        </main>

        {/* ---------- Commandes de droite ---------- */}
        <aside className="rg-side">
          {error && <div className="rg-error">{error}</div>}
          {screen.phase === 'lobby' && (
            <>
              <Dock title="Lancement">
                <div className="rg-pad rg-stack">
                  <button className="rg-btn big go" disabled={!screen.lobby.length} onClick={() => void start()}>
                    ▶ Lancer la partie
                  </button>
                  <p className="rg-muted">
                    {screen.lobby.length} joueur{screen.lobby.length > 1 ? 's' : ''} · durée totale {control.config.stageMinutes * 3} min
                  </p>
                </div>
              </Dock>
              <Setup control={control} roomId={roomId} code={screen.code} run={run} notify={notify} />
            </>
          )}
          {inGame && (
            <>
              <MoneyDock players={board.players} onGive={give} />
              <Dock title="Événements" hint="Effet immédiat, annoncé à l’écran">
                <div className="rg-events">
                  {control.events.map((ev) => (
                    <button
                      key={ev.id}
                      className="rg-event"
                      title={ev.description}
                      onClick={() => void run('admin:event', { roomId, eventId: ev.id }).then((ok) => ok && notify(`${ev.emoji} ${ev.label}`))}
                    >
                      <span>{ev.emoji}</span>
                      <strong>{ev.label}</strong>
                      <small>{ev.description}</small>
                    </button>
                  ))}
                </div>
              </Dock>
            </>
          )}
          {board?.final && (
            <Dock title="Partie terminée">
              <p className="rg-pad rg-muted">La pyramide sociale est affichée à l’écran. La partie est enregistrée dans l’historique.</p>
            </Dock>
          )}
        </aside>
      </div>

      {/* ---------- Barre d'état ---------- */}
      <footer className="rg-status">
        <span className={`rg-dot ${online ? 'on' : 'off'}`} /> {online ? 'Connecté au serveur' : 'Hors ligne, reconnexion…'}
        {board?.step === 'play' && (
          <span>
            Situations en attente : <b>{board.players.filter((p) => p.busy).length}</b> · Activités : <b>{board.players.filter((p) => p.activity).length}</b>
          </span>
        )}
        {board?.paused && <span className="rg-warn">EN PAUSE</span>}
        <span className="rg-grow" />
        <span>
          Code <b>{screen.code}</b>
        </span>
      </footer>

      {menu && (
        <PlayerMenu
          x={menu.x}
          y={menu.y}
          row={rows.find((r) => r.id === menu.playerId) ?? null}
          inLobby={screen.phase === 'lobby'}
          inGame={inGame}
          onClose={() => setMenu(null)}
          onRole={(role) => void run('admin:setRole', { roomId, playerId: menu.playerId, role })}
          onGive={(amount, name) => void give(menu.playerId, amount, name)}
          onNudge={() => void run('admin:nudge', { roomId, playerId: menu.playerId }).then((ok) => ok && notify('Situation envoyée'))}
          onKick={(row) => void kick(row)}
        />
      )}
      {dialog}
    </div>
  );
}

// ---------------------------------------------------------------- Panneaux

function Dock({
  title,
  hint,
  badge,
  className = '',
  children,
}: {
  title: string;
  hint?: string;
  badge?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`rg-dock ${className}`}>
      <header className="rg-dock-head">
        <span>{title}</span>
        {badge}
        {hint && <small>{hint}</small>}
      </header>
      <div className="rg-dock-body">{children}</div>
    </section>
  );
}

function PlayerDetail({ row, pending }: { row: Row; pending: string | null }) {
  const g = row.game;
  return (
    <div className="rg-detail">
      <div className="rg-detail-head">
        <Token avatar={row.avatar} color={row.color} dim={!row.connected} />
        <div>
          <strong>{row.displayName}</strong>
          <small>{row.connected ? 'Connecté·e' : 'Déconnecté·e'}</small>
        </div>
      </div>
      {g ? (
        <dl>
          <dt>Origine</dt>
          <dd data-cls={g.origin} className="rg-cls-text">
            {CLASS_LABELS[g.origin]}
          </dd>
          <dt>Classe actuelle</dt>
          <dd data-cls={g.cls} className="rg-cls-text">
            {CLASS_LABELS[g.cls]} ({g.score.toFixed(1)})
          </dd>
          <dt>Argent</dt>
          <dd>{money.format(g.capitals.money)}</dd>
          <dt>Savoir · Réseau · Moral</dt>
          <dd>
            {Math.round(g.capitals.savoir)} · {Math.round(g.capitals.reseau)} · {Math.round(g.capitals.moral)}
          </dd>
          <dt>Dernier titre</dt>
          <dd>{g.title ?? '—'}</dd>
          <dt>Activité</dt>
          <dd>{g.activity ? `${g.activity.emoji} ${g.activity.label}` : '—'}</dd>
          <dt>Situation en attente</dt>
          <dd>{pending ?? '—'}</dd>
        </dl>
      ) : (
        <p className="rg-muted">
          Classe : {row.role ? CLASS_LABELS[row.role] : 'tirage au sort'}. Clic droit pour imposer une classe.
        </p>
      )}
    </div>
  );
}

/** Menu contextuel d'un joueur (clic droit ou bouton ⋯) */
function PlayerMenu({
  x,
  y,
  row,
  inLobby,
  inGame,
  onClose,
  onRole,
  onGive,
  onNudge,
  onKick,
}: {
  x: number;
  y: number;
  row: Row | null;
  inLobby: boolean;
  inGame: boolean;
  onClose: () => void;
  onRole: (role: SocialClass | null) => void;
  onGive: (amount: number, name: string) => void;
  onNudge: () => void;
  onKick: (row: Row) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [custom, setCustom] = useState(false);
  const [amount, setAmount] = useState(1_000);
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    // Le menu reste dans la fenêtre
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ x: Math.min(x, innerWidth - r.width - 8), y: Math.min(y, innerHeight - r.height - 8) });
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [x, y, onClose]);

  if (!row) return null;
  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    if (amount) act(() => onGive(amount, row!.displayName))();
  }

  return (
    <div ref={ref} className="rg-menu" style={{ left: pos.x, top: pos.y }} role="menu">
      <div className="rg-menu-title">{row.displayName}</div>
      {inLobby && (
        <>
          <div className="rg-menu-label">Classe au lancement</div>
          <button role="menuitemradio" aria-checked={!row.role} onClick={act(() => onRole(null))}>
            🎲 Tirage au sort {!row.role && '✓'}
          </button>
          {SOCIAL_CLASSES.map((c) => (
            <button key={c} role="menuitemradio" aria-checked={row.role === c} data-cls={c} className="rg-menu-cls" onClick={act(() => onRole(c))}>
              ● {CLASS_LABELS[c]} {row.role === c && '✓'}
            </button>
          ))}
          <hr />
        </>
      )}
      {inGame && (
        <>
          <button role="menuitem" onClick={act(onNudge)}>
            🎴 Envoyer une situation de vie
          </button>
          <div className="rg-menu-label">Argent</div>
          {[500, 2_000, 10_000].map((v) => (
            <button key={v} role="menuitem" onClick={act(() => onGive(v, row.displayName))}>
              💶 Donner {money.format(v)}
            </button>
          ))}
          <button role="menuitem" onClick={act(() => onGive(-1_000, row.displayName))}>
            💸 Retirer {money.format(1_000)}
          </button>
          {custom ? (
            <form className="rg-menu-form" onSubmit={submit}>
              <input type="number" value={amount} step={100} min={-LIMITS.giveMax} max={LIMITS.giveMax} autoFocus onChange={(e) => setAmount(Number(e.target.value))} />
              <button className="rg-btn go">OK</button>
            </form>
          ) : (
            <button role="menuitem" onClick={() => setCustom(true)}>
              ✏️ Montant personnalisé…
            </button>
          )}
          <hr />
        </>
      )}
      <button role="menuitem" className="danger" onClick={act(() => onKick(row))}>
        Retirer de la partie
      </button>
    </div>
  );
}

function Setup({
  control,
  roomId,
  code,
  run,
  notify,
}: {
  control: ControlView;
  roomId: string;
  code: string;
  run: Run;
  notify: (t: string) => void;
}) {
  const [url, setUrl] = useState(phoneUrl());
  const configure = (config: object) => void run('admin:configure', { roomId, config });

  function saveUrl(e: FormEvent) {
    e.preventDefault();
    setPhoneUrl(url);
    setUrl(phoneUrl());
    notify('Adresse enregistrée (rechargez l’écran du projecteur)');
  }

  return (
    <Dock title="Préréglages">
      <div className="rg-pad rg-stack">
        <label className="rg-field">
          <span>Durée de chaque étape</span>
          <select value={control.config.stageMinutes} onChange={(e) => configure({ stageMinutes: Number(e.target.value) })}>
            {Array.from({ length: LIMITS.stageMinutesMax - LIMITS.stageMinutesMin + 1 }, (_, i) => i + LIMITS.stageMinutesMin).map((m) => (
              <option key={m} value={m}>
                {m} min{m === 5 ? ' (recommandé)' : ''}
              </option>
            ))}
          </select>
        </label>

        <div className="rg-field">
          <span>Répartition des classes au tirage</span>
          {(Object.keys(DISTRIBUTIONS) as Distribution[]).map((d) => {
            const w = DISTRIBUTIONS[d].weights;
            const total = SOCIAL_CLASSES.reduce((s, c) => s + w[c], 0);
            return (
              <label key={d} className={`rg-preset${control.config.distribution === d ? ' on' : ''}`}>
                <input type="radio" name="distribution" checked={control.config.distribution === d} onChange={() => configure({ distribution: d })} />
                <span>{DISTRIBUTIONS[d].label}</span>
                <span className="rg-dist" aria-hidden="true">
                  {SOCIAL_CLASSES.map((c) => (
                    <span key={c} data-cls={c} style={{ flex: w[c] / total }} />
                  ))}
                </span>
              </label>
            );
          })}
        </div>

        <form className="rg-field" onSubmit={saveUrl}>
          <span>Adresse du jeu pour les joueurs</span>
          <div className="rg-inline">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={defaultPhoneUrl()} />
            <button className="rg-btn">OK</button>
          </div>
          <small className="rg-muted">En classe : l’adresse IP de ce PC, ex. http://192.168.1.20:5173</small>
        </form>
        <button
          className="rg-btn"
          onClick={() => void navigator.clipboard.writeText(joinUrl(code)).then(() => notify('Lien d’invitation copié'))}
        >
          Copier le lien d’invitation
        </button>
      </div>
    </Dock>
  );
}

function MoneyDock({ players, onGive }: { players: BoardPlayer[]; onGive: (target: string, amount: number, label: string) => void }) {
  const [target, setTarget] = useState('all');
  const [amount, setAmount] = useState(1_000);
  const label =
    target === 'all'
      ? 'tout le monde'
      : target.startsWith('class:')
        ? CLASS_LABELS[target.slice(6) as SocialClass].toLowerCase()
        : (players.find((p) => p.id === target)?.displayName ?? '');
  return (
    <Dock title="Argent">
      <div className="rg-pad rg-stack">
        <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Bénéficiaire">
          <option value="all">Tout le monde</option>
          {SOCIAL_CLASSES.map((c) => (
            <option key={c} value={`class:${c}`}>
              {CLASS_LABELS[c]} (actuelle)
            </option>
          ))}
          <optgroup label="Un joueur">
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName} · {money.format(p.capitals.money)}
              </option>
            ))}
          </optgroup>
        </select>
        <div className="rg-inline">
          <input type="number" value={amount} step={100} min={-LIMITS.giveMax} max={LIMITS.giveMax} onChange={(e) => setAmount(Number(e.target.value))} aria-label="Montant" />
          <button className="rg-btn go" onClick={() => amount && onGive(target, Math.abs(amount), label)}>
            Donner
          </button>
          <button className="rg-btn danger" onClick={() => amount && onGive(target, -Math.abs(amount), label)}>
            Retirer
          </button>
        </div>
        <div className="rg-quick">
          {[500, 2_000, 10_000, -1_000].map((v) => (
            <button key={v} className="rg-btn small" onClick={() => onGive(target, v, label)}>
              {v > 0 ? '+' : ''}
              {money.format(v)}
            </button>
          ))}
        </div>
      </div>
    </Dock>
  );
}
