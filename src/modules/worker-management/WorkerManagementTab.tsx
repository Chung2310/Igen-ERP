export default function WorkerManagementTab() {
  return (
    <section className="space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Quản lý lao động</h1>
        <p className="mt-1 text-sm text-slate-500">Theo dõi dữ liệu lao động của doanh nghiệp.</p>
      </div>
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        Chưa có lao động nào.
      </div>
    </section>
  );
}
