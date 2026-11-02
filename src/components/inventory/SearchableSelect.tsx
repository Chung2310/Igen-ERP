import { Dropdown } from "../common/Dropdown";

export interface SelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Chọn một tùy chọn...",
  searchPlaceholder = "Tìm kiếm...",
  disabled = false,
  className = "",
}: SearchableSelectProps) {
  return <Dropdown value={value} onChange={onChange} options={options} placeholder={placeholder} searchPlaceholder={searchPlaceholder} disabled={disabled} searchable variant="form" className={`w-full ${className}`} />;
}
