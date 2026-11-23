import { ArrowRight, Clock3 } from "lucide-react";
import { HrPageTitle } from "../../components/hr/HrPageTitle";
import { AVAILABLE_ARCHITECTURE_TOOLS, type ArchitectureToolId } from "../../shared/architecture-assistant";
import ArchitectAssistantIcon from "./ArchitectAssistantIcon";

const tools: Array<{ title: string; description: string; image: string; icon: string; slug: string; tool: ArchitectureToolId }> = [
  {
    title: "Rendering",
    description: "Phối cảnh nội/ngoại thất, floorplan, masterplan và VR 360°.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBt7X0xsFG_TUqw5NaHGX-WPzlGP-zLW40rlzsiFf-dLdNlYb2nEn_XnO-QtL4lteoAC9hi10RI_zF9LPqTc7zdyXVCj2SproTb5Fsoei_wM-k-2deKjmmV3gPM6amPBMt11N4CuuNsi6gMV6UCCDP0hdmox_KYIxkJftC8S4zZ2FEpe69HtVnpHIhScvP2T-w_1XrkJ9G1Uob657Lbz4YcUs_o2rW1qnGI_G6cXxrCFjKovGjmItOgOcB5ifniY-cIPWTxq6rcwEy6",
    icon: "architecture",
    slug: "/tools/rendering",
    tool: "render",
  },
  {
    title: "Vẽ bản vẽ AI",
    description: "Phân chia mặt bằng 2D/3D tự động và xuất bản vẽ nhanh.",
    image: "https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=800&q=80",
    icon: "layers",
    slug: "/tools/floor-plan",
    tool: "plan",
  },
  {
    title: "Video kiến trúc",
    description: "Tạo video chuyển động camera từ ảnh phối cảnh hoặc kịch bản.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBT9Y72EEVknotPzqvRmEfxhlqhQpn3oOsdUTR8AajP6R9KDiOOqgKYvjTgeAK4mfKc1FNa2OlFSeziL1CU-8xkPLHAY5sKNmM9jh2LB2lEMm9vN_J1dJX17qAD69KVVUPoAjYLOPVtZrcnPyHxUMXaWWciP7kLvRWIo_jMgla1wLJnSPBRffJ9XM29j_TzM3SpATXg2Z3ZGbaDjvEoWaShHCHKAhObVuuLZe9YYlsrUb5eu258Dh1OhWfEI-2ZIIi0B9b_SRgeBulC",
    icon: "movie_filter",
    slug: "/tools/video",
    tool: "video",
  },
  {
    title: "Visual & Ánh sáng",
    description: "Tạo mood ánh sáng theo ảnh mẫu và bối cảnh thời gian.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBrT07lYimACAEVMSvapV0UpOWNEBw7TI19qo19SJuIKIIoXtkeTipS04uVjNC8VwnYJlfu_NRHNZ88Lf3-oDMNpfnjjYXw_36lHk5aIBco46ic7NJb3l6XS93ZJq8nPuinVF3Ug7LTt5GOUHUZslVNwcxDotRSFtTi0ENQ5SBiWrWvVmiznaM4qimW3-T7qKMlcB20fZgFSVf4Z62WMjh6x9hnJdBXBQsvdFq75c7EEXAJvPdybUMv5V6GoROGPcEe6I3JqpEYcPCJ",
    icon: "light_mode",
    slug: "/tools/visual",
    tool: "visual",
  },
  {
    title: "Texture Lab",
    description: "Tạo bản đồ vật liệu PBR và xử lý lặp liền mạch seamless.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuC4TN4X5VCS0FsV__xWqobihbnj2pxRo_34fYf66-0f0DiFv6DNaYtlK6cncpu_U7rtSlh6fMqUEi2WvGV2gvmxW1D0H9WqwtX0g6Rf0M2q1OzGgA2hzx-cWZIeBZekYOZDq5YPD1RKn14sxd9AT5lORPOFm6jjvkCVJzen8gWk_pcrLmkwRY6bLFc64jVUnLTtk85e-4eKoyZ5oEBcgSy6uen73TXvN3YtQrBwupSP1qbzCbZtRbveD8RV2iZeb9cVPAKH7g588dJz",
    icon: "texture",
    slug: "/tools/texture-lab",
    tool: "texture",
  },
  {
    title: "Human Enhancer",
    description: "Thêm và tối ưu nhân vật vào phối cảnh đúng tỷ lệ ánh sáng.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAWZc-UM04oX9_EJW7kRooleJyFtrWWtwaD1EGY-culjX8xj3Advrw9nUetH0v1uk1YDApcs6qLIiFbtpLdawYb8I7UsxqCBQ7EFLFhdGSw_5Ep7OgHGG6n-cusTAEm-LQlZia1p4KeWn0nXri5jxPfrk2BRf3BfqGO4qph7EnEsMs6vXlojcWt1yAfT-z-rwNpVqswdjWBRDUu39jzIohwrjLQGKdz152Eoxh0PjfIsYwRsvN2vYXMgpIO9qbUSxmdhCEESNUSGfYD",
    icon: "groups",
    slug: "/tools/human-enhancer",
    tool: "human",
  },
  {
    title: "Virtual Staging",
    description: "Bố trí nội thất vào phòng trống theo phong cách thiết kế.",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuD9v5ApkYjTvNM3s20AAy_bjY8REe_ZTJ9vhka_sdsax96ToGzJsYwSTMdGs7pcgK1wgnh97g-6AJH_GTztS1pZ9bNWkuC5LgoKmO9gLO06X48eyDpL7Ui7UhxuVW0VSCQTw4P9YUf-3wHgPJLiJ33BWnK5EoSfYc69NXvGeSLuCipewqzjNunoyMiMiCSSuOOHyXG2BY10CEO3s2IUl-7zq_SZjW7x3BECf3oV93AC0xEYqprwKttWVn4Y1mBJsgT4EslE7P6ZdQKl",
    icon: "chair",
    slug: "/tools/virtual-staging",
    tool: "staging",
  },
];

export default function ArchitectAssistantHome({
  onOpenTool,
}: {
  onOpenTool: (tool: ArchitectureToolId) => void;
}) {
  return (
    <div className="architect-assistant-source min-h-full overflow-auto bg-surface">
      <main className="mx-auto w-full max-w-[1600px] space-y-4 p-4 sm:p-5">
        <HrPageTitle level={2}>Trợ lý kiến trúc</HrPageTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {tools.map(tool => {
            const available = AVAILABLE_ARCHITECTURE_TOOLS.has(tool.tool);
            return (
              <button
                key={tool.slug}
                type="button"
                onClick={() => onOpenTool(tool.tool)}
                disabled={!available}
                className={
                  available
                    ? "group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest text-left shadow-2xs transition-colors hover:border-primary/50 hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary"
                    : "flex cursor-not-allowed flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest text-left opacity-75"
                }
                aria-label={available ? `Mở ${tool.title}` : `${tool.title}, đang phát triển`}
              >
                <div className="relative h-36 w-full overflow-hidden">
                  <img
                    className={available ? "size-full object-cover transition-transform duration-200 ease-out group-hover:scale-105" : "size-full object-cover"}
                    src={tool.image}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                  {!available && (
                    <span aria-hidden="true" className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-tertiary-container px-2.5 py-1 text-[11px] font-semibold text-on-tertiary-container">
                      <Clock3 className="size-3" />
                      Đang phát triển
                    </span>
                  )}
                  <div className="absolute left-3 top-3 flex size-9 items-center justify-center rounded-lg border border-white/25 bg-black/35 text-white backdrop-blur-md">
                    <ArchitectAssistantIcon name={tool.icon} className="text-lg" />
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="text-balance text-sm font-semibold text-on-surface">{tool.title}</h3>
                  <p className="mt-1 line-clamp-2 flex-1 text-pretty text-xs leading-relaxed text-on-surface-variant">{tool.description}</p>
                  {available && (
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      Mở công cụ
                      <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
