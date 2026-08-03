export default function CustomerManagementTab() {
  return (
    <section className="space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Quản lý khách hàng</h1>
        <p className="mt-1 text-sm text-slate-500">Theo dõi dữ liệu khách hàng của doanh nghiệp.</p>
      </div>
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        Chưa có dữ liệu khách hàng.
      </div>
    </section>
  );
}
