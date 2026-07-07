import React from 'react';
import { Upload, ImageIcon, Trash2, Loader2 } from 'lucide-react';
import { UploadedFile } from '../../../types';

interface FormInputProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  type?: string;
}

export function FormInput({
  label,
  name,
  value,
  onChange,
  required = false,
  readOnly = false,
  placeholder = '',
  className = '',
  type = 'text',
}: FormInputProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        placeholder={placeholder}
        className={`w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-cyan-600/5 focus:border-cyan-600 transition-all ${
          readOnly ? 'bg-slate-50 text-slate-600 cursor-default' : ''
        }`}
      />
    </div>
  );
}

interface UploadCardProps {
  label: string;
  file?: UploadedFile;
  isUploading: boolean;
  onFileChange: (file?: File) => void;
  onRemove: () => void;
}

export function UploadCard({
  label,
  file,
  isUploading,
  onFileChange,
  onRemove,
}: UploadCardProps) {
  return (
    <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-700">{label}</p>
        {file && (
          <button type="button" onClick={onRemove} className="text-rose-500 hover:text-rose-600 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      {file ? (
        <a href={file.url} target="_blank" rel="noreferrer" className="block group">
          <div className="rounded-xl overflow-hidden bg-slate-50 border border-slate-100 h-40 sm:h-28 flex items-center justify-center transition-all group-hover:border-slate-300">
            {file.type.includes('image') ? (
              <img src={file.url} alt={file.name} className="w-full h-full object-contain" />
            ) : (
              <ImageIcon className="w-8 h-8 text-slate-400" />
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-2 truncate group-hover:text-slate-800 transition-colors">{file.name}</p>
        </a>
      ) : (
        <label className="flex flex-col items-center justify-center h-40 sm:h-28 rounded-xl border-2 border-dashed border-slate-200 cursor-pointer hover:bg-slate-50 transition-all hover:border-slate-300">
          {isUploading ? (
            <Loader2 className="w-5 h-5 text-cyan-500 animate-spin" />
          ) : (
            <Upload className="w-5 h-5 text-cyan-500" />
          )}
          <span className="text-[11px] text-slate-500 mt-2 font-medium">Tải ảnh lên</span>
          <input
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            disabled={isUploading}
            onChange={(e) => onFileChange(e.target.files?.[0])}
          />
        </label>
      )}
    </div>
  );
}
