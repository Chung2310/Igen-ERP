import { useState } from "react";
import { cn } from "../../modules/student-management/lib/utils";
import "./AssistantRainbowBorder.css";
import { AssistantToolArtwork } from "./AssistantToolArtwork";
import { AssistantExcelExplainer } from "./AssistantExcelExplainer";

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" focusable="false" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>;
}

function FavoriteIcon({ filled }: { filled: boolean }) {
  return <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="size-4"><path d="M12 20.5 4.6 13.2C1.2 9.9 3.4 4 8 4c1.8 0 3.2.8 4 2.1C12.8 4.8 14.2 4 16 4c4.6 0 6.8 5.9 3.4 9.2L12 20.5Z" /></svg>;
}

export type AssistantTool = {
  id: string;
  category: string;
  title: string;
  description: string;
};

export const assistantTools: AssistantTool[] = [
  { id: "explain-excel", category: "Kinh doanh", title: "Giải thích công thức Excel", description: "Giải thích chi tiết thành phần, ý nghĩa và cách sử dụng của công thức Excel bất kỳ." },
  { id: "business-plan", category: "Kinh doanh", title: "Lập kế hoạch kinh doanh", description: "Hỗ trợ lập kế hoạch giúp định hướng chiến lược kinh doanh đạt kết quả tối ưu." },
  { id: "customer-persona", category: "Kinh doanh", title: "Nghiên cứu chân dung khách hàng", description: "Hỗ trợ xác định đặc điểm, nhu cầu và hành vi khách hàng." },
  { id: "survey-analysis", category: "Kinh doanh", title: "Phân tích dữ liệu khảo sát, review, feedback khách hàng", description: "Tổng hợp và phân tích phản hồi để rút ra xu hướng, vấn đề và cơ hội cải thiện." },
  { id: "sales-email", category: "Kinh doanh", title: "Soạn email bán hàng", description: "Soạn email giới thiệu sản phẩm, dịch vụ hoặc thúc đẩy mua hàng." },
  { id: "report-email", category: "Kinh doanh", title: "Soạn email báo cáo", description: "Soạn email báo cáo cô đọng, chuyên nghiệp và dễ nắm bắt." },
  { id: "customer-care-email", category: "Kinh doanh", title: "Soạn email chăm sóc khách hàng", description: "Soạn email thể hiện sự quan tâm và duy trì mối quan hệ với khách hàng." },
  { id: "task-email", category: "Kinh doanh", title: "Soạn email giao việc", description: "Soạn email giao việc rõ ràng để người nhận dễ nắm bắt thông tin." },
  { id: "marketing-email", category: "Marketing", title: "Soạn email Marketing", description: "Soạn nội dung email phù hợp mục tiêu và đối tượng chiến dịch." },
  { id: "campaign-ideas", category: "Marketing", title: "Lên ý tưởng chiến dịch", description: "Phác thảo thông điệp, kênh triển khai và ý tưởng nội dung." },
  { id: "budget-summary", category: "Tài chính", title: "Tóm tắt ngân sách", description: "Trình bày các khoản thu chi và điểm cần theo dõi." },
  { id: "job-description", category: "Nhân sự", title: "Soạn mô tả công việc", description: "Phác thảo nhiệm vụ, yêu cầu và quyền lợi cho vị trí tuyển dụng." },
  { id: "meeting-summary", category: "Văn phòng", title: "Tóm tắt cuộc họp", description: "Sắp xếp nội dung thảo luận và các việc cần làm sau cuộc họp." },
  { id: "strategy-outline", category: "Chiến lược", title: "Phác thảo chiến lược", description: "Sắp xếp mục tiêu, ưu tiên và các bước thực hiện." },
  { id: "technical-brief", category: "CNTT", title: "Viết yêu cầu kỹ thuật", description: "Tóm tắt bối cảnh, nhu cầu và tiêu chí nghiệm thu." },
  { id: "health-info", category: "Y tế", title: "Tóm tắt tài liệu y tế", description: "Sắp xếp ý chính từ tài liệu để thuận tiện tham khảo." },
  { id: "lesson-outline", category: "Giáo dục", title: "Lập dàn ý bài học", description: "Sắp xếp mục tiêu, nội dung và hoạt động học tập." },
  { id: "official-email", category: "Hành chính công", title: "Soạn thư hành chính", description: "Phác thảo nội dung thư theo giọng điệu trang trọng, rõ ràng." },
];

const categories = ["Tất cả", "Kinh doanh", "Marketing", "Tài chính", "Nhân sự", "Văn phòng", "Chiến lược", "CNTT", "Y tế", "Giáo dục", "Hành chính công"];
const focusClass = "focus-visible:outline-none focus-visible:border-primary";

export function AssistantTools({ branchId = "" }: { branchId?: string }) {
  const [category, setCategory] = useState("Tất cả");
  const [tab, setTab] = useState<"all" | "favorites">("all");
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase("vi-VN");
  const visibleTools = assistantTools.filter(tool =>
    (category === "Tất cả" || tool.category === category) &&
    (tab === "all" || favorites.includes(tool.id)) &&
    (!normalizedQuery || `${tool.title} ${tool.description} ${tool.category}`.toLocaleLowerCase("vi-VN").includes(normalizedQuery))
  );
  const groupedTools = categories.slice(1).map(name => ({ name, tools: visibleTools.filter(tool => tool.category === name) })).filter(group => group.tools.length);

  if (selectedId === "explain-excel") return <AssistantExcelExplainer branchId={branchId} onBack={() => setSelectedId(null)} />;

  return <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-container-lowest text-on-surface">
    <header className="flex flex-col gap-4 border-b border-outline-variant px-4 py-5 sm:px-6 lg:flex-row lg:items-start lg:justify-between lg:px-8">
      <div>
        <h3 className="text-balance text-lg font-semibold">Công cụ</h3>
        <p className="mt-1 text-pretty text-sm text-on-surface-variant">Chọn công cụ phù hợp để bắt đầu công việc của bạn</p>
      </div>
      <label className="relative block w-full shrink-0 lg:w-72 xl:w-80">
        <span className="sr-only">Tìm kiếm công cụ</span>
        <SearchIcon />
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm kiếm" className={cn("h-10 w-full rounded-lg border border-outline-variant bg-surface-container-lowest pl-10 pr-3 text-sm placeholder:text-on-surface-variant focus:border-primary focus:outline-none", focusClass)} />
      </label>
    </header>
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <nav aria-label="Danh mục công cụ" className="flex shrink-0 gap-1 overflow-x-auto border-b border-outline-variant px-4 py-3 md:w-44 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r md:px-3 lg:w-52">
        {categories.map(name => <button key={name} type="button" aria-current={category === name ? "page" : undefined} onClick={() => { setCategory(name); setSelectedId(null); }} className={cn("shrink-0 rounded-none border-l border-transparent px-3 py-2 text-left text-sm hover:bg-surface-container-low md:w-full", category === name && "border-primary bg-primary/10 font-medium text-primary", focusClass)}>{name}</button>)}
      </nav>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 lg:px-8">
        <div role="group" aria-label="Lọc công cụ" className="mb-6 flex gap-2">
          <button type="button" aria-pressed={tab === "all"} onClick={() => { setTab("all"); setSelectedId(null); }} className={cn("rounded-full border border-outline-variant px-4 py-2 text-sm hover:bg-surface-container-low", tab === "all" && "border-primary bg-primary/10 font-medium text-primary", focusClass)}>Tất cả</button>
          <button type="button" aria-pressed={tab === "favorites"} onClick={() => { setTab("favorites"); setSelectedId(null); }} className={cn("rounded-full border border-outline-variant px-4 py-2 text-sm hover:bg-surface-container-low", tab === "favorites" && "border-primary bg-primary/10 font-medium text-primary", focusClass)}>Yêu thích</button>
        </div>
        {groupedTools.length ? groupedTools.map(group => <section key={group.name} aria-label={group.name} className="mb-7">
          <h4 className="mb-3 text-balance text-base font-semibold">{group.name}</h4>
          <div className="grid gap-3 xl:grid-cols-2">
            {group.tools.map(tool => <article key={tool.id} className={cn("assistant-rainbow-hover-card flex min-w-0 flex-wrap items-start gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4", selectedId === tool.id && "border-primary")}>
              <AssistantToolArtwork id={tool.id} />
              <button type="button" onClick={() => setSelectedId(tool.id)} aria-pressed={selectedId === tool.id} className={cn("min-w-0 flex-1 rounded-sm text-left", focusClass)}>
                <span className="block text-sm font-medium leading-5">{tool.title}</span>
                <span className="mt-1 block text-pretty text-xs leading-5 text-on-surface-variant">{tool.description}</span>
              </button>
              <button type="button" aria-label={`${favorites.includes(tool.id) ? "Bỏ yêu thích" : "Thêm vào yêu thích"}: ${tool.title}`} aria-pressed={favorites.includes(tool.id)} onClick={() => setFavorites(current => current.includes(tool.id) ? current.filter(id => id !== tool.id) : [...current, tool.id])} className={cn("shrink-0 rounded-md border border-transparent p-1 text-on-surface-variant hover:text-on-surface", focusClass)}><FavoriteIcon filled={favorites.includes(tool.id)} /></button>
              {selectedId === tool.id && <div className="w-full border-t border-outline-variant pt-3">
                <p className="text-pretty text-xs text-on-surface-variant">Công cụ đang chờ kết nối để sử dụng.</p>
              </div>}
            </article>)}
          </div>
        </section>) : <div className="rounded-xl border border-outline-variant p-6 text-center">
          <p className="text-pretty text-sm text-on-surface-variant">{tab === "favorites" && favorites.length === 0 ? "Chưa có công cụ yêu thích." : "Không tìm thấy công cụ phù hợp."}</p>
          <button type="button" onClick={() => { setCategory("Tất cả"); setTab("all"); setQuery(""); }} className={cn("mt-3 rounded-lg border border-outline-variant px-3 py-2 text-sm hover:bg-surface-container-low", focusClass)}>Xem tất cả công cụ</button>
        </div>}
      </div>
    </div>
  </div>;
}
