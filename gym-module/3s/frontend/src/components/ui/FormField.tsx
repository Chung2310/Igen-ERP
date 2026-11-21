import { Children, isValidElement, useState, type ChangeEvent, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import CustomSelect, { type CustomSelectOption } from './CustomSelect';
import CustomDatePicker from './CustomDatePicker';

type SharedProps = { label: string; name: string; error?: string; children?: ReactNode };
type InputProps = SharedProps & InputHTMLAttributes<HTMLInputElement> & { as?: 'input' };
type SelectProps = SharedProps & SelectHTMLAttributes<HTMLSelectElement> & { as: 'select' };
type TextareaProps = SharedProps & TextareaHTMLAttributes<HTMLTextAreaElement> & { as: 'textarea' };
type FormFieldProps = InputProps | SelectProps | TextareaProps;

function extractSelectOptions(children: ReactNode): CustomSelectOption<string>[] {
  const result: CustomSelectOption<string>[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<{ value?: string | number; children?: ReactNode }>;
    if (el.type === 'option') {
      const val = el.props.value !== undefined ? String(el.props.value) : String(el.props.children ?? '');
      const text = typeof el.props.children === 'string' || typeof el.props.children === 'number'
        ? String(el.props.children)
        : Array.isArray(el.props.children)
          ? el.props.children.map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : '')).join('')
          : val;
      result.push({ value: val, label: text });
    }
  });
  return result;
}

export default function FormField(props: FormFieldProps) {
  const { label, name, error } = props;
  const [showPassword, setShowPassword] = useState(false);

  let control: ReactNode;
  if (props.as === 'select') {
    const { as: _as, label: _label, error: _error, children: optionsNode, value, defaultValue, onChange, disabled, required, ...rest } = props;
    const parsedOptions = extractSelectOptions(optionsNode);
    const initialVal = value !== undefined ? String(value) : defaultValue !== undefined ? String(defaultValue) : (parsedOptions[0]?.value ?? '');
    const [uncontrolledVal, setUncontrolledVal] = useState(initialVal);
    const currentValue = value !== undefined ? String(value) : uncontrolledVal;

    control = (
      <>
        <input type="hidden" name={name} value={currentValue} readOnly />
        <CustomSelect
          ariaLabel={(rest['aria-label'] as string | undefined) || label}
          value={currentValue}
          disabled={disabled}
          required={required}
          options={parsedOptions}
          onChange={(nextVal) => {
            if (value === undefined) setUncontrolledVal(nextVal);
            if (onChange) {
              const syntheticEvent = {
                target: { name, value: nextVal },
                currentTarget: { name, value: nextVal },
              } as unknown as ChangeEvent<HTMLSelectElement>;
              onChange(syntheticEvent);
            }
          }}
        />
      </>
    );
  } else if (props.as === 'textarea') {
    const { as: _as, label: _label, error: _error, children: content, ...controlProps } = props;
    control = <textarea id={name} aria-invalid={Boolean(error)} {...controlProps}>{content}</textarea>;
  } else {
    const { as: _as, label: _label, error: _error, children: _children, type, style, ...controlProps } = props;
    if (type === 'date') {
      const { value, defaultValue, onChange, min, max, disabled, required } = controlProps;
      const initialVal = value !== undefined ? String(value) : defaultValue !== undefined ? String(defaultValue) : '';
      const [uncontrolledDate, setUncontrolledDate] = useState(initialVal);
      const currentDate = value !== undefined ? String(value) : uncontrolledDate;

      control = (
        <>
          <input type="hidden" name={name} value={currentDate} readOnly />
          <CustomDatePicker
            ariaLabel={(controlProps['aria-label'] as string | undefined) || label}
            value={currentDate}
            min={min !== undefined ? String(min) : undefined}
            max={max !== undefined ? String(max) : undefined}
            disabled={disabled}
            required={required}
            clearable={!required}
            onChange={(nextDate) => {
              if (value === undefined) setUncontrolledDate(nextDate);
              if (onChange) {
                const syntheticEvent = {
                  target: { name, value: nextDate },
                  currentTarget: { name, value: nextDate },
                } as unknown as ChangeEvent<HTMLInputElement>;
                onChange(syntheticEvent);
              }
            }}
          />
        </>
      );
    } else if (type === 'password') {
      control = (
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            id={name}
            type={showPassword ? 'text' : 'password'}
            aria-invalid={Boolean(error)}
            style={{ ...style, paddingRight: '40px', width: '100%' }}
            {...controlProps}
          />
          <button
            type="button"
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
            tabIndex={-1}
            onClick={() => setShowPassword((prev) => !prev)}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              padding: '6px',
              cursor: 'pointer',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
            }}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      );
    } else {
      control = <input id={name} type={type} aria-invalid={Boolean(error)} style={style} {...controlProps} />;
    }
  }
  return <div className="field"><label htmlFor={name}>{label}</label>{control}{error && <small className="field-error">{error}</small>}</div>;
}
