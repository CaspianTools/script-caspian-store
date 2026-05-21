/**
 * Fashion Minimal — apparel & accessories with a clean white palette and
 * editorial photography. Targets boutique fashion installers.
 */

import { HeroCentered } from '../../../components/home/variants/hero-centered';
import { HomePageDefault } from '../../../components/home/variants/home-page-default';
import { LayoutShellChromeDefault } from '../../../components/variants/layout-shell-chrome-default';
import { ProductCardStandard } from '../../../components/variants/product-card-standard';
import { ProductDetailDefault } from '../../../components/variants/product-detail-default';
import type { TemplateDefinition } from '../../types';
import { placeholderImage, unsplashUrl } from '../../types';

const PHOTO = {
  hero: '1483985988355-763728e1935b',
  catOuterwear: '1490481651871-ab68de25d43d',
  catKnitwear: '1495121605193-b116b5b9c5fe',
  catAccessories: '1556228720-195a672e8a03',
  camelCoat: '1543076447-215ad9ba6923',
  cashmereCrew: '1495121605193-b116b5b9c5fe',
  merinoRollNeck: '1576566588028-4147f3842f27',
  linenOvershirt: '1539109136881-3be0616acf4b',
  cardHolder: '1591561954557-26941169b49e',
  canvasTote: '1591561954557-26941169b49e',
  suedeLoafers: '1542291026-7eec264c27ff',
  cottonTee: '1521572163474-6864f9cf17ab',
  woolBeanie: '1576566588028-4147f3842f27',
  journalCoat: '1543076447-215ad9ba6923',
  journalCashmere: '1495121605193-b116b5b9c5fe',
};

export const fashionMinimalTemplate: TemplateDefinition = {
  id: 'fashion-minimal',
  name: 'Fashion Minimal',
  description:
    'Clean white palette and editorial photography for apparel and accessories.',
  vertical: 'fashion',
  version: '1.0.0',
  theme: {
    primary: '#111111',
    primaryForeground: '#ffffff',
    accent: '#171717',
    radius: '0.25rem',
    background: '#ffffff',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  },
  hero: {
    title: 'Considered essentials. Made to last.',
    subtitle:
      'A curated collection of natural-fibre apparel from independent makers — fewer pieces, better made.',
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
      'Modern essentials for a slower wardrobe. Built around fewer, better pieces in natural fibres.',
  },
  brands: [
    {
      id: 'common-thread',
      name: 'Common Thread',
      isActive: true,
    },
  ],
  categories: [
    {
      id: 'outerwear',
      name: 'Outerwear',
      slug: 'outerwear',
      description:
        'Wool coats, linen overshirts, and lightweight jackets cut for everyday wear.',
      order: 0,
      isActive: true,
      isFeatured: true,
      imageUrl: unsplashUrl(PHOTO.catOuterwear, 1200),
    },
    {
      id: 'knitwear',
      name: 'Knitwear',
      slug: 'knitwear',
      description:
        'Cashmere, merino, and lambswool from small mills. Designed to soften with wear.',
      order: 1,
      isActive: true,
      isFeatured: true,
      imageUrl: unsplashUrl(PHOTO.catKnitwear, 1200),
    },
    {
      id: 'accessories',
      name: 'Accessories',
      slug: 'accessories',
      description:
        'Small-batch leather goods, canvas totes, and finishing touches.',
      order: 2,
      isActive: true,
      isFeatured: true,
      imageUrl: unsplashUrl(PHOTO.catAccessories, 1200),
    },
  ],
  products: [
    {
      id: 'camel-wool-coat',
      slug: 'camel-wool-coat',
      name: 'Camel Wool Overcoat',
      brand: 'common-thread',
      shortDescription:
        'A double-breasted overcoat in undyed Italian wool. Cut for movement, finished with horn buttons.',
      description:
        'Cut from 100% virgin wool woven in Biella, Italy, this overcoat is the wardrobe anchor we keep coming back to. The undyed camel deepens with wear, the horn buttons are sourced from a family workshop in southern France, and the welt pockets sit at hip height for daily practicality. Fully lined in cupro; dry-clean only.',
      details:
        '<ul><li>100% virgin wool, woven in Biella</li><li>Horn buttons</li><li>Cupro lining</li><li>Made in Portugal</li></ul>',
      price: 685,
      images: [
        {
          id: 'main',
          url: placeholderImage('camel-wool-coat'),
          alt: 'Camel wool overcoat on a hanger',
          hint: 'camel wool overcoat product',
        },
      ],
      category: 'outerwear',
      sizes: ['XS', 'S', 'M', 'L', 'XL'],
      color: 'Camel',
      isNew: true,
      isActive: true,
    },
    {
      id: 'cashmere-crewneck',
      slug: 'cashmere-crewneck',
      name: 'Cashmere Crewneck',
      brand: 'common-thread',
      shortDescription:
        'Pure Mongolian cashmere, knit at gauge 12 for warmth without bulk.',
      description:
        'Spun from grade-A Mongolian cashmere and knit on twelve-gauge machines, this crewneck is light enough for layering but warm enough to wear alone. Set-in sleeves, ribbed cuffs, and a slightly relaxed body — the kind of sweater that earns its place in the daily rotation.',
      price: 245,
      images: [
        {
          id: 'main',
          url: placeholderImage('cashmere-crewneck'),
          alt: 'Beige cashmere crewneck sweater',
          hint: 'cashmere crewneck sweater',
        },
      ],
      category: 'knitwear',
      sizes: ['XS', 'S', 'M', 'L', 'XL'],
      color: 'Oatmeal',
      isActive: true,
    },
    {
      id: 'merino-rollneck',
      slug: 'merino-rollneck',
      name: 'Merino Roll-Neck',
      brand: 'common-thread',
      shortDescription:
        'Fine-gauge merino in a roll-neck that holds its shape. Layers under a jacket without bulk.',
      description:
        'Fine-gauge Italian merino, knit close to the body and finished with a roll-neck that stays upright through a long day. The seamless side construction keeps the silhouette clean under a coat, and the wool is treated to resist pilling for years of wear.',
      price: 165,
      images: [
        {
          id: 'main',
          url: placeholderImage('merino-rollneck'),
          alt: 'Black merino roll-neck',
          hint: 'merino rollneck sweater',
        },
      ],
      category: 'knitwear',
      sizes: ['XS', 'S', 'M', 'L', 'XL'],
      color: 'Black',
      isActive: true,
    },
    {
      id: 'linen-overshirt',
      slug: 'linen-overshirt',
      name: 'Linen Overshirt',
      brand: 'common-thread',
      shortDescription:
        'A boxy, mid-weight linen overshirt for the in-between seasons.',
      description:
        'A workwear-inspired overshirt cut from mid-weight Belgian linen. The boxy fit makes it easy to layer over a tee or under a topcoat, and the chest pockets are sized for a notebook or phone. Pre-washed for a soft hand from the first wear.',
      price: 195,
      images: [
        {
          id: 'main',
          url: placeholderImage('linen-overshirt'),
          alt: 'Linen overshirt on a wooden hanger',
          hint: 'linen overshirt apparel',
        },
      ],
      category: 'outerwear',
      sizes: ['XS', 'S', 'M', 'L', 'XL'],
      color: 'Sand',
      isNew: true,
      isActive: true,
    },
    {
      id: 'leather-card-holder',
      slug: 'leather-card-holder',
      name: 'Leather Card Holder',
      brand: 'common-thread',
      shortDescription:
        'Vegetable-tanned Italian leather, hand-finished in a single piece.',
      description:
        'A slim card holder cut from a single piece of vegetable-tanned Italian leather. Three card slots, a centre pocket for folded notes, and no lining — the leather will patina with use to a colour entirely its own.',
      price: 85,
      images: [
        {
          id: 'main',
          url: placeholderImage('leather-card-holder'),
          alt: 'Brown leather card holder',
          hint: 'leather card wallet',
        },
      ],
      category: 'accessories',
      color: 'Tan',
      isActive: true,
    },
    {
      id: 'canvas-tote',
      slug: 'canvas-tote',
      name: 'Heavyweight Canvas Tote',
      brand: 'common-thread',
      shortDescription:
        'Twelve-ounce cotton canvas with leather-reinforced handles.',
      description:
        'Sewn from twelve-ounce cotton canvas with leather-reinforced handles long enough to wear over a shoulder. Internal slip pocket, double-stitched seams, and a flat bottom that lets it stand on its own. Built for groceries, books, or a weekend overnight.',
      price: 95,
      images: [
        {
          id: 'main',
          url: placeholderImage('canvas-tote'),
          alt: 'Natural canvas tote bag',
          hint: 'canvas tote bag',
        },
      ],
      category: 'accessories',
      color: 'Natural',
      isActive: true,
    },
    {
      id: 'suede-loafers',
      slug: 'suede-loafers',
      name: 'Suede Penny Loafers',
      brand: 'common-thread',
      shortDescription:
        'Italian suede on a leather sole. Built on a Goodyear-welted last.',
      description:
        'Soft Italian suede uppers on a hand-stitched leather sole — built on the Goodyear-welt construction that lets you resole rather than replace. Unlined for a closer fit and faster break-in. Wear them with everything from raw denim to wool trousers.',
      price: 295,
      images: [
        {
          id: 'main',
          url: placeholderImage('suede-loafers'),
          alt: 'Tan suede penny loafers',
          hint: 'suede loafer shoes',
        },
      ],
      category: 'accessories',
      sizes: ['7', '8', '9', '10', '11', '12'],
      color: 'Cognac',
      isActive: true,
    },
    {
      id: 'cotton-crew-tee',
      slug: 'cotton-crew-tee',
      name: 'Heavyweight Cotton Crew Tee',
      brand: 'common-thread',
      shortDescription:
        'Seven-ounce Pima cotton in a boxy crew cut that holds its shape.',
      description:
        'A heavyweight Pima cotton crew that drapes more like a sweatshirt than a flimsy tee. Pre-washed to control shrinkage, double-stitched at the hem, and cut with a slightly dropped shoulder for a relaxed silhouette.',
      price: 65,
      images: [
        {
          id: 'main',
          url: placeholderImage('cotton-crew-tee'),
          alt: 'White cotton crew tee folded',
          hint: 'cotton t-shirt apparel',
        },
      ],
      category: 'knitwear',
      sizes: ['XS', 'S', 'M', 'L', 'XL'],
      color: 'White',
      isActive: true,
    },
    {
      id: 'wool-beanie',
      slug: 'wool-beanie',
      name: 'Ribbed Wool Beanie',
      brand: 'common-thread',
      shortDescription:
        'Lambswool rib knit in a relaxed slouchy shape. Made in Scotland.',
      description:
        'A ribbed wool beanie knit in the Scottish Borders from soft lambswool. The fold-up brim sits naturally above the ear, and the relaxed shape gives a touch of slouch without going floppy. One size; wears with everything.',
      price: 55,
      images: [
        {
          id: 'main',
          url: placeholderImage('wool-beanie'),
          alt: 'Grey wool beanie',
          hint: 'wool beanie hat',
        },
      ],
      category: 'accessories',
      color: 'Charcoal',
      isActive: true,
    },
  ],
  pages: [
    {
      id: 'about',
      pageKey: 'about',
      title: 'About',
      subtitle: 'A slower wardrobe, built around fewer, better pieces.',
      content:
        '<p>Common Thread started with a simple question: what would a wardrobe look like if it was built around fifteen pieces instead of fifty? Pieces sourced from independent mills, sewn in workshops that pay properly, and designed to outlast the seasons.</p><p>Every piece in the shop is chosen for how it ages. The wool deepens, the leather patinas, the linen softens — and the seams hold. We work directly with the makers, so we know the stories behind every fabric and finish, and we share them on the journal.</p><p>This isn\'t a fast catalogue. We add a handful of new pieces each season, and we keep the ones that work. If a piece sells out and we can\'t make it the same way again, we don\'t make it at all.</p>',
    },
    {
      id: 'privacy',
      pageKey: 'privacy',
      title: 'Privacy Policy',
      content:
        '<p>This page explains what data we collect, why, and what you can do about it.</p><h2>What we collect</h2><p>When you place an order we collect the information you enter at checkout — name, shipping and billing addresses, email, phone, and the payment details required by Stripe. We don\'t store full card numbers on our servers; Stripe handles that under PCI-DSS.</p><h2>How we use it</h2><p>To fulfil your order, send order updates, handle returns, and (if you opt in) send occasional newsletters. We don\'t sell or share your data with third parties beyond the operational services listed in our terms.</p><h2>Your rights</h2><p>You can request access, correction, or deletion of your account data at any time by writing to us at the contact email below.</p>',
    },
    {
      id: 'terms',
      pageKey: 'terms',
      title: 'Terms of Service',
      content:
        '<p>By placing an order with us you agree to the terms below. Plain language; no surprises.</p><h2>Orders and payment</h2><p>Prices and availability are accurate at time of listing but subject to change. We reserve the right to cancel any order for any reason — if we do, you\'re refunded in full within five business days.</p><h2>Shipping</h2><p>See the Shipping & Returns page for current rates and delivery windows. International orders may incur customs duties on arrival; these are the buyer\'s responsibility.</p><h2>Liability</h2><p>To the extent permitted by law, our liability is limited to the value of the order in question. We don\'t accept liability for indirect or consequential losses.</p>',
    },
    {
      id: 'shipping-returns',
      pageKey: 'shipping-returns',
      title: 'Shipping & Returns',
      content:
        '<h2>Shipping</h2><p>Free standard shipping on orders over $150. Standard delivery is 3–5 business days within the country; expedited 1–2. We ship internationally via tracked DHL; rates calculated at checkout.</p><h2>Returns</h2><p>Unworn, unwashed pieces with original tags can be returned within 30 days for a full refund. Sale items are final.</p><p>Return shipping is on the buyer for change-of-mind returns and on us for defects or our errors. Email us before sending anything back so we can issue a return label.</p>',
    },
  ],
  journal: [
    {
      id: 'why-camel-coat',
      title: 'The case for the camel coat',
      excerpt:
        'It has outlasted every fashion cycle since the 1920s. Here is why the camel coat keeps coming back.',
      category: 'Style notes',
      date: '2026-04-18',
      imageUrl: unsplashUrl(PHOTO.journalCoat),
      content:
        '<p>The camel coat has been in continuous production since the 1920s, when the polo-playing classes brought it back from India and a handful of London tailors started cutting it for civilian life. Every decade since has tried to reinvent it — wider lapels, narrower lapels, double-breasted, single, knee-length, full-length — and every decade the original keeps coming back.</p><p>The reason it endures is a colour decision, not a silhouette one. Undyed camel sits between most of what people wear, which means it doesn\'t fight the rest of the wardrobe. It works over a navy suit, over jeans, over a knit dress. The wool deepens with sunlight and wear — a five-year-old coat looks quietly different from a new one in a way most other coats don\'t.</p><p>Our coat is cut on the slightly longer side, in 100% virgin wool from a mill in Biella that has been weaving the same camel since 1957. It will outlast every coat you buy for the next decade.</p>',
    },
    {
      id: 'three-ways-cashmere',
      title: 'Three ways to wear cashmere',
      excerpt:
        'Beyond the obvious "with jeans" formula — how cashmere works under tailoring, over a dress, and on its own.',
      category: 'Style notes',
      date: '2026-03-30',
      imageUrl: unsplashUrl(PHOTO.journalCashmere),
      content:
        '<p>Cashmere is the easiest layer in the wardrobe and the hardest to wear with intent. Most of us default to "cashmere with jeans" and stop there. A few thoughts on three alternatives we keep coming back to.</p><h2>Under a suit jacket</h2><p>A fine-gauge cashmere crew under a suit jacket — no shirt, no tie — is the most reliable workaround for a meeting that doesn\'t quite warrant tailoring but doesn\'t want a t-shirt either. The crewneck has to sit close to the throat; anything looser starts to look like sportswear.</p><h2>Over a knit dress</h2><p>A boxy cashmere crew over a slip dress is the warm-weather move that quietly works in three seasons. The dress shows below the sweater hem; the proportions handle themselves.</p><h2>On its own</h2><p>The trick to wearing cashmere alone — no jacket, no shirt — is fit. A relaxed body and clean shoulders read as intentional. A tight sweater reads as underdressed. When in doubt, size up by one.</p>',
    },
  ],
  preview: {
    swatch: ['#ffffff', '#111111', '#c8a06a', '#e8e2d6'],
    heroImageUrl: unsplashUrl(PHOTO.hero, 800),
  },
  components: {
    Hero: HeroCentered,
    HomePage: HomePageDefault,
    ProductCard: ProductCardStandard,
    ProductDetailPage: ProductDetailDefault,
    LayoutShell: LayoutShellChromeDefault,
  },
  css: `
[data-caspian-template="fashion-minimal"] .caspian-hero-centered-inner {
  animation: caspian-hero-fashion-in 0.9s ease-out both;
}
[data-caspian-template="fashion-minimal"] .caspian-product-card-standard {
  transition: transform 250ms ease;
}
[data-caspian-template="fashion-minimal"] .caspian-product-card-standard:hover {
  transform: translateY(-2px);
}
[data-caspian-template="fashion-minimal"] .caspian-product-card-standard-image img {
  transition: transform 600ms ease;
}
[data-caspian-template="fashion-minimal"] .caspian-product-card-standard:hover .caspian-product-card-standard-image img {
  transform: scale(1.04);
}
@keyframes caspian-hero-fashion-in {
  from { opacity: 0; transform: translateY(24px); letter-spacing: 0.08em; }
  to   { opacity: 1; transform: translateY(0);     letter-spacing: 0.02em; }
}
@media (prefers-reduced-motion: reduce) {
  [data-caspian-template="fashion-minimal"] .caspian-hero-centered-inner,
  [data-caspian-template="fashion-minimal"] .caspian-product-card-standard,
  [data-caspian-template="fashion-minimal"] .caspian-product-card-standard-image img {
    animation: none;
    transition: none;
  }
}
`,
};
