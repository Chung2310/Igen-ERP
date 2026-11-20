import { getAccessToken } from "./authService";

export interface BlogAttachment {
  id?: string;
  _id?: string;
  shareUrl?: string;
  url: string;
  name: string;
  type?: string;
  size?: number;
}

export interface BlogPostItem {
  id: string;
  companyCode: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  authorAvatar?: string;
  title?: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  attachmentsPublic?: boolean;
  attachments?: BlogAttachment[];
  legalDocuments?: { id: string; number: string; title: string; status: string }[];
  likesCount: number;
  isLiked: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BlogChannelInfo {
  channelName: string;
  companyCode: string;
  totalPosts: number;
  pinnedPostsCount: number;
  canPost: boolean;
  userRole: string;
}

export interface ListBlogPostsResult {
  posts: BlogPostItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateBlogPostInput {
  title?: string;
  content?: string;
  tags?: string[];
  isPinned?: boolean;
  attachmentsPublic?: boolean;
  attachments?: BlogAttachment[];
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || `Request failed with status ${res.status}`);
  }
  return body.data !== undefined ? body.data : body;
}

export async function getBlogChannelInfo(): Promise<BlogChannelInfo> {
  return request<BlogChannelInfo>("/api/v1/blogs/info");
}

export async function listBlogPosts(params?: {
  tag?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<ListBlogPostsResult> {
  const query = new URLSearchParams();
  if (params?.tag) query.set("tag", params.tag);
  if (params?.search) query.set("search", params.search);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  return request<ListBlogPostsResult>(`/api/v1/blogs${qs ? `?${qs}` : ""}`);
}

export async function createBlogPost(payload: CreateBlogPostInput): Promise<BlogPostItem> {
  return request<BlogPostItem>("/api/v1/blogs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function toggleLikeBlogPost(
  postId: string,
): Promise<{ id: string; likesCount: number; isLiked: boolean }> {
  return request<{ id: string; likesCount: number; isLiked: boolean }>(
    `/api/v1/blogs/${postId}/like`,
    { method: "POST" },
  );
}

export async function togglePinBlogPost(
  postId: string,
): Promise<{ id: string; isPinned: boolean }> {
  return request<{ id: string; isPinned: boolean }>(`/api/v1/blogs/${postId}/pin`, {
    method: "PATCH",
  });
}

export async function deleteBlogPost(postId: string): Promise<{ id: string; success: boolean }> {
  return request<{ id: string; success: boolean }>(`/api/v1/blogs/${postId}`, {
    method: "DELETE",
  });
}

export async function uploadBlogAttachment(file: File): Promise<BlogAttachment> {
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
  });

  const token = getAccessToken();
  const res = await fetch("/api/v1/blogs/files", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      file: base64Data,
      fileName: file.name,
    }),
  });

  const body = await res.json().catch(() => ({}));
  const uploaded = body.data || body;
  if (!res.ok || !uploaded.url) {
    throw new Error(body.message || "Tải lên tệp thất bại");
  }

  return {
    url: uploaded.url,
    name: file.name,
    type: file.type || file.name.split(".").pop() || "file",
    size: file.size,
  };
}

export async function updateBlogAttachmentVisibility(postId: string, attachmentsPublic: boolean): Promise<void> {
  const data = await request<{ attachmentsPublic: boolean }>("/api/v1/blogs/" + encodeURIComponent(postId) + "/attachment-visibility", {
    method: "PATCH", body: JSON.stringify({ attachmentsPublic }),
  });
  if (data.attachmentsPublic !== attachmentsPublic) throw new Error("Máy chủ chưa xác nhận quyền tệp. Vui lòng tải lại bài viết.");
}
export async function getBlogAttachmentAccess(postId: string, attachmentId: string): Promise<string> {
  const data = await request<{ url: string }>("/api/v1/blogs/" + encodeURIComponent(postId) + "/attachments/" + encodeURIComponent(attachmentId) + "/access");
  if (!data.url) throw new Error("Không thể truy cập tệp.");
  return data.url;
}
