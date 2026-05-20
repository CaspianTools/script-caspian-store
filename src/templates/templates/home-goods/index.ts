/**
 * Home Goods — kitchen, living, and workspace pieces with warm earth tones
 * and lifestyle interior photography. Targets home & lifestyle installers.
 */

import { HeroSplit } from '../../../components/home/variants/hero-split';
import type { TemplateDefinition } from '../../types';
import { placeholderImage, unsplashUrl } from '../../types';

const PHOTO = {
  hero: '1556909114-f6e7ad7d3136',
  catKitchen: '1493663284031-b7e3aefcae8e',
  catLiving: '1555041469-a586c61ea9bc',
  catWorkspace: '1542838132-92c53300491e',
  ceramicMug: '1567538096630-e0c55bd6374c',
  dinnerPlates: '1556228720-195a672e8a03',
  woodenSpoons: '1493663284031-b7e3aefcae8e',
  kitchenKnives: '1583847268964-b28dc8f51f92',
  linenRunner: '1565183997392-2f6f122e5912',
  modernSofa: '1555041469-a586c61ea9bc',
  terracottaPot: '1531731825-6db1ada0d2ad',
  woodenChair: '1542838132-92c53300491e',
  diningTable: '1586023492125-27b2c045efd7',
  journalKitchen: '1493663284031-b7e3aefcae8e',
  journalLiving: '1555041469-a586c61ea9bc',
};

export const homeGoodsTemplate: TemplateDefinition = {
  id: 'home-goods',
  name: 'Home Goods',
  description:
    'Warm earth tones and lifestyle interior photography for kitchen, living, and workspace pieces.',
  vertical: 'home-goods',
  version: '1.0.0',
  theme: {
    primary: '#7c5d3f',
    primaryForeground: '#fdfaf4',
    accent: '#a07a4c',
    radius: '0.5rem',
    background: '#fdfaf4',
    fontFamily: "'Cormorant Garamond', 'Georgia', serif",
  },
  hero: {
    title: 'Pieces for the rooms you actually live in.',
    subtitle:
      'Hand-thrown ceramics, oiled hardwood tools, and natural-fibre textiles from small workshops.',
    cta: 'Shop the collection',
    ctaHref: '/collections',
    imageUrl: unsplashUrl(PHOTO.hero),
  },
  features: {
    reviews: true,
    wishlist: true,
    promoCodes: true,
    questions: false,
    multiLanguage: false,
  },
  branding: {
    brandDescription:
      'Handmade pieces from independent workshops for the kitchen, living room, and workspace. Sourced honestly; built to outlast their fashions.',
  },
  brands: [
    {
      id: 'workshop-six',
      name: 'Workshop Six',
      isActive: true,
    },
  ],
  categories: [
    {
      id: 'kitchen',
      name: 'Kitchen',
      slug: 'kitchen',
      description:
        'Hand-thrown ceramics, oiled hardwood tools, and the daily-use pieces that earn their place on the counter.',
      order: 0,
      isActive: true,
      isFeatured: true,
      imageUrl: unsplashUrl(PHOTO.catKitchen, 1200),
    },
    {
      id: 'living',
      name: 'Living',
      slug: 'living',
      description:
        'Throws, cushions, and objects for the rooms the family actually spends time in.',
      order: 1,
      isActive: true,
      isFeatured: true,
      imageUrl: unsplashUrl(PHOTO.catLiving, 1200),
    },
    {
      id: 'workspace',
      name: 'Workspace',
      slug: 'workspace',
      description:
        'Wood and linen pieces for the desk — modest upgrades to spaces that already work.',
      order: 2,
      isActive: true,
      isFeatured: true,
      imageUrl: unsplashUrl(PHOTO.catWorkspace, 1200),
    },
  ],
  products: [
    {
      id: 'ceramic-mug',
      slug: 'hand-thrown-ceramic-mug',
      name: 'Hand-Thrown Ceramic Mug',
      brand: 'workshop-six',
      shortDescription:
        'Wheel-thrown stoneware in a small studio in Portugal. No two are identical.',
      description:
        'Each mug is wheel-thrown by hand in a small studio outside Caldas da Rainha — the variation in shape and glaze is the point. Holds about 350ml, dishwasher and microwave safe, and the unglazed foot lets the natural clay show. Sold individually so you can build a set the way you want it.',
      price: 38,
      images: [
        {
          id: 'main',
          url: placeholderImage('ceramic-mug'),
          alt: 'Hand-thrown ceramic mug with coffee',
          hint: 'ceramic mug product',
        },
      ],
      category: 'kitchen',
      color: 'Sand',
      isActive: true,
    },
    {
      id: 'dinner-plates',
      slug: 'stoneware-dinner-plates',
      name: 'Stoneware Dinner Plates (Set of 4)',
      brand: 'workshop-six',
      shortDescription:
        'A set of four matte-glazed stoneware plates with a 27cm diameter. Stackable.',
      description:
        'A four-plate set in matte cream stoneware — 27cm dinner size, gently rolled rim, and a foot ring shaped to stack cleanly in a cupboard. The matte glaze hides the small marks that high-gloss plates can\'t. Dishwasher safe; we recommend air-drying for longevity.',
      price: 128,
      images: [
        {
          id: 'main',
          url: placeholderImage('dinner-plates'),
          alt: 'Stack of cream stoneware dinner plates',
          hint: 'dinner plates set product',
        },
      ],
      category: 'kitchen',
      color: 'Cream',
      isNew: true,
      isActive: true,
    },
    {
      id: 'wooden-spoons',
      slug: 'hardwood-spoon-trio',
      name: 'Hardwood Spoon Trio',
      brand: 'workshop-six',
      shortDescription:
        'Three hand-shaped oak utensils — slotted spoon, mixing spoon, spatula.',
      description:
        'Three pieces hand-shaped from European oak, oiled with food-safe walnut oil, and finished with a slight curve at the handle that keeps them resting on the rim of the pot. Hand-wash and re-oil twice a year; they\'ll outlast every silicone spatula you\'ve ever owned.',
      price: 55,
      images: [
        {
          id: 'main',
          url: placeholderImage('wooden-spoons'),
          alt: 'Wooden kitchen utensils in jar',
          hint: 'wooden spoons utensils product',
        },
      ],
      category: 'kitchen',
      color: 'Oak',
      isActive: true,
    },
    {
      id: 'kitchen-knives',
      slug: 'chef-knife-pair',
      name: 'Chef + Paring Knife Pair',
      brand: 'workshop-six',
      shortDescription:
        'Hand-forged carbon steel from a third-generation knife maker in Sakai.',
      description:
        'A two-knife pair: 200mm gyuto and 90mm petty, both hand-forged in carbon steel and fitted with magnolia wood handles. Carbon steel takes a sharper edge than stainless and patinas with use — wipe dry after washing and they\'ll last a lifetime.',
      price: 285,
      images: [
        {
          id: 'main',
          url: placeholderImage('kitchen-knives'),
          alt: 'Chef knives on wooden board',
          hint: 'kitchen knives product',
        },
      ],
      category: 'kitchen',
      isNew: true,
      isActive: true,
    },
    {
      id: 'linen-runner',
      slug: 'linen-table-runner',
      name: 'Stonewashed Linen Table Runner',
      brand: 'workshop-six',
      shortDescription:
        'A 200×40cm runner in stonewashed Belgian linen with a hand-stitched hem.',
      description:
        'Belgian flax woven and stonewashed for a soft, lived-in hand from the first wear. 200×40cm — long enough for a six-person dining table — with hand-stitched mitered corners. Machine washable on cold; tumble dry low.',
      price: 78,
      images: [
        {
          id: 'main',
          url: placeholderImage('linen-runner'),
          alt: 'Linen table runner on dining table',
          hint: 'linen table runner product',
        },
      ],
      category: 'living',
      color: 'Oat',
      isActive: true,
    },
    {
      id: 'modern-sofa',
      slug: 'two-seater-sofa',
      name: 'Two-Seater Linen Sofa',
      brand: 'workshop-six',
      shortDescription:
        'A compact two-seater in pre-washed Belgian linen on a solid oak frame.',
      description:
        '180cm two-seater on a kiln-dried solid oak frame, with feather-and-foam cushions wrapped in pre-washed Belgian linen. Covers are removable for dry-cleaning. Sized for apartments where the sofa shouldn\'t eat the room.',
      price: 1850,
      images: [
        {
          id: 'main',
          url: placeholderImage('modern-sofa'),
          alt: 'Modern minimalist sofa in living room',
          hint: 'modern sofa product',
        },
      ],
      category: 'living',
      color: 'Sand',
      limited: true,
      isActive: true,
    },
    {
      id: 'terracotta-pot',
      slug: 'terracotta-planter',
      name: 'Hand-Coiled Terracotta Planter',
      brand: 'workshop-six',
      shortDescription:
        'A 22cm planter coil-built and bisque-fired in unglazed terracotta.',
      description:
        'Coil-built by hand and bisque-fired in unglazed Italian terracotta — the porous clay breathes the way nursery pots are supposed to. 22cm diameter, drainage hole in the base, saucer included. Looks better with each year of use.',
      price: 65,
      images: [
        {
          id: 'main',
          url: placeholderImage('terracotta-pot'),
          alt: 'Terracotta planter with indoor plant',
          hint: 'terracotta planter product',
        },
      ],
      category: 'living',
      isActive: true,
    },
    {
      id: 'wooden-chair',
      slug: 'oak-spindle-chair',
      name: 'Oak Spindle Chair',
      brand: 'workshop-six',
      shortDescription:
        'A modern take on the Windsor — hand-turned spindles in solid white oak.',
      description:
        'A reinterpretation of the Windsor chair from a small workshop in Vermont. Solid white oak, hand-turned spindles, and a saddle-carved seat that\'s genuinely comfortable to sit on through dinner. Oil finish; reapply every few years.',
      price: 485,
      images: [
        {
          id: 'main',
          url: placeholderImage('wooden-chair'),
          alt: 'Oak spindle chair in living space',
          hint: 'wooden chair product',
        },
      ],
      category: 'workspace',
      color: 'Natural Oak',
      isActive: true,
    },
    {
      id: 'dining-table',
      slug: 'trestle-dining-table',
      name: 'Trestle Dining Table',
      brand: 'workshop-six',
      shortDescription:
        'A six-seat trestle table in solid white oak. Knock-down construction.',
      description:
        '180×85cm trestle table in solid white oak with a hand-rubbed oil finish. Seats six, knocks down for moving (which most dining tables don\'t), and the trestle legs leave the head and foot of the table clear. Made in the same Vermont workshop as the spindle chair.',
      price: 2150,
      images: [
        {
          id: 'main',
          url: placeholderImage('dining-table'),
          alt: 'Wooden trestle dining table set',
          hint: 'dining table product',
        },
      ],
      category: 'workspace',
      color: 'Natural Oak',
      limited: true,
      isNew: true,
      isActive: true,
    },
  ],
  pages: [
    {
      id: 'about',
      pageKey: 'about',
      title: 'About',
      subtitle:
        'Handmade pieces from small workshops for the rooms you actually live in.',
      content:
        '<p>Workshop Six is a small shop curating pieces from independent makers across Europe and North America. Every piece is hand-finished — by a potter in Caldas, a knife-maker in Sakai, a furniture workshop in Vermont — and we work directly with the makers rather than going through distributors.</p><p>We carry fewer pieces than most shops in our space, because we add a piece only when we\'ve used it ourselves and a maker has the capacity to produce it well. If something sells out and the workshop can\'t make it the same way again, we don\'t restock it.</p>',
    },
    {
      id: 'privacy',
      pageKey: 'privacy',
      title: 'Privacy Policy',
      content:
        '<p>What we collect and what we do with it.</p><h2>Order data</h2><p>Name, shipping and billing addresses, email, phone, and the payment details Stripe needs. We don\'t store card numbers; Stripe handles that under PCI-DSS.</p><h2>How we use it</h2><p>Fulfilment, order updates, and customer-service correspondence. We don\'t share or sell your data outside the operational services in our terms.</p><h2>Your rights</h2><p>You can request access, correction, or deletion of your account data at any time — email the contact address at the bottom of this page.</p>',
    },
    {
      id: 'terms',
      pageKey: 'terms',
      title: 'Terms of Service',
      content:
        '<p>Plain language; no surprises.</p><h2>Orders</h2><p>Prices and availability are accurate at listing but may change. We reserve the right to cancel any order — if we do, you\'re refunded within five business days.</p><h2>Made-to-order items</h2><p>Furniture pieces are made to order with lead times listed on each product. Once production has started, made-to-order items are non-cancellable.</p><h2>Liability</h2><p>Our liability is limited to the value of the order. We don\'t accept liability for indirect or consequential losses.</p>',
    },
    {
      id: 'shipping-returns',
      pageKey: 'shipping-returns',
      title: 'Shipping & Returns',
      content:
        '<h2>Shipping</h2><p>Free standard shipping on orders over $250. Standard delivery is 4–7 business days domestically. Furniture pieces ship via white-glove freight with lead times of 6–10 weeks from order — you\'ll get a tracking + delivery booking once production completes.</p><h2>Returns</h2><p>30-day returns on small items in original condition. Made-to-order furniture is final sale once production has started. If a piece arrives damaged, photograph the packaging before opening and email us within 48 hours.</p>',
    },
  ],
  journal: [
    {
      id: 'patina-of-use',
      title: 'The patina of use',
      excerpt:
        'Why hand-made pieces look better at year five than year one — and what that means for buying them.',
      category: 'On craft',
      date: '2026-04-15',
      imageUrl: unsplashUrl(PHOTO.journalKitchen),
      content:
        '<p>Most of what makes a hand-thrown mug different from a factory-pressed one isn\'t the look of the new piece — it\'s the look of the five-year-old piece. The wheel-thrown wall develops micro-cracks that hold espresso brown and tea tannins; the unglazed foot darkens; the throwing rings catch coffee oil and quietly turn into a record of the mornings the mug spent in your hand.</p><p>This is the case for buying fewer, better things — not because you\'ll save money, but because the things you buy will become specifically yours in a way that mass-produced ones cannot.</p>',
    },
    {
      id: 'small-rooms',
      title: 'Furnishing small rooms',
      excerpt:
        'Three rules we use when picking furniture for apartments that aren\'t getting any bigger.',
      category: 'Living',
      date: '2026-03-25',
      imageUrl: unsplashUrl(PHOTO.journalLiving),
      content:
        '<p>Small rooms reward restraint and punish maximalism. A few rules that have served us well:</p><h2>1. Buy the smallest piece that does the job.</h2><p>The two-seater sofa rather than the three. The bistro table rather than the full dining table. Every extra centimetre is a centimetre of the room you don\'t get to use.</p><h2>2. Keep one diagonal sight-line clear.</h2><p>From the door, you should be able to see the far corner of the longest wall. This makes small rooms feel substantially bigger without changing any of the furniture.</p><h2>3. Leave the floor visible.</h2><p>Most furniture pieces look bigger than they are because they sit flat on the floor. Pieces on legs — even short ones — give the eye a place to rest. The room reads larger as a consequence.</p>',
    },
  ],
  preview: {
    swatch: ['#fdfaf4', '#7c5d3f', '#a07a4c', '#d6c3a1'],
    heroImageUrl: unsplashUrl(PHOTO.hero, 800),
  },
  components: {
    Hero: HeroSplit,
  },
  css: `
[data-caspian-template="home-goods"] .caspian-hero-split-copy > * {
  animation: caspian-hero-home-copy-in 0.85s cubic-bezier(0.22, 1, 0.36, 1) both;
}
[data-caspian-template="home-goods"] .caspian-hero-split-copy > *:nth-child(1) { animation-delay: 0.05s; }
[data-caspian-template="home-goods"] .caspian-hero-split-copy > *:nth-child(2) { animation-delay: 0.15s; }
[data-caspian-template="home-goods"] .caspian-hero-split-copy > *:nth-child(3) { animation-delay: 0.25s; }
[data-caspian-template="home-goods"] .caspian-hero-split-copy > *:nth-child(4) { animation-delay: 0.35s; }
[data-caspian-template="home-goods"] .caspian-hero-split-image {
  animation: caspian-hero-home-image-in 1.1s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes caspian-hero-home-copy-in {
  from { opacity: 0; transform: translateX(-24px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes caspian-hero-home-image-in {
  from { opacity: 0; transform: scale(1.06); }
  to   { opacity: 1; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  [data-caspian-template="home-goods"] .caspian-hero-split-copy > *,
  [data-caspian-template="home-goods"] .caspian-hero-split-image {
    animation: none;
  }
}
`,
};
