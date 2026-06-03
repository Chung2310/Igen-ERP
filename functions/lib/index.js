"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateFacebookToken = exports.publishScheduledPosts = exports.postToFacebook = void 0;
exports.extractDraftContent = extractDraftContent;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
/**
 * Cloud Function: postToFacebook
 * Region: asia-southeast1 (Singapore - gần VN nhất)
 *
 * Relay gọi Meta Graph API từ phía server để tránh CORS khi gọi từ browser.
 */
exports.postToFacebook = (0, https_1.onCall)({
    cors: true,
    timeoutSeconds: 30,
    memory: "256MiB",
    region: "asia-southeast1",
}, async (request) => {
    var _a, _b, _c, _d, _e;
    // 1. Kiểm tra đã đăng nhập
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Bạn cần đăng nhập để sử dụng tính năng này.");
    }
    const { pageId, pageAccessToken, message, imageUrl } = request.data;
    // 2. Validate
    if (!(pageId === null || pageId === void 0 ? void 0 : pageId.trim())) {
        throw new https_1.HttpsError("invalid-argument", "Page ID không được để trống.");
    }
    if (!(pageAccessToken === null || pageAccessToken === void 0 ? void 0 : pageAccessToken.trim())) {
        throw new https_1.HttpsError("invalid-argument", "Page Access Token không được để trống.");
    }
    if (!(message === null || message === void 0 ? void 0 : message.trim())) {
        throw new https_1.HttpsError("invalid-argument", "Nội dung bài đăng không được để trống.");
    }
    console.log(`[iGen Autopost] Đăng bài lên Page ${pageId} (uid: ${request.auth.uid})`);
    try {
        // 3. Chuẩn bị request đến Meta API
        let endpoint = `https://graph.facebook.com/v20.0/${pageId}/feed`;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload = {
            access_token: pageAccessToken.trim(),
        };
        const cleanMessage = extractDraftContent(message);
        if (imageUrl === null || imageUrl === void 0 ? void 0 : imageUrl.trim()) {
            // Đăng kèm ảnh
            endpoint = `https://graph.facebook.com/v20.0/${pageId}/photos`;
            payload.url = imageUrl.trim();
            payload.caption = cleanMessage;
        }
        else {
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
        const data = (await response.json());
        if (!response.ok || data.error) {
            const fbErr = (_a = data.error) !== null && _a !== void 0 ? _a : {};
            const code = (_b = fbErr.code) !== null && _b !== void 0 ? _b : 0;
            const fbMsg = (_c = fbErr.message) !== null && _c !== void 0 ? _c : `Meta API HTTP ${response.status}`;
            console.error(`[iGen Autopost] Lỗi Meta API code=${code}:`, fbMsg);
            // Map lỗi phổ biến sang tiếng Việt
            let userMsg = fbMsg;
            if (code === 190) {
                userMsg =
                    "Page Access Token đã hết hạn. Vào Cài đặt → Liên kết MXH và kết nối lại.";
            }
            else if (code === 200 || code === 100) {
                userMsg =
                    "Không đủ quyền đăng bài lên Page này. Kiểm tra lại quyền của Access Token.";
            }
            else if (code === 368) {
                userMsg = "Facebook Page bị hạn chế đăng nội dung tạm thời.";
            }
            throw new https_1.HttpsError("unknown", `Lỗi Facebook: ${userMsg}`);
        }
        const postId = (_e = (_d = data.id) !== null && _d !== void 0 ? _d : data.post_id) !== null && _e !== void 0 ? _e : "unknown";
        console.log(`[iGen Autopost] Thành công! Post ID: ${postId}`);
        return {
            postId,
            pageId,
            postedAt: new Date().toISOString(),
            success: true,
        };
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[iGen Autopost] Lỗi không mong đợi:", msg);
        throw new https_1.HttpsError("internal", `Lỗi server: ${msg}`);
    }
});
exports.publishScheduledPosts = (0, scheduler_1.onSchedule)({
    schedule: "* * * * *", // Chạy mỗi phút
    timeZone: "Asia/Ho_Chi_Minh", // Múi giờ Việt Nam
    region: "asia-southeast1",
    memory: "256MiB",
}, async (event) => {
    var _a, _b, _c;
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
        if (!scheduledDate)
            continue;
        const isDue = scheduledDate < currentDateStr ||
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
                const fbIntegration = userProfile === null || userProfile === void 0 ? void 0 : userProfile.facebookIntegration;
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
                    console.log(`[iGen Scheduler] Mock published card ${docSnap.id} successfully!`);
                }
                else {
                    let endpoint = `https://graph.facebook.com/v20.0/${pageId}/feed`;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const payload = {
                        access_token: pageAccessToken.trim(),
                    };
                    const cleanMessage = extractDraftContent(card.bodyText || "");
                    if ((_a = card.imageUrl) === null || _a === void 0 ? void 0 : _a.trim()) {
                        endpoint = `https://graph.facebook.com/v20.0/${pageId}/photos`;
                        payload.url = card.imageUrl.trim();
                        payload.caption = cleanMessage;
                    }
                    else {
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
                    const data = (await response.json());
                    if (!response.ok || data.error) {
                        console.error(`[iGen Scheduler] Meta API error for card ${docSnap.id}:`, data.error);
                        continue;
                    }
                    const postId = (_c = (_b = data.id) !== null && _b !== void 0 ? _b : data.post_id) !== null && _c !== void 0 ? _c : "unknown";
                    await docSnap.ref.update({
                        status: "published",
                        publishedAt: new Date().toISOString(),
                        facebookPostId: postId
                    });
                    console.log(`[iGen Scheduler] Published card ${docSnap.id} to Facebook Page successfully. Post ID: ${postId}`);
                }
            }
            catch (err) {
                console.error(`[iGen Scheduler] Error processing scheduled card ${docSnap.id}:`, err);
            }
        }
    }
});
exports.validateFacebookToken = (0, https_1.onCall)({
    cors: true,
    timeoutSeconds: 15,
    memory: "256MiB",
    region: "asia-southeast1",
}, async (request) => {
    var _a, _b, _c;
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Bạn cần đăng nhập để thực hiện chức năng này.");
    }
    const { pageId, pageAccessToken } = request.data;
    if (!(pageId === null || pageId === void 0 ? void 0 : pageId.trim())) {
        throw new https_1.HttpsError("invalid-argument", "Page ID không được để trống.");
    }
    if (!(pageAccessToken === null || pageAccessToken === void 0 ? void 0 : pageAccessToken.trim())) {
        throw new https_1.HttpsError("invalid-argument", "Page Access Token không được để trống.");
    }
    console.log(`[iGen Token Validator] Validating token for page ${pageId}...`);
    try {
        const response = await fetch(`https://graph.facebook.com/v20.0/me?fields=id,name&access_token=${pageAccessToken.trim()}`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (await response.json());
        if (!response.ok || data.error) {
            const fbErr = (_a = data.error) !== null && _a !== void 0 ? _a : {};
            const code = (_b = fbErr.code) !== null && _b !== void 0 ? _b : 0;
            const fbMsg = (_c = fbErr.message) !== null && _c !== void 0 ? _c : `Meta API HTTP ${response.status}`;
            console.error(`[iGen Token Validator] Lỗi Meta API:`, fbMsg);
            let userMsg = fbMsg;
            if (code === 190) {
                userMsg = "Access Token không hợp lệ hoặc đã hết hạn.";
            }
            else if (code === 200 || code === 100) {
                userMsg = "Access Token không có quyền quản lý Trang này.";
            }
            throw new https_1.HttpsError("invalid-argument", `Lỗi Facebook: ${userMsg}`);
        }
        // Xác thực ID của trang tương thích với token
        const tokenPageId = data.id;
        if (tokenPageId !== pageId.trim()) {
            console.error(`[iGen Token Validator] Mismatch Page ID. Input: ${pageId.trim()}, Token: ${tokenPageId}`);
            throw new https_1.HttpsError("invalid-argument", `Lỗi Facebook: Mã Access Token này thuộc về một Trang khác (ID: ${tokenPageId}). Vui lòng điền đúng Page ID.`);
        }
        console.log(`[iGen Token Validator] Xác thực thành công Page: ${data.name}`);
        return {
            valid: true,
            pageName: data.name,
        };
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[iGen Token Validator] Lỗi kết nối:", msg);
        throw new https_1.HttpsError("internal", `Không thể kết nối tới Meta API: ${msg}`);
    }
});
function extractDraftContent(text) {
    if (!text)
        return "";
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
//# sourceMappingURL=index.js.map