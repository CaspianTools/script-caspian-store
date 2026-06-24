import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { linkInstagram, unlinkInstagram } from './link-instagram';
export { instagramInbox } from './instagram-inbox';
export {
  replyInstagramComment,
  setInstagramCommentHidden,
  deleteInstagramComment,
} from './comments';
export { refreshInstagramTokens } from './refresh-tokens';
