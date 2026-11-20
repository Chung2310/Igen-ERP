import React from "react";
import { Sparkles } from "lucide-react";
import type { SuperAdminUser } from "../../../services/superAdminUserAccessService";
import { UserDetailDialog } from "./UserDetailDialog";
import { UserSearchPage } from "./UserSearchPage";
import { CreateCompanyAdminDialog } from "./CreateCompanyAdminDialog";
import { CreateBlogAuthorDialog } from "./CreateBlogAuthorDialog";

export function UserManagementPanel({ tenantId }: { tenantId: string }) {
  const [selectedUserId, setSelectedUserId] = React.useState<string>();
  const [creatingAdmin, setCreatingAdmin] = React.useState(false);
  const [creatingAuthor, setCreatingAuthor] = React.useState(false);
  const [revision, setRevision] = React.useState(0);
  const selectUser = (user: SuperAdminUser) => setSelectedUserId(user._id);

  return (
    <>
      <div className="mx-auto mb-4 flex w-full max-w-6xl flex-wrap items-center justify-end gap-3">
        <button
          onClick={() => setCreatingAuthor(true)}
          className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-4 py-2 text-sm font-semibold text-amber-300 shadow-sm transition hover:from-amber-500/30 hover:to-orange-500/30 hover:border-amber-400"
        >
          <Sparkles className="h-4 w-4 text-amber-400" />
          Tạo Ban Biên Tập Blog (Tác giả)
        </button>
        <button
          onClick={() => setCreatingAdmin(true)}
          className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500"
        >
          Tạo quản trị viên doanh nghiệp
        </button>
      </div>
      <UserSearchPage key={`${tenantId}:${revision}`} tenantId={tenantId} onSelect={selectUser} />
      {creatingAuthor && (
        <CreateBlogAuthorDialog
          key={`author-${tenantId}`}
          tenantId={tenantId}
          onClose={() => setCreatingAuthor(false)}
          onCreated={() => {
            setCreatingAuthor(false);
            setRevision((value) => value + 1);
          }}
        />
      )}
      {creatingAdmin && (
        <CreateCompanyAdminDialog
          key={tenantId}
          tenantId={tenantId}
          onClose={() => setCreatingAdmin(false)}
          onCreated={() => {
            setCreatingAdmin(false);
            setRevision((value) => value + 1);
          }}
        />
      )}
      {selectedUserId && (
        <UserDetailDialog
          tenantId={tenantId}
          userId={selectedUserId}
          onClose={() => setSelectedUserId(undefined)}
          onDeleted={() => {
            setSelectedUserId(undefined);
            setRevision((value) => value + 1);
          }}
        />
      )}
    </>
  );
}
