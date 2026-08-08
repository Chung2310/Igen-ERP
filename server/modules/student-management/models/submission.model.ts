import { Schema, model } from "mongoose";
import { ISubmission } from "../interfaces/submission.interface";

const submissionSchema = new Schema<ISubmission>({
  assignmentId: { type: String, required: true, index: true },
  studentId: { type: String, required: true, index: true },
  attachments: { type: [new Schema({
    name: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, required: true },
    uploadToken: { type: String }
  }, { _id: false })], default: [] },
  studentNotes: { type: String, default: "" },
  submissionSource: { type: String, enum: ["student", "staff"], default: "student" },
  submittedByUserId: { type: String, default: "" },
  status: { type: String, enum: ["submitted", "graded", "late"], default: "submitted" },
  score: { type: Number, min: 0, max: 10 },
  feedback: { type: String, default: "" },
  submittedAt: { type: Date, default: Date.now },
  gradedAt: { type: Date }
}, { timestamps: true });

// Ensure unique submission per assignment per student
submissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });

export const SubmissionModel = model<ISubmission>("Submission", submissionSchema);
