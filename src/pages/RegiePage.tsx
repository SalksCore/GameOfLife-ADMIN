import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Screen, Token } from '../components/screen/Screen';
import { LiveStats, useLiveHistory } from '../components/LiveStats';
import { PlayerEditor } from '../components/PlayerEditor';
import { StreamDeck, useDeckPages } from '../components/StreamDeck';
import { useConfirm } from '../components/ui';
import { useLive } from '../lib/admin-socket';
import { useLiveRoom } from '../lib/live-room';
import { defaultPhoneUrl, joinUrl, phoneUrl, setPhoneUrl } from '../lib/phone-url';
import {
  CLASS_LABELS,
  CLASS_SHORT,
  DISTRIBUTIONS,
  LIMITS,
  SOCIAL_CLASSES,
  type ControlPlayer,
  type ControlView,
  type DeckAction,
  type Distribution,
  type GameExport,
  type LiveRoom,
  type SocialClass,
  type StepKind,
} from '../protocol';
import { openDeck } from './DeckPage';
import { openProjector } from './ProjectorPage';

const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const clock = (s: number) => `${s < 0 ? '−' : ''}${Math.floor(Math.abs(s) / 60)}:${String(Math.floor(Math.abs(s)) % 60).padStart(2, '0')}`;

type Run = (event: Parameters<ReturnType<typeof useLive>['call']>[0], payload: object) => Promise<boolean>;

const KIND_ICON: Record<StepKind, string> = {
  slide: '▭',
  poll: '◆',
  pollCompare: '◆',
  vote: '◆',
  draw: '●',
  year: '●',
  bac: '●',
  parcoursup: '●',
  parcoursupResults: '●',
  parcoursupFinal: '●',
  diploma: '●',
  jobs: '●',
  final: '●',
  stats: '●',
  debrief: '◈',
};

/** Joueur affiché dans la régie */
interface Row {
  id: string;
  displayName: string;
  avatar: string;
  color: string;
  connected: boolean;
  role: SocialClass | null;
  partner: string | null;
  char: ControlPlayer | null;
}

/**
 * Régie d'un exposé, plein écran (façon logiciel de diffusion) :
 * joueurs à gauche, écran en direct au centre avec les notes, commandes à droite.
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
  const [cardSel, setCardSel] = useState(0);
  const [sideTab, setSideTab] = useState<'deck' | 'player' | 'stats'>('deck');
  const [editId, setEditId] = useState<string | null>(null);
  // Touches affichées ici même si une tablette est branchée
  const [keysHere, setKeysHere] = useState(false);
  const history = useLiveHistory(live);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const { screen, control } = live;
  const roomId = screen.roomId;
  const started = screen.phase !== 'lobby';
  const step = started ? control.deck[control.cursor] : null;

  useEffect(() => {
    document.title = `Régie · ${screen.name}`;
  }, [screen.name]);
  useEffect(() => setCardSel(0), [control.cursor]);

  const run: Run = useCallback(
    async (event, payload) => {
      setError(null);
      const res = await call(event, payload);
      if (!res.ok) setError(res.error);
      return res.ok;
    },
    [call],
  );
  const notify = (text: string) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2_200);
  };
  const deck = useCallback((action: DeckAction, index?: number) => run('admin:deck', { roomId, action, index }), [run, roomId]);
  const stepCards = control.stepCards.map((id) => control.cards.find((c) => c.id === id)).filter(Boolean) as ControlView['cards'];
  const deckPages = useDeckPages(live, offset, {
    onProjector: () => openProjector(roomId),
    onExport: () => void exportGame(),
    onEnd: () => void end(),
    onEditPlayer: (id) => {
      setEditId(id);
      setSideTab('player');
    },
    notify: (t) => notify(t),
    onError: setError,
  });
  const toggleCard = useCallback((id: string | null) => run('admin:card', { roomId, cardId: id }), [run, roomId]);

  // ---- Raccourcis clavier (une télécommande envoie → et ←)
  useEffect(() => {
    if (!started) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key;
      if (k === 'ArrowRight' || k === ' ' || k === 'PageDown') void deck('next');
      else if (k === 'ArrowLeft' || k === 'PageUp') void deck('prev');
      else if (k === 'r' || k === 'R') void deck('reveal');
      else if (k === 'p' || k === 'P') void deck(screen.timer.paused ? 'resume' : 'pause');
      else if (k === 'c' || k === 'C') void deck('close');
      else if (k === 'f' || k === 'F') {
        const c = stepCards[cardSel];
        if (control.shownCard) void toggleCard(null);
        else if (c) void toggleCard(c.id);
      } else if (/^[1-9]$/.test(k)) {
        const i = Number(k) - 1;
        if (stepCards[i]) setCardSel(i);
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [started, deck, screen.timer.paused, stepCards, cardSel, control.shownCard, toggleCard]);

  const chars = new Map<string, ControlPlayer>();
  for (const c of control.characters) chars.set(c.id, c);
  const nameOf = (id: string) => screen.lobby.find((p) => p.id === id)?.displayName ?? '?';
  const rows: Row[] = screen.lobby.map((p) => {
    const partner = control.pairs[p.id] ?? null;
    // Binôme : le personnage porte l'id du premier membre
    const char = chars.get(p.id) ?? (partner ? (chars.get(partner) ?? null) : null);
    return { ...p, role: control.roles[p.id] ?? null, partner, char };
  });
  const drawn = control.characters.length > 0;
  const selectedRow = rows.find((r) => r.id === selected) ?? null;
  const editChar = control.characters.find((c) => c.id === editId) ?? null;
  // Mode Stream Deck : une tablette pilote, la colonne de droite montre les stats et l'éditeur
  const tablet = (live.decks ?? 0) > 0 && !keysHere;
  const tab = tablet && sideTab === 'deck' ? 'stats' : sideTab;
  const pick = (id: string) => {
    setEditId(id);
    setSideTab('player');
  };

  async function kick(row: Row) {
    if (await confirm('Retirer le joueur', <p>Retirer {row.displayName} de la partie ? (dernier recours)</p>, true)) {
      if (await run('admin:kick', { roomId, playerId: row.id })) notify(`${row.displayName} retiré·e`);
    }
  }
  async function give(target: string, amount: number, label: string) {
    if (await run('admin:give', { roomId, target, amount })) notify(`${amount > 0 ? '+' : ''}${money.format(amount)} · ${label}`);
  }
  async function start() {
    const n = screen.lobby.length;
    const pairs = Object.keys(control.pairs).length / 2;
    if (
      await confirm(
        'Lancer l’exposé',
        <p>
          Lancer avec {n} joueur{n > 1 ? 's' : ''}
          {pairs ? ` (dont ${pairs} binôme${pairs > 1 ? 's' : ''})` : ''} ? Plus personne ne pourra rejoindre. Les familles seront tirées à l’étape 4.
        </p>,
      )
    )
      await run('admin:startRoom', { roomId });
  }
  async function end() {
    if (await confirm('Terminer la partie', <p>Enregistrer la partie dans l’historique ? L’écran actuel reste affiché.</p>, true)) {
      if (await run('admin:endRoom', { roomId })) notify('Partie enregistrée dans l’historique');
    }
  }
  async function exportGame() {
    const res = await call<GameExport>('admin:export', { roomId });
    if (!res.ok) return setError(res.error);
    downloadExport(res.data);
    notify('Chiffres exportés');
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
          <span className={`rg-phase phase-${screen.phase}`}>{screen.phase === 'lobby' ? 'Salle d’attente' : screen.phase === 'playing' ? 'En direct' : 'Terminée'}</span>
          {step && (
            <span className="rg-stage">
              {control.cursor + 1} / {control.deck.length} · {step.title}
              {screen.deck?.replay && <em className="rg-replay"> · relecture</em>}
            </span>
          )}
        </div>
        {started && <Budget control={control} offset={offset} />}
        {started && (
          <div className="rg-nav">
            <button className="rg-btn" onClick={() => void deck('prev')} title="Étape précédente (←)">
              ← Précédent
            </button>
            <button className="rg-btn go" onClick={() => void deck('next')} title="Étape suivante (→ ou espace)">
              {control.canClose && !screen.deck?.replay ? 'Clore puis suivant →' : 'Suivant →'}
            </button>
          </div>
        )}
        <div className="rg-top-actions">
          {toast && <span className="rg-toast">{toast}</span>}
          <button className="rg-btn" onClick={() => openProjector(roomId)}>
            Écran projeté ↗
          </button>
        </div>
      </header>

      <div className="rg-body">
        {/* ---------- Joueurs ---------- */}
        <Dock title={`Joueurs · ${rows.length}`} className="rg-players" hint="Clic droit pour agir">
          {rows.length === 0 ? (
            <p className="rg-muted rg-pad">Personne pour l’instant. Le code et le QR code sont affichés à l’écran.</p>
          ) : (
            <>
              {drawn && <ClassSplit chars={control.characters} />}
              <ul className="rg-list">
                {rows.map((r) => (
                  <li
                    key={r.id}
                    className={`${selected === r.id ? 'sel' : ''}${r.connected ? '' : ' away'}`}
                    onClick={() => {
                      setSelected(r.id);
                      if (r.char) {
                        setEditId(r.char.id);
                        if (tab === 'player' || tablet) setSideTab('player');
                      }
                    }}
                    onContextMenu={(e) => openMenu(e, r.id)}
                  >
                    <Token avatar={r.avatar} color={r.color} dim={!r.connected} />
                    <span className="rg-name">
                      {r.displayName}
                      {r.partner && <small className="rg-pair"> 🤝 {nameOf(r.partner)}</small>}
                    </span>
                    {r.char ? (
                      <>
                        {started && <span className={`rg-done${r.char.done ? ' on' : ''}`} title={r.char.done ? 'A validé' : 'N’a pas validé'}>{r.char.done ? '✓' : '·'}</span>}
                        <span className="rg-grade">{r.char.grade.toFixed(1).replace('.', ',')}</span>
                        <span className="rg-cls" data-cls={r.char.origin}>
                          {CLASS_SHORT[r.char.origin]}
                        </span>
                      </>
                    ) : (
                      <span className="rg-cls" data-cls={r.role ?? undefined}>
                        {r.role ? CLASS_SHORT[r.role] : '🎲'}
                      </span>
                    )}
                    <button className="rg-more" onClick={(e) => openMenu(e, r.id)} aria-label={`Actions pour ${r.displayName}`}>
                      ⋯
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {selectedRow && <PlayerDetail row={selectedRow} />}
        </Dock>

        {/* ---------- Programme + notes ---------- */}
        <main className="rg-center">
          <Dock title="Programme" className="rg-program" badge={<span className="rg-live">EN DIRECT</span>}>
            <div className="rg-program-frame">
              <div className="scr-frame">
                <Screen view={screen} offset={offset} />
              </div>
            </div>
          </Dock>
          {started && step && (
            <div className="rg-center-row">
              <Dock title={`Notes de l’orateur · ${step.who}`} className="rg-notes">
                <div className="rg-notes-text">
                  {control.notes.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
                <NextUp control={control} />
              </Dock>
              <Dock title="Faits marquants" className="rg-feed">
                <ul className="rg-feed-list">
                  {screen.feed.length === 0 && <li className="rg-muted">Rien pour l’instant.</li>}
                  {screen.feed.map((f) => (
                    <li key={f.id} className={`tone-${f.tone}`}>
                      {f.text}
                    </li>
                  ))}
                </ul>
              </Dock>
            </div>
          )}
        </main>

        {/* ---------- Commandes de droite ---------- */}
        <aside className="rg-side">
          {error && (
            <div className="rg-error" onClick={() => setError(null)}>
              {error}
            </div>
          )}
          {!started ? (
            <>
              <Dock title="Lancement">
                <div className="rg-pad rg-stack">
                  <button className="rg-btn big go" disabled={!screen.lobby.length} onClick={() => void start()}>
                    ▶ Lancer l’exposé
                  </button>
                  <p className="rg-muted">
                    {screen.lobby.length} joueur{screen.lobby.length > 1 ? 's' : ''} · 25 étapes · environ 32 min prévues
                  </p>
                </div>
              </Dock>
              <Setup control={control} roomId={roomId} code={screen.code} run={run} notify={notify} />
            </>
          ) : (
            <>
              {control.reform && <p className="rg-reform">Réforme adoptée : {control.reform}</p>}
              {(live.decks ?? 0) > 0 && (
                <div className="rg-tablet">
                  <span>🎛 Stream Deck sur la tablette{(live.decks ?? 0) > 1 ? ` (${live.decks})` : ''}</span>
                  <button className="rg-btn small" onClick={() => setKeysHere((v) => !v)}>
                    {keysHere ? 'Masquer les touches' : 'Touches ici aussi'}
                  </button>
                </div>
              )}
              <div className="rg-tabs" role="tablist">
                {!tablet && (
                  <button role="tab" aria-selected={tab === 'deck'} onClick={() => setSideTab('deck')}>
                    🎛 Stream Deck
                  </button>
                )}
                <button role="tab" aria-selected={tab === 'stats'} onClick={() => setSideTab('stats')}>
                  📈 Stats en direct
                </button>
                <button role="tab" aria-selected={tab === 'player'} onClick={() => setSideTab('player')}>
                  ✏️ Joueur{editChar ? ` · ${editChar.members[0]}` : ''}
                </button>
              </div>
              {tab === 'deck' && (
                <Dock title={`Stream Deck · ${deckPages.reduce((n, p) => n + p.keys.length, 0)} touches`} className="rg-deckdock" hint="ou au clavier" badge={<button className="rg-btn small" onClick={() => openDeck(roomId)}>Tablette ↗</button>}>
                  <StreamDeck pages={deckPages} cols={5} />
                </Dock>
              )}
              {tab === 'stats' && (
                <Dock title="Statistiques en direct" className="rg-deckdock" badge={<span className="rg-live">LIVE</span>}>
                  <LiveStats live={live} history={history} onPick={pick} />
                </Dock>
              )}
              {tab === 'player' && (
                <Dock title="Modifier un joueur" className="rg-deckdock">
                  {!drawn ? (
                    <p className="rg-muted rg-pad">Disponible après le tirage des familles.</p>
                  ) : (
                    <>
                      <div className="rg-pad">
                        <select value={editChar?.id ?? ''} onChange={(e) => setEditId(e.target.value || null)} aria-label="Joueur à modifier">
                          <option value="">Choisir un joueur…</option>
                          {control.characters.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.members.join(' & ')} · {CLASS_SHORT[c.origin]}
                            </option>
                          ))}
                        </select>
                      </div>
                      {editChar ? (
                        <PlayerEditor char={editChar} roomId={roomId} onDone={notify} />
                      ) : (
                        <p className="rg-muted rg-pad">Cliquez sur un joueur (liste de gauche, stats ou touche du Stream Deck).</p>
                      )}
                    </>
                  )}
                </Dock>
              )}
            </>
          )}
        </aside>
      </div>

      {/* ---------- Barre d'état ---------- */}
      <footer className="rg-status">
        <span className={`rg-dot ${online ? 'on' : 'off'}`} /> {online ? 'Connecté au serveur' : 'Hors ligne, reconnexion…'}
        {started && drawn && (
          <span>
            Ont validé : <b>{control.characters.filter((c) => c.done).length}</b> / {control.characters.length}
          </span>
        )}
        {screen.timer.paused && <span className="rg-warn">EN PAUSE</span>}
        <span className="rg-grow" />
        {started && <span className="rg-keys">→ suivant · ← précédent · R révéler · C clore · P pause · F carte</span>}
        <span>
          Code <b>{screen.code}</b>
        </span>
      </footer>

      {menu && (
        <PlayerMenu
          x={menu.x}
          y={menu.y}
          row={rows.find((r) => r.id === menu.playerId) ?? null}
          rows={rows}
          canRole={!drawn}
          canPair={!started}
          inGame={drawn}
          onClose={() => setMenu(null)}
          onRole={(role) => void run('admin:setRole', { roomId, playerId: menu.playerId, role })}
          onPair={(partnerId) => void run('admin:pair', { roomId, playerId: menu.playerId, partnerId }).then((ok) => ok && notify(partnerId ? 'Binôme formé' : 'Binôme défait'))}
          onGive={(amount, name) => void give(menu.playerId, amount, name)}
          onKick={(row) => void kick(row)}
        />
      )}
      {dialog}
    </div>
  );
}

function downloadExport(data: GameExport) {
  const cols = Object.keys(data.rows[0] ?? {});
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    `${esc('Partie')};${esc(data.name)};${esc('Code')};${esc(data.code)};${esc('Date')};${esc(new Date(data.date).toLocaleString('fr-FR'))};${esc('Réforme')};${esc(data.reform ?? '—')}`,
    '',
    ['Indicateur', ...SOCIAL_CLASSES.map((c) => CLASS_LABELS[c]), 'Réel'].map(esc).join(';'),
    ...data.stats.map((s) => [s.label, ...SOCIAL_CLASSES.map((c) => `${s.values[c]}${s.unit === '%' ? ' %' : s.unit === '€' ? ' €' : ''}`), s.real ?? ''].map(esc).join(';')),
    '',
    cols.map(esc).join(';'),
    ...data.rows.map((r) => cols.map((c) => esc(r[c])).join(';')),
  ];
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gameoflife-${data.code}-${data.date.slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1_000);
}

// ---------------------------------------------------------------- Panneaux

function Dock({ title, hint, badge, className = '', children }: { title: string; hint?: string; badge?: ReactNode; className?: string; children: ReactNode }) {
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

/** Chrono de l'étape et budget de l'exposé (avance / retard sur le déroulé) */
function Budget({ control, offset }: { control: ControlView; offset: number }) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offset), 1_000);
    return () => clearInterval(id);
  }, [offset]);
  if (control.startedAt === null) return null;
  const elapsed = (now - control.startedAt) / 1000;
  const total = control.deck.filter((s) => s.enabled).reduce((s, d) => s + d.plan, 0);
  // Fin prévue de l'étape en cours
  const plannedEnd = control.deck.slice(0, control.cursor + 1).filter((s) => s.enabled).reduce((s, d) => s + d.plan, 0);
  const plannedStart = plannedEnd - (control.deck[control.cursor]?.plan ?? 0);
  const delta = elapsed - Math.min(Math.max(elapsed, plannedStart), plannedEnd);
  return (
    <div className={`rg-budget${delta > 60 ? ' late' : delta < -30 ? ' early' : ''}`} title="Temps écoulé / budget de l’exposé">
      <strong>{clock(elapsed)}</strong>
      <span>/ {clock(total)}</span>
      <em>{Math.abs(delta) < 10 ? 'dans les temps' : delta > 0 ? `${clock(delta)} de retard` : `${clock(-delta)} d’avance`}</em>
    </div>
  );
}

function NextUp({ control }: { control: ControlView }) {
  let i = control.cursor + 1;
  while (i < control.deck.length && !control.deck[i]!.enabled) i++;
  const next = control.deck[i];
  return <p className="rg-next">{next ? `Ensuite : ${KIND_ICON[next.kind]} ${next.title} (${next.who})` : 'C’est la dernière étape.'}</p>;
}

function ClassSplit({ chars }: { chars: ControlPlayer[] }) {
  const n = chars.length || 1;
  return (
    <div className="rg-split" title="Répartition des familles">
      {SOCIAL_CLASSES.map((c) => {
        const k = chars.filter((x) => x.origin === c).length;
        return (
          <span key={c} data-cls={c} style={{ flex: k / n }}>
            {k}
          </span>
        );
      })}
    </div>
  );
}

function PlayerDetail({ row }: { row: Row }) {
  const g = row.char;
  return (
    <div className="rg-detail">
      <div className="rg-detail-head">
        <Token avatar={row.avatar} color={row.color} dim={!row.connected} />
        <div>
          <strong>{g ? g.members.join(' & ') : row.displayName}</strong>
          <small>{row.connected ? 'Connecté·e' : 'Déconnecté·e'}</small>
        </div>
      </div>
      {g ? (
        <dl>
          <dt>Origine</dt>
          <dd data-cls={g.origin} className="rg-cls-text">
            {CLASS_LABELS[g.origin]}
          </dd>
          <dt>Situation</dt>
          <dd>{g.status}</dd>
          <dt>Lycée</dt>
          <dd>{g.school}</dd>
          <dt>Moyenne · contacts · énergie</dt>
          <dd>
            {g.grade.toFixed(1)} · {g.contacts.toFixed(1)} · {g.energy.toFixed(1)}
          </dd>
          <dt>Budget</dt>
          <dd>{money.format(g.budget)}</dd>
          <dt>Diplôme</dt>
          <dd>
            {g.diploma ?? '—'}
            {g.boursier && ' · boursier'}
          </dd>
        </dl>
      ) : (
        <p className="rg-muted">Famille : {row.role ? CLASS_LABELS[row.role] : 'tirage au sort'}. Clic droit pour imposer une famille ou former un binôme.</p>
      )}
    </div>
  );
}

/** Menu contextuel d'un joueur (clic droit ou bouton ⋯) */
function PlayerMenu({
  x,
  y,
  row,
  rows,
  canRole,
  canPair,
  inGame,
  onClose,
  onRole,
  onPair,
  onGive,
  onKick,
}: {
  x: number;
  y: number;
  row: Row | null;
  rows: Row[];
  canRole: boolean;
  canPair: boolean;
  inGame: boolean;
  onClose: () => void;
  onRole: (role: SocialClass | null) => void;
  onPair: (partnerId: string | null) => void;
  onGive: (amount: number, name: string) => void;
  onKick: (row: Row) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [custom, setCustom] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [amount, setAmount] = useState(1_000);
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ x: Math.min(x, innerWidth - r.width - 8), y: Math.max(8, Math.min(y, innerHeight - r.height - 8)) });
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [x, y, onClose, pairing]);

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
      {canRole && (
        <>
          <div className="rg-menu-label">Famille au tirage</div>
          <button role="menuitemradio" aria-checked={!row.role} onClick={act(() => onRole(null))}>
            🎲 Tirage au sort {!row.role && '✓'}
          </button>
          {SOCIAL_CLASSES.map((c) => (
            <button key={c} role="menuitemradio" aria-checked={row.role === c} data-cls={c} className="rg-menu-cls" onClick={act(() => onRole(c))}>
              ● Imposer : {CLASS_LABELS[c]} {row.role === c && '✓'}
            </button>
          ))}
          <hr />
        </>
      )}
      {canPair && (
        <>
          <div className="rg-menu-label">Binôme</div>
          {row.partner ? (
            <button role="menuitem" onClick={act(() => onPair(null))}>
              ✂️ Défaire le binôme
            </button>
          ) : pairing ? (
            <div className="rg-menu-scroll">
              {rows
                .filter((r) => r.id !== row.id && !r.partner)
                .map((r) => (
                  <button key={r.id} role="menuitem" onClick={act(() => onPair(r.id))}>
                    🤝 avec {r.displayName}
                  </button>
                ))}
            </div>
          ) : (
            <button role="menuitem" onClick={() => setPairing(true)}>
              🤝 Former un binôme…
            </button>
          )}
          <hr />
        </>
      )}
      {inGame && (
        <>
          <div className="rg-menu-label">Argent</div>
          {[1_000, 5_000].map((v) => (
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

function Setup({ control, roomId, code, run, notify }: { control: ControlView; roomId: string; code: string; run: Run; notify: (t: string) => void }) {
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
          <span>
            Durée d’une année : <b>{control.config.yearSeconds} s</b>
          </span>
          <input type="range" min={LIMITS.yearSecondsMin} max={LIMITS.yearSecondsMax} step={5} value={control.config.yearSeconds} onChange={(e) => configure({ yearSeconds: Number(e.target.value) })} />
          <span className="rg-presets">
            {[45, 60, 75].map((s) => (
              <button key={s} type="button" className={`rg-btn small${control.config.yearSeconds === s ? ' on' : ''}`} onClick={() => configure({ yearSeconds: s })}>
                {s} s{s === 60 ? ' (conseillé)' : s === 45 ? ' (retard)' : ''}
              </button>
            ))}
          </span>
        </label>

        <div className="rg-field">
          <span>Répartition des familles au tirage</span>
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
          <small className="rg-muted">Au moins 2 joueurs par classe (à partir de 6 joueurs).</small>
        </div>

        <label className="rg-check">
          <input type="checkbox" checked={control.config.addressEffect} onChange={(e) => configure({ addressEffect: e.target.checked })} />
          <span>Effet adresse à l’embauche (−0,04 pour le lycée de quartier)</span>
        </label>

        <form className="rg-field" onSubmit={saveUrl}>
          <span>Adresse du jeu pour les joueurs</span>
          <div className="rg-inline">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={defaultPhoneUrl()} />
            <button className="rg-btn">OK</button>
          </div>
          <small className="rg-muted">En classe : l’adresse IP de ce PC, ex. http://192.168.1.20:5173</small>
        </form>
        <button className="rg-btn" onClick={() => void navigator.clipboard.writeText(joinUrl(code)).then(() => notify('Lien d’invitation copié'))}>
          Copier le lien d’invitation
        </button>
      </div>
    </Dock>
  );
}
