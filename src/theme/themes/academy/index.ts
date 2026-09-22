import type { CatalogTheme } from '../../types';

const academy: CatalogTheme = {
  id: 'academy',
  name: 'Academy',
  description: 'Navy + ivory. Trustworthy classrooms and cohorts.',
  categories: ['education', 'events'],
  isNew: true,
  version: '1.1.0',
  tokens: { primary: '#0f2e5a', primaryForeground: '#fefcf7', accent: '#c9a961', radius: '0.375rem' },
  fontFamily: "'Fraunces', Georgia, serif",
  googleFamilies: ['Fraunces:wght@400;500;600;700'],
  thumbnail: {
    background: '#fefcf7',
    foreground: '#0f2e5a',
    accent: '#c9a961',
    wordmark: 'Academy',
    tagline: 'est. 2026',
  },
};

export default academy;
