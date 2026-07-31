import React from 'react';
import { Student } from '../../../types';
import { formatDisplayDate } from '../../../lib/utils';
import { CustomFieldDetails } from '../../../custom-fields/CustomFieldDetails';
import { useBatches } from '../../../hooks/useBatches';

interface ProfileTabProps {
  student: Student;
  selectedCenter?: string;
}

export function ProfileTab({ student }: ProfileTabProps) {
  const { batches } = useBatches();
  const joinedBatches = React.useMemo(
    () => batches.filter((b) => b.learnerIds?.includes(student.id)),
    [batches, student.id],
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm shadow-slate-200/50">
        <FormField label="HỌ VÀ TÊN*" value={student.fullName} />
        <FormField label="NGÀY SINH" value={formatDisplayDate(student.birthday)} />
        <FormField label="SỐ ĐIỆN THOẠI" value={student.phone} />
        <FormField label="EMAIL" value={student.email || 'Chưa cập nhật'} />
        <FormField label="NGƯỜI GIỚI THIỆU" value={student.referral || 'Trực tiếp'} />
        <FormField label="CCCD / CMND" value={student.idCard || 'Chưa cập nhật'} />

        <FormField label="NGÀY ĐĂNG KÝ" value={formatDisplayDate(student.registrationDate)} />
        <FormField label="NGÀY NHẬP HỌC" value={formatDisplayDate(student.enrollmentDate || '') || 'Chưa cập nhật'} />
        <div className="md:col-span-2">
          <FormField label="ĐỊA CHỈ" value={student.address || 'Chưa cập nhật'} />
        </div>
        <div className="md:col-span-2">
          <FormField label="TRẠNG THÁI" value={Array.isArray(student.status) ? student.status.join(', ') : student.status} />
        </div>
        <FormField label="NGƯỜI PHỤ TRÁCH (NGƯỜI THÊM)" value={student.createdByName || 'Chưa xác định'} />
        <FormField
          label="LỚP / DỰ ÁN ĐANG THAM GIA"
          value={
            joinedBatches.length > 0
              ? joinedBatches.map((b) => [b.code, b.courseTitle].filter(Boolean).join(' — ')).join(' | ')
              : 'Chưa xếp lớp'
          }
        />
      </div>
      <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm shadow-slate-200/50">
        <CustomFieldDetails moduleKey="students" values={student.customFields ?? {}} />
      </div>
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
