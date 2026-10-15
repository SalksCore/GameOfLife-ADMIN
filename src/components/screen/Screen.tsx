import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  CLASS_LABELS,
  SCENES,
  SOCIAL_CLASSES,
  STAGES,
  STAGE_LABELS,
  type BoardPlayer,
  type BoardView,
  type FinalView,
  type ScreenView,
  type SocialClass,
} from '../../protocol';
import { joinUrl, phoneHost } from '../../lib/phone-url';

/** Couleurs des joueurs (mêmes valeurs que l'application PHONE) */
const PLAYER_COLORS: Record<string, [string, string]> = {
  violet: ['#9b7bff', '#6a48f0'],
  rose: ['#ff7cbc', '#e0408f'],
  rouge: ['#ff6b5b', '#d9402f'],
  orange: ['#ffa04a', '#e57418'],
  jaune: ['#ffd34f', '#e0aa16'],
  vert: ['#5fd68f', '#23a85c'],
  cyan: ['#4fdccf', '#17ab9d'],
  bleu: ['#5ea4ff', '#2b6ce0'],
};

export function Token({ avatar, color, dim = false }: { avatar: string; color: string; dim?: boolean }) {
  const [a, b] = PLAYER_COLORS[color] ?? PLAYER_COLORS.violet!;
  return (
    <span
      className={`scr-token${dim ? ' dim' : ''}`}
      style={{ background: `linear-gradient(160deg, ${a}, ${b})` }}
      aria-hidden="true"
    >
      {avatar}
    </span>
  );
}

const GLIDER = new Set(['0,1', '1,2', '2,0', '2,1', '2,2']);
function LogoMark() {
  return (
    <svg className="scr-logo-mark" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="#11151c" />
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2].map((c) => (
          <rect
            key={`${r}${c}`}
            x={9 + c * 16.5}
            y={9 + r * 16.5}
            width="13"
            height="13"
            rx="3.5"
            fill={GLIDER.has(`${r},${c}`) ? '#c6f25a' : '#ffffff'}
            fillOpacity={GLIDER.has(`${r},${c}`) ? 1 : 0.07}
          />
        )),
      )}
    </svg>
  );
}

function useCountdown(endsAt: number | null, offset: number) {
  const [now, setNow] = useState(() => Date.now() + offset);
  const total = useRef<{ endsAt: number | null; ms: number }>({ endsAt: null, ms: 1 });
  if (total.current.endsAt !== endsAt) total.current = { endsAt, ms: Math.max(1, (endsAt ?? 0) - (Date.now() + offset)) };
  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => setNow(Date.now() + offset), 250);
    return () => clearInterval(id);
  }, [endsAt, offset]);
  if (endsAt === null) return { seconds: null, ratio: 1 };
  const left = Math.max(0, endsAt - now);
  return { seconds: Math.ceil(left / 1000), ratio: Math.min(1, left / total.current.ms) };
}


/** Écran projeté : salle d'attente, plateau en direct, puis pyramide. */
export function Screen({ view, offset }: { view: ScreenView; offset: number }) {
  return (
    <div className="scr">
      {view.board?.final ? (
        <FinalScreen board={view.board} final={view.board.final} />
      ) : view.board ? (
        <BoardScreen view={view} board={view.board} offset={offset} />
      ) : (
        <LobbyScreen view={view} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Salle d'attente

function LobbyScreen({ view }: { view: ScreenView }) {
  const [qr, setQr] = useState<string | null>(null);
  const url = joinUrl(view.code);
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 600, color: { dark: '#0e1116', light: '#ffffff' } }).then(setQr, () =>
      setQr(null),
    );
  }, [url]);

  return (
    <div className="scr-lobby">
      <img className="scr-scene" src="/scenes/lycee.svg" alt="" />
      <div className="scr-lobby-shade" />
      <header className="scr-head">
        <span className="scr-brand">
          <LogoMark />
          <span>
            Game<em>of</em>Life
          </span>
        </span>
        <span className="scr-room">{view.name}</span>
      </header>

      <div className="scr-lobby-main">
        <section className="scr-join">
          <p className="scr-eyebrow">Rejoins la partie sur ton téléphone</p>
          <p className="scr-url">{phoneHost()}</p>
          <div className="scr-code" aria-label={`Code ${view.code}`}>
            {[...view.code].map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </div>
          {qr && <img className="scr-qr" src={qr} alt="QR code pour rejoindre la partie" />}
        </section>

        <section className="scr-crowd">
          <h2>
            <strong>{view.lobby.length}</strong> joueur{view.lobby.length > 1 ? 's' : ''}
            <span> / {view.maxPlayers}</span>
          </h2>
          {view.lobby.length === 0 ? (
            <p className="scr-empty">En attente des premiers joueurs…</p>
          ) : (
            <ul className={`scr-crowd-list${view.lobby.length > 24 ? ' dense' : ''}`}>
              {view.lobby.map((p) => (
                <li key={p.id} className={p.connected ? undefined : 'away'}>
                  <Token avatar={p.avatar} color={p.color} dim={!p.connected} />
                  <span>{p.displayName}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Plateau : la scène en direct

/** Disposition des avatars d'un lieu : petits groupes centrés sur le point d'ancrage, rangées vers l'arrière */
function clusterOffsets(n: number, perRow: number) {
  const out: { dx: number; dy: number }[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / perRow);
    const inRow = Math.min(perRow, n - row * perRow);
    const col = i % perRow;
    out.push({ dx: (col - (inRow - 1) / 2) * 3.1, dy: -row * 3.4 });
  }
  return out;
}

function BoardScreen({ view, board, offset }: { view: ScreenView; board: BoardView; offset: number }) {
  const { seconds, ratio } = useCountdown(board.stepEndsAt, offset);
  const scene = SCENES[board.stage];
  const byPlace = new Map<string, BoardPlayer[]>();
  for (const p of [...board.players].sort((a, b) => a.id.localeCompare(b.id))) {
    const list = byPlace.get(p.place) ?? [];
    list.push(p);
    byPlace.set(p.place, list);
  }
  const counts = { basse: 0, moyenne: 0, riche: 0 };
  for (const p of board.players) counts[p.cls]++;
  const top = [...board.players].sort((a, b) => b.score - a.score).slice(0, 3);
  const showNames = board.players.length <= 30;
  const mm = seconds === null ? '' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div className={`scr-board step-${board.step}`}>
      <img className="scr-scene" src={`/scenes/${board.stage}.svg`} alt="" />
      <div className="scr-scene-shade" />

      {/* Lieux et avatars */}
      <div className="scr-places">
        {scene.places.map((place) => (
          <span key={place.id} className="scr-place-label" style={{ left: `clamp(4cqw, ${place.x}%, calc(100% - 4cqw))`, top: `${place.y + 2.2}%` }}>
            {place.emoji} {place.name}
          </span>
        ))}
        {scene.places.flatMap((place) => {
          const here = byPlace.get(place.id) ?? [];
          const offsets = clusterOffsets(here.length, here.length > 12 ? 8 : 6);
          return here.map((p, i) => (
            <div
              key={p.id}
              className={`scr-avatar${p.activity ? ' busy' : ''}${p.connected ? '' : ' away'}`}
              style={{ left: `clamp(1.8cqw, calc(${place.x}% + ${offsets[i]!.dx}cqw), calc(100% - 1.8cqw))`, top: `calc(${place.y}% + ${offsets[i]!.dy}cqw)` }}
            >
              {p.activity && <span className="scr-doing">{p.activity.emoji}</span>}
              {p.busy && <span className="scr-alert">!</span>}
              <span className="scr-ring" data-cls={p.cls}>
                <Token avatar={p.avatar} color={p.color} dim={!p.connected} />
              </span>
              {showNames && <span className="scr-avatar-name">{p.displayName}</span>}
              {p.pop && (
                <span key={p.pop.id} className={`scr-pop tone-${p.pop.tone}`}>
                  {p.pop.text}
                </span>
              )}
            </div>
          ));
        })}
      </div>

      {/* Bandeau du haut */}
      <header className="scr-hud">
        <div className="scr-stages">
          {STAGES.map((s, i) => (
            <span key={s} className={i < board.stageIndex ? 'done' : i === board.stageIndex ? 'now' : ''}>
              {STAGE_LABELS[s]}
            </span>
          ))}
        </div>
        <div className="scr-clock">
          <span className="scr-timer-bar">
            <span style={{ transform: `scaleX(${board.paused ? 1 : ratio})` }} />
          </span>
          <strong>{board.paused ? 'PAUSE' : mm}</strong>
        </div>
        <span className="scr-code-mini">{view.code}</span>
      </header>

      {/* Panneau : classes, podium, fil */}
      <aside className="scr-panel">
        <div className="scr-classes">
          {(['riche', 'moyenne', 'basse'] as SocialClass[]).map((c) => (
            <div key={c} className="scr-class-row" data-cls={c}>
              <span>{CLASS_LABELS[c]}</span>
              <span className="scr-class-bar">
                <span style={{ width: `${(counts[c] / Math.max(1, board.players.length)) * 100}%` }} />
              </span>
              <b>{counts[c]}</b>
            </div>
          ))}
        </div>
        <ol className="scr-top3">
          {top.map((p, i) => (
            <li key={p.id}>
              <b>{i + 1}</b>
              <Token avatar={p.avatar} color={p.color} />
              <span>{p.displayName}</span>
              <small data-cls={p.cls}>{p.score.toFixed(0)}</small>
            </li>
          ))}
        </ol>
        <ol className="scr-feed">
          {board.feed.slice(0, 5).map((f) => (
            <li key={f.id} className={`tone-${f.tone}`}>
              {f.text}
            </li>
          ))}
        </ol>
      </aside>

      {/* Introduction et bilans d'étape */}
      {board.story && (board.step === 'intro' || board.step === 'milestone') && (
        <div className="scr-story-wrap">
          <section className="scr-story">
            <p className="scr-eyebrow">{board.step === 'milestone' ? 'Bilan de l’étape' : `Étape ${board.stageIndex + 1} sur 3`}</p>
            <h2>{board.story.title}</h2>
            <p>{board.story.text}</p>
          </section>
        </div>
      )}
      {board.paused && <div className="scr-paused">Pause</div>}
    </div>
  );
}

// ---------------------------------------------------------------- Pyramide

function FinalScreen({ board, final }: { board: BoardView; final: FinalView }) {
  const byId = new Map(board.players.map((p) => [p.id, p]));
  const tiers: SocialClass[] = ['riche', 'moyenne', 'basse'];
  const total = board.players.length || 1;
  return (
    <div className="scr-final">
      <header className="scr-final-head">
        <p className="scr-eyebrow">Fin de partie</p>
        <h1>La pyramide sociale</h1>
      </header>
      <div className="scr-final-main">
        <div className="scr-pyramid">
          {tiers.map((cls, i) => (
            <div key={cls} className={`scr-tier tier-${i}`} data-cls={cls}>
              <div className="scr-tier-head">
                <strong>{CLASS_LABELS[cls]}</strong>
                <span>
                  {final.pyramid[cls].length} · {Math.round((final.pyramid[cls].length / total) * 100)} %
                </span>
              </div>
              <ul>
                {final.pyramid[cls].map((id) => {
                  const p = byId.get(id);
                  if (!p) return null;
                  const move = SOCIAL_CLASSES.indexOf(p.cls) - SOCIAL_CLASSES.indexOf(p.origin);
                  return (
                    <li key={id} title={`${p.displayName} (né·e en ${CLASS_LABELS[p.origin].toLowerCase()})`}>
                      <Token avatar={p.avatar} color={p.color} />
                      {move !== 0 && <span className={`scr-move ${move > 0 ? 'up' : 'down'}`}>{move > 0 ? '▲' : '▼'}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <aside className="scr-final-side">
          <section className="scr-card">
            <p className="scr-eyebrow">Podium</p>
            <ol className="scr-podium">
              {final.podium.map((id, i) => {
                const p = byId.get(id);
                return p ? (
                  <li key={id}>
                    <b>{['🥇', '🥈', '🥉'][i]}</b>
                    <Token avatar={p.avatar} color={p.color} />
                    <span>{p.displayName}</span>
                    <small>{p.title}</small>
                  </li>
                ) : null;
              })}
            </ol>
          </section>

          <section className="scr-card">
            <p className="scr-eyebrow">Mobilité sociale (origine → arrivée)</p>
            <table className="scr-matrix">
              <thead>
                <tr>
                  <th />
                  {SOCIAL_CLASSES.map((c) => (
                    <th key={c} data-cls={c}>
                      {CLASS_LABELS[c].replace('Classe ', '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SOCIAL_CLASSES.map((o) => (
                  <tr key={o}>
                    <th data-cls={o}>{CLASS_LABELS[o].replace('Classe ', '')}</th>
                    {SOCIAL_CLASSES.map((c) => (
                      <td key={c} className={o === c ? 'diag' : undefined}>
                        {final.matrix[o][c] || '·'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="scr-moves">
              <span className="up">▲ {final.climbed} montés</span>
              <span>= {final.stayed} restés</span>
              <span className="down">▼ {final.fell} descendus</span>
            </p>
          </section>

          <section className="scr-card scr-takeaways">
            {final.takeaways.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}
