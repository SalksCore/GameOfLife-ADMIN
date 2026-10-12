import type { Credentials } from '../lib/players';
import { CopyButton, Icon, Modal } from './ui';

const asText = (list: Credentials[]) =>
  list.map((c) => `${c.firstName} ${c.lastName}\nIdentifiant : ${c.username}\nMot de passe : ${c.password}`).join('\n\n');

const asCsv = (list: Credentials[]) =>
  [
    'prenom;nom;identifiant;mot_de_passe',
    ...list.map((c) => [c.firstName, c.lastName, c.username, c.password].map((v) => `"${v.replace(/"/g, '""')}"`).join(';')),
  ].join('\r\n');

function downloadCsv(list: Credentials[]) {
  // BOM : Excel lit correctement les accents
  const blob = new Blob(['﻿', asCsv(list)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `identifiants-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Affiche des identifiants générés — une seule fois. */
export function CredentialsModal({
  title,
  list,
  onClose,
}: {
  title: string;
  list: Credentials[] | null;
  onClose: () => void;
}) {
  const many = (list?.length ?? 0) > 1;
  return (
    <Modal
      open={!!list}
      title={title}
      onClose={onClose}
      wide={many}
      footer={
        <>
          <button className="btn" onClick={() => window.print()}>
            <Icon name="print" size={16} /> Imprimer
          </button>
          {many && (
            <button className="btn" onClick={() => list && downloadCsv(list)}>
              Télécharger (CSV)
            </button>
          )}
          <CopyButton value={list ? asText(list) : ''} label="Tout copier" />
          <button className="btn btn-primary" onClick={onClose}>
            J’ai noté les identifiants
          </button>
        </>
      }
    >
      <div className="alert alert-warning">
        {many ? 'Ces mots de passe ne seront' : 'Ce mot de passe ne sera'} <strong>plus jamais affiché{many && 's'}</strong>.
        Transmettez-{many ? 'les' : 'le'} maintenant.
      </div>
      <div className="print-area">
        {many ? (
          <table className="table compact">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Identifiant</th>
                <th>Mot de passe</th>
              </tr>
            </thead>
            <tbody>
              {list!.map((c) => (
                <tr key={c.username}>
                  <td>
                    {c.lastName.toUpperCase()} {c.firstName}
                  </td>
                  <td>
                    <code className="code">{c.username}</code>
                  </td>
                  <td>
                    <code className="code">{c.password}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          list?.[0] && (
            <div className="credentials">
              <p className="cred-name">
                {list[0].firstName} {list[0].lastName}
              </p>
              <div className="cred-row">
                <span>Identifiant</span>
                <code>{list[0].username}</code>
                <CopyButton value={list[0].username} />
              </div>
              <div className="cred-row">
                <span>Mot de passe</span>
                <code>{list[0].password}</code>
                <CopyButton value={list[0].password} />
              </div>
            </div>
          )
        )}
      </div>
    </Modal>
  );
}
