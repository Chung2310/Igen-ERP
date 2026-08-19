import type { MarketingAutomationType } from "../api/marketing.api";
import EmailTemplateEditor from "../../../components/template-editor/EmailTemplateEditor";
import { fillSampleValues as fillTemplateSampleValues } from "../../../components/template-editor/templateTokenCodec";
import { MARKETING_VARIABLE_REGISTRY, getVariablesForType } from "./marketingVariableRegistry";

export const VARIABLE_INFO = Object.fromEntries(
  Object.entries(MARKETING_VARIABLE_REGISTRY).map(([key, value]) => [key, { label: value.label, sample: value.sample }]),
) as Record<string, { label: string; sample: string }>;

export const VARIABLES_BY_TYPE: Record<MarketingAutomationType, string[]> = {
  thank_you: getVariablesForType("thank_you"),
  birthday: getVariablesForType("birthday"),
  holiday: getVariablesForType("holiday"),
  remarketing: getVariablesForType("remarketing"),
};

export function fillSampleValues(template: string) {
  return fillTemplateSampleValues(template, Object.values(MARKETING_VARIABLE_REGISTRY));
}

type Props = {
  automationType: MarketingAutomationType;
  subject: string;
  html: string;
  disabled: boolean;
  onChange: (values: { subject?: string; html?: string }) => void;
};

export default function TemplateEditor({ automationType, subject, html, disabled, onChange }: Props) {
  return (
    <EmailTemplateEditor
      subject={subject}
      html={html}
      variables={getVariablesForType(automationType).map((key) => MARKETING_VARIABLE_REGISTRY[key])}
      disabled={disabled}
      onChange={onChange}
      bodyLabel="Nội dung"
      previewCopy="Đây là bản xem thử với dữ liệu mẫu. Khi gửi thật, hệ thống điền thông tin của từng khách hàng."
    />
  );
}
