interface Props {
  label: string;
  ariaLabel: string;
  value?: number;
  placeholder?: number | string;
  min?: number;
  max?: number;
  step?: number | string;
  onChange: (value?: number) => void;
}

export default function TrackingNumberField({
  label,
  ariaLabel,
  value,
  placeholder,
  min = 0,
  max,
  step = 1,
  onChange,
}: Props) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        aria-label={ariaLabel}
        type="number"
        min={min}
        max={max}
        step={step}
        placeholder={placeholder == null ? '0' : String(placeholder)}
        value={value ?? ''}
        onChange={(event) =>
          onChange(event.target.value === '' ? undefined : Number(event.target.value))
        }
      />
    </div>
  );
}
