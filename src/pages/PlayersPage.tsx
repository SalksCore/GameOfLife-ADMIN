import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { CredentialsModal } from '../components/CredentialsModal';
import { fmtDay, Icon, Modal, PageHeader } from '../components/ui';
import { request } from '../lib/api';
import { relativeTime, type Credentials, type PlayerRow } from '../lib/players';

interface PageData {
  items: PlayerRow[];
  page: number;
  pageSize: number;
  total: number;
  counts: { all: number; active: number; banned: number; never: number };
}

type Status = 'all' | 'active' | 'banned' | 'never';
type Sort = 'recent' | 'name' | 'games' | 'lastLogin';

const STATUS_TABS: { id: Status; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'active', label: 'Actifs' },
  { id: 'banned', label: 'Suspendus' },
  { id: 'never', label: 'Jamais connectés' },
];

const SORTS: Record<Sort, string> = {
  recent: 'Plus récents',
  name: 'Nom (A → Z)',
  games: 'Parties jouées',
  lastLogin: 'Dernière connexion',
};

/** "Jean Dupont" / "DUPONT Jean" / "Jean;Dupont" -> prénom + nom */
function parseLine(line: string): { firstName: string; lastName: string } | null {
  const clean = line.trim();
  if (!clean) return null;
  const parts = clean.includes(';') || clean.includes(',') || clean.includes('\t')
    ? clean.split(/[;,\t]/).map((s) => s.trim())
    : clean.split(/\s+/);
  if (parts.length < 2) return { firstName: parts[0] ?? '', lastName: '' };
  // Format "NOM Prénom" : nom entièrement en majuscules en premier
  if (parts[0] === parts[0]!.toUpperCase() && parts[0] !== parts[0]!.toLowerCase() && !clean.includes(';')) {
    return { lastName: parts[0]!, firstName: parts.slice(1).join(' ') };
  }
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') };
}

/** Liste des joueurs : recherche, filtres, tri, création unitaire et en masse. */
export function PlayersPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = (params.get('statut') as Status) || 'all';
  const sort = (params.get('tri') as Sort) || 'recent';
  const page = Number(params.get('page') ?? 1);
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [data, setData] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState<Credentials[] | null>(null);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '' || (k === 'page' && v === '1')) next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ page: String(page), status, sort });
      const q = params.get('q');
      if (q) qs.set('q', q);
      setData(await request<PageData>('GET', `/api/admin/players?${qs}`));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  }, [page, status, sort, params]);

  useEffect(() => {
    void load();
  }, [load]);

  // Recherche avec anti-rebond, reflétée dans l'URL
  useEffect(() => {
    const id = setTimeout(() => {
      if ((params.get('q') ?? '') !== query.trim()) update({ q: query.trim(), page: '1' });
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  const parsedBulk = useMemo(() => bulkText.split('\n').map(parseLine).filter((l) => l !== null), [bulkText]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setFormError(null);
    try {
      const res = await request<{ player: PlayerRow; credentials: { username: string; password: string } }>(
        'POST',
        '/api/admin/players',
        { firstName: form.get('firstName'), lastName: form.get('lastName') },
      );
      setCreateOpen(false);
      setBulkErrors([]);
      setCredentials([{ ...res.credentials, firstName: res.player.firstName, lastName: res.player.lastName }]);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  async function createBulk() {
    setBusy(true);
    setFormError(null);
    try {
      const res = await request<{
        results: ({ index: number; ok: true } & Credentials | { index: number; ok: false; error: string })[];
      }>('POST', '/api/admin/players/bulk', { players: parsedBulk });
      const created = res.results.filter((r): r is { index: number; ok: true } & Credentials => r.ok);
      const failed = res.results.filter((r) => !r.ok) as { index: number; error: string }[];
      setBulkErrors(
        failed.map((f) => {
          const l = parsedBulk[f.index]!;
          return `Ligne « ${`${l.firstName} ${l.lastName}`.trim()} » : ${f.error}`;
        }),
      );
      setBulkOpen(false);
      setBulkText('');
      if (created.length) setCredentials(created);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader
        title="Joueurs"
        subtitle="Comptes créés par l’administration — identifiant et mot de passe générés automatiquement"
        actions={
          <>
            <button className="btn" onClick={() => { setFormError(null); setBulkOpen(true); }}>
              <Icon name="upload" size={18} /> Création en masse
            </button>
            <button className="btn btn-primary" onClick={() => { setFormError(null); setCreateOpen(true); }}>
              <Icon name="plus" size={18} /> Nouveau joueur
            </button>
          </>
        }
      />

      {error && <div className="alert alert-error">{error}</div>}
      {bulkErrors.length > 0 && (
        <div className="alert alert-warning">
          <strong>{bulkErrors.length} ligne(s) ignorée(s) :</strong>
          <ul className="bullets">
            {bulkErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="card">
        <div className="toolbar">
          <div className="tabs-inline" role="tablist">
            {STATUS_TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={status === t.id}
                onClick={() => update({ statut: t.id === 'all' ? null : t.id, page: '1' })}
              >
                {t.label}
                <span className="count">{data?.counts[t.id] ?? '·'}</span>
              </button>
            ))}
          </div>
          <div className="toolbar-right">
            <div className="search">
              <Icon name="search" size={18} />
              <input
                type="search"
                placeholder="Nom, prénom ou identifiant…"
                value={query}
                maxLength={40}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Rechercher un joueur"
              />
            </div>
            <select
              className="select"
              value={sort}
              onChange={(e) => update({ tri: e.target.value === 'recent' ? null : e.target.value, page: '1' })}
              aria-label="Trier"
            >
              {(Object.keys(SORTS) as Sort[]).map((s) => (
                <option key={s} value={s}>
                  {SORTS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Joueur</th>
              <th>Identifiant</th>
              <th className="num">Parties</th>
              <th>Dernière connexion</th>
              <th>Créé le</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  {params.get('q') || status !== 'all' ? 'Aucun joueur ne correspond à ces critères.' : 'Aucun joueur. Créez le premier compte.'}
                </td>
              </tr>
            )}
            {data?.items.map((p) => (
              <tr
                key={p.id}
                className="clickable"
                onClick={() => navigate(`/joueurs/${p.id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/joueurs/${p.id}`)}
                tabIndex={0}
              >
                <td>
                  <div className="person">
                    <span className="avatar">
                      {p.firstName.charAt(0)}
                      {p.lastName.charAt(0)}
                      {p.online && <span className="presence" title="En ligne" />}
                    </span>
                    <span className="strong">
                      {p.lastName.toUpperCase()} {p.firstName}
                    </span>
                  </div>
                </td>
                <td>
                  <code className="code">{p.username}</code>
                </td>
                <td className="num">{p.gamesPlayed}</td>
                <td className="text-muted" title={p.lastLoginAt ? new Date(p.lastLoginAt).toLocaleString('fr-FR') : undefined}>
                  {p.online ? <span className="online-text">En ligne</span> : relativeTime(p.lastLoginAt)}
                </td>
                <td className="text-muted">{fmtDay.format(new Date(p.createdAt))}</td>
                <td>
                  {p.bannedAt ? (
                    <span className="badge badge-danger">Suspendu</span>
                  ) : p.lastLoginAt ? (
                    <span className="badge badge-ok">Actif</span>
                  ) : (
                    <span className="badge badge-ended">Jamais connecté</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pager">
          <span className="text-muted">{data?.total ?? 0} joueur(s)</span>
          {pages > 1 && (
            <div className="pager-buttons">
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
                Précédent
              </button>
              <span>
                Page {page} / {pages}
              </span>
              <button className="btn btn-sm" disabled={page >= pages} onClick={() => update({ page: String(page + 1) })}>
                Suivant
              </button>
            </div>
          )}
        </div>
      </section>

      <Modal
        open={createOpen}
        title="Nouveau joueur"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button className="btn" onClick={() => setCreateOpen(false)}>
              Annuler
            </button>
            <button className="btn btn-primary" form="create-player" disabled={busy}>
              {busy ? 'Création…' : 'Créer le compte'}
            </button>
          </>
        }
      >
        <form id="create-player" className="form-grid two" onSubmit={create}>
          <label className="form-field">
            <span>Prénom</span>
            <input name="firstName" required maxLength={40} autoComplete="off" autoFocus />
          </label>
          <label className="form-field">
            <span>Nom</span>
            <input name="lastName" required maxLength={40} autoComplete="off" />
          </label>
          <p className="text-muted small span-2">
            Identifiant : 1re lettre du nom + prénom (Jean Dupont → <code>djean</code>). Mot de passe généré
            aléatoirement.
          </p>
          {formError && <div className="alert alert-error span-2">{formError}</div>}
        </form>
      </Modal>

      <Modal
        open={bulkOpen}
        title="Création en masse"
        onClose={() => setBulkOpen(false)}
        wide
        footer={
          <>
            <button className="btn" onClick={() => setBulkOpen(false)}>
              Annuler
            </button>
            <button
              className="btn btn-primary"
              disabled={busy || parsedBulk.length === 0 || parsedBulk.length > 200}
              onClick={() => void createBulk()}
            >
              {busy ? 'Création…' : `Créer ${parsedBulk.length} compte(s)`}
            </button>
          </>
        }
      >
        <p>
          Un joueur par ligne : <code>Prénom Nom</code>, <code>NOM Prénom</code> ou <code>Prénom;Nom</code> (copier-coller
          depuis un tableur possible). 200 lignes maximum.
        </p>
        <div className="bulk-grid">
          <textarea
            className="bulk-input"
            rows={12}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={'Jean Dupont\nMARTIN Alice\nLéa;Bernard'}
            autoFocus
          />
          <div className="bulk-preview">
            <div className="text-muted small">Aperçu ({parsedBulk.length})</div>
            <ul>
              {parsedBulk.slice(0, 50).map((l, i) => (
                <li key={i} className={!l.firstName || !l.lastName ? 'invalid' : undefined}>
                  <span>{l.firstName || '—'}</span>
                  <strong>{l.lastName || '—'}</strong>
                </li>
              ))}
              {parsedBulk.length > 50 && <li className="text-muted">… et {parsedBulk.length - 50} autre(s)</li>}
            </ul>
          </div>
        </div>
        {formError && <div className="alert alert-error">{formError}</div>}
      </Modal>

      <CredentialsModal
        title={credentials && credentials.length > 1 ? `${credentials.length} comptes créés` : 'Compte créé'}
        list={credentials}
        onClose={() => setCredentials(null)}
      />
    </>
  );
}
