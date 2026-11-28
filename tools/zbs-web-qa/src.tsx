// Fixtures only: all API calls are intercepted here; this page cannot send Zalo messages.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './qa.css';
import ZaloZbsTab from '../../src/modules/marketing-suite/message/components/zbs/ZaloZbsTab';
import ZaloAppConnection from '../../src/modules/marketing-suite/shared/components/settings/ZaloAppConnection';
import { LeadTable } from '../../src/modules/marketing-suite/message/components/crm/LeadTable';
import '../../src/modules/marketing-suite/shared/marketing-workspace.css';
import '../../src/modules/marketing-suite/message/crm-workspace.css';
const query = new URLSearchParams(location.search);
document.documentElement.classList.toggle('dark', query.get('dark') === '1');
document.body.style.margin = '0';
document.body.className = 'bg-surface font-sans';
const state = query.get('state');
const lead = { id: '111111111111111111111111', customerName: 'Nguyễn Văn An', company: 'Doanh nghiệp thử nghiệm', phone: '0912345678', sourcePlatform: 'zalo', zaloIdentity: { oaId: '123456789', uid: '00123456789012345' }, answers: { ma_yeu_cau: 'BG001' }, intakeFields: [{ key: 'ma_yeu_cau', label: 'Mã yêu cầu' }] };
const template = { templateId: '12345', name: 'Thông báo báo giá đã sẵn sàng', status: 'ENABLE', params: [{ name: 'ten_khach_hang', required: true, type: 'STRING', minLength: 0, maxLength: 100 }, { name: 'ma_yeu_cau', required: true, type: 'STRING', minLength: 0, maxLength: 50 }], buttons: [{ title: 'Liên hệ CSKH', content: 'https://zalo.me/123456789', type: 3 }], previewUrl: '', uidSupported: true, phoneSupported: true, priceUid: 200, pricePhone: 300, syncedAt: '2026-11-28T04:00:00.000Z', mapping: { ten_khach_hang: { source: 'lead', key: 'customerName' }, ma_yeu_cau: { source: 'answer', key: 'ma_yeu_cau' } } };
const fixtures = query.get('multiple') === '1' ? [template,
  { ...template, templateId: '67890', name: 'Nhắc thanh toán theo yêu cầu' },
  { ...template, templateId: '99999', name: 'Chăm sóc sau giao dịch', status: 'PENDING_REVIEW' },
] : [template];
let batch: any;
globalThis.fetch = async (input, init) => {
  const url = String(input); const body = init?.body ? JSON.parse(String(init.body)) : {};
  if (state === 'loading') await new Promise(resolve => setTimeout(resolve, 60000));
  if (state === 'error') return Response.json({ message: 'Zalo chưa cấp quyền truy cập mẫu. Vui lòng kiểm tra kết nối OA.' }, { status: 403 });
  let data: unknown = [];
  if (url.includes('/zalo/oauth-session')) return Response.json({ authorizationUrl: 'https://oauth.zaloapp.com/v4/oa/permission?app_id=200' });
  if (url.includes('/accounts')) data = state === 'empty' ? [] : [{ oaId: '123456789', name: 'OA Doanh nghiệp thử nghiệm' }];
  else if (url.includes('/templates')) data = state === 'no-template' ? [] : fixtures;
  else if (url.includes('/telecom-invoices')) return Response.json({ data: { items: [] } });
  else if (url.includes('/omni-inbox/leads')) return Response.json({ data: [lead, { ...lead, id: '222222222222222222222222', customerName: 'Trần Thị Bình', zaloIdentity: undefined }], total: 2, totalPages: 1, page: 1, limit: 50 });
  else if (url.endsWith('/drafts')) { const chosen = fixtures.find(t => t.templateId === body.templateId) || template; batch = { id: '333333333333333333333333', name: body.name, oaId: body.oaId, templateId: chosen.templateId, templateName: chosen.name, method: body.method, status: 'draft', test: body.test, development: body.development, createdAt: '2026-11-28T04:00:00.000Z', expiresAt: '2026-11-29T04:00:00.000Z', estimatedCost: 200, rows: [{ id: 'row1', leadId: lead.id, name: lead.customerName, recipient: body.method === 'uid' ? lead.zaloIdentity.uid : '84912345678', method: body.method, data: { ten_khach_hang: lead.customerName, ma_yeu_cau: 'BG001' }, status: 'pending', reason: '', trackingId: 'qa1' }] }; data = batch; }
  else if (url.endsWith('/confirm')) { batch.status = 'queued'; data = batch; }
  else if (/\/batches\/[^/?]+$/.test(url)) data = batch;
  else if (url.includes('/batches')) return Response.json({ data: batch ? [{ ...batch, total: batch.rows.length, delivered: 0 }] : [], hasMore: false });
  return Response.json({ data });
};
function Harness() {
  const [search, setSearch] = useState('');
  const [entry, setEntry] = useState<{ ids: string[]; history?: boolean }>();
  const leadSurface = query.get('surface') === 'lead';
  if (query.get('surface') === 'zalo-app') return <main className="marketing-workspace mx-auto max-w-3xl space-y-4 p-4 text-on-surface"><h1 className="text-balance text-xl font-semibold">Kết nối Zalo OA</h1><ZaloAppConnection navigate={() => {}} integration={query.get('existing') === '1' ? { _id: 'fixture', zaloAppMode: 'custom', zaloAppId: '200', hasZaloAppSecret: true, hasZaloWebhookSecret: true } as any : undefined} /></main>;
  return <div className="marketing-workspace crm-workspace" style={{ height: '100dvh' }}>
    {leadSurface && <div hidden={Boolean(entry)} className="h-full"><LeadTable searchQuery={search} setSearchQuery={setSearch}
      onCreateLead={() => {}} deleteLead={() => {}} handleGoToChat={() => {}} activeChannel="all" companyCode="ZBS-QA" branchId=""
      canManageLeads onSendZalo={(ids, history) => setEntry({ ids, history })} /></div>}
    {(!leadSurface || entry) && <ZaloZbsTab canManage={state !== 'readonly'}
      initialLeadIds={entry?.ids || (query.get('compose') === '1' ? [lead.id] : [])} historyLeadId={entry?.history ? entry.ids[0] : undefined}
      onBackToLeads={() => setEntry(undefined)} />}
  </div>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
