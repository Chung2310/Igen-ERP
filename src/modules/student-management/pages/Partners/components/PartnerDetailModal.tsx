import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../lib/api';
import { ErpModal, ErpCard, ErpLoadingState, ErpEmptyState } from '../../../components/Erp/ErpUI';
import { formatVND, cn, getBankDisplayName, formatDisplayDate } from '../../../lib/utils';
import { AddPayoutModal } from './AddPayoutModal';
import { Handshake, Phone, Mail, Landmark, FileText, Plus, Landmark as BankIcon, Users, CheckCircle } from 'lucide-react';
import { Partner, PartnerPayout, PartnerReferredStudent } from '../../../types';
import { CustomFieldDetails } from '../../../../shared/custom-fields/CustomFieldDetails';
import { getOperationalStatusLabel, getWorkerOperationalCopy } from '../../../config/workerRecruitmentCopy';
import { ENTITY_LABEL_PRESETS, type EntityPreset } from '../../../config/entityLabels';

interface PartnerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  partnerId: string;
  onMutation?: () => void;
  entityPreset?: EntityPreset;
}

export function PartnerDetailModal({ isOpen, onClose, partnerId, onMutation, entityPreset = 'student' }: PartnerDetailModalProps) {
  const entityLabel = { ...ENTITY_LABEL_PRESETS[entityPreset], preset: entityPreset };
  const operationalCopy = getWorkerOperationalCopy(entityPreset);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'students' | 'payouts'>('info');
  const [showPayoutModal, setShowPayoutModal] = useState(false);

  const fetchPartnerDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/partners/${partnerId}`);
      if (res.success && res.data) {
        setPartner(res.data);
      }
    } catch (error) {
      console.error('Lỗi khi tải chi tiết đối tác:', error);
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    if (isOpen && partnerId) {
      setTimeout(() => {
        fetchPartnerDetail();
        setActiveTab('info');
      }, 0);
    }
  }, [isOpen, partnerId, fetchPartnerDetail]);

  const handlePayoutSuccess = () => {
    fetchPartnerDetail();
    if (onMutation) onMutation();
  };

  const getStatusBadge = (statusArray: string[] | string) => {
    const status = Array.isArray(statusArray) ? statusArray[0] : statusArray;
    switch (status) {
      case 'Đã đậu':
        return <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold">{getOperationalStatusLabel(entityLabel.preset, status)}</span>;
      case 'Thi lại':
      case 'Trượt':
        return <span className="px-2.5 py-1 bg-rose-50 text-rose-700 rounded-full text-[10px] font-bold">{getOperationalStatusLabel(entityLabel.preset, status)}</span>;
      case 'Đang học':
        return <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold">{getOperationalStatusLabel(entityLabel.preset, status)}</span>;
      case 'Chờ KSK':
        return <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-bold">Chờ KSK</span>;
      default:
        return <span className="px-2.5 py-1 bg-slate-55 bg-slate-100 text-slate-700 rounded-full text-[10px] font-bold">{status || 'Khác'}</span>;
    }
  };

  if (!isOpen) return null;

  return (
    <ErpModal title="Hồ sơ đối tác & CTV" onClose={onClose} maxWidth="max-w-4xl">
      {loading ? (
        <ErpLoadingState message="Đang tải hồ sơ đối tác..." />
      ) : !partner ? (
        <ErpEmptyState icon={Handshake} title="Không tìm thấy đối tác" />
      ) : (
        <div className="space-y-6 text-left">
          {/* Header Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80">
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-500 block">Đối tác</span>
              <h4 className="text-base font-bold text-slate-900 truncate">{partner.name}</h4>
              <p className="text-xs text-slate-500 font-normal">{partner.phone}</p>
            </div>
            <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-slate-200/80 pt-3 sm:pt-0 sm:pl-4">
              <span className="text-xs font-medium text-slate-500 block">Giới thiệu</span>
              <h4 className="text-base font-bold text-slate-900">{partner.referredStudentsCount} {operationalCopy.partnerReferralUnit}</h4>
              <p className="text-xs text-slate-500 font-normal">
                Cấp bậc: {' '}
                {partner.levelName === 'Mặc định'
                  ? 'Mặc định (1%)'
                  : `${partner.levelName} (${partner.commissionValue}%)`
                }
              </p>
            </div>
            <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-slate-200/80 pt-3 sm:pt-0 sm:pl-4">
              <span className="text-xs font-medium text-slate-500 block">Đã chi trả</span>
              <h4 className="text-base font-bold text-emerald-600">{formatVND(String(partner.totalPaid))}</h4>
              <p className="text-xs text-slate-500 font-normal">Tổng hoa hồng: {formatVND(String(partner.totalCommission))}</p>
            </div>
            <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-slate-200/80 pt-3 sm:pt-0 sm:pl-4">
              <span className="text-xs font-medium text-slate-500 block">Hoa hồng còn nợ</span>
              <h4 className="text-base font-bold text-rose-600">{formatVND(String(partner.unpaidBalance))}</h4>
              {partner.unpaidBalance > 0 && (
                <button
                  onClick={() => setShowPayoutModal(true)}
                  className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#00ADFC] hover:text-[#0095d9] transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Chi trả ngay
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200/80 gap-4">
            <button
              onClick={() => setActiveTab('info')}
              className={cn(
                "pb-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer",
                activeTab === 'info'
                  ? "border-[#00ADFC] text-[#00ADFC]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              Hồ sơ & Thanh toán
            </button>
            <button
              onClick={() => setActiveTab('students')}
              className={cn(
                "pb-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer",
                activeTab === 'students'
                  ? "border-[#00ADFC] text-[#00ADFC]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              {entityLabel.titleCase} giới thiệu ({partner.referredStudentsCount})
            </button>
            <button
              onClick={() => setActiveTab('payouts')}
              className={cn(
                "pb-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer",
                activeTab === 'payouts'
                  ? "border-[#00ADFC] text-[#00ADFC]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              Lịch sử chi trả ({(partner.payoutHistory || []).length})
            </button>
          </div>

          {/* Tabs Content */}
          <div className="space-y-4 pt-2">
            {activeTab === 'info' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-2">
                    <Handshake className="w-4 h-4 text-[#00ADFC]" />
                    Thông tin liên hệ
                  </h4>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3 text-xs text-slate-700">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span>Số điện thoại: <strong className="font-semibold text-slate-900">{partner.phone}</strong></span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-700">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span>Email: {partner.email || '(Chưa cung cấp)'}</span>
                    </div>
                    {partner.notes && (
                      <div className="flex items-start gap-3 text-xs text-slate-700">
                        <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
                        <span>Ghi chú: {partner.notes}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-2">
                    <BankIcon className="w-4 h-4 text-[#00ADFC]" />
                    Tài khoản nhận hoa hồng
                  </h4>
                  {partner.bankAccountNo ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-3 text-xs text-slate-700">
                        <Landmark className="w-4 h-4 text-slate-400" />
                        <span>Ngân hàng: <span className="font-semibold text-slate-900">{getBankDisplayName(partner.bankName) || 'N/A'}</span></span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-700">
                        <CheckCircle className="w-4 h-4 text-slate-400" />
                        <span>Số tài khoản: <span className="font-semibold text-slate-900 tracking-wider">{partner.bankAccountNo}</span></span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-700">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span>Chủ tài khoản: <span className="font-semibold text-slate-900 uppercase">{partner.bankAccountName || 'N/A'}</span></span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 font-normal italic">Chưa bổ sung tài khoản ngân hàng chi trả.</p>
                  )}
                </div>
                <div className="md:col-span-2">
                  <CustomFieldDetails moduleKey="partners" values={partner.customFields || {}} />
                </div>
              </div>
            )}

            {activeTab === 'students' && (
              <ErpCard className="overflow-hidden border border-slate-200/80">
                {partner.referredStudents.length === 0 ? (
                  <ErpEmptyState
                    icon={Users}
                    title={`Chưa giới thiệu ${entityLabel.singular} nào`}
                    subtitle={`Tài khoản này chưa được gán giới thiệu cho bất kỳ ${entityLabel.singular} nào trong hệ thống.`}
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50/70 border-b border-slate-200/80 text-xs font-semibold text-slate-600">
                          <th className="py-3 px-4 text-left font-semibold text-slate-700">Họ và tên</th>
                          <th className="py-3 px-4 text-left font-semibold text-slate-700">Số điện thoại</th>
                          <th className="py-3 px-4 text-left font-semibold text-slate-700">{entityPreset === 'customer' ? 'Ngày bắt đầu sử dụng' : entityPreset === 'worker' ? 'Ngày tiếp nhận' : 'Ngày nhập học'}</th>
                          <th className="py-3 px-4 text-left font-semibold text-slate-700">Trạng thái</th>
                          <th className="py-3 px-4 text-right font-semibold text-slate-700">Hoa hồng tích lũy</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {partner.referredStudents.map((student: PartnerReferredStudent) => (
                          <tr key={student._id} className="hover:bg-slate-50/60 transition-colors text-slate-700">
                            <td className="py-3 px-4 font-semibold text-slate-900">{student.fullName}</td>
                            <td className="py-3 px-4 font-normal text-slate-600">{student.phone}</td>
                            <td className="py-3 px-4 font-normal text-slate-600">{formatDisplayDate(student.registrationDate)}</td>
                            <td className="py-3 px-4">{getStatusBadge(student.status)}</td>
                            <td className="py-3 px-4 text-right font-semibold tabular-nums text-[#007EB8]">
                              {formatVND(String(student.commission))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </ErpCard>
            )}

            {activeTab === 'payouts' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-900">Lịch sử thanh toán chi tiết</h4>
                  <button
                    onClick={() => setShowPayoutModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#00ADFC] hover:bg-[#0095d9] text-white rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Ghi nhận chi trả
                  </button>
                </div>

                <ErpCard className="overflow-hidden border border-slate-200/80">
                  {(!partner.payoutHistory || partner.payoutHistory.length === 0) ? (
                    <ErpEmptyState
                      icon={Landmark}
                      title="Chưa có lịch sử thanh toán"
                      subtitle="Bấm nút 'Ghi nhận chi trả' để ghi chép lại các lần chuyển tiền hoa hồng cho đối tác này."
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50/70 border-b border-slate-200/80 text-xs font-semibold text-slate-600">
                            <th className="py-3 px-4 text-left font-semibold text-slate-700">Ngày chi</th>
                            <th className="py-3 px-4 text-left font-semibold text-slate-700">Phương thức</th>
                            <th className="py-3 px-4 text-left font-semibold text-slate-700">Ghi chú giao dịch</th>
                            <th className="py-3 px-4 text-right font-semibold text-slate-700">Số tiền trả</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {partner.payoutHistory.map((payout: PartnerPayout) => (
                            <tr key={payout.id} className="hover:bg-slate-50/60 transition-colors text-slate-700">
                              <td className="py-3 px-4 font-semibold text-slate-900">{payout.date}</td>
                              <td className="py-3 px-4">
                                <span className={cn(
                                  "px-2.5 py-0.5 rounded-full text-xs font-semibold",
                                  payout.method === 'Tiền mặt' ? "bg-amber-50 text-amber-700 border border-amber-100" : "bg-sky-50 text-[#007EB8] border border-sky-100"
                                )}>
                                  {payout.method}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-500 font-normal max-w-xs truncate">{payout.note || '(Không có)'}</td>
                              <td className="py-3 px-4 text-right font-semibold tabular-nums text-slate-900">{formatVND(String(payout.amount))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </ErpCard>
              </div>
            )}
          </div>

          {/* Add Payout Modal Popup */}
          <AddPayoutModal
            isOpen={showPayoutModal}
            onClose={() => setShowPayoutModal(false)}
            onSuccess={handlePayoutSuccess}
            partnerId={partner._id}
            partnerName={partner.name}
            unpaidBalance={partner.unpaidBalance}
            bankName={partner.bankName}
            bankAccountNo={partner.bankAccountNo}
            bankAccountName={partner.bankAccountName}
          />
        </div>
      )}
    </ErpModal>
  );
}
