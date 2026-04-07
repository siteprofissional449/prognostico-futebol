/** Em dev usa o proxy do Vite (/api → localhost:3000). No Vercel defina VITE_API_BASE_URL com a URL da API (Render). */
function apiBase(): string {
  const url = import.meta.env.VITE_API_BASE_URL?.trim();
  if (url) return url.replace(/\/$/, '');
  return '/api';
}

const API_BASE = apiBase();

function getToken(): string | null {
  return localStorage.getItem('token');
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Erro na requisição');
  }
  return res.json();
}
