import { useEffect, useRef, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import {
  CLASS_LABELS,
  CLASS_SHORT,
  SOCIAL_CLASSES,
  type DebriefView,
  type FactCard,
  type ScreenPlayer,
  type ScreenStep,
  type ScreenView,
  type SocialClass,
  type Stage,
} from '../../protocol';
import { joinUrl, phoneHost } from '../../lib/phone-url';
import { GameIcon } from '../GameIcon';
import { Portrait } from '../Portrait';

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
  const [a] = PLAYER_COLORS[color] ?? PLAYER_COLORS.violet!;
  return (
    <span className={`scr-token${dim ? ' dim' : ''}`} aria-hidden="true">
      <Portrait code={avatar} bg={a} />
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
          <rect key={`${r}${c}`} x={9 + c * 16.5} y={9 + r * 16.5} width="13" height="13" rx="3.5" fill={GLIDER.has(`${r},${c}`) ? '#c6f25a' : '#ffffff'} fillOpacity={GLIDER.has(`${r},${c}`) ? 1 : 0.07} />
        )),
      )}
    </svg>
  );
}

function useCountdown(endsAt: number | null, remaining: number | null, offset: number) {
  const [now, setNow] = useState(() => Date.now() + offset);
  const total = useRef<{ endsAt: number | null; ms: number }>({ endsAt: null, ms: 1 });
  if (endsAt !== null && total.current.endsAt !== endsAt) total.current = { endsAt, ms: Math.max(1, endsAt - (Date.now() + offset)) };
  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => setNow(Date.now() + offset), 250);
    return () => clearInterval(id);
  }, [endsAt, offset]);
  const left = endsAt !== null ? Math.max(0, endsAt - now) : remaining;
  if (left === null) return { seconds: null, ratio: 1 };
  return { seconds: Math.ceil(left / 1000), ratio: endsAt !== null ? Math.min(1, left / total.current.ms) : 1 };
}

const SCENE: Record<Stage, string> = { lycee: 'lycee', etudes: 'universite', travail: 'travail' };
const sceneFor = (show: ScreenStep | null, index: number): string => {
  if (show?.kind === 'year') return SCENE[show.stage];
  if (index >= 15) return 'travail';
  if (index >= 9) return 'universite';
  return 'lycee';
};
const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
const fmtGrade = (g: number) => g.toFixed(1).replace('.', ',');

/** Écran projeté : salle d'attente, puis l'étape en cours de l'exposé */
export function Screen({ view, offset }: { view: ScreenView; offset: number }) {
  if (!view.show || !view.deck) {
    return (
      <div className="scr">
        <LobbyScreen view={view} />
      </div>
    );
  }
  const byId = new Map(view.players.map((p) => [p.id, p]));
  const show = view.show;
  const isGame = !['slide', 'poll', 'pollCompare', 'debrief'].includes(show.kind);
  // Présentation (diapositives, sondages) : style « exposé » clair, distinct de l'univers du jeu
  const isTalk = ['slide', 'poll', 'pollCompare'].includes(show.kind);
  return (
    <div className={`scr scr-v2 kind-${show.kind}${isTalk ? ' mode-talk' : ' mode-game'}`}>
      <img className="scr-scene" src={`/scenes/${sceneFor(show, view.deck.index)}.svg`} alt="" />
      <div className={`scr-scene-shade${show.kind === 'year' && show.phase === 'open' ? ' light' : ''}`} />
      <Hud view={view} offset={offset} />
      <div className="scr-stage" key={`${view.deck.index}`}>
        <StepView show={show} view={view} byId={byId} />
      </div>
      {isGame && view.feed.length > 0 && show.kind !== 'final' && show.kind !== 'stats' && <Ticker feed={view.feed} />}
      {view.card && <CardOverlay card={view.card} />}
      {view.timer.paused && <div className="scr-paused">Pause</div>}
      {view.deck.replay && <div className="scr-replay">Retour en arrière · lecture seule</div>}
    </div>
  );
}

function Hud({ view, offset }: { view: ScreenView; offset: number }) {
  const { seconds, ratio } = useCountdown(view.timer.endsAt, view.timer.remaining, offset);
  const d = view.deck!;
  const mm = seconds === null ? '' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return (
    <header className="scr-hud2">
      <span className="scr-brand small">
        <LogoMark />
        <span>
          Game<em>of</em>Life
        </span>
      </span>
      <span className={`scr-mode${view.show && ['slide', 'poll', 'pollCompare'].includes(view.show.kind) ? ' talk' : view.show?.kind === 'debrief' ? ' read' : ''}`}>
        {view.show && ['slide', 'poll', 'pollCompare'].includes(view.show.kind) ? 'Exposé' : view.show?.kind === 'debrief' ? 'Lecture' : 'Jeu'}
      </span>
      <div className="scr-progress" aria-label={`Étape ${d.index + 1} sur ${d.total}`}>
        {Array.from({ length: d.total }, (_, i) => (
          <i key={i} className={i < d.index ? 'done' : i === d.index ? 'now' : ''} />
        ))}
      </div>
      {seconds !== null && (
        <div className={`scr-clock2${seconds <= 10 ? ' hurry' : ''}`}>
          <span className="scr-timer-bar">
            <span style={{ transform: `scaleX(${view.timer.paused ? 1 : ratio})` }} />
          </span>
          <strong>{view.timer.paused ? 'PAUSE' : mm}</strong>
        </div>
      )}
      <span className="scr-code-mini">
        {phoneHost()} · <b>{view.code}</b>
      </span>
    </header>
  );
}

function Ticker({ feed }: { feed: ScreenView['feed'] }) {
  return (
    <ol className="scr-ticker">
      {feed.slice(0, 4).map((f) => (
        <li key={f.id} className={`tone-${f.tone}`}>
          {f.text}
        </li>
      ))}
    </ol>
  );
}

function CardOverlay({ card }: { card: FactCard }) {
  return (
    <div className="scr-fact-wrap">
      <article className="scr-fact">
        <p className="scr-eyebrow">Le saviez-vous ? · {card.id}</p>
        <div className="scr-fact-figure">{card.figure}</div>
        <h2>{card.title}</h2>
        <p className="scr-fact-text">{card.text}</p>
        {card.link && <p className="scr-fact-link">{card.link}</p>}
        <p className="scr-fact-source">Source : {card.source}</p>
      </article>
    </div>
  );
}

function Title({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <header className="scr-title">
      <p className="scr-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children}
    </header>
  );
}

/** Trois barres (une par classe d'origine) */
function ByOrigin({ label, values, unit = '%', max }: { label: string; values: Record<SocialClass, number>; unit?: string; max?: number }) {
  const top = max ?? (unit === '%' ? 100 : Math.max(1, ...Object.values(values)));
  return (
    <div className="scr-byorigin">
      <p>{label}</p>
      {SOCIAL_CLASSES.map((c) => (
        <div key={c} className="scr-bo-row" data-cls={c}>
          <span>{CLASS_SHORT[c]}</span>
          <span className="scr-bo-bar">
            <i style={{ width: `${Math.min(100, (values[c] / top) * 100)}%` }} />
          </span>
          <b>{unit === '%' ? `${values[c]} %` : unit === '/20' ? fmtGrade(values[c]) : `${values[c]}${unit}`}</b>
        </div>
      ))}
    </div>
  );
}

function Faces({ ids, byId, max = 40 }: { ids: string[]; byId: Map<string, ScreenPlayer>; max?: number }) {
  return (
    <span className="scr-faces">
      {ids.slice(0, max).map((id) => {
        const p = byId.get(id);
        return p ? (
          <span key={id} className="scr-face" data-cls={p.origin} title={p.displayName}>
            <Token avatar={p.avatar} color={p.color} dim={!p.connected} />
          </span>
        ) : null;
      })}
      {ids.length > max && <span className="scr-more">+{ids.length - max}</span>}
    </span>
  );
}

// ================================================================= Étapes

function StepView({ show, view, byId }: { show: ScreenStep; view: ScreenView; byId: Map<string, ScreenPlayer> }) {
  switch (show.kind) {
    case 'slide':
      return <SlideView slide={show.slide} first={view.deck!.index === 0} view={view} />;
    case 'poll':
      return (
        <section className="scr-pane">
          <Title eyebrow={`Sondage anonyme · ${show.answered}/${show.total} réponses`} title={view.deck!.title} />
          <div className={`scr-polls n${show.questions.length}`}>
            {show.questions.map((q, i) => (
              <Bars key={i} question={q.question} options={q.options} counts={q.counts} />
            ))}
          </div>
          {!show.questions[0]?.counts && <p className="scr-wait">Résultats cachés · répondez sur votre téléphone</p>}
        </section>
      );
    case 'pollCompare':
      return (
        <section className="scr-pane">
          <Title eyebrow="Sondage d’entrée → sondage de sortie" title="Avez-vous changé d’avis ?" />
          <div className="scr-compare">
            {show.items.map((it, i) => {
              const tb = it.before.reduce((s, v) => s + v, 0);
              const ta = it.after.reduce((s, v) => s + v, 0);
              return (
                <div key={i} className="scr-cmp">
                  <h3>{it.question}</h3>
                  {it.options.map((o, k) => (
                    <div key={k} className="scr-cmp-row">
                      <span>{o}</span>
                      <span className="scr-cmp-bars">
                        <i className="before" style={{ width: `${pct(it.before[k]!, tb)}%` }} />
                        <i className="after" style={{ width: `${pct(it.after[k]!, ta)}%` }} />
                      </span>
                      <b>
                        {pct(it.before[k]!, tb)} → {pct(it.after[k]!, ta)} %
                      </b>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <p className="scr-legend">
            <i className="before" /> avant · <i className="after" /> après
          </p>
        </section>
      );
    case 'draw':
      return <DrawView show={show} players={view.players} />;
    case 'year':
      return <YearView show={show} players={view.players} />;
    case 'bac':
      return (
        <section className="scr-pane">
          <Title eyebrow="Fin de la première partie" title="Résultats du bac" />
          {show.revealed ? (
            <div className="scr-grid2">
              <ResultList results={show.results} total={view.players.length} />
              <div className="scr-stack">
                <ByOrigin label="Réussite au bac" values={show.successByOrigin} />
                <ByOrigin label="Bac avec mention" values={show.mentionByOrigin} />
                <ByOrigin label="Note moyenne au bac" values={show.averageByOrigin} unit="/20" max={20} />
              </div>
            </div>
          ) : (
            <Drumroll text="Les copies sont corrigées…" />
          )}
        </section>
      );
    case 'vote': {
      const total = show.counts?.reduce((s, v) => s + v, 0) ?? 0;
      return (
        <section className="scr-pane">
          <Title eyebrow={`Vote · ${show.answered}/${show.total} votes`} title="Quelle réforme avant Parcoursup ?" />
          <div className="scr-reforms">
            {show.options.map((o, i) => (
              <div key={o.id} className={`scr-reform${show.winner === o.id ? ' win' : show.winner ? ' lose' : ''}`}>
                <span className="scr-reform-emoji"><GameIcon name={o.icon} /></span>
                <strong>{o.label}</strong>
                <small>{o.description}</small>
                {show.counts && (
                  <span className="scr-reform-bar">
                    <i style={{ width: `${pct(show.counts[i]!, total)}%` }} />
                    <b>{show.counts[i]}</b>
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      );
    }
    case 'parcoursup': {
      const max = Math.max(1, ...show.formations.map((f) => Math.max(f.demand, f.capacity)));
      return (
        <section className="scr-pane">
          <Title eyebrow={`Parcoursup · ${show.done}/${show.total} vœux confirmés`} title="Demandes et places" />
          <div className="scr-ps">
            {show.formations.map((f) => (
              <div key={f.id} className={`scr-ps-row${f.demand > f.capacity ? ' tense' : ''}`}>
                <span className="scr-ps-name">
                  <GameIcon name={f.icon} /> {f.label}
                </span>
                <span className="scr-ps-bars">
                  <i className="cap" style={{ width: `${(f.capacity / max) * 100}%` }} />
                  <i className="dem" style={{ width: `${(f.demand / max) * 100}%` }} />
                </span>
                <b>
                  {f.demand} <small>pour</small> {f.capacity} place{f.capacity > 1 ? 's' : ''}
                </b>
              </div>
            ))}
          </div>
          <div className="scr-chips">
            <span><GameIcon name="fog" /> {show.hiddenPrepa} joueur{show.hiddenPrepa > 1 ? 's' : ''} ne voi{show.hiddenPrepa > 1 ? 'ent' : 't'} pas la prépa</span>
            <span><GameIcon name="money" /> {show.bourses} demande{show.bourses > 1 ? 's' : ''} de bourse</span>
          </div>
        </section>
      );
    }
    case 'parcoursupResults':
      return (
        <section className="scr-pane">
          <Title eyebrow={`Parcoursup · ${show.done}/${show.total} réponses`} title="Admis, en attente, refusés" />
          {show.revealed ? (
            <div className="scr-ps">
              {show.formations
                .filter((f) => f.admis + f.attente + f.refuse > 0)
                .map((f) => {
                  const t = f.admis + f.attente + f.refuse;
                  return (
                    <div key={f.id} className="scr-ps-row">
                      <span className="scr-ps-name">
                        <GameIcon name={f.icon} /> {f.label}
                      </span>
                      <span className="scr-stack-bar">
                        <i className="admis" style={{ flex: f.admis }} title="Admis" />
                        <i className="attente" style={{ flex: f.attente }} title="En attente" />
                        <i className="refuse" style={{ flex: f.refuse }} title="Refusés" />
                      </span>
                      <b>
                        {f.admis}/{t} admis
                      </b>
                    </div>
                  );
                })}
              <p className="scr-legend">
                <i className="admis" /> admis · <i className="attente" /> en attente · <i className="refuse" /> refusés
              </p>
            </div>
          ) : (
            <Drumroll text="Les formations classent les dossiers…" />
          )}
        </section>
      );
    case 'parcoursupFinal':
      return (
        <section className="scr-pane">
          <Title eyebrow="Parcoursup" title="Les affectations" />
          <div className="scr-grid2 wide-left">
            <div className="scr-assign">
              {show.formations
                .filter((f) => f.players.length)
                .map((f) => (
                  <div key={f.id} className={`scr-assign-row${f.selective ? ' sel' : ''}`}>
                    <span>
                      <GameIcon name={f.icon} /> {f.label}
                    </span>
                    <Faces ids={f.players} byId={byId} />
                  </div>
                ))}
              {show.vieActive.length > 0 && (
                <div className="scr-assign-row out">
                  <span><GameIcon name="toolbox" /> Vie active</span>
                  <Faces ids={show.vieActive} byId={byId} />
                </div>
              )}
            </div>
            <ByOrigin label="Entrent en formation sélective (prépa, IEP, école)" values={show.selectiveByOrigin} />
          </div>
        </section>
      );
    case 'diploma':
      return (
        <section className="scr-pane">
          <Title eyebrow="Fin de la deuxième partie" title="Remise des diplômes" />
          {show.revealed ? (
            <div className="scr-grid2">
              <ResultList results={show.results} total={view.players.length} />
              <div className="scr-stack">
                <ByOrigin label="Diplômés d’un bac+5" values={show.bac5ByOrigin} />
                <ByOrigin label="Niveau de diplôme moyen (bac+…)" values={show.levelByOrigin} unit="" max={5} />
              </div>
            </div>
          ) : (
            <Drumroll text="Le jury délibère…" />
          )}
        </section>
      );
    case 'jobs':
      return (
        <section className="scr-pane">
          <Title eyebrow={show.phase === 'aim' ? `Premier emploi · ${show.done}/${show.total} stratégies` : 'Premier emploi'} title="Postes par niveau, et qui les obtient" />
          <div className="scr-ladder">
            {show.tiers
              .filter((t) => t.id !== 'chef' || t.players.length)
              .map((t) => (
                <div key={t.id} className="scr-rung" data-cls={t.cls}>
                  <span className="scr-rung-name">{t.label}</span>
                  <span className="scr-rung-seats">{t.seats === null ? (t.id === 'chomage' ? '—' : 'le reste') : `${t.seats} poste${t.seats > 1 ? 's' : ''}`}</span>
                  {show.revealed ? <Faces ids={t.players} byId={byId} max={18} /> : <span className="scr-rung-hidden">{show.phase === 'result' ? '? ? ?' : ''}</span>}
                </div>
              ))}
          </div>
        </section>
      );
    case 'final':
      return <FinalView show={show} byId={byId} total={view.players.length} />;
    case 'debrief':
      return <Debrief d={show.debrief} />;
    case 'stats':
      return (
        <section className="scr-pane">
          <Title eyebrow="Notre partie, par classe d’origine" title="Les chiffres de la partie" />
          <table className="scr-stats">
            <thead>
              <tr>
                <th />
                {SOCIAL_CLASSES.map((c) => (
                  <th key={c} data-cls={c}>
                    {CLASS_SHORT[c]}
                  </th>
                ))}
                <th>Dans la réalité</th>
              </tr>
            </thead>
            <tbody>
              {show.lines.map((l) => (
                <tr key={l.label}>
                  <th>{l.label}</th>
                  {SOCIAL_CLASSES.map((c) => (
                    <td key={c} data-cls={c}>
                      {l.unit === '€' ? `${Math.round(l.values[c] / 1000)} k€` : `${String(l.values[c]).replace('.', ',')}${l.unit === '%' ? ' %' : ''}`}
                    </td>
                  ))}
                  <td className="real">{l.real ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      );
  }
}

/** Débrief : un résultat de la partie par classe d'origine, interprété et comparé à la réalité */
function Debrief({ d }: { d: DebriefView }) {
  const fmt = (v: number | null, unit: string) => (v === null ? '—' : unit === '%' ? `${v} %` : unit === '/20' ? fmtGrade(v) : String(v).replace('.', ','));
  return (
    <section className="scr-debrief">
      <header className="scr-db-head">
        <p className="scr-eyebrow">
          {d.eyebrow} · Débrief {d.index + 1}/{d.total}
        </p>
        <h1>{d.title}</h1>
        <p className="scr-db-q">{d.question}</p>
      </header>
      <div className="scr-db-main">
        <div className="scr-db-charts">
          {d.charts.map((c) => (
            <div key={c.label} className="scr-db-chart">
              <p>{c.label}</p>
              {SOCIAL_CLASSES.map((cls) => {
                const v = c.game[cls];
                const r = c.real?.[cls] ?? null;
                return (
                  <div key={cls} className="scr-db-row" data-cls={cls}>
                    <span className="scr-db-cls">{CLASS_SHORT[cls]}</span>
                    <span className="scr-db-track">
                      <i className="game" style={{ width: `${v === null ? 0 : Math.min(100, (v / c.max) * 100)}%` }} />
                      {r !== null && <i className="real" style={{ left: `${Math.min(100, (r / c.max) * 100)}%` }} title={`Réalité : ${fmt(r, c.unit)}`} />}
                    </span>
                    <b>{fmt(v, c.unit)}</b>
                    {c.real && <small className="scr-db-real">{r !== null ? `réel ${fmt(r, c.unit)}` : ''}</small>}
                  </div>
                );
              })}
            </div>
          ))}
          {d.charts.some((c) => c.real) && (
            <p className="scr-legend">
              <i className="game-l" /> notre partie · <i className="real-l" /> la réalité
            </p>
          )}
        </div>
        <aside className="scr-db-side">
          <ul className="scr-db-interp">
            {d.interpretation.map((t, i) => (
              <li key={i} style={{ animationDelay: `${0.3 + i * 0.4}s` }}>
                {t}
              </li>
            ))}
          </ul>
          {d.reality && (
            <div className="scr-db-reality">
              <p className="scr-eyebrow">Dans la réalité</p>
              <strong>{d.reality.figure}</strong>
              <p>{d.reality.text}</p>
              <small>
                {d.reality.source} · cartes {d.reality.cards.join(', ')}
              </small>
            </div>
          )}
        </aside>
      </div>
      <p className="scr-db-verdict">{d.verdict}</p>
    </section>
  );
}

function Drumroll({ text }: { text: string }) {
  return (
    <div className="scr-drum">
      <span>
        <i />
        <i />
        <i />
      </span>
      <p>{text}</p>
    </div>
  );
}

function Bars({ question, options, counts }: { question: string; options: string[]; counts: number[] | null }) {
  const total = counts?.reduce((s, v) => s + v, 0) ?? 0;
  const best = counts ? Math.max(...counts) : -1;
  return (
    <div className="scr-bars">
      <h3>{question}</h3>
      {options.map((o, k) => (
        <div key={k} className={`scr-bar-row${counts && counts[k] === best && best > 0 ? ' top' : ''}`}>
          <span>{o}</span>
          <span className="scr-bar">
            <i style={{ width: counts ? `${pct(counts[k]!, total)}%` : '0%' }} />
          </span>
          <b>{counts ? `${pct(counts[k]!, total)} %` : ''}</b>
        </div>
      ))}
    </div>
  );
}

function ResultList({ results, total }: { results: { label: string; count: number }[]; total: number }) {
  return (
    <ul className="scr-results">
      {results.map((r, i) => (
        <li key={r.label} style={{ animationDelay: `${i * 0.25}s` }}>
          <span>{r.label}</span>
          <b>{r.count}</b>
          <small>{pct(r.count, total)} %</small>
        </li>
      ))}
    </ul>
  );
}

function SlideView({ slide, first, view }: { slide: { title: string; subtitle: string; bullets: string[] }; first: boolean; view: ScreenView }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (!first) return;
    QRCode.toDataURL(joinUrl(view.code), { margin: 1, width: 500, color: { dark: '#0e1116', light: '#ffffff' } }).then(setQr, () => setQr(null));
  }, [first, view.code]);
  return (
    <section className={`scr-slide${first ? ' first' : ''}`}>
      <div>
        <h1>{slide.title}</h1>
        {slide.subtitle && <p className="scr-slide-sub">{slide.subtitle}</p>}
        {slide.bullets.length > 0 && (
          <ul>
            {slide.bullets.map((b, i) => (
              <li key={i} style={{ animationDelay: `${0.2 + i * 0.35}s` }}>
                {b}
              </li>
            ))}
          </ul>
        )}
      </div>
      {first && (
        <aside className="scr-slide-join">
          <p className="scr-eyebrow">Rejoins la partie</p>
          <p className="scr-url">{phoneHost()}</p>
          <div className="scr-code small">
            {[...view.code].map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </div>
          {qr && <img className="scr-qr" src={qr} alt="QR code pour rejoindre" />}
        </aside>
      )}
    </section>
  );
}

function DrawView({ show, players }: { show: Extract<ScreenStep, { kind: 'draw' }>; players: ScreenPlayer[] }) {
  const total = players.length || 1;
  return (
    <section className="scr-pane">
      <Title eyebrow="Le tirage" title="Vous ne choisissez pas où vous naissez" />
      <div className="scr-draw">
        {[...show.families].reverse().map((f, i) => (
          <div key={f.cls} className="scr-draw-col" data-cls={f.cls} style={{ animationDelay: `${i * 0.3}s` }}>
            <header>
              <strong>{CLASS_LABELS[f.cls]}</strong>
              <span>
                {show.counts[f.cls]} · {pct(show.counts[f.cls], total)} %
              </span>
            </header>
            <p className="scr-draw-parents">{f.parents}</p>
            <dl>
              <div>
                <dt>Moyenne</dt>
                <dd>{f.grade}</dd>
              </div>
              <div>
                <dt>Budget</dt>
                <dd>{f.budget}</dd>
              </div>
              <div>
                <dt>Contacts</dt>
                <dd>{f.contacts}</dd>
              </div>
            </dl>
            <div className="scr-draw-faces">
              {players
                .filter((p) => p.origin === f.cls)
                .map((p, k) => (
                  <span key={p.id} className="scr-face pop" style={{ animationDelay: `${0.6 + k * 0.08}s` }} title={p.displayName}>
                    <Token avatar={p.avatar} color={p.color} dim={!p.connected} />
                    {players.length <= 30 && <small>{p.displayName}</small>}
                  </span>
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function YearView({ show, players }: { show: Extract<ScreenStep, { kind: 'year' }>; players: ScreenPlayer[] }) {
  const sorted = [...players].sort((a, b) => SOCIAL_CLASSES.indexOf(a.origin) - SOCIAL_CLASSES.indexOf(b.origin) || a.displayName.localeCompare(b.displayName));
  const totalChoices = show.choices?.reduce((s, c) => s + c.count, 0) ?? 0;
  return (
    <section className="scr-year">
      <header className="scr-year-head">
        <p className="scr-eyebrow">
          Année {show.number}/7 · {show.stage === 'lycee' ? 'Lycée' : show.stage === 'etudes' ? 'Études' : 'Vie active'}
        </p>
        <h1>{show.label}</h1>
        {show.mini && show.phase === 'open' && (
          <p className="scr-mini-tag">
            <GameIcon name={show.mini.icon} /> Mini-jeu : {show.mini.title}
          </p>
        )}
        {show.phase === 'open' ? (
          <p className="scr-year-count">
            <b>{show.done}</b> / {show.total} ont validé
            {show.informed !== null && (
              <span className="scr-chip">
                <GameIcon name="compass" /> {show.informed} informé{show.informed > 1 ? 's' : ''} des filières sélectives
              </span>
            )}
          </p>
        ) : (
          <p className="scr-year-count">Bulletins distribués</p>
        )}
      </header>

      {show.phase === 'open' || !show.choices ? (
        <div className={`scr-wall${sorted.length > 24 ? ' dense' : ''}`}>
          {sorted.map((p) => (
            <div key={p.id} className={`scr-wall-p${p.done ? ' done' : ''}${p.connected ? '' : ' away'}`} data-cls={p.origin}>
              <span className="scr-ring">
                <Token avatar={p.avatar} color={p.color} dim={!p.connected} />
                {p.done && <i className="scr-check">✓</i>}
              </span>
              <small>{p.displayName}</small>
              {p.pop && (
                <span key={p.pop.id} className={`scr-pop tone-${p.pop.tone}`}>
                  {p.pop.text}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="scr-grid2">
          <div className="scr-choices">
            <p className="scr-eyebrow">Ce que la classe a choisi</p>
            {show.choices.map((c) => (
              <div key={c.label} className="scr-bar-row">
                <span>
                  <GameIcon name={c.icon} /> {c.label}
                </span>
                <span className="scr-bar">
                  <i style={{ width: `${pct(c.count, totalChoices)}%` }} />
                </span>
                <b>{c.count}</b>
              </div>
            ))}
          </div>
          {show.stage !== 'travail' && <ByOrigin label="Moyenne générale, par classe d’origine" values={show.averages} unit="/20" max={20} />}
        </div>
      )}
    </section>
  );
}

function FinalView({ show, byId, total }: { show: Extract<ScreenStep, { kind: 'final' }>; byId: Map<string, ScreenPlayer>; total: number }) {
  const f = show.final;
  const tiers: SocialClass[] = ['superieure', 'moyenne', 'populaire'];
  const asc = new Set(f.ascending);
  // Révélation par étages, du bas vers le haut
  const visible = (cls: SocialClass) => f.revealed >= 3 - tiers.indexOf(cls);
  return (
    <div className="scr-final">
      <header className="scr-final-head">
        <p className="scr-eyebrow">Fin de partie</p>
        <h1>La pyramide sociale</h1>
      </header>
      <div className="scr-final-main">
        <div className="scr-pyramid">
          {tiers.map((cls, i) => (
            <div key={cls} className={`scr-tier tier-${i}${visible(cls) ? ' shown' : ' hidden'}`} data-cls={cls}>
              <div className="scr-tier-head">
                <strong>{CLASS_LABELS[cls]}</strong>
                {visible(cls) && (
                  <span>
                    {f.pyramid[cls].length} · {pct(f.pyramid[cls].length, total)} %
                  </span>
                )}
              </div>
              {visible(cls) ? (
                <ul>
                  {f.pyramid[cls].map((id, k) => {
                    const p = byId.get(id);
                    if (!p) return null;
                    const move = SOCIAL_CLASSES.indexOf(cls) - SOCIAL_CLASSES.indexOf(p.origin);
                    return (
                      <li key={id} title={`${p.displayName} (${CLASS_LABELS[p.origin].toLowerCase()})`} style={{ animationDelay: `${k * 0.05}s` }}>
                        <span className="scr-origin-ring" data-cls={p.origin}>
                          <Token avatar={p.avatar} color={p.color} />
                        </span>
                        {move !== 0 && <span className={`scr-move ${move > 0 ? 'up' : 'down'}`}>{move > 0 ? '▲' : '▼'}</span>}
                        {asc.has(id) && <span className="scr-star"><GameIcon name="star" /></span>}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="scr-tier-wait">?</p>
              )}
            </div>
          ))}
        </div>

        <aside className={`scr-final-side${f.revealed >= 4 ? ' shown' : ''}`}>
          {f.revealed >= 4 ? (
            <>
              <section className="scr-card">
                <p className="scr-eyebrow">Podium · avec la classe de départ</p>
                <ol className="scr-podium">
                  {f.podium.map((id, i) => {
                    const p = byId.get(id);
                    return p ? (
                      <li key={id}>
                        <b className={`scr-rank r${i + 1}`}>{i + 1}</b>
                        <Token avatar={p.avatar} color={p.color} />
                        <span>{p.displayName}</span>
                        <small data-cls={p.origin} className="scr-origin-tag">
                          né·e {CLASS_SHORT[p.origin].toLowerCase()}
                        </small>
                      </li>
                    ) : null;
                  })}
                </ol>
              </section>
              <section className="scr-card">
                <p className="scr-eyebrow">Origine → arrivée</p>
                <table className="scr-matrix">
                  <thead>
                    <tr>
                      <th />
                      {SOCIAL_CLASSES.map((c) => (
                        <th key={c} data-cls={c}>
                          {CLASS_SHORT[c]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SOCIAL_CLASSES.map((o) => (
                      <tr key={o}>
                        <th data-cls={o}>{CLASS_SHORT[o]}</th>
                        {SOCIAL_CLASSES.map((c) => (
                          <td key={c} className={o === c ? 'diag' : undefined}>
                            {f.matrix[o][c] || '·'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="scr-moves">
                  <span className="up">▲ {f.climbed} montés</span>
                  <span>= {f.stayed} restés</span>
                  <span className="down">▼ {f.fell} descendus</span>
                </p>
              </section>
              <section className="scr-card scr-takeaways">
                {f.takeaways.map((t, i) => (
                  <p key={i}>{t}</p>
                ))}
                {f.ascending.length > 0 && <p className="scr-muted"><GameIcon name="star" /> en ascension : encore quelques années au même poste pour changer de classe.</p>}
              </section>
            </>
          ) : (
            <p className="scr-wait">La pyramide se révèle étage par étage…</p>
          )}
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Salle d'attente

function LobbyScreen({ view }: { view: ScreenView }) {
  const [qr, setQr] = useState<string | null>(null);
  const url = joinUrl(view.code);
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 600, color: { dark: '#0e1116', light: '#ffffff' } }).then(setQr, () => setQr(null));
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

        <p className="scr-privacy">
          <GameIcon name="lock" /> Ton compte : prénom et nom, rien d’autre (pseudo au hasard sur demande). Ta famille de jeu est tirée au hasard.
          Sondages anonymes. Rien n’est noté. Tout est supprimé 3 mois après la partie.
        </p>

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
                  <span>
                    {p.displayName}
                    {p.partner && <small> <GameIcon name="handshake" /> {p.partner}</small>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
