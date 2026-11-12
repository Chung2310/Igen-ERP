import { useState, type ChangeEvent, type FormEvent } from "react";
import { ChevronRight, Download, LoaderCircle, Plus, X } from "lucide-react";
import { cn } from "../../modules/student-management/lib/utils";
import { StyledSelect } from "./StyledSelect";
import { requestStudioImages, studioImageRatios, type StudioImageRequest, type StudioImageResponse } from "./assistantStudioImageApi";
import { getAssistantSpeechHistoryUserId } from "../../services/assistantSpeechHistory";
import { listAssistantStudioCreationHistory, saveAssistantStudioCreationHistory, type AssistantStudioCreationRecord } from "../../services/assistantStudioHistory";
import { AssistantStudioBreadcrumb } from "./AssistantStudioBreadcrumb";
import { AssistantStudioHistoryAction, AssistantStudioHistoryDrawer, AssistantStudioHistoryKindIcon } from "./AssistantStudioHistoryDrawer";

const fieldClass = "w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none";
const focusClass = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
const ratioDescriptions: Record<StudioImageRequest["aspectRatio"], string> = {
  "1:1": "Vuông",
  "16:9": "Ngang rộng",
  "9:16": "Dọc rộng",
  "4:3": "Ngang",
  "3:4": "Dọc",
  "3:2": "Ngang",
  "2:3": "Dọc",
};

interface StudioStyleSample {
  id: string;
  label: string;
  imageUrl: string;
  aspectRatio: StudioImageRequest["aspectRatio"];
  prompt: string;
}

const studioStyleSamples: StudioStyleSample[] = [
  {
    id: "poster",
    label: "Poster",
    imageUrl: "/style-image/Khám phá Đà Nẵng bên biển xanh-3.png",
    aspectRatio: "1:1",
    prompt: `Nội dung: [Mô tả chủ thể, nội dung chữ hoặc phần cần chỉnh. Có thể để trống.]

Tạo hoặc chỉnh sửa ngay một ảnh theo phong cách Poster. Nếu không có ảnh đính kèm, tạo mới từ phần Nội dung. Nếu có ảnh gốc, dùng chủ thể trong ảnh đó, giữ nét nhận diện của người, đặc điểm của sản phẩm và logo hoặc tên thương hiệu hiện có, trừ phần được yêu cầu thay đổi. Nếu ảnh được ghi rõ là ảnh mẫu phong cách, tham chiếu bảng màu, ánh sáng, chất liệu và bố cục từ ảnh mẫu, rồi áp dụng vào chủ thể được yêu cầu. Có thể tạo mới chỉ với ảnh mẫu phong cách. Khi thiếu chi tiết, tự chọn phương án phù hợp và thực hiện ngay.

Dùng nền giấy kem có vân in nhẹ, mảng hình học chéo màu cam rực và xanh cobalt. Đặt tiêu đề sans-serif đậm, rất lớn, tối đa hai dòng và chiếm phần chính của khung. Nếu có thời gian và địa điểm, đặt chữ nhỏ hơn ở góc dưới trái. Dùng hình chủ thể đơn sắc xanh cobalt kiểu ảnh in lưới ở góc dưới phải. Nếu để trống nội dung và không có ảnh, dùng tiêu đề “SẮC MÀU” và hình Tháp Rùa.

Ưu tiên yêu cầu cụ thể ở dòng Nội dung. Nếu ảnh có chữ cần giữ hoặc được yêu cầu thêm chữ, viết đúng nội dung, chính tả và dấu tiếng Việt. Trả trực tiếp đúng một ảnh vuông 1:1, ưu tiên 1254 × 1254 px nếu công cụ hỗ trợ, không ghép nhiều mẫu trong cùng khung.`,
  },
  {
    id: "cinema",
    label: "Điện ảnh",
    imageUrl: "/style-image/Hà Nội dưới mưa neon-7.png",
    aspectRatio: "1:1",
    prompt: `Nội dung: [Mô tả chủ thể, nội dung chữ hoặc phần cần chỉnh. Có thể để trống.]

Tạo hoặc chỉnh sửa ngay một ảnh theo phong cách Điện ảnh. Nếu không có ảnh đính kèm, tạo mới từ phần Nội dung. Nếu có ảnh gốc, dùng chủ thể trong ảnh đó, giữ nét nhận diện của người, đặc điểm của sản phẩm và logo hoặc tên thương hiệu hiện có, trừ phần được yêu cầu thay đổi. Nếu ảnh được ghi rõ là ảnh mẫu phong cách, tham chiếu bảng màu, ánh sáng, chất liệu và bố cục từ ảnh mẫu, rồi áp dụng vào chủ thể được yêu cầu. Có thể tạo mới chỉ với ảnh mẫu phong cách. Khi thiếu chi tiết, tự chọn phương án phù hợp và thực hiện ngay.

Tạo một khung hình phim chân thực, bố cục trung cảnh, chủ thể lệch trái và hậu cảnh có chiều sâu. Dùng xanh teal cho vùng tối, vàng hổ phách cho nguồn sáng có hướng, phản chiếu trên mặt đường ướt và hạt phim nhẹ. Giữ màu da tự nhiên. Nếu chưa có chủ thể hay bối cảnh, dùng cảnh một người cầm ô trong suốt quay đầu nhìn qua vai trên phố Hà Nội đêm mưa. Không tự thêm chữ.

Ưu tiên yêu cầu cụ thể ở dòng Nội dung. Nếu ảnh có chữ cần giữ hoặc được yêu cầu thêm chữ, viết đúng nội dung, chính tả và dấu tiếng Việt. Trả trực tiếp đúng một ảnh vuông 1:1, ưu tiên 1254 × 1254 px nếu công cụ hỗ trợ, không ghép nhiều mẫu trong cùng khung.`,
  },
  {
    id: "ad",
    label: "Quảng cáo",
    imageUrl: "/style-image/Lon nước chanh lấp lánh cao cấp-2.png",
    aspectRatio: "1:1",
    prompt: `Nội dung: [Mô tả chủ thể, nội dung chữ hoặc phần cần chỉnh. Có thể để trống.]

Tạo hoặc chỉnh sửa ngay một ảnh theo phong cách Quảng cáo. Nếu không có ảnh đính kèm, tạo mới từ phần Nội dung. Nếu có ảnh gốc, dùng chủ thể trong ảnh đó, giữ nét nhận diện của người, đặc điểm của sản phẩm và logo hoặc tên thương hiệu hiện có, trừ phần được yêu cầu thay đổi. Nếu ảnh được ghi rõ là ảnh mẫu phong cách, tham chiếu bảng màu, ánh sáng, chất liệu và bố cục từ ảnh mẫu, rồi áp dụng vào chủ thể được yêu cầu. Có thể tạo mới chỉ với ảnh mẫu phong cách. Khi thiếu chi tiết, tự chọn phương án phù hợp và thực hiện ngay.

Dựng ảnh quảng cáo sản phẩm kiểu studio. Đặt sản phẩm lớn ở giữa, nghiêng nhẹ, mặt trước và nhãn hướng về máy ảnh. Dùng nền chuyển sắc theo màu chủ đạo, ánh viền rõ, bóng đổ và phản xạ chân thực. Dùng đạo cụ gợi thành phần hoặc công dụng, tránh che nhãn. Nếu chưa có sản phẩm, dùng lon nước có ga xanh ngọc, lát chanh và tia nước đóng băng chuyển động. Không tự thêm slogan hoặc thay chữ trên nhãn.

Ưu tiên yêu cầu cụ thể ở dòng Nội dung. Nếu ảnh có chữ cần giữ hoặc được yêu cầu thêm chữ, viết đúng nội dung, chính tả và dấu tiếng Việt. Trả trực tiếp đúng một ảnh vuông 1:1, ưu tiên 1254 × 1254 px nếu công cụ hỗ trợ, không ghép nhiều mẫu trong cùng khung.`,
  },
  {
    id: "period",
    label: "Cổ trang",
    imageUrl: "/style-image/Thiếu nữ áo Nhật Bình ở Huế-1.png",
    aspectRatio: "1:1",
    prompt: `Nội dung: [Mô tả chủ thể, nội dung chữ hoặc phần cần chỉnh. Có thể để trống.]

Tạo hoặc chỉnh sửa ngay một ảnh theo phong cách Cổ trang. Nếu không có ảnh đính kèm, tạo mới từ phần Nội dung. Nếu có ảnh gốc, dùng chủ thể trong ảnh đó, giữ nét nhận diện của người, đặc điểm của sản phẩm và logo hoặc tên thương hiệu hiện có, trừ phần được yêu cầu thay đổi. Nếu ảnh được ghi rõ là ảnh mẫu phong cách, tham chiếu bảng màu, ánh sáng, chất liệu và bố cục từ ảnh mẫu, rồi áp dụng vào chủ thể được yêu cầu. Có thể tạo mới chỉ với ảnh mẫu phong cách. Khi thiếu chi tiết, tự chọn phương án phù hợp và thực hiện ngay.

Tạo chân dung cổ trang Việt Nam theo lối chụp ảnh chân thực. Mặc định dùng áo Nhật Bình thêu hoa văn và khăn vành, đặt nhân vật trong sân cung đình Huế với cột gỗ, mái ngói và đèn lồng vàng. Lấy khung từ thắt lưng trở lên, dáng đứng trang nhã, ánh sáng ấm, hậu cảnh mờ nhẹ. Thể hiện rõ chất vải và đường thêu. Không tự thêm chữ.

Ưu tiên yêu cầu cụ thể ở dòng Nội dung. Nếu ảnh có chữ cần giữ hoặc được yêu cầu thêm chữ, viết đúng nội dung, chính tả và dấu tiếng Việt. Trả trực tiếp đúng một ảnh vuông 1:1, ưu tiên 1254 × 1254 px nếu công cụ hỗ trợ, không ghép nhiều mẫu trong cùng khung.`,
  },
  {
    id: "anime",
    label: "Anime",
    imageUrl: "/style-image/Thiếu niên khăn vàng nhìn Hà Nội-5.png",
    aspectRatio: "1:1",
    prompt: `Nội dung: [Mô tả chủ thể, nội dung chữ hoặc phần cần chỉnh. Có thể để trống.]

Tạo hoặc chỉnh sửa ngay một ảnh theo phong cách Anime. Nếu không có ảnh đính kèm, tạo mới từ phần Nội dung. Nếu có ảnh gốc, dùng chủ thể trong ảnh đó, giữ nét nhận diện của người, đặc điểm của sản phẩm và logo hoặc tên thương hiệu hiện có, trừ phần được yêu cầu thay đổi. Nếu ảnh được ghi rõ là ảnh mẫu phong cách, tham chiếu bảng màu, ánh sáng, chất liệu và bố cục từ ảnh mẫu, rồi áp dụng vào chủ thể được yêu cầu. Có thể tạo mới chỉ với ảnh mẫu phong cách. Khi thiếu chi tiết, tự chọn phương án phù hợp và thực hiện ngay.

Vẽ theo phong cách anime Nhật Bản 2D với nét viền mảnh, biểu cảm rõ, đổ bóng theo mảng và ánh viền cam trên tóc. Dựng hậu cảnh nhiều lớp với mái nhà, mây và bầu trời cam chuyển tím. Nếu chưa có chủ thể hay bối cảnh, vẽ nhân vật đeo khăn vàng trên sân thượng nhìn ra Hà Nội lúc hoàng hôn, tóc và khăn bay nhẹ trong gió. Không tự thêm chữ.

Ưu tiên yêu cầu cụ thể ở dòng Nội dung. Nếu ảnh có chữ cần giữ hoặc được yêu cầu thêm chữ, viết đúng nội dung, chính tả và dấu tiếng Việt. Trả trực tiếp đúng một ảnh vuông 1:1, ưu tiên 1254 × 1254 px nếu công cụ hỗ trợ, không ghép nhiều mẫu trong cùng khung.`,
  },
  {
    id: "id-photo",
    label: "Ảnh thẻ",
    imageUrl: "/style-image/Chân dung nữ Việt nền xanh nhạt-8.png",
    aspectRatio: "1:1",
    prompt: `Nội dung: [Mô tả chủ thể, nội dung chữ hoặc phần cần chỉnh. Có thể để trống.]

Tạo hoặc chỉnh sửa ngay một ảnh theo phong cách Ảnh thẻ. Nếu không có ảnh đính kèm, tạo mới từ phần Nội dung. Nếu có ảnh gốc, dùng chủ thể trong ảnh đó, giữ nét nhận diện của người, đặc điểm của sản phẩm và logo hoặc tên thương hiệu hiện có, trừ phần được yêu cầu thay đổi. Nếu ảnh được ghi rõ là ảnh mẫu phong cách, tham chiếu bảng màu, ánh sáng, chất liệu và bố cục từ ảnh mẫu, rồi áp dụng vào chủ thể được yêu cầu. Có thể tạo mới chỉ với ảnh mẫu phong cách. Khi thiếu chi tiết, tự chọn phương án phù hợp và thực hiện ngay.

Tạo chân dung chính diện, đầu và vai cân đối, mắt nhìn thẳng, miệng khép, biểu cảm trung tính và áo sơ mi trắng. Đặt khuôn mặt giữa khung và chừa khoảng trống vừa phải phía trên đầu. Dùng nền xanh nhạt trơn và ánh sáng mềm đều hai bên mặt. Giữ kết cấu da tự nhiên, tránh làm mịn quá mức. Nếu chưa có chủ thể, dùng chân dung minh họa của một người trưởng thành. Không thêm chữ, khung viền hoặc hiệu ứng.

Ưu tiên yêu cầu cụ thể ở dòng Nội dung. Nếu ảnh có chữ cần giữ hoặc được yêu cầu thêm chữ, viết đúng nội dung, chính tả và dấu tiếng Việt. Trả trực tiếp đúng một ảnh vuông 1:1, ưu tiên 1254 × 1254 px nếu công cụ hỗ trợ, không ghép nhiều mẫu trong cùng khung.`,
  },
  {
    id: "cartoon",
    label: "Hoạt hình",
    imageUrl: "/style-image/Rái cá khăn xanh đạp xe-4.png",
    aspectRatio: "1:1",
    prompt: `Nội dung: [Mô tả chủ thể, nội dung chữ hoặc phần cần chỉnh. Có thể để trống.]

Tạo hoặc chỉnh sửa ngay một ảnh theo phong cách Hoạt hình. Nếu không có ảnh đính kèm, tạo mới từ phần Nội dung. Nếu có ảnh gốc, dùng chủ thể trong ảnh đó, giữ nét nhận diện của người, đặc điểm của sản phẩm và logo hoặc tên thương hiệu hiện có, trừ phần được yêu cầu thay đổi. Nếu ảnh được ghi rõ là ảnh mẫu phong cách, tham chiếu bảng màu, ánh sáng, chất liệu và bố cục từ ảnh mẫu, rồi áp dụng vào chủ thể được yêu cầu. Có thể tạo mới chỉ với ảnh mẫu phong cách. Khi thiếu chi tiết, tự chọn phương án phù hợp và thực hiện ngay.

Tạo hoạt hình 3D với hình khối tròn mềm, biểu cảm vui, chất liệu giống đất sét mịn và bảng màu pastel. Dùng ánh sáng dịu, bóng đổ mềm và góc máy ngang tầm nhân vật. Dựng bối cảnh như mô hình thu nhỏ với ít đạo cụ. Nếu chưa có chủ thể, dùng chú rái cá tròn đeo khăn xanh, đạp xe trong công viên. Không tự thêm chữ.

Ưu tiên yêu cầu cụ thể ở dòng Nội dung. Nếu ảnh có chữ cần giữ hoặc được yêu cầu thêm chữ, viết đúng nội dung, chính tả và dấu tiếng Việt. Trả trực tiếp đúng một ảnh vuông 1:1, ưu tiên 1254 × 1254 px nếu công cụ hỗ trợ, không ghép nhiều mẫu trong cùng khung.`,
  },
  {
    id: "banner",
    label: "Banner",
    imageUrl: "/style-image/Sắc màu – Tuần lễ sáng tạo-6.png",
    aspectRatio: "1:1",
    prompt: `Nội dung: [Mô tả chủ thể, nội dung chữ hoặc phần cần chỉnh. Có thể để trống.]

Tạo hoặc chỉnh sửa ngay một ảnh theo phong cách Banner. Nếu không có ảnh đính kèm, tạo mới từ phần Nội dung. Nếu có ảnh gốc, dùng chủ thể trong ảnh đó, giữ nét nhận diện của người, đặc điểm của sản phẩm và logo hoặc tên thương hiệu hiện có, trừ phần được yêu cầu thay đổi. Nếu ảnh được ghi rõ là ảnh mẫu phong cách, tham chiếu bảng màu, ánh sáng, chất liệu và bố cục từ ảnh mẫu, rồi áp dụng vào chủ thể được yêu cầu. Có thể tạo mới chỉ với ảnh mẫu phong cách. Khi thiếu chi tiết, tự chọn phương án phù hợp và thực hiện ngay.

Dùng bố cục hai vùng. Bên trái là nền xanh ngọc nhạt và tiêu đề lớn tối đa hai dòng. Bên phải đặt chủ thể hoặc phong cảnh tươi sáng với một điểm nhìn chính. Chừa lề an toàn và khoảng trống rộng, dùng độ tương phản đủ để tiêu đề vẫn dễ đọc khi thu nhỏ. Nếu chưa có nội dung hay ảnh, dùng tiêu đề “KHÁM PHÁ ĐÀ NẴNG” cùng cảnh biển và đồi xanh. Chỉ thêm logo nếu có tài sản thương hiệu được cung cấp.

Ưu tiên yêu cầu cụ thể ở dòng Nội dung. Nếu ảnh có chữ cần giữ hoặc được yêu cầu thêm chữ, viết đúng nội dung, chính tả và dấu tiếng Việt. Trả trực tiếp đúng một ảnh vuông 1:1, ưu tiên 1254 × 1254 px nếu công cụ hỗ trợ, không ghép nhiều mẫu trong cùng khung.`,
  },
];

function AspectRatioIcon({ ratio }: { ratio: StudioImageRequest["aspectRatio"] }) {
  const [widthRatio, heightRatio] = ratio.split(":").map(Number);
  const width = widthRatio >= heightRatio ? 18 : 18 * widthRatio / heightRatio;
  const height = heightRatio >= widthRatio ? 18 : 18 * heightRatio / widthRatio;
  return <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <rect x={(24 - width) / 2} y={(24 - height) / 2} width={width} height={height} rx="1.5" />
  </svg>;
}

const aspectRatioOptions = studioImageRatios.map(ratio => ({
  value: ratio,
  label: `${ratio} · ${ratioDescriptions[ratio]}`,
  icon: <AspectRatioIcon ratio={ratio} />,
}));

export function AssistantStudioImage({ onBack, historyItem }: { onBack: () => void; historyItem?: AssistantStudioCreationRecord | null }) {
  const [aspectRatio, setAspectRatio] = useState<StudioImageRequest["aspectRatio"]>("1:1");
  const [count, setCount] = useState(1);
  const [prompt, setPrompt] = useState(() => historyItem?.prompt ?? "");
  const [referenceImage, setReferenceImage] = useState("");
  const [referenceName, setReferenceName] = useState("");
  const [result, setResult] = useState<StudioImageResponse | null>(() => historyItem?.kind === "create-image" ? historyItem.payload as StudioImageResponse : null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<AssistantStudioCreationRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  async function openHistory() {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setShowHistory(true);
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const records = await listAssistantStudioCreationHistory(getAssistantSpeechHistoryUserId());
      setHistory(records.filter(record => record.kind === "create-image"));
    } catch (historyLoadError) {
      setHistoryError((historyLoadError as Error).message || "Không tải được lịch sử ảnh.");
    } finally {
      setHistoryLoading(false);
    }
  }

  function openHistoryImage(item: AssistantStudioCreationRecord) {
    const imageResult = item.payload as StudioImageResponse;
    setPrompt(item.prompt);
    setResult(imageResult);
    const savedRatio = studioImageRatios.find(ratio => ratio === imageResult.aspectRatio);
    if (savedRatio) setAspectRatio(savedRatio);
    setCount(imageResult.images.length);
    setShowHistory(false);
  }

  async function chooseReference(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 4 * 1024 * 1024) {
      setError("Chọn ảnh PNG, JPG hoặc WebP không quá 4 MB.");
      event.currentTarget.value = "";
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Không thể đọc ảnh tham chiếu."));
        reader.readAsDataURL(file);
      });
      setReferenceImage(dataUrl);
      setReferenceName(file.name);
      setError("");
    } catch (readError) { setError((readError as Error).message); }
    event.currentTarget.value = "";
  }

  async function createImages(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !prompt.trim()) return;
    setError("");
    setLoading(true);
    try {
      const response = await requestStudioImages({ prompt: prompt.trim(), aspectRatio, count, ...(referenceImage ? { referenceImage } : {}) });
      setResult(response);
      try {
        await saveAssistantStudioCreationHistory({
          userId: getAssistantSpeechHistoryUserId(),
          kind: "create-image",
          title: prompt.trim().slice(0, 100) || "Ảnh đã tạo",
          summary: `${response.images.length} ảnh · ${response.aspectRatio}`,
          prompt: prompt.trim(),
          payload: response,
        });
      } catch { /* Keep the generated images available even if browser storage is full. */ }
    } catch (requestError) { setError((requestError as Error).message); }
    finally { setLoading(false); }
  }

  return <div className="relative grid h-full min-h-0 min-w-0 overflow-hidden lg:h-[calc(100dvh-4rem)] lg:max-h-[calc(100dvh-4rem)] lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]">
      <div className="absolute right-4 top-3 z-10 sm:right-5 lg:right-6">
        <AssistantStudioHistoryAction open={showHistory} onClick={() => void openHistory()} />
      </div>
      <form onSubmit={createImages} className="flex h-full min-h-0 min-w-0 shrink-0 flex-col border-b border-outline-variant bg-surface-container-lowest lg:border-b-0 lg:border-r" aria-label="Thiết lập tạo hình ảnh">
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 sm:p-5">
          <div className="mb-1"><AssistantStudioBreadcrumb title="Tạo hình ảnh" onBack={onBack} /></div>
          <div><span className="mb-1 block text-sm font-medium">Mô hình</span><div className="flex h-10 items-center gap-1 rounded-md border border-outline-variant bg-surface-container-lowest px-2 text-sm text-on-surface" aria-label="Mô hình iGenAI"><img src="/igenai.png" alt="" aria-hidden="true" className="size-8 shrink-0 object-contain" />iGenAI</div></div>
          <div><span className="mb-1 block text-sm font-medium">Tỷ lệ khung hình</span><StyledSelect appearance="erp" ariaLabel="Tỷ lệ khung hình" value={aspectRatio} onChange={value => setAspectRatio(value as StudioImageRequest["aspectRatio"])} disabled={loading} options={aspectRatioOptions} className="h-10 rounded-md" menuClassName="rounded-md [&_[role=option]]:rounded-sm" /></div>
          <div>
            <label htmlFor="studio-image-prompt" className="mb-1 block text-sm font-medium">Mô tả hình ảnh</label>
            <textarea id="studio-image-prompt" required minLength={3} maxLength={2000} rows={6} value={prompt} onChange={event => setPrompt(event.target.value)} disabled={loading} aria-describedby="studio-image-prompt-count" placeholder="Mô tả chủ thể, bối cảnh, ánh sáng, màu sắc và các chi tiết bạn muốn xuất hiện…" className={cn(fieldClass, "min-h-32 resize-none")} />
            <div className="mt-1 flex justify-end text-xs text-on-surface-variant"><span id="studio-image-prompt-count" className="shrink-0 tabular-nums">{prompt.length}/2.000</span></div>
          </div>
          <div><span className="mb-1 block text-sm font-medium">Ảnh tham chiếu <span className="font-normal text-on-surface-variant">(không bắt buộc)</span></span>{referenceImage ? <div className="flex items-center gap-2 rounded-lg border border-outline-variant p-1"><img src={referenceImage} alt="Ảnh tham chiếu đã chọn" className="size-10 rounded-md object-cover" /><span className="min-w-0 flex-1 truncate text-sm">{referenceName}</span><button type="button" onClick={() => { setReferenceImage(""); setReferenceName(""); }} aria-label="Xóa ảnh tham chiếu" disabled={loading} className={cn("rounded-md p-2 hover:bg-surface-container-low", focusClass)}><X className="size-4" aria-hidden="true" /></button></div> : <div className="flex items-center gap-2"><label className="inline-flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed border-outline-variant bg-surface-container-low text-on-surface-variant focus-within:border-primary"><Plus className="size-5" aria-hidden="true" /><input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseReference} disabled={loading} className="sr-only" aria-label="Thêm ảnh tham chiếu" /></label><span className="text-pretty text-xs text-on-surface-variant">PNG, JPG, WebP · tối đa 4 MB</span></div>}</div>
          <div><span className="mb-1 block text-sm font-medium">Số lượng hình ảnh</span><StyledSelect appearance="erp" ariaLabel="Số lượng hình ảnh" value={String(count)} onChange={value => setCount(Number(value))} disabled={loading} options={[1, 2, 3, 4].map(value => ({ value: String(value), label: `${value} ảnh` }))} className="h-10 rounded-md" menuClassName="rounded-md [&_[role=option]]:rounded-sm" /></div>
        </div>
        <div className="shrink-0 border-t border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
          <button type="submit" disabled={loading || prompt.trim().length < 3} className={cn("inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50", focusClass)}>{loading ? "Đang tạo ảnh…" : "Tạo hình ảnh"}</button>
          {error && <p role="alert" className="mt-2 text-pretty rounded-lg border border-error/30 bg-error/5 p-3 text-sm text-error">{error}</p>}
        </div>
      </form>
      <section aria-label="Kết quả tạo hình ảnh" aria-busy={loading} className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-surface-container-lowest p-4 lg:p-6">
        {loading ? <div role="status" className="flex flex-1 flex-col items-center justify-center gap-4 text-center"><div className="size-9 animate-spin rounded-full border-2 border-outline-variant border-t-primary motion-reduce:animate-none" aria-hidden="true" /><p className="text-sm text-on-surface-variant">Đang tạo {count} ảnh. Quá trình này có thể mất một lúc…</p></div>
          : result?.images.length ? <><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-balance text-lg font-semibold">Ảnh đã tạo</h2><p className="text-sm text-on-surface-variant">{result.images.length} ảnh · iGenAI · {result.aspectRatio}</p></div></div>{result.warning && <p role="status" className="mb-4 text-sm text-on-surface-variant">{result.warning}</p>}<div className={cn("grid gap-4", result.images.length > 1 && "sm:grid-cols-2")}>{result.images.map((image, index) => <figure key={`${image.url.slice(0, 40)}-${index}`} className="min-w-0 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-low"><img src={image.url} alt={`Ảnh AI đã tạo ${index + 1}`} className="max-h-[34rem] w-full object-contain" /><figcaption className="flex items-center justify-between gap-2 p-3 text-sm"><span>Ảnh {index + 1}</span><a href={image.url} download={`igen-ai-studio-${index + 1}.png`} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-primary hover:bg-primary/10", focusClass)}><Download className="size-4" aria-hidden="true" />Tải ảnh</a></figcaption></figure>)}</div></>
          : <div className="flex flex-1 flex-col items-center justify-center py-6 text-center lg:py-8">
              <div className="space-y-2.5">
                <h2 className="mx-auto max-w-3xl text-balance text-2xl font-bold leading-tight sm:text-[37px] sm:leading-[1.2]">
                  <span className="bg-[linear-gradient(90deg,#ea580c_0%,#ff7a00_50%,#f59e0b_100%)] bg-clip-text text-transparent">Thỏa sức sáng tạo</span>{" "}
                  <span className="text-on-surface">hình ảnh đa phong cách</span>{" "}
                  <span className="text-primary">cùng AI</span>
                </h2>
                <p className="text-pretty text-sm sm:text-base text-on-surface-variant">Mô tả ý tưởng và chọn khung hình để bắt đầu.</p>
              </div>
              <div className="my-5 flex w-full justify-center">
                <img src="/ai-studio-image-hero.png" alt="Bộ ảnh phong cảnh, hoa và nội thất được sáng tạo bằng AI" width="1536" height="1024" className="h-auto max-h-[38dvh] w-full max-w-2xl object-contain drop-shadow-xs" />
              </div>
              <section aria-label="Thư viện mẫu" className="w-full max-w-4xl space-y-3.5 pt-6 sm:pt-8">
                <h3 className="px-1 text-left text-sm font-semibold text-on-surface">Thư viện mẫu</h3>
                <div className="grid grid-cols-4 gap-2.5">
                  {studioStyleSamples.map((sample) => {
                    const isSelected = prompt === sample.prompt;
                    return (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() => {
                          setPrompt(sample.prompt);
                          setAspectRatio(sample.aspectRatio);
                          setError("");
                        }}
                        disabled={loading}
                        aria-pressed={isSelected}
                        className={cn(
                          "group relative overflow-hidden rounded-xl border border-outline-variant transition-all hover:border-primary hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                          isSelected && "border-primary ring-2 ring-primary/30"
                        )}
                      >
                        <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-container-low">
                          <img
                            src={sample.imageUrl}
                            alt={`Mẫu phong cách ${sample.label}`}
                            loading="lazy"
                            width={320}
                            height={180}
                            className="size-full object-cover transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none"
                          />
                          <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                          <span className={cn(
                            "absolute bottom-1.5 left-2 right-2 truncate text-left text-xs font-semibold text-white drop-shadow-sm",
                            isSelected && "text-primary-container"
                          )}>
                            {sample.label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>}
      </section>
      <AssistantStudioHistoryDrawer open={showHistory} title="Lịch sử tạo ảnh" onClose={() => setShowHistory(false)}>
        <section aria-label="Danh sách ảnh đã tạo" aria-busy={historyLoading} className="py-3">
          {historyLoading && <p role="status" className="py-3 text-sm text-on-surface-variant">Đang tải lịch sử…</p>}
          {historyError && <p role="alert" className="rounded-lg border border-error bg-error-container p-3 text-pretty text-sm text-on-error-container">{historyError}</p>}
          {!historyLoading && !historyError && history.length === 0 && <p className="py-3 text-pretty text-sm text-on-surface-variant">Ảnh bạn tạo sẽ xuất hiện ở đây.</p>}
          {!historyLoading && !historyError && history.length > 0 && <ul className="divide-y divide-outline-variant">{history.map(item => <li key={item.id}><button type="button" onClick={() => openHistoryImage(item)} className={cn("flex min-h-16 w-full items-center gap-3 py-3 text-left hover:bg-surface-container-low", focusClass)}><AssistantStudioHistoryKindIcon kind="image" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-on-surface">{item.title}</span><time className="mt-1 block text-xs tabular-nums text-on-surface-variant" dateTime={item.createdAt}>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</time></span><ChevronRight className="size-4 shrink-0 text-on-surface-variant" aria-hidden="true" /></button></li>)}</ul>}
        </section>
      </AssistantStudioHistoryDrawer>
  </div>;
}
