import type { CatalogTheme } from '../../types';

const minimalDark: CatalogTheme = {
  id: 'minimalDark',
  name: 'Minimal dark',
  description: 'Inverted monochrome with a hot-pink accent. Nightshift mode.',
  categories: ['creative', 'portfolio', 'minimal'],
  version: '1.1.0',
  tokens: {
    primary: '#ffffff',
    primaryForeground: '#0a0a0a',
    accent: '#ec4899',
    radius: '0.5rem',
    background: '#0a0a0a',
  },
  thumbnail: {
    background: '#0a0a0a',
    foreground: '#ffffff',
    accent: '#ec4899',
    wordmark: 'Dark',
    tagline: 'after hours',
  },
};

export default minimalDark;
