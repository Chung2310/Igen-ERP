import { BRAND_NAME } from "../../config/brand";
import "./module-launcher-logo.css";

/** Keeps the original wordmark proportions and recolors only ERP in dark mode. */
export function ModuleLauncherLogo({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      viewBox="163 287 1450 301"
      width="1450"
      height="301"
      className={compact ? "h-5 w-auto max-w-full" : "h-5 w-auto max-w-full sm:h-6"}
      role="img"
      aria-label={BRAND_NAME}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id="launcher-logo-erp"><rect x="1018" y="367" width="596" height="213" /></clipPath>
        <filter id="launcher-logo-transparent" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -10 0 0 0 9.2" />
        </filter>
        <filter id="launcher-logo-erp-white" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -10 0 0 0 9.2" />
        </filter>
      </defs>
      <image href="/logo-igenerp.png" width="1774" height="887" filter="url(#launcher-logo-transparent)" />
      <g className="module-launcher-logo-erp-dark" clipPath="url(#launcher-logo-erp)">
        <image href="/logo-igenerp.png" width="1774" height="887" filter="url(#launcher-logo-erp-white)" />
      </g>
    </svg>
  );
}
