import React, { useEffect, useState, useRef } from 'react';
import { Calendar } from 'lucide-react';
import { toInputDate } from '../../lib/utils';

interface DateInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  onBlur?: () => void;
  className?: string;
}

export function DateInput({
  label,
  value,
  onChange,
  required = true,
  error,
  onBlur,
  className = ''
}: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Convert parent value to YYYY-MM-DD format for local state
  const [localVal, setLocalVal] = useState(() => toInputDate(value));

  useEffect(() => {
    // Only overwrite local value if the input is not currently focused by the user
    if (document.activeElement !== inputRef.current) {
      setLocalVal(toInputDate(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalVal(val);
    onChange(val);
  };

  const handleBlurEvent = () => {
    setLocalVal(toInputDate(value));
    onBlur?.();
  };

  return (
    <div className={`space-y-1 ${className}`}>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
        {label} {required && '*'}
      </label>
      <div className="relative">
        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="date"
          required={required}
          value={localVal}
          onChange={handleChange}
          onBlur={handleBlurEvent}
          className={`w-full py-3.5 pl-11 pr-4 rounded-xl bg-slate-50 border outline-none transition-all font-medium text-slate-900 text-sm ${
            error 
              ? 'border-rose-300 bg-rose-50/10 focus:border-rose-500' 
              : 'border-slate-100 focus:border-cyan-600 focus:bg-white'
          }`}
        />
      </div>
      {error && <p className="text-[11px] font-bold text-rose-500 ml-1">{error}</p>}
    </div>
  );
}
