import { AssistantError } from './policy';
import { AI_PROVIDER_TEMPORARY_ERROR } from '../../src/shared/ai-provider-error';

/** Provider failures are terminal for routing, never evidence of an ambiguous request. */
export class AssistantInterpretationError extends AssistantError {
  constructor(public readonly providerStatus?: number, public readonly timedOut = false) {
    super(providerStatus === 402 ? AI_PROVIDER_TEMPORARY_ERROR
      : timedOut ? 'Dịch vụ AI phản hồi quá lâu nên mình chưa phân tích xong yêu cầu. Bạn thử lại sau nhé.'
      : 'Mình chưa kết nối được dịch vụ AI để phân tích yêu cầu. Bạn thử lại sau nhé; nếu lỗi còn tiếp diễn, nhờ quản trị viên kiểm tra kết nối và cấu hình AI.',
    timedOut ? 504 : 503);
  }
}
