import { Queue, Worker, Job } from "bullmq";
import { geminiService } from "./gemini.service";

const redisConfig = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required configuration for BullMQ
};

const QUEUE_NAME = "remotion-render-queue";

// Pass the raw connection config object directly.
// BullMQ will internally instantiate its own Redis client using this config.
export const remotionQueue = new Queue(QUEUE_NAME, { connection: redisConfig });

let worker: Worker | null = null;

export const remotionQueueService = {
  /**
   * Đẩy tác vụ render video vào hàng đợi Redis
   */
  async addRenderJob(recordId: string, videoUrl: string, blueprint: any, userId: string) {
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
  initWorker() {
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

    worker.on("completed", (job) => {
      console.log(`[Remotion Queue Worker] Job ${job.id} đã hoàn thành thành công.`);
    });

    worker.on("failed", (job, err) => {
      console.error(`[Remotion Queue Worker] Job ${job?.id} thất bại với lỗi:`, err);
    });
  }
};
