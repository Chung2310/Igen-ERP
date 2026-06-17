import { Queue, Worker, Job } from "bullmq";
import { geminiService } from "./gemini.service";
import net from "net";

const redisConfig = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required configuration for BullMQ
};

const QUEUE_NAME = "remotion-render-queue";

let remotionQueue: Queue | null = null;
let worker: Worker | null = null;
let isRedisAvailable: boolean | null = null;

function handleRedisAuthError(err: Error) {
  const msg = err.message || "";
  if (
    msg.includes("NOAUTH") ||
    msg.includes("WRONGPASS") ||
    msg.includes("Authentication required") ||
    msg.includes("auth")
  ) {
    if (isRedisAvailable !== false) {
      console.warn(`[Remotion Queue] Redis yêu cầu xác thực nhưng thông tin cấu hình không khớp (${msg}). Hệ thống sẽ tự động tắt hàng đợi và chuyển sang chế độ kết xuất trực tiếp (Direct Render).`);
      isRedisAvailable = false;

      // Đóng kết nối Queue
      if (remotionQueue) {
        remotionQueue.close().catch(() => {});
        remotionQueue = null;
      }
      // Đóng kết nối Worker
      if (worker) {
        worker.close().catch(() => {});
        worker = null;
      }
    }
  }
}

function checkRedisConnection(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function ensureRedisConnection(): Promise<boolean> {
  if (isRedisAvailable !== null) {
    return isRedisAvailable;
  }
  const host = redisConfig.host;
  const port = redisConfig.port;
  console.log(`[Remotion Queue] Đang kiểm tra kết nối Redis tại ${host}:${port}...`);
  const connected = await checkRedisConnection(host, port);
  if (connected) {
    console.log(`[Remotion Queue] Kết nối Redis thành công.`);
    isRedisAvailable = true;
    try {
      remotionQueue = new Queue(QUEUE_NAME, { connection: redisConfig });
      remotionQueue.on("error", (err) => {
        handleRedisAuthError(err);
        if (isRedisAvailable) {
          console.warn("[Remotion Queue] Redis connection error on Queue:", err.message);
        }
      });
    } catch (e: any) {
      console.error("[Remotion Queue] Lỗi khi tạo Queue:", e.message);
      isRedisAvailable = false;
    }
  } else {
    console.warn(`[Remotion Queue] Không tìm thấy Redis tại ${host}:${port}. Hệ thống sẽ tự động chuyển sang chế độ kết xuất trực tiếp (Direct Render) không dùng hàng đợi.`);
    isRedisAvailable = false;
  }
  return isRedisAvailable;
}

export const remotionQueueService = {
  /**
   * Đẩy tác vụ render video vào hàng đợi Redis
   */
  async addRenderJob(recordId: string, videoUrl: string, blueprint: any, userId: string) {
    const hasRedis = await ensureRedisConnection();
    if (!hasRedis || !remotionQueue) {
      throw new Error("Redis không khả dụng");
    }

    console.log(`[Remotion Queue] Đang đẩy record ${recordId} vào hàng đợi...`);
    return remotionQueue.add(
      "render-video-job",
      { recordId, videoUrl, blueprint, userId },
      {
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
  },

  /**
   * Khởi tạo Worker xử lý các tác vụ render trong hàng đợi
   */
  async initWorker() {
    const hasRedis = await ensureRedisConnection();
    if (!hasRedis) {
      return;
    }

    if (worker) {
      console.log("[Remotion Queue] Worker đã được khởi tạo trước đó.");
      return;
    }

    const concurrency = Number(process.env.REMOTION_CONCURRENCY) || 3;
    console.log(`[Remotion Queue] Khởi tạo Worker với số tác vụ xử lý song song tối đa (concurrency) = ${concurrency}`);

    worker = new Worker(
      QUEUE_NAME,
      async (job: Job) => {
        const { recordId, videoUrl, blueprint, userId } = job.data;
        console.log(`[Remotion Queue Worker] Bắt đầu xử lý Job ${job.id} cho record ${recordId}`);

        // Gọi hàm kết xuất video đồng bộ bên trong Worker
        await geminiService.executeLocalRenderJob(recordId, videoUrl, blueprint, userId);
      },
      {
        connection: redisConfig,
        concurrency,
      }
    );

    worker.on("error", (err) => {
      handleRedisAuthError(err);
      if (isRedisAvailable) {
        console.warn("[Remotion Queue Worker] Redis connection error on Worker:", err.message);
      }
    });

    worker.on("completed", (job) => {
      console.log(`[Remotion Queue Worker] Job ${job.id} đã hoàn thành thành công.`);
    });

    worker.on("failed", (job, err) => {
      console.error(`[Remotion Queue Worker] Job ${job?.id} thất bại với lỗi:`, err);
    });
  }
};
