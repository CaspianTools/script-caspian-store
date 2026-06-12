/**
 * Firestore security rules for a Caspian Store installation.
 *
 * Consumers should write this to their `firestore.rules` file and deploy with
 * `firebase deploy --only firestore:rules`. Alternatively, consumers can merge
 * their existing rules with these.
 */
export const CASPIAN_FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Admin signal — claim-first, Firestore fallback. The Firebase Auth
    // custom claim \`role\` is the primary admin signal as of v8.4.1; the
    // Firestore read is a fallback for admins promoted before v8.4.1 (or
    // before their token has rotated to pick up the new claim). Storage
    // rules check the same predicate so consumer admin authorization
    // works identically across services.
    function isAdmin() {
      return request.auth != null
          && (request.auth.token.role == 'admin'
              || (exists(/databases/$(database)/documents/users/$(request.auth.uid))
                  && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'));
    }

    function isAuth() {
      return request.auth != null;
    }

    match /products/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /productCategories/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /productBrands/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /productCollections/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /orders/{id} {
      allow read: if isAdmin() || (isAuth() && resource.data.userId == request.auth.uid);
      allow create: if isAuth();
      allow update: if isAdmin();
    }

    match /users/{uid} {
      allow read: if isAuth() && request.auth.uid == uid;
      allow write: if isAuth() && request.auth.uid == uid
                   && (!('role' in request.resource.data) || request.resource.data.role == resource.data.role);
      allow read, write: if isAdmin();
    }

    match /carts/{uid} {
      allow read, write: if isAuth() && request.auth.uid == uid;
    }

    match /reviews/{id} {
      allow read: if resource.data.status == 'approved' || isAdmin();
      allow create: if isAuth()
        && request.resource.data.userId == request.auth.uid
        && request.resource.data.status == 'pending'
        && request.resource.data.rating is number
        && request.resource.data.rating >= 1
        && request.resource.data.rating <= 5;
      allow update, delete: if isAdmin();
    }

    match /questions/{id} {
      allow read: if resource.data.status == 'approved' || isAdmin();
      allow create: if isAuth()
        && request.resource.data.userId == request.auth.uid
        && request.resource.data.status == 'pending';
      allow update, delete: if isAdmin();
    }

    match /promoCodes/{id} {
      allow read: if isAuth();
      allow write: if isAdmin();
    }

    match /shippingPluginInstalls/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /paymentPluginInstalls/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /faqs/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /journal/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /pageContents/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /languages/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /subscribers/{id} {
      allow create: if true;
      allow read, delete: if isAdmin();
    }

    match /settings/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // Script-level site configuration (theme, feature flags, etc.)
    match /scriptSettings/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }
  }
}
`;

/**
 * Firebase Storage security rules for a Caspian Store installation.
 *
 * Consumers should write this to their `storage.rules` file and deploy with
 * `firebase deploy --only storage`. The simpler path is `npm run firebase:sync`
 * (which copies firestore.rules + firestore.indexes.json + storage.rules from
 * the installed package), then redeploy.
 *
 * Stale deployed Storage rules are the #1 cause of the
 * `Firebase Storage: User does not have permission ... (storage/unauthorized)`
 * error during admin image uploads — the `siteSettings/**` block was added in
 * v3.0.0, and consumers who upgraded across that boundary without redeploying
 * still default-deny. The build's tsup config asserts that this constant
 * matches `firebase/storage.rules` byte-for-byte, so the two never drift.
 */
export const CASPIAN_STORAGE_RULES = `rules_version = '2';

// Recommended Storage rules for a Caspian Store installation. Deploy with
//   firebase deploy --only storage
service firebase.storage {
  match /b/{bucket}/o {

    // Admin signal — claim-first, Firestore fallback. v8.4.1 introduced an
    // Auth custom claim \`role\` so this rule can authorize without a
    // cross-service Firestore read; the read is kept as a fallback so
    // admins promoted before v8.4.1 (or via the legacy grant-admin script
    // before it was updated) are still recognized while their token rotates.
    // The custom claim is set by the \`claimAdmin\` callable, the
    // \`onUserCreate\` trigger, and the \`syncAdminClaim\` Firestore trigger
    // that reconciles the claim with \`users/{uid}.role\` on every write.
    function isAdmin() {
      return request.auth != null
          && (request.auth.token.role == 'admin'
              || firestore.get(
                   /databases/(default)/documents/users/$(request.auth.uid)
                 ).data.role == 'admin');
    }

    // Profile avatars live under users/{uid}/<filename>. Storage rules grammar
    // doesn't allow wildcards inside a segment, so we match any single-segment
    // filename; the content-type + size guards below do the real validation.
    // Anyone can read (product pages show avatars in review cards).
    match /users/{uid}/{filename} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.auth.uid == uid
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/(jpeg|png|webp)');
      allow delete: if request.auth != null && request.auth.uid == uid;
    }

    // Journal cover images — public read, admin write up to 10 MB.
    match /journal/{path=**} {
      allow read: if true;
      allow write: if isAdmin()
                   && request.resource.size < 10 * 1024 * 1024
                   && request.resource.contentType.matches('image/(jpeg|png|webp|gif)');
      allow delete: if isAdmin();
    }

    // Page content assets (optional image uploads from <AdminPagesPage>).
    match /pageContents/{path=**} {
      allow read: if true;
      allow write: if isAdmin()
                   && request.resource.size < 10 * 1024 * 1024
                   && request.resource.contentType.matches('image/(jpeg|png|webp|gif)');
      allow delete: if isAdmin();
    }

    // Site-settings branding assets — logo and favicon uploaded from
    // <AdminSiteSettingsPage>. Public read (the storefront renders the logo
    // on every page), admin write up to 10 MB. SVG is allowed here because
    // logos/favicons are commonly vector.
    match /siteSettings/{path=**} {
      allow read: if true;
      allow write: if isAdmin()
                   && request.resource.size < 10 * 1024 * 1024
                   && request.resource.contentType.matches('image/(jpeg|png|webp|gif|svg\\\\+xml)');
      allow delete: if isAdmin();
    }

    // Product catalog images uploaded from <AdminProductEditor>. Public read
    // (every PLP/PDP card shows these), admin write up to 10 MB. No SVG here
    // — product photos should be raster, and blocking SVG avoids embedded-
    // script exploits from less-trusted sources.
    match /products/{path=**} {
      allow read: if true;
      allow write: if isAdmin()
                   && request.resource.size < 10 * 1024 * 1024
                   && request.resource.contentType.matches('image/(jpeg|png|webp|gif)');
      allow delete: if isAdmin();
    }

    // Category featured images uploaded from <AdminCategoryEditor>. Public read
    // (the homepage featured-categories section + header mega-menu render them),
    // admin write up to 10 MB. No SVG — these are photos.
    match /categories/{path=**} {
      allow read: if true;
      allow write: if isAdmin()
                   && request.resource.size < 10 * 1024 * 1024
                   && request.resource.contentType.matches('image/(jpeg|png|webp|gif)');
      allow delete: if isAdmin();
    }
  }
}
`;
