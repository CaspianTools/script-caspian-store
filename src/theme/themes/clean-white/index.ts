import type { CatalogTheme } from '../../types';

const cleanWhite: CatalogTheme = {
  id: 'cleanWhite',
  name: 'Clean white',
  description: 'Neutral charcoal on white with Poppins. A minimal editorial default.',
  categories: ['minimal', 'corporate', 'shop'],
  version: '1.1.0',
  tokens: {
    primary: '#111111',
    primaryForeground: '#ffffff',
    accent: '#171717',
    radius: '0.5rem',
    background: '#ffffff',
    fontFamily: "'Poppins', 'Inter', system-ui, -apple-system, sans-serif",
  },
  googleFamilies: ['Poppins:wght@400;500;600;700', 'Inter:wght@400;500;600;700'],
  thumbnail: {
    background: '#ffffff',
    foreground: '#111111',
    accent: '#d1d5db',
    wordmark: 'Clean',
    tagline: 'minimal · editorial',
  },
};

export default cleanWhite;
