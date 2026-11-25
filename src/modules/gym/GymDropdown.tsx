import { StyledSelect } from "../../components/common/StyledSelect";
import type { DropdownProps } from "../../components/common/Dropdown";
import { cn } from "../student-management/lib/utils";

export function Dropdown({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  searchable,
  searchPlaceholder,
  onSearchChange,
  className,
  triggerClassName,
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
  "aria-required": required,
}: DropdownProps<string>) {
  const normalizedOptions = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );

  return (
    <div className={cn("min-w-40", className)}>
      <StyledSelect
        appearance="erp"
        ariaLabel={ariaLabel || placeholder || "Chọn mục"}
        describedBy={describedBy}
        required={required}
        value={value}
        onChange={onChange}
        options={normalizedOptions}
        placeholder={placeholder || normalizedOptions[0]?.label}
        disabled={disabled}
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        onSearchChange={onSearchChange}
        className={cn("rounded-md", triggerClassName)}
        menuClassName="rounded-md"
      />
    </div>
  );
}
