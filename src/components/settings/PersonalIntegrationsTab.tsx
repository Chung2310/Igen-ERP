import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle, Facebook, RefreshCw, Trash2, User, MessageCircleMore } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { socialIntegrationService, SocialIntegration } from "../../services/socialIntegrationService";
import { toast } from "../../pages/Toast";

export default function PersonalIntegrationsTab() {
  const {
    userProfile,
    saveFacebookIntegration,
    removeFacebookIntegration,
    saveZaloIntegration,
    removeZaloIntegration,
  } = useAuth();

  const [companyIntegrations, setCompanyIntegrations] = useState<SocialIntegration[]>([]);
  const [loadingCompanyIntegrations, setLoadingCompanyIntegrations] = useState(false);
  const [savingFacebook, setSavingFacebook] = useState(false);
  const [savingZalo, setSavingZalo] = useState(false);

  const [facebookForm, setFacebookForm] = useState({
    pageId: "",
    pageName: "",
    pageAccessToken: "",
    appSecret: "",
    verifyToken: "",
  });
  const [zaloForm, setZaloForm] = useState({
    oaId: "",
    oaName: "",
    accessToken: "",
    refreshToken: "",
  });

  useEffect(() => {
    setFacebookForm({
      pageId: userProfile?.facebookIntegration?.pageId || "",
      pageName: userProfile?.facebookIntegration?.pageName || "",
      pageAccessToken: userProfile?.facebookIntegration?.pageAccessToken || "",
      appSecret: userProfile?.facebookIntegration?.appSecret || "",
      verifyToken: userProfile?.facebookIntegration?.verifyToken || "",
    });
    setZaloForm({
      oaId: userProfile?.zaloIntegration?.oaId || "",
      oaName: userProfile?.zaloIntegration?.oaName || "",
      accessToken: userProfile?.zaloIntegration?.accessToken || "",
      refreshToken: userProfile?.zaloIntegration?.refreshToken || "",
    });
  }, [userProfile]);

  useEffect(() => {
    let cancelled = false;

    const loadCompanyIntegrations = async () => {
      setLoadingCompanyIntegrations(true);
      try {
        const data = await socialIntegrationService.getIntegrations();
        if (!cancelled) {
          setCompanyIntegrations(data || []);
        }
      } catch (error: any) {
        console.error(error);
        if (!cancelled) {
          toast.error(error.message || "Khong the tai kenh doanh nghiep.");
        }
      } finally {
        if (!cancelled) {
          setLoadingCompanyIntegrations(false);
        }
      }
    };

    void loadCompanyIntegrations();
    return () => {
      cancelled = true;
    };
  }, []);

  const companyFacebookIntegration = useMemo(
    () => companyIntegrations.find((item) => item.platform === "Facebook" && item.isConnected) || null,
    [companyIntegrations]
  );
  const companyZaloIntegration = useMemo(
    () => companyIntegrations.find((item) => item.platform === "Zalo" && item.isConnected) || null,
    [companyIntegrations]
  );

  const handleSaveFacebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facebookForm.pageId.trim() || !facebookForm.pageAccessToken.trim()) {
      toast.error("Vui long nhap Page ID va Page Access Token.");
      return;
    }

    setSavingFacebook(true);
    try {
      await saveFacebookIntegration({
        isConnected: true,
        pageId: facebookForm.pageId.trim(),
        pageName: facebookForm.pageName.trim(),
        pageAccessToken: facebookForm.pageAccessToken.trim(),
        appSecret: facebookForm.appSecret.trim() || undefined,
        verifyToken: facebookForm.verifyToken.trim() || undefined,
        connectedAt: new Date().toISOString(),
      });
    } finally {
      setSavingFacebook(false);
    }
  };

  const handleSaveZalo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zaloForm.oaId.trim() || !zaloForm.oaName.trim() || !zaloForm.accessToken.trim()) {
      toast.error("Vui long nhap OA ID, ten OA va Access Token.");
      return;
    }

    setSavingZalo(true);
    try {
      await saveZaloIntegration({
        isConnected: true,
        oaId: zaloForm.oaId.trim(),
        oaName: zaloForm.oaName.trim(),
        accessToken: zaloForm.accessToken.trim(),
        refreshToken: zaloForm.refreshToken.trim(),
        connectedAt: new Date().toISOString(),
      });
    } finally {
      setSavingZalo(false);
    }
  };

  const renderSourceSummary = (
    title: string,
    personal: { name: string; identifier: string } | null,
    company: { name: string; identifier: string } | null
  ) => {
    const activeSource = personal ? "personal" : company ? "company" : null;

    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">{title}</h4>
            <p className="mt-1 text-[11px] text-slate-500">
              He thong uu tien kenh ca nhan truoc. Neu tai khoan hien tai chua ket noi, bot moi dung kenh doanh nghiep.
            </p>
          </div>
          <span className={`rounded-full px-2 py-1 text-[9px] font-extrabold uppercase ${
            activeSource === "personal"
              ? "bg-emerald-100 text-emerald-700"
              : activeSource === "company"
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-200 text-slate-600"
          }`}>
            {activeSource === "personal" ? "Dang dung ca nhan" : activeSource === "company" ? "Dang fallback company" : "Chua ket noi"}
          </span>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div className="rounded-xl border border-emerald-100 bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Kenh ca nhan</p>
            {personal ? (
              <>
                <p className="mt-2 text-[11px] font-bold text-slate-700">{personal.name}</p>
                <p className="mt-1 font-mono text-[10px] text-slate-500">{personal.identifier}</p>
              </>
            ) : (
              <p className="mt-2 text-[10px] text-slate-400">Chua ket noi cho tai khoan hien tai.</p>
            )}
          </div>

          <div className="rounded-xl border border-amber-100 bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Kenh doanh nghiep</p>
            {company ? (
              <>
                <p className="mt-2 text-[11px] font-bold text-slate-700">{company.name}</p>
                <p className="mt-1 font-mono text-[10px] text-slate-500">{company.identifier}</p>
              </>
            ) : (
              <p className="mt-2 text-[10px] text-slate-400">Doanh nghiep chua cau hinh kenh nay.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-xs">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="text-left">
            <h3 className="flex items-center gap-2 text-base font-bold text-gray-800">
              <User className="h-5 w-5 text-emerald-600" />
              MXH Ca Nhan
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Cau hinh rieng cho tai khoan dang dang nhap. Sua o day chi anh huong tai khoan hien tai.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              setLoadingCompanyIntegrations(true);
              try {
                const data = await socialIntegrationService.getIntegrations();
                setCompanyIntegrations(data || []);
              } catch (error: any) {
                toast.error(error.message || "Khong the tai lai danh sach.");
              } finally {
                setLoadingCompanyIntegrations(false);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[11px] font-bold text-gray-600"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingCompanyIntegrations ? "animate-spin" : ""}`} />
            Tai lai
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {renderSourceSummary(
            "Facebook",
            userProfile?.facebookIntegration?.isConnected
              ? {
                  name: userProfile.facebookIntegration.pageName || "Facebook Page ca nhan",
                  identifier: userProfile.facebookIntegration.pageId || "",
                }
              : null,
            companyFacebookIntegration
              ? {
                  name: companyFacebookIntegration.displayName || "Facebook Page doanh nghiep",
                  identifier: companyFacebookIntegration.username || "",
                }
              : null
          )}

          {renderSourceSummary(
            "Zalo",
            userProfile?.zaloIntegration?.isConnected
              ? {
                  name: userProfile.zaloIntegration.oaName || "Zalo OA ca nhan",
                  identifier: userProfile.zaloIntegration.oaId || "",
                }
              : null,
            companyZaloIntegration
              ? {
                  name: companyZaloIntegration.displayName || "Zalo OA doanh nghiep",
                  identifier: companyZaloIntegration.username || "",
                }
              : null
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2 text-left">
            <Facebook className="h-5 w-5 text-blue-600" />
            <div>
              <h4 className="text-sm font-bold text-slate-800">Facebook Ca Nhan</h4>
              <p className="text-[11px] text-slate-500">Page rieng cua tai khoan dang dang nhap.</p>
            </div>
          </div>

          <form onSubmit={handleSaveFacebook} className="mt-4 space-y-3 text-left">
            <input
              type="text"
              value={facebookForm.pageId}
              onChange={(e) => setFacebookForm((prev) => ({ ...prev, pageId: e.target.value }))}
              placeholder="Page ID"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={facebookForm.pageName}
              onChange={(e) => setFacebookForm((prev) => ({ ...prev, pageName: e.target.value }))}
              placeholder="Ten page"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={facebookForm.pageAccessToken}
              onChange={(e) => setFacebookForm((prev) => ({ ...prev, pageAccessToken: e.target.value }))}
              placeholder="Page Access Token"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={facebookForm.appSecret}
              onChange={(e) => setFacebookForm((prev) => ({ ...prev, appSecret: e.target.value }))}
              placeholder="App Secret (tuy chon)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={facebookForm.verifyToken}
              onChange={(e) => setFacebookForm((prev) => ({ ...prev, verifyToken: e.target.value }))}
              placeholder="Verify Token (tuy chon)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={savingFacebook}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                {savingFacebook ? "Dang luu..." : "Luu Facebook ca nhan"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm("Go bo Facebook ca nhan chi anh huong tai khoan hien tai. Ban co chac chan muon tiep tuc khong?")) {
                    return;
                  }
                  void removeFacebookIntegration();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Go bo
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-sky-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2 text-left">
            <MessageCircleMore className="h-5 w-5 text-sky-600" />
            <div>
              <h4 className="text-sm font-bold text-slate-800">Zalo OA Ca Nhan</h4>
              <p className="text-[11px] text-slate-500">OA rieng cua tai khoan dang dang nhap.</p>
            </div>
          </div>

          <form onSubmit={handleSaveZalo} className="mt-4 space-y-3 text-left">
            <input
              type="text"
              value={zaloForm.oaId}
              onChange={(e) => setZaloForm((prev) => ({ ...prev, oaId: e.target.value }))}
              placeholder="OA ID"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={zaloForm.oaName}
              onChange={(e) => setZaloForm((prev) => ({ ...prev, oaName: e.target.value }))}
              placeholder="Ten OA"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={zaloForm.accessToken}
              onChange={(e) => setZaloForm((prev) => ({ ...prev, accessToken: e.target.value }))}
              placeholder="Access Token"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={zaloForm.refreshToken}
              onChange={(e) => setZaloForm((prev) => ({ ...prev, refreshToken: e.target.value }))}
              placeholder="Refresh Token (tuy chon)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={savingZalo}
                className="flex-1 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                {savingZalo ? "Dang luu..." : "Luu Zalo ca nhan"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm("Go bo Zalo ca nhan chi anh huong tai khoan hien tai. Ban co chac chan muon tiep tuc khong?")) {
                    return;
                  }
                  void removeZaloIntegration();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Go bo
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-left">
        <div className="flex items-start gap-2">
          <CheckCircle className="mt-0.5 h-4 w-4 text-emerald-600" />
          <div className="text-[11px] leading-relaxed text-emerald-800">
            <p className="font-bold">Nguyen tac van hanh</p>
            <p className="mt-1">
              1 tai khoan co the co kenh rieng. Neu co, CRM va bot uu tien dung kenh rieng cua tai khoan do.
              Chi khi tai khoan hien tai chua ket noi, he thong moi fallback sang kenh dung chung cua doanh nghiep.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
