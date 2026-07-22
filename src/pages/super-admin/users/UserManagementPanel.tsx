import React from "react";
import type { SuperAdminUser } from "../../../services/superAdminUserAccessService";
import { UserDetailDialog } from "./UserDetailDialog";
import { UserSearchPage } from "./UserSearchPage";

export function UserManagementPanel({ tenantId }: { tenantId: string }) {
  const [selectedUserId, setSelectedUserId] = React.useState<string>();
  const selectUser = (user: SuperAdminUser) => setSelectedUserId(user._id);

  return (
    <>
      <UserSearchPage tenantId={tenantId} onSelect={selectUser} />
      {selectedUserId && <UserDetailDialog tenantId={tenantId} userId={selectedUserId} onClose={() => setSelectedUserId(undefined)} />}
    </>
  );
}
