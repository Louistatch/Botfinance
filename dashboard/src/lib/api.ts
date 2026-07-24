'use client';

/**
 * Client API léger pour le backend CreditCEP AI.
 * Gère le JWT (stocké en localStorage) et l'enveloppe { success, data }.
 */
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export const TOKEN_KEY = 'creditcep_token';
export const USER_KEY = 'creditcep_user';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): any | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = '/';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') logout();
    throw new Error('Session expirée.');
  }

  const json = await res.json();
  if (!res.ok || json.success === false) {
    const msg = Array.isArray(json.message)
      ? json.message.join(', ')
      : json.message ?? 'Erreur';
    throw new Error(msg);
  }
  return (json.data ?? json) as T;
}

export const api = {
  async login(email: string, password: string) {
    const data = await request<{ accessToken: string; user: any }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    );
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data;
  },
  stats: () => request<any>('/dashboard/stats'),
  map: () => request<any[]>('/dashboard/map'),
  cooperatives: () => request<any[]>('/cooperatives'),
  creditRequests: () => request<any[]>('/credit-requests'),
  creditRequest: (id: string) => request<any>(`/credit-requests/${id}`),
  evaluate: (id: string) =>
    request<any>(`/credit-requests/${id}/evaluate`, { method: 'POST' }),
  simulate: (body: any) =>
    request<any>('/scoring/simulate', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  whatsappStatus: () => request<any>('/whatsapp/status'),
  exportUrl: (kind: 'excel' | 'pdf') => `${API_URL}/dashboard/export/${kind}`,
};

export { API_URL };
