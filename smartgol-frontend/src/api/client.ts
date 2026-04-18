/** Em dev usa o proxy do Vite (/api → localhost:3000). No Vercel defina VITE_API_BASE_URL com a URL HTTPS da API (ex.: Railway). */
function apiBase(): string {
  const url = import.meta.env.VITE_API_BASE_URL?.trim();
  if (url) return url.replace(/\/$/, '');
  return '/api';
}

const API_BASE = apiBase();

function resolveBaseUrl(): string {
  if (import.meta.env.PROD && API_BASE === '/api') {
    throw new Error(
      'Configure na Vercel: Settings → Environment Variables → nome exato VITE_API_BASE_URL = URL HTTPS do Railway (sem barra no fim). Marque Production + Preview. Depois Redeploy.',
    );
  }
  return API_BASE;
}

function getToken(): string | null {
  return localStorage.getItem('token');
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  const base = resolveBaseUrl();
  const url = `${base}${path}`;

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (e) {
    const isNetwork =
      e instanceof TypeError &&
      (String(e.message).includes('fetch') ||
        String(e.message).includes('NetworkError') ||
        String(e.message).includes('Failed to fetch'));
    if (isNetwork) {
      throw new Error(
        'Sem ligação à API (rede ou CORS). Confirme: (1) VITE_API_BASE_URL na Vercel = URL HTTPS do Railway; (2) FRONTEND_URL no Railway = https://prognostico-futebol.vercel.app; (3) Redeploy em ambos.',
      );
    }
    throw e;
  }

  if (!res.ok) {
    const msg = await parseErrorResponse(
      res,
      url,
      (options.method || 'GET').toUpperCase(),
    );
    throw new Error(msg);
  }

  return parseSuccessJson<T>(res, url);
}

async function parseErrorResponse(
  res: Response,
  requestUrl: string,
  method: string,
): Promise<string> {
  const status = res.status;
  const statusLine = res.statusText || `HTTP ${status}`;
  const endpoint = safeEndpointLabel(requestUrl);
  const text = await res.text().catch(() => '');
  if (!text.trim()) {
    return `${method} ${endpoint} → erro ${status} (${statusLine}). A API pode estar em baixo ou a URL (VITE_API_BASE_URL) incorreta.`;
  }
  try {
    const body = JSON.parse(text) as unknown;
    const msg = formatNestMessage(body, statusLine);
    if (msg) return `${method} ${endpoint} → ${msg} (${status})`;
  } catch {
    /* não é JSON */
  }
  const snip = text.replace(/\s+/g, ' ').slice(0, 140);
  return `${method} ${endpoint} → erro ${status}: resposta não JSON da API — ${snip}`;
}

function parseSuccessJson<T>(res: Response, requestUrl: string): Promise<T> {
  return res.text().then((raw) => {
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const looksHtml =
      raw.trimStart().startsWith('<') ||
      ct.includes('text/html') ||
      (!ct.includes('json') && raw.trimStart().startsWith('<!'));

    if (looksHtml) {
      const hint =
        baseLooksLikeVercel(requestUrl) || API_BASE === '/api'
          ? ' O pedido foi para o site da Vercel (HTML), não para o Railway. Defina VITE_API_BASE_URL com a URL pública da API e faça Redeploy.'
          : ' A URL da API devolveu uma página HTML em vez de JSON — confirme VITE_API_BASE_URL.';
      throw new Error(
        `Resposta inválida: recebido HTML em vez de JSON.${hint}`,
      );
    }

    if (!raw.trim()) {
      return undefined as T;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new Error(
        'A API devolveu texto que não é JSON válido. Confirme VITE_API_BASE_URL (URL do Railway).',
      );
    }
  });
}

function baseLooksLikeVercel(fullUrl: string): boolean {
  try {
    const h = new URL(fullUrl).hostname;
    return h.endsWith('.vercel.app') || h === 'vercel.app';
  } catch {
    return false;
  }
}

function safeEndpointLabel(fullUrl: string): string {
  try {
    const u = new URL(fullUrl, window.location.origin);
    return `${u.pathname}${u.search}`;
  } catch {
    return fullUrl;
  }
}

function formatNestMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const o = body as Record<string, unknown>;
  const m = o.message;
  if (typeof m === 'string' && m.trim()) return m;
  if (Array.isArray(m) && m.length)
    return m.map(String).filter(Boolean).join('; ');
  if (typeof o.error === 'string' && o.error) return String(o.error);
  return fallback;
}
