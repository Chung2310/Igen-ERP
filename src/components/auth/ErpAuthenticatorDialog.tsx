import React, { useEffect, useState } from "react";
import type { ErpLoginChallenge } from "../../context/AuthContext";
import { superAdminAuthService } from "../../services/superAdminAuthService";

interface ErpAuthenticatorDialogProps {
  challenge: ErpLoginChallenge;
  onAuthenticated(): Promise<void>;
  onCancel(): void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Không thể xác thực. Vui lòng thử lại.";
}

export function ErpAuthenticatorDialog({ challenge, onAuthenticated, onCancel }: ErpAuthenticatorDialogProps) {
  const [mode, setMode] = useState<"totp" | "recovery">("totp");
  const [value, setValue] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!challenge.enrollmentRequired) return;

    let active = true;
    setPending(true);
    setError("");
    superAdminAuthService.startEnrollment(challenge.challengeId)
      .then((result) => {
        if (active) setQrDataUrl(result.qrDataUrl);
      })
      .catch((requestError) => {
        if (active) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (active) setPending(false);
      });

    return () => {
      active = false;
    };
  }, [challenge.challengeId, challenge.enrollmentRequired]);

  const authenticate = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      if (challenge.enrollmentRequired) {
        const result = await superAdminAuthService.confirmEnrollment(challenge.challengeId, value);
        if (result.recoveryCodes?.length) {
          setRecoveryCodes(result.recoveryCodes);
        } else {
          await onAuthenticated();
        }
      } else if (mode === "recovery") {
        await superAdminAuthService.verifyRecovery(challenge.challengeId, value);
        await onAuthenticated();
      } else {
        await superAdminAuthService.verifyTotp(challenge.challengeId, value);
        await onAuthenticated();
      }
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setPending(false);
    }
  };

  const acknowledgeRecoveryCodes = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await onAuthenticated();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setPending(false);
    }
  };

  const switchMode = () => {
    setMode((current) => current === "totp" ? "recovery" : "totp");
    setValue("");
    setError("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="erp-authenticator-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 id="erp-authenticator-title" className="text-xl font-semibold text-gray-900">Xác thực đăng nhập</h2>

        {recoveryCodes.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm text-gray-700">Lưu các mã khôi phục này ở nơi an toàn.</p>
            <ul className="mt-3 rounded-lg bg-gray-100 p-4 font-mono text-sm">
              {recoveryCodes.map((code) => <li key={code}>{code}</li>)}
            </ul>
            {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
            <button type="button" disabled={pending} onClick={acknowledgeRecoveryCodes} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
              Tôi đã lưu mã khôi phục
            </button>
          </div>
        ) : (
          <div className="mt-4">
            {challenge.enrollmentRequired && qrDataUrl && (
              <img src={qrDataUrl} alt="Mã QR Google Authenticator" className="mx-auto mb-4 h-48 w-48" />
            )}
            <label className="block text-sm font-medium text-gray-700">
              {mode === "recovery" ? "Mã khôi phục" : "Mã Google Authenticator"}
              <input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                disabled={pending}
                autoComplete="one-time-code"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
            {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={pending} onClick={authenticate} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
                {challenge.enrollmentRequired ? "Kích hoạt và đăng nhập" : "Xác thực"}
              </button>
              {!challenge.enrollmentRequired && (
                <button type="button" disabled={pending} onClick={switchMode} className="rounded-lg border border-gray-300 px-4 py-2 disabled:opacity-50">
                  {mode === "recovery" ? "Dùng Google Authenticator" : "Dùng mã khôi phục"}
                </button>
              )}
              <button type="button" disabled={pending} onClick={onCancel} className="rounded-lg border border-gray-300 px-4 py-2 disabled:opacity-50">Hủy</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
