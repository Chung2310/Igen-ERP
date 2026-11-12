import { afterEach, describe, expect, it, vi } from "vitest";
import { createStudioMindmap } from "./studio-mindmaps";
import { openrouterChat } from "../service/openrouter.service";

vi.mock("../service/openrouter.service", () => ({ openrouterChat: vi.fn() }));
vi.mock("../modules/marketing-suite/shared/service/ai-subscription.service", () => ({
  withAiUsage: (_context: unknown, action: () => unknown) => action(),
  billAiCall: (_kind: string, _model: string, action: () => unknown) => action(),
}));

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

const completion = {
  title: "Kế hoạch kinh doanh",
  subtitle: "Các hướng triển khai chính",
  root: {
    label: "Kế hoạch kinh doanh",
    detail: "Mục tiêu và cách triển khai",
    children: [
      { label: "Khách hàng", detail: "Nhóm khách hàng mục tiêu", children: [{ label: "Doanh nghiệp vừa", detail: "Nhu cầu quản trị", children: [] }] },
      { label: "Sản phẩm", detail: "Giá trị cung cấp", children: [{ label: "Gói dịch vụ", detail: "Các gói chính", children: [] }] },
    ],
  },
};

describe("createStudioMindmap", () => {
  it("uses the free Gemma model with Qwen fallback and returns a validated tree", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("IGENAI_MINDMAP_MODEL", "");
    vi.stubEnv("IGENAI_MINDMAP_FALLBACK_MODEL", "");
    vi.mocked(openrouterChat).mockResolvedValue({ text: JSON.stringify(completion) });

    const result = await createStudioMindmap({
      sourceType: "text", prompt: "Kế hoạch kinh doanh", locale: "vi", writeMode: "ai", companyCode: "MAIN", userId: "user-1",
    });

    expect(result.title).toBe("Kế hoạch kinh doanh");
    expect(result.root.children).toHaveLength(2);
    expect(openrouterChat).toHaveBeenCalledWith(expect.objectContaining({
      model: "google/gemma-4-31b-it:free",
      fallbackModel: "qwen/qwen3.7-flash",
      jsonMode: true,
      responseSchema: expect.any(Object),
    }));
  });

  it("rejects unsupported source instructions before calling a model", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    await expect(createStudioMindmap({
      sourceType: "text", prompt: "", locale: "vi", writeMode: "ai", companyCode: "MAIN", userId: "user-1",
    })).rejects.toMatchObject({ status: 400 });
    expect(openrouterChat).not.toHaveBeenCalled();
  });
});
