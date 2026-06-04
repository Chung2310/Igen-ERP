import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();


/**
 * Cloud Function: postToFacebook
 * Region: asia-southeast1 (Singapore - gần VN nhất)
 *
 * Relay gọi Meta Graph API từ phía server để tránh CORS khi gọi từ browser.
 */
export const postToFacebook = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
    memory: "256MiB",
    region: "asia-southeast1",
  },
  async (request) => {
    // 1. Kiểm tra đã đăng nhập
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Bạn cần đăng nhập để sử dụng tính năng này."
      );
    }

    const { pageId, pageAccessToken, message, imageUrl } = request.data as {
      pageId: string;
      pageAccessToken: string;
      message: string;
      imageUrl?: string;
    };

    // 2. Validate
    if (!pageId?.trim()) {
      throw new HttpsError("invalid-argument", "Page ID không được để trống.");
    }
    if (!pageAccessToken?.trim()) {
      throw new HttpsError(
        "invalid-argument",
        "Page Access Token không được để trống."
      );
    }
    if (!message?.trim()) {
      throw new HttpsError(
        "invalid-argument",
        "Nội dung bài đăng không được để trống."
      );
    }

    console.log(
      `[iGen Autopost] Đăng bài lên Page ${pageId} (uid: ${request.auth.uid})`
    );

    try {
      // 3. Chuẩn bị request đến Meta API
      let endpoint = `https://graph.facebook.com/v20.0/${pageId}/feed`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: Record<string, any> = {
        access_token: pageAccessToken.trim(),
      };

      const cleanMessage = extractDraftContent(message);
      if (imageUrl?.trim()) {
        // Đăng kèm ảnh
        endpoint = `https://graph.facebook.com/v20.0/${pageId}/photos`;
        payload.url = imageUrl.trim();
        payload.caption = cleanMessage;
      } else {
        payload.message = cleanMessage;
      }

      // 4. Gọi Meta Graph API
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (await response.json()) as Record<string, any>;

      if (!response.ok || data.error) {
        const fbErr = data.error ?? {};
        const code: number = fbErr.code ?? 0;
        const fbMsg: string =
          fbErr.message ?? `Meta API HTTP ${response.status}`;

        console.error(`[iGen Autopost] Lỗi Meta API code=${code}:`, fbMsg);

        // Map lỗi phổ biến sang tiếng Việt
        let userMsg = fbMsg;
        if (code === 190) {
          userMsg =
            "Page Access Token đã hết hạn. Vào Cài đặt → Liên kết MXH và kết nối lại.";
        } else if (code === 200 || code === 100) {
          userMsg =
            "Không đủ quyền đăng bài lên Page này. Kiểm tra lại quyền của Access Token.";
        } else if (code === 368) {
          userMsg = "Facebook Page bị hạn chế đăng nội dung tạm thời.";
        }

        throw new HttpsError("unknown", `Lỗi Facebook: ${userMsg}`);
      }

      const postId: string = data.id ?? data.post_id ?? "unknown";
      console.log(`[iGen Autopost] Thành công! Post ID: ${postId}`);

      return {
        postId,
        pageId,
        postedAt: new Date().toISOString(),
        success: true,
      };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[iGen Autopost] Lỗi không mong đợi:", msg);
      throw new HttpsError("internal", `Lỗi server: ${msg}`);
    }
  }
);

export const postToTikTok = onCall(
  {
    cors: true,
    timeoutSeconds: 30,
    memory: "256MiB",
    region: "asia-southeast1",
  },
  async (request) => {
    // 1. Kiểm tra đã đăng nhập
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Bạn cần đăng nhập để sử dụng tính năng này."
      );
    }

    const { cardId, caption, videoUrl, privacyLevel } = request.data as {
      cardId: string;
      caption: string;
      videoUrl: string;
      privacyLevel?: string;
    };

    if (!cardId?.trim()) {
      throw new HttpsError("invalid-argument", "Card ID không được để trống.");
    }
    if (!videoUrl?.trim()) {
      throw new HttpsError("invalid-argument", "Video URL không được để trống.");
    }

    console.log(`[iGen TikTok] Đăng video cho card ${cardId} (uid: ${request.auth.uid}) với caption: "${caption || ""}" và privacy: ${privacyLevel || "mặc định"}`);

    try {
      // Vì chưa có TikTok Developer App, giả lập đăng video thành công hoặc ghi nhận theo mock.
      const mockPostId = `tiktok_mock_${Date.now()}`;
      const shareUrl = `https://www.tiktok.com/@demo/video/${mockPostId}`;

      console.log(`[iGen TikTok] Đăng thành công (MOCK). Post ID: ${mockPostId}, Video URL: ${videoUrl}`);

      return {
        success: true,
        postId: mockPostId,
        shareUrl,
      };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[iGen TikTok] Lỗi không mong đợi:", msg);
      throw new HttpsError("internal", `Lỗi server: ${msg}`);
    }
  }
);

export const publishScheduledPosts = onSchedule(
  {
    schedule: "*/15 * * * *", // Chạy mỗi 15 phút
    timeZone: "Asia/Ho_Chi_Minh", // Múi giờ Việt Nam
    region: "asia-southeast1",
    memory: "256MiB",
  },
  async (event) => {
    console.log("[iGen Scheduler] Running scheduled post checker...");
    const now = new Date();
    
    // Đổi sang múi giờ Việt Nam định dạng YYYY-MM-DD và HH:MM
    const tzOffset = 7 * 60; // UTC+7
    const vnTime = new Date(now.getTime() + tzOffset * 60 * 1000);
    const currentDateStr = vnTime.toISOString().slice(0, 10);
    const currentTimeStr = vnTime.toISOString().slice(11, 16);

    console.log(`[iGen Scheduler] Current VN Time: ${currentDateStr} ${currentTimeStr}`);

    const marketingContentsRef = db.collection("marketingContents");
    const snapshot = await marketingContentsRef
      .where("status", "==", "scheduled")
      .get();

    if (snapshot.empty) {
      console.log("[iGen Scheduler] No scheduled posts found.");
      return;
    }

    for (const docSnap of snapshot.docs) {
      const card = docSnap.data();
      const scheduledDate = card.scheduledDate;
      const scheduledTime = card.scheduledTime || "00:00";

      if (!scheduledDate) continue;

      const isDue = 
        scheduledDate < currentDateStr || 
        (scheduledDate === currentDateStr && scheduledTime <= currentTimeStr);

      if (isDue) {
        console.log(`[iGen Scheduler] Post "${card.title}" (ID: ${docSnap.id}) is due!`);
        try {
          const authorUid = card.authorUid;
          if (!authorUid) {
            console.error(`[iGen Scheduler] Error: Card ${docSnap.id} has no authorUid.`);
            continue;
          }

          const userDoc = await db.collection("users").doc(authorUid).get();
          if (!userDoc.exists) {
            console.error(`[iGen Scheduler] Error: User profile for UID ${authorUid} not found.`);
            continue;
          }

          const userProfile = userDoc.data();
          const channel = card.channel || "Facebook";

          if (channel === "Facebook") {
            const fbIntegration = userProfile?.facebookIntegration;

            if (!fbIntegration || !fbIntegration.isConnected) {
              console.log(`[iGen Scheduler] Facebook not connected for user ${authorUid}. Skipping.`);
              continue;
            }

            const { pageId, pageAccessToken, isMock } = fbIntegration;

            if (isMock) {
              const mockPostId = `mock-post-scheduled-${Date.now()}`;
              await docSnap.ref.update({
                status: "published",
                publishedAt: new Date().toISOString(),
                facebookPostId: mockPostId
              });
              console.log(`[iGen Scheduler] Mock published card ${docSnap.id} to Facebook successfully!`);
            } else {
              let endpoint = `https://graph.facebook.com/v20.0/${pageId}/feed`;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const payload: Record<string, any> = {
                access_token: pageAccessToken.trim(),
              };

              const cleanMessage = extractDraftContent(card.bodyText || "");
              if (card.imageUrl?.trim()) {
                endpoint = `https://graph.facebook.com/v20.0/${pageId}/photos`;
                payload.url = card.imageUrl.trim();
                payload.caption = cleanMessage;
              } else {
                payload.message = cleanMessage;
              }

              const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
                body: JSON.stringify(payload),
              });

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const data = (await response.json()) as Record<string, any>;

              if (!response.ok || data.error) {
                console.error(`[iGen Scheduler] Meta API error for card ${docSnap.id}:`, data.error);
                continue;
              }

              const postId = data.id ?? data.post_id ?? "unknown";
              await docSnap.ref.update({
                status: "published",
                publishedAt: new Date().toISOString(),
                facebookPostId: postId
              });
              console.log(`[iGen Scheduler] Published card ${docSnap.id} to Facebook Page successfully. Post ID: ${postId}`);
            }
          } else if (channel === "TikTok") {
            const tiktokIntegration = userProfile?.tiktokIntegration;

            if (!tiktokIntegration || !tiktokIntegration.isConnected) {
              console.log(`[iGen Scheduler] TikTok not connected for user ${authorUid}. Skipping.`);
              continue;
            }

            const mockPostId = `tiktok_mock_scheduled_${Date.now()}`;
            const mockShareUrl = `https://www.tiktok.com/@demo/video/${mockPostId}`;

            await docSnap.ref.update({
              status: "published",
              publishedAt: new Date().toISOString(),
              tiktokPostId: mockPostId,
              tiktokShareUrl: mockShareUrl
            });
            console.log(`[iGen Scheduler] Mock published card ${docSnap.id} to TikTok successfully!`);
          } else {
            console.warn(`[iGen Scheduler] Channel "${channel}" is not supported yet for auto-publish.`);
          }
        } catch (err) {
          console.error(`[iGen Scheduler] Error processing scheduled card ${docSnap.id}:`, err);
        }
      }
    }
  }
);

export const validateFacebookToken = onCall(
  {
    cors: true,
    timeoutSeconds: 15,
    memory: "256MiB",
    region: "asia-southeast1",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Bạn cần đăng nhập để thực hiện chức năng này."
      );
    }

    const { pageId, pageAccessToken } = request.data as {
      pageId: string;
      pageAccessToken: string;
    };

    if (!pageId?.trim()) {
      throw new HttpsError("invalid-argument", "Page ID không được để trống.");
    }
    if (!pageAccessToken?.trim()) {
      throw new HttpsError("invalid-argument", "Page Access Token không được để trống.");
    }

    console.log(`[iGen Token Validator] Validating token for page ${pageId}...`);

    try {
      const response = await fetch(
        `https://graph.facebook.com/v20.0/me?fields=id,name&access_token=${pageAccessToken.trim()}`
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (await response.json()) as Record<string, any>;

      if (!response.ok || data.error) {
        const fbErr = data.error ?? {};
        const code: number = fbErr.code ?? 0;
        const fbMsg: string = fbErr.message ?? `Meta API HTTP ${response.status}`;

        console.error(`[iGen Token Validator] Lỗi Meta API:`, fbMsg);

        let userMsg = fbMsg;
        if (code === 190) {
          userMsg = "Access Token không hợp lệ hoặc đã hết hạn.";
        } else if (code === 200 || code === 100) {
          userMsg = "Access Token không có quyền quản lý Trang này.";
        }

        throw new HttpsError("invalid-argument", `Lỗi Facebook: ${userMsg}`);
      }

      // Xác thực ID của trang tương thích với token
      const tokenPageId = data.id;
      if (tokenPageId !== pageId.trim()) {
        console.error(`[iGen Token Validator] Mismatch Page ID. Input: ${pageId.trim()}, Token: ${tokenPageId}`);
        throw new HttpsError(
          "invalid-argument",
          `Lỗi Facebook: Mã Access Token này thuộc về một Trang khác (ID: ${tokenPageId}). Vui lòng điền đúng Page ID.`
        );
      }

      console.log(`[iGen Token Validator] Xác thực thành công Page: ${data.name}`);
      return {
        valid: true,
        pageName: data.name,
      };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[iGen Token Validator] Lỗi kết nối:", msg);
      throw new HttpsError("internal", `Không thể kết nối tới Meta API: ${msg}`);
    }
  }
);

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
