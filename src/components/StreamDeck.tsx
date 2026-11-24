import { useEffect, useRef, useState } from 'react';
import { useLive } from '../lib/admin-socket';
import { CLASS_SHORT, SOCIAL_CLASSES, type DeckAction, type LiveRoom } from '../protocol';

export type KeyTone = 'go' | 'warn' | 'danger' | 'info' | 'card' | 'nav' | 'plain' | 'event' | 'money';

export interface DeckKey {
  id: string;
  icon: string;
  label: string;
  sub?: string;
  tone?: KeyTone;
  active?: boolean;
  disabled?: boolean;
  /** Raccourci clavier affiché en coin */
  kbd?: string;
  /** Touche d'affichage seulement (chrono, compteur) */
  display?: boolean;
  onPress?: () => void;
}

export interface DeckPage {
  id: string;
  label: string;
  icon: string;
  keys: DeckKey[];
}

const money = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

/** Touches de la régie, construites depuis l'état en direct de la partie */
export function useDeckPages(live: LiveRoom, offset: number, opts: { onProjector?: () => void; onExport?: () => void; onEnd?: () => void; onEditPlayer?: (characterId: string) => void; notify?: (t: string) => void; onError?: (e: string) => void }): DeckPage[] {
  const { call } = useLive();
  const { screen, control } = live;
  const roomId = screen.roomId;
  const now = useNow(offset, screen.timer.endsAt !== null);
  const run = async (event: Parameters<typeof call>[0], payload: object, ok?: string): Promise<void> => {
    const res = await call(event, payload);
    if (!res.ok) opts.onError?.(res.error);
    else if (ok) opts.notify?.(ok);
  };
  const deck = (action: DeckAction, index?: number) => void run('admin:deck', { roomId, action, index });
  const started = screen.phase !== 'lobby';
  const step = control.deck[control.cursor];
  const kind = step?.kind;
  const replay = !!screen.deck?.replay;
  const drawn = control.characters.length > 0;
  const paused = screen.timer.paused;
  const left = screen.timer.endsAt !== null ? Math.max(0, Math.ceil((screen.timer.endsAt - now) / 1000)) : screen.timer.remaining !== null ? Math.ceil(screen.timer.remaining / 1000) : null;
  const closeLabel = kind === 'year' ? 'Clore l’année' : kind === 'parcoursup' ? 'Clore les vœux' : kind === 'parcoursupResults' ? 'Clore réponses' : kind === 'jobs' ? 'Recruter' : kind === 'poll' ? 'Fermer sondage' : 'Clore';
  const revealLabel = control.revealLabel;
  const revealIcon = revealLabel === 'Lecture' ? '📖' : revealLabel === 'Résultats' ? '📊' : revealLabel === 'Étage suivant' ? '🔺' : '✨';
  const done = control.characters.filter((c) => c.done).length;
  const cards = control.stepCards.map((id) => control.cards.find((c) => c.id === id)).filter(Boolean) as LiveRoom['control']['cards'];
  const toggleCard = (id: string) => void run('admin:card', { roomId, cardId: control.shownCard === id ? null : id });
  const give = (target: string, amount: number, label: string): void =>
    void run('admin:give', { roomId, target, amount }, `${amount > 0 ? '+' : '−'}${money.format(Math.abs(amount))} € · ${label}`);

  const direct: DeckKey[] = [
    { id: 'prev', icon: '⏮', label: 'Précédent', tone: 'nav', kbd: '←', disabled: !started || control.cursor <= 0, onPress: () => deck('prev') },
    {
      id: 'next',
      icon: '⏭',
      label: control.canClose && !replay ? 'Clore + suivant' : 'Suivant',
      tone: 'go',
      kbd: '→',
      disabled: !started,
      onPress: () => deck('next'),
    },
    { id: 'close', icon: '⏹', label: closeLabel, tone: 'warn', kbd: 'C', disabled: !control.canClose, onPress: () => deck('close') },
    { id: 'reveal', icon: revealIcon, label: revealLabel, tone: 'info', kbd: 'R', disabled: !control.canReveal, active: control.canReveal, onPress: () => deck('reveal') },
    {
      id: 'timer',
      icon: left === null ? '⏱' : paused ? '⏸' : String(left),
      label: left === null ? 'Pas de chrono' : paused ? 'En pause' : 'secondes',
      tone: left !== null && left <= 10 && !paused ? 'danger' : 'plain',
      display: true,
    },
    { id: 'pause', icon: paused ? '▶' : '⏸', label: paused ? 'Reprendre' : 'Pause', tone: paused ? 'go' : 'plain', kbd: 'P', active: paused, disabled: !started, onPress: () => deck(paused ? 'resume' : 'pause') },
    { id: 'extend', icon: '+15', label: 'secondes', tone: 'plain', disabled: left === null, onPress: () => deck('extend') },
    {
      id: 'done',
      icon: drawn ? `${done}/${control.characters.length}` : String(screen.lobby.length),
      label: drawn ? 'ont validé' : 'joueurs',
      tone: drawn && done === control.characters.length ? 'go' : 'plain',
      display: true,
    },
    {
      id: 'card',
      icon: control.shownCard ? '🙈' : '🃏',
      label: control.shownCard ? `Retirer ${control.shownCard}` : cards[0] ? `Carte ${cards[0].id}` : 'Pas de carte',
      sub: control.shownCard ? undefined : cards[0]?.figure,
      tone: 'card',
      kbd: 'F',
      active: !!control.shownCard,
      disabled: !started || (!control.shownCard && !cards[0]),
      onPress: () => (control.shownCard ? void run('admin:card', { roomId, cardId: null }) : cards[0] && toggleCard(cards[0].id)),
    },
    { id: 'projector', icon: '🖥', label: 'Écran projeté', tone: 'nav', onPress: opts.onProjector, disabled: !opts.onProjector },
    {
      id: 'step',
      icon: `${control.cursor + 1}`,
      label: step ? step.title : 'Salle d’attente',
      sub: step ? `${step.who}${replay ? ' · relecture' : ''}` : undefined,
      tone: 'plain',
      display: true,
    },
  ];

  const eventKeys: DeckKey[] = control.events.map((ev) => ({
    id: `ev-${ev.id}`,
    icon: ev.emoji,
    label: ev.label,
    sub: ev.description,
    tone: 'event' as const,
    disabled: !drawn,
    onPress: () => void run('admin:event', { roomId, eventId: ev.id }, `${ev.emoji} ${ev.label}`),
  }));

  // Une touche par joueur : ouvre l'éditeur (argent, moyenne, contacts, énergie, statuts…)
  const playerKeys: DeckKey[] = control.characters.map((c) => ({
    id: `p-${c.id}`,
    icon: c.grade.toFixed(1).replace('.', ','),
    label: c.members.join(' & '),
    sub: `${money.format(c.budget)} € · ${CLASS_SHORT[c.origin]}`,
    tone: c.done ? ('go' as const) : ('info' as const),
    active: c.done,
    disabled: !opts.onEditPlayer,
    onPress: () => opts.onEditPlayer?.(c.id),
  }));

  const endKeys: DeckKey[] = [
    { id: 'export', icon: '⬇', label: 'Exporter CSV', tone: 'info', disabled: !drawn || !opts.onExport, onPress: opts.onExport },
    { id: 'end', icon: '🏁', label: 'Terminer', sub: 'et enregistrer', tone: 'danger', disabled: screen.phase !== 'playing' || !opts.onEnd, onPress: opts.onEnd },
  ];

  const cardKeys: DeckKey[] = [
    ...cards.map((c, i) => ({ id: `sc-${c.id}`, icon: c.figure, label: `${c.id} · ${c.title}`, sub: 'cette étape', tone: 'card' as const, kbd: String(i + 1), active: control.shownCard === c.id, disabled: !started, onPress: (): void => toggleCard(c.id) })),
    ...control.cards
      .filter((c) => !control.stepCards.includes(c.id))
      .map((c) => ({ id: `c-${c.id}`, icon: c.figure, label: `${c.id} · ${c.title}`, tone: 'plain' as const, active: control.shownCard === c.id, disabled: !started, onPress: (): void => toggleCard(c.id) })),
  ];

  const moneyKeys: DeckKey[] = [
    ...([1_000, 5_000, 10_000, -1_000, -5_000] as const).map((n): DeckKey => ({
      id: `m-all${n}`,
      icon: `${n > 0 ? '+' : '−'}${Math.abs(n) / 1000} k`,
      label: 'Tout le monde',
      tone: n > 0 ? 'money' : 'danger',
      disabled: !drawn,
      onPress: () => give('all', n, 'tout le monde'),
    })),
    ...SOCIAL_CLASSES.flatMap((c): DeckKey[] =>
      ([2_000, 5_000, -2_000] as const).map((n) => ({
        id: `m-${c}${n}`,
        icon: `${n > 0 ? '+' : '−'}${Math.abs(n) / 1000} k`,
        label: `Origine ${CLASS_SHORT[c].toLowerCase()}`,
        tone: n > 0 ? ('money' as const) : ('danger' as const),
        disabled: !drawn,
        onPress: () => give(`class:${c}`, n, CLASS_SHORT[c].toLowerCase()),
      })),
    ),
  ];

  const stepKeys: DeckKey[] = control.deck.map((s, i) => ({
    id: `s-${s.id}`,
    icon: String(i + 1),
    label: s.title,
    sub: s.who,
    tone: i === control.cursor ? ('go' as const) : s.played ? ('nav' as const) : ('plain' as const),
    active: i === control.cursor,
    disabled: !started || !s.enabled || !(s.played || i === control.furthest + 1),
    onPress: () => deck(i <= control.furthest ? 'goto' : 'next', i <= control.furthest ? i : undefined),
  }));

  return [
    { id: 'direct', label: 'Pilotage', icon: '🎛', keys: direct },
    { id: 'events', label: `Événements · ${eventKeys.length}`, icon: '⚡', keys: eventKeys },
    { id: 'money', label: 'Argent', icon: '💶', keys: moneyKeys },
    { id: 'players', label: 'Joueurs · modifier', icon: '✏️', keys: playerKeys },
    { id: 'cards', label: 'Le saviez-vous ?', icon: '🃏', keys: cardKeys },
    { id: 'end', label: 'Fin de l’exposé', icon: '🏁', keys: endKeys },
    { id: 'steps', label: 'Déroulé', icon: '🗺', keys: stepKeys },
  ];
}

function useNow(offset: number, active: boolean) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now() + offset), 250);
    return () => clearInterval(id);
  }, [offset, active]);
  return now;
}

/** Pavé de touches façon Stream Deck : toutes les sections empilées, des touches carrées sur toute la hauteur */
export function StreamDeck({ pages, cols = 4, big = false }: { pages: DeckPage[]; cols?: number; big?: boolean }) {
  return (
    <div className={`sd${big ? ' big' : ''}`}>
      {pages
        .filter((p) => p.keys.length)
        .map((p) => (
          <section key={p.id} className={`sd-section sd-${p.id}`}>
            <h3>
              <span aria-hidden="true">{p.icon}</span> {p.label}
            </h3>
            <div className="sd-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {p.keys.map((k) => (
                <Key key={k.id} k={k} />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}

function Key({ k }: { k: DeckKey }) {
  const [pressed, setPressed] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(t.current), []);
  const press = () => {
    if (k.display || k.disabled || !k.onPress) return;
    k.onPress();
    setPressed(true);
    clearTimeout(t.current);
    t.current = setTimeout(() => setPressed(false), 260);
  };
  const long = k.icon.length > 3;
  return (
    <button
      className={`sd-key tone-${k.tone ?? 'plain'}${k.active ? ' active' : ''}${pressed ? ' pressed' : ''}${k.display ? ' display' : ''}`}
      disabled={k.disabled && !k.display}
      onClick={press}
      title={k.sub ? `${k.label} · ${k.sub}` : k.label}
      aria-label={k.label}
      tabIndex={k.display ? -1 : 0}
    >
      <span className={`sd-icon${long ? ' long' : ''}`}>{k.icon}</span>
      <span className="sd-label">{k.label}</span>
      {k.sub && <span className="sd-sub">{k.sub}</span>}
      {k.kbd && <kbd className="sd-kbd">{k.kbd}</kbd>}
    </button>
  );
}
