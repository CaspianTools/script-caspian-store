import { getApps, initializeApp } from 'firebase/app';
import { doc, getDoc, getFirestore } from 'firebase/firestore/lite';

/**
 * Reads the public `settings/site` doc server-side (firebase/firestore/lite, no
 * Admin SDK) so the dynamic manifest + icon routes reflect the store's brand.
 * Every failure falls back to neutral defaults so the routes never 500.
 */
export interface PwaBrand {
  name: string;
  description: string;
  themeColor: string;
  iconUrl: string | null;
}

const DEFAULTS: PwaBrand = {
  name: 'Caspian Store',
  description: 'A Caspian Store storefront.',
  themeColor: '#111111',
  iconUrl: null,
};

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export async function readPwaBrand(): Promise<PwaBrand> {
  try {
    const app = getApps().find((a) => a.name === 'pwa-lite') ?? initializeApp(config, 'pwa-lite');
    const snap = await getDoc(doc(getFirestore(app), 'settings', 'site'));
    if (!snap.exists()) return DEFAULTS;
    const s = snap.data() as Record<string, unknown>;
    return {
      name: str(s.brandName) ?? DEFAULTS.name,
      description: str(s.brandDescription) ?? DEFAULTS.description,
      themeColor: str(s.themeColor) ?? DEFAULTS.themeColor,
      iconUrl: str(s.appIconUrl) ?? str(s.faviconUrl) ?? str(s.logoUrl),
    };
  } catch {
    return DEFAULTS;
  }
}
