/**
 * Electronics Tech — devices, audio, and accessories with a dark
 * studio-photography aesthetic. Targets consumer electronics installers.
 */

import { HeroFullBleed } from '../../../components/home/variants/hero-full-bleed';
import { HomePageSpotlight } from '../../../components/home/variants/home-page-spotlight';
import { ProductCardCompact } from '../../../components/variants/product-card-compact';
import { ProductDetailTech } from '../../../components/variants/product-detail-tech';
import type { TemplateDefinition } from '../../types';
import { placeholderImage, unsplashUrl } from '../../types';

const PHOTO = {
  hero: '1505740420928-5e560c06d30e',
  catAudio: '1572569511254-d8f925fe2cbb',
  catWearables: '1606220588911-5117e04b71b9',
  catAccessories: '1592899677977-9c10ca588bbd',
  overEarHeadphones: '1505740420928-5e560c06d30e',
  wirelessEarbuds: '1572569511254-d8f925fe2cbb',
  studioMonitors: '1546435770-a3e426bf472b',
  smartwatch: '1606220588911-5117e04b71b9',
  fitnessTracker: '1574944985070-8f3ebc6b79d2',
  usbcHub: '1593642632559-0c6d3fc62b89',
  wirelessCharger: '1601445638532-3c6f6c3aa1d6',
  laptopStand: '1517336714731-489689fd1ca8',
  mechKeyboard: '1583394838336-acd977736f90',
  journalCommuter: '1505740420928-5e560c06d30e',
  journalDesk: '1517336714731-489689fd1ca8',
};

export const electronicsTechTemplate: TemplateDefinition = {
  id: 'electronics-tech',
  name: 'Electronics Tech',
  description:
    'Dark studio palette and product-forward photography for audio, wearables, and desk gear.',
  vertical: 'electronics',
  version: '1.0.0',
  theme: {
    primary: '#22c55e',
    primaryForeground: '#0a0a0a',
    accent: '#22c55e',
    radius: '0.5rem',
    background: '#0a0a0a',
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
  },
  hero: {
    title: 'Hardware that earns its place on the desk.',
    subtitle:
      'Headphones, wearables, and desk gear curated for daily use. No gimmicks, no RGB unless it earns it.',
    cta: 'Browse the shop',
    ctaHref: '/collections',
    imageUrl: unsplashUrl(PHOTO.hero),
  },
  features: {
    reviews: true,
    questions: true,
    wishlist: true,
    promoCodes: true,
    multiLanguage: false,
  },
  branding: {
    brandDescription:
      'Hand-tested electronics and desk accessories. Every product on the shelf has been in our daily rotation for at least a month before launch.',
  },
  brands: [
    {
      id: 'northstack',
      name: 'Northstack',
      isActive: true,
    },
  ],
  categories: [
    {
      id: 'audio',
      name: 'Audio',
      slug: 'audio',
      description:
        'Over-ear headphones, in-ear monitors, and desktop speakers across price tiers.',
      order: 0,
      isActive: true,
      isFeatured: true,
      imageUrl: unsplashUrl(PHOTO.catAudio, 1200),
    },
    {
      id: 'wearables',
      name: 'Wearables',
      slug: 'wearables',
      description:
        'Smart watches and fitness trackers tested for daily wear, not lab benchmarks.',
      order: 1,
      isActive: true,
      isFeatured: true,
      imageUrl: unsplashUrl(PHOTO.catWearables, 1200),
    },
    {
      id: 'desk-accessories',
      name: 'Desk Accessories',
      slug: 'desk-accessories',
      description:
        'Stands, hubs, keyboards, and chargers — the small upgrades that compound.',
      order: 2,
      isActive: true,
      isFeatured: true,
      imageUrl: unsplashUrl(PHOTO.catAccessories, 1200),
    },
  ],
  products: [
    {
      id: 'over-ear-headphones',
      slug: 'studio-over-ear-headphones',
      name: 'Studio Over-Ear Headphones',
      brand: 'northstack',
      shortDescription:
        'Closed-back over-ear headphones tuned for long mixing sessions and longer commutes.',
      description:
        'Closed-back driver design with a flatter response than the consumer default — comfortable for studio work and engaging enough for the train ride home. Aluminum yokes, memory-foam earpads, and a coiled cable in the box. Wired only; we figured the cable haters were already covered.',
      price: 349,
      images: [
        {
          id: 'main',
          url: placeholderImage('over-ear-headphones'),
          alt: 'Black over-ear studio headphones',
          hint: 'studio headphones product',
        },
      ],
      category: 'audio',
      color: 'Matte Black',
      isNew: true,
      isActive: true,
    },
    {
      id: 'wireless-earbuds',
      slug: 'wireless-earbuds',
      name: 'Wireless Earbuds Pro',
      brand: 'northstack',
      shortDescription:
        'True-wireless earbuds with active noise cancelling and an eight-hour cell.',
      description:
        'Active noise cancelling that actually clamps down on cabin noise, three sizes of silicone tips, and an eight-hour battery cell in each bud — three full charges in the case. Bluetooth 5.3 with multipoint pairing, so you can swap between phone and laptop without re-pairing.',
      price: 199,
      images: [
        {
          id: 'main',
          url: placeholderImage('wireless-earbuds'),
          alt: 'Black wireless earbuds in case',
          hint: 'wireless earbuds product',
        },
      ],
      category: 'audio',
      color: 'Charcoal',
      isActive: true,
    },
    {
      id: 'studio-monitors',
      slug: 'desktop-studio-monitors',
      name: 'Desktop Studio Monitors',
      brand: 'northstack',
      shortDescription:
        'A pair of near-field monitors flat enough to mix on, warm enough to enjoy.',
      description:
        'Three-inch woofers and silk-dome tweeters, biamped and front-ported so you can place them against a wall. Balanced XLR and unbalanced RCA inputs; standby mode kicks in after 20 minutes of silence. Sold as a stereo pair.',
      price: 449,
      images: [
        {
          id: 'main',
          url: placeholderImage('studio-monitors'),
          alt: 'Tan over-ear studio headphones on desk',
          hint: 'studio monitors product',
        },
      ],
      category: 'audio',
      isActive: true,
    },
    {
      id: 'smart-watch',
      slug: 'minimalist-smart-watch',
      name: 'Minimalist Smart Watch',
      brand: 'northstack',
      shortDescription:
        'Aluminum case, sapphire crystal, and a battery that lasts the full week.',
      description:
        '40mm anodized aluminum case with a sapphire-crystal display and a battery that genuinely lasts the week between charges. Tracks heart rate, sleep, and the usual fitness metrics without a subscription. Pairs with iOS and Android.',
      price: 279,
      images: [
        {
          id: 'main',
          url: placeholderImage('smart-watch'),
          alt: 'Black smart watch on dark surface',
          hint: 'smart watch product',
        },
      ],
      category: 'wearables',
      color: 'Graphite',
      isNew: true,
      isActive: true,
    },
    {
      id: 'fitness-tracker',
      slug: 'fitness-tracker-band',
      name: 'Fitness Tracker Band',
      brand: 'northstack',
      shortDescription:
        'A minimalist band with a fourteen-day battery and the metrics that actually matter.',
      description:
        'A slim band with a monochrome OLED touchscreen and a battery that lasts two full weeks of typical use. Tracks steps, heart rate, sleep stages, and workouts; ignores notifications by default and is better for it.',
      price: 89,
      images: [
        {
          id: 'main',
          url: placeholderImage('fitness-tracker'),
          alt: 'Black fitness tracker band',
          hint: 'fitness tracker product',
        },
      ],
      category: 'wearables',
      color: 'Black',
      isActive: true,
    },
    {
      id: 'usbc-hub',
      slug: 'usbc-hub-7-in-1',
      name: '7-in-1 USB-C Hub',
      brand: 'northstack',
      shortDescription:
        'HDMI 4K60, two USB-A 3.2, USB-C PD passthrough, SD + microSD, and Ethernet.',
      description:
        'Aluminum body, braided cable, and the seven ports that cover ~95% of the laptop-dock-replacement use case. HDMI runs 4K at 60Hz, USB-A ports are 3.2 gen 1, and the USB-C passthrough handles 85W of laptop charging.',
      price: 79,
      images: [
        {
          id: 'main',
          url: placeholderImage('usbc-hub'),
          alt: 'USB-C hub on dark desk',
          hint: 'usb-c hub adapter product',
        },
      ],
      category: 'desk-accessories',
      color: 'Space Grey',
      isActive: true,
    },
    {
      id: 'wireless-charger',
      slug: 'wireless-charging-pad',
      name: '15W Wireless Charging Pad',
      brand: 'northstack',
      shortDescription:
        'Single-coil Qi2 pad with a silicone surface that grips the phone.',
      description:
        'A flat Qi2 charger that delivers 15W on supported phones and 7.5W on iPhones older than the 15. The silicone surface is grippy enough that the phone doesn\'t walk off when buzzing with notifications.',
      price: 39,
      images: [
        {
          id: 'main',
          url: placeholderImage('wireless-charger'),
          alt: 'Wireless charging pad with phone',
          hint: 'wireless charger product',
        },
      ],
      category: 'desk-accessories',
      color: 'Black',
      isActive: true,
    },
    {
      id: 'laptop-stand',
      slug: 'aluminum-laptop-stand',
      name: 'Aluminum Laptop Stand',
      brand: 'northstack',
      shortDescription:
        'A passive heat-sink stand that lifts the screen to monitor height.',
      description:
        'CNC-machined aluminum that doubles as a passive heatsink for the laptop chassis. Fixed angle (the adjustable ones wobble), silicone pads on every contact point, and a cable channel underneath. Fits laptops from 11 to 17 inches.',
      price: 69,
      images: [
        {
          id: 'main',
          url: placeholderImage('laptop-stand'),
          alt: 'Aluminum laptop stand on desk',
          hint: 'laptop stand product',
        },
      ],
      category: 'desk-accessories',
      color: 'Silver',
      isActive: true,
    },
    {
      id: 'mech-keyboard',
      slug: 'compact-mechanical-keyboard',
      name: 'Compact Mechanical Keyboard',
      brand: 'northstack',
      shortDescription:
        'A 65% mechanical with hot-swap switches and per-key backlight.',
      description:
        'A 65% layout (no F-row, no number pad) with hot-swap five-pin sockets, PBT keycaps, and per-key white backlighting. Comes with linear switches; the box has a row of clicky alternates if you want to mix. Detachable USB-C cable.',
      price: 159,
      images: [
        {
          id: 'main',
          url: placeholderImage('mech-keyboard'),
          alt: 'Compact mechanical keyboard with white keycaps',
          hint: 'mechanical keyboard product',
        },
      ],
      category: 'desk-accessories',
      color: 'Black',
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
        'Hand-tested electronics. Every product has been in daily use for a month before it lands here.',
      content:
        '<p>Northstack is a small shop run by two engineers who got tired of buying gear from sites that had clearly never used the things they sold. We test every product on the shelf for at least a month of daily use before launching it, and we write the descriptions ourselves — no manufacturer marketing copy.</p><p>The catalogue is deliberately narrow. We\'d rather sell three good pairs of headphones than thirty. If we can\'t recommend a category at all (yes, smart home gadgets, we\'re looking at you), we don\'t carry it.</p>',
    },
    {
      id: 'privacy',
      pageKey: 'privacy',
      title: 'Privacy Policy',
      content:
        '<p>What we collect and what we do with it.</p><h2>Order data</h2><p>Name, shipping address, email, phone, and the payment details Stripe needs to process the order. We don\'t store card numbers; Stripe handles that under PCI-DSS.</p><h2>How we use it</h2><p>To fulfil orders, send order updates, and handle warranty claims. We don\'t sell or share your data outside the operational services in our terms.</p><h2>Your rights</h2><p>You can request access, correction, or deletion of your account data at any time — email the address at the bottom of this page.</p>',
    },
    {
      id: 'terms',
      pageKey: 'terms',
      title: 'Terms of Service',
      content:
        '<p>Plain-language terms; no surprises.</p><h2>Orders</h2><p>Prices are accurate at listing but subject to change. We reserve the right to cancel any order — if we do, you\'re refunded within five business days.</p><h2>Warranty</h2><p>Every product carries a 12-month warranty against manufacturing defects. We\'ll repair, replace, or refund at our discretion. The warranty does not cover wear from normal use or damage from misuse.</p><h2>Liability</h2><p>Our liability is limited to the value of the order. We don\'t accept liability for indirect or consequential losses.</p>',
    },
    {
      id: 'shipping-returns',
      pageKey: 'shipping-returns',
      title: 'Shipping & Returns',
      content:
        '<h2>Shipping</h2><p>Free standard shipping on orders over $100. Standard delivery is 2–4 business days domestically; expedited 1–2. International shipping via DHL with tracking.</p><h2>Returns</h2><p>30-day returns on unopened items in original packaging. Opened items can be returned within 14 days if functional issues are present — restocking fee may apply for change-of-mind returns on opened audio gear.</p>',
    },
  ],
  journal: [
    {
      id: 'commuter-headphones',
      title: 'Picking commuter headphones in 2026',
      excerpt:
        'Why active noise cancelling matters less than you think, and what to actually look for.',
      category: 'Buying notes',
      date: '2026-04-22',
      imageUrl: unsplashUrl(PHOTO.journalCommuter),
      content:
        '<p>Active noise cancelling has become the default selling point for commuter headphones, and that\'s starting to obscure more important decisions. ANC is genuinely useful on planes; on a train or subway, passive isolation from a properly-fitted ear-tip does most of the work and uses none of the battery.</p><p>What we actually look for: a fit that survives an hour without making the ears sore, multipoint Bluetooth so you don\'t have to re-pair when switching from phone to laptop, and a battery that gives you the round trip with a phone call to spare. Sound signature is personal; trust your own ear on that one.</p>',
    },
    {
      id: 'desk-essentials',
      title: 'The five desk upgrades worth making',
      excerpt:
        'A short list of upgrades that punch above their price for daily desk work.',
      category: 'Buying notes',
      date: '2026-04-02',
      imageUrl: unsplashUrl(PHOTO.journalDesk),
      content:
        '<p>Most desk upgrades are pointless. A few are transformative. The short list:</p><h2>1. A laptop stand that lifts the screen to eye level.</h2><p>This is the upgrade everyone postpones and everyone regrets postponing. Neck pain disappears in a week.</p><h2>2. A keyboard that types the way you like.</h2><p>You\'ll touch it ten thousand times today. Trust your fingers.</p><h2>3. A USB-C hub with HDMI 4K60.</h2><p>The five-port pen-shaped ones drop frames at 4K. Splurge twenty extra dollars on the one with real video bandwidth.</p><h2>4. A wireless charging pad close enough to use.</h2><p>If charging is a friction step you avoid, the phone runs out at 7pm. Putting a pad next to the keyboard fixes the problem permanently.</p><h2>5. Closed-back headphones for focus.</h2><p>Open-backs leak in both directions. If you share a space, closed-back is the only kind that respects the room.</p>',
    },
  ],
  preview: {
    swatch: ['#0a0a0a', '#22c55e', '#262626', '#737373'],
    heroImageUrl: unsplashUrl(PHOTO.hero, 800),
  },
  components: {
    Hero: HeroFullBleed,
    HomePage: HomePageSpotlight,
    ProductCard: ProductCardCompact,
    ProductDetailPage: ProductDetailTech,
  },
  css: `
[data-caspian-template="electronics-tech"] .caspian-hero-fullbleed-bg img {
  animation: caspian-hero-tech-zoom 22s ease-out infinite alternate;
  transform-origin: center;
}
[data-caspian-template="electronics-tech"] .caspian-hero-fullbleed-eyebrow,
[data-caspian-template="electronics-tech"] .caspian-hero-fullbleed-title,
[data-caspian-template="electronics-tech"] .caspian-hero-fullbleed-subtitle {
  animation: caspian-hero-tech-rise 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
}
[data-caspian-template="electronics-tech"] .caspian-hero-fullbleed-eyebrow  { animation-delay: 0.10s; }
[data-caspian-template="electronics-tech"] .caspian-hero-fullbleed-title    { animation-delay: 0.18s; }
[data-caspian-template="electronics-tech"] .caspian-hero-fullbleed-subtitle { animation-delay: 0.28s; }
@keyframes caspian-hero-tech-zoom {
  from { transform: scale(1.0); }
  to   { transform: scale(1.08); }
}
@keyframes caspian-hero-tech-rise {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
/* Compact product card hover — accent underline slides in under the name. */
[data-caspian-template="electronics-tech"] .caspian-product-card-compact:hover > div {
  transform: translateY(-2px);
  border-color: rgba(34, 197, 94, 0.4) !important;
  background: rgba(34, 197, 94, 0.04) !important;
}
[data-caspian-template="electronics-tech"] .caspian-product-card-compact-name::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  width: 0;
  background: var(--caspian-accent, #22c55e);
  transition: width 280ms cubic-bezier(0.22, 1, 0.36, 1);
}
[data-caspian-template="electronics-tech"] .caspian-product-card-compact:hover .caspian-product-card-compact-name::after {
  width: 40px;
}
[data-caspian-template="electronics-tech"] .caspian-product-card-compact-image img {
  transition: transform 500ms ease;
}
[data-caspian-template="electronics-tech"] .caspian-product-card-compact:hover .caspian-product-card-compact-image img {
  transform: scale(1.05);
}
/* Spec strip on the spotlight homepage — subtle hover lift on each item. */
[data-caspian-template="electronics-tech"] .caspian-home-spotlight-spec-strip span {
  transition: color 200ms ease;
}
[data-caspian-template="electronics-tech"] .caspian-home-spotlight-spec-strip span:hover {
  color: var(--caspian-accent, #22c55e);
}
@media (prefers-reduced-motion: reduce) {
  [data-caspian-template="electronics-tech"] .caspian-hero-fullbleed-bg img,
  [data-caspian-template="electronics-tech"] .caspian-hero-fullbleed-eyebrow,
  [data-caspian-template="electronics-tech"] .caspian-hero-fullbleed-title,
  [data-caspian-template="electronics-tech"] .caspian-hero-fullbleed-subtitle,
  [data-caspian-template="electronics-tech"] .caspian-product-card-compact:hover > div,
  [data-caspian-template="electronics-tech"] .caspian-product-card-compact-name::after,
  [data-caspian-template="electronics-tech"] .caspian-product-card-compact-image img {
    animation: none;
    transition: none;
  }
}
`,
};
