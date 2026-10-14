/**
 * Adresse de l'application joueurs (PHONE), affichée sur l'écran projeté et dans le QR code.
 * Ordre : réglage de la régie (cet appareil) > VITE_PHONE_URL > même machine, port 5173.
 * En salle de classe, mettre l'adresse IP du PC sur le réseau local (ex. http://192.168.1.20:5173).
 */
const KEY = 'gol.phoneUrl';

export function defaultPhoneUrl(): string {
  return import.meta.env.VITE_PHONE_URL ?? `${location.protocol}//${location.hostname}:5173`;
}

export function phoneUrl(): string {
  try {
    return localStorage.getItem(KEY) || defaultPhoneUrl();
  } catch {
    return defaultPhoneUrl();
  }
}

export function setPhoneUrl(url: string): void {
  try {
    if (url.trim()) localStorage.setItem(KEY, url.trim().replace(/\/+$/, ''));
    else localStorage.removeItem(KEY);
  } catch {
    // Stockage indisponible : l'adresse par défaut reste utilisée
  }
}

/** Adresse sans le protocole, plus lisible à l'écran */
export const phoneHost = () => phoneUrl().replace(/^https?:\/\//, '');

/** Lien direct : ouvre l'application avec le code pré-rempli */
export const joinUrl = (code: string) => `${phoneUrl()}/?code=${code}`;
