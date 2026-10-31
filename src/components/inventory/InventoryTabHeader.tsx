import type { ReactNode } from "react";
import {
  Package,
  Warehouse,
  PackagePlus,
  Barcode,
  PackageMinus,
  ArrowLeftRight,
  ClipboardList,
  TrendingUp,
} from "lucide-react";
import type { InventorySubTabType } from "../../types";
import { inventoryTabs } from "./data";
import { ModuleNavigation, ModuleNavigationButton } from "../common/ModuleNavigation";

const TAB_ICONS: Record<string, ReactNode> = {
  "SẢN PHẨM": <Package className="size-4" />,
  "KHO HÀNG": <Warehouse className="size-4" />,
  "NHẬP HÀNG": <PackagePlus className="size-4" />,
  "IMEI / SERIAL": <Barcode className="size-4" />,
  "XUẤT HÀNG": <PackageMinus className="size-4" />,
  "ĐIỀU CHUYỂN": <ArrowLeftRight className="size-4" />,
  "GIAO DỊCH KHO": <ClipboardList className="size-4" />,
  "DỰ BÁO": <TrendingUp className="size-4" />,
};

const TAB_LABELS: Record<string, string> = {
  "SẢN PHẨM": "Sản phẩm",
  "KHO HÀNG": "Kho hàng",
  "NHẬP HÀNG": "Nhập hàng",
  "IMEI / SERIAL": "IMEI / Serial",
  "XUẤT HÀNG": "Xuất hàng",
  "ĐIỀU CHUYỂN": "Điều chuyển",
  "GIAO DỊCH KHO": "Giao dịch kho",
  "DỰ BÁO": "Dự báo",
};

type InventoryTabHeaderProps = {
  subTab: InventorySubTabType;
  onChangeTab: (tab: InventorySubTabType) => void;
};

export function InventoryTabHeader({ subTab, onChangeTab }: InventoryTabHeaderProps) {
  return (
    <ModuleNavigation label="Mục Kho & Sản phẩm" activeValue={subTab} id="inventory_tabs_switch">
      {inventoryTabs.map((tab) => (
        <ModuleNavigationButton
          key={tab}
          active={subTab === tab}
          icon={TAB_ICONS[tab] || <Package className="size-4" />}
          onClick={() => onChangeTab(tab)}
        >
          {TAB_LABELS[tab] || tab}
        </ModuleNavigationButton>
      ))}
    </ModuleNavigation>
  );
}
