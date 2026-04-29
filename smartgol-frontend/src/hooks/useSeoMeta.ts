import { useEffect } from 'react';

const DEFAULT_DESC =
  'Prognósticos e palpites de futebol com análise. SmartGol — palpites do dia.';

export function useSeoMeta(title: string, description?: string) {
  useEffect(() => {
    const prevTitle = document.title;
    const full = title.includes('SmartGol') ? title : `${title} | SmartGol`;
    document.title = full;

    const descEl = document.querySelector('meta[name="description"]');
    const prevDesc = descEl?.getAttribute('content') ?? '';
    const nextDesc = description?.trim() || DEFAULT_DESC;
    if (descEl) descEl.setAttribute('content', nextDesc);

    return () => {
      document.title = prevTitle;
      if (descEl) descEl.setAttribute('content', prevDesc);
    };
  }, [title, description]);
}
