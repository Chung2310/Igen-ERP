import TemplateVariablePalette from "../../../components/template-editor/TemplateVariablePalette";
import type { MarketingAutomationType } from "../api/marketing.api";
import { MARKETING_VARIABLE_REGISTRY, getVariablesForType } from "./marketingVariableRegistry";

type Props = {
  automationType: MarketingAutomationType;
  disabled: boolean;
  activeTarget: "subject" | "html";
  onInsert: (key: string) => void;
};

export default function MarketingVariablePalette({ automationType, disabled, activeTarget, onInsert }: Props) {
  return (
    <TemplateVariablePalette
      variables={getVariablesForType(automationType).map((key) => MARKETING_VARIABLE_REGISTRY[key])}
      disabled={disabled}
      activeTarget={activeTarget}
      onInsert={onInsert}
    />
  );
}
