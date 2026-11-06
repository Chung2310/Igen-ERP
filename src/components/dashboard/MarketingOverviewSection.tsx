import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "../../modules/marketing-suite/shared/context/AuthContext";
import { ErpRefreshButton } from "../common/ErpRefreshButton";
import { AnimatedOverviewValue } from "./AnimatedOverviewValue";
import { crmService, type ExtendedLeadCard } from "../../modules/marketing-suite/message/services/crmService";
import { fbMessengerService } from "../../modules/marketing-suite/message/services/fbMessengerService";
import { zaloMessengerService } from "../../modules/marketing-suite/message/services/zaloMessengerService";
import { tiktokMessengerService } from "../../modules/marketing-suite/message/services/tiktokMessengerService";
import { companyKnowledgeService, type CompanyKnowledgeHealth, type FaqCandidatesResponse } from "../../modules/marketing-suite/knowledge/services/companyKnowledgeService";
import { socialIntegrationService, type SocialIntegration } from "../../modules/marketing-suite/shared/services/socialIntegrationService";
import { leadInsights, summarizeLeads, type LeadStage } from "./marketingOverviewMetrics";
import "../../modules/finance/finance-overview.css";

const integer = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);
const money = (value: number) => `${integer(value)} đ`;
const labels: Record<LeadStage, string> = { cold: "Mới", warm: "Đang quan tâm", hot: "Tiềm năng cao", won: "Đã chốt", upsell: "Bán thêm" };
const colors = ["var(--finance-chart-blue)", "var(--finance-chart-teal)", "var(--finance-chart-orange)", "var(--finance-chart-violet)", "var(--finance-chart-red)"];
type InboxStat = { channel: string; count: number; unread: number; truncated: boolean };

async function loadInbox(accounts: SocialIntegration[]): Promise<{ rows: InboxStat[]; failed: boolean }> {
  const requests = accounts.filter(account => account.isConnected && !account.isMock && account.username).map(async account => {
    const limit = 100;
    const id = account.username!;
    const rows = account.platform === "Facebook" ? await fbMessengerService.getConversations({ pageId: id, limit })
      : account.platform === "Zalo" ? await zaloMessengerService.getConversations({ accountId: id, limit })
        : await tiktokMessengerService.getConversations({ accountId: id, limit });
    return { channel: account.platform, count: rows.length, unread: rows.reduce((sum, row) => sum + (typeof row.unreadCount === "number" ? row.unreadCount : 0), 0), truncated: rows.length === limit };
  });
  const results = await Promise.allSettled(requests);
  return { rows: results.flatMap(result => result.status === "fulfilled" ? [result.value] : []), failed: results.some(result => result.status === "rejected") };
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="finance-chart-card"><h3 className="mb-4 text-sm font-semibold text-on-surface">{title}</h3>{children}</section>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-12 text-center text-sm text-on-surface-variant">{children}</p>;
}

export default function MarketingOverviewSection() {
  const { hasPermission, userProfile } = useAuth();
  const isAdmin = userProfile?.role === "superadmin" || userProfile?.role === "admin";
  const canReadCrm = isAdmin || hasPermission("omni-inbox:read") || hasPermission("omni-inbox:manage");
  const canReadKnowledge = isAdmin || hasPermission("company-knowledge:read") || hasPermission("company-knowledge:manage");
  const [leads, setLeads] = useState<ExtendedLeadCard[] | null>(null);
  const [accounts, setAccounts] = useState<SocialIntegration[] | null>(null);
  const [inbox, setInbox] = useState<InboxStat[] | null>(null);
  const [knowledge, setKnowledge] = useState<CompanyKnowledgeHealth | null>(null);
  const [faq, setFaq] = useState<FaqCandidatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestSequence = useRef(0);
  const reduceMotion = useReducedMotion();

  const loadData = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    const [leadResult, accountResult, knowledgeResult, faqResult] = await Promise.allSettled([
      canReadCrm ? crmService.getLeads() : Promise.resolve(null),
      canReadCrm ? socialIntegrationService.getAccounts("omni-inbox") : Promise.resolve(null),
      canReadKnowledge ? companyKnowledgeService.health() : Promise.resolve(null),
      canReadKnowledge ? companyKnowledgeService.listFaqCandidates() : Promise.resolve(null),
    ] as const);
    const nextAccounts = accountResult.status === "fulfilled" ? accountResult.value : null;
    const personalAccounts = [
      userProfile?.facebookIntegration?.isConnected && userProfile.facebookIntegration.pageId && { platform: "Facebook" as const, displayName: userProfile.facebookIntegration.pageName || "Facebook", username: userProfile.facebookIntegration.pageId, isConnected: true, isMock: userProfile.facebookIntegration.isMock, createdBy: "personal" },
      userProfile?.zaloIntegration?.isConnected && userProfile.zaloIntegration.oaId && { platform: "Zalo" as const, displayName: userProfile.zaloIntegration.oaName || "Zalo", username: userProfile.zaloIntegration.oaId, isConnected: true, isMock: userProfile.zaloIntegration.isMock, createdBy: "personal" },
      userProfile?.tiktokIntegration?.isConnected && userProfile.tiktokIntegration.username && { platform: "TikTok" as const, displayName: userProfile.tiktokIntegration.displayName || "TikTok", username: userProfile.tiktokIntegration.username, isConnected: true, isMock: userProfile.tiktokIntegration.isMock, createdBy: "personal" },
    ].filter(Boolean) as SocialIntegration[];
    const allAccounts = [...personalAccounts, ...(nextAccounts || [])].filter((account, index, list) => list.findIndex(item => item.platform === account.platform && item.username === account.username) === index);
    const inboxResult = canReadCrm ? await loadInbox(allAccounts) : null;
    if (requestId !== requestSequence.current) return;
    setLeads(leadResult.status === "fulfilled" ? leadResult.value : null);
    setAccounts(canReadCrm ? allAccounts : null);
    setKnowledge(knowledgeResult.status === "fulfilled" ? knowledgeResult.value : null);
    setFaq(faqResult.status === "fulfilled" ? faqResult.value : null);
    setInbox(inboxResult?.rows ?? null);
    setError([leadResult, accountResult, knowledgeResult, faqResult].some(result => result.status === "rejected") || Boolean(inboxResult?.failed));
    setLoading(false);
  }, [canReadCrm, canReadKnowledge, userProfile]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) void loadData(); });
    return () => { active = false; requestSequence.current += 1; };
  }, [loadData]);
  const crm = leads ? summarizeLeads(leads) : null;
  const insights = leads ? leadInsights(leads) : null;
  const connected = accounts?.filter(account => account.isConnected && !account.isMock && account.username) ?? [];
  const inboxCount = inbox?.reduce((sum, row) => sum + row.count, 0) ?? null;
  const unreadCount = inbox?.reduce((sum, row) => sum + row.unread, 0) ?? null;
  const stages = crm ? (Object.keys(labels) as LeadStage[]).map(stage => ({ name: labels[stage], count: crm.byStage[stage], value: crm.valueByStage[stage] })) : [];
  const kpis = [
    { title: "Cơ hội CRM", value: crm?.total, format: integer },
    { title: "Đang theo đuổi", value: crm?.open, format: integer },
    { title: "Đã chốt", value: crm?.byStage.won, format: integer },
    { title: "Giá trị cơ hội", value: crm?.openValue, format: money },
    { title: "Tin chưa đọc gần đây", value: unreadCount, format: integer },
    { title: "Tài liệu tri thức", value: knowledge?.documentsCount, format: integer },
  ];

  return <div className="finance-overview space-y-3 text-left text-on-surface">
    <header className="flex flex-wrap items-center justify-between gap-4 pb-2"><div><div className="flex items-center gap-2"><span aria-hidden="true" className="h-5 w-1 rounded-sm bg-primary" /><h2 className="text-lg font-semibold">Tổng quan Marketing & CRM</h2></div><p className="mt-1 text-xs text-on-surface-variant">Cơ hội bán hàng, hội thoại đa kênh và kho tri thức</p></div><ErpRefreshButton onClick={loadData} loading={loading} /></header>
    {error && <p role="status" className="rounded-md border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface-variant">Một số nguồn dữ liệu chưa tải được. Bấm Làm mới để thử lại.</p>}
    <section className="finance-chart-card" aria-label="Chỉ số Marketing và CRM"><h3 className="mb-3 text-sm font-semibold text-on-surface">Tình hình Marketing & CRM</h3><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{kpis.map((item, index) => <div key={item.title} className={`finance-kpi finance-kpi-${index}`}><p className="text-xs font-medium text-white">{item.title}</p><p className="mt-2 break-words text-lg font-semibold tabular-nums text-white sm:text-xl"><AnimatedOverviewValue value={loading ? null : item.value} format={item.format} /></p></div>)}</div>{inbox?.some(row => row.truncated) && <p className="mt-3 text-xs text-on-surface-variant">Tin chưa đọc được tính trong 100 hội thoại gần nhất của mỗi tài khoản kết nối.</p>}</section>
    <div className="grid gap-3 lg:grid-cols-2">
      <Panel title="Phễu cơ hội CRM">{crm?.total ? <><div role="img" aria-label="Số cơ hội theo trạng thái" className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={stages} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}><CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip formatter={value => typeof value === "number" ? integer(value) : value} /><Bar dataKey="count" name="Cơ hội" maxBarSize={44} isAnimationActive={!reduceMotion} animationDuration={700}>{stages.map((row, index) => <Cell key={row.name} fill={colors[index]} />)}</Bar></BarChart></ResponsiveContainer></div><div className="grid grid-cols-2 gap-3 border-t border-outline-variant pt-3 text-xs sm:grid-cols-5">{stages.map(row => <div key={row.name}><p className="text-on-surface-variant">{row.name}</p><strong className="mt-1 block text-sm tabular-nums">{integer(row.count)}</strong></div>)}</div></> : <Empty>{loading ? "Đang tải cơ hội..." : leads ? "Chưa có cơ hội CRM." : "Chưa có dữ liệu CRM."}</Empty>}</Panel>
      <Panel title="Giá trị theo trạng thái CRM">{crm && stages.some(row => row.value > 0) ? <><div role="img" aria-label="Giá trị cơ hội theo trạng thái" className="h-56"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stages.filter(row => row.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="52%" outerRadius="77%" stroke="none" isAnimationActive={!reduceMotion} animationDuration={700}>{stages.filter(row => row.value > 0).map((row, index) => <Cell key={row.name} fill={colors[index]} />)}</Pie><Tooltip formatter={value => typeof value === "number" ? money(value) : value} /></PieChart></ResponsiveContainer></div><div className="grid grid-cols-2 gap-3 border-t border-outline-variant pt-3 text-xs sm:grid-cols-3">{[["Tổng giá trị", crm.totalValue], ["Đang theo đuổi", crm.openValue], ["Đã chốt", crm.valueByStage.won]] .map(([label, value]) => <div key={label}><p className="text-on-surface-variant">{label}</p><strong className="mt-1 block text-sm tabular-nums">{money(Number(value))}</strong></div>)}</div></> : <Empty>{loading ? "Đang tải giá trị cơ hội..." : "Chưa có giá trị cơ hội."}</Empty>}</Panel>
    </div>
    <div className="grid gap-3 lg:grid-cols-2">
      <Panel title="Cơ hội mới theo tháng">{insights?.monthly.length ? <><div role="img" aria-label="Cơ hội CRM mới theo tháng" className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={insights.monthly} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}><CartesianGrid stroke="var(--color-outline-variant)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip formatter={value => typeof value === "number" ? integer(value) : value} /><Bar dataKey="count" name="Cơ hội mới" fill="var(--finance-chart-blue)" maxBarSize={44} isAnimationActive={!reduceMotion} animationDuration={700} /></BarChart></ResponsiveContainer></div><p className="border-t border-outline-variant pt-3 text-xs text-on-surface-variant">30 ngày gần đây: <strong className="tabular-nums text-on-surface">{integer(insights.newLast30Days ?? 0)} cơ hội</strong></p></> : <Empty>{loading ? "Đang tải cơ hội..." : "Chưa có ngày tạo cơ hội để thống kê."}</Empty>}</Panel>
      <Panel title="Hiệu quả và nhu cầu CRM">{insights && leads?.length ? <><div className="grid grid-cols-2 gap-3 border-b border-outline-variant pb-4 text-xs"><div><p className="text-on-surface-variant">Tỷ lệ đã chốt</p><strong className="mt-1 block text-lg tabular-nums">{insights.winRate?.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%</strong></div><div><p className="text-on-surface-variant">Giá trị trung bình đã chốt</p><strong className="mt-1 block text-lg tabular-nums">{insights.averageWonValue == null ? "—" : money(insights.averageWonValue)}</strong></div></div>{insights.products.length ? <div className="mt-3 space-y-2">{insights.products.map(item => <div key={item.name} className="flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate text-on-surface-variant">{item.name}</span><strong className="shrink-0 tabular-nums">{integer(item.count)} cơ hội</strong></div>)}</div> : <p className="pt-4 text-xs text-on-surface-variant">Chưa có sản phẩm quan tâm được ghi trên cơ hội.</p>}</> : <Empty>{loading ? "Đang tải hiệu quả CRM..." : "Chưa có cơ hội CRM."}</Empty>}</Panel>
    </div>
    <div className="grid gap-3 lg:grid-cols-2">
      <Panel title="Hội thoại đa kênh">{connected.length ? <><div className="grid grid-cols-2 gap-3 border-b border-outline-variant pb-4 text-xs sm:grid-cols-3">{[["Tài khoản kết nối", connected.length], ["Hội thoại gần đây", inboxCount], ["Tin chưa đọc gần đây", unreadCount]].map(([label, value]) => <div key={label}><p className="text-on-surface-variant">{label}</p><strong className="mt-1 block text-lg tabular-nums">{typeof value === "number" ? integer(value) : "—"}</strong></div>)}</div><div className="mt-3 space-y-3">{(["Facebook", "Zalo", "TikTok"] as const).map(channel => ({ channel, count: connected.filter(account => account.platform === channel).length, conversations: inbox?.filter(row => row.channel === channel).reduce((sum, row) => sum + row.count, 0) })).filter(row => row.count > 0).map(row => <div key={row.channel} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 text-sm"><span>{row.channel}</span><span className="text-xs text-on-surface-variant">{row.count} tài khoản</span><strong className="tabular-nums">{row.conversations == null ? "—" : `${integer(row.conversations)} hội thoại`}</strong></div>)}</div></> : <Empty>{loading ? "Đang tải kênh..." : accounts ? "Chưa có tài khoản hội thoại được kết nối." : "Chưa có dữ liệu hội thoại."}</Empty>}</Panel>
      <Panel title="Kho tri thức và FAQ">{knowledge || faq ? <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-3">{[["Tài liệu", knowledge?.documentsCount], ["Đoạn tri thức", knowledge?.chunksCount], ["FAQ chờ duyệt", faq?.stats.pending], ["FAQ đã duyệt", faq?.stats.approved], ["Cảnh báo", knowledge?.warnings.length], ["Xung đột", knowledge?.conflicts?.length]].map(([label, value]) => <div key={label} className="border-b border-outline-variant pb-3"><p className="text-on-surface-variant">{label}</p><strong className="mt-1 block text-lg tabular-nums">{typeof value === "number" ? integer(value) : "—"}</strong></div>)}</div> : <Empty>{loading ? "Đang tải kho tri thức..." : "Chưa có dữ liệu kho tri thức."}</Empty>}</Panel>
    </div>
    <Panel title="Cơ hội cần theo dõi">{crm?.open ? <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead className="border-b border-outline-variant text-on-surface-variant"><tr><th className="pb-2 font-medium">Khách hàng</th><th className="pb-2 font-medium">Trạng thái</th><th className="pb-2 text-right font-medium">Giá trị</th><th className="pb-2 text-right font-medium">Cập nhật</th></tr></thead><tbody>{[...leads!].filter(lead => lead.status !== "won").sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()).slice(0, 8).map(lead => <tr key={lead.id} className="border-b border-outline-variant last:border-0"><td className="py-2.5 font-medium">{lead.customerName || "Khách hàng"}</td><td className="py-2.5">{labels[lead.status]}</td><td className="py-2.5 text-right tabular-nums">{money(Number(lead.value) || 0)}</td><td className="py-2.5 text-right text-on-surface-variant">{lead.updatedAt || lead.createdAt ? new Date(lead.updatedAt || lead.createdAt!).toLocaleDateString("vi-VN") : "—"}</td></tr>)}</tbody></table></div> : <Empty>{loading ? "Đang tải cơ hội..." : "Không có cơ hội cần theo dõi."}</Empty>}</Panel>
  </div>;
}

