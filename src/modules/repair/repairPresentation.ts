import type { RepairTicket } from '../../services/repairService';

export const repairSubjectLabels = {
  product: 'Sản phẩm',
  equipment: 'Thiết bị',
  service: 'Hạng mục dịch vụ',
};

export const repairSubjectKey = (ticket: RepairTicket) => ticket.subjectType && ticket.subjectType in repairSubjectLabels ? ticket.subjectType : 'unrecorded';
export const repairSubjectLabel = (ticket: RepairTicket) => {
  const key = repairSubjectKey(ticket);
  return key === 'unrecorded' ? 'Chưa phân loại' : repairSubjectLabels[key];
};
