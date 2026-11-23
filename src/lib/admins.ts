import { request } from './api';

export type AdminRole = 'owner' | 'admin';

export interface AdminRow {
  id: string;
  username: string;
  role: AdminRole;
  disabledAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  activeSessions: number;
}

export interface AdminCredentials {
  username: string;
  password: string;
}

export const ROLE_LABEL: Record<AdminRole, string> = { owner: 'Propriétaire', admin: 'Admin' };

export const adminsApi = {
  list: () => request<{ admins: AdminRow[] }>('GET', '/api/admin/admins'),
  create: (username: string, role: AdminRole) =>
    request<{ admin: AdminRow; credentials: AdminCredentials }>('POST', '/api/admin/admins', { username, role }),
  update: (id: string, patch: { role?: AdminRole; disabled?: boolean }) =>
    request<{ admin: AdminRow }>('PATCH', `/api/admin/admins/${id}`, patch),
  resetPassword: (id: string) =>
    request<{ credentials: AdminCredentials }>('POST', `/api/admin/admins/${id}/reset-password`, {}),
  remove: (id: string) => request('DELETE', `/api/admin/admins/${id}`),
  changeOwnPassword: (current: string, next: string) =>
    request<{ ok: true }>('POST', '/api/admin/auth/password', { current, next }),
};
