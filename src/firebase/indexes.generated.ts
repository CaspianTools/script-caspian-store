// Auto-generated from the files under firebase/ by tsup.config.ts. Do not edit.
// Edit firebase/firestore.rules, firebase/storage.rules, or
// firebase/firestore.indexes.json instead, then run `npm run build`.

import type { CaspianFirestoreIndexes } from './indexes-types';

export const CASPIAN_FIRESTORE_INDEXES: CaspianFirestoreIndexes = {
  "indexes": [
    {
      "collectionGroup": "products",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "isActive",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "products",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "isActive",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "category",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "userId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "reviews",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "productId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "reviews",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "productId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "rating",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "questions",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "productId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "contacts",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "productCollections",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "slug",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "isActive",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "errorLogs",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "origin",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "message",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "timestamp",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "paymentPluginInstalls",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "enabled",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "order",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "shippingPluginInstalls",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "enabled",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "order",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "emailPluginInstalls",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "enabled",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "order",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "channel",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "cashierId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "orders",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "sessionId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "posSessions",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "cashierId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "openedAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "posSessions",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "openedAt",
          "order": "DESCENDING"
        }
      ]
    }
  ],
  "fieldOverrides": []
};
