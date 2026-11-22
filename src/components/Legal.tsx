import { useEffect, useState } from 'react';
import { LEGAL, type LegalBlock, type LegalId } from '../legal';

/** Pages légales (mentions, confidentialité, cookies, CGU) avec onglets. Fichier identique dans PHONE et ADMIN. */
export function LegalSheet({ initial = 'mentions', onClose, inline = false }: { initial?: LegalId; onClose?: () => void; inline?: boolean }) {
  const [id, setId] = useState<LegalId>(initial);
  const page = LEGAL.find((p) => p.id === id)!;
  useEffect(() => {
    if (inline) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', esc);
      document.body.style.overflow = '';
    };
  }, [onClose, inline]);
  return (
    <div className={`legal-sheet${inline ? ' inline' : ''}`} role={inline ? undefined : 'dialog'} aria-modal={inline ? undefined : true} aria-label={page.title}>
      <header className="legal-head">
        <strong>Informations légales</strong>
        {!inline && (
          <button className="legal-close" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        )}
      </header>
      <nav className="legal-tabs" aria-label="Pages légales">
        {LEGAL.map((p) => (
          <button key={p.id} className={p.id === id ? 'on' : ''} aria-current={p.id === id} onClick={() => setId(p.id)}>
            {p.short}
          </button>
        ))}
      </nav>
      <article className="legal-body" key={id}>
        <h1>{page.title}</h1>
        {page.blocks.map((b, i) => (
          <Block key={i} b={b} />
        ))}
      </article>
    </div>
  );
}

function Block({ b }: { b: LegalBlock }) {
  if (b.type === 'h') return <h2>{b.text}</h2>;
  if (b.type === 'p') return <p>{b.text}</p>;
  if (b.type === 'list')
    return (
      <ul>
        {b.items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    );
  return (
    <div className="legal-table">
      <table>
        <thead>
          <tr>
            {b.head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {b.rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, k) => (
                <td key={k} data-label={b.head[k]}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Liens vers les pages légales (pied d'écran) */
export function LegalLinks({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState<LegalId | null>(null);
  return (
    <>
      <nav className={`legal-links ${className}`} aria-label="Informations légales">
        {LEGAL.map((p) => (
          <button key={p.id} type="button" onClick={() => setOpen(p.id)}>
            {p.short}
          </button>
        ))}
      </nav>
      {open && <LegalSheet initial={open} onClose={() => setOpen(null)} />}
    </>
  );
}
