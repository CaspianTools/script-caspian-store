import type { CatalogTheme } from '../../types';

const runway: CatalogTheme = {
  id: 'runway',
  name: 'Runway',
  description: 'High-contrast monochrome with bold serif wordmark.',
  categories: ['shop', 'portfolio', 'marketing'],
  version: '1.1.0',
  tokens: { primary: '#000000', primaryForeground: '#ffffff', accent: '#dc2626', radius: '0rem' },
  fontFamily: "'Playfair Display', 'Times New Roman', serif",
  googleFamilies: ['Playfair Display:wght@400;500;600;700'],
  thumbnail: {
    background: '#ffffff',
    foreground: '#000000',
    accent: '#dc2626',
    wordmark: 'Runway',
    tagline: 'SS26',
  },
};

export default runway;
