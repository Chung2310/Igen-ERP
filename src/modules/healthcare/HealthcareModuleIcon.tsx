import type { SVGProps } from "react";
import HealthcareSidebarIcon from "./HealthcareSidebarIcon";

type Props = SVGProps<SVGSVGElement> & { size?: number | string; weight?: "regular" | "fill" | string };

/** Filled hospital mark for the main ERP sidebar. */
export default function HealthcareModuleIcon({ size = 24, weight: _weight, ...props }: Props) {
  return <HealthcareSidebarIcon kind="module" size={size} {...props} />;
}
