import { useEffect, useState } from 'react';

/** Glider de Conway : les 5 cellules vivantes d'une grille 3×3 (ligne, colonne). */
const GLIDER = new Set(['0,1', '1,2', '2,0', '2,1', '2,2']);

/** Logo du jeu : le glider sur sa tuile (même dessin que public/icon.svg). */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="#11151c" />
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2].map((c) => {
          const alive = GLIDER.has(`${r},${c}`);
          return (
            <rect
              key={`${r},${c}`}
              x={9 + c * 16.5}
              y={9 + r * 16.5}
              width="13"
              height="13"
              rx="3.5"
              fill={alive ? 'var(--life)' : '#ffffff'}
              fillOpacity={alive ? 1 : 0.07}
            />
          );
        }),
      )}
    </svg>
  );
}

/** Logo complet : glider + « GameofLife » + étiquette ADMIN */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="wordmark">
        Game<span>of</span>Life
      </span>
      <span className="logo-tag">admin</span>
    </span>
  );
}

type Board = boolean[];

function seed(cols: number, rows: number): Board {
  const board: Board = Array.from({ length: cols * rows }, () => Math.random() < 0.18);
  const glider = [
    [0, 1],
    [1, 2],
    [2, 0],
    [2, 1],
    [2, 2],
  ];
  for (let g = 0; g < Math.max(1, Math.floor(cols / 7)); g++) {
    const r0 = Math.floor(Math.random() * rows);
    const c0 = g * 7;
    for (const [r, c] of glider) board[((r0 + r!) % rows) * cols + ((c0 + c!) % cols)] = true;
  }
  return board;
}

/** Une génération de Conway sur un tore (les bords se rejoignent). */
function step(board: Board, cols: number, rows: number): Board {
  return board.map((alive, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    let n = 0;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++)
        if ((dr || dc) && board[((r + dr + rows) % rows) * cols + ((c + dc + cols) % cols)]) n++;
    return n === 3 || (alive && n === 2);
  });
}

/** Jeu de la vie décoratif (figé si l'utilisateur limite les animations). */
export function LifeGrid({ cols = 16, rows = 6, interval = 520 }: { cols?: number; rows?: number; interval?: number }) {
  const [board, setBoard] = useState(() => seed(cols, rows));
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let previous = '';
    let still = 0;
    const id = setInterval(() => {
      setBoard((b) => {
        const next = step(b, cols, rows);
        const key = next.map(Number).join('');
        still = key === previous || !next.includes(true) ? still + 1 : 0;
        previous = key;
        return still > 3 ? seed(cols, rows) : next;
      });
    }, interval);
    return () => clearInterval(id);
  }, [cols, rows, interval]);

  return (
    <div className="life-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }} aria-hidden="true">
      {board.map((alive, i) => (
        <span key={i} className={alive ? 'alive' : undefined} />
      ))}
    </div>
  );
}
