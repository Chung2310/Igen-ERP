import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

/**
 * Trả về instance của GoogleGenAI client (Lazy loading để tránh crash ứng dụng khi thiếu GEMINI_API_KEY)
 */
export function getGeminiClient(): GoogleGenAI | null {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn(
        "⚠️ GEMINI_API_KEY không được định cấu hình trong biến môi trường. Các tính năng AI sẽ tự động kích hoạt chế độ giả lập thông minh."
      );
      return null;
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}
