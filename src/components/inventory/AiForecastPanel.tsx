import { AlertTriangle, RefreshCw, TrendingUp } from "lucide-react";
import { ProductItem } from "../../types";
import { toast } from "../../pages/Toast";

export function AiForecastPanel({ products }: { products: ProductItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" id="ai_demand_forecast_tab">
      <div className="flex flex-col justify-between rounded-2xl border border-gray-150 bg-gray-55/35 p-6" id="stock_short_warnings">
        <div>
          <h4 className="flex items-center gap-1.5 font-sans text-sm font-bold uppercase tracking-wide text-gray-800"><AlertTriangle className="h-4.5 w-4.5 text-red-500" />Cảnh báo khan hiếm tồn kho</h4>
          <p className="mt-1 text-xs leading-snug text-gray-400">Sản phẩm cạn kiệt nhanh hơn tiến độ đặt hàng và vận chuyển.</p>
          <div className="mt-5 space-y-4">
            {products.length === 0 ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center text-green-800">AI không phát hiện rủi ro cạn kho trong 30 ngày tới.</div>
            ) : (
              products.map((product) => {
                const daysLeft = product.sku === "LAP-DELL-XPS" ? 3 : product.sku === "MONITOR-LG-4K" ? 5 : 8;
                return (
                  <div key={product.id} className="relative flex items-start gap-3.5 rounded-xl border border-red-150 bg-white p-4">
                    <span className="rounded-lg bg-red-50 px-2 py-1 font-mono text-xs font-bold text-red-700">{product.imageUrl}</span>
                    <div className="text-xs">
                      <h5 className="font-sans font-bold text-gray-800">{product.name}</h5>
                      <p className="mt-0.5 font-mono text-[10px] text-gray-400">SKU: {product.sku} - Hiện tại: <strong>{product.stock} chiếc</strong></p>
                      <div className="mt-2 flex items-center gap-1 font-mono text-[10px] font-medium text-red-600"><span>Dự kiến cạn kho trong:</span><strong className="rounded-sm border border-red-100 bg-red-50 px-1.5 py-0.5">{daysLeft} ngày tới</strong></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <button onClick={() => toast.success("Đề nghị đặt hàng khẩn cấp đã được gửi tới nhà cung cấp.")} className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2.5 text-center text-xs font-bold text-white shadow-sm transition-all hover:bg-red-700"><RefreshCw className="h-4 w-4" />Xử lý cảnh báo hàng loạt</button>
      </div>

      <div className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 lg:col-span-2" id="ai_demand_chart_container">
        <div>
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 font-sans text-sm font-bold uppercase tracking-wide text-gray-800"><TrendingUp className="h-4.5 w-4.5 text-blue-500" />Dự báo nhu cầu khách hàng (30 ngày tới)</h4>
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-mono text-[10px] text-emerald-700">iGen Predictions Active</span>
          </div>
          <p className="mt-1 text-xs leading-snug text-gray-400">Dữ liệu phân tích doanh số kết hợp mô hình dự đoán xu hướng tồn kho.</p>
        </div>
        <div className="relative my-6 flex h-64 items-end">
          <svg className="h-full w-full" viewBox="0 0 540 240" preserveAspectRatio="none">
            <path d="M 270 120 L 320 100 L 380 90 L 440 60 L 520 40 L 520 160 L 440 180 L 380 190 L 320 180 L 270 120 Z" fill="rgba(99, 102, 241, 0.08)" />
            {[60, 120, 180].map((y) => <line key={y} x1={0} y1={y} x2={540} y2={y} stroke="#F9FAFB" />)}
            <line x1={0} y1={235} x2={540} y2={235} stroke="#E5E7EB" strokeWidth={1} />
            <line x1={270} y1={0} x2={270} y2={245} stroke="#6366F1" strokeWidth={2} strokeDasharray="3 3" />
            <path d="M 10 210 L 60 180 L 110 165 L 160 190 L 210 150 L 270 120" fill="none" stroke="#10B981" strokeWidth={3.5} strokeLinecap="round" />
            <path d="M 270 120 L 320 140 L 380 135 L 440 110 L 520 90" fill="none" stroke="#6366F1" strokeWidth={3} strokeDasharray="4 4" strokeLinecap="round" />
            <circle cx={270} cy={120} r={6} fill="#6366F1" stroke="#FFFFFF" strokeWidth={2} />
          </svg>
          <div className="absolute left-[272px] top-[100px] -translate-x-1/2 rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[9px] text-white shadow-md select-none">Hôm nay</div>
          <div className="absolute left-6 top-2 rounded-sm border border-green-200 bg-green-50 px-2 py-0.5 text-[9px] font-bold text-green-700">Dữ liệu thực tế</div>
          <div className="absolute right-6 top-2 rounded-sm border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[9px] font-bold text-indigo-700">Dự đoán tương lai</div>
        </div>
        <div className="border-t border-gray-150 pt-4" id="forecast_recommendations_grid">
          <span className="font-sans text-[10px] font-bold uppercase tracking-wide text-gray-500">Đề xuất tối ưu hóa tồn kho AI Co-pilot</span>
          <div className="mt-3 grid grid-cols-1 gap-3.5 text-xs md:grid-cols-3">
            <RecommendationCard title="1. Gom nhà cung cấp" body="Hợp nhất đơn nhập để tối ưu chi phí vận chuyển." />
            <RecommendationCard title="2. Đặt hàng XPS khẩn" body="Dell XPS đang cạn nhanh do nhu cầu văn phòng tăng." />
            <RecommendationCard title="3. Tái phân phối kho" body="Chuyển bớt hàng tồn chậm sang chi nhánh có nhu cầu cao hơn." />
          </div>
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-gray-150/70 bg-gray-50 p-3 text-left hover:bg-gray-100">
      <h5 className="font-sans font-bold text-gray-800">{title}</h5>
      <p className="mt-1 text-[10px] leading-normal text-gray-500">{body}</p>
    </div>
  );
}
