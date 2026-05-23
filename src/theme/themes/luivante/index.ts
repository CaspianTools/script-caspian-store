import type { CatalogTheme } from '../../types';

const luivante: CatalogTheme = {
  id: 'luivante',
  name: 'Luivante',
  description: 'White canvas with Google blue accents, generous rounded corners, and Poppins throughout. The default Caspian storefront design.',
  categories: ['shop', 'minimal', 'corporate', 'marketing'],
  isNew: true,
  version: '1.0.0',
  tokens: {
    primary: '#1a73e8',
    primaryForeground: '#ffffff',
    accent: '#1a73e8',
    radius: '1rem',
    background: '#ffffff',
    fontFamily: "'Poppins', system-ui, -apple-system, sans-serif",
  },
  googleFamilies: ['Poppins:wght@300;400;500;600;700'],
  thumbnail: {
    background: '#ffffff',
    foreground: '#1f1f1f',
    accent: '#1a73e8',
    wordmark: 'Luivante',
    tagline: 'modern · everything-shop',
  },
};

export default luivante;
