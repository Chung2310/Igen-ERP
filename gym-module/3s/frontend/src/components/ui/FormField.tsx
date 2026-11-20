import { useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type SharedProps = { label: string; name: string; error?: string; children?: ReactNode };
type InputProps = SharedProps & InputHTMLAttributes<HTMLInputElement> & { as?: 'input' };
type SelectProps = SharedProps & SelectHTMLAttributes<HTMLSelectElement> & { as: 'select' };
type TextareaProps = SharedProps & TextareaHTMLAttributes<HTMLTextAreaElement> & { as: 'textarea' };
type FormFieldProps = InputProps | SelectProps | TextareaProps;

export default function FormField(props: FormFieldProps) {
  const { label, name, error } = props;
  const [showPassword, setShowPassword] = useState(false);

  let control: ReactNode;
  if (props.as === 'select') {
    const { as: _as, label: _label, error: _error, children: options, ...controlProps } = props;
    control = <select id={name} aria-invalid={Boolean(error)} {...controlProps}>{options}</select>;
  } else if (props.as === 'textarea') {
    const { as: _as, label: _label, error: _error, children: content, ...controlProps } = props;
    control = <textarea id={name} aria-invalid={Boolean(error)} {...controlProps}>{content}</textarea>;
  } else {
    const { as: _as, label: _label, error: _error, children: _children, type, style, ...controlProps } = props;
    if (type === 'password') {
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
