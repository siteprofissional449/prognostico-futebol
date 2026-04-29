/**
 * Mesmo módulo que o `lazy()` em App.tsx — o browser reutiliza o chunk em cache.
 */
export function prefetchHistoricoAcertos(): void {
  void import('../pages/HistoricoAcertos');
}

/** NavLink / Link: pré-carrega ao hover, foco (teclado) ou primeiro toque antes do navigate. */
export const historicoPrefetchHandlers = {
  onMouseEnter: prefetchHistoricoAcertos,
  onFocus: prefetchHistoricoAcertos,
  onTouchStart: prefetchHistoricoAcertos,
} as const;
