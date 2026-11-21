import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getAccessToken } from "../../services/authService";

export default function GymModule() {
  const { userProfile, logout } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const permissions = userProfile?.permissions || [];
  const isAdmin = userProfile?.role === "gym_admin" || permissions.some((code) => ["*", "gym-admin:manage"].includes(code));
  const isPt = userProfile?.role === "gym_pt" || permissions.some((code) => ["gym-pt:read", "gym-pt:manage"].includes(code));
  const isCustomer = userProfile?.role === "gym_customer" || permissions.some((code) => ["gym-customer:read", "gym-customer:manage"].includes(code));

  useEffect(() => {
    const token = getAccessToken();
    if (!token || !userProfile || (!isAdmin && !isPt && !isCustomer)) return;
    localStorage.setItem("gym:token", token);
    localStorage.setItem("gym:user", JSON.stringify({
      id: userProfile.uid,
      username: userProfile.email || userProfile.uid,
      fullName: userProfile.displayName,
      email: userProfile.email,
      avatarUrl: userProfile.photoURL || "",
      role: isAdmin ? "ADMIN" : isPt ? "PT" : "CUSTOMER",
    }));
    setReady(true);
    return () => {
      localStorage.removeItem("gym:token");
      localStorage.removeItem("gym:user");
    };
  }, [userProfile, isAdmin, isPt, isCustomer]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === "gym:logout") void logout();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [logout]);

  if (!isAdmin && !isPt && !isCustomer) return <div className="p-6 text-on-surface">Bạn chưa được cấp quyền Quản lý phòng Gym.</div>;
  if (!ready) return <div role="status" aria-busy="true" className="p-6 text-on-surface">Đang mở Quản lý phòng Gym...</div>;
  return <iframe ref={iframeRef} title="Quản lý phòng Gym" src="/chuoi-gym/" className="block min-h-0 w-full flex-1 border-0 bg-surface-container-lowest" />;
}
