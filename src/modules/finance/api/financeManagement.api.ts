import { getAccessToken } from "../../../services/authService";
export async function financeManagement<T = any>(path: string, body?: unknown, method = "POST", signal?: AbortSignal): Promise<T> {
    const response = await fetch(`/api/v1/finance/management${path}`, { method: body === undefined ? "GET" : method, signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken() || ""}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (!response.ok) {
        if (response.status === 401 || response.status === 403)
            throw new Error("Bạn chưa được cấp quyền thực hiện nghiệp vụ tài chính này.");
        const payload = await response.json().catch(() => ({}));
        throw new Error((response.status < 500 || (response.status === 503 && payload.code === "FINANCE_TRANSACTIONS_REQUIRED")) && payload.message ? payload.message : "Không thể xử lý dữ liệu tài chính. Vui lòng thử lại.");
    }
    return (await response.json()).data;
}
