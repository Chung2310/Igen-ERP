import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  BrainCircuit,
  CheckCircle,
  Clock,
  DollarSign,
  Filter,
  Lightbulb,
  Megaphone,
  MoreVertical,
  PackageCheck,
  Rocket,
  Sparkles,
  ThumbsUp,
  Users,
} from "lucide-react";

type DashboardView = "overview" | "revenue" | "ai";
type Tone = "blue" | "amber" | "slate" | "indigo";

const tabs: Array<{ id: DashboardView; label: string }> = [
  { id: "overview", label: "Tổng quan" },
  { id: "revenue", label: "Phân tích doanh thu" },
  { id: "ai", label: "Hiệu suất AI" },
];

const toneClass: Record<Tone, { soft: string; text: string; fill: string; strong: string }> = {
  blue: { soft: "bg-blue-50", text: "text-blue-600", fill: "bg-blue-500", strong: "text-blue-700" },
  amber: { soft: "bg-amber-50", text: "text-amber-600", fill: "bg-amber-500", strong: "text-amber-700" },
  slate: { soft: "bg-slate-100", text: "text-slate-600", fill: "bg-slate-600", strong: "text-slate-700" },
  indigo: { soft: "bg-indigo-50", text: "text-indigo-600", fill: "bg-indigo-500", strong: "text-indigo-700" },
};

const aiInsights = [
  {
    icon: AlertTriangle,
    title: "Canh bao het hang",
    body: "Dua tren xu huong ban hang, MacBook Pro M3 co kha nang het hang trong 3 ngay toi tai Kho Tan Binh.",
    action: "Tao don nhap kho ngay",
    color: "red",
  },
  {
    icon: ArrowUpRight,
    title: "Co hoi Cross-sell",
    body: "Phat hien cum 45 khach hang mua CRM gan day chua dung goi Marketing. Kha nang chuyen doi du doan 24%.",
    action: "Tao chien dich email",
    color: "blue",
  },
  {
    icon: BrainCircuit,
    title: "Toi uu nguon luc",
    body: "Team Sales dang qua tai. Co 3 nhan su Team Support phu hop co the dieu chuyen tam thoi.",
    action: "Xem de xuat",
    color: "amber",
  },
];

export default function DashboardTab() {
  const [activeView, setActiveView] = useState<DashboardView>("overview");

  return (
    <div className="mx-auto max-h-[85vh] max-w-7xl overflow-y-auto pr-2 text-left" id="dashboard_tab_view">
      <div className="mb-8 flex flex-col gap-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-sans text-3xl font-bold tracking-tight text-gray-800">
              {activeView === "ai" ? "Hiệu suất AI" : activeView === "revenue" ? "Phân tích doanh thu" : "Tổng quan Doanh nghiệp"}
            </h2>
            <p className="mt-2 text-sm text-gray-600">Hôm nay, Thứ Năm, 24 Tháng Mười</p>
          </div>
          <div className="flex w-fit items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
            <CheckCircle className="h-4 w-4" />
            <span>Hệ thống hoạt động bình thường</span>
          </div>
        </div>

        <div className="flex gap-6 border-b border-gray-200">
          {tabs.filter((tab) => tab.id !== "ai").map((tab) => {
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={`border-b-2 px-0 pb-2 text-sm font-semibold transition-colors ${
                  isActive ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeView === "overview" && <OverviewPanel />}
      {activeView === "revenue" && <RevenuePanel />}
    </div>
  );
}

function OverviewPanel() {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <ModuleCard icon={Users} tone="amber" title="Nhan su" value="245" label="Nhan vien hien tai" footer="Do hai long" footerValue="92%" progress={92} />
          <ModuleCard icon={PackageCheck} tone="blue" title="3 Canh bao" value="12,450" label="Tong san pham" footer="Don cho xuat" footerValue="42 Don" progress={78} alert />
          <ModuleCard icon={Megaphone} tone="slate" title="Marketing" value="128" label="Noi dung AI tao" footer="Ti le duyet" footerValue="85%" progress={85} />
          <SalesCard />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <LineChartCard />
          <DonutCard />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xs">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">Canh bao ton kho</h3>
              <button className="text-xs font-semibold text-blue-700">Xem tat ca</button>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-2xl">💻</div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-800">iPhone 15 Pro Max</p>
                <p className="text-xs text-gray-500">Kho Quan 7</p>
              </div>
              <div className="font-mono text-2xl font-bold text-red-600">12</div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xs">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">Noi dung cho duyet</h3>
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">3 Yeu cau</span>
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-gray-200 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <ThumbsUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">Campaign FB: Mua He</p>
                <button className="mt-2 rounded-md bg-blue-500 px-3 py-1 text-xs font-semibold text-white">Duyet</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <aside className="rounded-3xl border border-blue-100 bg-blue-50/70 p-6 shadow-xs">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-700 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-gray-800">AI De Xuat</h3>
        </div>
        <div className="space-y-4">
          {aiInsights.map((item) => (
            <AiInsightCard key={item.title} {...item} />
          ))}
        </div>
      </aside>
    </div>
  );
}

function RevenuePanel() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={DollarSign} label="Tong doanh thu" value="d2.4B" delta="+12.5%" />
        <MetricCard icon={Rocket} label="Toc do tang truong" value="18.4%" delta="+5.2%" tone="amber" />
        <MetricCard icon={PackageCheck} label="Gia tri DH trung binh" value="d450K" delta="-1.2%" negative />
        <MetricCard icon={Filter} label="Ti le chuyen doi" value="3.8%" delta="+2.1%" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xs">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-800">Xu huong doanh thu</h3>
              <p className="mt-2 text-sm text-gray-500">So sanh voi cung ky nam truoc</p>
            </div>
            <MoreVertical className="h-5 w-5 text-gray-500" />
          </div>
          <BarChart />
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xs">
          <div className="mb-8 flex items-start justify-between">
            <h3 className="text-2xl font-bold text-gray-800">Co cau nguon</h3>
            <MoreVertical className="h-5 w-5 text-gray-500" />
          </div>
          <DonutCard compact />
        </div>
      </div>
    </div>
  );
}

function AiPanel() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Bot} label="Tac vu xu ly" value="12,450" delta="+15%" />
        <MetricCard icon={Clock} label="Thoi gian tiet kiem" value="840h" delta="+8%" tone="amber" />
        <MetricCard icon={BrainCircuit} label="Do chinh xac" value="98.2%" delta="Trung binh" />
        <MetricCard icon={ThumbsUp} label="Hai long KH" value="4.9/5" delta="+0.2" tone="indigo" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
        <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xs">
          <h3 className="mb-6 text-2xl font-bold text-gray-800">Trang thai Agent AI</h3>
          <div className="space-y-4 border-t border-gray-100 pt-6">
            <AgentStatus icon={Bot} name="Sales Bot" status="Active" score="95" />
            <AgentStatus icon={Megaphone} name="Marketing Writer" status="Learning" score="88" tone="amber" />
            <AgentStatus icon={PackageCheck} name="Inventory Predictor" status="Idle" score="--" tone="indigo" />
          </div>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xs">
          <div className="mb-6 flex items-start justify-between gap-4">
            <h3 className="max-w-sm text-2xl font-bold text-gray-800">Khoi luong cong viec: AI vs Human</h3>
            <div className="flex gap-5 text-xs text-gray-600">
              <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-blue-500" />AI Output</span>
              <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-blue-100 ring-1 ring-blue-200" />Human Output</span>
            </div>
          </div>
          <WorkloadChart />
        </div>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-xs">
        <h3 className="mb-6 flex items-center gap-3 text-2xl font-bold text-gray-800">
          <Lightbulb className="h-6 w-6 text-blue-500" />
          Goi y toi uu tu AI
        </h3>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Recommendation title="Tac nghen Sales CRM" body="Sales Bot dang gap kho khan khi phan loai lead tu chien dich Mua He. Can cap nhat bo du lieu huan luyen." action="Cap nhat du lieu" danger />
          <Recommendation title="Co hoi tu dong hoa" body="Phat hien 120 email phan hoi khach hang co mau tuong tu. Co the thiet lap Auto-Reply Agent moi." action="Tao Agent Moi" />
        </div>
      </div>
    </div>
  );
}

function ModuleCard({ icon: Icon, tone, title, value, label, footer, footerValue, progress, alert }: any) {
  const color = toneClass[(tone as Tone) || "blue"];
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xs">
      <div className="mb-6 flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color.soft} ${color.text}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className={alert ? "rounded-full bg-red-600 px-3 py-1 text-sm font-semibold text-white" : "text-sm text-gray-500"}>{title}</span>
      </div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <span className="text-sm leading-6 text-gray-700">{label}</span>
        <span className="font-mono text-lg font-semibold text-gray-800">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-blue-100">
        <div className={`h-1.5 rounded-full ${color.fill}`} style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-4 flex justify-between text-sm">
        <span className="text-gray-500">{footer}</span>
        <span className={`font-semibold ${color.strong}`}>{footerValue}</span>
      </div>
    </div>
  );
}

function SalesCard() {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xs">
      <div className="mb-6 flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <DollarSign className="h-5 w-5" />
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-600">+14%</span>
      </div>
      <p className="font-mono text-xl font-bold text-gray-800">d12.4B</p>
      <div className="mt-6 flex justify-between border-t border-gray-100 pt-4 text-sm">
        <span className="text-gray-500">Leads moi</span>
        <span className="font-semibold text-blue-600">342</span>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, delta, tone = "blue", negative = false }: any) {
  const color = toneClass[(tone as Tone) || "blue"];
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-7 shadow-xs">
      <div className="mb-7 flex items-start justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${color.soft} ${color.text}`}>
          <Icon className="h-6 w-6" />
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${negative ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
          {delta}
        </span>
      </div>
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-3 font-mono text-4xl font-bold tracking-tight text-gray-800">{value}</p>
    </div>
  );
}

function LineChartCard() {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xs">
      <h3 className="mb-8 text-sm font-semibold uppercase tracking-widest text-gray-800">Doanh thu & Hieu suat AI</h3>
      <svg viewBox="0 0 420 260" className="h-72 w-full">
        <defs>
          <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {[40, 80, 120, 160, 200, 240].map((y) => <line key={y} x1="36" x2="400" y1={y} y2={y} stroke="#eaf0f8" />)}
        <path d="M48 220 L48 200 C82 150 88 150 118 180 C148 210 154 88 188 98 C230 102 220 38 260 56 C300 75 312 96 338 72 C374 40 376 12 394 10 L394 240 L48 240 Z" fill="url(#lineFill)" />
        <path d="M48 200 C82 150 88 150 118 180 C148 210 154 88 188 98 C230 102 220 38 260 56 C300 75 312 96 338 72 C374 40 376 12 394 10" fill="none" stroke="#06b6d4" strokeWidth="4" />
        {["T1", "T2", "T3", "T4", "T5", "T6", "T7"].map((m, i) => <text key={m} x={48 + i * 58} y="255" textAnchor="middle" fontSize="12" fill="#64748b">{m}</text>)}
      </svg>
    </div>
  );
}

function DonutCard({ compact = false }: { compact?: boolean }) {
  const radius = 66;
  const circumference = 2 * Math.PI * radius;
  const segments = [
    { label: "Direct Sales", value: 45, color: "#06b6c7", className: "bg-blue-500" },
    { label: "Referral", value: 25, color: "#e99a2c", className: "bg-amber-400" },
    { label: "Social Media", value: 15, color: "#9a5a00", className: "bg-amber-700" },
    { label: "Paid Ads", value: 15, color: "#dbeafe", className: "bg-blue-100" },
  ];
  let offset = 0;

  return (
    <div className={compact ? "" : "rounded-3xl border border-gray-100 bg-white p-6 shadow-xs"}>
      {!compact && <h3 className="mb-8 text-sm font-semibold uppercase tracking-widest text-gray-800">Hiệu suất kênh Marketing</h3>}
      <div className="grid items-center gap-7 md:grid-cols-[minmax(160px,224px)_minmax(0,1fr)]">
        <div className="relative mx-auto h-48 w-48 shrink-0 sm:h-56 sm:w-56">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 180 180" aria-label="Marketing channel performance">
            <circle cx="90" cy="90" r={radius} fill="none" stroke="#eef4ff" strokeWidth="28" />
            {segments.map((segment) => {
              const dash = (segment.value / 100) * circumference;
              const circle = (
                <circle
                  key={segment.label}
                  cx="90"
                  cy="90"
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="28"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += dash;
              return circle;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-sm text-gray-500">Tổng số</span>
            <strong className="font-mono text-3xl font-bold text-gray-800">100%</strong>
          </div>
        </div>
        <div className="min-w-0 space-y-4 text-sm">
          {segments.map((segment) => (
            <Legend key={segment.label} color={segment.className} label={segment.label} value={`${segment.value}%`} />
          ))}
        </div>
      </div>
    </div>
  );
}

function BarChart() {
  const bars = [34, 58, 42, 72, 63, 83];
  return (
    <div className="relative h-[420px]">
      <div className="absolute inset-x-0 bottom-12 top-0 flex flex-col justify-between text-xs text-gray-500">
        {["d3B", "d2B", "d1B", "d0"].map((y) => (
          <div key={y} className="flex items-center gap-3">
            <span className="w-8">{y}</span>
            <span className="h-px flex-1 border-t border-dashed border-blue-100" />
          </div>
        ))}
      </div>
      <div className="absolute bottom-0 left-12 right-4 top-10 flex items-end justify-between gap-3">
        {bars.map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-4">
            <div className={`w-full max-w-24 rounded-t-md ${i === 1 ? "bg-blue-500" : "bg-blue-100"}`} style={{ height: `${h}%` }} />
            <span className={`text-sm ${i === 1 ? "font-bold text-gray-800" : "text-gray-500"}`}>T{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkloadChart() {
  const ai = [56, 66, 78, 70, 82, 39, 31];
  const human = [39, 35, 44, 31, 48, 22, 18];
  return (
    <div className="relative h-[360px] border-t border-gray-100 pt-8">
      <div className="absolute left-0 top-12 flex h-64 flex-col justify-between text-xs text-gray-400">
        <span>10k</span><span>7.5k</span><span>5k</span><span>2.5k</span><span>0</span>
      </div>
      <div className="ml-12 flex h-72 items-end justify-between gap-5">
        {ai.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-3">
            <div className="flex h-64 items-end gap-3">
              <div className="w-7 rounded-t bg-blue-100 ring-1 ring-blue-200" style={{ height: `${human[i]}%` }} />
              <div className="w-7 rounded-t bg-blue-500" style={{ height: `${v}%` }} />
            </div>
            <span className="text-sm text-gray-600">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"][i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AiInsightCard({ icon: Icon, title, body, action, color }: any) {
  const border = color === "red" ? "border-l-red-600" : color === "amber" ? "border-l-amber-600" : "border-l-blue-500";
  const text = color === "red" ? "text-red-600" : color === "amber" ? "text-amber-700" : "text-blue-600";
  return (
    <div className={`rounded-2xl border border-gray-100 border-l-4 ${border} bg-white p-5`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 ${text}`} />
        <div>
          <h4 className="font-semibold text-gray-800">{title}</h4>
          <p className="mt-2 text-sm leading-6 text-gray-700">{body}</p>
          <button className="mt-3 text-sm font-semibold text-blue-700">{action}</button>
        </div>
      </div>
    </div>
  );
}

function AgentStatus({ icon: Icon, name, status, score, tone = "blue" }: any) {
  const color = toneClass[(tone as Tone) || "blue"];
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-200 p-4">
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${color.soft} ${color.text}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1">
        <p className="font-bold text-gray-800">{name}</p>
        <p className="text-sm text-gray-600"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${color.fill}`} />{status}</p>
      </div>
      <div className="text-right">
        <p className="font-mono text-2xl font-bold text-gray-800">{score}</p>
        <p className="text-xs text-gray-500">Diem hieu suat</p>
      </div>
    </div>
  );
}

function Recommendation({ title, body, action, danger = false }: any) {
  return (
    <div className="flex min-h-40 items-start gap-5 rounded-2xl border border-gray-200 bg-gray-50/40 p-6">
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${danger ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"}`}>
        {danger ? <AlertTriangle className="h-6 w-6" /> : <ArrowUpRight className="h-6 w-6" />}
      </div>
      <div className="flex flex-1 flex-col gap-5">
        <div>
          <h4 className="font-bold text-gray-800">{title}</h4>
          <p className="mt-2 text-sm leading-6 text-gray-600">{body}</p>
        </div>
        <button className={`self-end rounded-full px-6 py-2 text-sm font-semibold ${danger ? "bg-blue-500 text-white" : "border border-gray-300 text-gray-700"}`}>{action}</button>
      </div>
    </div>
  );
}

function Legend({ color, label, value }: any) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
      <span className="flex min-w-0 items-center gap-3 text-gray-800">
        <i className={`h-3.5 w-3.5 shrink-0 rounded-full ${color}`} />
        <span className="truncate">{label}</span>
      </span>
      <strong className="font-mono text-gray-800">{value}</strong>
    </div>
  );
}
