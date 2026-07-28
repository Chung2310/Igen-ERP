export function getPartnerActionVisibility(canManagePartners: boolean) {
  return {
    configureCommission: canManagePartners,
    importPartners: canManagePartners,
    createPartner: canManagePartners,
    editPartner: canManagePartners,
    payCommission: canManagePartners,
    deletePartner: canManagePartners,
    exportPartners: true,
  };
}
