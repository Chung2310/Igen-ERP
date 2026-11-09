import { useId, type SVGProps } from "react";

export type QuotationSidebarIconName = "budget" | "customerQuote" | "estimate" | "contract" | "acceptance" | "template" | "priceBook";

/** Quotation artwork follows the filled, rounded 24 px sidebar icons used by HR. */
export default function QuotationSidebarIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: QuotationSidebarIconName }) {
  const gradientId = useId().replace(/:/g, "");
  const fill = `url(#${gradientId})`;
  const cutout = "var(--color-surface-container-lowest)";
  const shape = {
    budget: <>
      <path d="M12 2.4a9.6 9.6 0 1 0 9.6 9.6A9.6 9.6 0 0 0 12 2.4Z" />
      <path d="M7.1 15.9v-2.4m3.3 2.4V9.7m3.3 6.2v-4.5m3.3 4.5V7.9" fill="none" stroke={cutout} strokeWidth="1.8" strokeLinecap="round" />
    </>,
    customerQuote: <>
      <path d="M5.5 2.5h8.1l4.9 4.9v12.2a2.1 2.1 0 0 1-2.1 2.1H5.5a2.1 2.1 0 0 1-2.1-2.1v-15a2.1 2.1 0 0 1 2.1-2.1Z" />
      <path d="M13.6 2.5v4a.9.9 0 0 0 .9.9h4" fill={cutout} />
      <path d="M7.2 11.3h3.8m-3.8 3.3h5.4" fill="none" stroke={cutout} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="17.7" cy="17.4" r="4.2" fill={fill} stroke={cutout} strokeWidth="1.8" />
      <circle cx="17.7" cy="16.3" r="1.2" fill={cutout} />
      <path d="M15.8 19.3c.4-1 1-1.4 1.9-1.4s1.5.4 1.9 1.4" fill="none" stroke={cutout} strokeWidth="1.6" strokeLinecap="round" />
    </>,
    estimate: <>
      <rect x="3.5" y="2.5" width="17" height="19" rx="2.8" />
      <path d="M7.3 7.2h9.4M7.3 10.6h5.5M7.3 15h2.4m-2.4 3h2.4m3.1-3h4.2m-4.2 3h4.2" fill="none" stroke={cutout} strokeWidth="1.8" strokeLinecap="round" />
    </>,
    contract: <>
      <path d="M6 2.5h8l4.7 4.7v8.1l-5.6 5.9H6a2.4 2.4 0 0 1-2.4-2.4V4.9A2.4 2.4 0 0 1 6 2.5Z" />
      <path d="M14 2.5v4a.7.7 0 0 0 .7.7h4" fill={cutout} />
      <path d="M7.4 11.2h5.4m-5.4 3.2h3.5" fill="none" stroke={cutout} strokeWidth="1.8" strokeLinecap="round" />
      <path d="m14.4 18.8 5-5a1.8 1.8 0 0 1 2.5 2.5l-5 5-3.3.7.8-3.2Z" fill={fill} />
    </>,
    acceptance: <>
      <rect x="3.5" y="4" width="17" height="18" rx="2.8" />
      <rect x="8.5" y="2" width="7" height="4.1" rx="1.4" fill={fill} />
      <path d="m7.4 13 3.1 3.1 6.2-6.3" fill="none" stroke={cutout} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>,
    template: <>
      <path d="M7.4 2.3h9.2A2.4 2.4 0 0 1 19 4.7v12.8H9.8a2.4 2.4 0 0 1-2.4-2.4V2.3Z" />
      <path d="M5.1 6.5H4a2 2 0 0 0-2 2v11.4a2 2 0 0 0 2 2h11.3a2 2 0 0 0 2-2v-.3H7.5a2.4 2.4 0 0 1-2.4-2.4V6.5Z" fill={fill} />
      <path d="M10.8 7.4h4.7m-4.7 3.4h4.7m-4.7 3.4h2.8" fill="none" stroke={cutout} strokeWidth="1.8" strokeLinecap="round" />
    </>,
    priceBook: <>
      <path d="M4.8 2.6h11.7A2.5 2.5 0 0 1 19 5.1v14.5a2.1 2.1 0 0 0-2.1-2.1H4.8a2.1 2.1 0 0 0-2.1 2.1V4.7a2.1 2.1 0 0 1 2.1-2.1Z" />
      <path d="M4.8 17.5h12.1a2.1 2.1 0 1 1 0 4.2H4.8a2.1 2.1 0 1 1 0-4.2Z" fill={fill} />
      <path d="M7.1 7.5h6.8M7.1 11h5.2" fill="none" stroke={cutout} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16.6" cy="10.8" r="3.8" fill={fill} stroke={cutout} strokeWidth="1.8" />
      <path d="M16.6 8.8v4m1.1-3.1h-1.8a.7.7 0 0 0 0 1.4h1.2a.7.7 0 0 1 0 1.4h-1.9" fill="none" stroke={cutout} strokeWidth="1.5" strokeLinecap="round" />
    </>,
  }[name];

  return <svg {...props} viewBox="0 0 24 24" fill={fill} aria-hidden="true" focusable="false">
    <defs><linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="0">
      <stop offset="0%" stopColor="#00adfc" />
      <stop offset="55%" stopColor="#199bff" />
      <stop offset="100%" stopColor="#7567ff" />
    </linearGradient></defs>
    {shape}
  </svg>;
}
