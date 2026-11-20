import { KnowledgeJobModel } from "../../model/knowledge-job.model";

/** Call only after filtering documents by access; never expose job tokens or source IDs. */
export async function getKnowledgeProgress(companyCode: string, documentIds: unknown[]) {
  if (!documentIds.length) return new Map<string, any>();
  const jobs = await KnowledgeJobModel.aggregate([
    { $match: { companyCode, documentId: { $in: documentIds } } },
    { $sort: { createdAt: -1, _id: -1 } },
    { $group: { _id: "$documentId", job: { $first: "$$ROOT" } } },
    { $project: { "job.progress": 1, "job.status": 1, "job.error": 1 } },
  ]);
  return new Map(jobs.map((item) => [String(item._id), item.job]));
}
