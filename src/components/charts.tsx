import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';

/**
 * Graphiques SVG sans dépendance, une seule série chacun (le titre de la carte la nomme).
 * Barres fines à bout arrondi, grille discrète, info-bulle au survol, tableau de données équivalent.
 */

export interface Point {
  /** Libellé court de l'axe X */
  label: string;
  /** Libellé complet de l'info-bulle */
  title: string;
  value: number;
}

const PAD = { top: 12, right: 12, bottom: 26, left: 36 };

const TICK_COUNT = 4;

/** Échelle Y entière et régulière : 4 intervalles de pas « rond » (1, 2, 5, 10, 20…) */
function niceMax(max: number): number {
  const raw = Math.max(1, max) / TICK_COUNT;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw && Number.isInteger(s)) ?? Math.ceil(raw);
  return Math.max(1, step) * TICK_COUNT;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function Frame({
  width,
  height,
  max,
  data,
  labelEvery,
  children,
  label,
}: {
  width: number;
  height: number;
  max: number;
  data: Point[];
  labelEvery: number;
  children: ReactNode;
  label: string;
}) {
  const innerH = height - PAD.top - PAD.bottom;
  const innerW = width - PAD.left - PAD.right;
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => (max / TICK_COUNT) * i);
  const band = innerW / Math.max(1, data.length);
  return (
    <svg width={width} height={height} role="img" aria-label={label} className="chart-svg">
      {ticks.map((t) => {
        const y = PAD.top + innerH - (t / max) * innerH;
        return (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} className={t === 0 ? 'axis' : 'grid'} />
            <text x={PAD.left - 8} y={y} className="tick" textAnchor="end" dominantBaseline="middle">
              {t}
            </text>
          </g>
        );
      })}
      {data.map((d, i) =>
        i % labelEvery === 0 ? (
          <text key={i} x={PAD.left + band * i + band / 2} y={height - 8} className="tick" textAnchor="middle">
            {d.label}
          </text>
        ) : null,
      )}
      {children}
    </svg>
  );
}

function Tooltip({ point, x, y, unit }: { point: Point | null; x: number; y: number; unit: string }) {
  if (!point) return null;
  return (
    <div className="chart-tip" style={{ left: x, top: y }} role="status">
      <div className="chart-tip-title">{point.title}</div>
      <div>
        <strong>{point.value}</strong> {unit}
      </div>
    </div>
  );
}

function barPath(x: number, top: number, w: number, base: number, r: number) {
  return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${base} Z`;
}

export function BarChart({ data, unit, height = 220, label }: { data: Point[]; unit: string; height?: number; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const band = innerW / Math.max(1, data.length);
  const barW = Math.max(2, Math.min(24, band - 2)); // 2 px d'air entre barres, 24 px max
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(innerW / 56)));
  const r = Math.min(4, barW / 2);
  const hp = hover !== null ? (data[hover] ?? null) : null;

  return (
    <div ref={ref} className="chart" onMouseLeave={() => setHover(null)}>
      <Frame width={width} height={height} max={max} data={data} labelEvery={labelEvery} label={label}>
        {data.map((d, i) => {
          const h = (d.value / max) * innerH;
          const x = PAD.left + band * i + (band - barW) / 2;
          const y = PAD.top + innerH - h;
          return (
            <g key={i}>
              {h > 0 && (
                // Bout arrondi en haut, carré sur la ligne de base
                <path
                  className={`bar${hover === i ? ' active' : ''}`}
                  d={barPath(x, y, barW, PAD.top + innerH, Math.min(r, h))}
                />
              )}
              {/* zone de survol : toute la hauteur de la colonne */}
              <rect
                x={PAD.left + band * i}
                y={PAD.top}
                width={band}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            </g>
          );
        })}
      </Frame>
      <Tooltip
        point={hp}
        unit={unit}
        x={hover !== null ? PAD.left + band * hover + band / 2 : 0}
        y={hp ? PAD.top + innerH - (hp.value / max) * innerH : 0}
      />
    </div>
  );
}

export function LineChart({ data, unit, height = 220, label }: { data: Point[]; unit: string; height?: number; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  // useId contient des caractères invalides dans url(#…)
  const gradientId = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const band = innerW / Math.max(1, data.length);
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(innerW / 64)));
  const px = (i: number) => PAD.left + band * i + band / 2;
  const py = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${px(i)},${py(d.value)}`).join(' ');
  const area = data.length ? `${path} L${px(data.length - 1)},${PAD.top + innerH} L${px(0)},${PAD.top + innerH} Z` : '';
  const hp = hover !== null ? (data[hover] ?? null) : null;

  function onMove(e: MouseEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.floor(((e.clientX - box.left) / box.width) * data.length);
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  }

  return (
    <div ref={ref} className="chart" onMouseLeave={() => setHover(null)}>
      <Frame width={width} height={height} max={max} data={data} labelEvery={labelEvery} label={label}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" className="area-top" />
            <stop offset="1" className="area-bottom" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={path} className="line" />
        {/* Peu de points : marqueurs visibles (une courbe à un seul point serait invisible) */}
        {data.length < 3 && data.map((d, i) => <circle key={i} cx={px(i)} cy={py(d.value)} r={4} className="dot" />)}
        {hover !== null && hp && (
          <>
            <line x1={px(hover)} x2={px(hover)} y1={PAD.top} y2={PAD.top + innerH} className="crosshair" />
            <circle cx={px(hover)} cy={py(hp.value)} r={4} className="dot" />
          </>
        )}
        <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH} fill="transparent" onMouseMove={onMove} />
      </Frame>
      <Tooltip point={hp} unit={unit} x={hover !== null ? px(hover) : 0} y={hp ? py(hp.value) : 0} />
    </div>
  );
}

/** Tableau de données équivalent (accessibilité / lecture précise) */
export function DataTable({ rows, columns }: { rows: Point[][]; columns: string[] }) {
  return (
    <div className="table-scroll">
      <table className="table compact">
        <thead>
          <tr>
            <th>Date</th>
            {columns.map((c) => (
              <th key={c} className="num">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows[0]?.map((p, i) => (
            <tr key={p.title}>
              <td>{p.title}</td>
              {rows.map((r, j) => (
                <td key={j} className="num">
                  {r[i]?.value ?? 0}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
