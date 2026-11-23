import type { jsPDF as JsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { Credentials } from './players';
import { phoneHost, phoneUrl } from './phone-url';

/**
 * PDF des identifiants : une page de contrôle pour l'enseignant, puis des fiches à découper
 * (10 par page A4, 2 × 5, traits de coupe en pointillés). Généré dans le navigateur :
 * les mots de passe ne transitent par aucun serveur.
 */

type RGB = [number, number, number];
const INK: RGB = [14, 17, 22];
const INK2: RGB = [43, 50, 64];
const MUTED: RGB = [93, 102, 117];
const LINE: RGB = [214, 219, 226];
const LIFE: RGB = [198, 242, 90];
const LIFE_SOFT: RGB = [241, 251, 217];
const LIFE_DARK: RGB = [61, 90, 15];
const CELL: RGB = [38, 44, 54];

// Planeur du jeu de la vie (motif du logo)
const GLIDER = [
  [0, 1, 0],
  [0, 0, 1],
  [1, 1, 1],
];

const PAGE_W = 210;
const PAGE_H = 297;
const COLS = 2;
const ROWS = 5;
const MARGIN_X = 10;
const MARGIN_Y = 13.5;
const CARD_W = (PAGE_W - 2 * MARGIN_X) / COLS; // 95 mm
const CARD_H = (PAGE_H - 2 * MARGIN_Y) / ROWS; // 54 mm
const PAD = 5;

/** k7mxp4rz -> « k7mx p4rz » : deux groupes lisibles, la connexion ignore l'espace */
const grouped = (pw: string) => (/^[a-z0-9]{8}$/.test(pw) ? `${pw.slice(0, 4)}  ${pw.slice(4)}` : pw);

const fullName = (c: Credentials) => `${c.firstName} ${c.lastName}`.trim() || c.username;

function logo(doc: JsPDF, x: number, y: number, cell: number, dark: boolean) {
  const gap = cell * 0.22;
  GLIDER.forEach((row, r) =>
    row.forEach((on, col) => {
      doc.setFillColor(...(on ? LIFE : dark ? CELL : LINE));
      doc.roundedRect(x + col * (cell + gap), y + r * (cell + gap), cell, cell, cell * 0.22, cell * 0.22, 'F');
    }),
  );
  return 3 * cell + 2 * gap;
}

function wordmark(doc: JsPDF, x: number, y: number, size: number, color: RGB) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size);
  doc.setTextColor(...color);
  doc.text('Game', x, y);
  let w = doc.getTextWidth('Game');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...(color === INK ? LIFE_DARK : LIFE));
  doc.text('of', x + w, y);
  w += doc.getTextWidth('of');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...color);
  doc.text('Life', x + w, y);
}

/** Raccourcit un texte trop long pour sa colonne */
function fit(doc: JsPDF, text: string, max: number) {
  if (doc.getTextWidth(text) <= max) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(`${t}…`) > max) t = t.slice(0, -1);
  return `${t}…`;
}

function scissors(doc: JsPDF, x: number, y: number) {
  doc.setDrawColor(...MUTED);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([], 0);
  doc.circle(x, y - 1.1, 0.8, 'S');
  doc.circle(x, y + 1.1, 0.8, 'S');
  doc.line(x + 0.6, y - 0.6, x + 3.6, y + 0.9);
  doc.line(x + 0.6, y + 0.6, x + 3.6, y - 0.9);
}

function coverPage(doc: JsPDF, list: Credentials[], date: string) {
  // Bandeau
  doc.setFillColor(...INK);
  doc.rect(0, 0, PAGE_W, 46, 'F');
  const s = logo(doc, 16, 14, 5.2, true);
  wordmark(doc, 16 + s + 5, 25.5, 17, [255, 255, 255]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(170, 178, 190);
  doc.text('Identifiants des joueurs', 16 + s + 5, 31.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...LIFE);
  doc.text(String(list.length), PAGE_W - 16, 25, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(170, 178, 190);
  doc.text(list.length > 1 ? 'comptes' : 'compte', PAGE_W - 16, 31.5, { align: 'right' });

  // Mode d'emploi
  let y = 58;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text('Mode d’emploi', 16, y);
  const steps = [
    'Imprimez les pages suivantes et découpez le long des pointillés : une fiche par élève.',
    `Chaque élève ouvre ${phoneHost()} (ou scanne le QR code de sa fiche) et tape ses identifiants.`,
    'Le mot de passe se tape en minuscules, avec ou sans l’espace du milieu.',
    'Ces mots de passe ne sont plus affichés nulle part : gardez cette page, ou détruisez-la après la séance.',
  ];
  doc.setFontSize(9.2);
  y += 7;
  steps.forEach((t, i) => {
    doc.setFillColor(...LIFE);
    doc.circle(19, y - 1.2, 2.6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...INK);
    doc.text(String(i + 1), 19, y - 0.1, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...INK2);
    const lines = doc.splitTextToSize(t, PAGE_W - 16 - 26);
    doc.text(lines, 25, y);
    y += 5 + (lines.length - 1) * 4.2;
  });

  // Liste de contrôle
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text('Liste de contrôle', 16, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Générée le ${date}`, PAGE_W - 16, y, { align: 'right' });
  y += 4;

  const colX = [16, 26, 104, 150];
  const header = () => {
    doc.setFillColor(...INK);
    doc.rect(16, y, PAGE_W - 32, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(255, 255, 255);
    ['#', 'Nom', 'Identifiant', 'Mot de passe'].forEach((h, i) => doc.text(h, colX[i]! + 2.5, y + 4.7));
    y += 7;
  };
  header();
  list.forEach((c, i) => {
    if (y > PAGE_H - 18) {
      doc.addPage();
      y = 16;
      header();
    }
    if (i % 2 === 1) {
      doc.setFillColor(246, 247, 244);
      doc.rect(16, y, PAGE_W - 32, 6.4, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.4);
    doc.setTextColor(...MUTED);
    doc.text(String(i + 1), colX[0]! + 2.5, y + 4.4);
    doc.setTextColor(...INK);
    doc.text(fit(doc, c.lastName ? `${c.lastName.toUpperCase()} ${c.firstName}` : fullName(c), 74), colX[1]! + 2.5, y + 4.4);
    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.text(fit(doc, c.username, 42), colX[2]! + 2.5, y + 4.4);
    doc.text(grouped(c.password), colX[3]! + 2.5, y + 4.4);
    y += 6.4;
  });
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(16, y, PAGE_W - 16, y);
}

function card(doc: JsPDF, c: Credentials, x: number, y: number, qr: string, host: string) {
  const ix = x + PAD;
  const iw = CARD_W - 2 * PAD;

  // En-tête : logo + marque, QR à droite
  const s = logo(doc, ix, y + PAD, 2.3, false);
  wordmark(doc, ix + s + 2.4, y + PAD + 4.9, 10, INK);
  const qrSize = 21;
  doc.addImage(qr, 'PNG', x + CARD_W - PAD - qrSize, y + PAD, qrSize, qrSize);

  // Nom
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text(fit(doc, fullName(c), iw - qrSize - 3), ix, y + PAD + 14.5);

  // Identifiant
  const fy = y + PAD + 21;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  doc.setTextColor(...MUTED);
  doc.text('IDENTIFIANT', ix, fy);
  doc.setFont('courier', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text(fit(doc, c.username, iw - qrSize - 3), ix, fy + 5.4);

  // Mot de passe, sur pastille vert clair
  const py = fy + 9.3;
  doc.setFillColor(...LIFE_SOFT);
  doc.setDrawColor(...LIFE);
  doc.setLineWidth(0.4);
  doc.setLineDashPattern([], 0);
  doc.roundedRect(ix, py, iw, 11.2, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  doc.setTextColor(...LIFE_DARK);
  doc.text('MOT DE PASSE', ix + 3, py + 6.8);
  doc.setFont('courier', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...INK);
  doc.text(grouped(c.password), ix + iw - 3, py + 7.6, { align: 'right' });

  // Pied
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  doc.setTextColor(...MUTED);
  doc.text(fit(doc, `Se connecter : ${host}`, iw * 0.62), ix, y + CARD_H - PAD + 0.6);
  doc.text('Ne pas partager', ix + iw, y + CARD_H - PAD + 0.6, { align: 'right' });
}

function cutLines(doc: JsPDF) {
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([1.6, 1.4], 0);
  for (let c = 0; c <= COLS; c++) {
    const x = MARGIN_X + c * CARD_W;
    doc.line(x, MARGIN_Y - 4, x, PAGE_H - MARGIN_Y + 4);
  }
  for (let r = 0; r <= ROWS; r++) {
    const y = MARGIN_Y + r * CARD_H;
    doc.line(MARGIN_X - 4, y, PAGE_W - MARGIN_X + 4, y);
  }
  doc.setLineDashPattern([], 0);
  scissors(doc, 3.2, MARGIN_Y);
}

async function qrDataUrl(url: string) {
  return QRCode.toDataURL(url, { margin: 0, width: 300, errorCorrectionLevel: 'M', color: { dark: '#0E1116', light: '#FFFFFF' } });
}

export async function downloadCredentialsPdf(list: Credentials[]): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const now = new Date();
  const date = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const url = phoneUrl();
  const host = phoneHost();
  const qr = await qrDataUrl(url);

  doc.setProperties({ title: 'GameOfLife · identifiants des joueurs', subject: 'Fiches à découper', creator: 'GameOfLife ADMIN' });
  coverPage(doc, list, date);

  const perPage = COLS * ROWS;
  for (let i = 0; i < list.length; i += perPage) {
    doc.addPage();
    cutLines(doc);
    list.slice(i, i + perPage).forEach((c, k) => {
      const col = k % COLS;
      const row = Math.floor(k / COLS);
      card(doc, c, MARGIN_X + col * CARD_W, MARGIN_Y + row * CARD_H, qr, host);
    });
  }

  // Numéros de page
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(`${p} / ${total}`, PAGE_W / 2, PAGE_H - 4.5, { align: 'center' });
  }

  doc.save(`identifiants-gameoflife-${now.toISOString().slice(0, 10)}.pdf`);
}
