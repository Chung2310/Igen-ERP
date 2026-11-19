import type { AssistantWorkflow } from "../../src/shared/assistant-workflow";

export interface BusinessDiscovery {
  actionIds: string[];
}

/** Discovery is advice only. Never treat a suggested capability as authorization. */
export function validateBusinessDiscovery(value: unknown, workflows: readonly AssistantWorkflow[]): BusinessDiscovery | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const ids = (value as BusinessDiscovery).actionIds;
  if (!Array.isArray(ids) || ids.length > 5 || ids.some(id => typeof id !== "string")) return undefined;
  return { actionIds: [...new Set(ids)].filter(id => workflows.some(w => w.enabled && w.actionId === id)) };
}

export function businessDiscoveryReply(discovery: BusinessDiscovery, workflows: readonly AssistantWorkflow[], question?: string): string {
  const options = discovery.actionIds.flatMap(id => {
    const workflow = workflows.find(w => w.enabled && w.actionId === id);
    return workflow ? [`- ${workflow.title}`] : [];
  });
  return [
    options.length ? "Mình có thể giúp bạn làm những việc sau trong tài khoản hiện tại:" : "Mình cần biết việc bạn đang muốn quản lý để hướng dẫn đúng chức năng đang có.",
    options.join("\n"),
    question || "Bạn đang gặp khó khăn ở việc nào, hoặc muốn bắt đầu từ đâu? Bạn cứ mô tả theo cách thường ngày nhé.",
  ].filter(Boolean).join("\n\n");
}

export const businessDiscoveryInstructions = `Người dùng có thể chưa biết phần mềm dùng làm gì và không biết tên chức năng. Khi họ hỏi một phân hệ giúp được gì, muốn bắt đầu sử dụng, hoặc chỉ nêu khó khăn kinh doanh chưa đủ để chọn thao tác, trả intentType=ambiguous, actionId=null, values={}, businessDiscovery={actionIds:[tối đa 5 thao tác liên quan có trong DANH MỤC]}, remainingRequests=[]. Chọn những việc dễ bắt đầu và liên quan trực tiếp nhu cầu, không liệt kê toàn bộ công cụ. clarification là tối đa một câu hỏi ngắn về mục tiêu còn thiếu, dùng từ thông thường, không yêu cầu tên API, trường dữ liệu hay mã nội bộ. Không chuyển câu hỏi về cách dùng ERP sang Hỏi đáp. Không tự tạo hồ sơ, đọc danh sách hoặc chạy các thao tác được gợi ý chỉ vì người dùng đang tìm hiểu.
Khi người dùng đã nêu đủ mục tiêu, chọn thao tác thực sự phù hợp và giữ các điều kiện trong lời nói, không tiếp tục giới thiệu. Dùng lịch sử để hiểu câu trả lời cho câu hỏi trước. Một lời đồng ý chung sau danh sách nhiều gợi ý chưa xác định việc cần làm. Với tệp và câu như làm giúp tôi, hỏi mục đích nếu chưa rõ xem, nhập mới hay cập nhật. Với yêu cầu giải thích số liệu, tra cứu bằng công cụ phù hợp trước, không bịa số hoặc nguyên nhân. Với làm như lần trước, chỉ dùng thông tin thực có trong lịch sử, hỏi phần còn thiếu. Với đổi ý, giữ các điều kiện không bị thay đổi và phân biệt bản nháp với việc đã thực hiện, không tuyên bố đã hoàn tác nếu chưa có thao tác hoàn tác thành công.`;
