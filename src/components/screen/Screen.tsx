import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  CLASS_LABELS,
  CLASS_THRESHOLDS,
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

const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

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

// ---------------------------------------------------------------- Plateau

function BoardScreen({ view, board, offset }: { view: ScreenView; board: BoardView; offset: number }) {
  const { seconds, ratio } = useCountdown(board.stepEndsAt, offset);
  return (
    <div className={`scr-board step-${board.step}`}>
      <header className="scr-top">
        <div className="scr-stages">
          {STAGES.map((s, i) => (
            <span key={s} className={i < board.stageIndex ? 'done' : i === board.stageIndex ? 'now' : ''}>
              {STAGE_LABELS[s]}
            </span>
          ))}
        </div>
        <div className="scr-timer">
          <span className="scr-timer-bar">
            <span style={{ transform: `scaleX(${board.paused ? 1 : ratio})` }} />
          </span>
          <strong>{board.paused ? 'PAUSE' : (seconds ?? '')}</strong>
        </div>
        <div className="scr-meta">
          {(board.step === 'choose' || board.step === 'reveal') && (
            <span>
              Tour {board.roundIndex + 1}/{board.roundCount}
            </span>
          )}
          {board.step === 'choose' && (
            <span className="scr-answered">
              {board.answered}/{board.total} ont répondu
            </span>
          )}
          <span className="scr-code-mini">{view.code}</span>
        </div>
      </header>

      <div className="scr-body">
        <Ladder players={board.players} showNames={board.players.length <= 24} />
        <aside className="scr-side">
          {board.situation && (board.step === 'choose' || board.step === 'reveal') ? (
            <section className="scr-card scr-situation">
              <span className="scr-sit-emoji">{board.situation.emoji}</span>
              <h2>{board.situation.title}</h2>
              <p>{board.situation.text}</p>
              <ul className="scr-options">
                {board.options.map((o) => {
                  const max = Math.max(1, ...board.options.map((x) => x.count));
                  return (
                    <li key={o.id}>
                      <span className="scr-opt-label">
                        {o.emoji} {o.label}
                      </span>
                      {board.step === 'reveal' && (
                        <span className="scr-opt-bar">
                          <span style={{ width: `${(o.count / max) * 100}%` }} />
                          <b>{o.count}</b>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : board.story ? (
            <section className="scr-card scr-story">
              <p className="scr-eyebrow">{board.step === 'milestone' ? 'Bilan' : STAGE_LABELS[board.stage]}</p>
              <h2>{board.story.title}</h2>
              <p>{board.story.text}</p>
            </section>
          ) : null}

          <section className="scr-feed">
            <ol>
              {board.feed.slice(0, 7).map((f) => (
                <li key={f.id} className={`tone-${f.tone}`}>
                  {f.text}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
      {board.paused && <div className="scr-paused">Pause</div>}
    </div>
  );
}

/** Échelle sociale : chaque joueur est placé selon sa position (0-100), dans la bande de sa classe. */
function Ladder({ players, showNames }: { players: BoardPlayer[]; showNames: boolean }) {
  const sorted = useMemo(() => [...players].sort((a, b) => a.id.localeCompare(b.id)), [players]);
  const bands: { cls: SocialClass; from: number; to: number }[] = [
    { cls: 'riche', from: CLASS_THRESHOLDS.riche, to: 100 },
    { cls: 'moyenne', from: CLASS_THRESHOLDS.moyenne, to: CLASS_THRESHOLDS.riche },
    { cls: 'basse', from: 0, to: CLASS_THRESHOLDS.moyenne },
  ];
  const counts = { basse: 0, moyenne: 0, riche: 0 };
  for (const p of players) counts[p.cls]++;
  const size = players.length <= 12 ? 'lg' : players.length <= 30 ? 'md' : 'sm';

  return (
    <section className={`scr-ladder size-${size}`}>
      {bands.map((b) => (
        <div key={b.cls} className="scr-band" data-cls={b.cls} style={{ height: `${b.to - b.from}%` }}>
          <span className="scr-band-label">
            {CLASS_LABELS[b.cls]} <b>{counts[b.cls]}</b>
          </span>
        </div>
      ))}
      <div className="scr-tokens">
        {sorted.map((p, i) => (
          <div
            key={p.id}
            className={`scr-player${p.trend ? ` trend-${p.trend}` : ''}${p.answered ? ' answered' : ''}`}
            style={{ left: `${((i + 0.5) / sorted.length) * 100}%`, bottom: `${Math.max(1, Math.min(97, p.score))}%` }}
            title={`${p.displayName} · ${p.score.toFixed(0)} · ${money.format(p.capitals.money)}`}
          >
            <Token avatar={p.avatar} color={p.color} dim={!p.connected} />
            {showNames && <span className="scr-player-name">{p.displayName}</span>}
            {p.trend && <span className="scr-trend">{p.trend === 'up' ? '▲' : '▼'}</span>}
          </div>
        ))}
      </div>
    </section>
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
