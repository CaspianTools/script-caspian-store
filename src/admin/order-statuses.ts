import type { OrderStatus } from '../types';

/**
 * Every order status, in pipeline order. Shared by the orders list (board
 * columns + filter) and the order detail status picker so neither can drift
 * — `on-hold` was missing from the detail page until they were unified.
 */
export const ORDER_STATUSES: readonly OrderStatus[] = [
  'pending',
  'on-hold',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];
