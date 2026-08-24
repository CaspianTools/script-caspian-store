import type { SVGProps } from 'react';

/**
 * Tiny stroke-based inline SVG icons used by the admin surface (3-dot action
 * menus, view-on-storefront links, profile dropdowns, etc.). Inline to avoid
 * adding a dependency; `currentColor` + `stroke-width: 2` makes them inherit
 * whatever button / link they sit inside.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function svgDefaults({ size = 16, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...rest,
  };
}

export function MoreHorizontalIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <circle cx="5" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export function ExternalLinkIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 14v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function LogOutIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 3h16l-2-3z" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
      <path d="M20.49 15A9 9 0 0 1 5.64 18.36L1 14" />
    </svg>
  );
}

export function HelpIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// Admin sidebar icons — added for the grouped sidebar (v3.0.0). Stroke-based,
// `currentColor`, sized via `size` prop (default 16). Hand-rolled to avoid
// pulling in an icon dependency.

export function DashboardIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export function PackageIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

export function TagIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

export function TicketIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" />
      <line x1="13" y1="7" x2="13" y2="17" />
    </svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <polyline points="22 6 12 13 2 6" />
    </svg>
  );
}

export function ShoppingCartIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

export function ReceiptIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 2V2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="16" y2="11" />
      <line x1="8" y1="15" x2="13" y2="15" />
    </svg>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function FileTextIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

export function FileIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

export function BookOpenIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

export function PaletteIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <circle cx="13.5" cy="6.5" r="1.5" />
      <circle cx="17.5" cy="10.5" r="1.5" />
      <circle cx="8.5" cy="7.5" r="1.5" />
      <circle cx="6.5" cy="12.5" r="1.5" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-5.52-4.5-9-10-9z" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <path d="M12 4v12" />
      <polyline points="7 11 12 16 17 11" />
      <line x1="4" y1="20" x2="20" y2="20" />
    </svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <path d="M12 17V5" />
      <polyline points="7 10 12 5 17 10" />
      <line x1="4" y1="20" x2="20" y2="20" />
    </svg>
  );
}

export function TableIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
    </svg>
  );
}

export function TruckIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

export function CreditCardIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

export function AtSignIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
    </svg>
  );
}

export function InboxIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export function PlugIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <path d="M9 2v6" />
      <path d="M15 2v6" />
      <path d="M6 8h12v3a6 6 0 1 1-12 0V8z" />
      <path d="M12 17v5" />
    </svg>
  );
}

export function BookmarkIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function StoreIcon(props: IconProps) {
  return (
    <svg {...svgDefaults(props)}>
      <path d="M3 7h18l-2 9H5L3 7z" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M12 16v4" />
      <path d="M8 16v4" />
      <path d="M16 16v4" />
    </svg>
  );
}
