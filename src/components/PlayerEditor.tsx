import { useEffect, useMemo, useState } from 'react';
import { useLive } from '../lib/admin-socket';
import { CLASS_LABELS, type ControlPlayer, type PlayerPatch } from '../protocol';

const SCHOOLS: { id: NonNullable<PlayerPatch['school']>; label: string }[] = [
  { id: 'quartier', label: 'Lycée de quartier' },
  { id: 'centre', label: 'Lycée de centre-ville' },
  { id: 'prive', label: 'Privé sous contrat' },
  { id: 'elite', label: 'Privé d’élite' },
];

const money = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const r1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

type Draft = Required<PlayerPatch>;

const draftOf = (c: ControlPlayer): Draft => ({
  budget: c.budget,
  grade: c.grade,
  contacts: c.contacts,
  energy: c.energy,
  engagement: c.engagement,
  boursier: c.boursier,
  info: c.info,
  cordees: c.cordees,
  homeOwner: c.homeOwner,
  school: c.schoolId,
});

/**
 * Éditeur d'un personnage : chaque paramètre se modifie à la main (démonstration en direct).
 * Seuls les champs changés sont envoyés ; le joueur voit « La régie a modifié ta situation ».
 */
export function PlayerEditor({ char, roomId, onDone, big = false }: { char: ControlPlayer; roomId: string; onDone?: (msg: string) => void; big?: boolean }) {
  const { call } = useLive();
  const base = useMemo(() => draftOf(char), [char]);
  const [draft, setDraft] = useState<Draft>(base);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Nouveau joueur sélectionné : on repart de ses valeurs
  useEffect(() => {
    setDraft(draftOf(char));
    setError(null);
  }, [char.id]);

  const changed = (Object.keys(draft) as (keyof Draft)[]).filter((k) => draft[k] !== base[k]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  async function apply() {
    if (!changed.length) return;
    setBusy(true);
    setError(null);
    const patch: PlayerPatch = {};
    for (const k of changed) (patch as Record<string, unknown>)[k] = draft[k];
    const res = await call('admin:editPlayer', { roomId, characterId: char.id, patch });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onDone?.(`${char.members.join(' & ')} modifié`);
  }

  const name = char.members.join(' & ');
  return (
    <div className={`pe${big ? ' big' : ''}`}>
      <div className="pe-head">
        <div>
          <strong>{name}</strong>
          <span className="rg-cls" data-cls={char.origin}>
            {CLASS_LABELS[char.origin]}
          </span>
        </div>
        <span className={`pe-done${char.done ? ' on' : ''}`}>{char.done ? '✓ a validé' : 'en cours'}</span>
      </div>
      <p className="pe-status">{char.status}</p>
      <div className="pe-facts">
        {char.bac && <span>Bac : {char.bac}</span>}
        {char.formation && <span>Études : {char.formation}</span>}
        {char.diploma && <span>Diplôme : {char.diploma}</span>}
        {char.job && <span>Emploi : {char.job}</span>}
      </div>

      <Field label="Argent" value={`${money.format(draft.budget)} €`} changed={draft.budget !== base.budget}>
        <div className="pe-steps">
          {[-5000, -1000, -100, 100, 1000, 5000].map((d) => (
            <button key={d} className={`pe-chip${d < 0 ? ' neg' : ''}`} onClick={() => set('budget', draft.budget + d)}>
              {d > 0 ? '+' : '−'}
              {Math.abs(d) >= 1000 ? `${Math.abs(d) / 1000} k` : Math.abs(d)}
            </button>
          ))}
        </div>
        <input type="number" step={100} value={draft.budget} onChange={(e) => set('budget', Math.round(Number(e.target.value) || 0))} />
      </Field>

      <Field label="Moyenne" value={`${draft.grade.toFixed(1).replace('.', ',')} / 20`} changed={draft.grade !== base.grade}>
        <div className="pe-range">
          <button className="pe-chip neg" onClick={() => set('grade', clamp(r1(draft.grade - 0.5), 0, 20))}>
            −0,5
          </button>
          <input type="range" min={0} max={20} step={0.1} value={draft.grade} onChange={(e) => set('grade', r1(Number(e.target.value)))} />
          <button className="pe-chip" onClick={() => set('grade', clamp(r1(draft.grade + 0.5), 0, 20))}>
            +0,5
          </button>
        </div>
      </Field>

      <Field label="Énergie" value={`${draft.energy.toFixed(1).replace('.', ',')} / 5`} changed={draft.energy !== base.energy}>
        <div className="pe-range">
          <button className="pe-chip neg" onClick={() => set('energy', clamp(r1(draft.energy - 0.5), 0, 5))}>
            −0,5
          </button>
          <input type="range" min={0} max={5} step={0.1} value={draft.energy} onChange={(e) => set('energy', r1(Number(e.target.value)))} />
          <button className="pe-chip" onClick={() => set('energy', clamp(r1(draft.energy + 0.5), 0, 5))}>
            +0,5
          </button>
        </div>
      </Field>

      <div className="pe-two">
        <Stepper label="Contacts" value={draft.contacts} min={0} max={50} changed={draft.contacts !== base.contacts} onChange={(v) => set('contacts', v)} />
        <Stepper label="Engagement" value={draft.engagement} min={0} max={20} changed={draft.engagement !== base.engagement} onChange={(v) => set('engagement', v)} />
      </div>

      <Field label="Lycée" changed={draft.school !== base.school}>
        <select value={draft.school} onChange={(e) => set('school', e.target.value as Draft['school'])}>
          {SCHOOLS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="pe-toggles">
        {(
          [
            ['boursier', 'Boursier'],
            ['info', 'Au courant des filières sélectives'],
            ['cordees', 'Cordées de la réussite'],
            ['homeOwner', 'Propriétaire'],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className={`pe-toggle${draft[k] !== base[k] ? ' changed' : ''}`}>
            <input type="checkbox" checked={draft[k]} onChange={(e) => set(k, e.target.checked)} />
            <span>{label}</span>
          </label>
        ))}
      </div>

      {error && <div className="rg-error">{error}</div>}
      <div className="pe-actions">
        <button className="rg-btn" disabled={!changed.length || busy} onClick={() => setDraft(base)}>
          Annuler
        </button>
        <button className="rg-btn go" disabled={!changed.length || busy} onClick={() => void apply()}>
          {busy ? 'Envoi…' : changed.length ? `Appliquer (${changed.length})` : 'Appliquer'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, changed, children }: { label: string; value?: string; changed?: boolean; children: React.ReactNode }) {
  return (
    <div className={`pe-field${changed ? ' changed' : ''}`}>
      <div className="pe-label">
        <span>{label}</span>
        {value && <b>{value}</b>}
      </div>
      {children}
    </div>
  );
}

function Stepper({ label, value, min, max, changed, onChange }: { label: string; value: number; min: number; max: number; changed: boolean; onChange: (v: number) => void }) {
  return (
    <div className={`pe-field${changed ? ' changed' : ''}`}>
      <div className="pe-label">
        <span>{label}</span>
      </div>
      <div className="pe-stepper">
        <button className="pe-chip neg" onClick={() => onChange(clamp(value - 1, min, max))} aria-label={`${label} −1`}>
          −
        </button>
        <b>{value}</b>
        <button className="pe-chip" onClick={() => onChange(clamp(value + 1, min, max))} aria-label={`${label} +1`}>
          +
        </button>
      </div>
    </div>
  );
}
