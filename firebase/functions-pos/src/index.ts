import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { commitPosSale } from './commit-pos-sale';
export { getPosCatalogDelta } from './pos-catalog-delta';
