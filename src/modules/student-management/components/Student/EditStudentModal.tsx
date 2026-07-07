import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, Loader2, ChevronDown } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { toast } from '../../../../pages/Toast';
import { Student, Partner } from '../../types';
import { cn, toInputDate, toDisplayDate } from '../../lib/utils';
import { findDuplicateStudentField } from '../../lib/studentUniqueness';
import { useAuth } from '../../../../context/AuthContext';
import { FormInput } from './components/StudentFormFields';

interface EditStudentModalProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  students: Student[];
}

export function EditStudentModal({ student, isOpen, onClose, onSuccess, students }: EditStudentModalProps) {
  const { userProfile: user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [referralMode, setReferralMode] = useState<'none' | 'partner' | 'custom'>('none');
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const ownerId = student?.centerId || student?.ownerId;
        const params = new URLSearchParams({ isActive: 'true' });
        if (ownerId) params.append('ownerFilter', ownerId);

        const res = await apiFetch(`/partners?${params.toString()}`);
        if (res.success && res.partners) {
          setPartners(res.partners);
        }
      } catch (error) {
        console.error('Failed to fetch partners:', error);
      }
    };
    if (isOpen && student) {
      fetchPartners();
    }
  }, [isOpen, student]);

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    referral: '',
    partnerId: '',
    birthday: '',
    idCard: '',
    registrationDate: '',
    enrollmentDate: '',
    fee: '',
    address: '',
    email: '',
    status: [] as string[],
  });

  useEffect(() => {
    if (student) {
      setTimeout(() => {
        const isPartnerRef = !!student.partnerId;
        const isCustomRef = !student.partnerId && !!student.referral;
        setReferralMode(isPartnerRef ? 'partner' : (isCustomRef ? 'custom' : 'none'));

        setFormData({
          fullName: student.fullName || '',
          email: student.email || '',
          phone: student.phone || '',
          referral: student.referral || '',
          partnerId: student.partnerId || '',
          birthday: student.birthday || '',
          idCard: student.idCard || '',
          registrationDate: student.registrationDate || '',
          enrollmentDate: student.enrollmentDate || '',
          fee: student.fee || '',
          address: student.address || '',
          status: Array.isArray(student.status) ? student.status : (student.status ? [student.status] : []),
        });
      }, 0);
    }
  }, [student]);

  const getRequiredFieldsConfig = () => {
    const saved = localStorage.getItem('requiredFieldsConfig');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing requiredFieldsConfig', e);
      }
    }
    return { fullName: true, phone: true, birthday: false, idCard: false, email: false };
  };
  const requiredFields = getRequiredFieldsConfig();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missingFields: string[] = [];
    if (requiredFields.fullName && !formData.fullName) missingFields.push('Họ và tên');
    if (requiredFields.phone && !formData.phone) missingFields.push('Số điện thoại');
    if (requiredFields.birthday && !formData.birthday) missingFields.push('Ngày sinh');
    if (requiredFields.idCard && !formData.idCard) missingFields.push('CCCD/CMND');
    if (requiredFields.email && !formData.email) missingFields.push('Email');

    if (missingFields.length > 0) {
      toast.error(`Vui lòng điền đầy đủ các trường bắt buộc: ${missingFields.join(', ')}`);
      return;
    }

    const duplicateField = findDuplicateStudentField(
      students,
      {
        email: formData.email,
        phone: formData.phone,
        idCard: formData.idCard,
      },
      student?.id,
      'general'
    );
    if (duplicateField) {
      toast.error(`${duplicateField.label} đã tồn tại trong hệ thống, không được trùng.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        birthday: toDisplayDate(formData.birthday),
        enrollmentDate: toDisplayDate(formData.enrollmentDate),
        partnerId: formData.partnerId || "",
      };
      await apiFetch(`/students/${student?.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      window.dispatchEvent(new Event('student-mutation'));
      toast.success('Đã cập nhật thông tin học viên thành công!');
      onSuccess();
      onClose();
    } catch (error: unknown) {
      console.error('Error updating student:', error);
      toast.error(error instanceof Error ? error.message : 'Có lỗi xảy ra khi cập nhật thông tin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <AnimatePresence>
      {isOpen && student && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <h2 className="text-base font-bold text-slate-800">Chỉnh sửa thông tin học viên</h2>
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="p-1.5 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form className="p-6 overflow-y-auto space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <FormInput
                  label="Họ và tên"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  required={requiredFields.fullName}
                  placeholder="Nhập họ và tên..."
                />
                <FormInput
                  label="Số điện thoại"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required={requiredFields.phone}
                  placeholder="Nhập số điện thoại..."
                />
                <FormInput
                  label="Email học viên"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required={requiredFields.email}
                  placeholder="Nhập địa chỉ email..."
                  className="sm:col-span-2"
                />
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">
                    Nguồn giới thiệu
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="relative">
                      <select
                        value={referralMode}
                        onChange={(e) => {
                          const mode = e.target.value as 'none' | 'partner' | 'custom';
                          setReferralMode(mode);
                          if (mode === 'none') {
                            setFormData(prev => ({ ...prev, partnerId: '', referral: '' }));
                          } else if (mode === 'custom') {
                            setFormData(prev => ({ ...prev, partnerId: '', referral: '' }));
                          } else {
                            setFormData(prev => ({ ...prev, partnerId: partners[0]?._id || '', referral: partners[0]?.name || '' }));
                          }
                        }}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-4 focus:ring-cyan-600/5 focus:border-cyan-600 transition-all cursor-pointer"
                      >
                        <option value="none">Không có giới thiệu</option>
                        <option value="partner">Đối tác / CTV hệ thống</option>
                        <option value="custom">Nhập người giới thiệu khác</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>

                    {referralMode === 'partner' && (
                      <div className="relative">
                        <select
                          value={formData.partnerId}
                          onChange={(e) => {
                            const pId = e.target.value;
                            const pObj = partners.find(p => p._id === pId);
                            setFormData(prev => ({ ...prev, partnerId: pId, referral: pObj ? pObj.name : '' }));
                          }}
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-4 focus:ring-cyan-600/5 focus:border-cyan-600 transition-all cursor-pointer"
                        >
                          <option value="">-- Chọn đối tác --</option>
                          {partners.map(p => (
                            <option key={p._id} value={p._id}>
                              {p.name} ({p.phone})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    )}

                    {referralMode === 'custom' && (
                      <input
                        type="text"
                        name="referral"
                        value={formData.referral}
                        onChange={handleInputChange}
                        placeholder="Nhập tên người giới thiệu..."
                        className="w-full h-10 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-cyan-600 transition-all"
                      />
                    )}
                  </div>
                </div>
                <FormInput
                  label="Ngày sinh"
                  name="birthday"
                  type="date"
                  value={toInputDate(formData.birthday)}
                  onChange={handleInputChange}
                  required={requiredFields.birthday}
                />
                <FormInput
                  label="CCCD / CMND"
                  name="idCard"
                  value={formData.idCard}
                  onChange={handleInputChange}
                  required={requiredFields.idCard}
                  placeholder="Nhập số CCCD (12 số)..."
                />

                <FormInput
                  label="Ngày đăng ký"
                  name="registrationDate"
                  value={formData.registrationDate}
                  onChange={handleInputChange}
                  placeholder="DD/MM/YYYY"
                  readOnly
                />
                <FormInput
                  label="Ngày nhập học"
                  name="enrollmentDate"
                  type="date"
                  value={toInputDate(formData.enrollmentDate)}
                  onChange={handleInputChange}
                />
                <FormInput
                  label="Học phí đã chốt (VND)"
                  name="fee"
                  value={formData.fee}
                  onChange={handleInputChange}
                  placeholder="Nhập học phí đã chốt..."
                />
                <FormInput
                  label="Địa chỉ"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Nhập địa chỉ..."
                  className="sm:col-span-2"
                />

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">
                    Trạng thái (Chọn nhiều)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    {['Đang học', 'Đã đậu', 'Thi lại', 'Nghỉ học', 'Nợ học phí'].map((st) => {
                      const isChecked = formData.status.includes(st);
                      return (
                        <label
                          key={st}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all select-none",
                            isChecked
                              ? "bg-cyan-50 border-cyan-200 text-cyan-700 shadow-sm"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setFormData(prev => {
                                const current = prev.status || [];
                                const next = current.includes(st)
                                  ? current.filter(x => x !== st)
                                  : [...current, st];
                                return { ...prev, status: next };
                              });
                            }}
                            className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 w-3.5 h-3.5"
                          />
                          {st}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-4 pt-4 mt-2 border-t border-slate-50 flex-shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-brand-primary hover:bg-brand-primary/95 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-100 transition-all disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Lưu học viên
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
