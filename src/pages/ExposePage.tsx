import { useEffect, useState } from 'react';
import { PageHeader } from '../components/ui';
import { request } from '../lib/api';
import { LIMITS, type DeckStep, type ExposeContent, type FactCard } from '../protocol';

interface ExposeData {
  deck: DeckStep[];
  cards: FactCard[];
  defaultCards: FactCard[];
  defaultDeck: DeckStep[];
}

const GAME = new Set(['draw', 'year', 'bac', 'vote', 'parcoursup', 'parcoursupResults', 'parcoursupFinal', 'diploma', 'jobs', 'final']);
const KIND_LABEL: Record<string, string> = {
  slide: '▭ Diapositive',
  poll: '◆ Sondage',
  pollCompare: '◆ Avant / après',
  vote: '◆ Vote',
  stats: '● Chiffres',
  debrief: '◈ Débrief',
};
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Contenus de l'exposé : diaporama (25 étapes) et cartes « Le saviez-vous » */
export function ExposePage() {
  const [data, setData] = useState<ExposeData | null>(null);
  const [deck, setDeck] = useState<DeckStep[]>([]);
  const [cards, setCards] = useState<FactCard[]>([]);
  const [tab, setTab] = useState<'deck' | 'cards'>('deck');
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = (d: ExposeData) => {
    setData(d);
    setDeck(structuredClone(d.deck));
    setCards(structuredClone(d.cards));
  };
  useEffect(() => {
    request<ExposeData>('GET', '/api/admin/settings/expose').then(load, (e: Error) => setError(e.message));
  }, []);

  if (!data) return <PageHeader title="Exposé" subtitle={error ?? 'Chargement…'} />;
  const dirty = JSON.stringify(deck) !== JSON.stringify(data.deck) || JSON.stringify(cards) !== JSON.stringify(data.cards);
  const total = deck.filter((s) => s.enabled).reduce((s, d) => s + d.plan, 0);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body: ExposeContent = {
        steps: Object.fromEntries(
          deck.map((s) => [s.id, { enabled: s.enabled, slide: { ...s.slide, bullets: s.slide.bullets.map((b) => b.trim()).filter(Boolean) } }]),
        ),
        cards,
      };
      load(await request<ExposeData>('PUT', '/api/admin/settings/expose', body));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  const setStep = (id: string, patch: Partial<DeckStep['slide']> & { enabled?: boolean }) => {
    setSaved(false);
    setDeck((d) =>
      d.map((s) => {
        if (s.id !== id) return s;
        const { enabled, ...slide } = patch;
        return { ...s, enabled: enabled ?? s.enabled, slide: { ...s.slide, ...slide } };
      }),
    );
  };
  const setCard = (i: number, patch: Partial<FactCard>) => {
    setSaved(false);
    setCards((c) => c.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  };
  const moveCard = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= cards.length) return;
    const c = [...cards];
    [c[i], c[j]] = [c[j]!, c[i]!];
    setCards(c);
    setSaved(false);
  };

  return (
    <>
      <PageHeader
        title="Exposé"
        subtitle={`25 étapes · ${fmt(total)} prévues · ${cards.length} cartes « Le saviez-vous ». Les changements valent pour les prochaines parties lancées.`}
        actions={
          <>
            {saved && !dirty && <span className="saved">Enregistré ✓</span>}
            <button className="btn" disabled={!dirty || busy} onClick={() => load(data)}>
              Annuler les modifications
            </button>
            <button className="btn btn-primary" disabled={!dirty || busy} onClick={() => void save()}>
              Enregistrer
            </button>
          </>
        }
      />
      {error && <div className="alert alert-error">{error}</div>}

      <div className="tabs">
        <button className={tab === 'deck' ? 'on' : ''} onClick={() => setTab('deck')}>
          Diaporama
        </button>
        <button className={tab === 'cards' ? 'on' : ''} onClick={() => setTab('cards')}>
          Cartes « Le saviez-vous »
        </button>
      </div>

      {tab === 'deck' ? (
        <ol className="ex-steps">
          {deck.map((s, i) => {
            const game = GAME.has(s.kind);
            const isOpen = open === s.id;
            return (
              <li key={s.id} className={`card ex-step${s.enabled ? '' : ' off'}${isOpen ? ' open' : ''}`}>
                <button className="ex-step-head" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen}>
                  <span className="ex-n">{i + 1}</span>
                  <span className="ex-kind">{game ? '● Jeu' : KIND_LABEL[s.kind]}</span>
                  <strong>{s.slide.title}</strong>
                  <span className="ex-meta">
                    {s.who} · {fmt(s.plan)}
                    {s.cards.length > 0 && ` · ${s.cards.join(', ')}`}
                  </span>
                  <span className="ex-chev">{isOpen ? '▾' : '▸'}</span>
                </button>
                {isOpen && (
                  <div className="ex-step-body">
                    {!game && (
                      <label className="ex-toggle">
                        <input type="checkbox" checked={s.enabled} onChange={(e) => setStep(s.id, { enabled: e.target.checked })} />
                        Afficher cette étape (décocher pour la masquer pendant l’exposé)
                      </label>
                    )}
                    {game && <p className="muted">Étape de jeu : toujours jouée, ni supprimable ni déplaçable. Seuls le titre et les notes se modifient.</p>}
                    <label className="field">
                      <span>Titre</span>
                      <input value={s.slide.title} maxLength={LIMITS.slideTitleMax} onChange={(e) => setStep(s.id, { title: e.target.value })} />
                    </label>
                    <label className="field">
                      <span>Sous-titre</span>
                      <input value={s.slide.subtitle} maxLength={LIMITS.slideTextMax} onChange={(e) => setStep(s.id, { subtitle: e.target.value })} />
                    </label>
                    {s.kind === 'slide' && (
                      <label className="field">
                        <span>Points (un par ligne, {LIMITS.slideBulletsMax} au maximum)</span>
                        <textarea
                          rows={5}
                          value={s.slide.bullets.join('\n')}
                          onChange={(e) => setStep(s.id, { bullets: e.target.value.split('\n').slice(0, LIMITS.slideBulletsMax) })}
                        />
                      </label>
                    )}
                    <label className="field">
                      <span>Notes de l’orateur (visibles seulement dans la régie)</span>
                      <textarea rows={5} maxLength={LIMITS.notesMax} value={s.slide.notes} onChange={(e) => setStep(s.id, { notes: e.target.value })} />
                    </label>
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        const def = data.defaultDeck.find((d) => d.id === s.id);
                        if (def) setStep(s.id, { ...def.slide, enabled: true });
                      }}
                    >
                      Revenir au texte d’origine
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <>
          <div className="ex-cards">
            {cards.map((c, i) => (
              <article key={i} className="card ex-card">
                <header>
                  <input className="ex-id" value={c.id} maxLength={8} onChange={(e) => setCard(i, { id: e.target.value })} aria-label="Numéro" />
                  <input className="ex-figure" value={c.figure} maxLength={30} onChange={(e) => setCard(i, { figure: e.target.value })} aria-label="Chiffre" />
                  <span className="ex-tools">
                    <button className="btn btn-ghost small" onClick={() => moveCard(i, -1)} disabled={i === 0} aria-label="Monter">
                      ▲
                    </button>
                    <button className="btn btn-ghost small" onClick={() => moveCard(i, 1)} disabled={i === cards.length - 1} aria-label="Descendre">
                      ▼
                    </button>
                    <button
                      className="btn btn-ghost small danger"
                      onClick={() => {
                        setCards(cards.filter((_, k) => k !== i));
                        setSaved(false);
                      }}
                      aria-label="Supprimer"
                    >
                      ✕
                    </button>
                  </span>
                </header>
                <input className="ex-title" value={c.title} maxLength={80} onChange={(e) => setCard(i, { title: e.target.value })} placeholder="Titre" />
                <textarea rows={4} value={c.text} maxLength={LIMITS.slideTextMax} onChange={(e) => setCard(i, { text: e.target.value })} placeholder="Ce qu’on dit" />
                <input value={c.link} maxLength={200} onChange={(e) => setCard(i, { link: e.target.value })} placeholder="Lien avec la partie (« Dans le jeu : … »)" />
                <div className="ex-row">
                  <input value={c.source} maxLength={200} onChange={(e) => setCard(i, { source: e.target.value })} placeholder="Source" />
                  <input value={c.moment} maxLength={60} onChange={(e) => setCard(i, { moment: e.target.value })} placeholder="Moment" />
                </div>
              </article>
            ))}
          </div>
          <div className="ex-actions">
            <button
              className="btn"
              disabled={cards.length >= LIMITS.cardsMax}
              onClick={() => {
                setCards([...cards, { id: `F${cards.length + 1}`, title: 'Nouvelle carte', figure: '?', text: 'Le chiffre et ce qu’il veut dire.', source: '', moment: '', link: '' }]);
                setSaved(false);
              }}
            >
              + Ajouter une carte
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setCards(structuredClone(data.defaultCards));
                setSaved(false);
              }}
            >
              Revenir aux 20 cartes d’origine
            </button>
          </div>
        </>
      )}
    </>
  );
}
