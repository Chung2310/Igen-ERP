import AssistantKnowledgeSettings from "../components/settings/AssistantKnowledgeSettings";
import { useAuth } from "../context/AuthContext";
export default function KnowledgeTab() {
  const { hasPermission } = useAuth();
  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <AssistantKnowledgeSettings canManage={hasPermission("knowledge:manage")} />
    </div>
  );
}
