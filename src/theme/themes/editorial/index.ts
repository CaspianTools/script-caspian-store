import type { CatalogTheme } from '../../types';

const editorial: CatalogTheme = {
  id: 'editorial',
  name: 'Editorial',
  description: 'Big radius, monochrome. Magazine-first portfolios.',
  categories: ['portfolio', 'creative'],
  isNew: true,
  version: '1.1.0',
  tokens: { primary: '#1f1f1f', primaryForeground: '#fafafa', accent: '#9a9a9a', radius: '1rem' },
  fontFamily: "'Fraunces', Georgia, serif",
  googleFamilies: ['Fraunces:wght@400;500;600;700'],
  thumbnail: {
    background: '#fafafa',
    foreground: '#1f1f1f',
    accent: '#9a9a9a',
    wordmark: 'Editorial',
    tagline: 'issue 014',
  },
};

export default editorial;
