import { collection, onSnapshot, setDoc, doc, getDoc, deleteDoc, updateDoc, writeBatch, query, where, deleteField } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../config/firebase';
import { ContentApprovalCard } from '../types';
import { geminiApi } from '../api/gemini';

const COLLECTION_NAME = 'marketingContents';

export const marketingService = {
  /**
   * Lắng nghe dữ liệu real-time từ Firestore.
   * - Admin/Superadmin: xem tất cả content
   * - User: chỉ xem content mình tạo (authorUid === uid)
   */
  subscribeToContents(
    onUpdate: (cards: ContentApprovalCard[]) => void,
    onError: (error: unknown) => void,
    currentUid?: string,
    currentRole?: string
  ): () => void {
    const colRef = collection(db, COLLECTION_NAME);

    // User/Manager role: chỉ xem của mình
    const isUserRole = currentRole === 'user' || currentRole === 'manager';
    const q = isUserRole && currentUid
      ? query(colRef, where('authorUid', '==', currentUid))
      : query(colRef);

    return onSnapshot(
      q,
      async (snapshot) => {
        const cards: ContentApprovalCard[] = [];
        snapshot.forEach((docSnap) => {
          cards.push(docSnap.data() as ContentApprovalCard);
        });

        if (snapshot.empty && !isUserRole) {
          // Chỉ seed khi admin/superadmin mới thấy trống (user role tự nhiên trống khi chưa tạo)
          const initialCards: ContentApprovalCard[] = [
            {
              id: 'mod-1',
              title: 'Review Bàn phím Workspace V2',
              channel: 'Facebook',
              contentType: 'Hình ảnh kèm Caption',
              status: 'pending',
              bodyText: '⌨️ Bạn đã chán cảnh gõ phím kẹt rít, mỏi nhức tay khi ngồi làm việc liên tục 8 tiếng? Nâng cấp phong cách bàn làm việc của bạn cùng Bàn phím cơ Workspace V2 - trải nghiệm lực gõ êm mượt, tối ưu cho năng suất cực hạn!',
              generatedAt: 'Hôm nay, 09:30',
              authorUid: '',
            },
            {
              id: 'mod-2',
              title: 'Khai phá Sức mạnh AI trong iGen ERP',
              channel: 'LinkedIn',
              contentType: 'Bài viết chuyên sâu (Pulse/Article)',
              status: 'pending',
              bodyText: '📊 Thống kê cho thấy hơn 72% doanh nghiệp vừa và nhỏ tại Đông Nam Á vẫn đau đầu vì thông tin đứt quãng giữa CRM và Kho bãi... Hôm nay, hãng iGen ra mắt giải pháp Tích hợp Tự động AI hóa, kết hợp mô hình Gemini 3.5 dự báo thiếu hàng cực kỳ chính xác.',
              generatedAt: 'Hôm qua, 15:00',
              authorUid: '',
            },
            {
              id: 'mod-3',
              title: 'Trải nghiệm Đeo X1 Thể dục',
              channel: 'TikTok',
              contentType: 'Kịch bản Video ngắn 15s',
              status: 'draft',
              bodyText: '🎬 [Mở đầu camera zoom cận cảnh thiết bị X1] Tiếng beep đếm nhịp tim đập. Giọng nói thoại: \'Đừng để mệt mỏi ngăn cản nhịp đập tiến bước của bạn...\' Trải nghiệm thể dục năng động thông minh.',
              generatedAt: 'Hôm nay, 10:15',
              authorUid: '',
            },
            {
              id: 'mod-4',
              title: 'Công bố Chương trình Flash Sale Tháng 10',
              channel: 'Facebook',
              contentType: 'Hình ảnh Banner',
              status: 'scheduled',
              bodyText: '🔥 ĐỘC QUYỀN TRÊN IGEN: GIỜ VÀNG SĂN SHOCK từ 12h-14h hôm nay! Giảm giá tới 40% cho tất cả thiết bị đeo thông minh và linh kiện phụ trợ robot.',
              generatedAt: 'Hôm qua, 11:30',
              scheduledDate: new Date().toLocaleDateString('vi-VN'),
              scheduledTime: '12:00',
              authorUid: '',
            },
          ];

          try {
            const batch = writeBatch(db);
            initialCards.forEach((card) => {
              const docRef = doc(db, COLLECTION_NAME, card.id);
              batch.set(docRef, card);
            });
            await batch.commit();
          } catch (e) {
            handleFirestoreError(e, OperationType.CREATE, `${COLLECTION_NAME}/[batch-seed]`);
            onError(e);
          }
        } else {
          onUpdate(cards);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
        onError(error);
      }
    );
  },

  /**
   * Cập nhật trạng thái của card.
   */
  async updateCardStatus(id: string, newStatus: 'draft' | 'pending' | 'approved' | 'scheduled' | 'published'): Promise<void> {
    try {
      const cardRef = doc(db, COLLECTION_NAME, id);
      if (newStatus === 'approved') {
        await updateDoc(cardRef, { 
          status: newStatus,
          scheduledDate: deleteField(),
          scheduledTime: deleteField()
        });
      } else {
        await updateDoc(cardRef, { status: newStatus });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
    }
  },

  /**
   * Lên lịch bài đăng với ngày và giờ cụ thể.
   */
  async scheduleCard(id: string, scheduledDate: string, scheduledTime: string): Promise<void> {
    try {
      const cardRef = doc(db, COLLECTION_NAME, id);
      
      // 1. Cập nhật ngày giờ lên lịch vào Firestore trước
      await updateDoc(cardRef, {
        status: 'scheduled',
        scheduledDate,
        scheduledTime
      });

      // 2. Lấy dữ liệu bài đăng đầy đủ
      const cardSnap = await getDoc(cardRef);
      if (!cardSnap.exists()) {
        throw new Error("Không tìm thấy dữ liệu bài đăng.");
      }
      const cardData = cardSnap.data() as ContentApprovalCard;

      if (!cardData.authorUid) {
        throw new Error("Bài đăng không có thông tin tác giả (authorUid).");
      }

      // 3. Đọc cấu hình liên kết mạng xã hội của tác giả
      const userSnap = await getDoc(doc(db, 'users', cardData.authorUid));
      if (!userSnap.exists()) {
        throw new Error("Không tìm thấy thông tin hồ sơ của tác giả.");
      }
      const userProfile = userSnap.data();
      const channel = cardData.channel || 'Facebook';
      let integrationInfo: any = null;

      if (channel === 'Facebook') {
        const fbInt = userProfile.facebookIntegration;
        if (!fbInt || !fbInt.isConnected) {
          throw new Error("Tác giả chưa kết nối với Facebook Page.");
        }
        integrationInfo = {
          pageId: fbInt.pageId,
          pageAccessToken: fbInt.pageAccessToken,
          isMock: !!fbInt.isMock
        };
      } else if (channel === 'TikTok') {
        const ttInt = userProfile.tiktokIntegration;
        if (!ttInt || !ttInt.isConnected) {
          throw new Error("Tác giả chưa kết nối với tài khoản TikTok.");
        }
        integrationInfo = {
          username: ttInt.username,
          displayName: ttInt.displayName,
          isMock: !!ttInt.isMock
        };
      } else {
        throw new Error(`Kênh đăng tải "${channel}" chưa hỗ trợ tự động lên lịch.`);
      }

      // 4. Gọi API Express Backend gửi yêu cầu schedule sang n8n
      const response = await fetch('/api/v1/scheduler/schedule-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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

      console.log(`[iGen Schedule Service]: Đã lên lịch bài đăng ${id} thành công qua n8n!`);

    } catch (e: any) {
      console.error("[marketingService.scheduleCard] Error:", e);
      handleFirestoreError(e, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
    }
  },

  /**
   * Xóa card khỏi Firestore.
   */
  async deleteCard(id: string): Promise<void> {
    try {
      const cardRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(cardRef);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
    }
  },

  /**
   * Lưu hoặc tạo mới card trên Firestore.
   */
  async saveCard(card: ContentApprovalCard): Promise<void> {
    try {
      const cardRef = doc(db, COLLECTION_NAME, card.id);
      await setDoc(cardRef, card);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `${COLLECTION_NAME}/${card.id}`);
    }
  },

  /**
   * Lưu hàng loạt các card vào Firestore bằng WriteBatch.
   */
  async saveCards(cards: ContentApprovalCard[]): Promise<void> {
    try {
      const batch = writeBatch(db);
      cards.forEach((card) => {
        const docRef = doc(db, COLLECTION_NAME, card.id);
        batch.set(docRef, card);
      });
      await batch.commit();
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `${COLLECTION_NAME}/[batch-save]`);
    }
  },

  /**
   * Đăng bài lên Facebook (giả lập hoặc thật).
   * - Nếu isMock = true: giả lập thành công sau 1.5s (không cần kết nối thật)
   * - Nếu isMock = false: gọi Firebase Cloud Function `postToFacebook` để relay Meta API (tránh CORS)
   */
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
      // Chế độ giả lập: delay 1.5s rồi trả về mock post ID
      await new Promise(resolve => setTimeout(resolve, 1500));
      const mockPostId = `mock-post-${Date.now()}`;
      const cardRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(cardRef, {
        status: 'published',
        publishedAt: new Date().toISOString(),
        facebookPostId: mockPostId
      });
      console.log(`[iGen ERP Autopost (MOCK)]: Đã đăng bài thành công lên Facebook Page (Demo). ID bài viết: ${mockPostId}`);
      return mockPostId;
    }

    // Gọi trực tiếp Express Backend thay vì Firebase Cloud Function
    const response = await fetch('/api/v1/facebook/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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

    // Cập nhật Firestore
    const cardRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(cardRef, {
      status: 'published',
      publishedAt: new Date().toISOString(),
      facebookPostId: postId
    });

    console.log(`[iGen ERP Autopost]: Đã đăng bài thành công lên Facebook Page qua n8n. Post ID: ${postId}`);
    return postId;
  },

  /**
   * Gọi API LLM để lập dàn ý và biên soạn bài đăng chi tiết cho từng kênh.
   */
  async developIdea(concept: {
    title: string;
    summary: string;
    suggestedContent: string;
    channels: string[];
  }) {
    return geminiApi.developMarketingIdea(concept);
  },

  /**
   * Tải các chủ đề gợi ý từ server.
   */
  async fetchSuggestions(): Promise<string[]> {
    return geminiApi.fetchMarketingSuggestions();
  },

  async updateCardMedia(mediaUrl: string | null, type: 'image' | 'video', cardIds: string[]): Promise<void> {
    try {
      if (cardIds.length === 0) return;
      // Dùng Promise.all + updateDoc thay vì writeBatch
      // vì Firestore Security Rules không cho phép gọi get() bên trong batch context
      // (isAdmin() gọi get() để lấy role → batch sẽ luôn thất bại với user thường)
      await Promise.all(
        cardIds.map((id) => {
          const docRef = doc(db, COLLECTION_NAME, id);
          const updateData: Record<string, unknown> = {};
          if (type === 'image') {
            updateData.imageUrl = mediaUrl ? mediaUrl : deleteField();
          } else {
            updateData.videoUrl = mediaUrl ? mediaUrl : deleteField();
          }
          return updateDoc(docRef, updateData);
        })
      );
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `${COLLECTION_NAME}/[media-update]`);
    }
  },

  /**
   * Tải tệp lên Cloudinary và trả về URL công khai
   */
  async uploadMediaToStorage(tempUrl: string, filename: string, type: 'image' | 'video'): Promise<string> {
    try {
      const response = await fetch('/api/v1/media/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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

  /**
   * Đăng bài lên TikTok.
   * - isMock = true: giả lập thành công sau 1.5s (không cần API thật)
   * - isMock = false: gọi Firebase Cloud Function `postToTikTok` (cần TikTok Developer App)
   */
  async publishToTikTok(
    id: string,
    caption: string,
    videoUrl: string,
    isMock: boolean,
    privacyLevel: string = 'SELF_ONLY'
  ): Promise<string> {
    if (isMock) {
      // Chế độ giả lập: delay 1.5s rồi trả về mock post ID
      await new Promise(resolve => setTimeout(resolve, 1500));
      const mockPostId = `tiktok_mock_${Date.now()}`;
      const cardRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(cardRef, {
        status: 'published',
        publishedAt: new Date().toISOString(),
        tiktokPostId: mockPostId,
        tiktokShareUrl: `https://www.tiktok.com/@demo/video/${mockPostId}`
      });
      console.log(`[iGen ERP TikTok (MOCK)]: Đã đăng video thành công. ID: ${mockPostId}`);
      return mockPostId;
    }

    // Real Mode: gọi API Local Express Server
    const response = await fetch('/api/v1/tiktok/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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

    const cardRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(cardRef, {
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
    // Bản nháp chi tiết tiếng Việt
    "# BẢN NHÁP CHI TIẾT (DRAFT)",
    "# BẢN NHÁP CHI TIẾT",
    "BẢN NHÁP CHI TIẾT (DRAFT)",
    "BẢN NHÁP CHI TIẾT",
    "[BẢN NHÁP CHI TIẾT (DRAFT)]",
    "[BẢN NHÁP CHI TIẾT]",
    "(BẢN NHÁP CHI TIẾT (DRAFT))",
    "(BẢN NHÁP CHI TIẾT)",
    
    // Nội dung chi tiết
    "✍️ NỘI DUNG CHI TIẾT (DRAFT CONTENT):",
    "✍️ NỘI DUNG CHI TIẾT (DRAFT CONTENT)",
    "NỘI DUNG CHI TIẾT (DRAFT CONTENT):",
    "NỘI DUNG CHI TIẾT (DRAFT CONTENT)",
    "✍️ NỘI DUNG CHI TIẾT:",
    "✍️ NỘI DUNG CHI TIẾT",
    "NỘI DUNG CHI TIẾT:",
    "NỘI DUNG CHI TIẾT",
    
    // Draft Content tiếng Anh
    "[DRAFT CONTENT]",
    "(DRAFT CONTENT)",
    "DRAFT CONTENT:",
    "DRAFT CONTENT",
    
    // Draft ngắn
    "[DRAFT]",
    "(DRAFT)",
    "DRAFT:",
    "DRAFT"
  ];

  // Sắp xếp các marker từ dài nhất đến ngắn nhất để tránh khớp nhầm marker con trước marker cha
  const sortedMarkers = [...markers].sort((a, b) => b.length - a.length);

  let currentText = text.trim();
  let found = true;
  let iterations = 0;
  
  // Lặp lại việc loại bỏ marker miễn là vẫn tìm thấy marker ở phần đầu văn bản (300 ký tự đầu)
  // Giới hạn số lần lặp tối đa là 5 để tránh vòng lặp vô hạn
  while (found && iterations < 5) {
    found = false;
    const prefix = currentText.substring(0, 1500);
    const prefixUpper = prefix.toUpperCase();
    
    for (const marker of sortedMarkers) {
      const index = prefixUpper.indexOf(marker.toUpperCase());
      // Marker phải nằm trong phần đầu của văn bản
      if (index !== -1) {
        currentText = currentText.substring(index + marker.length).trim();
        found = true;
        iterations++;
        break; // Quét lại từ đầu với currentText mới
      }
    }
  }
  
  return currentText;
}

/**
 * Phân tách Dàn ý (Outline) và Bản nháp bài đăng chi tiết (Draft Content)
 * từ một chuỗi văn bản do AI phát sinh.
 */
export function splitOutlineAndDraft(text: string): { outline: string; bodyText: string } {
  if (!text) return { outline: "", bodyText: "" };
  
  const markers = [
    // Bản nháp chi tiết tiếng Việt
    "# BẢN NHÁP CHI TIẾT (DRAFT)",
    "# BẢN NHÁP CHI TIẾT",
    "BẢN NHÁP CHI TIẾT (DRAFT)",
    "BẢN NHÁP CHI TIẾT",
    "[BẢN NHÁP CHI TIẾT (DRAFT)]",
    "[BẢN NHÁP CHI TIẾT]",
    "(BẢN NHÁP CHI TIẾT (DRAFT))",
    "(BẢN NHÁP CHI TIẾT)",
    
    // Nội dung chi tiết
    "✍️ NỘI DUNG CHI TIẾT (DRAFT CONTENT):",
    "✍️ NỘI DUNG CHI TIẾT (DRAFT CONTENT)",
    "NỘI DUNG CHI TIẾT (DRAFT CONTENT):",
    "NỘI DUNG CHI TIẾT (DRAFT CONTENT)",
    "✍️ NỘI DUNG CHI TIẾT:",
    "✍️ NỘI DUNG CHI TIẾT",
    "NỘI DUNG CHI TIẾT:",
    "NỘI DUNG CHI TIẾT",
    
    // Draft Content tiếng Anh
    "[DRAFT CONTENT]",
    "(DRAFT CONTENT)",
    "DRAFT CONTENT:",
    "DRAFT CONTENT",
    
    // Draft ngắn
    "[DRAFT]",
    "(DRAFT)",
    "DRAFT:",
    "DRAFT"
  ];

  // Sắp xếp các marker từ dài nhất đến ngắn nhất để tránh khớp nhầm marker con trước marker cha
  const sortedMarkers = [...markers].sort((a, b) => b.length - a.length);
  
  const prefix = text.substring(0, 1500);
  const prefixUpper = prefix.toUpperCase();
  
  for (const marker of sortedMarkers) {
    const index = prefixUpper.indexOf(marker.toUpperCase());
    if (index !== -1) {
      // Dàn ý là phần nằm trước marker
      const outline = text.substring(0, index).trim();
      // Nội dung bài đăng là phần từ marker trở đi (được lọc sạch các marker lặp lại nếu có)
      const bodyText = extractDraftContent(text.substring(index));
      return { outline, bodyText };
    }
  }
  
  // Nếu không tìm thấy marker nào, toàn bộ chuỗi được coi là nội dung bài đăng (không có dàn ý)
  return { outline: "", bodyText: text.trim() };
}
