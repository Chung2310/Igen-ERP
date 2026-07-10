import React, { useState, useEffect } from 'react';
import { toast } from '../../../../../pages/Toast';
import { useAuth } from '../../../../../context/AuthContext';
import { useAdminCenters } from '../../../hooks/useAdminCenters';
import { apiFetch } from '../../../lib/api';
import { ErpModal, ErpField, ErpInput, ErpSelect, ErpSubmitButton } from '../../../components/Erp/ErpUI';
import { formatVND } from '../../../lib/utils';
import { Loader2 } from 'lucide-react';
import { Partner } from '../../../types';

interface AddPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  partner?: Partner;
}

export function AddPartnerModal({ isOpen, onClose, onSuccess, partner }: AddPartnerModalProps) {
  
  const { userProfile: user } = useAuth();
  const { centers } = useAdminCenters();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    commissionType: 'fixed' as 'fixed' | 'percentage',
    commissionValue: '',
    bankName: '',
    bankAccountNo: '',
    bankAccountName: '',
    isActive: true,
    notes: '',
    centerId: '',
  });

  useEffect(() => {
    setTimeout(() => {
      if (partner) {
        setFormData({
          name: partner.name || '',
          phone: partner.phone || '',
          email: partner.email || '',
          commissionType: partner.commissionType || 'fixed',
          commissionValue: partner.commissionType === 'fixed'
            ? formatVND(String(partner.commissionValue))
            : String(partner.commissionValue),
          bankName: partner.bankName || '',
          bankAccountNo: partner.bankAccountNo || '',
          bankAccountName: partner.bankAccountName || '',
          isActive: partner.isActive !== false,
          notes: partner.notes || '',
          centerId: partner.ownerId || '',
        });
      } else {
        setFormData({
          name: '',
          phone: '',
          email: '',
          commissionType: 'fixed',
          commissionValue: '',
          bankName: '',
          bankAccountNo: '',
          bankAccountName: '',
          isActive: true,
          notes: '',
          centerId: '',
        });
      }
    }, 0);
  }, [partner, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.phone.trim()) {
      toast.error('Vui lòng điền đầy đủ tên và số điện thoại.');
      return;
    }

    if (user?.role === 'superadmin' && !partner && !formData.centerId) {
      toast.error('Vui lòng chọn trung tâm quản lý cho đối tác này.');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = partner ? `/partners/${partner._id}` : '/partners';
      const method = partner ? 'PATCH' : 'POST';

      const payload = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        bankName: formData.bankName,
        bankAccountNo: formData.bankAccountNo,
        bankAccountName: formData.bankAccountName,
        isActive: formData.isActive,
        notes: formData.notes,
        ...(user?.role === 'superadmin' && !partner ? { centerId: formData.centerId } : {}),
      };

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(payload),
      });

      if (res.success) {
        toast.success(partner ? 'Đã cập nhật thông tin đối tác thành công!' : 'Đã thêm đối tác mới thành công!');
        onSuccess();
        onClose();
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Lỗi lưu thông tin đối tác.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <ErpModal title={partner ? 'Cập nhật đối tác' : 'Thêm đối tác mới'} onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4 text-left grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {user?.role === 'superadmin' && !partner && (
          <div className="md:col-span-2">
            <ErpField label="Trung tâm quản lý *">
              <ErpSelect name="centerId" value={formData.centerId} onChange={handleInputChange} required>
                <option value="">-- Chọn trung tâm quản lý --</option>
                {centers.map(center => (
                  <option key={center.uid} value={center.uid}>
                    {center.displayName} ({center.email})
                  </option>
                ))}
              </ErpSelect>
            </ErpField>
          </div>
        )}

        <ErpField label="Tên đối tác / Cộng tác viên *">
          <ErpInput
            name="name"
            required
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Nhập tên đối tác..."
          />
        </ErpField>

        <ErpField label="Số điện thoại *">
          <ErpInput
            name="phone"
            required
            value={formData.phone}
            onChange={handleInputChange}
            placeholder="Nhập số điện thoại..."
          />
        </ErpField>

        <ErpField label="Email">
          <ErpInput
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="Nhập địa chỉ email..."
          />
        </ErpField>

        <ErpField label="Trạng thái hoạt động">
          <ErpSelect
            name="isActive"
            value={formData.isActive ? 'true' : 'false'}
            onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.value === 'true' }))}
          >
            <option value="true">Đang hoạt động</option>
            <option value="false">Ngưng hoạt động</option>
          </ErpSelect>
        </ErpField>

        <div className="md:col-span-2 border-t border-slate-100 my-2 pt-2">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Quy tắc tính hoa hồng</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
            Hệ thống sẽ tự động xếp cấp bậc (Level) hoa hồng cho đối tác dựa trên tổng doanh số học phí tích lũy mà họ giới thiệu được. Tỷ lệ hoa hồng (%) sẽ thay đổi tương ứng theo từng mốc cấu hình chung.
          </p>
        </div>

        <div className="md:col-span-2 border-t border-slate-100 my-2 pt-2">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Tài khoản ngân hàng chi trả</h4>
        </div>

        <ErpField label="Ngân hàng (VietQR)">
          <ErpSelect
            name="bankName"
            value={formData.bankName}
            onChange={handleInputChange}
          >
            <option value="">-- Chọn ngân hàng --</option>
            <option value="mbbank">MBBank (MB)</option>
            <option value="vietcombank">Vietcombank (VCB)</option>
            <option value="techcombank">Techcombank (TCB)</option>
            <option value="vietinbank">Vietinbank (CTG)</option>
            <option value="bidv">BIDV</option>
            <option value="agribank">Agribank (VBA)</option>
            <option value="acb">ACB</option>
            <option value="sacombank">Sacombank (STB)</option>
            <option value="tpbank">TPBank (TPB)</option>
            <option value="vpbank">VPBank (VPB)</option>
          </ErpSelect>
        </ErpField>

        <ErpField label="Số tài khoản">
          <ErpInput
            name="bankAccountNo"
            value={formData.bankAccountNo}
            onChange={(e) => setFormData(prev => ({ ...prev, bankAccountNo: e.target.value.replace(/\D/g, '') }))}
            placeholder="Nhập số tài khoản..."
          />
        </ErpField>

        <ErpField label="Tên chủ tài khoản">
          <ErpInput
            name="bankAccountName"
            value={formData.bankAccountName}
            onChange={handleInputChange}
            placeholder="Nhập tên chủ tài khoản (viết hoa không dấu)..."
          />
        </ErpField>

        <ErpField label="Ghi chú">
          <ErpInput
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            placeholder="Ghi chú thêm về đối tác này..."
          />
        </ErpField>

        <div className="md:col-span-2 mt-4">
          <ErpSubmitButton disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang lưu...
              </span>
            ) : (
              partner ? 'Cập nhật đối tác' : 'Khai báo đối tác'
            )}
          </ErpSubmitButton>
        </div>
      </form>
    </ErpModal>
  );
}
