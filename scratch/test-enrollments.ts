import dotenv from "dotenv";
import mongoose from "mongoose";
import { TrainingEnrollmentModel } from "../server/model/training-enrollment.model";
import { TrainingCourseModel } from "../server/model/training-course.model";

dotenv.config();

async function run() {
  const dbUri = process.env.MONGODB_URI;
  if (!dbUri) {
    console.error("MONGODB_URI is missing in .env!");
    process.exit(1);
  }
  await mongoose.connect(dbUri);
  console.log("Connected to MongoDB!");

  try {
    const enrollments = await TrainingEnrollmentModel.find({}).lean();
    console.log(`Total Enrollments in DB: ${enrollments.length}`);
    console.log("First 5 enrollments:", enrollments.slice(0, 5));

    const courses = await TrainingCourseModel.find({}).lean();
    console.log(`Total Courses in DB: ${courses.length}`);
    console.log("First 5 courses:", courses.slice(0, 5).map(c => ({ id: c._id, title: c.title })));
  } catch (err: any) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
