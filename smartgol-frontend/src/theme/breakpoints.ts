import type { MantineBreakpointsValues } from '@mantine/core';

/**
 * Pontos de rutura iguais ao default Mantine.
 * São a fonte de verdade: `createTheme({ breakpoints })` em appTheme usa isto,
 * `useMediaQuery(mediaQueryBelow('sm'))` igual às media queries CSS com
 * `@media (max-width: calc(Xem - 0.01em))` para o mesmo breakpoint X.
 *
 * Ao alterar um valor, atualiza também as media queries `.css` que usam esse em.
 */
export const themeBreakpoints = {
  xs: '36em',
  sm: '48em',
  md: '62em',
  lg: '75em',
  xl: '88em',
} satisfies MantineBreakpointsValues;

export type AppBreakpointKey = keyof typeof themeBreakpoints;

/** Imediatamente abaixo de `themeBreakpoints[K]` — útil para `useMediaQuery`. */
export function mediaQueryBelow(key: AppBreakpointKey): string {
  return `(max-width: calc(${themeBreakpoints[key]} - 0.01em))`;
}
