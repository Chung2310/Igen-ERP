import React from 'react';
import { Student } from '../../../types';
import { formatDisplayDate } from '../../../lib/utils';
import { Image as ImageIcon } from 'lucide-react';

interface ProfileTabProps {
  student: Student;
}

export function ProfileTab({ student }: ProfileTabProps) {
  const getStudentFormConfig = () => {
    const ownerId = student.centerId || student.ownerId || 'default';
    const configKey = `studentFormConfig_${ownerId}`;
    const saved = localStorage.getItem(configKey);
    const defaults: Record<string, { visible: boolean; required: boolean }> = {
      email:           { visible: true,  required: false },
      birthday:        { visible: true,  required: false },
      idCard:          { visible: true,  required: false },
      address:         { visible: true,  required: false },
      referral:        { visible: true,  required: false },
      idCardFrontFile: { visible: false, required: false },
      idCardBackFile:  { visible: false, required: false },
      portraitFile:    { visible: false, required: false },
    };
    if (saved) {
      try {
        return { ...defaults, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Error parsing studentFormConfig', e);
      }
    }
    return defaults;
  };

  const formConfig = getStudentFormConfig();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm shadow-slate-200/50">
        <FormField label="HỌ VÀ TÊN*" value={student.fullName} />
        {formConfig.birthday?.visible !== false && (
          <FormField label="NGÀY SINH" value={formatDisplayDate(student.birthday)} />
        )}
        <FormField label="SỐ ĐIỆN THOẠI" value={student.phone} />
        {formConfig.email?.visible !== false && (
          <FormField label="EMAIL" value={student.email || 'Chưa cập nhật'} />
        )}
        {formConfig.referral?.visible !== false && (
          <FormField label="NGƯỜI GIỚI THIỆU" value={student.referral || 'Trực tiếp'} />
        )}
        {formConfig.idCard?.visible !== false && (
          <FormField label="CCCD / CMND" value={student.idCard || 'Chưa cập nhật'} />
        )}

        <FormField label="NGÀY ĐĂNG KÝ" value={formatDisplayDate(student.registrationDate)} />
        <FormField label="NGÀY NHẬP HỌC" value={formatDisplayDate(student.enrollmentDate || '') || 'Chưa cập nhật'} />
        
        {formConfig.address?.visible !== false && (
          <div className="md:col-span-2">
            <FormField label="ĐỊA CHỈ" value={student.address || 'Chưa cập nhật'} />
          </div>
        )}
        <div className="md:col-span-2">
          <FormField label="TRẠNG THÁI" value={Array.isArray(student.status) ? student.status.join(', ') : student.status} />
        </div>
      </div>

      {(formConfig.idCardFrontFile?.visible || formConfig.idCardBackFile?.visible || formConfig.portraitFile?.visible) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm shadow-slate-200/50">
          <div className="sm:col-span-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Tài liệu đính kèm</h3>
            <p className="text-[10px] text-slate-400">Xem hoặc mở các ảnh hồ sơ liên quan của học viên.</p>
          </div>
          {formConfig.idCardFrontFile?.visible && (
            <FilePreviewCard label="CCCD mặt trước" file={student.idCardFrontFile} />
          )}
          {formConfig.idCardBackFile?.visible && (
            <FilePreviewCard label="CCCD mặt sau" file={student.idCardBackFile} />
          )}
          {formConfig.portraitFile?.visible && (
            <FilePreviewCard label="Ảnh chân dung" file={student.portraitFile} />
          )}
        </div>
      )}
    </div>
  );
}

function FormField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{label}</label>
      <input type="text" value={value} readOnly className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 cursor-default" />
    </div>
  );
}

interface FilePreviewCardProps {
  label: string;
  file?: { url: string; name: string; type: string };
}

function FilePreviewCard({ label, file }: FilePreviewCardProps) {
  return (
    <div className="border border-slate-100 rounded-2xl p-4 space-y-3 bg-slate-50/50">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      {file ? (
        <a href={file.url} target="_blank" rel="noreferrer" className="block group">
          <div className="rounded-xl overflow-hidden bg-white border border-slate-150 h-32 flex items-center justify-center transition-all group-hover:border-slate-350 shadow-xs">
            {file.type?.includes('image') ? (
              <img src={file.url} alt={file.name} className="w-full h-full object-contain" />
            ) : (
              <ImageIcon className="w-8 h-8 text-slate-400" />
            )}
          </div>
          <p className="text-[10px] text-slate-500 mt-2 truncate group-hover:text-slate-800 transition-colors font-semibold">{file.name}</p>
        </a>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 h-32 flex flex-col items-center justify-center bg-white">
          <ImageIcon className="w-6 h-6 text-slate-300" />
          <span className="text-[10px] text-slate-400 mt-2 font-semibold">Chưa cập nhật</span>
        </div>
      )}
    </div>
  );
}
