import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import { geminiService } from "./gemini.service";

const redisConfig = {
  host: process.env.REDIS_HOST || "redis",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

const QUEUE_NAME = "remotion-render-queue";

let isRedisAvailable = false;
let checkPromise: Promise<boolean> | null = null;
let remotionQueue: Queue | null = null;
let worker: Worker | null = null;

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
    if (checkPromise) {
      return checkPromise;
    }

    checkPromise = (async () => {
      try {
        console.log("[Remotion Queue] Đang kiểm tra kết nối tới Redis...");
        await redisClient.connect();
        const ping = await redisClient.ping();
        if (ping === "PONG") {
          isRedisAvailable = true;
          console.log("[Remotion Queue] Kết nối Redis thành công. Sử dụng hàng đợi BullMQ.");
          return true;
        }
      } catch (err) {
        console.warn("[Remotion Queue] Không kết nối được Redis. Sẽ chạy render ngầm trực tiếp (không dùng hàng đợi).");
      } finally {
        try {
          await redisClient.quit();
        } catch (e) {}
      }
      isRedisAvailable = false;
      return false;
    })();

    return checkPromise;
  },

  /**
   * Đẩy tác vụ render video vào hàng đợi Redis (hoặc chạy trực tiếp nếu không có Redis)
   */
  async addRenderJob(recordId: string, videoUrl: string, blueprint: any, userId: string) {
    const connected = await this.checkRedis();

    if (!connected) {
      console.log(`[Remotion Queue] Redis không khả dụng. Chạy render trực tiếp trong background cho record ${recordId}...`);
      geminiService.executeLocalRenderJob(recordId, videoUrl, blueprint, userId).catch((err) => {
        console.error(`[Remotion Queue Direct Render] Lỗi khi render trực tiếp cho record ${recordId}:`, err);
      });
      return { id: "direct-render" } as any;
    }

    if (!remotionQueue) {
      remotionQueue = new Queue(QUEUE_NAME, { connection: redisConfig });
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
    if (worker) {
      console.log("[Remotion Queue] Worker đã được khởi tạo trước đó.");
      return;
    }

    const connected = await this.checkRedis();
    if (!connected) {
      console.log("[Remotion Queue] Chạy chế độ fallback: không khởi tạo Worker.");
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

    worker.on("completed", (job) => {
      console.log(`[Remotion Queue Worker] Job ${job.id} đã hoàn thành thành công.`);
    });

    worker.on("failed", (job, err) => {
      console.error(`[Remotion Queue Worker] Job ${job?.id} thất bại với lỗi:`, err);
    });
  }
};
