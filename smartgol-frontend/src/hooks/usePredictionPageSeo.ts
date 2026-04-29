import { useEffect } from 'react';

const CANON_SELECTOR = 'link[data-app-seo="canonical"]';

export interface PredictionPageSeoInput {
  title: string;
  description: string;
  canonicalPath: string;
  keywords?: string;
}

function siteOrigin(): string {
  const v = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SITE_URL?.trim?.();
  if (v) return v.replace(/\/+$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

/** Equivalente SPA ao `generateMetadata` do Next.js (sem SSR nativo neste projeto Vite). */
export function usePredictionPageSeo(active: boolean, input: PredictionPageSeoInput | null) {
  useEffect(() => {
    if (!active || !input) return undefined;

    const origin = siteOrigin();
    const path = input.canonicalPath.startsWith('/') ? input.canonicalPath : `/${input.canonicalPath}`;
    const canonicalHref = `${origin}${path}`;
    const fullTitle =
      input.title.includes('SmartGol') ?
        input.title
      : `${input.title} | SmartGol`;

    const prevTitle = document.title;
    const descEl = document.querySelector('meta[name="description"]');
    const prevDesc = descEl?.getAttribute('content') ?? '';

    document.title = fullTitle;
    descEl?.setAttribute?.('content', input.description);

    const ogPairs: Array<{ key: string; kind: 'property' | 'name'; val: string }> = [
      { kind: 'property', key: 'og:title', val: fullTitle },
      { kind: 'property', key: 'og:description', val: input.description },
      { kind: 'property', key: 'og:url', val: canonicalHref },
      { kind: 'property', key: 'og:type', val: 'article' },
      { kind: 'property', key: 'og:locale', val: 'pt_BR' },
      { kind: 'name', key: 'twitter:card', val: 'summary_large_image' },
      { kind: 'name', key: 'twitter:title', val: fullTitle },
      { kind: 'name', key: 'twitter:description', val: input.description },
    ];

    const addedMeta: HTMLElement[] = [];
    for (const { key, kind, val } of ogPairs) {
      const el = document.createElement('meta');
      if (kind === 'property') el.setAttribute('property', key);
      else el.setAttribute('name', key);
      el.setAttribute('content', val);
      el.dataset.appSeo = 'prediction';
      document.head.appendChild(el);
      addedMeta.push(el);
    }

    const kw = input.keywords ?? `palpite, prognóstico, futebol, ${fullTitle}`;
    const metaKw = document.createElement('meta');
    metaKw.setAttribute('name', 'keywords');
    metaKw.setAttribute('content', kw);
    metaKw.dataset.appSeo = 'prediction-kw';
    document.head.appendChild(metaKw);

    let canonEl = document.querySelector(CANON_SELECTOR) as HTMLLinkElement | null;
    let canonCreated = false;
    const prevCanonHref = canonEl?.getAttribute?.('href');

    if (!canonEl) {
      canonEl = document.createElement('link');
      canonEl.rel = 'canonical';
      canonEl.dataset.appSeo = 'canonical';
      document.head.appendChild(canonEl);
      canonCreated = true;
    }
    canonEl.setAttribute('href', canonicalHref);

    return () => {
      document.title = prevTitle;
      if (descEl) descEl.setAttribute('content', prevDesc);
      document.querySelectorAll('meta[data-app-seo="prediction"]').forEach((n) => n.remove());
      metaKw.remove();
      if (canonCreated) canonEl!.remove();
      else if (!canonCreated && canonEl && prevCanonHref != null) canonEl.setAttribute('href', prevCanonHref);
    };
  }, [active, input]);
}
