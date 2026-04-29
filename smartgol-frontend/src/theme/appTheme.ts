import { createTheme, rem } from '@mantine/core';
import { themeBreakpoints } from './breakpoints';

/**
 * Design system — SaaS premium (fundo #0B0F14, cards #111827, destaque #22C55E).
 * Grid de base 8px; raios 12–16px.
 *
 * Ruturas: theme/breakpoints.ts (fonte de verdade, partilhada com CSS e useMediaQuery).
 */
export const appTheme = createTheme({
  breakpoints: themeBreakpoints,
  primaryColor: 'green',
  defaultRadius: 'md',
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontSizes: {
    xs: rem(11),
    sm: rem(12),
    md: rem(14),
    lg: rem(16),
    xl: rem(20),
  },
  headings: {
    fontWeight: '600',
    sizes: {
      h1: { fontSize: rem(24), lineHeight: '1.2' },
      h2: { fontSize: rem(20), lineHeight: '1.25' },
      h3: { fontSize: rem(16), lineHeight: '1.3' },
      h4: { fontSize: rem(14), lineHeight: '1.35' },
    },
  },
  spacing: {
    xs: rem(8),
    sm: rem(16),
    md: rem(24),
    lg: rem(32),
    xl: rem(40),
  },
  radius: {
    xs: rem(4),
    sm: rem(8),
    md: rem(12),
    lg: rem(16),
    xl: rem(20),
  },
  defaultGradient: { from: '#22C55E', to: '#16A34A', deg: 130 },
  shadows: {
    sm: '0 1px 2px 0 rgba(0,0,0,0.4)',
    md: '0 4px 6px -1px rgba(0,0,0,0.45), 0 2px 4px -2px rgba(0,0,0,0.35)',
    lg: '0 10px 15px -3px rgba(0,0,0,0.5), 0 4px 6px -4px rgba(0,0,0,0.4)',
    xl: '0 20px 25px -5px rgba(0,0,0,0.55), 0 8px 10px -6px rgba(0,0,0,0.45)',
  },
});
