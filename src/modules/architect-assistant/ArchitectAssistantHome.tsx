import { motion } from "motion/react";
import { FolderOpen } from "lucide-react";
import type { ArchitectureToolId } from "../../shared/architecture-assistant";
import ArchitectAssistantIcon from "./ArchitectAssistantIcon";

const logo = "https://res.cloudinary.com/dfbk14k5w/image/upload/v1783992125/igen_assets/brand-icon.png";

const tools: Array<{ title: string; description: string; image: string; icon: string; slug: string; tool: ArchitectureToolId }> = [
  {
    title: "RENDERING",
    description: "Render nội/ngoại thất, cảnh quan, quy hoạch, floorplan, VR 360 với độ phân giải siêu thực.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBt7X0xsFG_TUqw5NaHGX-WPzlGP-zLW40rlzsiFf-dLdNlYb2nEn_XnO-QtL4lteoAC9hi10RI_zF9LPqTc7zdyXVCj2SproTb5Fsoei_wM-k-2deKjmmV3gPM6amPBMt11N4CuuNsi6gMV6UCCDP0hdmox_KYIxkJftC8S4zZ2FEpe69HtVnpHIhScvP2T-w_1XrkJ9G1Uob657Lbz4YcUs_o2rW1qnGI_G6cXxrCFjKovGjmItOgOcB5ifniY-cIPWTxq6rcwEy6",
    icon: "architecture",
    slug: "/tools/rendering",
    tool: "render",
  },
  {
    title: "VẼ BẢN VẼ AI",
    description: "Tự động phân chia mặt bằng phòng bằng AI, vẽ sơ đồ thiết kế 2D/3D chi tiết và xuất bản vẽ chất lượng cao.",
    image: "https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=800&q=80",
    icon: "layers",
    slug: "/tools/floor-plan",
    tool: "plan",
  },
  {
    title: "VIDEO",
    description: "Tạo kịch bản, video và thêm nhân vật vào phim kiến trúc, nội thất chuyên nghiệp.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBT9Y72EEVknotPzqvRmEfxhlqhQpn3oOsdUTR8AajP6R9KDiOOqgKYvjTgeAK4mfKc1FNa2OlFSeziL1CU-8xkPLHAY5sKNmM9jh2LB2lEMm9vN_J1dJX17qAD69KVVUPoAjYLOPVtZrcnPyHxUMXaWWciP7kLvRWIo_jMgla1wLJnSPBRffJ9XM29j_TzM3SpATXg2Z3ZGbaDjvEoWaShHCHKAhObVuuLZe9YYlsrUb5eu258Dh1OhWfEI-2ZIIi0B9b_SRgeBulC",
    icon: "movie_filter",
    slug: "/tools/video",
    tool: "video",
  },
  {
    title: "VISUAL",
    description: "Tạo mood lighting bám theo ảnh tham chiếu hoặc tối ưu hóa ánh sáng tự nhiên.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBrT07lYimACAEVMSvapV0UpOWNEBw7TI19qo19SJuIKIIoXtkeTipS04uVjNC8VwnYJlfu_NRHNZ88Lf3-oDMNpfnjjYXw_36lHk5aIBco46ic7NJb3l6XS93ZJq8nPuinVF3Ug7LTt5GOUHUZslVNwcxDotRSFtTi0ENQ5SBiWrWvVmiznaM4qimW3-T7qKMlcB20fZgFSVf4Z62WMjh6x9hnJdBXBQsvdFq75c7EEXAJvPdybUMv5V6GoROGPcEe6I3JqpEYcPCJ",
    icon: "light_mode",
    slug: "/tools/visual",
    tool: "visual",
  },
  {
    title: "TEXTURELAB",
    description: "Tạo PBR texture từ ảnh gốc, xử lý seamless cho các vật liệu kiến trúc đặc thù.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuC4TN4X5VCS0FsV__xWqobihbnj2pxRo_34fYf66-0f0DiFv6DNaYtlK6cncpu_U7rtSlh6fMqUEi2WvGV2gvmxW1D0H9WqwtX0g6Rf0M2q1OzGgA2hzx-cWZIeBZekYOZDq5YPD1RKn14sxd9AT5lORPOFm6jjvkCVJzen8gWk_pcrLmkwRY6bLFc64jVUnLTtk85e-4eKoyZ5oEBcgSy6uen73TXvN3YtQrBwupSP1qbzCbZtRbveD8RV2iZeb9cVPAKH7g588dJz",
    icon: "texture",
    slug: "/tools/texture-lab",
    tool: "texture",
  },
  {
    title: "HUMAN ENHANCER",
    description: "Cải thiện người trong ảnh render và thêm người vào cảnh với tỷ lệ chính xác.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAWZc-UM04oX9_EJW7kRooleJyFtrWWtwaD1EGY-culjX8xj3Advrw9nUetH0v1uk1YDApcs6qLIiFbtpLdawYb8I7UsxqCBQ7EFLFhdGSw_5Ep7OgHGG6n-cusTAEm-LQlZia1p4KeWn0nXri5jxPfrk2BRf3BfqGO4qph7EnEsMs6vXlojcWt1yAfT-z-rwNpVqswdjWBRDUu39jzIohwrjLQGKdz152Eoxh0PjfIsYwRsvN2vYXMgpIO9qbUSxmdhCEESNUSGfYD",
    icon: "groups",
    slug: "/tools/human-enhancer",
    tool: "human",
  },
  {
    title: "VIRTUAL STAGING",
    description: "Bố trí nội thất vào phòng theo vị trí, phong cách và moodboard thiết kế.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuD9v5ApkYjTvNM3s20AAy_bjY8REe_ZTJ9vhka_sdsax96ToGzJsYwSTMdGs7pcgK1wgnh97g-6AJH_GTztS1pZ9bNWkuC5LgoKmO9gLO06X48eyDpL7Ui7UhxuVW0VSCQTw4P9YUf-3wHgPJLiJ33BWnK5EoSfYc69NXvGeSLuCipewqzjNunoyMiMiCSSuOOHyXG2BY10CEO3s2IUl-7zq_SZjW7x3BECf3oV93AC0xEYqprwKttWVn4Y1mBJsgT4EslE7P6ZdQKl",
    icon: "chair",
    slug: "/tools/virtual-staging",
    tool: "staging",
  },
];

export default function ArchitectAssistantHome({
  onOpenTool,
  onOpenProjects,
}: {
  onOpenTool: (tool: ArchitectureToolId) => void;
  onOpenProjects: () => void;
}) {
  return <div className="architect-assistant-source min-h-full overflow-auto bg-surface">
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-white/40 bg-white/60 px-4 py-3 shadow-sm shadow-slate-900/5 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <img src={logo} alt="iGen" className="h-10 shrink-0 object-contain sm:h-12" referrerPolicy="no-referrer" />
        <span className="truncate text-sm font-semibold text-on-surface">- Trợ lý AI cho Kiến trúc sư</span>
      </div>
      <button type="button" onClick={onOpenProjects} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-4 text-sm font-medium text-on-surface shadow-sm hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary">
        <FolderOpen className="size-4 text-primary" aria-hidden="true" />
        <span className="hidden sm:inline">Dự án kiến trúc</span>
        <span className="sm:hidden">Dự án</span>
      </button>
    </header>

    <main className="mx-auto w-full max-w-[1600px] p-8">
      <div className="mb-12" />
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
        {tools.map((tool, index) => <motion.button
          key={tool.slug}
          type="button"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.2), ease: "easeOut" }}
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => onOpenTool(tool.tool)}
          className="group overflow-hidden rounded-xl bg-surface-container-lowest text-left shadow-sm transition-shadow hover:shadow-xl focus-visible:outline-2 focus-visible:outline-primary"
          aria-label={`Mở ${tool.title}`}
        >
          <div className="relative h-[240px] overflow-hidden">
            <img className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105" src={tool.image} alt="" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <div className="absolute left-6 top-6 flex size-12 items-center justify-center rounded-2xl border border-white/30 bg-white/20 text-white backdrop-blur-xl">
              <ArchitectAssistantIcon name={tool.icon} className="text-2xl" />
            </div>
          </div>
          <div className="p-8">
            <span className="mb-3 inline-block rounded-md bg-primary/10 px-2.5 py-1 font-mono text-[11px] font-medium text-primary">{tool.slug}</span>
            <h2 className="mb-3 text-xl font-semibold text-on-surface"><span className="font-bold text-primary">iGen</span> {tool.title}</h2>
            <p className="mb-6 h-12 overflow-hidden text-pretty text-sm leading-relaxed text-on-surface-variant">{tool.description}</p>
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase text-primary transition-[gap] group-hover:gap-3">
              Sử dụng tính năng <ArchitectAssistantIcon name="arrow_forward" className="text-sm" />
            </span>
          </div>
        </motion.button>)}
      </div>
    </main>
  </div>;
}
