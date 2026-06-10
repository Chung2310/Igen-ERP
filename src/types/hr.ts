export type HRSubTabType = "SƠ ĐỒ TỔ CHỨC" | "GIAO VIỆC KANBAN" | "ĐÀO TẠO";

export interface EmployeeNode {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  avatar: string;
  level: number; // 1 = CEO, 2 = Director, 3 = Manager, 4 = Staff
  parentId?: string;
  status: "online" | "offline";
  division: string;
}

export interface Project {
  id: string;
  name: string;
  companyCode: string;
  creatorUid: string;
  createdAt: any;
}

export interface TaskHistoryEntry {
  time: string;
  user: string;
  action: string;
}

export interface HRTask {
  id: string;
  title: string;
  description?: string;
  assigneeUid: string;
  assignee: string;
  assigneeAvatar: string;
  dueDate: string;
  priority: "High" | "Medium" | "Low" | "Cao" | "Trung bình" | "Thấp";
  status: "Not Started" | "In Progress" | "Review/Testing" | "Done" | "Archived" | "todo" | "doing" | "done";
  category?: "Onboarding" | "Đào tạo" | "Tuyển dụng" | "Văn hóa";
  companyCode: string;
  creatorUid: string;
  createdAt: any;

  // New Notion fields
  projectId?: string;
  startTime?: string;
  estTime?: number;
  endTime?: string;
  actualTime?: number;
  tags?: string[];
  linkNote?: string;
  history?: TaskHistoryEntry[];
}

export interface Lesson {
  title: string;
  url: string;
  type: "youtube" | "document" | "other";
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctOptionIndex: number;
}

export interface TrainingCourse {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  isRequired: boolean;
  icon: string;
  imageUrl?: string;
  duration: string;
  instructor: string;
  companyCode: string;
  creatorUid: string;
  createdAt: any;
  enrolledCount: number;
  companyProgress: number;
  autoAssignOnboarding: boolean;
  lessons?: Lesson[];
  quizzes?: QuizQuestion[];
}

export interface TrainingEnrollment {
  id: string;
  courseId: string;
  courseTitle: string;
  uid: string;
  userName: string;
  companyCode: string;
  progress: number;
  status: "not_started" | "in_progress" | "completed";
  startedAt?: any;
  completedAt?: any;
  createdAt: any;
  completedLessons?: string[];
  quizPassed?: boolean;
}
