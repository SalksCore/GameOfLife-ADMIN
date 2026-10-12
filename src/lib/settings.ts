import { request } from './api';

export interface GeneralSettings {
  gameName: string;
  welcomeMessage: string;
  defaultMaxPlayers: number;
  maxOpenRooms: number;
  idleTimeoutHours: number;
  chatEnabled: boolean;
}

export interface MaintenanceSettings {
  enabled: boolean;
  message: string;
  endsAt: string | null;
  since: string | null;
}

export interface SettingsMeta {
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface SettingsResponse {
  general: GeneralSettings;
  maintenance: MaintenanceSettings;
  meta: { general: SettingsMeta; maintenance: SettingsMeta };
}

export const fetchSettings = () => request<SettingsResponse>('GET', '/api/admin/settings');

/** "2026-09-17T18:30" (champ datetime-local) <-> ISO 8601 */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}
