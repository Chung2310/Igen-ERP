import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, ChevronDown, Loader2 } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../../../context/AuthContext';
import { toast } from '../../../../pages/Toast';
import { useBatches } from '../../hooks/useBatches';
import { useAdminCenters } from '../../hooks/useAdminCenters';
import { formatVND, toInputDate, toDisplayDate } from '../../lib/utils';
import { Student, Partner } from '../../types';
import { findDuplicateStudentField } from '../../lib/studentUniqueness';
import { FormInput } from './components/StudentFormFields';

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (student: Student) => void;
  students: Student[];
  selectedCenter?: string;
}

export function AddStudentModal({ isOpen, onClose, onSuccess, students, selectedCenter }: AddStudentModalProps) {
  const { userProfile: user } = useAuth();
  
  const { batches } = useBatches();
  const { centers } = useAdminCenters();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [batchId, setBatchId] = useState('');
  const [selectedCenterId, setSelectedCenterId] = useState<string>(() => {
    return selectedCenter && selectedCenter !== 'all' ? selectedCenter : '';
  });
  const [prevSelectedCenter, setPrevSelectedCenter] = useState(selectedCenter);

  if (selectedCenter !== prevSelectedCenter) {
    setPrevSelectedCenter(selectedCenter);
    setSelectedCenterId(selectedCenter && selectedCenter !== 'all' ? selectedCenter : '');
  }

  const [referralMode, setReferralMode] = useState<'none' | 'partner' | 'custom'>('none');
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const ownerId = user?.role === 'superadmin' ? selectedCenterId : undefined;
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
    if (isOpen) {
      fetchPartners();
    }
  }, [isOpen, selectedCenterId, user]);

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    referral: '',
    partnerId: '',
    birthday: '',
    idCard: '',
    registrationDate: new Date().toLocaleDateString('vi-VN'),
    enrollmentDate: '',
    fee: '',
    address: '',
    email: '',
  });

  const getRequiredFieldsConfig = () => {
    const saved = localStorage.getItem('requiredFieldsConfig');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing requiredFieldsConfig', e);
      }
    }
    return {
      fullName: true,
      phone: true,
      birthday: false,
      idCard: false,
      email: false
    };
  };

  const requiredFields = getRequiredFieldsConfig();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!user) {
      setErrorMsg('Vui lòng đăng nhập để lưu hồ sơ học viên.');
      return;
    }

    const missingFields: string[] = [];
    if (requiredFields.fullName && !formData.fullName) missingFields.push('Họ và tên');
    if (requiredFields.phone && !formData.phone) missingFields.push('Số điện thoại');
    if (requiredFields.birthday && !formData.birthday) missingFields.push('Ngày sinh');
    if (requiredFields.idCard && !formData.idCard) missingFields.push('CCCD/CMND');
    if (requiredFields.email && !formData.email) missingFields.push('Email');

    if (missingFields.length > 0) {
      const message = `Vui lòng điền đầy đủ các trường bắt buộc: ${missingFields.join(', ')}`;
      setErrorMsg(message);
      toast.error(message);
      return;
    }

    const duplicateField = findDuplicateStudentField(students, {
      email: formData.email,
      phone: formData.phone,
      idCard: formData.idCard,
    }, undefined, 'general');
    if (duplicateField) {
      const message = `${duplicateField.label} đã tồn tại trong hệ thống, không được trùng.`;
      setErrorMsg(message);
      toast.error(message);
      return;
    }

    if (user?.role === 'superadmin' && !selectedCenterId) {
      const message = "Vui lòng chọn công ty quản lý học viên.";
      setErrorMsg(message);
      toast.error(message);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/students', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          birthday: toDisplayDate(formData.birthday),
          enrollmentDate: toDisplayDate(formData.enrollmentDate),
          fee: '',
          idCardFront: '',
          idCardBack: '',
          status: ['Đang học'],
          registrationDate: new Date().toLocaleDateString('vi-VN'),
          centerId: selectedCenterId || undefined,
          partnerId: formData.partnerId || undefined,
        }),
      });

      if (res.success && res.data) {
        const studentWithId = { id: res.data._id, ...res.data };

        if (batchId) {
          try {
            await apiFetch(`/batches/${batchId}/learners`, {
              method: 'POST',
              body: JSON.stringify({ studentId: res.data._id }),
            });
            window.dispatchEvent(new Event('batch-mutation'));
          } catch (batchError: unknown) {
            const msg = batchError instanceof Error ? batchError.message : 'Không thể xếp lớp.';
            toast.warning(`Đã tạo học viên nhưng chưa xếp được vào lớp: ${msg}`);
          }
        }

        window.dispatchEvent(new Event('student-mutation'));
        toast.success('Đã lưu hồ sơ học viên thành công!');
        onClose();
        onSuccess(studentWithId);

        setFormData({
          fullName: '',
          phone: '',
          referral: '',
          partnerId: '',
          birthday: '',
          idCard: '',
          registrationDate: new Date().toLocaleDateString('vi-VN'),
          enrollmentDate: '',
          fee: '',
          address: '',
          email: '',
        });
        setReferralMode('none');
        setBatchId('');
        setSelectedCenterId(selectedCenter && selectedCenter !== 'all' ? selectedCenter : '');
      }
    } catch (error: unknown) {
      console.error('Error saving student:', error);
      const message = error instanceof Error ? error.message : 'Lỗi lưu hồ sơ học viên.';
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'fee' ? formatVND(value) : value }));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <h2 className="text-base font-bold text-slate-800">Thêm học viên mới</h2>
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="p-1.5 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form className="p-6 overflow-y-auto space-y-4" onSubmit={handleSubmit}>
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-sm font-bold text-rose-600">
                  {errorMsg}
                </div>
              )}

              {user?.role === 'superadmin' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">
                    Trung tâm quản lý *
                  </label>
                  <div className="relative">
                    <select
                      value={selectedCenterId}
                      onChange={(e) => setSelectedCenterId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-4 focus:ring-cyan-600/5 focus:border-cyan-600 transition-all cursor-pointer"
                    >
                      <option value="">-- Chọn trung tâm quản lý --</option>
                      {centers.map(center => (
                        <option key={center.uid} value={center.uid}>
                          {center.displayName} ({center.email})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}

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
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">
                    Xếp vào lớp (tùy chọn)
                  </label>
                  <div className="relative">
                    <select
                      value={batchId}
                      onChange={(e) => setBatchId(e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-4 focus:ring-cyan-600/5 focus:border-cyan-600 transition-all cursor-pointer"
                    >
                      <option value="">-- Chưa xếp lớp --</option>
                      {batches
                        .filter(b => b.status !== 'Đã kết thúc')
                        .map(b => (
                          <option key={b.id} value={b.id}>
                            {b.code} — {b.courseTitle}
                          </option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <FormInput
                  label="Ngày đăng ký"
                  name="registrationDate"
                  value={formData.registrationDate}
                  onChange={handleInputChange}
                  readOnly
                />
                <FormInput
                  label="Ngày nhập học"
                  name="enrollmentDate"
                  type="date"
                  value={toInputDate(formData.enrollmentDate)}
                  onChange={handleInputChange}
                />
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-800 uppercase tracking-wider">
                    Học phí đã chốt
                  </label>
                  <div className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500">
                    Sẽ lấy tự động từ khóa học khi xếp lớp.
                  </div>
                </div>
                <FormInput
                  label="Địa chỉ"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Nhập địa chỉ..."
                  className="sm:col-span-2"
                />
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
                  className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-100 transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isSubmitting ? 'Đang lưu...' : 'Lưu hồ sơ'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
