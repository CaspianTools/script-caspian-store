import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { commitPosSale } from './commit-pos-sale';
export { leasePosReceiptBlock } from './receipt-lease';
export { getPosCatalogDelta } from './pos-catalog-delta';
export { activatePosLicense, listPosLicenses, releasePosLicenseSeat } from './pos-licenses';
