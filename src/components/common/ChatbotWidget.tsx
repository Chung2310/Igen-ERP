import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue } from "motion/react";
import { Bot, SendHorizontal, Trash2, X, Sparkles, Loader2 } from "lucide-react";
import { toast } from "../../pages/Toast";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

const STORAGE_KEY = "igen_erp_chatbot_history";
const POSITION_KEY = "igen_erp_chatbot_fab_pos";

// Tin nhắn chào mừng ban đầu
const welcomeMessage: Message = {
  role: "assistant",
  content: `Chào bạn! Tôi là **trợ lý ảo AI** của hệ thống iGen ERP.

Tôi có thể giúp bạn tra cứu nhanh dữ liệu doanh nghiệp:
- **Khách hàng** — quy trình bán hàng, trạng thái, giá trị cơ hội.
- **Kho hàng** — tồn kho, mặt hàng sắp hết, giá trị tồn.
- **Dự án & công việc** — tiến độ, phân bổ trạng thái.
- **Marketing & tài chính** — nội dung, số dư ví.

Bạn cần tôi hỗ trợ thông tin gì hôm nay?`,
};

const quickSuggestions = [
  "Quy trình bán hàng hiện tại thế nào?",
  "Có mặt hàng nào sắp hết tồn không?",
  "Tổng quan công việc đang chạy?",
];

export const ChatbotWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Không đọc được lịch sử chatbot", e);
      }
    }
    return [welcomeMessage];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Kéo-thả nút nổi: constraints giới hạn trong màn hình, motion values lưu offset
  const dragConstraintsRef = useRef<HTMLDivElement>(null);
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const didDragRef = useRef(false); // phân biệt kéo với click

  // Khôi phục vị trí nút đã lưu
  useEffect(() => {
    const saved = localStorage.getItem(POSITION_KEY);
    if (saved) {
      try {
        const pos = JSON.parse(saved);
        if (typeof pos.x === "number") dragX.set(pos.x);
        if (typeof pos.y === "number") dragY.set(pos.y);
      } catch (e) {
        console.error("Không đọc được vị trí nút chatbot", e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFabClick = () => {
    // Nếu vừa kéo thì bỏ qua, không toggle cửa sổ
    if (didDragRef.current) return;
    setIsOpen((prev) => !prev);
  };

  const saveHistory = (newMessages: Message[]) => {
    setMessages(newMessages);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newMessages));
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, isOpen, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    if (!textToSend) {
      setInput("");
    }

    const updatedUserMessages: Message[] = [...messages, { role: "user", content: text }];
    saveHistory(updatedUserMessages);
    setIsLoading(true);

    try {
      const apiMessages = updatedUserMessages
        .filter((msg) => msg.role === "user" || msg.role === "assistant")
        .map((msg) => ({ role: msg.role, content: msg.content }));

      const token = localStorage.getItem("accessToken");
      const response = await fetch("/api/v1/chatbot/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: apiMessages }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success && data.reply) {
        saveHistory([...updatedUserMessages, { role: "assistant", content: data.reply }]);
      } else {
        throw new Error(data.message || data.error || "Không nhận được phản hồi từ trợ lý ảo.");
      }
    } catch (error) {
      console.error("Chatbot Error:", error);
      toast.error(error instanceof Error ? error.message : "Đã xảy ra lỗi khi kết nối với AI.");
      // Giữ nguyên danh sách tin nhắn để người dùng thử lại
    } finally {
      setIsLoading(false);
    }
  };

  // Parse markdown cơ bản: bôi đậm, dấu đầu dòng, xuống dòng
  const renderMessageContent = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      const isBullet =
        line.trim().startsWith("- ") || line.trim().startsWith("* ") || line.trim().startsWith("• ");
      const content = isBullet ? line.trim().substring(2) : line;

      const parts = content.split(/(\*\*.*?\*\*)/g);
      const parsedLine = parts.map((part, pIdx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={pIdx} className="font-extrabold text-slate-900">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });

      if (isBullet) {
        return (
          <div key={idx} className="flex items-start gap-2 my-1 pl-1">
            <span className="text-blue-500 mt-1.5 shrink-0 select-none">•</span>
            <span className="text-slate-700 leading-relaxed text-xs sm:text-sm">{parsedLine}</span>
          </div>
        );
      }

      if (!line.trim()) {
        return <div key={idx} className="h-2" />;
      }

      return (
        <p key={idx} className="my-1 text-slate-700 leading-relaxed text-xs sm:text-sm">
          {parsedLine}
        </p>
      );
    });
  };

  return (
    <>
      {/* Vùng giới hạn kéo-thả (toàn màn hình, không chặn tương tác bên dưới) */}
      <div ref={dragConstraintsRef} className="fixed inset-2 z-[60] pointer-events-none">
        {/* Nút nổi mở chatbot — có thể kéo di chuyển */}
        <motion.button
          drag
          dragConstraints={dragConstraintsRef}
          dragMomentum={false}
          dragElastic={0.08}
          style={{ x: dragX, y: dragY }}
          onDragStart={() => {
            didDragRef.current = true;
          }}
          onDragEnd={() => {
            localStorage.setItem(
              POSITION_KEY,
              JSON.stringify({ x: dragX.get(), y: dragY.get() })
            );
            // Reset sau khi sự kiện click (nếu có) đã được xử lý
            setTimeout(() => {
              didDragRef.current = false;
            }, 0);
          }}
          onClick={handleFabClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          whileDrag={{ scale: 1.1, cursor: "grabbing" }}
          className="pointer-events-auto absolute bottom-4 right-4 w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-indigo-600 hover:to-blue-600 text-white rounded-full shadow-lg shadow-blue-500/25 flex items-center justify-center cursor-grab active:cursor-grabbing border border-white/10 touch-none"
          aria-label="Mở trợ lý ảo AI (có thể kéo để di chuyển)"
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ rotate: -45, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 45, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <X className="w-6 h-6" />
              </motion.div>
            ) : (
              <motion.div
                key="chat"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="relative"
              >
                <Bot className="w-6 h-6" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-indigo-600 animate-pulse" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Cửa sổ chat */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 250 }}
            className="fixed bottom-24 right-6 w-96 h-[550px] max-h-[calc(100vh-8rem)] max-w-[calc(100vw-2rem)] bg-white/95 backdrop-blur-md rounded-[2rem] border border-slate-100/50 shadow-2xl flex flex-col z-[60] overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-inner">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-black tracking-tight flex items-center gap-1.5">
                    Trợ lý ảo AI
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  </h4>
                  <p className="text-[10px] text-blue-100 font-bold tracking-wide uppercase flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    Trực tuyến
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {messages.length > 1 && (
                  <button
                    onClick={() => setShowConfirmClear(true)}
                    className="p-2 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                    title="Làm mới lịch sử chat"
                  >
                    <Trash2 className="w-4 h-4 text-blue-100 hover:text-white" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4 text-blue-100 hover:text-white" />
                </button>
              </div>
            </div>

            {/* Thân tin nhắn */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
              {messages.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`flex gap-2.5 max-w-[85%] ${
                      msg.role === "user" ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    {msg.role !== "user" && (
                      <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 mt-1 shadow-sm">
                        <Bot className="w-4 h-4 text-blue-600" />
                      </div>
                    )}
                    <div
                      className={`px-4 py-3 rounded-2xl text-slate-800 shadow-sm ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white rounded-br-none font-medium"
                          : "bg-white rounded-bl-none border border-slate-100"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        renderMessageContent(msg.content)
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Đang gõ */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-2.5 max-w-[85%]">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 mt-1 shadow-sm">
                      <Bot className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="px-4 py-3 rounded-2xl rounded-bl-none bg-white border border-slate-100 flex items-center gap-1.5 shadow-sm min-h-[38px]">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                    </div>
                  </div>
                </div>
              )}

              {/* Gợi ý câu hỏi */}
              {messages.length === 1 && !isLoading && (
                <div className="pt-2 space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                    Gợi ý câu hỏi:
                  </p>
                  <div className="space-y-1.5">
                    {quickSuggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(suggestion)}
                        className="w-full text-left px-4 py-2.5 bg-white hover:bg-blue-50/30 text-xs font-bold text-slate-600 hover:text-blue-600 rounded-xl border border-slate-100 hover:border-blue-100 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Ô nhập */}
            <div className="p-4 bg-white border-t border-slate-100/80 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Hỏi trợ lý ảo..."
                  disabled={isLoading}
                  className="flex-1 h-11 bg-slate-50 border border-slate-200 focus:border-blue-500 px-4 rounded-xl text-xs sm:text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/5 transition-all text-slate-800 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="w-11 h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-blue-500/10 active:scale-95 cursor-pointer shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <SendHorizontal className="w-4 h-4" />
                  )}
                </button>
              </form>
            </div>

            {/* Hộp thoại xác nhận xóa */}
            <AnimatePresence>
              {showConfirmClear && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
                >
                  <motion.div
                    initial={{ scale: 0.9, y: 10 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 10 }}
                    className="bg-white rounded-3xl p-6 shadow-2xl max-w-xs w-full text-center space-y-4 border border-slate-100/50"
                  >
                    <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mx-auto">
                      <Trash2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-slate-800">Xóa lịch sử chat?</h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Hành động này sẽ xóa toàn bộ nội dung trò chuyện hiện tại và không thể hoàn tác.
                      </p>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowConfirmClear(false)}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer border border-slate-200/20"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          saveHistory([welcomeMessage]);
                          toast.success("Đã làm mới lịch sử trò chuyện!");
                          setShowConfirmClear(false);
                        }}
                        className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/10 transition-all active:scale-95 cursor-pointer"
                      >
                        Xóa
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
