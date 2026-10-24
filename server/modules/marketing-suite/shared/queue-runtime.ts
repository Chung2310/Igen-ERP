import { Worker, type Processor, type WorkerOptions } from "bullmq";
import { stopQueueRecovery } from "./queue-recovery";
const workers = new Set<{ close(force?: boolean): Promise<void> }>();
export class SuiteWorker<Data = unknown, Result = unknown, Name extends string = string> extends Worker<Data, Result, Name> {
  constructor(name: string, processor?: Processor<Data, Result, Name> | string | URL | null, options?: WorkerOptions) {
    super(name, processor, options);
    workers.add(this);
    this.once("closed", () => workers.delete(this));
  }
}
export async function stopMarketingQueueWorkers() {
  stopQueueRecovery();
  await Promise.allSettled([...workers].map((worker) => worker.close()));
}
