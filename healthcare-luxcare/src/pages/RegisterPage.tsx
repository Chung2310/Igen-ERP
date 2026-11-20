import { useEffect } from "react";

// Keep old bookmarks working after administrator-only account provisioning.
export default function RegisterPage() {
  useEffect(() => {
    window.location.replace("/dang-nhap");
  }, []);
  return null;
}
