import { useEffect, useRef, useState } from 'react';
import { CLASS_SHORT, SOCIAL_CLASSES, type ControlPlayer, type LiveRoom, type SocialClass } from '../protocol';

/** Couleurs des classes d'origine (mêmes que l'écran projeté) */
export const CLS_COLOR: Record<SocialClass, string> = { populaire: '#ff7a59', moyenne: '#62c7ff', superieure: '#ffc94d' };
const money = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const k = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(Math.abs(n) >= 10_000 ? 0 : 1).replace('.', ',')} k` : money.format(n));

interface Sample {
  t: number;
  done: number;
}
interface StepPoint {
  label: string;
  grade: Record<SocialClass, number>;
  budget: Record<SocialClass, number>;
}
export interface LiveHistory {
  /** Validations de l'étape en cours, dans le temps (secondes depuis l'ouverture) */
  samples: Sample[];
  /** Moment (s) où chaque personnage a validé l'étape en cours */
  doneAt: Record<string, number>;
  /** Moyennes par classe à chaque étape jouée : graphiques d'évolution */
  steps: StepPoint[];
  stepStart: number;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const byClass = (chars: ControlPlayer[], f: (c: ControlPlayer) => number) =>
  Object.fromEntries(SOCIAL_CLASSES.map((cl) => [cl, avg(chars.filter((c) => c.origin === cl).map(f))])) as Record<SocialClass, number>;

/**
 * Historique en direct, construit par la régie à partir des mises à jour du serveur.
 * Gardé en mémoire de session : un rechargement de page ne perd pas les courbes.
 */
export function useLiveHistory(live: LiveRoom): LiveHistory {
  const key = `gol.history.${live.roomId}`;
  const ref = useRef<LiveHistory & { cursor: number }>(null);
  if (!ref.current) {
    let saved: (LiveHistory & { cursor: number }) | null = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    } catch {
      saved = null;
    }
    ref.current = saved ?? { samples: [], doneAt: {}, steps: [], stepStart: Date.now(), cursor: -2 };
  }
  const [, force] = useState(0);
  const { control } = live;
  const chars = control.characters;

  useEffect(() => {
    const h = ref.current!;
    const now = Date.now();
    if (h.cursor !== control.cursor) {
      // Nouvelle étape : on fige les moyennes de l'étape précédente, on repart à zéro
      if (h.cursor >= 0 && chars.length) {
        const prev = control.deck[h.cursor];
        h.steps = [...h.steps, { label: prev ? String(h.cursor + 1) : '?', grade: byClass(chars, (c) => c.grade), budget: byClass(chars, (c) => c.budget) }].slice(-40);
      }
      h.cursor = control.cursor;
      h.stepStart = now;
      h.samples = [];
      h.doneAt = {};
    }
    const done = chars.filter((c) => c.done);
    const t = Math.round((now - h.stepStart) / 1000);
    for (const c of done) if (h.doneAt[c.id] === undefined) h.doneAt[c.id] = t;
    for (const id of Object.keys(h.doneAt)) if (!done.some((c) => c.id === id)) delete h.doneAt[id];
    const last = h.samples.at(-1);
    if (!last || last.done !== done.length) h.samples = [...h.samples, { t, done: done.length }].slice(-200);
    try {
      sessionStorage.setItem(key, JSON.stringify(h));
    } catch {
      // stockage plein : les courbes restent en mémoire
    }
    force((n) => n + 1);
  }, [live, key, control.cursor, chars, control.deck]);

  return ref.current;
}

/** Statistiques en direct de la partie : validation, puis indicateurs par classe d'origine */
export function LiveStats({ live, history, onPick }: { live: LiveRoom; history: LiveHistory; onPick?: (characterId: string) => void }) {
  const chars = live.control.characters;
  const [, tick] = useState(0);
  // Le compteur « depuis » avance chaque seconde
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!chars.length) return <p className="rg-muted rg-pad">Les statistiques s’affichent dès le tirage des familles.</p>;

  const done = chars.filter((c) => c.done).length;
  const pct = Math.round((done / chars.length) * 100);
  const elapsed = Math.round((Date.now() - history.stepStart) / 1000);
  const pending = chars.filter((c) => !c.done);
  const finished = chars.filter((c) => c.done).sort((a, b) => (history.doneAt[a.id] ?? 0) - (history.doneAt[b.id] ?? 0));
  const times = Object.values(history.doneAt);
  const present = SOCIAL_CLASSES.filter((cl) => chars.some((c) => c.origin === cl));

  return (
    <div className="ls">
      {/* ---- Validation de l'étape en cours ---- */}
      <section className="ls-block">
        <div className="ls-valid">
          <Ring pct={pct} label={`${done}/${chars.length}`} />
          <div className="ls-valid-text">
            <strong>{pct} % ont validé</strong>
            <span>
              Étape ouverte depuis {Math.floor(elapsed / 60)} min {String(elapsed % 60).padStart(2, '0')} s
            </span>
            <span>{times.length ? `Temps médian : ${median(times)} s` : 'Personne n’a encore validé'}</span>
          </div>
        </div>
        <div className="ls-cls-bars">
          {SOCIAL_CLASSES.map((cl) => {
            const of = chars.filter((c) => c.origin === cl);
            if (!of.length) return null;
            const d = of.filter((c) => c.done).length;
            return (
              <div key={cl} className="ls-cls-row">
                <span style={{ color: CLS_COLOR[cl] }}>{CLASS_SHORT[cl]}</span>
                <div className="ls-track">
                  <div style={{ width: `${(d / of.length) * 100}%`, background: CLS_COLOR[cl] }} />
                </div>
                <b>
                  {d}/{of.length}
                </b>
              </div>
            );
          })}
        </div>
        <LineChart samples={history.samples} total={chars.length} now={elapsed} />
      </section>

      {/* ---- Chaque joueur ---- */}
      <section className="ls-block">
        <h4>Chaque joueur</h4>
        <ul className="ls-players">
          {[...pending, ...finished].map((c) => (
            <li key={c.id} className={c.done ? 'done' : ''} onClick={() => onPick?.(c.id)} title="Modifier ce joueur">
              <span className="ls-dot" style={{ background: CLS_COLOR[c.origin] }} />
              <span className="ls-name">{c.members.join(' & ')}</span>
              <span className="ls-mini">{c.grade.toFixed(1).replace('.', ',')}</span>
              <span className="ls-mini">{k(c.budget)} €</span>
              <span className="ls-when">{c.done ? `✓ ${history.doneAt[c.id] ?? '–'} s` : '⏳'}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- Indicateurs par classe ---- */}
      <section className="ls-block">
        <h4>Par classe d’origine, maintenant</h4>
        <Bars title="Moyenne /20" only={present} values={byClass(chars, (c) => c.grade)} fmt={(v) => v.toFixed(1).replace('.', ',')} max={20} />
        <Bars title="Argent moyen" only={present} values={byClass(chars, (c) => c.budget)} fmt={(v) => `${k(v)} €`} />
        <Bars title="Contacts moyens" only={present} values={byClass(chars, (c) => c.contacts)} fmt={(v) => v.toFixed(1).replace('.', ',')} />
        <Bars title="Énergie moyenne /5" only={present} values={byClass(chars, (c) => c.energy)} fmt={(v) => v.toFixed(1).replace('.', ',')} max={5} />
      </section>

      {history.steps.length >= 2 && (
        <section className="ls-block">
          <h4>Évolution au fil des étapes</h4>
          <Trend points={history.steps} pick={(p) => p.grade} title="Moyenne /20" fmt={(v) => v.toFixed(1).replace('.', ',')} />
          <Trend points={history.steps} pick={(p) => p.budget} title="Argent moyen" fmt={(v) => `${k(v)} €`} />
        </section>
      )}
    </div>
  );
}

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function Ring({ pct, label }: { pct: number; label: string }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ls-ring" viewBox="0 0 76 76" width={76} height={76} aria-label={`${pct} %`}>
      <circle cx={38} cy={38} r={r} fill="none" stroke="#2b2d32" strokeWidth={8} />
      <circle cx={38} cy={38} r={r} fill="none" stroke={pct === 100 ? '#c6f25a' : '#62c7ff'} strokeWidth={8} strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 38 38)" style={{ transition: 'stroke-dasharray .4s' }} />
      <text x={38} y={43} textAnchor="middle" fontSize={15} fontWeight={800} fill="#e4e6eb">
        {label}
      </text>
    </svg>
  );
}

/** Courbe des validations depuis l'ouverture de l'étape (en escalier) */
function LineChart({ samples, total, now }: { samples: Sample[]; total: number; now: number }) {
  const W = 320;
  const H = 90;
  const maxT = Math.max(30, now);
  const x = (t: number) => 6 + (t / maxT) * (W - 12);
  const y = (d: number) => H - 14 - (d / Math.max(1, total)) * (H - 24);
  const pts = [...samples, { t: now, done: samples.at(-1)?.done ?? 0 }];
  let path = '';
  pts.forEach((p, i) => {
    path += i === 0 ? `M${x(p.t)},${y(p.done)}` : `H${x(p.t)}V${y(p.done)}`;
  });
  return (
    <svg className="ls-line" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Validations dans le temps">
      <line x1={6} x2={W - 6} y1={y(total)} y2={y(total)} stroke="#34363c" strokeDasharray="3 3" />
      <path d={`${path}V${y(0)}H${x(0)}Z`} fill="rgba(198,242,90,.12)" />
      <path d={path} fill="none" stroke="#c6f25a" strokeWidth={2} />
      <text x={6} y={H - 2} fontSize={9} fill="#8b9099">
        0 s
      </text>
      <text x={W - 6} y={H - 2} fontSize={9} fill="#8b9099" textAnchor="end">
        {now} s
      </text>
    </svg>
  );
}

function Bars({ title, values, fmt, max, only = SOCIAL_CLASSES }: { title: string; values: Record<SocialClass, number>; fmt: (v: number) => string; max?: number; only?: readonly SocialClass[] }) {
  const top = max ?? Math.max(1, ...only.map((cl) => Math.abs(values[cl])));
  return (
    <div className="ls-bars">
      <span className="ls-bars-title">{title}</span>
      {only.map((cl) => (
        <div key={cl} className="ls-cls-row">
          <span style={{ color: CLS_COLOR[cl] }}>{CLASS_SHORT[cl]}</span>
          <div className="ls-track">
            <div style={{ width: `${Math.max(0, Math.min(100, (values[cl] / top) * 100))}%`, background: CLS_COLOR[cl] }} />
          </div>
          <b>{fmt(values[cl])}</b>
        </div>
      ))}
    </div>
  );
}

/** Courbes par classe au fil des étapes jouées */
function Trend({ points, pick, title, fmt }: { points: StepPoint[]; pick: (p: StepPoint) => Record<SocialClass, number>; title: string; fmt: (v: number) => string }) {
  const W = 320;
  const H = 96;
  const vals = points.flatMap((p) => Object.values(pick(p)));
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const x = (i: number) => 8 + (i / Math.max(1, points.length - 1)) * (W - 16);
  const y = (v: number) => H - 12 - ((v - lo) / Math.max(1e-9, hi - lo)) * (H - 24);
  const last = pick(points.at(-1)!);
  return (
    <div className="ls-trend">
      <span className="ls-bars-title">{title}</span>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={title}>
        {SOCIAL_CLASSES.map((cl) => (
          <polyline key={cl} fill="none" stroke={CLS_COLOR[cl]} strokeWidth={2} points={points.map((p, i) => `${x(i)},${y(pick(p)[cl])}`).join(' ')} />
        ))}
      </svg>
      <div className="ls-legend">
        {SOCIAL_CLASSES.map((cl) => (
          <span key={cl} style={{ color: CLS_COLOR[cl] }}>
            ● {CLASS_SHORT[cl]} {fmt(last[cl])}
          </span>
        ))}
      </div>
    </div>
  );
}
