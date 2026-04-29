/** Slugs aceites por `/informacao/:slug`. Títulos exibidos no rodapé e na página placeholder. */
export const INFORMACAO_SLUGS = [
  'quem-somos',
  'termos-e-condicoes',
  'politica-de-publicidade',
  'privacidade-e-cookies',
  'editorial',
  'trabalhe-conosco',
  'jogo-responsavel',
  'mapa-do-site',
] as const;

export type InformacaoSlug = (typeof INFORMACAO_SLUGS)[number];

export const INFORMACAO_TITULOS: Record<InformacaoSlug, string> = {
  'quem-somos': 'Quem Somos',
  'termos-e-condicoes': 'Termos e Condições',
  'politica-de-publicidade': 'Política de Publicidade',
  'privacidade-e-cookies': 'Privacidade e Cookies',
  editorial: 'Editorial',
  'trabalhe-conosco': 'Trabalhe Conosco',
  'jogo-responsavel': 'Jogo Responsável',
  'mapa-do-site': 'Mapa do Site',
};

export function isInformacaoSlug(s: string): s is InformacaoSlug {
  return (INFORMACAO_SLUGS as readonly string[]).includes(s);
}
