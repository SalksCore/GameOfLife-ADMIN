import { useEffect, useRef, useState, type ReactNode } from 'react';

// ---------- Icônes (SVG inline, aucune dépendance) ----------

const PATHS = {
  dashboard: 'M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z',
  games: 'M21 6H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3zm4.5 2a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-3a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
  players: 'M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13zm8 0c-.3 0-.6 0-1 .1 1.2.8 2 2 2 3.4V19h6v-2.5c0-2.3-4.7-3.5-7-3.5z',
  history: 'M13 3a9 9 0 0 0-9 9H1l4 4 4-4H6a7 7 0 1 1 2 4.9l-1.4 1.4A9 9 0 1 0 13 3zm-1 5v5l4.3 2.5.7-1.2-3.5-2.1V8z',
  journal: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-5 14H7v-2h7zm3-4H7v-2h10zm0-4H7V7h10z',
  logout: 'M16 17v-3H9v-4h7V7l5 5zM14 2a2 2 0 0 1 2 2v2h-2V4H5v16h9v-2h2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z',
  plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z',
  play: 'M8 5v14l11-7z',
  stop: 'M6 6h12v12H6z',
  close: 'M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z',
  copy: 'M16 1H4a2 2 0 0 0-2 2v14h2V3h12zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11z',
  key: 'M12.6 10A6 6 0 1 0 7 17a6 6 0 0 0 5.6-4H17v4h4v-4h2v-3zM7 13a2 2 0 1 1 2-2 2 2 0 0 1-2 2z',
  lock: 'M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-6 9a2 2 0 1 1 2-2 2 2 0 0 1-2 2zm3.1-9H8.9V6a3.1 3.1 0 0 1 6.2 0z',
  user: 'M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z',
  shield: 'M12 1 3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5z',
  search: 'M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z',
  edit: 'M3 17.25V21h3.75L17.8 9.94l-3.75-3.75zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z',
  trash: 'M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z',
  back: 'M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z',
  chart: 'M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z',
  settings: 'M19.1 12.9a7 7 0 0 0 0-1.8l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.6-.9L14.8 3h-4l-.4 2.6a7 7 0 0 0-1.6.9l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 1.8l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.6.9l.4 2.6h4l.4-2.6a7 7 0 0 0 1.6-.9l2.4 1 2-3.4zM12.8 15.5A3.5 3.5 0 1 1 16.3 12a3.5 3.5 0 0 1-3.5 3.5z',
  tool: 'M22.7 19 13.6 9.9c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z',
  upload: 'M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z',
  print: 'M19 8H5a3 3 0 0 0-3 3v6h4v4h12v-4h4v-6a3 3 0 0 0-3-3zm-3 11H8v-5h8zm3-7a1 1 0 1 1 1-1 1 1 0 0 1-1 1zM18 3H6v4h12z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

// ---------- Fenêtre modale (élément <dialog> natif : focus et Échap gérés) ----------

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className={`modal${wide ? ' modal-wide' : ''}`} onClose={onClose} onCancel={onClose}>
      <header className="modal-head">
        <h2>{title}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Fermer">
          <Icon name="close" />
        </button>
      </header>
      <div className="modal-body">{children}</div>
      {footer && <footer className="modal-foot">{footer}</footer>}
    </dialog>
  );
}

/** Demande de confirmation avant une action sensible */
export function useConfirm() {
  const [state, setState] = useState<{ title: string; message: ReactNode; danger?: boolean; resolve: (ok: boolean) => void } | null>(null);

  const confirm = (title: string, message: ReactNode, danger = false) =>
    new Promise<boolean>((resolve) => setState({ title, message, danger, resolve }));

  const close = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };

  const dialog = (
    <Modal
      open={!!state}
      title={state?.title ?? ''}
      onClose={() => close(false)}
      footer={
        <>
          <button className="btn" onClick={() => close(false)}>
            Annuler
          </button>
          <button className={`btn ${state?.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)}>
            Confirmer
          </button>
        </>
      }
    >
      {state?.message}
    </Modal>
  );

  return { confirm, dialog };
}

export function CopyButton({ value, label = 'Copier' }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm"
      onClick={() =>
        void navigator.clipboard.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1_500);
        })
      }
    >
      <Icon name="copy" size={16} /> {done ? 'Copié ✓' : label}
    </button>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export const PHASE_LABEL = { lobby: 'En attente', playing: 'En cours', ended: 'Terminée' } as const;

export function PhaseBadge({ phase }: { phase: keyof typeof PHASE_LABEL }) {
  return <span className={`badge badge-${phase}`}>{PHASE_LABEL[phase]}</span>;
}

export const fmtDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
export const fmtDay = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });
