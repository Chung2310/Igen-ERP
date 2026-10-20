import { StyledSelect, type StyledSelectOption } from "../../../../components/common/StyledSelect";
import { PayrollDatePicker } from "../../../../components/hr/payroll/PayrollDatePicker";

type SelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: StyledSelectOption[];
  placeholder?: string;
};

export function PartnerSelect({ label, value, onChange, options, placeholder = "Chọn..." }: SelectProps) {
  return (
    <div className="grid min-w-0 gap-1">
      <span className="text-[13px] font-medium text-[#4e647d]">{label}</span>
      <StyledSelect
        ariaLabel={label}
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
      />
    </div>
  );
}

type DateProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
};

export function PartnerDatePicker({ label, value, onChange, required = false }: DateProps) {
  return (
    <div className="min-w-0">
      <span className="text-[13px] font-medium text-[#4e647d]">{label}</span>
      <PayrollDatePicker label={label} value={value} onChange={onChange} clearable={!required} />
    </div>
  );
}
