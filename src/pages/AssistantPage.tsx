import { ChatbotWidget } from "../components/common/ChatbotWidget";
import { useAuth } from "../context/AuthContext";

export default function AssistantPage() {
  const { userProfile } = useAuth();
  if (!userProfile?.companyCode || !userProfile.uid) return null;

  return <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
    <ChatbotWidget mode="standalone" storageScope={`${userProfile.companyCode}:${userProfile.uid}`} />
  </div>;
}
