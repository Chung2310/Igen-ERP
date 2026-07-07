export type HRSubTabType = "SƠ ĐỒ TỔ CHỨC" | "GIAO VIỆC KANBAN" | "ĐÀO TẠO" | "QUY TRÌNH" | "LỊCH";

export interface WorkflowStep {
  id: string;
  title: string;
  description?: string;
  assigneeUid?: string;
  assignee?: string;
  /** @deprecated Không còn phân loại ô — giữ lại để tương thích dữ liệu cũ */
  type?: "start" | "task" | "approval" | "end";
  estDays?: number;
  /** Kết quả / đầu ra mong đợi của bước */
  deliverable?: string;
  /** Lưu ý / điều kiện thực hiện */
  note?: string;
  /** @deprecated Không còn dùng canvas — giữ lại để tương thích dữ liệu cũ */
  position?: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

/** Một người đang đi qua quy trình, đứng ở cột (bước) hiện tại */
export interface WorkflowParticipant {
  id: string;
  /** Tên người thực hiện (nhân viên/ứng viên…) */
  name: string;
  /** Liên kết tới tài khoản hệ thống (nếu có) */
  userUid?: string;
  avatar?: string;
  /** id của bước hiện tại; "__done__" = đã hoàn thành */
  currentStepId: string;
  note?: string;
  startedAt?: string;
  updatedAt?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  category?: string;
  steps: WorkflowStep[];
  edges?: WorkflowEdge[];
  participants?: WorkflowParticipant[];
  companyCode: string;
  creatorUid: string;
  createdAt: any;
}

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
  type: "youtube" | "document" | "other" | "text" | "video";
  content?: string;
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
