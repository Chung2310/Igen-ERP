import type { UserProfile } from "../types/common";

export interface FaceEnrollmentStatus {
  registered: boolean;
}

export interface FaceEnrollmentMutation {
  registered: true;
  operation: "register" | "replace";
}

export class FaceManagementError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "FaceManagementError";
  }
}

type ApiErrorResponse = {
  error?: string;
  message?: string;
  reasonCode?: string;
};

export function canManageFaces(
  profile?: Pick<UserProfile, "role" | "permissions"> | null,
): boolean {
  return Boolean(
    profile &&
      (profile.role === "superadmin" ||
        profile.role === "admin" ||
        profile.permissions?.includes("*") ||
        profile.permissions?.includes("face:manage")),
  );
}

function authorizationHeaders(): Headers {
  const headers = new Headers();
  const token = typeof localStorage === "undefined" ? null : localStorage.getItem("accessToken");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

async function request<T>(userId: string, init?: RequestInit): Promise<T> {
  const response = await fetch(
    `/api/v1/face-management/users/${encodeURIComponent(userId)}`,
    {
      ...init,
      headers: authorizationHeaders(),
    },
  );

  const payload = response.status === 204
    ? undefined
    : await response.json();

  if (!response.ok) {
    const errorPayload = payload as ApiErrorResponse | undefined;
    throw new FaceManagementError(
      errorPayload?.message || errorPayload?.error || errorPayload?.reasonCode || response.statusText,
      response.status,
    );
  }

  return payload as T;
}

export function getFaceEnrollmentStatus(userId: string): Promise<FaceEnrollmentStatus> {
  return request<FaceEnrollmentStatus>(userId);
}

export function enrollFace(userId: string, image: Blob): Promise<FaceEnrollmentMutation> {
  const body = new FormData();
  body.append("file", new File([image], "face.jpg", { type: image.type || "image/jpeg" }));
  return request<FaceEnrollmentMutation>(userId, { method: "POST", body });
}

export async function deleteFaceEnrollment(userId: string): Promise<void> {
  await request<void>(userId, { method: "DELETE" });
}
