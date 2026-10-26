import { useLayoutEffect, useRef, useState } from "react";

const fullFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const shortFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

export function compactReportMoney(value: number): string {
  const units = [[1e15, "triệu tỷ"], [1e12, "nghìn tỷ"], [1e9, "tỷ"], [1e6, "triệu"], [1e3, "nghìn"]] as const;
  const unit = units.find(([size]) => Math.abs(value) >= size);
  return unit ? `${shortFormatter.format(value / unit[0])} ${unit[1]} ₫` : fullFormatter.format(value);
}

export default function AdaptiveMoney({ value }: { value: number }) {
  const container = useRef<HTMLDivElement>(null);
  const measurement = useRef<HTMLSpanElement>(null);
  const [compact, setCompact] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const full = fullFormatter.format(value);
  useLayoutEffect(() => {
    const update = () => {
      if (container.current && measurement.current) {
        setCompact(measurement.current.getBoundingClientRect().width > container.current.clientWidth);
      }
    };
    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (container.current) observer?.observe(container.current);
    if (measurement.current) observer?.observe(measurement.current);
    window.addEventListener("resize", update);
    return () => { observer?.disconnect(); window.removeEventListener("resize", update); };
  }, [full]);

  return (
    <div ref={container} className="relative min-w-0 flex-1 text-base font-bold tracking-tight text-slate-900 sm:text-lg">
      <span ref={measurement} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 w-max whitespace-nowrap">{full}</span>
      <button
        type="button"
        title={full}
        aria-label={full}
        aria-expanded={expanded}
        onClick={() => setExpanded(current => !current)}
        className="block w-full min-w-0 rounded text-left leading-tight [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-cyan-600"
      >
        {compact ? compactReportMoney(value) : full}
      </button>
      {expanded && <span role="status" className="mt-1 block text-xs font-medium tracking-normal text-slate-600 [overflow-wrap:anywhere]">{full}</span>}
    </div>
  );
}
