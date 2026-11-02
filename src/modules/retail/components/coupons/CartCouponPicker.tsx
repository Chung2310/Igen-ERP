import { useEffect, useState } from "react";
import { retailCouponsApi, type RetailSelectableCoupon } from "../../api/retailCoupons.api";
import { Dropdown } from "../../../../components/common/Dropdown";
import type { RetailScope } from "../../types";

export default function CartCouponPicker({ scope, customerId, value, onChange }: {
  scope: RetailScope;
  customerId?: string;
  value: string;
  onChange: (code: string) => void;
}) {
  const [result, setResult] = useState<{ key: string; items: RetailSelectableCoupon[]; error?: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const key = `${scope.companyCode}:${scope.branchId}:${customerId || ""}`;
  useEffect(() => {
    let current = true;
    setResult(null);
    const load = async () => {
      try {
        const items = await retailCouponsApi.selectable(scope, customerId);
        if (current) setResult({ key, items });
      } catch {
        if (current) setResult({ key, items: [], error: "Không tải được danh sách mã. Bạn vẫn có thể nhập mã bên dưới." });
      }
    };
    void load();
    return () => { current = false; };
  }, [key, revision]);
  const loading = result?.key !== key;
  const coupons = loading ? [] : result.items;
  const selected = coupons.some(item => item.code === value) ? value : "";

  const options = [
    {
      value: "",
      label: loading
        ? "Đang tải mã ưu đãi..."
        : "Chọn mã đã tạo hoặc nhập mã bên dưới",
    },
    ...coupons.map((item) => ({
      value: item.code,
      label: `${item.code} — ${item.name} · Giảm ${
        item.discountType === "percent"
          ? `${item.value}%`
          : `${item.value.toLocaleString("vi-VN")} ₫`
      }`,
    })),
  ];

  return (
    <div className="mt-2 space-y-1.5">
      <Dropdown<string>
        name="couponPicker"
        aria-label="Chọn mã ưu đãi đã tạo"
        value={selected}
        disabled={loading || Boolean(result?.error)}
        onChange={(val) => onChange(val)}
        options={options}
        variant="form"
        size="sm"
        placeholder={
          loading
            ? "Đang tải mã ưu đãi..."
            : "Chọn mã đã tạo hoặc nhập mã bên dưới"
        }
        triggerClassName="w-full bg-white border-slate-200 text-slate-800 font-medium py-2 shadow-2xs hover:border-slate-300"
      />
      {result?.key === key && result.error && <p role="status" className="text-xs text-amber-700">{result.error} <button type="button" onClick={() => setRevision(value => value + 1)} className="font-semibold underline">Thử lại</button></p>}
      {!loading && !result.error && !coupons.length && <p className="text-xs text-slate-500">Chưa có mã còn hiệu lực phù hợp với khách đã chọn.</p>}
      {coupons.filter(item => item.code === selected).map(item => <p key={item._id} className="text-[11px] text-slate-500">
        Đơn từ {item.minSubtotal.toLocaleString("vi-VN")} ₫{item.maxDiscount != null ? ` · Giảm tối đa ${item.maxDiscount.toLocaleString("vi-VN")} ₫` : ""}
        {item.customerTierCodes?.length ? " · Có điều kiện hạng khách hàng" : ""}
      </p>)}
    </div>
  );
}
