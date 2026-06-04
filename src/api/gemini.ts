import { auth } from "../config/firebase";

export interface MarketingDevelopPost {
  channel: string;
  contentType: string;
  bodyText: string;
}

async function getHeaders(withContentType: boolean = true) {
  const headers: Record<string, string> = {};
  if (withContentType) {
    headers['Content-Type'] = 'application/json';
  }
  const user = auth.currentUser;
  if (user) {
    try {
      // getIdToken() will automatically renew the token if expired (silently)
      const token = await user.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.error("Lỗi khi lấy Firebase ID Token:", error);
    }
  }
  return headers;
}

export const geminiApi = {
  /**
   * Lấy 3 gợi ý chủ đề marketing ban đầu từ server.
   */
  async fetchMarketingSuggestions(): Promise<string[]> {
    const headers = await getHeaders(false);
    const response = await fetch('/api/v1/gemini/marketing-suggestions', {
      headers
    });
    if (!response.ok) {
      throw new Error('Không thể tải gợi ý chiến dịch marketing');
    }
    const data = await response.json();
    return data.suggestions || [];
  },

  /**
   * Phân tích mục tiêu chiến dịch để lấy các content pillars đề xuất.
   */
  async analyzeMarketingPillars(campaignTopic: string): Promise<{ pillars: any[] }> {
    const headers = await getHeaders(true);
    const response = await fetch('/api/v1/gemini/marketing-pillars', {
      method: 'POST',
      headers,
      body: JSON.stringify({ campaignTopic }),
    });
    if (!response.ok) {
      throw new Error('Lỗi phân tích Content Pillars');
    }
    return response.json();
  },

  /**
   * Phát sinh các bản nháp ý tưởng chiến dịch marketing từ các pillars được chọn.
   */
  async generateMarketingIdeas(campaignTopic: string, selectedPillars: string[]): Promise<{ concepts: any[] }> {
    const headers = await getHeaders(true);
    const response = await fetch('/api/v1/gemini/marketing-ideas', {
      method: 'POST',
      headers,
      body: JSON.stringify({ campaignTopic, selectedPillars }),
    });
    if (!response.ok) {
      throw new Error('Lỗi phát sinh ý tưởng marketing');
    }
    return response.json();
  },

  /**
   * Lập dàn ý và viết bài đăng chi tiết cho từng kênh truyền thông từ một ý tưởng cụ thể.
   */
  async developMarketingIdea(concept: {
    title: string;
    summary: string;
    suggestedContent: string;
    channels: string[];
  }): Promise<{ posts: MarketingDevelopPost[] }> {
    const headers = await getHeaders(true);
    const response = await fetch('/api/v1/gemini/marketing-develop', {
      method: 'POST',
      headers,
      body: JSON.stringify(concept),
    });
    if (!response.ok) {
      throw new Error('Lỗi lập dàn ý và viết bài chi tiết');
    }
    return response.json();
  },

  /**
   * Gửi tin nhắn chat đến AI Assistant trong CRM Omni-Inbox.
   */
  async sendChatMessage(
    message: string,
    history: any[],
    aiConfig: any
  ): Promise<{ text: string; isMock: boolean }> {
    const headers = await getHeaders(true);
    const response = await fetch('/api/v1/gemini/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({ message, history, aiConfig }),
    });
    if (!response.ok) {
      throw new Error('Lỗi kết nối Trợ lý AI');
    }
    return response.json();
  },

  /**
   * Sinh ảnh minh họa AI.
   */
  async generateImage(prompt: string): Promise<{ url: string; isMock: boolean }> {
    const headers = await getHeaders(true);
    const response = await fetch('/api/v1/gemini/generate-image', {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt }),
    });
    if (!response.ok) {
      throw new Error('Lỗi khi sinh ảnh minh họa AI');
    }
    return response.json();
  },

  async generateVideo(prompt: string, durationSeconds?: number): Promise<{ url: string; isMock: boolean }> {
    const headers = await getHeaders(true);
    const response = await fetch('/api/v1/gemini/generate-video', {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt, durationSeconds }),
    });
    if (!response.ok) {
      throw new Error('Lỗi khi sinh video AI');
    }
    return response.json();
  },
};
