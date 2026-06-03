import React, { useState } from "react";
import { 
  Package, 
  Search, 
  Filter, 
  Plus, 
  ArrowUpRight, 
  ArrowDownRight, 
  AlertTriangle, 
  TrendingUp, 
  Cpu, 
  CheckCircle,
  FileCheck,
  ChevronRight,
  RefreshCw
} from "lucide-react";
import { InventorySubTabType, ProductItem, StockLog } from "../types";
import { toast } from "./Toast";

export default function InventoryTab() {
  const [subTab, setSubTab] = useState<InventorySubTabType>("DANH MỤC");

  // 1. Inventory Catalog List Database
  const [products, setProducts] = useState<ProductItem[]>([
    { id: "p1", sku: "PROD-X1", name: "Thiết bị đeo thông minh X1", category: "Thiết bị đeo", stock: 120, minStockAlert: 20, price: 1890000, demandForecast: "Tăng mạnh", imageUrl: "🎧" },
    { id: "p2", sku: "CLOUD-ENT-05", name: "Cloud Storage Enterprise", category: "Gói Dịch vụ Cloud", stock: 500, minStockAlert: 50, price: 5500000, demandForecast: "Ổn định", imageUrl: "💾" },
    { id: "p3", sku: "HEADPHONE-MAX", name: "Tai nghe không dây Pro Max", category: "Âm thanh", stock: 15, minStockAlert: 25, price: 2990000, demandForecast: "Tăng mạnh", imageUrl: "🎧" },
    { id: "p4", sku: "KEY-WORK-V2", name: "Bàn phím cơ Workspace V2", category: "Phụ kiện", stock: 8, minStockAlert: 15, price: 1650000, demandForecast: "Giảm nhẹ", imageUrl: "⌨️" },
    { id: "p5", sku: "LAP-DELL-XPS", name: "Laptop Dell XPS 15 Pro", category: "Máy tính xách tay", stock: 3, minStockAlert: 10, price: 45000000, demandForecast: "Tăng mạnh", imageUrl: "💻" },
    { id: "p6", sku: "MONITOR-LG-4K", name: "Màn hình LG 27\" 4K IPS", category: "Thiết bị hiển thị", stock: 2, minStockAlert: 8, price: 8900000, demandForecast: "Tăng mạnh", imageUrl: "🖥️" },
  ]);

  const [searchProduct, setSearchProduct] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProdName, setNewProdName] = useState("");
  const [newProdCategory, setNewProdCategory] = useState("Thiết bị đeo");
  const [newProdStock, setNewProdStock] = useState("");
  const [newProdPrice, setNewProdPrice] = useState("");
  const [newProdSKU, setNewProdSKU] = useState("");

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || !newProdSKU.trim()) return;
    const newProduct: ProductItem = {
      id: "p_" + Date.now(),
      sku: newProdSKU.toUpperCase(),
      name: newProdName,
      category: newProdCategory,
      stock: parseInt(newProdStock) || 0,
      minStockAlert: 15,
      price: parseFloat(newProdPrice) || 100000,
      demandForecast: "Ổn định",
      imageUrl: "📦"
    };

    // Auto-create a stock log for new products initial import
    const newLog: StockLog = {
      id: "log_" + Date.now(),
      type: "nhập",
      sku: newProduct.sku,
      productName: newProduct.name,
      quantity: newProduct.stock,
      operatorName: "iGen Admin System",
      createdAt: "Hôm nay, 10:20",
      notes: "Nhập mới sản phẩm khởi tạo doanh nghiệp",
      status: "Thành công"
    };

    setProducts([newProduct, ...products]);
    setStockLogs([newLog, ...stockLogs]);
    setShowAddModal(false);
    // clean
    setNewProdName("");
    setNewProdSKU("");
    setNewProdStock("");
    setNewProdPrice("");
  };

  // 2. Import / Export Transaction Logs
  const [stockLogs, setStockLogs] = useState<StockLog[]>([
    { id: "NK-2401", type: "nhập", sku: "LAP-DELL-XPS", productName: "Laptop Dell XPS 15 Pro", quantity: 20, operatorName: "Hoàng Gia Huy", createdAt: "Hôm nay, 08:30", notes: "Lô hàng điện thoại & máy tính xách tay tháng 10", status: "Thành công" },
    { id: "XK-2405", type: "xuất", sku: "CLOUD-ENT-05", productName: "Cloud Storage Enterprise", quantity: 5, operatorName: "Lê Ngọc Sang", createdAt: "12/10/2026", notes: "Kích hoạt hợp đồng đại lý Hà Nội", status: "Thành công" },
    { id: "XK-2404", type: "xuất", sku: "KEY-WORK-V2", productName: "Bàn phím cơ Workspace V2", quantity: 12, operatorName: "Lê Ngọc Sang", createdAt: "10/10/2026", notes: "Bán lẻ showroom trực tiếp", status: "Thành công" },
    { id: "NK-2400", type: "nhập", sku: "PROD-X1", productName: "Thiết bị đeo thông minh X1", quantity: 50, operatorName: "Hoàng Gia Huy", createdAt: "09/10/2026", notes: "Nhập bổ sung - Hoàn trả lỗi kỹ thuật từ KH", status: "Thành công" },
  ]);

  const [searchLog, setSearchLog] = useState("");

  // 3. AI Demand Forecasting list
  const isShortStock = (p: ProductItem) => p.stock <= p.minStockAlert;
  const shortStockProducts = products.filter(isShortStock);

  return (
    <div className="flex flex-col h-full bg-white max-h-[85vh] overflow-hidden" id="inventory_tab_wrapper">
      
      {/* Sub Header tabs for warehouse management */}
      <div className="border-b border-gray-200 bg-gray-50/50 p-2 text-xs flex justify-between shrink-0" id="inventory_tabs_switch">
        <div className="flex gap-2">
          {["DANH MỤC", "NHẬP / XUẤT KHO", "DỰ BÁO AI"].map((tab) => (
            <button
              key={tab}
              onClick={() => setSubTab(tab as InventorySubTabType)}
              className={`px-4 py-2 rounded-lg border font-bold uppercase transition-all tracking-wide ${
                subTab === tab 
                  ? "bg-slate-800 text-white border-slate-800 shadow-xs" 
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-100"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-2 text-indigo-700 bg-indigo-50 border border-indigo-150 px-3 py-1 rounded-lg font-bold font-mono text-[10px]">
          <Cpu className="h-3.5 w-3.5 text-indigo-500 animate-spin" />
          <span>Thuật toán Dự đoán iGen-Forecast active</span>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto" id="inventory_tab_content">
        
        {/* SUB TAB 1: DANH MỤC SẢN PHẨM */}
        {subTab === "DANH MỤC" && (
          <div className="space-y-6" id="product_catalog_menu">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4" id="catalog_filters">
              {/* Search */}
              <div className="relative w-72">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input 
                  type="text" 
                  placeholder="Tìm theo tên sản phẩm, mã SKU..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 bg-slate-50/50 rounded-lg text-xs"
                  value={searchProduct}
                  onChange={(e) => setSearchProduct(e.target.value)}
                  id="product_search_filter"
                />
              </div>

              {/* Add and Refresh button */}
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all shadow-sm select-none"
                  id="open_add_product_modal"
                >
                  <Plus className="h-4 w-4" />
                  Khai báo Sản Phẩm Mới
                </button>
              </div>
            </div>

            {/* Catalog list grid cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" id="products_grid">
              {products
                .filter(p => p.name.toLowerCase().includes(searchProduct.toLowerCase()) || p.sku.toLowerCase().includes(searchProduct.toLowerCase()))
                .map((prod) => {
                  const alertState = prod.stock <= prod.minStockAlert;
                  return (
                    <div key={prod.id} className={`p-5 bg-white border rounded-2xl transition-all flex flex-col justify-between hover:shadow-md relative ${
                      alertState ? "border-red-200 bg-red-50/10 shadow-xs" : "border-gray-200"
                    }`}>
                      {alertState && (
                        <span className="absolute top-4 right-4 text-red-650 text-red-500 font-bold bg-red-50 text-[9px] font-mono border border-red-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          HẾT HÀNG / THIẾU
                        </span>
                      )}

                      <div className="text-left">
                        <span className="text-3xl my-2 inline-block p-2 bg-gray-50 border rounded-lg select-none">{prod.imageUrl}</span>
                        <p className="text-[10px] text-gray-400 font-mono tracking-wider mt-1">SKU: {prod.sku}</p>
                        <h4 className="font-bold text-sm text-slate-800 font-sans tracking-tight leading-snug mt-2">{prod.name}</h4>
                        <span className="inline-block mt-2 px-2.5 py-0.5 bg-slate-100 rounded-md text-[9px] text-gray-500 font-medium">
                          {prod.category}
                        </span>
                      </div>

                      <div className="mt-6 border-t border-gray-100 pt-4 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-gray-400 font-mono">Đơn giá định mức:</p>
                          <p className="text-sm font-bold text-indigo-600 font-mono">{prod.price.toLocaleString("vi-VN")} đ</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-400 font-mono">Tồn kho:</p>
                          <p className={`text-sm font-bold font-mono ${alertState ? "text-red-500" : "text-gray-700"}`}>{prod.stock} chiếc</p>
                        </div>
                      </div>

                      <div className="mt-3.5 pt-2.5 border-t border-gray-50 flex items-center justify-between text-[11px]">
                        <span className="text-gray-400 font-mono">Xu hướng AI:</span>
                        <span className={`font-semibold flex items-center gap-1 ${
                          prod.demandForecast === "Tăng mạnh"
                            ? "text-red-500"
                            : prod.demandForecast === "Ổn định"
                              ? "text-green-600"
                              : "text-amber-600"
                        }`}>
                          {prod.demandForecast === "Tăng mạnh" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                          {prod.demandForecast}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Modal: Add New Product */}
            {showAddModal && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn" id="add_product_modal_backdrop">
                <div className="bg-white rounded-3xl border border-gray-200/50 shadow-2xl w-full max-w-lg overflow-hidden font-sans">
                  <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-gray-800 text-base flex items-center gap-2">
                        <Package className="h-5 w-5 text-blue-500" />
                        Khai báo sản phẩm mới lên ERP
                      </h4>
                      <p className="text-xs text-gray-400 mt-1">Lưu trữ sản phẩm đồng bộ lên cơ sở dữ liệu iGen Core</p>
                    </div>
                    <button 
                      onClick={() => setShowAddModal(false)}
                      className="p-1 px-3 text-sm text-slate-400 hover:text-slate-650 hover:bg-slate-100 rounded-md font-bold transition-all"
                    >
                      ✕
                    </button>
                  </div>
                  
                  <form onSubmit={handleAddProduct} className="p-6 space-y-4 text-xs text-left">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-500 font-bold mb-1.5 uppercase tracking-wide text-[10px]">Mã SKU quốc tế *</label>
                        <input 
                          type="text" 
                          placeholder="Mã SKU (Ex: LAP-LENOVO-01)" 
                          required
                          className="w-full p-2.5 border border-gray-200 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500"
                          value={newProdSKU}
                          onChange={(e) => setNewProdSKU(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-gray-500 font-bold mb-1.5 uppercase tracking-wide text-[10px]">Tên sản phẩm *</label>
                        <input 
                          type="text" 
                          placeholder="Ví dụ: Laptop Dell Precision..." 
                          required
                          className="w-full p-2.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                          value={newProdName}
                          onChange={(e) => setNewProdName(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-500 font-bold mb-1.5 uppercase tracking-wide text-[10px]">Phân mục loại sản phẩm</label>
                        <select 
                          className="w-full p-2.5 border border-gray-200 rounded-lg text-xs"
                          value={newProdCategory}
                          onChange={(e) => setNewProdCategory(e.target.value)}
                        >
                          <option value="Thiết bị đeo">Thiết bị đeo</option>
                          <option value="Gói Dịch vụ Cloud">Gói Dịch vụ Cloud</option>
                          <option value="Âm thanh">Âm thanh</option>
                          <option value="Phụ kiện">Phụ kiện</option>
                          <option value="Máy tính xách tay">Máy tính xách tay</option>
                          <option value="Thiết bị hiển thị">Thiết bị hiển thị</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-gray-500 font-bold mb-1.5 uppercase tracking-wide text-[10px]">Tồn kho khởi tạo</label>
                        <input 
                          type="number" 
                          placeholder="Số lượng thực tồn ban đầu" 
                          className="w-full p-2.5 border border-gray-200 rounded-lg text-xs font-mono"
                          value={newProdStock}
                          onChange={(e) => setNewProdStock(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-gray-500 font-bold mb-1.5 uppercase tracking-wide text-[10px]">Đơn giá xuất bán hàng định mức (VNĐ) *</label>
                      <input 
                        type="number" 
                        placeholder="Giá bán niêm yết chưa thuế" 
                        required
                        className="w-full p-2.5 border border-gray-200 rounded-lg text-xs font-mono"
                        value={newProdPrice}
                        onChange={(e) => setNewProdPrice(e.target.value)}
                      />
                    </div>

                    <div className="pt-4 border-t border-gray-100 flex gap-2 justify-end">
                      <button 
                        type="button" 
                        onClick={() => setShowAddModal(false)}
                        className="px-4 py-2 bg-gray-150 border rounded-lg font-bold"
                      >
                        Bỏ qua
                      </button>
                      <button 
                        type="submit" 
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors"
                      >
                        Xác nhận thêm
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUB TAB 2: NHẬP XUẤT KHO */}
        {subTab === "NHẬP / XUẤT KHO" && (
          <div className="space-y-6" id="stock_transactions_list">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4" id="log_filters_bar">
              <div className="relative w-80">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input 
                  type="text" 
                  placeholder="Tra cứu phiếu NK-..., XK-..., tên sản phẩm..."
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 bg-slate-50 rounded-lg text-xs"
                  value={searchLog}
                  onChange={(e) => setSearchLog(e.target.value)}
                />
              </div>
              <div className="text-[10px] text-gray-400 font-mono">
                Tổng số phiếu ghi nhận: <strong>{stockLogs.length} phiếu</strong>
              </div>
            </div>

            {/* List Table of transactions */}
            <div className="bg-white border rounded-2xl overflow-hidden shadow-xs" id="log_records_table">
              <div className="overflow-x-auto text-left font-sans text-xs">
                <table className="w-full">
                  <thead className="bg-[#0F172A] text-slate-100 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-5 py-3">Mã phiếu</th>
                      <th className="px-5 py-3">Loại giao dịch</th>
                      <th className="px-5 py-3">Sản phẩm tác động</th>
                      <th className="px-5 py-3 text-center">Số lượng</th>
                      <th className="px-5 py-3">Phụ trách</th>
                      <th className="px-5 py-3">Ngày tạo lập</th>
                      <th className="px-5 py-3">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150">
                    {stockLogs
                      .filter(l => l.id.toLowerCase().includes(searchLog.toLowerCase()) || l.productName.toLowerCase().includes(searchLog.toLowerCase()))
                      .map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50/50">
                          <td className="px-5 py-4 font-mono font-bold text-slate-800">{log.id}</td>
                          <td className="px-5 py-4">
                            <span className={`px-2.5 py-1 text-[9px] font-bold font-mono rounded-full uppercase ${
                              log.type === "nhập" 
                                ? "bg-green-50 text-green-700 border border-green-100" 
                                : "bg-red-50 text-red-700 border border-red-100"
                            }`}>
                              NHẬP KHO
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-gray-850 text-gray-800">{log.productName}</p>
                            <span className="text-[10px] text-gray-400 font-mono">SKU: {log.sku}</span>
                          </td>
                          <td className="px-5 py-4 text-center font-bold text-slate-700 font-mono">
                            {log.quantity} chiếc
                          </td>
                          <td className="px-5 py-4 text-gray-600 font-medium">{log.operatorName}</td>
                          <td className="px-5 py-4 font-mono text-gray-450 text-[10px]">{log.createdAt}</td>
                          <td className="px-5 py-4">
                            <span className="px-2 py-0.5 bg-green-100 text-green-850 rounded-md text-[9px] font-bold">
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SUB TAB 3: DỰ BÁO AI */}
        {subTab === "DỰ BÁO AI" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="ai_demand_forecast_tab">
            {/* Left Col: Stock warnings */}
            <div className="bg-gray-55/35 p-6 rounded-2xl border border-gray-150 flex flex-col justify-between" id="stock_short_warnings">
              <div>
                <h4 className="font-bold text-gray-800 text-sm tracking-wide font-sans flex items-center gap-1.5 uppercase">
                  <AlertTriangle className="h-4.5 w-4.5 text-red-500" />
                  Cảnh báo khan hiếm tồn kho
                </h4>
                <p className="text-xs text-gray-400 mt-1 leading-snug">Sản phẩm cạn kiệt nhanh hơn tiến độ sản xuất và thời đặt hàng vận chuyển.</p>

                <div className="space-y-4 mt-5">
                  {shortStockProducts.length === 0 ? (
                    <div className="p-8 text-center bg-green-50 text-green-800 rounded-xl border border-green-200">
                      🍀 AI không phát hiện rủi ro cạn kho nào trong 30 ngày tới!
                    </div>
                  ) : (
                    shortStockProducts.map((p) => {
                      const daysLeft = p.sku === "LAP-DELL-XPS" ? 3 : p.sku === "MONITOR-LG-4K" ? 5 : 8;
                      return (
                        <div key={p.id} className="p-4 bg-white border border-red-150 rounded-xl flex items-start gap-3.5 relative">
                          <span className="text-2xl p-1 bg-red-50 rounded-lg">{p.imageUrl}</span>
                          <div className="text-xs">
                            <h5 className="font-bold text-gray-800 font-sans">{p.name}</h5>
                            <p className="text-[10px] text-gray-400 font-mono mt-0.5">SKU: {p.sku} • Hiện tại: <strong>{p.stock} chiếc</strong></p>
                            <div className="mt-2 text-red-600 font-medium font-mono text-[10px] flex items-center gap-1">
                              <span>Dự kiến cạn kho trong:</span>
                              <strong className="bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-sm">{daysLeft} ngày tới</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-150">
                <button 
                  onClick={() => toast.success("Đề nghị đặt hàng khẩn cấp đã được gửi tự động tới nhà cung cấp thành công!")}
                  className="w-full text-center py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Xử lý cảnh báo hàng loạt
                </button>
              </div>
            </div>

            {/* Right Col: Interactive trend forecast - CUSTOM BEAUTIFUL SVG */}
            <div className="lg:col-span-2 bg-white p-6 border border-gray-200 rounded-2xl flex flex-col justify-between" id="ai_demand_chart_container">
              <div>
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-gray-800 text-sm tracking-wide font-sans flex items-center gap-2 uppercase">
                    <TrendingUp className="h-4.5 w-4.5 text-blue-500 animate-pulse" />
                    Dự báo nhu cầu khách hàng (30 ngày tới)
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md">iGen Predictions Active</span>
                </div>
                <p className="text-xs text-gray-400 mt-1 leading-snug">Dữ liệu phân tích doanh số tích lũy tháng trước kế kết hợp mô hình dự đoán xu hướng hội thoại của Trợ lý AI.</p>
              </div>

              {/* Forecast SVG rendering */}
              <div className="h-64 my-6 relative flex items-end">
                <svg className="w-full h-full" viewBox="0 0 540 240" preserveAspectRatio="none">
                  {/* Confidence interval background bounds */}
                  <path 
                    d="M 270 120 L 320 100 L 380 90 L 440 60 L 520 40 L 520 160 L 440 180 L 380 190 L 320 180 L 270 120 Z" 
                    fill="rgba(99, 102, 241, 0.08)"
                  />

                  {/* Grid background markers */}
                  <line x1={0} y1={60} x2={540} y2={60} stroke="#F9FAFB" />
                  <line x1={0} y1={120} x2={540} y2={120} stroke="#F9FAFB" />
                  <line x1={0} y1={180} x2={540} y2={180} stroke="#F9FAFB" />
                  <line x1={0} y1={235} x2={540} y2={235} stroke="#E5E7EB" strokeWidth={1} />

                  {/* TODAY separator indicator line */}
                  <line x1={270} y1={0} x2={270} y2={245} stroke="#6366F1" strokeWidth={2} strokeDasharray="3 3" />

                  {/* Historical curve line (Solid) */}
                  <path 
                    d="M 10 210 L 60 180 L 110 165 L 160 190 L 210 150 L 270 120" 
                    fill="none" 
                    stroke="#10B981" 
                    strokeWidth={3.5}
                    strokeLinecap="round"
                  />

                  {/* Future Forecast curve line (Dotted) */}
                  <path 
                    d="M 270 120 L 320 140 L 380 135 L 440 110 L 520 90" 
                    fill="none" 
                    stroke="#6366F1" 
                    strokeWidth={3}
                    strokeDasharray="4 4"
                    strokeLinecap="round"
                  />

                  {/* Today marker label circle */}
                  <circle cx={270} cy={120} r={6} fill="#6366F1" stroke="#FFFFFF" strokeWidth={2} />
                </svg>

                {/* Today overlay tag */}
                <div className="absolute top-[100px] left-[272px] bg-slate-900 border border-slate-700 text-white font-mono text-[9px] py-0.5 px-2 rounded-md shadow-md transform -translate-x-1/2 select-none">
                  HÔM NAY (MỐC THÁNG 10)
                </div>

                <div className="absolute top-2 left-6 bg-green-50 border border-green-200 text-green-700 text-[9px] font-bold px-2 py-0.5 rounded-sm">
                  Dữ liệu thực tế
                </div>
                <div className="absolute top-2 right-6 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[9px] font-bold px-2 py-0.5 rounded-sm">
                  Dự đoán tương lai (+30 ngày)
                </div>
              </div>

              {/* Optimize recommendations cards */}
              <div className="border-t border-gray-150 pt-4" id="forecast_recommendations_grid">
                <span className="text-[10px] font-bold text-gray-500 uppercase font-sans tracking-wide">Đề xuất tối ưu hóa tồn kho AI Co-pilot</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-3 text-xs">
                  <div className="p-3 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-150/70 text-left">
                    <h5 className="font-bold text-gray-800 font-sans">1. Gom nhà cung cấp</h5>
                    <p className="text-[10px] text-gray-500 mt-1 leading-normal">Hợp nhất đơn nhập linh kiện Kho để được chiết khấu thêm 15% vận chuyển lẻ.</p>
                  </div>
                  <div className="p-3 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-150/70 text-left">
                    <h5 className="font-bold text-gray-800 font-sans">2. Đặt hàng XPS khẩn</h5>
                    <p className="text-[10px] text-gray-500 mt-1 leading-normal">Dell XPS đang cạn cực nhanh do nhu cầu văn phòng tăng mạnh học kỳ mới.</p>
                  </div>
                  <div className="p-3 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-150/70 text-left">
                    <h5 className="font-bold text-gray-800 font-sans">3. Tái phân phối kho</h5>
                    <p className="text-[10px] text-gray-500 mt-1 leading-normal">Chuyển bớt 5 bàn phím Workspace V2 sang chi nhánh miền Trung do nhu cầu chậm lại.</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
