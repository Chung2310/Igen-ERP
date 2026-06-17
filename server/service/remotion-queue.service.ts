import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import { geminiService } from "./gemini.service";
import net from "net";

const redisConfig = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

const QUEUE_NAME = "remotion-render-queue";

let remotionQueue: Queue | null = null;
let worker: Worker | null = null;
let isRedisAvailable: boolean | null = null;
let checkPromise: Promise<boolean> | null = null;

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

const redisClient = new Redis({
  host: redisConfig.host,
  port: redisConfig.port,
  password: redisConfig.password,
  maxRetriesPerRequest: null,
  connectTimeout: 2000, // Fail fast after 2 seconds if Redis is not running locally
  lazyConnect: true,
});

// Quietly ignore connection errors to prevent unhandled rejection spam in local/dev env
redisClient.on("error", () => {
  // Silence is golden
});

export const remotionQueueService = {
  /**
   * Kiểm tra kết nối tới Redis
   */
  async checkRedis(): Promise<boolean> {
    return ensureRedisConnection();
  },

  /**
   * Đẩy tác vụ render video vào hàng đợi Redis (hoặc chạy trực tiếp nếu không có Redis)
   */
  async addRenderJob(recordId: string, videoUrl: string, blueprint: any, userId: string) {
    const hasRedis = await ensureRedisConnection();

    if (!hasRedis || !remotionQueue) {
      console.log(`[Remotion Queue] Redis không khả dụng. Chạy render trực tiếp trong background cho record ${recordId}...`);
      geminiService.executeLocalRenderJob(recordId, videoUrl, blueprint, userId).catch((err) => {
        console.error(`[Remotion Queue Direct Render] Lỗi khi render trực tiếp cho record ${recordId}:`, err);
      });
      return { id: "direct-render" } as any;
    }

    console.log(`[Remotion Queue] Đang đẩy record ${recordId} vào hàng đợi Redis...`);
    try {
      return await remotionQueue.add(
        "render-video-job",
        { recordId, videoUrl, blueprint, userId },
        {
          removeOnComplete: true,
          removeOnFail: false,
        }
      );
    } catch (err) {
      console.warn(`[Remotion Queue] Lỗi khi add job vào Queue: ${err}. Chuyển sang chạy render trực tiếp...`);
      geminiService.executeLocalRenderJob(recordId, videoUrl, blueprint, userId).catch((directErr) => {
        console.error(`[Remotion Queue Direct Render Fallback] Lỗi khi render trực tiếp cho record ${recordId}:`, directErr);
      });
      return { id: "direct-render-fallback" } as any;
    }
  },

  /**
   * Khởi tạo Worker xử lý các tác vụ render trong hàng đợi
   */
  async initWorker() {
    const hasRedis = await ensureRedisConnection();
    if (!hasRedis) {
      console.log("[Remotion Queue] Chạy chế độ fallback: không khởi tạo Worker.");
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
