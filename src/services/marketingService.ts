import { getAccessToken } from "./authService";
import { ContentApprovalCard } from "../types";
import { geminiApi } from "../api/gemini";

export const marketingService = {
  async getCards(authorUid?: string): Promise<ContentApprovalCard[]> {
    let url = "/api/v1/crud/marketing-contents";
    if (authorUid) {
      url += `?authorUid=${encodeURIComponent(authorUid)}`;
    }
    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });
    if (!res.ok) {
      throw new Error("Không thể tải danh sách bài viết duyệt.");
    }
    const json = await res.json();
    return (json.data || []).map((item: any) => ({
      ...item,
      id: item._id, // map MongoDB _id to id
    }));
  },

  subscribeToContents(
    onUpdate: (cards: ContentApprovalCard[]) => void,
    onError: (error: unknown) => void,
    currentUid?: string,
    currentRole?: string
  ): () => void {
    const isUserRole = currentRole === 'user' || currentRole === 'manager';
    const authorUid = undefined; // Hiển thị với tất cả nhân viên trong doanh nghiệp, không lọc theo tác giả


    const fetchCards = async () => {
      try {
        let data = await this.getCards(authorUid);
        
        // Seed dữ liệu mẫu nếu database hoàn toàn trống
        if (data.length === 0 && !isUserRole) {
          const initialCards = [
            {
              title: 'Review Bàn phím Workspace V2',
              channel: 'Facebook',
              contentType: 'Hình ảnh kèm Caption',
              status: 'pending',
              bodyText: '⌨️ Bạn đã chán cảnh gõ phím kẹt rít, mỏi nhức tay khi ngồi làm việc liên tục 8 tiếng? Nâng cấp phong cách bàn làm việc của bạn cùng Bàn phím cơ Workspace V2 - trải nghiệm lực gõ êm mượt, tối ưu cho năng suất cực hạn!',
              generatedAt: new Date().toISOString(),
              authorUid: '',
            },
            {
              title: 'Khai phá Sức mạnh AI trong iGen ERP',
              channel: 'LinkedIn',
              contentType: 'Bài viết chuyên sâu (Pulse/Article)',
              status: 'pending',
              bodyText: '📊 Thống kê cho thấy hơn 72% doanh nghiệp vừa và nhỏ tại Đông Nam Á vẫn đau đầu vì thông tin đứt quãng giữa CRM và Kho bãi... Hôm nay, hãng iGen ra mắt giải pháp Tích hợp Tự động AI hóa, kết hợp mô hình Gemini 3.5 dự báo thiếu hàng cực kỳ chính xác.',
              generatedAt: new Date().toISOString(),
              authorUid: '',
            },
            {
              title: 'Trải nghiệm Đeo X1 Thể dục',
              channel: 'TikTok',
              contentType: 'Kịch bản Video ngắn 15s',
              status: 'draft',
              bodyText: '🎬 [Mở đầu camera zoom cận cảnh thiết bị X1] Tiếng beep đếm nhịp tim đập. Giọng nói thoại: \'Đừng để mệt mỏi ngăn cản nhịp đập tiến bước của bạn...\' Trải nghiệm thể dục năng động thông minh.',
              generatedAt: new Date().toISOString(),
              authorUid: '',
            },
            {
              title: 'Công bố Chương trình Flash Sale Tháng 10',
              channel: 'Facebook',
              contentType: 'Hình ảnh Banner',
              status: 'scheduled',
              bodyText: '🔥 ĐỘC QUYỀN TRÊN IGEN: GIỜ VÀNG SĂN SHOCK từ 12h-14h hôm nay! Giảm giá tới 40% cho tất cả thiết bị đeo thông minh và linh kiện phụ trợ robot.',
              generatedAt: new Date().toISOString(),
              scheduledDate: new Date().toISOString().slice(0, 10),
              scheduledTime: '12:00',
              authorUid: '',
            },
          ];

          await Promise.all(
            initialCards.map(async (card) => {
              const res = await fetch("/api/v1/crud/marketing-contents", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${getAccessToken()}`,
                },
                body: JSON.stringify(card),
              });
              return res.json();
            })
          );
          data = await this.getCards(authorUid);
        }
        onUpdate(data);
      } catch (err) {
        if (onError) {
          onError(err);
        } else {
          console.error("Lỗi tải danh sách bài đăng marketing:", err);
        }
      }
    };

    fetchCards();
    const interval = setInterval(fetchCards, 5000);
    return () => clearInterval(interval);
  },

  async updateCardStatus(id: string, newStatus: 'draft' | 'pending' | 'approved' | 'scheduled' | 'published'): Promise<void> {
    const payload: Record<string, any> = { status: newStatus };
    if (newStatus === 'approved') {
      payload.scheduledDate = "";
      payload.scheduledTime = "";
    }
    await this.updateCard(id, payload);
  },

  async scheduleCard(id: string, scheduledDate: string, scheduledTime: string, integrationId?: string): Promise<void> {
    // 1. Lấy dữ liệu bài đăng đầy đủ trước
    const cardData = await this.getCardById(id);

    if (!cardData.authorUid) {
      throw new Error("Bài đăng không có thông tin tác giả (authorUid).");
    }

    const channel = cardData.channel || 'Facebook';
    let integrationInfo: any = null;

    // 2. Đọc cấu hình liên kết mạng xã hội
    if (integrationId) {
      // Đọc cấu hình từ SocialIntegration cụ thể được chọn
      const res = await fetch(`/api/v1/crud/social-integrations/${integrationId}`, {
        headers: {
          "Authorization": `Bearer ${getAccessToken()}`,
        },
      });
      if (!res.ok) {
        throw new Error("Không tìm thấy thông tin tài khoản liên kết được chọn.");
      }
      const json = await res.json();
      const integration = json.data;

      if (channel === 'Facebook') {
        integrationInfo = {
          pageId: integration.username, // Page ID lưu ở username
          pageAccessToken: integration.accessToken,
          isMock: !!integration.isMock
        };
      } else if (channel === 'TikTok') {
        integrationInfo = {
          username: integration.username,
          displayName: integration.displayName,
          blotatoAccountId: integration.blotatoAccountId,
          accessToken: integration.accessToken,
          isMock: !!integration.isMock
        };
      } else {
        throw new Error(`Kênh đăng tải "${channel}" chưa hỗ trợ tự động lên lịch.`);
      }
    } else {
      // Fallback: Đọc cấu hình liên kết mạng xã hội cá nhân của tác giả qua user API
      const userRes = await fetch(`/api/v1/crud/users/${cardData.authorUid}`, {
        headers: {
          "Authorization": `Bearer ${getAccessToken()}`,
        },
      });
      if (!userRes.ok) {
        throw new Error("Không tìm thấy thông tin hồ sơ của tác giả.");
      }
      const userJson = await userRes.json();
      const userProfile = userJson.data;

      if (channel === 'Facebook') {
        const fbInt = userProfile.facebookIntegration;
        if (!fbInt || !fbInt.isConnected) {
          throw new Error("Tác giả chưa liên kết với Facebook Page.");
        }
        integrationInfo = {
          pageId: fbInt.pageId,
          pageAccessToken: fbInt.pageAccessToken,
          isMock: !!fbInt.isMock
        };
      } else if (channel === 'TikTok') {
        const ttInt = userProfile.tiktokIntegration;
        if (!ttInt || !ttInt.isConnected) {
          throw new Error("Tác giả chưa liên kết với tài khoản TikTok.");
        }
        integrationInfo = {
          username: ttInt.username,
          displayName: ttInt.displayName,
          isMock: !!ttInt.isMock
        };
      } else {
        throw new Error(`Kênh đăng tải "${channel}" chưa hỗ trợ tự động lên lịch.`);
      }
    }

    // 3. Gọi API Express Backend gửi yêu cầu schedule sang n8n
    const response = await fetch('/api/v1/scheduler/schedule-post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken()}`
      },
      body: JSON.stringify({
        cardId: id,
        channel,
        title: cardData.title,
        bodyText: cardData.bodyText,
        imageUrl: cardData.imageUrl || '',
        videoUrl: cardData.videoUrl || '',
        scheduledDate,
        scheduledTime,
        integration: integrationInfo
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Lên lịch qua n8n thất bại: ${response.status} - ${errText}`);
    }

    const resData = await response.json();
    if (resData.status !== 'success') {
      throw new Error(resData.message || 'Lỗi không xác định từ máy chủ khi lên lịch.');
    }

    // 4. Chỉ khi thành công hết, mới lưu thời gian đặt lịch, đổi status sang scheduled và lưu facebookPostId
    const fbPostId = resData.data?.id || resData.data?.data?.id || '';
    
    await this.updateCard(id, {
      status: 'scheduled',
      scheduledDate,
      scheduledTime,
      integrationId,
      ...(fbPostId ? { facebookPostId: fbPostId } : {})
    });

    console.log(`[iGen Schedule Service]: Đã lên lịch bài đăng ${id} thành công qua n8n! ID bài viết: ${fbPostId}`);
  },

  async deleteCard(id: string): Promise<void> {
    const res = await fetch(`/api/v1/crud/marketing-contents/${id}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });
    if (!res.ok) {
      throw new Error("Không thể xóa bài đăng.");
    }
  },

  async saveCard(card: ContentApprovalCard): Promise<ContentApprovalCard> {
    const { id, ...postBody } = card;
    const res = await fetch("/api/v1/crud/marketing-contents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify(postBody),
    });
    if (!res.ok) {
      throw new Error("Không thể lưu bài đăng.");
    }
    const json = await res.json();
    return {
      ...json.data,
      id: json.data._id,
    };
  },

  async saveCards(cards: ContentApprovalCard[]): Promise<ContentApprovalCard[]> {
    const savedCards = await Promise.all(
      cards.map(async (card) => {
        const { id, ...postBody } = card;
        const res = await fetch("/api/v1/crud/marketing-contents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify(postBody),
        });
        if (!res.ok) {
          throw new Error("Không thể lưu bài đăng.");
        }
        const json = await res.json();
        return {
          ...json.data,
          id: json.data._id,
        };
      })
    );
    return savedCards;
  },

  async updateCard(id: string, card: Partial<ContentApprovalCard>): Promise<void> {
    const res = await fetch(`/api/v1/crud/marketing-contents/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify(card),
    });
    if (!res.ok) {
      throw new Error("Không thể cập nhật bài đăng.");
    }
  },

  async getCardById(id: string): Promise<ContentApprovalCard> {
    const res = await fetch(`/api/v1/crud/marketing-contents/${id}`, {
      headers: {
        "Authorization": `Bearer ${getAccessToken()}`,
      },
    });
    if (!res.ok) {
      throw new Error("Không tìm thấy thông tin bài đăng.");
    }
    const json = await res.json();
    return {
      ...json.data,
      id: json.data._id
    };
  },

  async publishToFacebook(
    id: string,
    pageAccessToken: string,
    pageId: string,
    bodyText: string,
    isMock: boolean,
    imageUrl?: string,
    videoUrl?: string
  ): Promise<string> {
    if (isMock) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const mockPostId = `mock-post-${Date.now()}`;
      await this.updateCard(id, {
        status: 'published',
        publishedAt: new Date().toISOString(),
        facebookPostId: mockPostId
      });
      console.log(`[iGen ERP Autopost (MOCK)]: Đã đăng bài thành công lên Facebook Page (Demo). ID bài viết: ${mockPostId}`);
      return mockPostId;
    }

    const response = await fetch('/api/v1/facebook/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        pageId,
        accessToken: pageAccessToken,
        content: extractDraftContent(bodyText),
        imageUrl,
        videoUrl
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || errData.details || `Lỗi máy chủ HTTP ${response.status}`);
    }

    const result = await response.json();
    const fbData = result.data?.data ?? result.data;
    const postId = fbData.id ?? fbData.post_id ?? `post-${Date.now()}`;

    await this.updateCard(id, {
      status: 'published',
      publishedAt: new Date().toISOString(),
      facebookPostId: postId
    });

    console.log(`[iGen ERP Autopost]: Đã đăng bài thành công lên Facebook Page qua n8n. Post ID: ${postId}`);
    return postId;
  },

  async developIdea(concept: {
    title: string;
    summary: string;
    suggestedContent: string;
    channels: string[];
    mediaType?: string;
    imageModel?: string;
    imageResolution?: string;
    imageAspectRatio?: string;
    videoModel?: string;
    videoQuality?: string;
    videoDuration?: number;
    videoAspectRatio?: string;
    mediaPrompt?: string;
    humanVoiceId?: string;
    humanVoiceModel?: string;
    humanDurationSeconds?: number;
  }) {
    return geminiApi.developMarketingIdea(concept);
  },

  async fetchSuggestions(): Promise<string[]> {
    return geminiApi.fetchMarketingSuggestions();
  },

  async updateCardMedia(mediaUrl: string | null, type: 'image' | 'video', cardIds: string[]): Promise<void> {
    if (cardIds.length === 0) return;
    await Promise.all(
      cardIds.map((id) => {
        const updateData: Record<string, any> = {};
        if (type === 'image') {
          updateData.imageUrl = mediaUrl ? mediaUrl : null;
        } else {
          updateData.videoUrl = mediaUrl ? mediaUrl : null;
        }
        return this.updateCard(id, updateData);
      })
    );
  },

  async uploadMediaToStorage(tempUrl: string, filename: string, type: 'image' | 'video'): Promise<string> {
    try {
      const response = await fetch('/api/v1/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAccessToken()}`
        },
        body: JSON.stringify({
          file: tempUrl,
          folder: 'igen_erp/marketing',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Lỗi tải lên Cloudinary: ${response.statusText}`);
      }

      const data = await response.json();
      return data.url;
    } catch (e) {
      console.error("[marketingService.uploadMediaToStorage] Error:", e);
      throw e;
    }
  },

  async publishToTikTok(
    id: string,
    caption: string,
    videoUrl: string,
    isMock: boolean,
    privacyLevel: string = 'SELF_ONLY'
  ): Promise<string> {
    if (isMock) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const mockPostId = `tiktok_mock_${Date.now()}`;
      await this.updateCard(id, {
        status: 'published',
        publishedAt: new Date().toISOString(),
        tiktokPostId: mockPostId,
        tiktokShareUrl: `https://www.tiktok.com/@demo/video/${mockPostId}`
      });
      console.log(`[iGen ERP TikTok (MOCK)]: Đã đăng video thành công. ID: ${mockPostId}`);
      return mockPostId;
    }

    const response = await fetch('/api/v1/tiktok/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        cardId: id,
        caption,
        videoUrl,
        privacyLevel,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Đăng TikTok thất bại: ${response.status} - ${errText}`);
    }

    const resData = await response.json();
    if (resData.status !== 'success') {
      throw new Error(resData.message || 'Lỗi không xác định từ máy chủ khi đăng TikTok.');
    }

    const { postId, shareUrl } = resData.data;

    await this.updateCard(id, {
      status: 'published',
      publishedAt: new Date().toISOString(),
      tiktokPostId: postId,
      tiktokShareUrl: shareUrl
    });

    console.log(`[iGen ERP TikTok]: Đã đăng video thành công. Post ID: ${postId}`);
    return postId;
  },
};

export function extractDraftContent(text: string): string {
  if (!text) return "";
  
  const markers = [
    "# BẢN NHÁP CHI TIẾT (DRAFT)",
    "# BẢN NHÁP CHI TIẾT",
    "BẢN NHÁP CHI TIẾT (DRAFT)",
    "BẢN NHÁP CHI TIẾT",
    "[BẢN NHÁP CHI TIẾT (DRAFT)]",
    "[BẢN NHÁP CHI TIẾT]",
    "(BẢN NHÁP CHI TIẾT (DRAFT))",
    "(BẢN NHÁP CHI TIẾT)",
    
    "✍️ NỘI DUNG CHI TIẾT (DRAFT CONTENT):",
    "✍️ NỘI DUNG CHI TIẾT (DRAFT CONTENT)",
    "NỘI DUNG CHI TIẾT (DRAFT CONTENT):",
    "NỘI DUNG CHI TIẾT (DRAFT CONTENT)",
    "✍️ NỘI DUNG CHI TIẾT:",
    "✍️ NỘI DUNG CHI TIẾT",
    "NỘI DUNG CHI TIẾT:",
    "NỘI DUNG CHI TIẾT",
    
    "[DRAFT CONTENT]",
    "(DRAFT CONTENT)",
    "DRAFT CONTENT:",
    "DRAFT CONTENT",
    
    "[DRAFT]",
    "(DRAFT)",
    "DRAFT:",
    "DRAFT"
  ];

  const sortedMarkers = [...markers].sort((a, b) => b.length - a.length);

  let currentText = text.trim();
  let found = true;
  let iterations = 0;
  
  while (found && iterations < 5) {
    found = false;
    const prefix = currentText.substring(0, 1500);
    const prefixUpper = prefix.toUpperCase();
    
    for (const marker of sortedMarkers) {
      const index = prefixUpper.indexOf(marker.toUpperCase());
      if (index !== -1) {
        currentText = currentText.substring(index + marker.length).trim();
        found = true;
        iterations++;
        break;
      }
    }
  }
  
  return currentText;
}

export function splitOutlineAndDraft(text: string): { outline: string; bodyText: string } {
  if (!text) return { outline: "", bodyText: "" };
  
  const markers = [
    "# BẢN NHÁP CHI TIẾT (DRAFT)",
    "# BẢN NHÁP CHI TIẾT",
    "BẢN NHÁP CHI TIẾT (DRAFT)",
    "BẢN NHÁP CHI TIẾT",
    "[BẢN NHÁP CHI TIẾT (DRAFT)]",
    "[BẢN NHÁP CHI TIẾT]",
    "(BẢN NHÁP CHI TIẾT (DRAFT))",
    "(BẢN NHÁP CHI TIẾT)",
    
    "✍️ NỘI DUNG CHI TIẾT (DRAFT CONTENT):",
    "✍️ NỘI DUNG CHI TIẾT (DRAFT CONTENT)",
    "NỘI DUNG CHI TIẾT (DRAFT CONTENT):",
    "NỘI DUNG CHI TIẾT (DRAFT CONTENT)",
    "✍️ NỘI DUNG CHI TIẾT:",
    "✍️ NỘI DUNG CHI TIẾT",
    "NỘI DUNG CHI TIẾT:",
    "NỘI DUNG CHI TIẾT",
    
    "[DRAFT CONTENT]",
    "(DRAFT CONTENT)",
    "DRAFT CONTENT:",
    "DRAFT CONTENT",
    
    "[DRAFT]",
    "(DRAFT)",
    "DRAFT:",
    "DRAFT"
  ];

  const sortedMarkers = [...markers].sort((a, b) => b.length - a.length);
  
  const prefix = text.substring(0, 1500);
  const prefixUpper = prefix.toUpperCase();
  
  for (const marker of sortedMarkers) {
    const index = prefixUpper.indexOf(marker.toUpperCase());
    if (index !== -1) {
      const outline = text.substring(0, index).trim();
      const bodyText = extractDraftContent(text.substring(index));
      return { outline, bodyText };
    }
  }
  
  return { outline: "", bodyText: text.trim() };
}
